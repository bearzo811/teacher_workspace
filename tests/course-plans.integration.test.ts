import assert from "node:assert/strict";
import test from "node:test";
import { config } from "dotenv";
import { and, eq, like } from "drizzle-orm";
import { db } from "../src/db";
import {
  coursePlanAssignments,
  coursePlans,
  homework,
  homeworkBooks,
} from "../src/db/schema";
import {
  getCoursePlanWeek,
  publishCoursePlanDay,
  saveCoursePlanDay,
} from "../src/services/coursePlanService";
import {
  getActiveTerm,
  isActiveTermSchoolDay,
  nextActiveTermSchoolDay,
} from "../src/services/termService";
import {
  formatDateInput,
  parseDateInput,
} from "../src/lib/dates";
import { GET as getCoursePlansRoute } from "../src/app/api/course-plans/route";

config({ path: ".env.local" });

const enabled = process.env.RUN_COURSE_PLAN_INTEGRATION === "1";

function mondayOf(dateString: string) {
  const date = parseDateInput(dateString);
  const day = date.getDay();
  date.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
  return formatDateInput(date);
}

test(
  "course plans save, publish, update, reject duplicates, and honor holidays",
  { skip: !enabled },
  async () => {
    const activeTerm = await getActiveTerm();
    assert.ok(activeTerm, "需要先設定啟用中的學期");

    const runId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    let [book] = await db
      .select()
      .from(homeworkBooks)
      .where(eq(homeworkBooks.isActive, true))
      .limit(1);
    let temporaryBookId: string | null = null;
    if (!book) {
      [book] = await db
        .insert(homeworkBooks)
        .values({
          name: `__course_plan_test_book_${runId}`,
          isActive: true,
        })
        .returning();
      temporaryBookId = book.id;
    }

    const pagePrefix = `__course_plan_test_${runId}`;
    const duplicateLabel = `${pagePrefix}_duplicate`;
    let planId: string | null = null;

    try {
      let schoolDate: string | null = null;
      let holidayDate: string | null = null;
      const cursor = parseDateInput(activeTerm.startsOn);
      const end = parseDateInput(activeTerm.endsOn);
      while (cursor <= end && (!schoolDate || !holidayDate)) {
        const candidate = formatDateInput(cursor);
        const isSchoolDay = await isActiveTermSchoolDay(candidate);
        if (isSchoolDay && !schoolDate && parseDateInput(candidate).getDay() !== 4) {
          const [existing] = await db
            .select({ id: coursePlans.id })
            .from(coursePlans)
            .where(
              and(
                eq(coursePlans.termId, activeTerm.id),
                eq(coursePlans.date, candidate),
                eq(coursePlans.subject, "math"),
              ),
            )
            .limit(1);
          if (!existing) schoolDate = candidate;
        }
        if (!isSchoolDay && !holidayDate) holidayDate = candidate;
        cursor.setDate(cursor.getDate() + 1);
      }

      assert.ok(schoolDate, "目前學期需要一個尚無數學計劃的上課日");
      assert.ok(holidayDate, "目前學期需要至少一個假日");

      const saved = await saveCoursePlanDay({
        date: schoolDate,
        subject: "math",
        unit: `整合測試 ${runId}`,
        plannedContent: "驗證課程計劃儲存",
        assignments: [
          {
            bookId: book.id,
            pageLabel: `${pagePrefix}_first`,
            note: "初版",
          },
        ],
      });
      assert.equal(saved.unit, `整合測試 ${runId}`);
      assert.equal(saved.assignments.length, 1);
      assert.equal(saved.assignments[0].publishStatus, "unpublished");

      const [createdPlan] = await db
        .select({ id: coursePlans.id })
        .from(coursePlans)
        .where(
          and(
            eq(coursePlans.termId, activeTerm.id),
            eq(coursePlans.date, schoolDate),
            eq(coursePlans.subject, "math"),
          ),
        )
        .limit(1);
      assert.ok(createdPlan);
      planId = createdPlan.id;

      const weekStart = mondayOf(schoolDate);
      const week = await getCoursePlanWeek({
        weekStart,
        subject: "math",
      });
      assert.equal(
        week.days.find((day) => day.date === schoolDate)?.unit,
        `整合測試 ${runId}`,
      );
      const thursday = week.days.find(
        (day) => parseDateInput(day.date).getDay() === 4,
      );
      assert.ok(thursday);
      assert.equal(thursday.hasClass, false);
      assert.equal(thursday.editable, false);
      if (!thursday.isHoliday && thursday.inTerm) {
        await assert.rejects(
          saveCoursePlanDay({
            date: thursday.date,
            subject: "math",
            unit: "不可建立",
            plannedContent: "",
            assignments: [],
          }),
          /本日無數學課/,
        );
      }

      const routeResponse = await getCoursePlansRoute(
        new Request(
          `http://localhost/api/course-plans?weekStart=${weekStart}&subject=math`,
        ),
      );
      assert.equal(routeResponse.status, 200);

      const published = await publishCoursePlanDay({
        date: schoolDate,
        subject: "math",
      });
      assert.equal(published.day.assignments[0].publishStatus, "published");
      const publishedId =
        published.day.assignments[0].publishedHomeworkId;
      assert.ok(publishedId);

      const dueDate = await nextActiveTermSchoolDay(schoolDate);
      const [official] = await db
        .select()
        .from(homework)
        .where(eq(homework.id, publishedId))
        .limit(1);
      assert.equal(official.date, dueDate);
      assert.equal(official.contactBookDate, schoolDate);
      assert.equal(official.pageLabel, `${pagePrefix}_first（初版）`);

      const changed = await saveCoursePlanDay({
        date: schoolDate,
        subject: "math",
        unit: `整合測試 ${runId}`,
        plannedContent: "驗證發布後更新",
        assignments: [
          {
            id: saved.assignments[0].id,
            bookId: book.id,
            pageLabel: `${pagePrefix}_first`,
            note: "更新版",
          },
        ],
      });
      assert.equal(changed.assignments[0].publishStatus, "outdated");

      const updated = await publishCoursePlanDay({
        date: schoolDate,
        subject: "math",
      });
      assert.equal(updated.day.assignments[0].publishStatus, "published");
      const [updatedOfficial] = await db
        .select()
        .from(homework)
        .where(eq(homework.id, publishedId))
        .limit(1);
      assert.equal(updatedOfficial.pageLabel, `${pagePrefix}_first（更新版）`);

      const [duplicate] = await db
        .insert(homework)
        .values({
          bookId: book.id,
          pageLabel: duplicateLabel,
          date: dueDate,
          contactBookDate: schoolDate,
        })
        .returning();

      const withDuplicate = await saveCoursePlanDay({
        date: schoolDate,
        subject: "math",
        unit: `整合測試 ${runId}`,
        plannedContent: "驗證重複防護",
        assignments: [
          {
            id: updated.day.assignments[0].id,
            bookId: book.id,
            pageLabel: `${pagePrefix}_first`,
            note: "更新版",
          },
          {
            bookId: book.id,
            pageLabel: duplicateLabel,
          },
        ],
      });
      assert.equal(withDuplicate.assignments.length, 2);
      await assert.rejects(
        publishCoursePlanDay({ date: schoolDate, subject: "math" }),
        /已有相同簿本與頁數/,
      );

      const [duplicateAfterFailure] = await db
        .select()
        .from(homework)
        .where(eq(homework.id, duplicate.id))
        .limit(1);
      assert.ok(duplicateAfterFailure);
      const unpublishedAfterFailure = await db
        .select()
        .from(coursePlanAssignments)
        .where(
          and(
            eq(coursePlanAssignments.coursePlanId, planId),
            eq(coursePlanAssignments.pageLabel, duplicateLabel),
          ),
        )
        .limit(1);
      assert.equal(
        unpublishedAfterFailure[0]?.publishedHomeworkId,
        null,
      );

      await assert.rejects(
        saveCoursePlanDay({
          date: holidayDate,
          subject: "math",
          unit: "不可建立",
          plannedContent: "",
          assignments: [],
        }),
        /放假日不可編輯/,
      );
    } finally {
      if (planId) {
        await db.delete(coursePlans).where(eq(coursePlans.id, planId));
      }
      await db
        .delete(homework)
        .where(
          and(
            eq(homework.bookId, book.id),
            like(homework.pageLabel, `${pagePrefix}%`),
          ),
        );
      if (temporaryBookId) {
        await db
          .delete(homeworkBooks)
          .where(eq(homeworkBooks.id, temporaryBookId));
      }
    }
  },
);

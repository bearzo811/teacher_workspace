import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "@/db";
import {
  coursePlanAssignments,
  coursePlans,
  homework,
  homeworkBooks,
  terms,
} from "@/db/schema";
import {
  formatDateInput,
  parseDateInput,
} from "@/lib/dates";
import {
  listCalendarEventsInRange,
  listHolidayOverridesInRange,
} from "@/services/calendarService";
import { getClassSettings } from "@/services/classSettingsService";
import {
  getActiveTerm,
  isActiveTermSchoolDay,
  nextActiveTermSchoolDay,
} from "@/services/termService";
import {
  noClassLockReason,
  subjectHasClassOnDate,
  type CoursePlanSubject,
} from "@/lib/coursePlanSchedule";
import { schoolWeekForDate } from "@/lib/schoolWeek";
import { resolveIsHoliday } from "@/types/calendar";
import { assignmentKey } from "@/types/homework";

export type { CoursePlanSubject };

export type CoursePlanAssignmentInput = {
  id?: string;
  bookId: string;
  pageLabel: string;
  note?: string;
};

export type CoursePlanAssignmentView = {
  id: string;
  bookId: string;
  bookName: string;
  pageLabel: string;
  note: string;
  publishedHomeworkId: string | null;
  publishStatus: "unpublished" | "published" | "outdated";
};

export type CoursePlanDayView = {
  date: string;
  isHoliday: boolean;
  hasClass: boolean;
  calendarTitles: string[];
  inTerm: boolean;
  editable: boolean;
  termName: string | null;
  unit: string;
  plannedContent: string;
  assignments: CoursePlanAssignmentView[];
};

export type CoursePlanWeekView = {
  weekStart: string;
  weekEnd: string;
  weekNumber: number | null;
  weekLabel: string | null;
  subject: CoursePlanSubject;
  activeTermName: string | null;
  days: CoursePlanDayView[];
};

function normalizeSubject(value: string): CoursePlanSubject {
  if (value !== "chinese" && value !== "math") {
    throw new Error("科目只能是國語或數學");
  }
  return value;
}

function normalizeWeekStart(value: string) {
  const parsed = parseDateInput(value);
  if (parsed.getDay() !== 1) throw new Error("weekStart 必須是星期一");
  return value;
}

function weekDates(weekStart: string) {
  const monday = parseDateInput(normalizeWeekStart(weekStart));
  return Array.from({ length: 5 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return formatDateInput(date);
  });
}

function normalizeAssignments(input: CoursePlanAssignmentInput[]) {
  const seen = new Set<string>();
  return input.map((item) => {
    const id = item.id?.trim() || undefined;
    const bookId = item.bookId.trim();
    const pageLabel = item.pageLabel.trim();
    const note = item.note?.trim() ?? "";
    if (!bookId || !pageLabel) {
      throw new Error("每筆作業都要選擇簿本並填寫頁數");
    }
    const key = assignmentKey(bookId, pageLabel);
    if (seen.has(key)) throw new Error("同一簿本與頁數不可重複");
    seen.add(key);
    return { id, bookId, pageLabel, note };
  });
}

function publishedPageLabel(item: { pageLabel: string; note: string }) {
  return item.note ? `${item.pageLabel}（${item.note}）` : item.pageLabel;
}

export async function getCoursePlanWeek(input: {
  weekStart: string;
  subject: string;
}): Promise<CoursePlanWeekView> {
  const subject = normalizeSubject(input.subject);
  const dates = weekDates(input.weekStart);
  const weekEnd = dates[4];
  const [termRows, overrides, events, planRows, activeTerm, settings] =
    await Promise.all([
      db.select().from(terms).orderBy(asc(terms.startsOn)),
      listHolidayOverridesInRange(dates[0], weekEnd),
      listCalendarEventsInRange(dates[0], weekEnd),
      db
        .select()
        .from(coursePlans)
        .where(
          and(
            eq(coursePlans.subject, subject),
            gte(coursePlans.date, dates[0]),
            lte(coursePlans.date, weekEnd),
          ),
        ),
      getActiveTerm(),
      getClassSettings(),
    ]);

  const planIds = planRows.map((row) => row.id);
  const assignmentRows =
    planIds.length === 0
      ? []
      : await db
          .select({
            assignment: coursePlanAssignments,
            bookName: homeworkBooks.name,
            publishedBookId: homework.bookId,
            publishedPageLabel: homework.pageLabel,
            publishedContactBookDate: homework.contactBookDate,
          })
          .from(coursePlanAssignments)
          .innerJoin(
            homeworkBooks,
            eq(coursePlanAssignments.bookId, homeworkBooks.id),
          )
          .leftJoin(
            homework,
            eq(coursePlanAssignments.publishedHomeworkId, homework.id),
          )
          .where(inArray(coursePlanAssignments.coursePlanId, planIds))
          .orderBy(
            asc(coursePlanAssignments.sortOrder),
            asc(coursePlanAssignments.createdAt),
          );

  const plansByDate = new Map(planRows.map((row) => [row.date, row]));
  const assignmentsByPlan = new Map<string, CoursePlanAssignmentView[]>();
  for (const row of assignmentRows) {
    const item = row.assignment;
    const currentPublishedLabel = publishedPageLabel(item);
    const hasPublishedRecord =
      Boolean(item.publishedHomeworkId) && row.publishedBookId !== null;
    const isOutdated =
      hasPublishedRecord &&
      (row.publishedBookId !== item.bookId ||
        row.publishedPageLabel !== currentPublishedLabel ||
        row.publishedContactBookDate !==
          planRows.find((plan) => plan.id === item.coursePlanId)?.date);
    const list = assignmentsByPlan.get(item.coursePlanId) ?? [];
    list.push({
      id: item.id,
      bookId: item.bookId,
      bookName: row.bookName,
      pageLabel: item.pageLabel,
      note: item.note,
      publishedHomeworkId: hasPublishedRecord
        ? item.publishedHomeworkId
        : null,
      publishStatus: !hasPublishedRecord
        ? "unpublished"
        : isOutdated
          ? "outdated"
          : "published",
    });
    assignmentsByPlan.set(item.coursePlanId, list);
  }

  const days = dates.map((date) => {
    const term = termRows.find(
      (candidate) => date >= candidate.startsOn && date <= candidate.endsOn,
    );
    const isHoliday = resolveIsHoliday(date, overrides);
    const hasClass = subjectHasClassOnDate(subject, date);
    const plan = plansByDate.get(date);
    return {
      date,
      isHoliday,
      hasClass,
      calendarTitles: events
        .filter((event) => event.date === date)
        .map((event) => event.title),
      inTerm: Boolean(term),
      editable: Boolean(term?.isActive) && !isHoliday && hasClass,
      termName: term?.name ?? null,
      unit: plan?.unit ?? "",
      plannedContent: plan?.plannedContent ?? "",
      assignments: plan ? assignmentsByPlan.get(plan.id) ?? [] : [],
    };
  });

  const schoolWeek = schoolWeekForDate({
    weekOneStartDate: settings.weekOneStartDate,
    termEndDate: settings.termEndDate,
    date: dates[0],
  });

  return {
    weekStart: dates[0],
    weekEnd,
    weekNumber: schoolWeek.week,
    weekLabel: schoolWeek.label,
    subject,
    activeTermName: activeTerm?.name ?? null,
    days,
  };
}

export async function saveCoursePlanDay(input: {
  date: string;
  subject: string;
  unit: string;
  plannedContent: string;
  assignments: CoursePlanAssignmentInput[];
}) {
  parseDateInput(input.date);
  const subject = normalizeSubject(input.subject);
  const activeTerm = await getActiveTerm();
  if (
    !activeTerm ||
    input.date < activeTerm.startsOn ||
    input.date > activeTerm.endsOn
  ) {
    throw new Error("只能編輯目前啟用學期的課程計劃");
  }
  if (!(await isActiveTermSchoolDay(input.date))) {
    throw new Error("放假日不可編輯課程計劃");
  }
  if (!subjectHasClassOnDate(subject, input.date)) {
    throw new Error(`${noClassLockReason(subject)}，不可編輯課程計劃`);
  }

  const assignments = normalizeAssignments(input.assignments);
  const bookIds = [...new Set(assignments.map((item) => item.bookId))];
  if (bookIds.length > 0) {
    const validBooks = await db
      .select({ id: homeworkBooks.id })
      .from(homeworkBooks)
      .where(inArray(homeworkBooks.id, bookIds));
    if (validBooks.length !== bookIds.length) throw new Error("找不到部分簿本");
  }

  await db.transaction(async (tx) => {
    const [existingPlan] = await tx
      .select()
      .from(coursePlans)
      .where(
        and(
          eq(coursePlans.termId, activeTerm.id),
          eq(coursePlans.date, input.date),
          eq(coursePlans.subject, subject),
        ),
      )
      .limit(1);

    const [plan] = existingPlan
      ? await tx
          .update(coursePlans)
          .set({
            unit: input.unit.trim(),
            plannedContent: input.plannedContent.trim(),
          })
          .where(eq(coursePlans.id, existingPlan.id))
          .returning()
      : await tx
          .insert(coursePlans)
          .values({
            termId: activeTerm.id,
            date: input.date,
            subject,
            unit: input.unit.trim(),
            plannedContent: input.plannedContent.trim(),
          })
          .returning();

    const existingAssignments = await tx
      .select()
      .from(coursePlanAssignments)
      .where(eq(coursePlanAssignments.coursePlanId, plan.id));
    const existingById = new Map(
      existingAssignments.map((item) => [item.id, item]),
    );
    const desiredIds = new Set(assignments.flatMap((item) => item.id ?? []));
    const removedIds = existingAssignments
      .filter((item) => !desiredIds.has(item.id))
      .map((item) => item.id);
    if (removedIds.length > 0) {
      await tx
        .delete(coursePlanAssignments)
        .where(inArray(coursePlanAssignments.id, removedIds));
    }

    for (const [sortOrder, item] of assignments.entries()) {
      if (item.id) {
        const existing = existingById.get(item.id);
        if (!existing || existing.coursePlanId !== plan.id) {
          throw new Error("找不到要更新的課程計劃作業");
        }
        await tx
          .update(coursePlanAssignments)
          .set({
            bookId: item.bookId,
            pageLabel: item.pageLabel,
            note: item.note,
            sortOrder,
          })
          .where(eq(coursePlanAssignments.id, item.id));
      } else {
        await tx.insert(coursePlanAssignments).values({
          coursePlanId: plan.id,
          bookId: item.bookId,
          pageLabel: item.pageLabel,
          note: item.note,
          sortOrder,
        });
      }
    }
  });

  return getCoursePlanDay(input.date, subject);
}

async function getCoursePlanDay(
  date: string,
  subject: CoursePlanSubject,
): Promise<CoursePlanDayView> {
  const monday = parseDateInput(date);
  const day = monday.getDay();
  monday.setDate(monday.getDate() - (day === 0 ? 6 : day - 1));
  const week = await getCoursePlanWeek({
    weekStart: formatDateInput(monday),
    subject,
  });
  const result = week.days.find((item) => item.date === date);
  if (!result) throw new Error("找不到課程計劃日期");
  return result;
}

export async function publishCoursePlanDay(input: {
  date: string;
  subject: string;
}) {
  parseDateInput(input.date);
  const subject = normalizeSubject(input.subject);
  const activeTerm = await getActiveTerm();
  if (!activeTerm || !(await isActiveTermSchoolDay(input.date))) {
    throw new Error("只能發布目前學期上課日的課程計劃");
  }
  if (!subjectHasClassOnDate(subject, input.date)) {
    throw new Error(`${noClassLockReason(subject)}，不可發布課程計劃`);
  }
  const dueDate = await nextActiveTermSchoolDay(input.date);

  await db.transaction(async (tx) => {
    const [plan] = await tx
      .select()
      .from(coursePlans)
      .where(
        and(
          eq(coursePlans.termId, activeTerm.id),
          eq(coursePlans.date, input.date),
          eq(coursePlans.subject, subject),
        ),
      )
      .limit(1);
    if (!plan) throw new Error("這一天尚未建立課程計劃");

    const items = await tx
      .select()
      .from(coursePlanAssignments)
      .where(eq(coursePlanAssignments.coursePlanId, plan.id))
      .orderBy(asc(coursePlanAssignments.sortOrder));
    if (items.length === 0) throw new Error("這一天沒有可發布的作業");

    for (const item of items) {
      const pageLabel = publishedPageLabel(item);
      const existingSame = await tx
        .select({ id: homework.id })
        .from(homework)
        .where(
          and(
            eq(homework.contactBookDate, input.date),
            eq(homework.bookId, item.bookId),
            eq(homework.pageLabel, pageLabel),
          ),
        )
        .limit(1);

      if (
        existingSame[0] &&
        existingSame[0].id !== item.publishedHomeworkId
      ) {
        throw new Error("聯絡簿已有相同簿本與頁數，請先調整重複項目");
      }

      if (item.publishedHomeworkId) {
        const updated = await tx
          .update(homework)
          .set({
            bookId: item.bookId,
            pageLabel,
            date: dueDate,
            contactBookDate: input.date,
          })
          .where(eq(homework.id, item.publishedHomeworkId))
          .returning({ id: homework.id });
        if (updated.length > 0) continue;
      }

      const [created] = await tx
        .insert(homework)
        .values({
          bookId: item.bookId,
          pageLabel,
          date: dueDate,
          contactBookDate: input.date,
        })
        .returning({ id: homework.id });
      await tx
        .update(coursePlanAssignments)
        .set({ publishedHomeworkId: created.id })
        .where(eq(coursePlanAssignments.id, item.id));
    }
  });

  return {
    day: await getCoursePlanDay(input.date, subject),
    dueDate,
  };
}

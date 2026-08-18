import { and, asc, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import {
  classSettings,
  students,
  termRosterEntries,
  terms,
  type Term,
} from "@/db/schema";
import { nextSchoolDay, parseDateInput } from "@/lib/dates";
import { resolveIsHoliday } from "@/types/calendar";
import { getHolidayOverride } from "@/services/calendarService";
import { getClassSettings } from "@/services/classSettingsService";

export type TermView = Pick<
  Term,
  "id" | "name" | "schoolYear" | "startsOn" | "endsOn" | "isActive"
>;

function toView(term: Term): TermView {
  return {
    id: term.id,
    name: term.name,
    schoolYear: term.schoolYear,
    startsOn: term.startsOn,
    endsOn: term.endsOn,
    isActive: term.isActive,
  };
}

function normalizeInput(input: {
  name: string;
  schoolYear: string;
  startsOn: string;
  endsOn: string;
}) {
  const name = input.name.trim();
  const schoolYear = input.schoolYear.trim();
  if (!name) throw new Error("請填寫學期名稱");
  if (!schoolYear) throw new Error("請填寫學年度");
  parseDateInput(input.startsOn);
  parseDateInput(input.endsOn);
  if (input.endsOn < input.startsOn) {
    throw new Error("學期結束日不可早於開始日");
  }
  return { name, schoolYear, startsOn: input.startsOn, endsOn: input.endsOn };
}

export async function listTerms(): Promise<TermView[]> {
  const rows = await db
    .select()
    .from(terms)
    .orderBy(asc(terms.startsOn), asc(terms.createdAt));
  return rows.map(toView);
}

export async function createTerm(input: {
  name: string;
  schoolYear: string;
  startsOn: string;
  endsOn: string;
  activate?: boolean;
}): Promise<TermView> {
  const normalized = normalizeInput(input);
  const existing = await listTerms();
  const shouldActivate = input.activate === true || existing.length === 0;
  const activeTerm = await getActiveTerm();
  const created = await db.transaction(async (tx) => {
    const [term] = await tx
      .insert(terms)
      .values({ ...normalized, isActive: false })
      .returning();
    const sourceEntries = activeTerm
      ? await tx
          .select({
            studentId: termRosterEntries.studentId,
            seatNumber: termRosterEntries.seatNumber,
            isActive: termRosterEntries.isActive,
          })
          .from(termRosterEntries)
          .where(eq(termRosterEntries.termId, activeTerm.id))
      : [];
    const entries = sourceEntries.length > 0
      ? sourceEntries
      : await tx
          .select({
            studentId: students.id,
            seatNumber: students.seatNumber,
            isActive: students.isActive,
          })
          .from(students)
          .where(eq(students.isActive, true));
    if (entries.length > 0) {
      await tx.insert(termRosterEntries).values(
        entries.map((entry) => ({ ...entry, termId: term.id })),
      );
    }
    return term;
  });
  return shouldActivate ? activateTerm(created.id) : toView(created);
}

export async function activateTerm(id: string): Promise<TermView> {
  const [target] = await db.select().from(terms).where(eq(terms.id, id)).limit(1);
  if (!target) throw new Error("找不到此學期");

  const settings = await getClassSettings();
  await db.transaction(async (tx) => {
    await tx.update(terms).set({ isActive: false }).where(ne(terms.id, id));
    await tx.update(terms).set({ isActive: true }).where(eq(terms.id, id));
    await tx
      .update(classSettings)
      .set({
        activeTermId: id,
        weekOneStartDate: target.startsOn,
        termEndDate: target.endsOn,
      })
      .where(eq(classSettings.id, settings.id));
  });
  return { ...toView(target), isActive: true };
}

export async function getActiveTerm(): Promise<TermView | null> {
  const settings = await getClassSettings();
  if (settings.activeTermId) {
    const [term] = await db
      .select()
      .from(terms)
      .where(and(eq(terms.id, settings.activeTermId), eq(terms.isActive, true)))
      .limit(1);
    if (term) {
      if (
        settings.weekOneStartDate !== term.startsOn ||
        settings.termEndDate !== term.endsOn
      ) {
        await db
          .update(classSettings)
          .set({ weekOneStartDate: term.startsOn, termEndDate: term.endsOn })
          .where(eq(classSettings.id, settings.id));
      }
      return toView(term);
    }
  }
  const [fallback] = await db
    .select()
    .from(terms)
    .where(eq(terms.isActive, true))
    .limit(1);
  if (!fallback) return null;
  await db
    .update(classSettings)
    .set({
      activeTermId: fallback.id,
      weekOneStartDate: fallback.startsOn,
      termEndDate: fallback.endsOn,
    })
    .where(eq(classSettings.id, settings.id));
  return toView(fallback);
}

/** 只判斷目前啟用學期內的上課日：週一至週五，並套用放假／補課覆寫。 */
export async function isActiveTermSchoolDay(date: string): Promise<boolean> {
  parseDateInput(date);
  const activeTerm = await getActiveTerm();
  if (!activeTerm || date < activeTerm.startsOn || date > activeTerm.endsOn) {
    return false;
  }
  const override = await getHolidayOverride(date);
  return !resolveIsHoliday(date, override === null ? {} : { [date]: override });
}

/** 依啟用學期的行事曆找下一個上課日（包含補課與放假覆寫）。 */
export async function nextActiveTermSchoolDay(date: string): Promise<string> {
  parseDateInput(date);
  if (!(await getActiveTerm())) return nextSchoolDay(date);
  const cursor = new Date(`${date}T12:00:00+08:00`);
  for (let offset = 1; offset <= 370; offset += 1) {
    cursor.setDate(cursor.getDate() + 1);
    const candidate = cursor.toLocaleDateString("en-CA", {
      timeZone: "Asia/Taipei",
    });
    if (await isActiveTermSchoolDay(candidate)) return candidate;
  }
  throw new Error("目前學期找不到下一個上課日");
}

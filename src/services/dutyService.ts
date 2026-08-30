import { and, asc, eq, gte, lte, ne } from "drizzle-orm";
import { db } from "@/db";
import { dailyAbsences, dutyMakeups, dutyOverrides, dutySubstitutions, students } from "@/db/schema";
import {
  assignDutySlots,
  DUTY_EXPECTED_STUDENTS,
  DUTY_SLOT_KEYS,
  DUTY_SLOT_LABEL,
  eachDateInclusive,
  isDutySlotKey,
  schoolDayIndex,
  type DutySlotKey,
  type DutyStudent,
} from "@/lib/dutyRoster";
import { getClassSettings, touchDisplayVersion } from "@/services/classSettingsService";
import { setGamificationEffect } from "@/services/gamificationService";
import { listHolidayOverridesInRange } from "@/services/calendarService";
import { getActiveTerm } from "@/services/termService";
import { resolveIsHoliday } from "@/types/calendar";

export type DutySlotView = {
  slotKey: DutySlotKey;
  label: string;
  studentId: string | null;
  name: string | null;
  seatNumber: number | null;
  overridden: boolean;
};

export type DutyDayView = {
  date: string;
  isHoliday: boolean;
  schoolDayIndex: number | null;
  slots: DutySlotView[];
  /** 全天擦黑板主責 */
  leaders: { studentId: string; name: string; seatNumber: number }[];
};

export type DutyRangeView = {
  from: string;
  to: string;
  termStart: string;
  termName: string | null;
  studentCount: number;
  expectedStudentCount: number;
  warning: string | null;
  days: DutyDayView[];
};

export type DutySubstitutionView = {
  id: string;
  date: string;
  slotKey: DutySlotKey;
  label: string;
  absentStudentId: string;
  absentStudentName: string;
  substituteStudentId: string | null;
  substituteStudentName: string | null;
  status: "open" | "claimed" | "assigned" | "confirmed" | "cancelled";
  isVolunteer: boolean;
};

export type DutyMakeupView = {
  id: string;
  studentId: string;
  studentName: string;
  sourceDate: string;
  sourceSlotKey: DutySlotKey;
  assignedDate: string | null;
  assignedSlotKey: DutySlotKey | null;
  status: "pending" | "completed" | "cancelled";
};

async function listActiveDutyStudents(): Promise<DutyStudent[]> {
  const rows = await db
    .select({
      studentId: students.id,
      name: students.name,
      seatNumber: students.seatNumber,
    })
    .from(students)
    .where(eq(students.isActive, true))
    .orderBy(asc(students.seatNumber));
  return rows;
}

async function loadOverrides(
  from: string,
  to: string,
): Promise<Map<string, string>> {
  const rows = await db
    .select()
    .from(dutyOverrides)
    .where(and(gte(dutyOverrides.date, from), lte(dutyOverrides.date, to)));
  const map = new Map<string, string>();
  for (const row of rows) {
    map.set(`${row.date}:${row.slotKey}`, row.studentId);
  }
  return map;
}

function buildDayView(input: {
  date: string;
  termStart: string;
  holidayOverrides: Record<string, boolean>;
  roster: DutyStudent[];
  studentById: Map<string, DutyStudent>;
  overrides: Map<string, string>;
}): DutyDayView {
  const isHoliday = resolveIsHoliday(input.date, input.holidayOverrides);
  const dayIndex = schoolDayIndex({
    termStart: input.termStart,
    date: input.date,
    holidayOverrides: input.holidayOverrides,
  });

  if (isHoliday || dayIndex === null) {
    return {
      date: input.date,
      isHoliday: true,
      schoolDayIndex: null,
      slots: DUTY_SLOT_KEYS.map((slotKey) => ({
        slotKey,
        label: DUTY_SLOT_LABEL[slotKey],
        studentId: null,
        name: null,
        seatNumber: null,
        overridden: false,
      })),
      leaders: [],
    };
  }

  const auto = assignDutySlots({
    students: input.roster,
    dayIndex,
  });

  const slots: DutySlotView[] = DUTY_SLOT_KEYS.map((slotKey) => {
    const overrideId = input.overrides.get(`${input.date}:${slotKey}`);
    if (overrideId) {
      const student = input.studentById.get(overrideId);
      return {
        slotKey,
        label: DUTY_SLOT_LABEL[slotKey],
        studentId: student?.studentId ?? overrideId,
        name: student?.name ?? "（未知）",
        seatNumber: student?.seatNumber ?? null,
        overridden: true,
      };
    }
    const student = auto[slotKey];
    return {
      slotKey,
      label: DUTY_SLOT_LABEL[slotKey],
      studentId: student?.studentId ?? null,
      name: student?.name ?? null,
      seatNumber: student?.seatNumber ?? null,
      overridden: false,
    };
  });

  const leaders = slots
    .filter((slot) => slot.slotKey === "blackboard" && slot.studentId && slot.name)
    .map((slot) => ({
      studentId: slot.studentId!,
      name: slot.name!,
      seatNumber: slot.seatNumber ?? 0,
    }));

  return {
    date: input.date,
    isHoliday: false,
    schoolDayIndex: dayIndex,
    slots,
    leaders,
  };
}

export async function getDutyRange(
  from: string,
  to: string,
): Promise<DutyRangeView> {
  const settings = await getClassSettings();
  const activeTerm = await getActiveTerm();
  // 學期設定是正式來源；保留舊設定作為尚未建立學期時的相容後備。
  const termStart = activeTerm?.startsOn ?? settings.weekOneStartDate.trim();
  const roster = await listActiveDutyStudents();
  const holidayFrom =
    termStart && termStart < from ? termStart : from;
  const holidayOverrides = await listHolidayOverridesInRange(
    holidayFrom,
    to,
  );
  const overrides = await loadOverrides(from, to);
  const studentById = new Map(roster.map((s) => [s.studentId, s]));

  const warning = !termStart
    ? "請先在行事曆建立並啟用學期，值日表才會開始輪排。"
    : roster.length !== DUTY_EXPECTED_STUDENTS
      ? `目前在籍 ${roster.length} 人（建議 ${DUTY_EXPECTED_STUDENTS} 人）。人數不等於 9 時仍會輪，但每人每職的週期會變。`
      : null;

  const days = eachDateInclusive(from, to).map((date) =>
    buildDayView({
      date,
      termStart,
      holidayOverrides,
      roster,
      studentById,
      overrides,
    }),
  );

  return {
    from,
    to,
    termStart,
    termName: activeTerm?.name ?? null,
    studentCount: roster.length,
    expectedStudentCount: DUTY_EXPECTED_STUDENTS,
    warning,
    days,
  };
}

/**
 * 完整學期值日表：依啟用學期與行事曆的放假／補課設定，只回傳實際上課日。
 */
export async function getActiveTermDutySchedule(): Promise<DutyRangeView> {
  const activeTerm = await getActiveTerm();
  if (!activeTerm) {
    return {
      from: "",
      to: "",
      termStart: "",
      termName: null,
      studentCount: 0,
      expectedStudentCount: DUTY_EXPECTED_STUDENTS,
      warning: "請先到行事曆建立並啟用學期，才能排出整個學期的值日表。",
      days: [],
    };
  }

  const range = await getDutyRange(activeTerm.startsOn, activeTerm.endsOn);
  return {
    ...range,
    days: range.days.filter((day) => !day.isHoliday),
  };
}

export async function getDutyDay(date: string): Promise<DutyDayView> {
  const range = await getDutyRange(date, date);
  return (
    range.days[0] ?? {
      date,
      isHoliday: true,
      schoolDayIndex: null,
      slots: [],
      leaders: [],
    }
  );
}

async function substitutionViews(date: string): Promise<DutySubstitutionView[]> {
  const [rows, roster] = await Promise.all([
    db.select().from(dutySubstitutions).where(eq(dutySubstitutions.date, date)),
    listActiveDutyStudents(),
  ]);
  const names = new Map(roster.map((student) => [student.studentId, student.name]));
  return rows
    .filter((row) => isDutySlotKey(row.slotKey))
    .map((row) => ({
      id: row.id,
      date: String(row.date),
      slotKey: row.slotKey as DutySlotKey,
      label: DUTY_SLOT_LABEL[row.slotKey as DutySlotKey],
      absentStudentId: row.absentStudentId,
      absentStudentName: names.get(row.absentStudentId) ?? "（未知）",
      substituteStudentId: row.substituteStudentId,
      substituteStudentName: row.substituteStudentId ? names.get(row.substituteStudentId) ?? "（未知）" : null,
      status: row.status as DutySubstitutionView["status"],
      isVolunteer: row.isVolunteer,
    }))
    .sort((a, b) => DUTY_SLOT_KEYS.indexOf(a.slotKey) - DUTY_SLOT_KEYS.indexOf(b.slotKey));
}

export async function getDutySubstitutionDay(date: string) {
  return substitutionViews(date);
}

/** 缺席異動後建立／取消當日代班與補值日待辦；不影響原輪值表。 */
export async function syncDutySubstitutionsForDate(date: string) {
  const [day, absentRows] = await Promise.all([
    getDutyDay(date),
    db.select({ studentId: dailyAbsences.studentId }).from(dailyAbsences).where(eq(dailyAbsences.taskDate, date)),
  ]);
  if (day.isHoliday) return [];
  const absentIds = new Set(absentRows.map((row) => row.studentId));
  const affected = day.slots.filter((slot) => slot.studentId && absentIds.has(slot.studentId));
  for (const slot of affected) {
    await db.insert(dutySubstitutions).values({
      date,
      slotKey: slot.slotKey,
      absentStudentId: slot.studentId!,
    }).onConflictDoNothing();
    await db.insert(dutyMakeups).values({
      studentId: slot.studentId!,
      sourceDate: date,
      sourceSlotKey: slot.slotKey,
    }).onConflictDoNothing();
  }
  const current = await db.select().from(dutySubstitutions).where(eq(dutySubstitutions.date, date));
  for (const row of current) {
    if (!absentIds.has(row.absentStudentId) && row.status !== "confirmed") {
      await db.update(dutySubstitutions).set({ status: "cancelled" }).where(eq(dutySubstitutions.id, row.id));
    }
  }
  await touchDisplayVersion();
  return substitutionViews(date);
}

async function assertEligibleSubstitute(date: string, studentId: string, substitutionId: string) {
  const [student, absent, existing] = await Promise.all([
    db.select({ id: students.id }).from(students).where(and(eq(students.id, studentId), eq(students.isActive, true))).limit(1),
    db.select({ studentId: dailyAbsences.studentId }).from(dailyAbsences).where(and(eq(dailyAbsences.taskDate, date), eq(dailyAbsences.studentId, studentId))).limit(1),
    db.select({ id: dutySubstitutions.id }).from(dutySubstitutions).where(and(eq(dutySubstitutions.date, date), eq(dutySubstitutions.substituteStudentId, studentId), ne(dutySubstitutions.id, substitutionId), eq(dutySubstitutions.status, "claimed"))).limit(1),
  ]);
  if (!student[0]) throw new Error("找不到可代班的學生");
  if (absent[0]) throw new Error("請假學生不能代班");
  if (existing[0]) throw new Error("每位學生一天最多自願代班一項");
}

export async function claimDutySubstitution(input: { id: string; studentId: string }) {
  const [row] = await db.select().from(dutySubstitutions).where(eq(dutySubstitutions.id, input.id)).limit(1);
  if (!row || row.status !== "open") throw new Error("這項代班已被接下或已取消");
  if (row.absentStudentId === input.studentId) throw new Error("請假學生不能代班自己的工作");
  await assertEligibleSubstitute(String(row.date), input.studentId, row.id);
  const [updated] = await db.update(dutySubstitutions).set({ substituteStudentId: input.studentId, status: "claimed", isVolunteer: true }).where(and(eq(dutySubstitutions.id, row.id), eq(dutySubstitutions.status, "open"))).returning();
  if (!updated) throw new Error("這項代班剛剛已被其他同學接下");
  await touchDisplayVersion();
  return substitutionViews(String(row.date));
}

export async function assignDutySubstitution(input: { id: string; studentId: string }) {
  const [row] = await db.select().from(dutySubstitutions).where(eq(dutySubstitutions.id, input.id)).limit(1);
  if (!row || (row.status !== "open" && row.status !== "claimed")) throw new Error("這項代班目前不能安排");
  await assertEligibleSubstitute(String(row.date), input.studentId, row.id);
  await db.update(dutySubstitutions).set({ substituteStudentId: input.studentId, status: "assigned", isVolunteer: false }).where(eq(dutySubstitutions.id, row.id));
  await touchDisplayVersion();
  return substitutionViews(String(row.date));
}

export async function confirmDutySubstitution(id: string) {
  const [row] = await db.select().from(dutySubstitutions).where(eq(dutySubstitutions.id, id)).limit(1);
  if (!row || !row.substituteStudentId || (row.status !== "claimed" && row.status !== "assigned")) throw new Error("這項代班目前不能確認");
  if (row.isVolunteer) {
    await setGamificationEffect({
      effectKey: `duty-substitution:${row.id}`,
      studentId: row.substituteStudentId,
      currency: "coins",
      sourceType: "duty-substitution",
      sourceId: row.id,
      effectType: "confirmed",
      amount: 3,
      reason: "自願代班完成",
      ruleSnapshot: { coins: 3 },
    });
  }
  await db.update(dutySubstitutions).set({ status: "confirmed", confirmedAt: new Date() }).where(eq(dutySubstitutions.id, row.id));
  await touchDisplayVersion();
  return substitutionViews(String(row.date));
}

export async function cancelDutySubstitution(id: string) {
  const [row] = await db.select().from(dutySubstitutions).where(eq(dutySubstitutions.id, id)).limit(1);
  if (!row || row.status === "confirmed") throw new Error("已確認完成的代班不能取消");
  await db.update(dutySubstitutions).set({ substituteStudentId: null, status: "open", isVolunteer: false }).where(eq(dutySubstitutions.id, id));
  await touchDisplayVersion();
  return substitutionViews(String(row.date));
}

export async function listDutyMakeups() {
  const [rows, roster] = await Promise.all([
    db.select().from(dutyMakeups).where(eq(dutyMakeups.status, "pending")).orderBy(asc(dutyMakeups.sourceDate)),
    listActiveDutyStudents(),
  ]);
  const names = new Map(roster.map((student) => [student.studentId, student.name]));
  return rows.filter((row) => isDutySlotKey(row.sourceSlotKey)).map((row) => ({
    id: row.id, studentId: row.studentId, studentName: names.get(row.studentId) ?? "（未知）", sourceDate: String(row.sourceDate), sourceSlotKey: row.sourceSlotKey as DutySlotKey,
    assignedDate: row.assignedDate ? String(row.assignedDate) : null,
    assignedSlotKey: row.assignedSlotKey && isDutySlotKey(row.assignedSlotKey) ? row.assignedSlotKey as DutySlotKey : null,
    status: row.status as DutyMakeupView["status"],
  }));
}

export async function scheduleDutyMakeup(input: { id: string; assignedDate: string; assignedSlotKey: string }) {
  if (!isDutySlotKey(input.assignedSlotKey)) throw new Error("工作欄位無效");
  await db.update(dutyMakeups).set({ assignedDate: input.assignedDate, assignedSlotKey: input.assignedSlotKey }).where(eq(dutyMakeups.id, input.id));
  return listDutyMakeups();
}

export async function completeDutyMakeup(id: string) {
  await db.update(dutyMakeups).set({ status: "completed", completedAt: new Date() }).where(eq(dutyMakeups.id, id));
  return listDutyMakeups();
}

/** 今日全天擦黑板主責；放假則空陣列 */
export async function getDutyLeaders(date: string) {
  const day = await getDutyDay(date);
  return day.leaders;
}

async function upsertOverride(input: {
  date: string;
  slotKey: DutySlotKey;
  studentId: string;
}) {
  const existing = await db
    .select()
    .from(dutyOverrides)
    .where(
      and(
        eq(dutyOverrides.date, input.date),
        eq(dutyOverrides.slotKey, input.slotKey),
      ),
    )
    .limit(1);

  if (existing[0]) {
    await db
      .update(dutyOverrides)
      .set({ studentId: input.studentId })
      .where(eq(dutyOverrides.id, existing[0].id));
  } else {
    await db.insert(dutyOverrides).values({
      date: input.date,
      slotKey: input.slotKey,
      studentId: input.studentId,
    });
  }
}

/**
 * 交換兩個格子的人。
 * 兩邊都寫成覆寫（即使原本是自動排），之後可「還原」刪除覆寫。
 */
export async function swapDutySlots(input: {
  a: { date: string; slotKey: string };
  b: { date: string; slotKey: string };
}) {
  if (!isDutySlotKey(input.a.slotKey) || !isDutySlotKey(input.b.slotKey)) {
    throw new Error("工作欄位無效");
  }
  if (
    input.a.date === input.b.date &&
    input.a.slotKey === input.b.slotKey
  ) {
    throw new Error("請選兩個不同的格子");
  }

  const [dayA, dayB] =
    input.a.date === input.b.date
      ? await (async () => {
          const day = await getDutyDay(input.a.date);
          return [day, day] as const;
        })()
      : await Promise.all([
          getDutyDay(input.a.date),
          getDutyDay(input.b.date),
        ]);

  if (dayA.isHoliday || dayB.isHoliday) {
    throw new Error("放假日無法排值日／交換");
  }

  const slotA = dayA.slots.find((s) => s.slotKey === input.a.slotKey);
  const slotB = dayB.slots.find((s) => s.slotKey === input.b.slotKey);
  if (!slotA?.studentId || !slotB?.studentId) {
    throw new Error("兩邊都要有人才可交換");
  }

  const studentA = slotA.studentId;
  const studentB = slotB.studentId;

  await upsertOverride({
    date: input.a.date,
    slotKey: input.a.slotKey,
    studentId: studentB,
  });
  await upsertOverride({
    date: input.b.date,
    slotKey: input.b.slotKey,
    studentId: studentA,
  });

  return {
    a: await getDutyDay(input.a.date),
    b: await getDutyDay(input.b.date),
  };
}

export async function clearDutyOverride(input: {
  date: string;
  slotKey: string;
}) {
  if (!isDutySlotKey(input.slotKey)) {
    throw new Error("工作欄位無效");
  }
  await db
    .delete(dutyOverrides)
    .where(
      and(
        eq(dutyOverrides.date, input.date),
        eq(dutyOverrides.slotKey, input.slotKey),
      ),
    );
  return getDutyDay(input.date);
}

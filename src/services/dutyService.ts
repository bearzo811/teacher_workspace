import { and, asc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import { dutyOverrides, students } from "@/db/schema";
import {
  assignDutySlots,
  DUTY_EXPECTED_STUDENTS,
  DUTY_SLOT_KEYS,
  DUTY_SLOT_LABEL,
  eachDateInclusive,
  isDutySlotKey,
  isMealBucketSlot,
  schoolDayIndex,
  type DutySlotKey,
  type DutyStudent,
} from "@/lib/dutyRoster";
import { getClassSettings } from "@/services/classSettingsService";
import { listHolidayOverridesInRange } from "@/services/calendarService";
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
  /** 值日生（抬餐桶兩人） */
  leaders: { studentId: string; name: string; seatNumber: number }[];
};

export type DutyRangeView = {
  from: string;
  to: string;
  termStart: string;
  studentCount: number;
  expectedStudentCount: number;
  warning: string | null;
  days: DutyDayView[];
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
    .filter((slot) => isMealBucketSlot(slot.slotKey) && slot.studentId && slot.name)
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
  const termStart = settings.weekOneStartDate.trim();
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
    ? "請先在設定填「第一週開啟日」，值日表才會開始輪排。"
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
    studentCount: roster.length,
    expectedStudentCount: DUTY_EXPECTED_STUDENTS,
    warning,
    days,
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

/** 今日值日生（抬餐桶兩人）；放假則空陣列 */
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

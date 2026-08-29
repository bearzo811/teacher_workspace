import { daysBetween, formatDateInput, parseDateInput } from "@/lib/dates";
import { resolveIsHoliday } from "@/types/calendar";

/** 每天 9 個主責名額；午餐工作可與掃拖／倒垃圾並行。 */
export const DUTY_SLOT_KEYS = [
  "meal_bucket_1",
  "meal_bucket_2",
  "blackboard",
  "sweep_1a",
  "sweep_1b",
  "sweep_2a",
  "sweep_2b",
  "sweep_3a",
  "sweep_3b",
] as const;

export type DutySlotKey = (typeof DUTY_SLOT_KEYS)[number];

export const DUTY_SLOT_LABEL: Record<DutySlotKey, string> = {
  meal_bucket_1: "二年級餐桶①＋掃前",
  meal_bucket_2: "二年級餐桶②＋拖前",
  blackboard: "黑板、餐桶桌",
  sweep_1a: "二年級餐桶③＋掃中",
  sweep_1b: "二年級餐桶④＋拖中",
  sweep_2a: "四年級餐桶①＋掃後",
  sweep_2b: "四年級餐桶②＋拖後",
  sweep_3a: "四年級餐桶③＋倒垃圾①",
  sweep_3b: "四年級餐桶④＋倒垃圾②",
};

export const DUTY_EXPECTED_STUDENTS = DUTY_SLOT_KEYS.length;

/**
 * 輪轉環上的位置（不是 UI 欄位順序）。
 * 每位學生依序輪轉九種「午餐／清潔組合」；九個上課日為一輪，
 * 因每天八人都會抬餐桶，不再套用舊版避免連續抬桶規則。
 */
export const DUTY_ROTATION_INDEX: Record<DutySlotKey, number> = {
  meal_bucket_1: 0,
  blackboard: 1,
  meal_bucket_2: 2,
  sweep_1a: 3,
  sweep_1b: 4,
  sweep_2a: 5,
  sweep_2b: 6,
  sweep_3a: 7,
  sweep_3b: 8,
};

export type DutyStudent = {
  studentId: string;
  name: string;
  seatNumber: number;
};

/**
 * 上課日序號（從 termStart 起算；放假／六日不計）。
 * 目標日若放假 → null（當天不排）。
 */
export function schoolDayIndex(input: {
  termStart: string;
  date: string;
  holidayOverrides?: Record<string, boolean>;
}): number | null {
  const { termStart, date } = input;
  const overrides = input.holidayOverrides ?? {};
  if (!termStart || date < termStart) return null;
  if (resolveIsHoliday(date, overrides)) return null;

  let index = 0;
  const start = parseDateInput(termStart);
  const end = parseDateInput(date);
  for (
    let cursor = new Date(start);
    cursor < end;
    cursor.setDate(cursor.getDate() + 1)
  ) {
    const d = formatDateInput(cursor);
    if (!resolveIsHoliday(d, overrides)) {
      index += 1;
    }
  }
  return index;
}

/**
 * 座位序輪轉：
 * - 環內：每人每 9 個上課日剛好做過每個工作組合一次。
 * - 環與環之間：每滿 9 個上課日重排「誰站在環上哪個位置」，避免搭檔永遠同一組。
 * - N≠9：仍用同樣公式（N<9 可能一人多職；N>9 則每天只有部分人排到）
 */
export function assignDutySlots(input: {
  students: DutyStudent[];
  dayIndex: number;
}): Record<DutySlotKey, DutyStudent | null> {
  return assignDutySlotsRaw(input);
}

function assignDutySlotsRaw(input: {
  students: DutyStudent[];
  dayIndex: number;
}): Record<DutySlotKey, DutyStudent | null> {
  const base = [...input.students].sort(
    (a, b) =>
      a.seatNumber - b.seatNumber || a.name.localeCompare(b.name, "zh-Hant"),
  );
  const n = base.length;
  const result = {} as Record<DutySlotKey, DutyStudent | null>;
  if (n === 0) {
    for (const key of DUTY_SLOT_KEYS) result[key] = null;
    return result;
  }

  // 每 9 日一輪（或以班上人數為一輪）；換輪＝重排站位，搭檔組合才會變
  const cycle = Math.max(n, DUTY_EXPECTED_STUDENTS);
  const epoch = Math.floor(input.dayIndex / cycle);
  const dayInCycle = input.dayIndex % cycle;
  const ordered = shuffleStudentsDeterministic(base, epoch);

  for (const key of DUTY_SLOT_KEYS) {
    const ring = DUTY_ROTATION_INDEX[key] % n;
    result[key] = ordered[(ring + dayInCycle) % n];
  }

  return result;
}

/**
 * 用 epoch 當種子的穩定洗牌（同一 epoch 結果固定、可重現）。
 * 目標：不同輪次站位不同 → 午餐／清潔組合會換人。
 */
export function shuffleStudentsDeterministic(
  students: DutyStudent[],
  epoch: number,
): DutyStudent[] {
  const out = [...students];
  let seed = (epoch * 9301 + 49297) >>> 0;
  for (let i = out.length - 1; i > 0; i -= 1) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const j = seed % (i + 1);
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

/** 列出 [from, to] 之間的所有日期字串 */
export function eachDateInclusive(from: string, to: string): string[] {
  if (to < from) return [];
  const out: string[] = [];
  const cursor = parseDateInput(from);
  const end = parseDateInput(to);
  const guard = daysBetween(from, to) + 2;
  for (let i = 0; i < guard && cursor <= end; i += 1) {
    out.push(formatDateInput(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

export function isMealBucketSlot(slotKey: DutySlotKey) {
  return slotKey !== "blackboard";
}

export function isDutySlotKey(value: string): value is DutySlotKey {
  return (DUTY_SLOT_KEYS as readonly string[]).includes(value);
}

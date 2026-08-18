export const DAILY_STUDENT_TASK_KEYS = [
  "contact_book_copied",
  "morning_cleaning",
  "lunch_brushing",
  "noon_cleaning",
] as const;

export type DailyStudentTaskKey = (typeof DAILY_STUDENT_TASK_KEYS)[number];

export type TodayManualKey =
  | "contact_book_confirm"
  | "morning_cleaning"
  | "lunch_brushing"
  | "noon_cleaning";

export const DAILY_STUDENT_TASK_LABEL: Record<DailyStudentTaskKey, string> = {
  contact_book_copied: "已抄聯絡簿",
  morning_cleaning: "上午打掃",
  lunch_brushing: "午餐刷牙",
  noon_cleaning: "中午打掃",
};

export const ROUTINE_TASK_KEYS = [
  "contact_book_copied",
  "morning_cleaning",
  "lunch_brushing",
  "noon_cleaning",
] as const satisfies readonly DailyStudentTaskKey[];

export type RoutineTaskKey = (typeof ROUTINE_TASK_KEYS)[number];

export function isDailyStudentTaskKey(
  value: unknown,
): value is DailyStudentTaskKey {
  return (
    typeof value === "string" &&
    (DAILY_STUDENT_TASK_KEYS as readonly string[]).includes(value)
  );
}

export function isTodayManualKey(value: unknown): value is TodayManualKey {
  return (
    value === "contact_book_confirm" ||
    value === "morning_cleaning" ||
    value === "lunch_brushing" ||
    value === "noon_cleaning"
  );
}

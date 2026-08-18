import type { PassportStatus } from "@/types/passport";

/** 讀報／閱讀心得 */
export type ReadingType = "newspaper" | "reflection";

/** first=上學期(9–1)｜second=下學期(2–6)；7、8 月不計 */
export type ReadingSemester = "first" | "second";

export const READING_TYPE_LABEL: Record<ReadingType, string> = {
  newspaper: "讀報",
  reflection: "閱讀心得",
};

export const READING_SEMESTER_LABEL: Record<ReadingSemester, string> = {
  first: "上學期",
  second: "下學期",
};

export const READING_SEMESTER_MONTHS: Record<ReadingSemester, number[]> = {
  first: [9, 10, 11, 12, 1],
  second: [2, 3, 4, 5, 6],
};

export function isReadingType(value: unknown): value is ReadingType {
  return value === "newspaper" || value === "reflection";
}

export function isReadingSemester(value: unknown): value is ReadingSemester {
  return value === "first" || value === "second";
}

export function isReadingMonth(
  semester: ReadingSemester,
  month: number,
): boolean {
  return READING_SEMESTER_MONTHS[semester].includes(month);
}

/**
 * 依今天推下一個／當前學期。
 * 7–8 月 → 上學期；其餘落在進行中的學期。
 */
export function suggestReadingSemester(
  month = new Date().getMonth() + 1,
): ReadingSemester {
  if (month === 1 || month >= 7) return "first";
  return "second";
}

export type ReadingMatrixCell = {
  month: number;
  status: PassportStatus;
};

export type ReadingMatrixStudent = {
  studentId: string;
  name: string;
  seatNumber: number;
  cells: ReadingMatrixCell[];
  completedCount: number;
};

export type ReadingMatrixView = {
  type: ReadingType;
  schoolYear: string;
  semester: ReadingSemester;
  months: number[];
  /** 若今天落在本學期月份則標示，否則 null */
  currentMonth: number | null;
  monthTotals: {
    month: number;
    completed: number;
    missingParent: number;
    notStarted: number;
    total: number;
  }[];
  students: ReadingMatrixStudent[];
  overallCompleted: number;
  overallTotal: number;
};

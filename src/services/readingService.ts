import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { readingRecords, students } from "@/db/schema";
import { getClassSettings } from "@/services/classSettingsService";
import type { PassportStatus } from "@/types/passport";
import {
  isReadingMonth,
  READING_SEMESTER_MONTHS,
  suggestReadingSemester,
  type ReadingMatrixView,
  type ReadingSemester,
  type ReadingType,
} from "@/types/reading";

function asStatus(value: string | null | undefined): PassportStatus {
  if (
    value === "not_started" ||
    value === "missing_parent" ||
    value === "completed"
  ) {
    return value;
  }
  return "not_started";
}

export async function resolveReadingTerm(): Promise<{
  schoolYear: string;
  semester: ReadingSemester;
}> {
  const settings = await getClassSettings();
  // 閱讀／讀報一律依目前月份判定學期，不使用手動覆寫。
  const schoolYear = settings.schoolYear.trim() || "115";
  const semester = suggestReadingSemester();
  return { schoolYear, semester };
}

export async function getReadingMatrix(
  type: ReadingType,
): Promise<ReadingMatrixView> {
  const { schoolYear, semester } = await resolveReadingTerm();
  const months = READING_SEMESTER_MONTHS[semester];
  const todayMonth = new Date().getMonth() + 1;
  const currentMonth = months.includes(todayMonth) ? todayMonth : null;

  const activeStudents = await db
    .select({
      studentId: students.id,
      name: students.name,
      seatNumber: students.seatNumber,
    })
    .from(students)
    .where(eq(students.isActive, true))
    .orderBy(asc(students.seatNumber));

  const records = await db
    .select()
    .from(readingRecords)
    .where(
      and(
        eq(readingRecords.type, type),
        eq(readingRecords.schoolYear, schoolYear),
        eq(readingRecords.semester, semester),
      ),
    );

  const statusMap = new Map<string, PassportStatus>();
  for (const record of records) {
    statusMap.set(`${record.studentId}:${record.month}`, asStatus(record.status));
  }

  const matrixStudents = activeStudents.map((student) => {
    const cells = months.map((month) => ({
      month,
      status:
        statusMap.get(`${student.studentId}:${month}`) ??
        ("not_started" as const),
    }));
    return {
      studentId: student.studentId,
      name: student.name,
      seatNumber: student.seatNumber,
      cells,
      completedCount: cells.filter((cell) => cell.status === "completed").length,
    };
  });

  const monthTotals = months.map((month) => {
    const statuses = matrixStudents.map(
      (student) =>
        student.cells.find((cell) => cell.month === month)?.status ??
        "not_started",
    );
    return {
      month,
      completed: statuses.filter((s) => s === "completed").length,
      missingParent: statuses.filter((s) => s === "missing_parent").length,
      notStarted: statuses.filter((s) => s === "not_started").length,
      total: statuses.length,
    };
  });

  const overallCompleted = matrixStudents.reduce(
    (sum, student) => sum + student.completedCount,
    0,
  );
  const overallTotal = matrixStudents.length * months.length;

  return {
    type,
    schoolYear,
    semester,
    months,
    currentMonth,
    monthTotals,
    students: matrixStudents,
    overallCompleted,
    overallTotal,
  };
}

export async function upsertReadingStatus(input: {
  studentId: string;
  type: ReadingType;
  month: number;
  status: PassportStatus;
  schoolYear?: string;
  semester?: ReadingSemester;
}) {
  const term = await resolveReadingTerm();
  const schoolYear = input.schoolYear ?? term.schoolYear;
  const semester = input.semester ?? term.semester;

  if (!isReadingMonth(semester, input.month)) {
    throw new Error(
      semester === "first"
        ? "上學期月份須為 9–1 月"
        : "下學期月份須為 2–6 月",
    );
  }

  const student = await db
    .select({ id: students.id })
    .from(students)
    .where(and(eq(students.id, input.studentId), eq(students.isActive, true)))
    .limit(1);
  if (student.length === 0) throw new Error("找不到學生");

  const completedAt = input.status === "completed" ? new Date() : null;

  const existing = await db
    .select()
    .from(readingRecords)
    .where(
      and(
        eq(readingRecords.studentId, input.studentId),
        eq(readingRecords.type, input.type),
        eq(readingRecords.schoolYear, schoolYear),
        eq(readingRecords.semester, semester),
        eq(readingRecords.month, input.month),
      ),
    )
    .limit(1);

  if (existing[0]) {
    const [row] = await db
      .update(readingRecords)
      .set({
        status: input.status,
        completedAt,
      })
      .where(eq(readingRecords.id, existing[0].id))
      .returning();
    return row;
  }

  const [row] = await db
    .insert(readingRecords)
    .values({
      studentId: input.studentId,
      type: input.type,
      schoolYear,
      semester,
      month: input.month,
      status: input.status,
      completedAt,
    })
    .returning();
  return row;
}

import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  passportRecords,
  students,
  type PassportRecord,
} from "@/db/schema";
import { getClassSettings } from "@/services/classSettingsService";

export type PassportType = "Chinese" | "English";

export type PassportStudentRow = {
  studentId: string;
  name: string;
  seatNumber: number;
  completed: boolean;
  recordId: string | null;
};

export type PassportWeekView = {
  type: PassportType;
  week: number;
  currentWeek: number;
  startWeek: number;
  endWeek: number;
  completedCount: number;
  totalCount: number;
  students: PassportStudentRow[];
};

export type PassportSummary = {
  week: number;
  completed: number;
  total: number;
  remainingNames: string[];
};

export type PassportMatrixCell = {
  week: number;
  completed: boolean;
};

export type PassportMatrixStudent = {
  studentId: string;
  name: string;
  seatNumber: number;
  cells: PassportMatrixCell[];
  completedCount: number;
};

export type PassportMatrixView = {
  type: PassportType;
  currentWeek: number;
  startWeek: number;
  endWeek: number;
  weeks: number[];
  weekTotals: { week: number; completed: number; total: number }[];
  students: PassportMatrixStudent[];
  overallCompleted: number;
  overallTotal: number;
};

function weekBounds(type: PassportType, settings: Awaited<ReturnType<typeof getClassSettings>>) {
  if (type === "Chinese") {
    return {
      startWeek: settings.chineseStartWeek,
      endWeek: settings.chineseEndWeek,
    };
  }
  return {
    startWeek: settings.englishStartWeek,
    endWeek: settings.englishEndWeek,
  };
}

function buildWeekList(startWeek: number, endWeek: number) {
  return Array.from(
    { length: endWeek - startWeek + 1 },
    (_, index) => startWeek + index,
  );
}

export async function getPassportWeekView(
  type: PassportType,
  week?: number,
): Promise<PassportWeekView> {
  const settings = await getClassSettings();
  const { startWeek, endWeek } = weekBounds(type, settings);
  const selectedWeek = week ?? settings.currentWeek;

  if (selectedWeek < startWeek || selectedWeek > endWeek) {
    throw new Error(`週數須在第 ${startWeek}～${endWeek} 週`);
  }

  const rows = await db
    .select({
      studentId: students.id,
      name: students.name,
      seatNumber: students.seatNumber,
      completed: passportRecords.completed,
      recordId: passportRecords.id,
    })
    .from(students)
    .leftJoin(
      passportRecords,
      and(
        eq(passportRecords.studentId, students.id),
        eq(passportRecords.type, type),
        eq(passportRecords.week, selectedWeek),
      ),
    )
    .where(eq(students.isActive, true))
    .orderBy(asc(students.seatNumber));

  const studentsView: PassportStudentRow[] = rows.map((row) => ({
    studentId: row.studentId,
    name: row.name,
    seatNumber: row.seatNumber,
    completed: row.completed ?? false,
    recordId: row.recordId,
  }));

  const completedCount = studentsView.filter((s) => s.completed).length;

  return {
    type,
    week: selectedWeek,
    currentWeek: settings.currentWeek,
    startWeek,
    endWeek,
    completedCount,
    totalCount: studentsView.length,
    students: studentsView,
  };
}

export async function getPassportSummary(
  type: PassportType,
  week?: number,
): Promise<PassportSummary> {
  const view = await getPassportWeekView(type, week);
  return {
    week: view.week,
    completed: view.completedCount,
    total: view.totalCount,
    remainingNames: view.students
      .filter((s) => !s.completed)
      .map((s) => s.name),
  };
}

/** Full students × weeks matrix for one-glance passport checking */
export async function getPassportMatrix(
  type: PassportType,
): Promise<PassportMatrixView> {
  const settings = await getClassSettings();
  const { startWeek, endWeek } = weekBounds(type, settings);
  const weeks = buildWeekList(startWeek, endWeek);

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
    .select({
      studentId: passportRecords.studentId,
      week: passportRecords.week,
      completed: passportRecords.completed,
    })
    .from(passportRecords)
    .where(
      and(
        eq(passportRecords.type, type),
        eq(passportRecords.completed, true),
      ),
    );

  const completedSet = new Set(
    records.map((row) => `${row.studentId}:${row.week}`),
  );

  const matrixStudents: PassportMatrixStudent[] = activeStudents.map(
    (student) => {
      const cells = weeks.map((week) => ({
        week,
        completed: completedSet.has(`${student.studentId}:${week}`),
      }));
      return {
        studentId: student.studentId,
        name: student.name,
        seatNumber: student.seatNumber,
        cells,
        completedCount: cells.filter((cell) => cell.completed).length,
      };
    },
  );

  const weekTotals = weeks.map((week) => {
    const completed = matrixStudents.filter((student) =>
      student.cells.some((cell) => cell.week === week && cell.completed),
    ).length;
    return {
      week,
      completed,
      total: matrixStudents.length,
    };
  });

  const overallCompleted = matrixStudents.reduce(
    (sum, student) => sum + student.completedCount,
    0,
  );
  const overallTotal = matrixStudents.length * weeks.length;

  return {
    type,
    currentWeek: settings.currentWeek,
    startWeek,
    endWeek,
    weeks,
    weekTotals,
    students: matrixStudents,
    overallCompleted,
    overallTotal,
  };
}

export async function upsertPassportCompletion(input: {
  studentId: string;
  type: PassportType;
  week: number;
  completed: boolean;
}): Promise<PassportRecord> {
  const settings = await getClassSettings();
  const { startWeek, endWeek } = weekBounds(input.type, settings);

  if (input.week < startWeek || input.week > endWeek) {
    throw new Error(`週數須在第 ${startWeek}～${endWeek} 週`);
  }

  const studentRows = await db
    .select()
    .from(students)
    .where(and(eq(students.id, input.studentId), eq(students.isActive, true)))
    .limit(1);

  if (!studentRows[0]) {
    throw new Error("找不到學生");
  }

  const completedAt = input.completed ? new Date() : null;

  const existing = await db
    .select()
    .from(passportRecords)
    .where(
      and(
        eq(passportRecords.studentId, input.studentId),
        eq(passportRecords.type, input.type),
        eq(passportRecords.week, input.week),
      ),
    )
    .limit(1);

  if (existing[0]) {
    const rows = await db
      .update(passportRecords)
      .set({
        completed: input.completed,
        completedAt,
      })
      .where(eq(passportRecords.id, existing[0].id))
      .returning();
    return rows[0];
  }

  const rows = await db
    .insert(passportRecords)
    .values({
      studentId: input.studentId,
      type: input.type,
      week: input.week,
      completed: input.completed,
      completedAt,
    })
    .returning();

  return rows[0];
}

import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { passportRecords, students, type PassportRecord } from "@/db/schema";
import { getClassSettings } from "@/services/classSettingsService";
import { reconcilePassportReward } from "@/services/gamificationService";
import type { PassportStatus } from "@/types/passport";

export type PassportType = "Chinese" | "English";

export type PassportStudentRow = {
  studentId: string;
  name: string;
  seatNumber: number;
  status: PassportStatus;
  recordId: string | null;
};

export type PassportWeekView = {
  type: PassportType;
  week: number;
  currentWeek: number;
  startWeek: number;
  endWeek: number;
  completedCount: number;
  missingParentCount: number;
  notStartedCount: number;
  totalCount: number;
  students: PassportStudentRow[];
};

export type PassportSummary = {
  week: number;
  completed: number;
  total: number;
  remainingNames: string[];
  missingParentNames: string[];
};

export type PassportOwedStudent = {
  name: string;
  seatNumber: number;
  /** e.g. "W3,W5" or "W4缺家長" */
  detail: string;
};

export type PassportDashboardSummary = {
  week: number;
  weekCompleted: number;
  weekTotal: number;
  overallCompleted: number;
  overallTotal: number;
  /** Students with any non-completed cell from startWeek through currentWeek */
  owedStudents: PassportOwedStudent[];
};

export type PassportMatrixCell = {
  week: number;
  status: PassportStatus;
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
  /** 目前週文案：第 N 週／暑假／寒假… */
  weekLabel: string;
  startWeek: number;
  endWeek: number;
  weeks: number[];
  weekTotals: {
    week: number;
    completed: number;
    missingParent: number;
    notStarted: number;
    total: number;
  }[];
  students: PassportMatrixStudent[];
  overallCompleted: number;
  overallTotal: number;
};

function weekBounds(
  type: PassportType,
  settings: Awaited<ReturnType<typeof getClassSettings>>,
) {
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

function asStatus(value: string | null | undefined): PassportStatus {
  if (value === "completed") {
    return value;
  }
  // 舊版「缺家長」資料在護照改為兩態後，一律視為未開始。
  return "not_started";
}

export async function getPassportWeekView(
  type: PassportType,
  week?: number,
): Promise<PassportWeekView> {
  const settings = await getClassSettings();
  const { startWeek, endWeek } = weekBounds(type, settings);
  const resolved = settings.schoolWeek.week;
  const requested = week ?? resolved;
  // 寒暑假／週次在護照窗外：不報錯，改夾到最近可顯示週
  const selectedWeek =
    requested < startWeek
      ? startWeek
      : requested > endWeek
        ? endWeek
        : requested;

  const rows = await db
    .select({
      studentId: students.id,
      name: students.name,
      seatNumber: students.seatNumber,
      status: passportRecords.status,
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
    status: asStatus(row.status),
    recordId: row.recordId,
  }));

  const completedCount = studentsView.filter(
    (s) => s.status === "completed",
  ).length;
  const missingParentCount = 0;
  const notStartedCount = studentsView.filter(
    (s) => s.status === "not_started",
  ).length;

  return {
    type,
    week: selectedWeek,
    currentWeek: resolved,
    startWeek,
    endWeek,
    completedCount,
    missingParentCount,
    notStartedCount,
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
      .filter((s) => s.status !== "completed")
      .map((s) => s.name),
    missingParentNames: [],
  };
}

/** Dashboard card: 本週＋全部完成率，以及至目前週為止有欠的學生 */
export async function getPassportDashboardSummary(
  type: PassportType,
): Promise<PassportDashboardSummary> {
  const matrix = await getPassportMatrix(type);
  const currentWeek = matrix.currentWeek;
  const weekTotalRow = matrix.weekTotals.find(
    (item) => item.week === currentWeek,
  );
  const weekCompleted = weekTotalRow?.completed ?? 0;
  const weekTotal = weekTotalRow?.total ?? matrix.students.length;

  const owedStudents: PassportOwedStudent[] = [];

  for (const student of matrix.students) {
    const owedCells = student.cells.filter(
      (cell) =>
        cell.week >= matrix.startWeek &&
        cell.week <= currentWeek &&
        cell.status !== "completed",
    );
    if (owedCells.length === 0) continue;

    const detail = owedCells.map((cell) => `W${cell.week}`).join("、");

    owedStudents.push({
      name: student.name,
      seatNumber: student.seatNumber,
      detail,
    });
  }

  return {
    week: currentWeek,
    weekCompleted,
    weekTotal,
    overallCompleted: matrix.overallCompleted,
    overallTotal: matrix.overallTotal,
    owedStudents,
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
      status: passportRecords.status,
    })
    .from(passportRecords)
    .where(eq(passportRecords.type, type));

  const statusMap = new Map(
    records.map((row) => [
      `${row.studentId}:${row.week}`,
      asStatus(row.status),
    ]),
  );

  const matrixStudents: PassportMatrixStudent[] = activeStudents.map(
    (student) => {
      const cells = weeks.map((week) => ({
        week,
        status: statusMap.get(`${student.studentId}:${week}`) ?? "not_started",
      }));
      return {
        studentId: student.studentId,
        name: student.name,
        seatNumber: student.seatNumber,
        cells,
        completedCount: cells.filter((cell) => cell.status === "completed")
          .length,
      };
    },
  );

  const weekTotals = weeks.map((week) => {
    const statuses = matrixStudents.map(
      (student) =>
        student.cells.find((cell) => cell.week === week)?.status ??
        "not_started",
    );
    return {
      week,
      completed: statuses.filter((s) => s === "completed").length,
      missingParent: 0,
      notStarted: statuses.filter((s) => s === "not_started").length,
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
    currentWeek: settings.schoolWeek.week,
    weekLabel: settings.weekProgressLabel,
    startWeek,
    endWeek,
    weeks,
    weekTotals,
    students: matrixStudents,
    overallCompleted,
    overallTotal,
  };
}

export async function upsertPassportStatus(input: {
  studentId: string;
  type: PassportType;
  week: number;
  status: PassportStatus;
}): Promise<PassportRecord> {
  if (input.status !== "not_started" && input.status !== "completed") {
    throw new Error("護照狀態只能是未開始或已完成");
  }
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

  const completedAt =
    input.status === "completed"
      ? existing[0]?.status === "completed" && existing[0].completedAt
        ? existing[0].completedAt
        : new Date()
      : null;

  let result: PassportRecord;
  if (existing[0]) {
    const rows = await db
      .update(passportRecords)
      .set({
        status: input.status,
        completedAt,
      })
      .where(eq(passportRecords.id, existing[0].id))
      .returning();
    result = rows[0];
  } else {
    const rows = await db
      .insert(passportRecords)
      .values({
        studentId: input.studentId,
        type: input.type,
        week: input.week,
        status: input.status,
        completedAt,
      })
      .returning();
    result = rows[0];
  }

  await reconcilePassportReward({
    studentId: input.studentId,
    type: input.type,
    week: input.week,
    completed: input.status === "completed",
    completedAt,
    isPastWeek:
      settings.schoolWeek.week > 0 && input.week < settings.schoolWeek.week,
  });
  return result;
}

/** @deprecated use upsertPassportStatus */
export async function upsertPassportCompletion(input: {
  studentId: string;
  type: PassportType;
  week: number;
  completed: boolean;
}): Promise<PassportRecord> {
  return upsertPassportStatus({
    studentId: input.studentId,
    type: input.type,
    week: input.week,
    status: input.completed ? "completed" : "not_started",
  });
}

import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  dailyStudentTasks,
  dailyAbsences,
  contactBookDays,
  students,
  todayManualCompletions,
} from "@/db/schema";
import { todayDateString } from "@/lib/dates";
import { reconcileRoutineReward } from "@/services/gamificationService";
import { isActiveTermSchoolDay } from "@/services/termService";
import {
  DAILY_STUDENT_TASK_LABEL,
  ROUTINE_TASK_KEYS,
  type DailyStudentTaskKey,
} from "@/types/today";

export async function listActiveStudents() {
  return db
    .select({
      studentId: students.id,
      name: students.name,
      seatNumber: students.seatNumber,
    })
    .from(students)
    .where(eq(students.isActive, true))
    .orderBy(asc(students.seatNumber));
}

export async function getRoutineDayView(date = todayDateString()) {
  const [active, rows, absences] = await Promise.all([
    listActiveStudents(),
    db
    .select()
    .from(dailyStudentTasks)
    .where(eq(dailyStudentTasks.taskDate, date)),
    db.select({ studentId: dailyAbsences.studentId }).from(dailyAbsences).where(eq(dailyAbsences.taskDate, date)),
  ]);
  const absentIds = new Set(absences.map((row) => row.studentId));

  const map = new Map(
    rows.map(
      (row) => [`${row.studentId}:${row.taskKey}`, row.completed] as const,
    ),
  );

  const tasks = ROUTINE_TASK_KEYS.map((taskKey) => {
    const studentsView = active.map((student) => ({
      ...student,
      absent: absentIds.has(student.studentId),
      completed: map.get(`${student.studentId}:${taskKey}`) ?? false,
    }));
    const completedCount = studentsView.filter((s) => !s.absent && s.completed).length;
    const totalCount = studentsView.filter((s) => !s.absent).length;
    return {
      taskKey,
      label: DAILY_STUDENT_TASK_LABEL[taskKey],
      completedCount,
      totalCount,
      students: studentsView,
    };
  });

  return { date, tasks, students: active };
}

export async function getAbsentStudentIds(taskDate: string) {
  const rows = await db.select({ studentId: dailyAbsences.studentId }).from(dailyAbsences).where(eq(dailyAbsences.taskDate, taskDate));
  return new Set(rows.map((row) => row.studentId));
}

export async function setDailyAbsence(input: { studentId: string; taskDate: string; absent: boolean }) {
  if (input.absent) {
    await db.insert(dailyAbsences).values({ taskDate: input.taskDate, studentId: input.studentId }).onConflictDoNothing();
  } else {
    await db.delete(dailyAbsences).where(and(eq(dailyAbsences.taskDate, input.taskDate), eq(dailyAbsences.studentId, input.studentId)));
  }
}

export async function getStudentTaskMap(
  date: string,
  studentId: string,
): Promise<Record<DailyStudentTaskKey, boolean>> {
  const rows = await db
    .select()
    .from(dailyStudentTasks)
    .where(
      and(
        eq(dailyStudentTasks.taskDate, date),
        eq(dailyStudentTasks.studentId, studentId),
      ),
    );

  const map = Object.fromEntries(
    rows.map((row) => [row.taskKey, row.completed]),
  ) as Partial<Record<DailyStudentTaskKey, boolean>>;

  return {
    contact_book_copied: map.contact_book_copied ?? false,
    morning_cleaning: map.morning_cleaning ?? false,
    lunch_brushing: map.lunch_brushing ?? false,
    noon_cleaning: map.noon_cleaning ?? false,
  };
}

/** 大屏批次讀取：一天只查一次，避免逐位學生 N+1 查詢。 */
export async function getDailyStudentTaskMaps(
  date: string,
): Promise<Map<string, Record<DailyStudentTaskKey, boolean>>> {
  const rows = await db
    .select({
      studentId: dailyStudentTasks.studentId,
      taskKey: dailyStudentTasks.taskKey,
      completed: dailyStudentTasks.completed,
    })
    .from(dailyStudentTasks)
    .where(eq(dailyStudentTasks.taskDate, date));

  const result = new Map<string, Record<DailyStudentTaskKey, boolean>>();
  for (const row of rows) {
    const tasks = result.get(row.studentId) ?? {
      contact_book_copied: false,
      morning_cleaning: false,
      lunch_brushing: false,
      noon_cleaning: false,
    };
    tasks[row.taskKey] = row.completed;
    result.set(row.studentId, tasks);
  }
  return result;
}

export async function getTaskCompletionCount(
  date: string,
  taskKey: DailyStudentTaskKey,
) {
  const active = await listActiveStudents();
  if (active.length === 0) {
    return { completed: 0, total: 0, missingNames: [] as string[] };
  }

  const rows = await db
    .select({
      studentId: dailyStudentTasks.studentId,
      completed: dailyStudentTasks.completed,
    })
    .from(dailyStudentTasks)
    .where(
      and(
        eq(dailyStudentTasks.taskDate, date),
        eq(dailyStudentTasks.taskKey, taskKey),
        eq(dailyStudentTasks.completed, true),
      ),
    );

  const done = new Set(rows.map((row) => row.studentId));
  const missingNames = active
    .filter((s) => !done.has(s.studentId))
    .map((s) => s.name);

  return {
    completed: done.size,
    total: active.length,
    missingNames,
  };
}

export async function upsertDailyStudentTask(input: {
  studentId: string;
  taskKey: DailyStudentTaskKey;
  completed: boolean;
  taskDate?: string;
}) {
  const taskDate = input.taskDate ?? todayDateString();
  if (!(await isActiveTermSchoolDay(taskDate))) {
    throw new Error("每日任務只能建立在目前學期的上課日");
  }
  if (input.taskKey === "contact_book_copied" && input.completed) {
    const [contactBook] = await db.select({ id: contactBookDays.id }).from(contactBookDays).where(eq(contactBookDays.date, taskDate)).limit(1);
    if (!contactBook) throw new Error("今天尚未建立聯絡簿，不能勾選已抄聯絡簿");
  }
  const [existing] = await db
    .select()
    .from(dailyStudentTasks)
    .where(
      and(
        eq(dailyStudentTasks.taskDate, taskDate),
        eq(dailyStudentTasks.studentId, input.studentId),
        eq(dailyStudentTasks.taskKey, input.taskKey),
      ),
    )
    .limit(1);
  const completedAt = input.completed
    ? existing?.completed && existing.completedAt
      ? existing.completedAt
      : new Date()
    : null;

  const [student] = await db
    .select()
    .from(students)
    .where(and(eq(students.id, input.studentId), eq(students.isActive, true)))
    .limit(1);
  if (!student) throw new Error("找不到學生");

  const rows = await db
    .insert(dailyStudentTasks)
    .values({
      taskDate,
      studentId: input.studentId,
      taskKey: input.taskKey,
      completed: input.completed,
      completedAt,
    })
    .onConflictDoUpdate({
      target: [
        dailyStudentTasks.taskDate,
        dailyStudentTasks.studentId,
        dailyStudentTasks.taskKey,
      ],
      set: {
        completed: input.completed,
        completedAt,
        updatedAt: sql`now()`,
      },
    })
    .returning();

  await reconcileRoutineReward({
    studentId: input.studentId,
    taskDate,
    taskKey: input.taskKey,
    completed: input.completed,
  });
  return rows[0];
}

export async function upsertTodayManual(input: {
  taskKey:
    | "contact_book_confirm"
    | "morning_cleaning"
    | "lunch_brushing"
    | "noon_cleaning";
  completed: boolean;
  taskDate?: string;
}) {
  const taskDate = input.taskDate ?? todayDateString();
  const completedAt = input.completed ? new Date() : null;

  const rows = await db
    .insert(todayManualCompletions)
    .values({
      taskDate,
      taskKey: input.taskKey,
      completed: input.completed,
      completedAt,
    })
    .onConflictDoUpdate({
      target: [todayManualCompletions.taskDate, todayManualCompletions.taskKey],
      set: {
        completed: input.completed,
        completedAt,
        updatedAt: sql`now()`,
      },
    })
    .returning();

  return rows[0];
}

export async function getTodayManualMap(date: string) {
  const rows = await db
    .select()
    .from(todayManualCompletions)
    .where(eq(todayManualCompletions.taskDate, date));

  return new Map(rows.map((row) => [row.taskKey, row.completed] as const));
}

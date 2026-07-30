import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  homework,
  homeworkRecords,
  students,
  type Homework,
  type HomeworkRecord,
} from "@/db/schema";
import { HOMEWORK_TEMPLATES } from "@/types/homework";

export { HOMEWORK_TEMPLATES };

export type HomeworkDayItem = {
  id: string;
  title: string;
  date: string;
};

export type HomeworkStudentCell = {
  homeworkId: string;
  title: string;
  completed: boolean;
};

export type HomeworkStudentRow = {
  studentId: string;
  name: string;
  seatNumber: number;
  cells: HomeworkStudentCell[];
  /** All today's items done */
  allDone: boolean;
  missingTitles: string[];
};

export type HomeworkDayView = {
  date: string;
  items: HomeworkDayItem[];
  students: HomeworkStudentRow[];
  completedStudentCount: number;
  totalStudentCount: number;
};

export type HomeworkDashboardSummary = {
  date: string;
  completed: number;
  total: number;
  hasItems: boolean;
  missing: { name: string; missing: string[] }[];
};

function todayDateString(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function normalizeDate(date?: string) {
  if (!date) return todayDateString();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("日期格式須為 YYYY-MM-DD");
  }
  return date;
}

export async function getHomeworkDayView(
  date?: string,
): Promise<HomeworkDayView> {
  const day = normalizeDate(date);

  const [items, activeStudents] = await Promise.all([
    db
      .select()
      .from(homework)
      .where(eq(homework.date, day))
      .orderBy(asc(homework.createdAt)),
    db
      .select({
        studentId: students.id,
        name: students.name,
        seatNumber: students.seatNumber,
      })
      .from(students)
      .where(eq(students.isActive, true))
      .orderBy(asc(students.seatNumber)),
  ]);

  const itemViews: HomeworkDayItem[] = items.map((item) => ({
    id: item.id,
    title: item.title,
    date: String(item.date),
  }));

  let records: HomeworkRecord[] = [];
  if (items.length > 0) {
    records = await db
      .select()
      .from(homeworkRecords)
      .where(
        inArray(
          homeworkRecords.homeworkId,
          items.map((item) => item.id),
        ),
      );
  }

  const completedSet = new Set(
    records
      .filter((row) => row.completed)
      .map((row) => `${row.studentId}:${row.homeworkId}`),
  );

  const studentRows: HomeworkStudentRow[] = activeStudents.map((student) => {
    const cells = itemViews.map((item) => ({
      homeworkId: item.id,
      title: item.title,
      completed: completedSet.has(`${student.studentId}:${item.id}`),
    }));
    const missingTitles = cells
      .filter((cell) => !cell.completed)
      .map((cell) => cell.title);
    return {
      studentId: student.studentId,
      name: student.name,
      seatNumber: student.seatNumber,
      cells,
      allDone: items.length > 0 && missingTitles.length === 0,
      missingTitles,
    };
  });

  const completedStudentCount =
    items.length === 0
      ? 0
      : studentRows.filter((row) => row.allDone).length;

  return {
    date: day,
    items: itemViews,
    students: studentRows,
    completedStudentCount,
    totalStudentCount: studentRows.length,
  };
}

export async function getHomeworkDashboardSummary(
  date?: string,
): Promise<HomeworkDashboardSummary> {
  const view = await getHomeworkDayView(date);
  return {
    date: view.date,
    completed: view.completedStudentCount,
    total: view.totalStudentCount,
    hasItems: view.items.length > 0,
    missing: view.students
      .filter((student) => student.missingTitles.length > 0)
      .map((student) => ({
        name: student.name,
        missing: student.missingTitles,
      })),
  };
}

export async function createHomeworkItems(input: {
  date?: string;
  titles: string[];
}): Promise<Homework[]> {
  const day = normalizeDate(input.date);
  const titles = [
    ...new Set(
      input.titles
        .map((title) => title.trim())
        .filter((title) => title.length > 0),
    ),
  ];

  if (titles.length === 0) {
    throw new Error("請至少提供一個作業名稱");
  }

  const existing = await db
    .select()
    .from(homework)
    .where(eq(homework.date, day));
  const existingTitles = new Set(existing.map((item) => item.title));

  const toInsert = titles.filter((title) => !existingTitles.has(title));
  if (toInsert.length === 0) {
    throw new Error("這些作業今天已建立");
  }

  const rows = await db
    .insert(homework)
    .values(
      toInsert.map((title) => ({
        title,
        date: day,
        contactBookDate: day,
      })),
    )
    .returning();

  return rows;
}

export async function deleteHomeworkItem(id: string): Promise<void> {
  await db.delete(homeworkRecords).where(eq(homeworkRecords.homeworkId, id));
  await db.delete(homework).where(eq(homework.id, id));
}

export async function upsertHomeworkRecord(input: {
  homeworkId: string;
  studentId: string;
  completed: boolean;
}): Promise<HomeworkRecord> {
  const [hw] = await db
    .select()
    .from(homework)
    .where(eq(homework.id, input.homeworkId))
    .limit(1);
  if (!hw) {
    throw new Error("找不到作業");
  }

  const [student] = await db
    .select()
    .from(students)
    .where(
      and(eq(students.id, input.studentId), eq(students.isActive, true)),
    )
    .limit(1);
  if (!student) {
    throw new Error("找不到學生");
  }

  const completedAt = input.completed ? new Date() : null;

  const existing = await db
    .select()
    .from(homeworkRecords)
    .where(
      and(
        eq(homeworkRecords.homeworkId, input.homeworkId),
        eq(homeworkRecords.studentId, input.studentId),
      ),
    )
    .limit(1);

  if (existing[0]) {
    const rows = await db
      .update(homeworkRecords)
      .set({
        completed: input.completed,
        completedAt,
      })
      .where(eq(homeworkRecords.id, existing[0].id))
      .returning();
    return rows[0];
  }

  const rows = await db
    .insert(homeworkRecords)
    .values({
      homeworkId: input.homeworkId,
      studentId: input.studentId,
      completed: input.completed,
      completedAt,
    })
    .returning();

  return rows[0];
}

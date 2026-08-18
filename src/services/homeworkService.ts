import { and, asc, eq, inArray, lte } from "drizzle-orm";
import { db } from "@/db";
import {
  homework,
  homeworkBooks,
  homeworkRecords,
  homeworkRecordHistory,
  students,
  type Homework,
  type HomeworkRecord,
} from "@/db/schema";
import {
  assignmentKey,
  formatHomeworkTitle,
  type HomeworkAssignmentInput,
} from "@/types/homework";
import {
  clearGamificationEffectsForSource,
  reconcileHomeworkReward,
} from "@/services/gamificationService";

export type HomeworkDayItem = {
  id: string;
  bookId: string;
  bookName: string;
  pageLabel: string;
  title: string;
  date: string;
};

export type HomeworkStudentCell = {
  homeworkId: string;
  title: string;
  completed: boolean;
  status: "unsubmitted" | "pending_confirmation" | "correction_required" | "completed";
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

export type StudentHomeworkStatusItem = {
  label: string;
  status: "unsubmitted" | "pending_confirmation" | "correction_required" | "completed";
};

export type HomeworkBookProgress = {
  bookId: string;
  bookName: string;
  /** 已指派作業份數 */
  assignmentCount: number;
  /** 班級完成率（份數制）：完成格數／(份數×學生數) */
  completedRatio: number;
  completedPercent: number;
  /** 橫軸：此簿本所有指派 */
  assignments: {
    id: string;
    pageLabel: string;
    date: string;
    title: string;
  }[];
  students: {
    studentId: string;
    name: string;
    seatNumber: number;
    completedCount: number;
    totalCount: number;
    completedPercent: number;
    cells: { homeworkId: string; completed: boolean }[];
  }[];
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

function normalizeAssignments(
  assignments: HomeworkAssignmentInput[],
): HomeworkAssignmentInput[] {
  const cleaned = assignments
    .map((item) => ({
      bookId: item.bookId.trim(),
      pageLabel: item.pageLabel.trim(),
    }))
    .filter((item) => item.bookId && item.pageLabel);
  const unique: HomeworkAssignmentInput[] = [];
  const seen = new Set<string>();
  for (const item of cleaned) {
    const key = assignmentKey(item.bookId, item.pageLabel);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }
  return unique;
}

export async function getHomeworkDayView(
  date?: string,
): Promise<HomeworkDayView> {
  const day = normalizeDate(date);

  const [items, activeStudents] = await Promise.all([
    db
      .select({
        id: homework.id,
        bookId: homework.bookId,
        bookName: homeworkBooks.name,
        pageLabel: homework.pageLabel,
        date: homework.date,
      })
      .from(homework)
      .innerJoin(homeworkBooks, eq(homework.bookId, homeworkBooks.id))
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
    bookId: item.bookId,
    bookName: item.bookName,
    pageLabel: item.pageLabel,
    title: formatHomeworkTitle(item.bookName, item.pageLabel),
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

  const statusMap = new Map(
    records.map((row) => [`${row.studentId}:${row.homeworkId}`, row.status] as const),
  );

  const studentRows: HomeworkStudentRow[] = activeStudents.map((student) => {
    const cells = itemViews.map((item) => {
      const status = statusMap.get(`${student.studentId}:${item.id}`) ?? "unsubmitted";
      return { homeworkId: item.id, title: item.title, status, completed: status === "completed" };
    });
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
    items.length === 0 ? 0 : studentRows.filter((row) => row.allDone).length;

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

/** 簿本進度：以作業份數為單位（非頁數） */
export async function getHomeworkBookProgress(
  bookId: string,
): Promise<HomeworkBookProgress> {
  const [book] = await db
    .select()
    .from(homeworkBooks)
    .where(eq(homeworkBooks.id, bookId))
    .limit(1);
  if (!book) throw new Error("找不到此簿本");

  const [assignments, activeStudents] = await Promise.all([
    db
      .select({
        id: homework.id,
        pageLabel: homework.pageLabel,
        date: homework.date,
      })
      .from(homework)
      .where(eq(homework.bookId, bookId))
      .orderBy(asc(homework.date), asc(homework.createdAt)),
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

  const assignmentViews = assignments.map((item) => ({
    id: item.id,
    pageLabel: item.pageLabel,
    date: String(item.date),
    title: formatHomeworkTitle(book.name, item.pageLabel),
  }));

  const assignmentCount = assignments.length;
  const totalCount = assignmentCount;

  if (assignmentCount === 0 || activeStudents.length === 0) {
    return {
      bookId: book.id,
      bookName: book.name,
      assignmentCount,
      completedRatio: 0,
      completedPercent: 0,
      assignments: assignmentViews,
      students: activeStudents.map((student) => ({
        studentId: student.studentId,
        name: student.name,
        seatNumber: student.seatNumber,
        completedCount: 0,
        totalCount: 0,
        completedPercent: 0,
        cells: [],
      })),
    };
  }

  const records = await db
    .select()
    .from(homeworkRecords)
    .where(
      inArray(
        homeworkRecords.homeworkId,
        assignments.map((item) => item.id),
      ),
    );

  const completedSet = new Set(
    records
      .filter((row) => row.completed)
      .map((row) => `${row.studentId}:${row.homeworkId}`),
  );

  const studentsProgress = activeStudents.map((student) => {
    const cells = assignments.map((item) => ({
      homeworkId: item.id,
      completed: completedSet.has(`${student.studentId}:${item.id}`),
    }));
    const completedCount = cells.filter((cell) => cell.completed).length;
    return {
      studentId: student.studentId,
      name: student.name,
      seatNumber: student.seatNumber,
      completedCount,
      totalCount,
      completedPercent:
        totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100),
      cells,
    };
  });

  const completedCells = studentsProgress.reduce(
    (sum, student) => sum + student.completedCount,
    0,
  );
  const totalCells = assignmentCount * activeStudents.length;
  const completedRatio = totalCells === 0 ? 0 : completedCells / totalCells;

  return {
    bookId: book.id,
    bookName: book.name,
    assignmentCount,
    completedRatio,
    completedPercent: Math.round(completedRatio * 100),
    assignments: assignmentViews,
    students: studentsProgress,
  };
}

export async function listAllHomeworkBookProgress(): Promise<
  HomeworkBookProgress[]
> {
  const books = await db
    .select()
    .from(homeworkBooks)
    .where(eq(homeworkBooks.isActive, true))
    .orderBy(asc(homeworkBooks.sortOrder), asc(homeworkBooks.name));
  return Promise.all(books.map((book) => getHomeworkBookProgress(book.id)));
}

/**
 * 繳交日已到的作業狀態，供大屏欠繳頁清楚呈現「未交／待確認／需訂正／已完成」。
 * 回傳 studentId → 簿本＋頁數與目前狀態。
 */
export async function listStudentHomeworkDebts(
  asOfDate?: string,
): Promise<Map<string, StudentHomeworkStatusItem[]>> {
  const day = normalizeDate(asOfDate);

  const [items, activeStudents] = await Promise.all([
    db
      .select({
        id: homework.id,
        bookName: homeworkBooks.name,
        pageLabel: homework.pageLabel,
        date: homework.date,
      })
      .from(homework)
      .innerJoin(homeworkBooks, eq(homework.bookId, homeworkBooks.id))
      .where(lte(homework.date, day))
      .orderBy(asc(homework.date), asc(homework.createdAt)),
    db
      .select({ studentId: students.id })
      .from(students)
      .where(eq(students.isActive, true)),
  ]);

  const debts = new Map<string, StudentHomeworkStatusItem[]>();
  for (const student of activeStudents) {
    debts.set(student.studentId, []);
  }

  if (items.length === 0) return debts;

  const records = await db
    .select()
    .from(homeworkRecords)
    .where(
      inArray(
        homeworkRecords.homeworkId,
        items.map((item) => item.id),
      ),
    );

  const statusMap = new Map(
    records.map((row) => [
      `${row.studentId}:${row.homeworkId}`,
      row.status,
    ] as const),
  );

  for (const student of activeStudents) {
    const assignments: StudentHomeworkStatusItem[] = [];
    for (const item of items) {
      assignments.push({
        label: formatHomeworkTitle(item.bookName, item.pageLabel),
        status: statusMap.get(`${student.studentId}:${item.id}`) ?? "unsubmitted",
      });
    }
    debts.set(student.studentId, assignments);
  }

  return debts;
}

export async function createHomeworkItems(input: {
  date?: string;
  assignments: HomeworkAssignmentInput[];
}): Promise<Homework[]> {
  const day = normalizeDate(input.date);
  const desired = normalizeAssignments(input.assignments);
  if (desired.length === 0) {
    throw new Error("請至少提供一個作業（簿本＋頁數）");
  }

  const bookIds = [...new Set(desired.map((item) => item.bookId))];
  const books = await db
    .select()
    .from(homeworkBooks)
    .where(inArray(homeworkBooks.id, bookIds));
  if (books.length !== bookIds.length) {
    throw new Error("找不到部分簿本");
  }

  const existing = await db
    .select()
    .from(homework)
    .where(eq(homework.date, day));
  const existingKeys = new Set(
    existing.map((item) => assignmentKey(item.bookId, item.pageLabel)),
  );

  const toInsert = desired.filter(
    (item) => !existingKeys.has(assignmentKey(item.bookId, item.pageLabel)),
  );
  if (toInsert.length === 0) {
    throw new Error("這些作業今天已建立");
  }

  const rows = await db
    .insert(homework)
    .values(
      toInsert.map((item) => ({
        bookId: item.bookId,
        pageLabel: item.pageLabel,
        date: day,
        contactBookDate: day,
      })),
    )
    .returning();

  return rows;
}

export async function deleteHomeworkItem(id: string): Promise<void> {
  await clearGamificationEffectsForSource("homework", id);
  await db.delete(homeworkRecords).where(eq(homeworkRecords.homeworkId, id));
  await db.delete(homework).where(eq(homework.id, id));
}

export async function upsertHomeworkRecord(input: {
  homeworkId: string;
  studentId: string;
  completed?: boolean;
  status?: "unsubmitted" | "pending_confirmation" | "correction_required" | "completed";
  actor?: "teacher" | "student";
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
    .where(and(eq(students.id, input.studentId), eq(students.isActive, true)))
    .limit(1);
  if (!student) {
    throw new Error("找不到學生");
  }

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

  const nextStatus = input.status ?? (input.completed ? "completed" : "unsubmitted");
  const completed = nextStatus === "completed";
  const completedAt = completed
    ? existing[0]?.completed && existing[0].completedAt
      ? existing[0].completedAt
      : new Date()
    : null;

  let result: HomeworkRecord;
  if (existing[0]) {
    const rows = await db
      .update(homeworkRecords)
      .set({
        completed,
        status: nextStatus,
        completedAt,
      })
      .where(eq(homeworkRecords.id, existing[0].id))
      .returning();
    result = rows[0];
  } else {
    const rows = await db
      .insert(homeworkRecords)
      .values({
        homeworkId: input.homeworkId,
        studentId: input.studentId,
        completed,
        status: nextStatus,
        completedAt,
      })
      .returning();
    result = rows[0];
  }

  if (!existing[0] || existing[0].status !== nextStatus) {
    await db.insert(homeworkRecordHistory).values({
      homeworkId: input.homeworkId,
      studentId: input.studentId,
      previousStatus: existing[0]?.status ?? null,
      nextStatus,
      actor: input.actor ?? "teacher",
    });
  }

  await reconcileHomeworkReward({
    studentId: input.studentId,
    homeworkId: input.homeworkId,
    dueDate: String(hw.date),
    completed,
    completedAt,
  });
  return result;
}

export { normalizeAssignments, assignmentKey, formatHomeworkTitle };

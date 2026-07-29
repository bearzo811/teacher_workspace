import { and, asc, eq, ilike } from "drizzle-orm";
import { db } from "@/db";
import {
  homework,
  homeworkRecords,
  passportRecords,
  students,
  type NewStudent,
  type Student,
} from "@/db/schema";
import { getClassSettings } from "@/services/classSettingsService";
import type { PassportStatus } from "@/types/passport";
import type { StudentDetail } from "@/types/student";

export type StudentInput = {
  name: string;
  seatNumber: number;
};

export type { StudentDetail };
function normalizeName(name: string) {
  return name.trim();
}

function assertValidInput({ name, seatNumber }: StudentInput) {
  const trimmed = normalizeName(name);
  if (!trimmed) {
    throw new Error("姓名不可為空");
  }
  if (!Number.isInteger(seatNumber) || seatNumber < 1) {
    throw new Error("座號必須是大於 0 的整數");
  }
  return { name: trimmed, seatNumber };
}

export async function listStudents(searchQuery?: string): Promise<Student[]> {
  const q = searchQuery?.trim();
  const where = q
    ? and(eq(students.isActive, true), ilike(students.name, `%${q}%`))
    : eq(students.isActive, true);

  return db
    .select()
    .from(students)
    .where(where)
    .orderBy(asc(students.seatNumber));
}

export async function getStudentById(id: string): Promise<Student | null> {
  const rows = await db
    .select()
    .from(students)
    .where(eq(students.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function createStudent(input: StudentInput): Promise<Student> {
  const data = assertValidInput(input);

  const existing = await db
    .select()
    .from(students)
    .where(
      and(eq(students.isActive, true), eq(students.seatNumber, data.seatNumber)),
    )
    .limit(1);

  if (existing[0]) {
    throw new Error(`座號 ${data.seatNumber} 已被使用`);
  }

  const values: NewStudent = {
    name: data.name,
    seatNumber: data.seatNumber,
    isActive: true,
  };

  const rows = await db.insert(students).values(values).returning();
  return rows[0];
}

export async function updateStudent(
  id: string,
  input: Partial<StudentInput>,
): Promise<Student> {
  const current = await getStudentById(id);
  if (!current || !current.isActive) {
    throw new Error("找不到學生");
  }

  const nextName =
    input.name !== undefined ? normalizeName(input.name) : current.name;
  const nextSeat =
    input.seatNumber !== undefined ? input.seatNumber : current.seatNumber;

  const data = assertValidInput({ name: nextName, seatNumber: nextSeat });

  if (data.seatNumber !== current.seatNumber) {
    const conflict = await db
      .select()
      .from(students)
      .where(
        and(
          eq(students.isActive, true),
          eq(students.seatNumber, data.seatNumber),
        ),
      )
      .limit(1);
    if (conflict[0] && conflict[0].id !== id) {
      throw new Error(`座號 ${data.seatNumber} 已被使用`);
    }
  }

  const rows = await db
    .update(students)
    .set({
      name: data.name,
      seatNumber: data.seatNumber,
    })
    .where(eq(students.id, id))
    .returning();

  return rows[0];
}

/** Soft delete — sets is_active = false */
export async function softDeleteStudent(id: string): Promise<Student> {
  const current = await getStudentById(id);
  if (!current || !current.isActive) {
    throw new Error("找不到學生");
  }

  const rows = await db
    .update(students)
    .set({ isActive: false })
    .where(eq(students.id, id))
    .returning();

  return rows[0];
}

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

function buildWeekList(startWeek: number, endWeek: number) {
  return Array.from(
    { length: endWeek - startWeek + 1 },
    (_, index) => startWeek + index,
  );
}

async function countPassportCompleted(
  studentId: string,
  type: "Chinese" | "English",
  startWeek: number,
  endWeek: number,
) {
  const weeks = buildWeekList(startWeek, endWeek);
  const records = await db
    .select({
      week: passportRecords.week,
      status: passportRecords.status,
    })
    .from(passportRecords)
    .where(
      and(
        eq(passportRecords.studentId, studentId),
        eq(passportRecords.type, type),
      ),
    );

  const map = new Map(
    records.map((row) => [row.week, asStatus(row.status)] as const),
  );
  const completed = weeks.filter(
    (week) => map.get(week) === "completed",
  ).length;

  return { completed, total: weeks.length };
}

export async function getStudentDetail(
  id: string,
): Promise<StudentDetail | null> {
  const student = await getStudentById(id);
  if (!student || !student.isActive) {
    return null;
  }

  const settings = await getClassSettings();
  const [chinese, english, allHomework, completedHomework] = await Promise.all([
    countPassportCompleted(
      id,
      "Chinese",
      settings.chineseStartWeek,
      settings.chineseEndWeek,
    ),
    countPassportCompleted(
      id,
      "English",
      settings.englishStartWeek,
      settings.englishEndWeek,
    ),
    db.select({ id: homework.id }).from(homework),
    db
      .select({ id: homeworkRecords.id })
      .from(homeworkRecords)
      .where(
        and(
          eq(homeworkRecords.studentId, id),
          eq(homeworkRecords.completed, true),
        ),
      ),
  ]);

  const homeworkTotal = allHomework.length;
  const homeworkCompleted = completedHomework.length;
  const percent =
    homeworkTotal === 0
      ? 100
      : Math.round((homeworkCompleted / homeworkTotal) * 100);

  return {
    id: student.id,
    name: student.name,
    seatNumber: student.seatNumber,
    chinese,
    english,
    homework: {
      completed: homeworkCompleted,
      total: homeworkTotal,
      percent,
    },
  };
}

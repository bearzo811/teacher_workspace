import { and, asc, eq, ilike } from "drizzle-orm";
import { db } from "@/db";
import { students, type NewStudent, type Student } from "@/db/schema";

export type StudentInput = {
  name: string;
  seatNumber: number;
};

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

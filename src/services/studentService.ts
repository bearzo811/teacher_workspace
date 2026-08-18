import { and, asc, count, eq, ilike } from "drizzle-orm";
import { db } from "@/db";
import {
  homework,
  homeworkRecords,
  passportRecords,
  students,
  termRosterEntries,
  type NewStudent,
  type Student,
} from "@/db/schema";
import { getClassSettings } from "@/services/classSettingsService";
import { getActiveTerm } from "@/services/termService";
import {
  ensureStudentGameProfile,
  getStudentGamification,
} from "@/services/gamificationService";
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
  const activeTerm = await getActiveTerm();
  const q = searchQuery?.trim();
  if (activeTerm) {
    const where = q
      ? and(
          eq(termRosterEntries.termId, activeTerm.id),
          eq(termRosterEntries.isActive, true),
          ilike(students.name, `%${q}%`),
        )
      : and(
          eq(termRosterEntries.termId, activeTerm.id),
          eq(termRosterEntries.isActive, true),
        );
    const rows = await db
      .select({ student: students, seatNumber: termRosterEntries.seatNumber })
      .from(termRosterEntries)
      .innerJoin(students, eq(termRosterEntries.studentId, students.id))
      .where(where)
      .orderBy(asc(termRosterEntries.seatNumber));
    return rows.map(({ student, seatNumber }) => ({ ...student, seatNumber }));
  }
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
      and(
        eq(students.isActive, true),
        eq(students.seatNumber, data.seatNumber),
      ),
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
  await ensureStudentGameProfile(rows[0].id);
  const activeTerm = await getActiveTerm();
  if (activeTerm) {
    await db.insert(termRosterEntries).values({
      termId: activeTerm.id,
      studentId: rows[0].id,
      seatNumber: rows[0].seatNumber,
      isActive: true,
    });
  }
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

  const activeTerm = await getActiveTerm();
  if (activeTerm) {
    await db
      .update(termRosterEntries)
      .set({ seatNumber: data.seatNumber })
      .where(
        and(
          eq(termRosterEntries.termId, activeTerm.id),
          eq(termRosterEntries.studentId, id),
        ),
      );
  }

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

  const activeTerm = await getActiveTerm();
  if (activeTerm) {
    await db
      .update(termRosterEntries)
      .set({ isActive: false })
      .where(
        and(
          eq(termRosterEntries.termId, activeTerm.id),
          eq(termRosterEntries.studentId, id),
        ),
      );
  }

  return rows[0];
}

function buildWeekList(startWeek: number, endWeek: number) {
  return Array.from(
    { length: endWeek - startWeek + 1 },
    (_, index) => startWeek + index,
  );
}

function countPassportCompleted(
  records: { type: "Chinese" | "English"; week: number; status: string }[],
  type: "Chinese" | "English",
  startWeek: number,
  endWeek: number,
) {
  const weeks = buildWeekList(startWeek, endWeek);
  const map = new Map(
    records
      .filter((row) => row.type === type)
      .map((row) => [row.week, row.status] as const),
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

  const [settings, passportRows, homeworkStats, game] = await Promise.all([
    getClassSettings(),
    db
      .select({
        type: passportRecords.type,
        week: passportRecords.week,
        status: passportRecords.status,
      })
      .from(passportRecords)
      .where(eq(passportRecords.studentId, id)),
    db
      .select({
        total: count(homework.id),
        completed: count(homeworkRecords.id),
      })
      .from(homework)
      .leftJoin(
        homeworkRecords,
        and(
          eq(homeworkRecords.homeworkId, homework.id),
          eq(homeworkRecords.studentId, id),
          eq(homeworkRecords.completed, true),
        ),
      ),
    getStudentGamification(id),
  ]);

  const chinese = countPassportCompleted(
    passportRows,
    "Chinese",
    settings.chineseStartWeek,
    settings.chineseEndWeek,
  );
  const english = countPassportCompleted(
    passportRows,
    "English",
    settings.englishStartWeek,
    settings.englishEndWeek,
  );
  const homeworkTotal = Number(homeworkStats[0]?.total ?? 0);
  const homeworkCompleted = Number(homeworkStats[0]?.completed ?? 0);
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
    gamification: game.profile,
    gamificationRecent: game.recent,
  };
}

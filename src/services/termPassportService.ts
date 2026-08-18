import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { students, termPassportHistory, termPassportRecords } from "@/db/schema";
import { getActiveTerm } from "@/services/termService";
import { reconcileTermPassportReward } from "@/services/gamificationService";

export type TermPassportType = "Chinese" | "English";

export async function getTermPassportView(type: TermPassportType) {
  const term = await getActiveTerm();
  if (!term) return { term: null, type, students: [] as { studentId: string; name: string; seatNumber: number; recordId: string | null; completed: boolean }[] };
  const rows = await db.select({ studentId: students.id, name: students.name, seatNumber: students.seatNumber, recordId: termPassportRecords.id, completed: termPassportRecords.completed }).from(students)
    .leftJoin(termPassportRecords, and(eq(termPassportRecords.studentId, students.id), eq(termPassportRecords.termId, term.id), eq(termPassportRecords.type, type)))
    .where(eq(students.isActive, true)).orderBy(asc(students.seatNumber));
  return { term, type, students: rows.map((row) => ({ ...row, completed: row.completed ?? false })) };
}

export async function setTermPassport(input: { studentId: string; type: TermPassportType; completed: boolean; actor: "teacher" | "student" }) {
  const term = await getActiveTerm();
  if (!term) throw new Error("請先建立並啟用學期");
  const [existing] = await db.select().from(termPassportRecords).where(and(eq(termPassportRecords.termId, term.id), eq(termPassportRecords.studentId, input.studentId), eq(termPassportRecords.type, input.type))).limit(1);
  const now = new Date();
  const [record] = existing
    ? await db.update(termPassportRecords).set({ completed: input.completed, completedAt: input.completed ? (existing.completedAt ?? now) : null, updatedAt: now }).where(eq(termPassportRecords.id, existing.id)).returning()
    : await db.insert(termPassportRecords).values({ termId: term.id, studentId: input.studentId, type: input.type, completed: input.completed, completedAt: input.completed ? now : null }).returning();
  if (!existing || existing.completed !== input.completed) await db.insert(termPassportHistory).values({ passportRecordId: record.id, previousCompleted: existing?.completed ?? null, nextCompleted: input.completed, actor: input.actor });
  if (!existing || existing.completed !== input.completed) {
    await reconcileTermPassportReward({ studentId: input.studentId, termId: term.id, type: input.type, completed: input.completed });
  }
  return record;
}

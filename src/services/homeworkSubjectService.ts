import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { homeworkSubjects, type HomeworkSubject } from "@/db/schema";

export type HomeworkSubjectView = Pick<HomeworkSubject, "id" | "name" | "sortOrder" | "isActive">;

function toView(row: HomeworkSubject): HomeworkSubjectView {
  return { id: row.id, name: row.name, sortOrder: row.sortOrder, isActive: row.isActive };
}

export async function listHomeworkSubjects(activeOnly = true) {
  const rows = activeOnly
    ? await db.select().from(homeworkSubjects).where(eq(homeworkSubjects.isActive, true)).orderBy(asc(homeworkSubjects.sortOrder), asc(homeworkSubjects.name))
    : await db.select().from(homeworkSubjects).orderBy(asc(homeworkSubjects.sortOrder), asc(homeworkSubjects.name));
  return rows.map(toView);
}

export async function createHomeworkSubject(input: { name: string; sortOrder?: number }) {
  const name = input.name.trim();
  if (!name) throw new Error("請填寫科目名稱");
  const [existing] = await db.select({ id: homeworkSubjects.id }).from(homeworkSubjects).where(eq(homeworkSubjects.name, name)).limit(1);
  if (existing) throw new Error("此科目已存在");
  const [row] = await db.insert(homeworkSubjects).values({ name, sortOrder: input.sortOrder ?? 0 }).returning();
  return toView(row);
}

export async function updateHomeworkSubject(input: { id: string; name?: string; sortOrder?: number; isActive?: boolean }) {
  const [existing] = await db.select().from(homeworkSubjects).where(eq(homeworkSubjects.id, input.id)).limit(1);
  if (!existing) throw new Error("找不到科目");
  const name = input.name?.trim();
  if (input.name !== undefined && !name) throw new Error("請填寫科目名稱");
  if (name && name !== existing.name) {
    const [clash] = await db.select({ id: homeworkSubjects.id }).from(homeworkSubjects).where(and(eq(homeworkSubjects.name, name))).limit(1);
    if (clash) throw new Error("此科目已存在");
  }
  const [row] = await db.update(homeworkSubjects).set({ name, sortOrder: input.sortOrder, isActive: input.isActive }).where(eq(homeworkSubjects.id, input.id)).returning();
  return toView(row);
}

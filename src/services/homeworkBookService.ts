import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { homeworkBooks, homeworkSubjects, homework, coursePlanAssignments, type HomeworkBook } from "@/db/schema";

export async function deleteHomeworkBook(id: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [book] = await tx.select().from(homeworkBooks).where(eq(homeworkBooks.id, id)).for("update");
    if (!book) throw new Error("找不到此簿本");
    const used = await tx.select({ id: homework.id }).from(homework).where(eq(homework.bookId, id)).limit(1);
    const planned = await tx.select({ id: coursePlanAssignments.id }).from(coursePlanAssignments).where(eq(coursePlanAssignments.bookId, id)).limit(1);
    if (used.length || planned.length) throw new Error("此簿本已有作業或課程計劃，請改用停用，保留既有紀錄。");
    await tx.delete(homeworkBooks).where(eq(homeworkBooks.id, id));
  });
}

export type HomeworkBookView = {
  id: string;
  name: string;
  subjectId: string | null;
  subjectName: string | null;
  sortOrder: number;
  isActive: boolean;
};

function toView(
  row: HomeworkBook,
  subjectName: string | null = null,
): HomeworkBookView {
  return {
    id: row.id,
    name: row.name,
    subjectId: row.subjectId,
    subjectName,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
  };
}

export async function listHomeworkBooks(options?: {
  activeOnly?: boolean;
}): Promise<HomeworkBookView[]> {
  const rows = options?.activeOnly
    ? await db
        .select({ book: homeworkBooks, subjectName: homeworkSubjects.name })
        .from(homeworkBooks)
        .leftJoin(homeworkSubjects, eq(homeworkBooks.subjectId, homeworkSubjects.id))
        .where(eq(homeworkBooks.isActive, true))
        .orderBy(asc(homeworkBooks.sortOrder), asc(homeworkBooks.name))
    : await db
        .select({ book: homeworkBooks, subjectName: homeworkSubjects.name })
        .from(homeworkBooks)
        .leftJoin(homeworkSubjects, eq(homeworkBooks.subjectId, homeworkSubjects.id))
        .orderBy(asc(homeworkBooks.sortOrder), asc(homeworkBooks.name));
  return rows.map((row) => toView(row.book, row.subjectName));
}

export async function createHomeworkBook(input: {
  name: string;
  subjectId?: string | null;
  sortOrder?: number;
}): Promise<HomeworkBookView> {
  const name = input.name.trim();
  if (!name) throw new Error("請填寫簿本名稱");

  const existing = await db
    .select({ id: homeworkBooks.id })
    .from(homeworkBooks)
    .where(eq(homeworkBooks.name, name))
    .limit(1);
  if (existing[0]) throw new Error("此簿本名稱已存在");

  const [row] = await db
    .insert(homeworkBooks)
    .values({
      name,
      subjectId: input.subjectId ?? null,
      sortOrder: input.sortOrder ?? 0,
      isActive: true,
    })
    .returning();
  return toView(row);
}

export async function updateHomeworkBook(input: {
  id: string;
  name?: string;
  subjectId?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}): Promise<HomeworkBookView> {
  const existing = await db
    .select()
    .from(homeworkBooks)
    .where(eq(homeworkBooks.id, input.id))
    .limit(1);
  if (!existing[0]) throw new Error("找不到此簿本");

  const patch: Partial<typeof homeworkBooks.$inferInsert> = {};
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) throw new Error("請填寫簿本名稱");
    const clash = await db
      .select({ id: homeworkBooks.id })
      .from(homeworkBooks)
      .where(
        and(eq(homeworkBooks.name, name)),
      )
      .limit(1);
    if (clash[0] && clash[0].id !== input.id) {
      throw new Error("此簿本名稱已存在");
    }
    patch.name = name;
  }
  if (input.sortOrder !== undefined) patch.sortOrder = input.sortOrder;
  if (input.subjectId !== undefined) patch.subjectId = input.subjectId;
  if (input.isActive !== undefined) patch.isActive = input.isActive;

  const [row] = await db
    .update(homeworkBooks)
    .set(patch)
    .where(eq(homeworkBooks.id, input.id))
    .returning();
  return toView(row);
}

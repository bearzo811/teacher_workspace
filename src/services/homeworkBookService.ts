import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { homeworkBooks, type HomeworkBook } from "@/db/schema";

export type HomeworkBookView = {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
};

function toView(row: HomeworkBook): HomeworkBookView {
  return {
    id: row.id,
    name: row.name,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
  };
}

export async function listHomeworkBooks(options?: {
  activeOnly?: boolean;
}): Promise<HomeworkBookView[]> {
  const rows = options?.activeOnly
    ? await db
        .select()
        .from(homeworkBooks)
        .where(eq(homeworkBooks.isActive, true))
        .orderBy(asc(homeworkBooks.sortOrder), asc(homeworkBooks.name))
    : await db
        .select()
        .from(homeworkBooks)
        .orderBy(asc(homeworkBooks.sortOrder), asc(homeworkBooks.name));
  return rows.map(toView);
}

export async function createHomeworkBook(input: {
  name: string;
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
      sortOrder: input.sortOrder ?? 0,
      isActive: true,
    })
    .returning();
  return toView(row);
}

export async function updateHomeworkBook(input: {
  id: string;
  name?: string;
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
  if (input.isActive !== undefined) patch.isActive = input.isActive;

  const [row] = await db
    .update(homeworkBooks)
    .set(patch)
    .where(eq(homeworkBooks.id, input.id))
    .returning();
  return toView(row);
}

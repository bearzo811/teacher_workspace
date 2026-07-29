import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { contactBookDays, homework, homeworkRecords } from "@/db/schema";
import { getClassSettings } from "@/services/classSettingsService";
import { HOMEWORK_TEMPLATES } from "@/types/homework";

export { HOMEWORK_TEMPLATES };

export type ContactBookView = {
  date: string;
  note: string;
  titles: string[];
  items: { id: string; title: string }[];
  className: string;
  schoolYear: string;
};

function normalizeDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("日期格式須為 YYYY-MM-DD");
  }
  return date;
}

function normalizeTitles(titles: string[]) {
  const cleaned = titles.map((title) => title.trim()).filter(Boolean);
  const unique: string[] = [];
  for (const title of cleaned) {
    if (!unique.includes(title)) unique.push(title);
  }
  return unique;
}

export async function getContactBook(date: string): Promise<ContactBookView> {
  const day = normalizeDate(date);
  const [settings, noteRow, items] = await Promise.all([
    getClassSettings(),
    db
      .select()
      .from(contactBookDays)
      .where(eq(contactBookDays.date, day))
      .limit(1),
    db
      .select()
      .from(homework)
      .where(eq(homework.date, day))
      .orderBy(asc(homework.createdAt)),
  ]);

  return {
    date: day,
    note: noteRow[0]?.note ?? "",
    titles: items.map((item) => item.title),
    items: items.map((item) => ({ id: item.id, title: item.title })),
    className: settings.className,
    schoolYear: settings.schoolYear,
  };
}

/**
 * Save contact book for a date:
 * - upsert note
 * - reconcile homework titles for that date (add / keep / delete)
 */
export async function saveContactBook(input: {
  date: string;
  note?: string;
  titles: string[];
}): Promise<ContactBookView> {
  const day = normalizeDate(input.date);
  const desired = normalizeTitles(input.titles);
  const note = (input.note ?? "").trim();

  const existingNote = await db
    .select()
    .from(contactBookDays)
    .where(eq(contactBookDays.date, day))
    .limit(1);

  if (existingNote[0]) {
    await db
      .update(contactBookDays)
      .set({ note })
      .where(eq(contactBookDays.id, existingNote[0].id));
  } else {
    await db.insert(contactBookDays).values({ date: day, note });
  }

  const existingItems = await db
    .select()
    .from(homework)
    .where(eq(homework.date, day))
    .orderBy(asc(homework.createdAt));

  const existingByTitle = new Map(
    existingItems.map((item) => [item.title, item] as const),
  );
  const desiredSet = new Set(desired);

  const toDelete = existingItems.filter((item) => !desiredSet.has(item.title));
  if (toDelete.length > 0) {
    const ids = toDelete.map((item) => item.id);
    await db
      .delete(homeworkRecords)
      .where(inArray(homeworkRecords.homeworkId, ids));
    await db.delete(homework).where(inArray(homework.id, ids));
  }

  const toInsert = desired.filter((title) => !existingByTitle.has(title));
  if (toInsert.length > 0) {
    await db.insert(homework).values(
      toInsert.map((title) => ({
        title,
        date: day,
      })),
    );
  }

  const view = await getContactBook(day);
  const byTitle = new Map(view.items.map((item) => [item.title, item] as const));
  const orderedItems = desired
    .map((title) => byTitle.get(title))
    .filter((item): item is { id: string; title: string } => Boolean(item));

  return {
    ...view,
    titles: desired,
    items: orderedItems,
  };
}

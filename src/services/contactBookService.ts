import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { contactBookDays, homework, homeworkRecords } from "@/db/schema";
import { nextSchoolDay } from "@/lib/dates";
import { getClassSettings } from "@/services/classSettingsService";
import { HOMEWORK_TEMPLATES } from "@/types/homework";

export { HOMEWORK_TEMPLATES };

export type ContactBookView = {
  date: string;
  dueDate: string;
  note: string;
  titles: string[];
  items: { id: string; title: string; dueDate: string }[];
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
  const dueDate = nextSchoolDay(day);
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
      .where(eq(homework.contactBookDate, day))
      .orderBy(asc(homework.createdAt)),
  ]);

  return {
    date: day,
    dueDate: items[0]?.date ?? dueDate,
    note: noteRow[0]?.note ?? "",
    titles: items.map((item) => item.title),
    items: items.map((item) => ({
      id: item.id,
      title: item.title,
      dueDate: item.date,
    })),
    className: settings.className,
    schoolYear: settings.schoolYear,
  };
}

/**
 * Save contact book for a date:
 * - upsert note
 * - reconcile homework by contactBookDate (titles sync)
 * - homework.date = next school day (due date)
 */
export async function saveContactBook(input: {
  date: string;
  note?: string;
  titles: string[];
}): Promise<ContactBookView> {
  const day = normalizeDate(input.date);
  const dueDate = nextSchoolDay(day);
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
    .where(eq(homework.contactBookDate, day))
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

  for (const item of existingItems) {
    if (!desiredSet.has(item.title)) continue;
    if (item.date !== dueDate || item.contactBookDate !== day) {
      await db
        .update(homework)
        .set({ date: dueDate, contactBookDate: day })
        .where(eq(homework.id, item.id));
    }
  }

  const toInsert = desired.filter((title) => !existingByTitle.has(title));
  if (toInsert.length > 0) {
    await db.insert(homework).values(
      toInsert.map((title) => ({
        title,
        date: dueDate,
        contactBookDate: day,
      })),
    );
  }

  const view = await getContactBook(day);
  const byTitle = new Map(view.items.map((item) => [item.title, item] as const));
  const orderedItems = desired
    .map((title) => byTitle.get(title))
    .filter(
      (item): item is { id: string; title: string; dueDate: string } =>
        Boolean(item),
    );

  return {
    ...view,
    dueDate,
    titles: desired,
    items: orderedItems,
  };
}

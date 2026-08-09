import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  contactBookDays,
  homework,
  homeworkBooks,
  homeworkRecords,
} from "@/db/schema";
import { nextSchoolDay } from "@/lib/dates";
import { getClassSettings } from "@/services/classSettingsService";
import { clearGamificationEffectsForSource } from "@/services/gamificationService";
import { normalizeAssignments } from "@/services/homeworkService";
import {
  assignmentKey,
  formatHomeworkTitle,
  type HomeworkAssignmentInput,
} from "@/types/homework";

export type ContactBookAssignment = {
  bookId: string;
  bookName: string;
  pageLabel: string;
  title: string;
};

export type ContactBookView = {
  date: string;
  dueDate: string;
  /** @deprecated 改用 notes；保留相容 */
  note: string;
  notes: string[];
  /** 顯示用字串（簿本＋頁數） */
  titles: string[];
  assignments: ContactBookAssignment[];
  items: {
    id: string;
    bookId: string;
    bookName: string;
    pageLabel: string;
    title: string;
    dueDate: string;
  }[];
  className: string;
  schoolYear: string;
};

function normalizeDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("日期格式須為 YYYY-MM-DD");
  }
  return date;
}

function normalizeNoteItems(items: string[]) {
  const cleaned = items.map((item) => item.trim()).filter(Boolean);
  const unique: string[] = [];
  for (const item of cleaned) {
    if (!unique.includes(item)) unique.push(item);
  }
  return unique;
}

/** note 欄：JSON 陣列；舊資料＝純文字／多行 → 拆成陣列 */
export function parseNotes(raw: string | null | undefined): string[] {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (Array.isArray(parsed)) {
      return normalizeNoteItems(parsed.map((item) => String(item)));
    }
  } catch {
    // legacy blob
  }
  return normalizeNoteItems(trimmed.split(/\n+/));
}

export function serializeNotes(notes: string[]): string {
  return JSON.stringify(normalizeNoteItems(notes));
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
      .select({
        id: homework.id,
        bookId: homework.bookId,
        bookName: homeworkBooks.name,
        pageLabel: homework.pageLabel,
        dueDate: homework.date,
      })
      .from(homework)
      .innerJoin(homeworkBooks, eq(homework.bookId, homeworkBooks.id))
      .where(eq(homework.contactBookDate, day))
      .orderBy(asc(homework.createdAt)),
  ]);

  const notes = parseNotes(noteRow[0]?.note);
  const mapped = items.map((item) => {
    const title = formatHomeworkTitle(item.bookName, item.pageLabel);
    return {
      id: item.id,
      bookId: item.bookId,
      bookName: item.bookName,
      pageLabel: item.pageLabel,
      title,
      dueDate: item.dueDate,
    };
  });

  return {
    date: day,
    dueDate: items[0]?.dueDate ?? dueDate,
    note: notes.join("\n"),
    notes,
    titles: mapped.map((item) => item.title),
    assignments: mapped.map((item) => ({
      bookId: item.bookId,
      bookName: item.bookName,
      pageLabel: item.pageLabel,
      title: item.title,
    })),
    items: mapped,
    className: settings.className,
    schoolYear: settings.schoolYear,
  };
}

/**
 * Save contact book for a date:
 * - upsert notes（不進作業打勾）
 * - reconcile homework by contactBookDate（簿本＋頁數）
 * - homework.date = next school day (due date)
 */
export async function saveContactBook(input: {
  date: string;
  notes?: string[];
  /** @deprecated 改傳 notes */
  note?: string;
  assignments: HomeworkAssignmentInput[];
}): Promise<ContactBookView> {
  const day = normalizeDate(input.date);
  const dueDate = nextSchoolDay(day);
  const desired = normalizeAssignments(input.assignments);
  const notes =
    input.notes !== undefined
      ? normalizeNoteItems(input.notes)
      : parseNotes(input.note ?? "");
  const notePayload = serializeNotes(notes);

  if (desired.length > 0) {
    const bookIds = [...new Set(desired.map((item) => item.bookId))];
    const books = await db
      .select({ id: homeworkBooks.id })
      .from(homeworkBooks)
      .where(inArray(homeworkBooks.id, bookIds));
    if (books.length !== bookIds.length) {
      throw new Error("找不到部分簿本");
    }
  }

  const existingNote = await db
    .select()
    .from(contactBookDays)
    .where(eq(contactBookDays.date, day))
    .limit(1);

  if (existingNote[0]) {
    await db
      .update(contactBookDays)
      .set({ note: notePayload })
      .where(eq(contactBookDays.id, existingNote[0].id));
  } else {
    await db.insert(contactBookDays).values({ date: day, note: notePayload });
  }

  const existingItems = await db
    .select()
    .from(homework)
    .where(eq(homework.contactBookDate, day))
    .orderBy(asc(homework.createdAt));

  const existingByKey = new Map(
    existingItems.map(
      (item) => [assignmentKey(item.bookId, item.pageLabel), item] as const,
    ),
  );
  const desiredKeys = desired.map((item) =>
    assignmentKey(item.bookId, item.pageLabel),
  );
  const desiredSet = new Set(desiredKeys);

  const toDelete = existingItems.filter(
    (item) => !desiredSet.has(assignmentKey(item.bookId, item.pageLabel)),
  );
  if (toDelete.length > 0) {
    for (const item of toDelete) {
      await clearGamificationEffectsForSource("homework", item.id);
    }
    const ids = toDelete.map((item) => item.id);
    await db
      .delete(homeworkRecords)
      .where(inArray(homeworkRecords.homeworkId, ids));
    await db.delete(homework).where(inArray(homework.id, ids));
  }

  for (const item of existingItems) {
    const key = assignmentKey(item.bookId, item.pageLabel);
    if (!desiredSet.has(key)) continue;
    if (item.date !== dueDate || item.contactBookDate !== day) {
      await db
        .update(homework)
        .set({ date: dueDate, contactBookDate: day })
        .where(eq(homework.id, item.id));
    }
  }

  const toInsert = desired.filter(
    (item) => !existingByKey.has(assignmentKey(item.bookId, item.pageLabel)),
  );
  if (toInsert.length > 0) {
    await db.insert(homework).values(
      toInsert.map((item) => ({
        bookId: item.bookId,
        pageLabel: item.pageLabel,
        date: dueDate,
        contactBookDate: day,
      })),
    );
  }

  const view = await getContactBook(day);
  const byKey = new Map(
    view.items.map(
      (item) => [assignmentKey(item.bookId, item.pageLabel), item] as const,
    ),
  );
  const orderedItems = desired
    .map((item) => byKey.get(assignmentKey(item.bookId, item.pageLabel)))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  return {
    ...view,
    dueDate,
    note: notes.join("\n"),
    notes,
    titles: orderedItems.map((item) => item.title),
    assignments: orderedItems.map((item) => ({
      bookId: item.bookId,
      bookName: item.bookName,
      pageLabel: item.pageLabel,
      title: item.title,
    })),
    items: orderedItems,
  };
}

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { contactBookTemplates } from "@/db/schema";
import { parseNotes } from "@/services/contactBookService";

type Assignment = { bookId: string; pageLabel: string };
function parseAssignments(raw: string): Assignment[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return parsed.filter((item): item is Assignment => Boolean(item && typeof item === "object" && typeof (item as Assignment).bookId === "string" && typeof (item as Assignment).pageLabel === "string"));
  } catch { /* 空範本 */ }
  return [];
}
export async function getContactBookTemplate(weekday: number) {
  if (!Number.isInteger(weekday) || weekday < 1 || weekday > 5) throw new Error("weekday 須為 1～5");
  const [row] = await db.select().from(contactBookTemplates).where(eq(contactBookTemplates.weekday, weekday)).limit(1);
  return { weekday, notes: parseNotes(row?.notes), assignments: parseAssignments(row?.assignments ?? "[]") };
}
export async function saveContactBookTemplate(input: { weekday: number; notes: string[]; assignments: Assignment[] }) {
  const view = { weekday: input.weekday, notes: input.notes.map((item) => item.trim()).filter(Boolean), assignments: input.assignments.filter((item) => item.bookId.trim() && item.pageLabel.trim()) };
  if (!Number.isInteger(view.weekday) || view.weekday < 1 || view.weekday > 5) throw new Error("weekday 須為 1～5");
  await db.insert(contactBookTemplates).values({ weekday: view.weekday, notes: JSON.stringify(view.notes), assignments: JSON.stringify(view.assignments), updatedAt: new Date() }).onConflictDoUpdate({ target: contactBookTemplates.weekday, set: { notes: JSON.stringify(view.notes), assignments: JSON.stringify(view.assignments), updatedAt: new Date() } });
  return view;
}

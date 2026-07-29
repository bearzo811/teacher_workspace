import { eq } from "drizzle-orm";
import { db } from "@/db";
import { classSettings, type ClassSettings } from "@/db/schema";

const DEFAULT_SETTINGS = {
  schoolYear: "114",
  grade: 4,
  className: "四年三班",
  currentWeek: 8,
  chineseStartWeek: 3,
  chineseEndWeek: 17,
  englishStartWeek: 3,
  englishEndWeek: 17,
} as const;

/** MVP: single row. Create defaults if missing. */
export async function getClassSettings(): Promise<ClassSettings> {
  const existing = await db.select().from(classSettings).limit(1);
  if (existing[0]) {
    return existing[0];
  }

  const created = await db
    .insert(classSettings)
    .values({ ...DEFAULT_SETTINGS })
    .returning();
  return created[0];
}

export type ClassSettingsUpdate = Partial<{
  schoolYear: string;
  grade: number;
  className: string;
  currentWeek: number;
  chineseStartWeek: number;
  chineseEndWeek: number;
  englishStartWeek: number;
  englishEndWeek: number;
}>;

export async function updateClassSettings(
  patch: ClassSettingsUpdate,
): Promise<ClassSettings> {
  const current = await getClassSettings();
  const rows = await db
    .update(classSettings)
    .set(patch)
    .where(eq(classSettings.id, current.id))
    .returning();
  return rows[0];
}

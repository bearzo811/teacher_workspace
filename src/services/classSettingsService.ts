import { eq } from "drizzle-orm";
import { db } from "@/db";
import { classSettings, type ClassSettings } from "@/db/schema";
import {
  formatWeekProgress,
  resolveSchoolWeek,
  resolveTotalWeeks,
  type SchoolWeekState,
} from "@/lib/schoolWeek";
import { hashSecret, matchesSecret } from "@/lib/auth";

const DEFAULT_SETTINGS = {
  schoolYear: "114",
  grade: 4,
  className: "四年三班",
  currentWeek: 8,
  chineseStartWeek: 3,
  chineseEndWeek: 16,
  englishStartWeek: 3,
  englishEndWeek: 16,
  weekOneStartDate: "",
  termEndDate: "",
  allowDisplayHomeworkToggle: false,
  allowDisplayPassportToggle: false,
  allowDisplayRoutineToggle: false,
  readingSchoolYear: "",
  readingSemester: "first",
  allowDisplayReadingToggle: false,
  displayCarouselEnabled: false,
  displayToken: "",
  displayTokenHash: "",
  displayRefreshSeconds: 20,
  displayContactBookDate: "",
  shopOpen: false,
} as const;

export type ClassSettingsView = Omit<ClassSettings, "displayToken" | "displayTokenHash"> & {
  hasDisplayToken: boolean;
  schoolWeek: SchoolWeekState;
  totalWeeks: number | null;
  weekProgressLabel: string;
};

function withSchoolWeek(row: ClassSettings): ClassSettingsView {
  const {
    displayToken: _displayToken,
    displayTokenHash: _displayTokenHash,
    ...publicRow
  } = row;
  void _displayToken;
  void _displayTokenHash;
  const schoolWeek = resolveSchoolWeek({
    weekOneStartDate: row.weekOneStartDate,
    termEndDate: row.termEndDate,
    fallbackWeek: row.currentWeek,
  });
  const totalWeeks = resolveTotalWeeks(
    row.weekOneStartDate,
    row.termEndDate,
  );
  // currentWeek 維持 DB 手動備援；實際週次看 schoolWeek
  return {
    ...publicRow,
    hasDisplayToken: Boolean(row.displayTokenHash.trim() || row.displayToken.trim()),
    schoolWeek,
    totalWeeks,
    weekProgressLabel: formatWeekProgress(schoolWeek, totalWeeks),
  };
}

/** 目前有效週次（寒暑假／未開學＝0） */
export function resolvedCurrentWeek(settings: ClassSettingsView) {
  return settings.schoolWeek.week;
}

/** MVP: single row. Create defaults if missing. */
export async function getClassSettings(): Promise<ClassSettingsView> {
  const existing = await db.select().from(classSettings).limit(1);
  if (existing[0]) {
    const row = existing[0];
    if (row.displayToken.trim() && !row.displayTokenHash.trim()) {
      const [migrated] = await db
        .update(classSettings)
        .set({ displayToken: "", displayTokenHash: await hashSecret(row.displayToken.trim()) })
        .where(eq(classSettings.id, row.id))
        .returning();
      return withSchoolWeek(migrated);
    }
    return withSchoolWeek(row);
  }

  const created = await db
    .insert(classSettings)
    .values({ ...DEFAULT_SETTINGS })
    .returning();
  return withSchoolWeek(created[0]);
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
  weekOneStartDate: string;
  termEndDate: string;
  allowDisplayHomeworkToggle: boolean;
  allowDisplayPassportToggle: boolean;
  allowDisplayRoutineToggle: boolean;
  readingSchoolYear: string;
  readingSemester: string;
  allowDisplayReadingToggle: boolean;
  displayCarouselEnabled: boolean;
  displayToken: string;
  displayRefreshSeconds: number;
  displayContactBookDate: string;
  shopOpen: boolean;
}>;

export async function updateClassSettings(
  patch: ClassSettingsUpdate,
): Promise<ClassSettingsView> {
  const current = await getClassSettings();
  const { displayToken, ...rest } = patch;
  const update = displayToken === undefined
    ? rest
    : {
        ...rest,
        displayToken: "",
        displayTokenHash: displayToken.trim() ? await hashSecret(displayToken.trim()) : "",
      };
  const rows = await db
    .update(classSettings)
    .set(update)
    .where(eq(classSettings.id, current.id))
    .returning();
  return withSchoolWeek(rows[0]);
}

/** 大屏登入專用；絕不向客戶端回傳原始存取碼或雜湊。 */
export async function verifyDisplayAccessCode(code: string) {
  const rows = await db.select().from(classSettings).limit(1);
  const row = rows[0] ?? (
    await db.insert(classSettings).values({ ...DEFAULT_SETTINGS }).returning()
  )[0];
  const hash = row.displayTokenHash.trim() || (
    row.displayToken.trim() ? await hashSecret(row.displayToken.trim()) : ""
  );
  if (row.displayToken.trim() && !row.displayTokenHash.trim()) {
    await db
      .update(classSettings)
      .set({ displayToken: "", displayTokenHash: hash })
      .where(eq(classSettings.id, row.id));
  }
  return Boolean(hash) && matchesSecret(code.trim(), hash);
}

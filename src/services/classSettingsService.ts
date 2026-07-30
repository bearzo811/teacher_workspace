import { eq } from "drizzle-orm";
import { db } from "@/db";
import { classSettings, type ClassSettings } from "@/db/schema";
import {
  formatWeekProgress,
  resolveSchoolWeek,
  resolveTotalWeeks,
  type SchoolWeekState,
} from "@/lib/schoolWeek";

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
  displayRefreshSeconds: 20,
  displayContactBookDate: "",
} as const;

export type ClassSettingsView = ClassSettings & {
  schoolWeek: SchoolWeekState;
  totalWeeks: number | null;
  weekProgressLabel: string;
};

function withSchoolWeek(row: ClassSettings): ClassSettingsView {
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
    ...row,
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
    return withSchoolWeek(existing[0]);
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
}>;

export async function updateClassSettings(
  patch: ClassSettingsUpdate,
): Promise<ClassSettingsView> {
  const current = await getClassSettings();
  const rows = await db
    .update(classSettings)
    .set(patch)
    .where(eq(classSettings.id, current.id))
    .returning();
  return withSchoolWeek(rows[0]);
}

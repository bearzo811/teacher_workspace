import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { dailyTaskCompletions } from "@/db/schema";
import { getPassportSummary } from "@/services/passportService";
import { getClassSettings } from "@/services/classSettingsService";
import type {
  DashboardData,
  DashboardTodayTask,
} from "@/types/dashboard";

export type { DashboardData, DashboardTodayTask };
function todayDateString() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Dashboard aggregation — Single Source of Truth for Data Widgets.
 */
export async function getDashboardData(): Promise<DashboardData> {
  const settings = await getClassSettings();
  const week = settings.currentWeek;

  const [chinese, english, taskRows] = await Promise.all([
    getPassportSummary("Chinese", week),
    getPassportSummary("English", week),
    db
      .select()
      .from(dailyTaskCompletions)
      .where(eq(dailyTaskCompletions.taskDate, todayDateString())),
  ]);

  const taskMap = new Map(
    taskRows.map((row) => [row.taskKey, row.completed] as const),
  );

  const todayTasks: DashboardTodayTask[] = [
    {
      taskKey: "chinese_passport",
      label: "國語護照",
      completed: taskMap.get("chinese_passport") ?? false,
    },
    {
      taskKey: "english_passport",
      label: "英語護照",
      completed: taskMap.get("english_passport") ?? false,
    },
    {
      taskKey: "homework",
      label: "作業",
      completed: taskMap.get("homework") ?? false,
    },
  ];

  return {
    todayTasks,
    passportSummary: {
      chinese: {
        week: chinese.week,
        completed: chinese.completed,
        total: chinese.total,
      },
      english: {
        week: english.week,
        completed: english.completed,
        total: english.total,
      },
    },
    homeworkSummary: null,
    remainingStudents: {
      chinese: chinese.remainingNames,
      english: english.remainingNames,
      homework: [],
    },
  };
}

export async function upsertDailyTaskCompletion(input: {
  taskKey: DashboardTodayTask["taskKey"];
  completed: boolean;
  taskDate?: string;
}) {
  const taskDate = input.taskDate ?? todayDateString();
  const completedAt = input.completed ? new Date() : null;

  const rows = await db
    .insert(dailyTaskCompletions)
    .values({
      taskDate,
      taskKey: input.taskKey,
      completed: input.completed,
      completedAt,
    })
    .onConflictDoUpdate({
      target: [dailyTaskCompletions.taskDate, dailyTaskCompletions.taskKey],
      set: {
        completed: input.completed,
        completedAt,
        updatedAt: sql`now()`,
      },
    })
    .returning();

  return rows[0];
}

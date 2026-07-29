import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { dailyTaskCompletions } from "@/db/schema";
import {
  getPassportDashboardSummary,
  getPassportSummary,
} from "@/services/passportService";
import { getClassSettings } from "@/services/classSettingsService";
import type {
  DashboardData,
  DashboardTodayTask,
  PassportDashboardCard,
} from "@/types/dashboard";

export type { DashboardData, DashboardTodayTask };

function todayDateString() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function toCard(
  summary: Awaited<ReturnType<typeof getPassportDashboardSummary>>,
): PassportDashboardCard {
  return {
    week: summary.week,
    weekCompleted: summary.weekCompleted,
    weekTotal: summary.weekTotal,
    overallCompleted: summary.overallCompleted,
    overallTotal: summary.overallTotal,
    owedStudents: summary.owedStudents,
  };
}

/**
 * Dashboard aggregation — Single Source of Truth for Data Widgets.
 */
export async function getDashboardData(): Promise<DashboardData> {
  const settings = await getClassSettings();
  const week = settings.currentWeek;

  const [chineseCard, englishCard, chineseWeek, englishWeek, taskRows] =
    await Promise.all([
      getPassportDashboardSummary("Chinese"),
      getPassportDashboardSummary("English"),
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
      chinese: toCard(chineseCard),
      english: toCard(englishCard),
    },
    homeworkSummary: null,
    remainingStudents: {
      chinese: buildRemaining(chineseWeek),
      english: buildRemaining(englishWeek),
      homework: [],
    },
  };
}

function buildRemaining(summary: {
  remainingNames: string[];
  missingParentNames: string[];
}) {
  const missing = new Set(summary.missingParentNames);
  return summary.remainingNames.map((name) => ({
    name,
    note: missing.has(name) ? "缺家長" : undefined,
  }));
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

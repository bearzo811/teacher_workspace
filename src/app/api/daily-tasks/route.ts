import { NextResponse } from "next/server";
import {
  upsertDailyTaskCompletion,
  type DashboardTodayTask,
} from "@/services/dashboardService";

export const dynamic = "force-dynamic";

const TASK_KEYS = new Set<DashboardTodayTask["taskKey"]>([
  "chinese_passport",
  "english_passport",
  "homework",
]);

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as {
      taskKey?: string;
      completed?: boolean;
      taskDate?: string;
    };

    if (!body.taskKey || !TASK_KEYS.has(body.taskKey as DashboardTodayTask["taskKey"])) {
      return NextResponse.json({ error: "taskKey 無效" }, { status: 400 });
    }
    if (typeof body.completed !== "boolean") {
      return NextResponse.json({ error: "completed 必須是布林" }, { status: 400 });
    }

    const data = await upsertDailyTaskCompletion({
      taskKey: body.taskKey as DashboardTodayTask["taskKey"],
      completed: body.completed,
      taskDate: body.taskDate,
    });
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "更新今日工作失敗";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

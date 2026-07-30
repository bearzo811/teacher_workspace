import { NextResponse } from "next/server";
import {
  getRoutineDayView,
  upsertDailyStudentTask,
} from "@/services/routineService";
import { getClassSettings } from "@/services/classSettingsService";
import { isDailyStudentTaskKey } from "@/types/today";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date") ?? undefined;
    const data = await getRoutineDayView(date);
    return NextResponse.json({ data });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "讀取每日任務失敗";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as {
      studentId?: string;
      taskKey?: string;
      completed?: boolean;
      taskDate?: string;
      displayMode?: boolean;
    };

    if (
      !body.studentId ||
      !isDailyStudentTaskKey(body.taskKey) ||
      typeof body.completed !== "boolean"
    ) {
      return NextResponse.json(
        { error: "請提供 studentId、taskKey、completed" },
        { status: 400 },
      );
    }

    const isDisplay =
      body.displayMode === true ||
      request.headers.get("X-Display-Mode") === "1";
    if (isDisplay) {
      const settings = await getClassSettings();
      if (!settings.allowDisplayRoutineToggle) {
        return NextResponse.json(
          { error: "老師尚未開放大屏每日任務／已抄勾選" },
          { status: 400 },
        );
      }
    }

    const data = await upsertDailyStudentTask({
      studentId: body.studentId,
      taskKey: body.taskKey,
      completed: body.completed,
      taskDate: body.taskDate,
    });
    return NextResponse.json({ data });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "更新每日任務失敗";
    const status = message.includes("找不到") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

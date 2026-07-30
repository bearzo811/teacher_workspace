import { NextResponse } from "next/server";
import {
  getTodayBoard,
  setTodayManualCompletion,
} from "@/services/todayService";
import { isTodayManualKey } from "@/types/today";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getTodayBoard();
    return NextResponse.json({ data });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "讀取 Today 失敗";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as {
      taskKey?: string;
      completed?: boolean;
      taskDate?: string;
    };
    if (!isTodayManualKey(body.taskKey) || typeof body.completed !== "boolean") {
      return NextResponse.json(
        { error: "請提供有效的 taskKey 與 completed" },
        { status: 400 },
      );
    }
    const data = await setTodayManualCompletion({
      taskKey: body.taskKey,
      completed: body.completed,
      taskDate: body.taskDate,
    });
    return NextResponse.json({ data });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "更新 Today 失敗";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

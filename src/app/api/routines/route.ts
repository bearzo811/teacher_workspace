import { NextResponse } from "next/server";
import {
  getRoutineDayView,
  setDailyAbsence,
  upsertDailyStudentTask,
} from "@/services/routineService";
import { isDisplayKeyRequest, isTeacherRequest } from "@/lib/access";
import { isDailyStudentTaskKey } from "@/types/today";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    if (!(await isTeacherRequest())) {
      return NextResponse.json({ error: "未授權" }, { status: 401 });
    }
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
      absence?: boolean;
    };

    if (typeof body.absence === "boolean" && body.studentId && body.taskDate) {
      if (!(await isTeacherRequest())) return NextResponse.json({ error: "未授權" }, { status: 401 });
      await setDailyAbsence({ studentId: body.studentId, taskDate: body.taskDate, absent: body.absence });
      return NextResponse.json({ data: { ok: true } });
    }
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

    const teacher = await isTeacherRequest();
    const isDisplay = !teacher && (await isDisplayKeyRequest(request));
    if (!teacher && !isDisplay) {
      return NextResponse.json({ error: "未授權" }, { status: 401 });
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

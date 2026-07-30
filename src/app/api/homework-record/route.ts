import { NextResponse } from "next/server";
import { upsertHomeworkRecord } from "@/services/homeworkService";
import { assertDisplayHomeworkToggleEnabled } from "@/services/displayService";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as {
      homeworkId?: string;
      studentId?: string;
      completed?: boolean;
      displayMode?: boolean;
    };

    if (
      !body.homeworkId ||
      !body.studentId ||
      typeof body.completed !== "boolean"
    ) {
      return NextResponse.json(
        { error: "請提供 homeworkId、studentId、completed" },
        { status: 400 },
      );
    }

    const isDisplay =
      body.displayMode === true ||
      request.headers.get("X-Display-Mode") === "1";
    if (isDisplay) {
      await assertDisplayHomeworkToggleEnabled();
    }

    const data = await upsertHomeworkRecord({
      homeworkId: body.homeworkId,
      studentId: body.studentId,
      completed: body.completed,
    });
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "更新作業紀錄失敗";
    const status =
      message.includes("找不到") || message.includes("尚未開放") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

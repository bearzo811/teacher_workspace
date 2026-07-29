import { NextResponse } from "next/server";
import { upsertHomeworkRecord } from "@/services/homeworkService";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as {
      homeworkId?: string;
      studentId?: string;
      completed?: boolean;
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

    const data = await upsertHomeworkRecord({
      homeworkId: body.homeworkId,
      studentId: body.studentId,
      completed: body.completed,
    });
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "更新作業紀錄失敗";
    const status = message.includes("找不到") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

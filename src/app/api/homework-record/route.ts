import { NextResponse } from "next/server";
import { isDisplayKeyRequest, isTeacherRequest } from "@/lib/access";
import { upsertHomeworkRecord } from "@/services/homeworkService";
import { assertDisplayHomeworkToggleEnabled } from "@/services/displayService";
import { touchDisplayVersion } from "@/services/classSettingsService";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as {
      homeworkId?: string;
      studentId?: string;
      completed?: boolean;
      status?: "unsubmitted" | "pending_confirmation" | "correction_required" | "completed";
      displayMode?: boolean;
    };

    if (
      !body.homeworkId ||
      !body.studentId ||
      typeof body.completed !== "boolean" && body.status === undefined
    ) {
      return NextResponse.json(
        { error: "請提供 homeworkId、studentId、completed 或 status" },
        { status: 400 },
      );
    }

    const teacher = await isTeacherRequest();
    const isDisplay = !teacher && (await isDisplayKeyRequest(request));
    if (!teacher && !isDisplay) {
      return NextResponse.json({ error: "未授權" }, { status: 401 });
    }
    if (isDisplay) {
      await assertDisplayHomeworkToggleEnabled();
      if (body.status && body.status !== "pending_confirmation" && body.status !== "unsubmitted") {
        return NextResponse.json({ error: "大屏只能回報待確認作業" }, { status: 400 });
      }
    }

    const data = await upsertHomeworkRecord({
      homeworkId: body.homeworkId,
      studentId: body.studentId,
      completed: body.completed,
      status: body.status,
      actor: isDisplay ? "student" : "teacher",
    });
    await touchDisplayVersion();
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "更新作業紀錄失敗";
    const status =
      message.includes("找不到") || message.includes("尚未開放") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

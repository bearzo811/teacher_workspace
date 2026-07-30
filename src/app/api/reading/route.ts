import { NextResponse } from "next/server";
import { assertDisplayReadingToggleEnabled } from "@/services/displayService";
import {
  getReadingMatrix,
  upsertReadingStatus,
} from "@/services/readingService";
import { isPassportStatus } from "@/types/passport";
import { isReadingType } from "@/types/reading";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    if (!isReadingType(type)) {
      return NextResponse.json(
        { error: "type 必須是 newspaper 或 reflection" },
        { status: 400 },
      );
    }
    const data = await getReadingMatrix(type);
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "讀取閱讀紀錄失敗";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as {
      studentId?: string;
      type?: string;
      month?: number;
      status?: string;
      displayMode?: boolean;
    };

    if (
      !body.studentId ||
      !isReadingType(body.type) ||
      typeof body.month !== "number" ||
      !isPassportStatus(body.status)
    ) {
      return NextResponse.json(
        {
          error:
            "請提供 studentId、type（newspaper|reflection）、month、status（not_started|missing_parent|completed）",
        },
        { status: 400 },
      );
    }

    const isDisplay =
      body.displayMode === true ||
      request.headers.get("X-Display-Mode") === "1";
    if (isDisplay) {
      await assertDisplayReadingToggleEnabled();
    }

    const data = await upsertReadingStatus({
      studentId: body.studentId,
      type: body.type,
      month: body.month,
      status: body.status,
    });
    return NextResponse.json({ data });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "更新閱讀紀錄失敗";
    const status =
      message.includes("找不到") ||
      message.includes("月份") ||
      message.includes("尚未開放")
        ? 400
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

import { NextResponse } from "next/server";
import {
  getPassportMatrix,
  getPassportWeekView,
  upsertPassportStatus,
  type PassportType,
} from "@/services/passportService";
import { assertDisplayPassportToggleEnabled } from "@/services/displayService";
import { isPassportStatus } from "@/types/passport";

export const dynamic = "force-dynamic";

function parseType(value: string | null): PassportType | null {
  if (value === "Chinese" || value === "English") return value;
  return null;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = parseType(searchParams.get("type"));
    const weekParam = searchParams.get("week");
    const week = weekParam ? Number(weekParam) : undefined;

    if (!type) {
      return NextResponse.json(
        { error: "type 必須是 Chinese 或 English" },
        { status: 400 },
      );
    }
    if (week !== undefined && !Number.isInteger(week)) {
      return NextResponse.json({ error: "week 必須是整數" }, { status: 400 });
    }

    const data =
      week !== undefined
        ? await getPassportWeekView(type, week)
        : await getPassportMatrix(type);

    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "讀取護照失敗";
    const status = message.includes("週數") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as {
      studentId?: string;
      type?: string;
      week?: number;
      status?: string;
      displayMode?: boolean;
    };

    const type = parseType(body.type ?? null);
    if (
      !body.studentId ||
      !type ||
      typeof body.week !== "number" ||
      !isPassportStatus(body.status)
    ) {
      return NextResponse.json(
        {
          error:
            "請提供 studentId、type（Chinese|English）、week（數字）、status（not_started|missing_parent|completed）",
        },
        { status: 400 },
      );
    }

    const isDisplay =
      body.displayMode === true ||
      request.headers.get("X-Display-Mode") === "1";
    if (isDisplay) {
      await assertDisplayPassportToggleEnabled(body.week);
      // 學生大屏：只能 未開始 → 完成；不可退回、不可設缺家長
      if (body.status !== "completed") {
        return NextResponse.json(
          { error: "大屏僅可標記本週護照為完成" },
          { status: 400 },
        );
      }
      const current = await getPassportWeekView(type, body.week);
      const row = current.students.find((s) => s.studentId === body.studentId);
      if (row?.status === "missing_parent") {
        return NextResponse.json(
          { error: "缺家長狀態僅老師可在護照頁修改" },
          { status: 400 },
        );
      }
      if (row?.status === "completed") {
        return NextResponse.json(
          { error: "大屏不可將已完成改回未開始" },
          { status: 400 },
        );
      }
    }

    const data = await upsertPassportStatus({
      studentId: body.studentId,
      type,
      week: body.week,
      status: body.status,
    });
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "更新護照失敗";
    const status =
      message.includes("找不到") ||
      message.includes("週數") ||
      message.includes("尚未開放") ||
      message.includes("只能修改")
        ? 400
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

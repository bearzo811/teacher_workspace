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

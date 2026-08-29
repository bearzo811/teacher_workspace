import { NextResponse } from "next/server";
import {
  getCoursePlanWeek,
  publishCoursePlanDay,
  saveCoursePlanDay,
  type CoursePlanAssignmentInput,
} from "@/services/coursePlanService";
import { touchDisplayVersion } from "@/services/classSettingsService";

export const dynamic = "force-dynamic";

function errorResponse(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  const isInputError =
    message.includes("請") ||
    message.includes("只能") ||
    message.includes("不可") ||
    message.includes("找不到") ||
    message.includes("已有") ||
    message.includes("必須");
  return NextResponse.json(
    { error: message },
    { status: isInputError ? 400 : 500 },
  );
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const weekStart = searchParams.get("weekStart");
    const subject = searchParams.get("subject");
    if (!weekStart || !subject) {
      return NextResponse.json(
        { error: "請提供 weekStart 與 subject" },
        { status: 400 },
      );
    }
    const data = await getCoursePlanWeek({ weekStart, subject });
    return NextResponse.json({ data });
  } catch (error) {
    return errorResponse(error, "讀取課程計劃失敗");
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as {
      date?: string;
      subject?: string;
      unit?: string;
      plannedContent?: string;
      assignments?: CoursePlanAssignmentInput[];
    };
    if (
      !body.date ||
      !body.subject ||
      typeof body.unit !== "string" ||
      typeof body.plannedContent !== "string" ||
      !Array.isArray(body.assignments)
    ) {
      return NextResponse.json(
        { error: "請提供完整的日期、科目、教學內容與作業" },
        { status: 400 },
      );
    }
    const data = await saveCoursePlanDay({
      date: body.date,
      subject: body.subject,
      unit: body.unit,
      plannedContent: body.plannedContent,
      assignments: body.assignments,
    });
    return NextResponse.json({ data });
  } catch (error) {
    return errorResponse(error, "儲存課程計劃失敗");
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      action?: "publish";
      date?: string;
      subject?: string;
    };
    if (body.action !== "publish" || !body.date || !body.subject) {
      return NextResponse.json(
        { error: "請提供 action=publish、date 與 subject" },
        { status: 400 },
      );
    }
    const data = await publishCoursePlanDay({
      date: body.date,
      subject: body.subject,
    });
    await touchDisplayVersion();
    return NextResponse.json({ data });
  } catch (error) {
    return errorResponse(error, "發布作業失敗");
  }
}

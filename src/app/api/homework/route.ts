import { NextResponse } from "next/server";
import {
  createHomeworkItems,
  getHomeworkDayView,
  listAllHomeworkBookProgress,
} from "@/services/homeworkService";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    if (searchParams.get("progress") === "1") {
      const data = await listAllHomeworkBookProgress();
      return NextResponse.json({ data });
    }
    const date = searchParams.get("date") ?? undefined;
    const data = await getHomeworkDayView(date);
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "讀取作業失敗";
    const status =
      message.includes("日期") || message.includes("找不到") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      date?: string;
      assignments?: { bookId: string; pageLabel: string }[];
    };

    if (!Array.isArray(body.assignments)) {
      return NextResponse.json(
        { error: "請提供 assignments（簿本＋頁數）" },
        { status: 400 },
      );
    }

    const data = await createHomeworkItems({
      date: body.date,
      assignments: body.assignments,
    });
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "新增作業失敗";
    const status =
      message.includes("請") ||
      message.includes("已建立") ||
      message.includes("日期") ||
      message.includes("簿本")
        ? 400
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

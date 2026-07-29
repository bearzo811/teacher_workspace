import { NextResponse } from "next/server";
import {
  createHomeworkItems,
  getHomeworkDayView,
} from "@/services/homeworkService";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date") ?? undefined;
    const data = await getHomeworkDayView(date);
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "讀取作業失敗";
    const status = message.includes("日期") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      date?: string;
      title?: string;
      titles?: string[];
    };

    const titles =
      body.titles ??
      (typeof body.title === "string" ? [body.title] : undefined);

    if (!titles || !Array.isArray(titles)) {
      return NextResponse.json(
        { error: "請提供 title 或 titles" },
        { status: 400 },
      );
    }

    const data = await createHomeworkItems({
      date: body.date,
      titles,
    });
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "新增作業失敗";
    const status =
      message.includes("請") || message.includes("已建立") || message.includes("日期")
        ? 400
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

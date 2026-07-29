import { NextResponse } from "next/server";
import {
  getContactBook,
  saveContactBook,
} from "@/services/contactBookService";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");
    if (!date) {
      return NextResponse.json({ error: "請提供 date" }, { status: 400 });
    }
    const data = await getContactBook(date);
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "讀取聯絡簿失敗";
    const status = message.includes("日期") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as {
      date?: string;
      note?: string;
      titles?: string[];
    };
    if (!body.date || !Array.isArray(body.titles)) {
      return NextResponse.json(
        { error: "請提供 date 與 titles 陣列" },
        { status: 400 },
      );
    }
    const data = await saveContactBook({
      date: body.date,
      note: body.note,
      titles: body.titles,
    });
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "儲存聯絡簿失敗";
    const status = message.includes("日期") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

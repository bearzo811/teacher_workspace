import { NextResponse } from "next/server";
import {
  getContactBook,
  copyContactBook,
  saveContactBook,
} from "@/services/contactBookService";
import { touchDisplayVersion } from "@/services/classSettingsService";

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
      notes?: string[];
      note?: string;
      assignments?: { bookId: string; pageLabel: string }[];
      /** @deprecated */
      titles?: string[];
    };
    if (!body.date) {
      return NextResponse.json({ error: "請提供 date" }, { status: 400 });
    }
    if (!Array.isArray(body.assignments)) {
      return NextResponse.json(
        { error: "請提供 assignments 陣列（簿本＋頁數）" },
        { status: 400 },
      );
    }
    const data = await saveContactBook({
      date: body.date,
      notes: body.notes,
      note: body.note,
      assignments: body.assignments,
    });
    await touchDisplayVersion();
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "儲存聯絡簿失敗";
    const status =
      message.includes("日期") || message.includes("簿本") || message.includes("已有學生") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { fromDate?: string; toDate?: string };
    if (!body.fromDate || !body.toDate) return NextResponse.json({ error: "請提供來源與目標日期" }, { status: 400 });
    const data = await copyContactBook({ fromDate: body.fromDate, toDate: body.toDate });
    await touchDisplayVersion();
    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "複製聯絡簿失敗" }, { status: 400 });
  }
}

import { NextResponse } from "next/server";
import { getContactBookTemplate, saveContactBookTemplate } from "@/services/contactBookTemplateService";
export async function GET(request: Request) {
  try { const weekday = Number(new URL(request.url).searchParams.get("weekday")); return NextResponse.json({ data: await getContactBookTemplate(weekday) }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "讀取範本失敗" }, { status: 400 }); }
}
export async function PUT(request: Request) {
  try { const body = await request.json() as { weekday?: number; notes?: string[]; assignments?: { bookId: string; pageLabel: string }[] }; if (typeof body.weekday !== "number" || !Array.isArray(body.notes) || !Array.isArray(body.assignments)) return NextResponse.json({ error: "範本資料格式錯誤" }, { status: 400 }); return NextResponse.json({ data: await saveContactBookTemplate({ weekday: body.weekday, notes: body.notes, assignments: body.assignments }) }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "儲存範本失敗" }, { status: 400 }); }
}

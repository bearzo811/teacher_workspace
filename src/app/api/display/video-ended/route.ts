import { NextResponse } from "next/server";
import { isDisplayKeyRequest } from "@/lib/access";
import { getClassSettings, updateClassSettings } from "@/services/classSettingsService";

export const dynamic = "force-dynamic";

/** 大屏 YouTube 播放完畢時清除影音；比對原始查詢，避免舊影片誤清除新點歌。 */
export async function POST(request: Request) {
  if (!(await isDisplayKeyRequest(request))) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }
  const body = await request.json() as { query?: string };
  const query = body.query?.trim();
  if (!query) return NextResponse.json({ error: "缺少影音內容" }, { status: 400 });
  const settings = await getClassSettings();
  if (settings.lunchVideoQuery !== query) return NextResponse.json({ data: { cleared: false } });
  await updateClassSettings({ lunchVideoQuery: "" });
  return NextResponse.json({ data: { cleared: true } });
}

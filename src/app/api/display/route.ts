import { NextResponse } from "next/server";
import {
  assertDisplayToken,
  getDisplayData,
} from "@/services/displayService";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    await assertDisplayToken(searchParams.get("token"));
    const data = await getDisplayData();
    return NextResponse.json({ data });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "讀取教室大屏失敗";
    const status = message.includes("存取碼") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

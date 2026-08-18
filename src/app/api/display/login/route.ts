import { NextResponse } from "next/server";
import { DISPLAY_SESSION_COOKIE, createSession } from "@/lib/auth";
import { verifyDisplayAccessCode } from "@/services/classSettingsService";

const DISPLAY_SESSION_MAX_AGE = 12 * 60 * 60;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { code?: string };
    if (typeof body.code !== "string" || !(await verifyDisplayAccessCode(body.code))) {
      return NextResponse.json({ error: "大屏存取碼錯誤" }, { status: 401 });
    }
    const response = NextResponse.json({ ok: true });
    response.cookies.set(DISPLAY_SESSION_COOKIE, await createSession("display", DISPLAY_SESSION_MAX_AGE), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: DISPLAY_SESSION_MAX_AGE,
    });
    return response;
  } catch {
    return NextResponse.json({ error: "大屏登入請求格式錯誤" }, { status: 400 });
  }
}

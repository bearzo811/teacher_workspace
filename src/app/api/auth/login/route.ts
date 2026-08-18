import { NextResponse } from "next/server";
import { TEACHER_SESSION_COOKIE, createSession } from "@/lib/auth";

const TEACHER_SESSION_MAX_AGE = 8 * 60 * 60;

function safeEqual(left: string, right: string) {
  const a = new TextEncoder().encode(left);
  const b = new TextEncoder().encode(right);
  let diff = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) diff |= (a[index] ?? 0) ^ (b[index] ?? 0);
  return diff === 0;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { password?: string };
    const expected = process.env.TEACHER_PASSWORD;
    if (!expected || expected.length < 12) {
      return NextResponse.json({ error: "教師登入尚未設定" }, { status: 503 });
    }
    if (typeof body.password !== "string" || !safeEqual(body.password, expected)) {
      return NextResponse.json({ error: "密碼錯誤" }, { status: 401 });
    }
    const response = NextResponse.json({ ok: true });
    response.cookies.set(TEACHER_SESSION_COOKIE, await createSession("teacher", TEACHER_SESSION_MAX_AGE), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: TEACHER_SESSION_MAX_AGE,
    });
    return response;
  } catch {
    return NextResponse.json({ error: "登入請求格式錯誤" }, { status: 400 });
  }
}

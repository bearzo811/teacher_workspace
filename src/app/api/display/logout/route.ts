import { NextResponse } from "next/server";
import { DISPLAY_SESSION_COOKIE } from "@/lib/auth";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(DISPLAY_SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return response;
}

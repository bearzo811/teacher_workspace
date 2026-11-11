import { NextResponse } from "next/server";
import { serverClient } from "../../../lib/supabase";
import { PILOT_SITE_URL } from "../../../lib/config";

export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get("code");
  let ok = false;
  try {
    if (code) {
      const client = await serverClient(true);
      const { error } = await client.auth.exchangeCodeForSession(code);
      ok = !error;
    }
  } catch { /* Do not expose provider errors, tokens or configuration. */ }
  // No next= redirect, forwarded-host trust, or user-controlled external URL.
  const response = NextResponse.redirect(new URL(ok ? "/workspace" : "/login?error=callback", PILOT_SITE_URL));
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { pilotConfig, pilotCookieOptions } from "./lib/config";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  // Do not connect anywhere if the independent environment is not configured.
  try {
    const { url, key } = pilotConfig();
    const client = createServerClient(url, key, {
      cookieOptions: pilotCookieOptions(),
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(values) {
          for (const { name, value } of values) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of values) response.cookies.set(name, value, options);
        },
      },
    });
    await client.auth.getClaims();
  } catch {
    // Protected pages revalidate and deny access; never substitute legacy auth.
  }
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Pragma", "no-cache");
  return response;
}

export const config = { matcher: ["/login", "/workspace/:path*", "/auth/:path*"] };

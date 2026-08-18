import { NextResponse, type NextRequest } from "next/server";
import { TEACHER_SESSION_COOKIE, hasTeacherSession } from "@/lib/auth";

const PUBLIC_PATHS = ["/login", "/display", "/api/auth", "/api/display"];
const DISPLAY_API_PATHS = [
  "/api/calendar",
  "/api/homework-record",
  "/api/passport",
  "/api/reading",
  "/api/routines",
];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isPublicPath(pathname) || DISPLAY_API_PATHS.includes(pathname)) {
    return NextResponse.next();
  }

  const authenticated = await hasTeacherSession(
    request.cookies.get(TEACHER_SESSION_COOKIE)?.value,
  );
  if (authenticated) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "請先以老師身分登入" }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

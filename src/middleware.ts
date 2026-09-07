import { NextResponse, type NextRequest } from "next/server";
import { TEACHER_SESSION_COOKIE, hasTeacherSession } from "@/lib/auth";

const PUBLIC_PATHS = ["/login", "/display", "/api/auth", "/api/display"];
const DISPLAY_API_PATHS = [
  "/api/calendar",
  "/api/homework-record",
  "/api/passport",
  "/api/reading",
  "/api/routines",
  // 此班級網站僅供教室使用：學生可直接在大屏兌換商品／申請使用背包。
  // 商品管理、贈送與核銷仍會在 shop route 中要求教師登入。
  "/api/shop",
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

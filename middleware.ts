import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const AUTH_COOKIE = "dashboard_auth";
const PUBLIC_PATHS = ["/login", "/api/webhooks/resend", "/api/cron/process-queue"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) {
    return NextResponse.next();
  }

  const auth = request.cookies.get(AUTH_COOKIE)?.value;
  if (auth === password) {
    return NextResponse.next();
  }

  if (pathname === "/login") {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("from", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

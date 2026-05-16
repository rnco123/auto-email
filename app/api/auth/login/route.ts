import { NextRequest, NextResponse } from "next/server";

const AUTH_COOKIE = "dashboard_auth";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const password = body.password as string;
  const expected = process.env.DASHBOARD_PASSWORD;

  if (!expected || password !== expected) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(AUTH_COOKIE, password, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}

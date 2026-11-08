import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, SESSION_COOKIE_VALUE } from "@/lib/auth/session";

export async function GET(request: NextRequest) {
  const rawNext = request.nextUrl.searchParams.get("next") ?? "/fila";
  const safeNext =
    rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/fila";

  const host = request.headers.get("host") ?? "127.0.0.1:3105";
  const proto = request.headers.get("x-forwarded-proto") ?? "http";
  const targetUrl = new URL(safeNext, `${proto}://${host}`);
  const response = NextResponse.redirect(targetUrl);

  response.cookies.set(SESSION_COOKIE_NAME, SESSION_COOKIE_VALUE, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 12,
  });

  return response;
}

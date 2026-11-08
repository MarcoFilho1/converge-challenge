import { NextResponse, type NextRequest } from "next/server";
import { isAuthenticated, isPublicPath } from "@/lib/auth/session";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    const res = NextResponse.next();
    res.headers.set("X-Content-Type-Options", "nosniff");
    res.headers.set("X-Frame-Options", "SAMEORIGIN");
    res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    return res;
  }

  if (!isAuthenticated(request.cookies)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  const res = NextResponse.next();
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "SAMEORIGIN");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

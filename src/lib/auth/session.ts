export const SESSION_COOKIE_NAME = "session";
export const SESSION_COOKIE_VALUE = "ok";

export interface CookieReader {
  get(name: string): { value: string } | undefined;
}

export function isAuthenticated(cookies: CookieReader): boolean {
  const sessionCookie = cookies.get(SESSION_COOKIE_NAME);
  return sessionCookie?.value === SESSION_COOKIE_VALUE;
}

export function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return true;
  if (pathname === "/brand/workplace-conversation.jpg") return true;
  if (pathname === "/login") return true;
  if (pathname === "/brand/praevenius-mark.png" || pathname === "/brand/praevenius-logo.png") return true;
  if (pathname === "/api/auth/demo-session") return true;
  if (pathname.startsWith("/api/webhook/")) return true;
  // Entrada dos participantes (escolha do canal) e o estado dos canais que ela consulta.
  if (pathname === "/entrar" || pathname.startsWith("/entrar/")) return true;
  if (pathname === "/api/canais") return true;
  if (pathname === "/entrevista" || pathname.startsWith("/entrevista/")) return true;
  if (pathname.startsWith("/api/entrevista/")) return true;
  if (pathname.startsWith("/_next/") || pathname === "/favicon.ico") return true;
  return false;
}

import { json } from "./http";

/** Guard provisório do médico: mesmo cookie `session=ok` da tela de login (T11). Fica redundante quando o middleware chegar. */
export function requireDoctor(req: Request): Response | null {
  const cookie = req.headers.get("cookie") ?? "";
  const ok = cookie.split(";").some((part) => part.trim() === "session=ok");
  return ok ? null : json({ error: "nao_autenticado" }, 401);
}

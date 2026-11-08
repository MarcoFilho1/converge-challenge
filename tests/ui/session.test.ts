import { describe, expect, it } from "vitest";
import { isAuthenticated, isPublicPath, SESSION_COOKIE_NAME, SESSION_COOKIE_VALUE } from "@/lib/auth/session";

describe("sessão e proteção de rotas (T11 + M11)", () => {
  it("reconhece sessão autenticada com cookie session=ok", () => {
    expect(
      isAuthenticated({
        get: (name: string) => (name === SESSION_COOKIE_NAME ? { value: SESSION_COOKIE_VALUE } : undefined),
      }),
    ).toBe(true);
  });

  it("rejeita ausência de cookie ou valor inválido", () => {
    expect(isAuthenticated({ get: () => undefined })).toBe(false);
    expect(isAuthenticated({ get: () => ({ value: "invalido" }) })).toBe(false);
  });

  it("libera rotas públicas (/login, /api/webhook/*, /entrevista/*, /api/entrevista/*) e protege as rotas do médico", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/api/webhook/whatsapp")).toBe(true);
    expect(isPublicPath("/entrevista/token-123")).toBe(true);
    expect(isPublicPath("/api/entrevista/token-123/turno")).toBe(true);

    expect(isPublicPath("/fila")).toBe(false);
    expect(isPublicPath("/conexao")).toBe(false);
    expect(isPublicPath("/contatos")).toBe(false);
    expect(isPublicPath("/caso/run-1")).toBe(false);
    expect(isPublicPath("/api/medico/entrevista/123")).toBe(false);
  });
});

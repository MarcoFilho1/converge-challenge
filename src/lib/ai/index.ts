import { createGatewayProvider } from "./gateway";
import { createMockProvider } from "./mock";
import type { AiProvider } from "./types";

export * from "./types";
export { assertNoForbidden, FORBIDDEN_TERMS, FORBIDDEN_REPLACEMENT } from "./forbidden-terms";

let cached: { mode: string; provider: AiProvider } | null = null;

/** AI_PROVIDER=mock (padrão, sem chave) ou gateway (Vercel AI Gateway, precisa de AI_GATEWAY_API_KEY). */
export function getAi(): AiProvider {
  const mode = process.env.AI_PROVIDER === "gateway" ? "gateway" : "mock";
  if (cached?.mode !== mode) {
    cached = { mode, provider: mode === "gateway" ? createGatewayProvider() : createMockProvider() };
  }
  return cached.provider;
}

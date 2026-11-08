import { createGatewayProvider } from "./gateway";
import { createMockProvider } from "./mock";
import type { AiProvider } from "./types";

export * from "./types";
export { assertNoForbidden, FORBIDDEN_TERMS, FORBIDDEN_REPLACEMENT } from "./forbidden-terms";

let cached: { mode: string; provider: AiProvider } | null = null;

/**
 * AI_PROVIDER=featherless (chaves FEATHERLESS_API_KEY_1, _2…) ou gateway (AI_GATEWAY_API_KEY) usam o modelo real,
 * com troca automática de chave e modelo (src/lib/ai/llm.ts). Qualquer outro valor usa o modo simulado.
 */
export function aiMode(env: Record<string, string | undefined> = process.env): "real" | "mock" {
  return env.AI_PROVIDER === "featherless" || env.AI_PROVIDER === "gateway" ? "real" : "mock";
}

export function getAi(): AiProvider {
  const mode = aiMode();
  if (cached?.mode !== mode) {
    cached = { mode, provider: mode === "real" ? createGatewayProvider() : createMockProvider() };
  }
  return cached.provider;
}

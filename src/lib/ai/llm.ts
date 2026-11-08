/**
 * De onde vem o modelo de linguagem, com troca automática.
 *
 * Featherless (FEATHERLESS_API_KEY_1, _2, …): cada modelo (AI_CHAT_MODEL e AI_CHAT_MODEL_FALLBACK)
 * é tentado com cada chave, nessa ordem. Chave sem crédito é aposentada até o servidor reiniciar;
 * qualquer outro erro (fora do ar, demora, JSON fora do esquema) só passa para o próximo alvo.
 * Sem chave da Featherless, usa o AI Gateway com AI_CHAT_MODEL, como antes.
 */
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";

export type ChatTarget = { label: string; key: string; model: LanguageModel };

const FEATHERLESS_URL = "https://api.featherless.ai/v1";
const DEFAULT_GATEWAY_MODEL = "anthropic/claude-sonnet-5-5";
const DEFAULT_FEATHERLESS_MODEL = "moonshotai/Kimi-K2-Instruct-0905";

type Env = Record<string, string | undefined>;

/** Chaves da Featherless em ordem: FEATHERLESS_API_KEY, FEATHERLESS_API_KEY_1, FEATHERLESS_API_KEY_2, … */
export function featherlessKeys(env: Env = process.env): string[] {
  const numbered = Object.keys(env)
    .map((k) => /^FEATHERLESS_API_KEY_(\d+)$/.exec(k))
    .filter((m): m is RegExpExecArray => !!m)
    .sort((a, b) => Number(a[1]) - Number(b[1]))
    .map((m) => env[m[0]]);
  return [env.FEATHERLESS_API_KEY, ...numbered].filter((k): k is string => !!k && k.trim() !== "");
}

/** Há algum modelo real configurado (Featherless ou AI Gateway)? */
export function hasChatKey(env: Env = process.env): boolean {
  return featherlessKeys(env).length > 0 || !!env.AI_GATEWAY_API_KEY;
}

export function chatTargets(env: Env = process.env): ChatTarget[] {
  const keys = featherlessKeys(env);
  if (keys.length === 0) {
    const model = env.AI_CHAT_MODEL ?? DEFAULT_GATEWAY_MODEL;
    return [{ label: `gateway:${model}`, key: "gateway", model }];
  }
  const models = [env.AI_CHAT_MODEL ?? DEFAULT_FEATHERLESS_MODEL, env.AI_CHAT_MODEL_FALLBACK].filter(
    (m, i, all): m is string => !!m && all.indexOf(m) === i,
  );
  return models.flatMap((modelId) =>
    keys.map((key, i) => ({
      label: `featherless:${modelId}#${i + 1}`,
      key,
      model: createOpenAICompatible({
        name: "featherless",
        baseURL: FEATHERLESS_URL,
        apiKey: key,
        includeUsage: true,
        supportsStructuredOutputs: true,
      }).chatModel(modelId),
    })),
  );
}

/** Chave sem crédito, cota esgotada ou recusada: não adianta tentar de novo com ela. */
export function isCreditError(err: unknown): boolean {
  const e = err as { statusCode?: number; status?: number; message?: string; responseBody?: string } | null;
  const status = e?.statusCode ?? e?.status;
  const text = `${e?.message ?? ""} ${e?.responseBody ?? ""}`.toLowerCase();
  if (status === 401 || status === 402) return true;
  return status === 403 && /(credit|balance|quota|insufficient|payment|billing)/.test(text);
}

const exhausted = new Set<string>();

/** Só para testes: esquece as chaves aposentadas. */
export function resetExhaustedKeys() {
  exhausted.clear();
}

/**
 * Roda a chamada no primeiro alvo que funcionar. Lança o último erro se todos falharem
 * (quem chama decide o caminho simulado).
 */
export async function withChat<T>(run: (model: LanguageModel, target: ChatTarget) => Promise<T>, targets: ChatTarget[] = chatTargets()): Promise<T> {
  let last: unknown = new Error("Nenhuma chave de IA disponível.");
  for (const target of targets) {
    if (exhausted.has(target.key)) continue;
    try {
      return await run(target.model, target);
    } catch (err) {
      last = err;
      if (isCreditError(err)) {
        exhausted.add(target.key);
        console.warn(`[ia] ${target.label} sem crédito ou recusada; trocando de chave`);
      } else {
        console.warn(`[ia] ${target.label} falhou; tentando o próximo`, err instanceof Error ? err.message : err);
      }
    }
  }
  throw last;
}

/** Limite de tempo de cada tentativa. A troca de alvo faz o papel da retentativa. */
export const chatCallOptions = () => ({
  maxRetries: 0,
  abortSignal: AbortSignal.timeout(Number(process.env.AI_CALL_TIMEOUT_MS ?? 15_000)),
});

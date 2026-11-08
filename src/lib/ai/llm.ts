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
import { recordEvent, type EventOutcome } from "@/lib/obs/events";

export type ChatTarget = { label: string; key: string; model: LanguageModel };

const FEATHERLESS_URL = "https://api.featherless.ai/v1";
const DEFAULT_GATEWAY_MODEL = "anthropic/claude-sonnet-5-5";
const DEFAULT_FEATHERLESS_MODEL = "moonshotai/Kimi-K2-Instruct-0905";
const DEFAULT_FAST_MODEL = "deepseek-ai/DeepSeek-V3-0324";

/** fast: respostas curtas no meio da conversa (interpretar, reagir, extrair). long: resumo e classificação. */
export type ChatPurpose = "fast" | "long";

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

export function chatTargets(env: Env = process.env, purpose: ChatPurpose = "long"): ChatTarget[] {
  const keys = featherlessKeys(env);
  if (keys.length === 0) {
    const model = env.AI_CHAT_MODEL ?? DEFAULT_GATEWAY_MODEL;
    return [{ label: `gateway:${model}`, key: "gateway", model }];
  }
  const main = env.AI_CHAT_MODEL ?? DEFAULT_FEATHERLESS_MODEL;
  const ordered = purpose === "fast" ? [env.AI_FAST_MODEL ?? DEFAULT_FAST_MODEL, env.AI_FAST_MODEL_FALLBACK, main] : [main, env.AI_CHAT_MODEL_FALLBACK];
  const models = ordered.filter(
    (m, i, all): m is string => !!m && all.indexOf(m) === i,
  );
  const make = (modelId: string, key: string, i: number): ChatTarget => ({
    label: `featherless:${modelId}#${i + 1}`,
    key,
    model: createOpenAICompatible({
      name: "featherless",
      baseURL: FEATHERLESS_URL,
      apiKey: key,
      includeUsage: true,
      supportsStructuredOutputs: true,
    }).chatModel(modelId),
  });
  // Tarefa rápida: alterna os modelos antes de trocar de chave (modelo lento na hora não melhora com outra chave).
  if (purpose === "fast") return keys.flatMap((key, i) => models.map((modelId) => make(modelId, key, i)));
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

function failureOutcome(err: unknown): EventOutcome {
  if (isCreditError(err)) return "sem_credito";
  const e = err as { name?: string; message?: string } | null;
  return e?.name === "TimeoutError" || e?.name === "AbortError" || /timeout|aborted/i.test(e?.message ?? "") ? "tempo_esgotado" : "erro";
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
export async function withChat<T>(
  run: (model: LanguageModel, target: ChatTarget) => Promise<T>,
  targetsOrPurpose: ChatTarget[] | ChatPurpose = "long",
  stage = "outros",
  budget?: { attemptMs: number; budgetMs: number; clock?: () => number },
): Promise<T> {
  const targets = Array.isArray(targetsOrPurpose) ? targetsOrPurpose : chatTargets(process.env, targetsOrPurpose);
  // Tarefa rápida tem teto total: a conversa não pode esperar uma fila de tentativas lentas.
  const limit = budget ?? (targetsOrPurpose === "fast" ? fastBudget() : undefined);
  const clock = limit?.clock ?? Date.now;
  const started = clock();
  let last: unknown = new Error("Nenhuma chave de IA disponível.");
  for (const target of targets) {
    if (exhausted.has(target.key)) continue;
    if (limit && clock() - started + limit.attemptMs > limit.budgetMs) break;
    const t0 = Date.now();
    try {
      const result = await run(target.model, target);
      recordCost(stage, result);
      const usage = (result as { usage?: { inputTokens?: number; outputTokens?: number; raw?: { cost?: unknown } } } | null)?.usage;
      recordEvent({
        kind: stage,
        outcome: "ok",
        model: target.label,
        tokensIn: usage?.inputTokens ?? null,
        tokensOut: usage?.outputTokens ?? null,
        costUsd: typeof usage?.raw?.cost === "number" ? usage.raw.cost : null,
        latencyMs: Date.now() - t0,
      });
      return result;
    } catch (err) {
      last = err;
      recordEvent({ kind: stage, outcome: failureOutcome(err), model: target.label, latencyMs: Date.now() - t0, detail: err instanceof Error ? err.message : String(err) });
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

/**
 * Limite de tempo de cada tentativa: 8 s para tarefa rápida (AI_FAST_TIMEOUT_MS), 45 s para resumo e
 * classificação (AI_CALL_TIMEOUT_MS). A troca de alvo faz o papel da retentativa.
 */
export function chatCallOptions(purpose: ChatPurpose = "long", env: Env = process.env) {
  const timeoutMs = Number(purpose === "fast" ? (env.AI_FAST_TIMEOUT_MS ?? 7_000) : (env.AI_CALL_TIMEOUT_MS ?? 45_000));
  return { maxRetries: 0, abortSignal: AbortSignal.timeout(timeoutMs), timeoutMs };
}

/** Teto da tarefa rápida: AI_FAST_BUDGET_MS (padrão 15 s, duas tentativas de 7 s), com tentativas do tamanho de AI_FAST_TIMEOUT_MS. */
function fastBudget(env: Env = process.env): { attemptMs: number; budgetMs: number; clock?: () => number } {
  return { attemptMs: chatCallOptions("fast", env).timeoutMs, budgetMs: Number(env.AI_FAST_BUDGET_MS ?? 15_000) };
}

/** Custo em dólar que a Featherless devolve em cada chamada (usage.raw.cost), somado por etapa. */
const costs = new Map<string, { calls: number; usd: number }>();
function recordCost(stage: string, result: unknown) {
  const cost = (result as { usage?: { raw?: { cost?: unknown } } } | null)?.usage?.raw?.cost;
  const c = costs.get(stage) ?? { calls: 0, usd: 0 };
  c.calls += 1;
  if (typeof cost === "number") c.usd = Math.round((c.usd + cost) * 1e9) / 1e9;
  costs.set(stage, c);
}
export function costTotals(): Record<string, { calls: number; usd: number }> {
  return Object.fromEntries([...costs.entries()].map(([k, v]) => [k, { ...v }]));
}
export function resetCostTotals() {
  costs.clear();
}

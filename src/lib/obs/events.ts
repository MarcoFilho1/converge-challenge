/**
 * Grava um evento do rastro sem atrasar a conversa e sem nunca lançar erro.
 * settleEvents espera as gravações pendentes (testes e scripts).
 */
import { obsContext } from "./context";

export type EventOutcome = "ok" | "modo_simples" | "tempo_esgotado" | "sem_credito" | "erro" | "descartado";

export type EventInput = {
  kind: string;
  outcome: EventOutcome;
  model?: string | null;
  tokensIn?: number | null;
  tokensOut?: number | null;
  costUsd?: number | null;
  latencyMs?: number | null;
  detail?: string | null;
  runId?: string | null;
  interviewId?: string | null;
  answerId?: string | null;
  waMessageId?: string | null;
};

const pending = new Set<Promise<void>>();

export function recordEvent(e: EventInput): void {
  if (process.env.OBS_DISABLED === "true") return;
  const ctx = obsContext();
  const row = {
    // hora do passo, não da gravação (as gravações são em paralelo e podem chegar fora de ordem)
    createdAt: new Date(),
    runId: e.runId ?? ctx.runId ?? null,
    interviewId: e.interviewId ?? ctx.interviewId ?? null,
    answerId: e.answerId ?? ctx.answerId ?? null,
    waMessageId: e.waMessageId ?? ctx.waMessageId ?? null,
    kind: e.kind,
    outcome: e.outcome,
    model: e.model ?? null,
    tokensIn: e.tokensIn ?? null,
    tokensOut: e.tokensOut ?? null,
    costUsd: e.costUsd ?? null,
    latencyMs: e.latencyMs === undefined || e.latencyMs === null ? null : Math.round(e.latencyMs),
    detail: e.detail ? e.detail.slice(0, 300) : null,
  };
  const p = (async () => {
    try {
      const { db } = await import("@/db/client");
      const { agentEvents } = await import("@/db/schema");
      await db.insert(agentEvents).values(row);
    } catch (err) {
      console.warn("[rastro] não consegui gravar o evento", e.kind, err instanceof Error ? err.message : err);
    }
  })();
  pending.add(p);
  p.finally(() => pending.delete(p));
}

export async function settleEvents(): Promise<void> {
  while (pending.size > 0) await Promise.allSettled([...pending]);
}

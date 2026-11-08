import { desc } from "drizzle-orm";
import { db } from "@/db/client";
import { agentEvents } from "@/db/schema";
import { computeMetrics, type Metrics } from "./metrics";

/** Métricas dos últimos 20 mil eventos do rastro. Sem a tabela ainda: tudo zerado. */
export async function loadMetrics(): Promise<{ metrics: Metrics; since: string | null; events: number }> {
  try {
    const rows = await db
      .select({
        kind: agentEvents.kind,
        outcome: agentEvents.outcome,
        model: agentEvents.model,
        costUsd: agentEvents.costUsd,
        latencyMs: agentEvents.latencyMs,
        runId: agentEvents.runId,
        interviewId: agentEvents.interviewId,
        tokensIn: agentEvents.tokensIn,
        tokensOut: agentEvents.tokensOut,
        waMessageId: agentEvents.waMessageId,
        detail: agentEvents.detail,
        createdAt: agentEvents.createdAt,
      })
      .from(agentEvents)
      .orderBy(desc(agentEvents.createdAt))
      .limit(20_000);
    return { metrics: computeMetrics(rows), since: rows.at(-1)?.createdAt.toISOString() ?? null, events: rows.length };
  } catch (err) {
    console.warn("[medição] rastro indisponível", err instanceof Error ? err.message : err);
    return { metrics: computeMetrics([]), since: null, events: 0 };
  }
}

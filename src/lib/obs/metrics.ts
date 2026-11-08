/**
 * Números da página Medição, calculados a partir do rastro do agente.
 */
export type MetricEvent = {
  kind: string;
  outcome: string;
  model: string | null;
  costUsd: number | null;
  latencyMs: number | null;
  runId: string | null;
  interviewId: string | null;
};

export type StageMetric = { kind: string; calls: number; failures: number; fallbacks: number; p50Ms: number | null; p95Ms: number | null; costUsd: number };

export type Metrics = {
  totalCost: number;
  /** Chamadas que foram de fato a um modelo de IA. */
  aiCalls: number;
  questionnaires: number;
  interviews: number;
  costPerQuestionnaire: number | null;
  costPerInterview: number | null;
  stages: StageMetric[];
  models: { model: string; calls: number; costUsd: number }[];
};

const round = (n: number) => Math.round(n * 1e6) / 1e6;

/** Percentil pelo método do posto mais próximo, sobre as chamadas que deram certo. */
function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
}

/** "featherless:moonshotai/Kimi-K2-Instruct-0905#2" → "moonshotai/Kimi-K2-Instruct-0905". */
const modelName = (label: string) => label.replace(/^[a-z]+:/, "").replace(/#\d+$/, "");
const isModelCall = (e: MetricEvent) => !!e.model && /^(featherless|gateway):/.test(e.model);

export function computeMetrics(events: MetricEvent[]): Metrics {
  const cost = (e: MetricEvent) => e.costUsd ?? 0;
  const qEvents = events.filter((e) => e.runId && !e.interviewId);
  const iEvents = events.filter((e) => e.interviewId);
  const qRuns = new Set(qEvents.map((e) => e.runId));
  const iIds = new Set(iEvents.map((e) => e.interviewId));
  const qCost = qEvents.reduce((a, e) => a + cost(e), 0);
  const iCost = iEvents.reduce((a, e) => a + cost(e), 0);

  const byKind = new Map<string, MetricEvent[]>();
  for (const e of events.filter((x) => isModelCall(x) || x.outcome === "modo_simples")) byKind.set(e.kind, [...(byKind.get(e.kind) ?? []), e]);
  const stages: StageMetric[] = [...byKind.entries()]
    .map(([kind, list]) => {
      const calls = list.filter((e) => e.outcome !== "modo_simples");
      const ok = calls.filter((e) => e.outcome === "ok" && e.latencyMs !== null).map((e) => e.latencyMs!);
      return {
        kind,
        calls: calls.length,
        failures: calls.filter((e) => e.outcome === "tempo_esgotado" || e.outcome === "erro" || e.outcome === "sem_credito").length,
        fallbacks: list.filter((e) => e.outcome === "modo_simples").length,
        p50Ms: percentile(ok, 50),
        p95Ms: percentile(ok, 95),
        costUsd: round(list.reduce((a, e) => a + cost(e), 0)),
      };
    })
    .sort((a, b) => b.costUsd - a.costUsd || b.calls - a.calls);

  const byModel = new Map<string, { calls: number; costUsd: number }>();
  for (const e of events.filter(isModelCall)) {
    const name = modelName(e.model!);
    const m = byModel.get(name) ?? { calls: 0, costUsd: 0 };
    m.calls += 1;
    m.costUsd = round(m.costUsd + cost(e));
    byModel.set(name, m);
  }

  return {
    aiCalls: events.filter(isModelCall).length,
    totalCost: round(qCost + iCost + events.filter((e) => !e.runId && !e.interviewId).reduce((a, e) => a + cost(e), 0)),
    questionnaires: qRuns.size,
    interviews: iIds.size,
    costPerQuestionnaire: qRuns.size ? round(qCost / qRuns.size) : null,
    costPerInterview: iIds.size ? round(iCost / iIds.size) : null,
    stages,
    models: [...byModel.entries()].map(([model, v]) => ({ model, ...v })).sort((a, b) => b.costUsd - a.costUsd),
  };
}

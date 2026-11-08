import { describe, expect, it } from "vitest";
import { computeMetrics, type MetricEvent } from "@/lib/obs/metrics";

const ev = (e: Partial<MetricEvent>): MetricEvent => ({
  kind: "classificar", outcome: "ok", model: "featherless:m#1", costUsd: 0, latencyMs: 0, runId: null, interviewId: null, ...e,
});

describe("métricas do agente", () => {
  it("custo médio por questionário e por entrevista, e custo por atendimento", () => {
    const m = computeMetrics([
      ev({ kind: "classificar", runId: "r1", costUsd: 0.01 }),
      ev({ kind: "resumo do questionário", runId: "r1", costUsd: 0.004 }),
      ev({ kind: "classificar", runId: "r2", costUsd: 0.006 }),
      ev({ kind: "extrair da fala", interviewId: "i1", runId: "r1", costUsd: 0.003 }),
      ev({ kind: "resumo da entrevista", interviewId: "i1", runId: "r1", costUsd: 0.005 }),
    ]);
    expect(m.questionnaires).toBe(2);
    expect(m.interviews).toBe(1);
    expect(m.costPerQuestionnaire).toBeCloseTo(0.01);
    expect(m.costPerInterview).toBeCloseTo(0.008);
    expect(m.totalCost).toBeCloseTo(0.028);
  });

  it("por etapa: chamadas, mediana e pior tempo (p95), custo e taxa de modo simples", () => {
    const m = computeMetrics([
      ev({ kind: "reação da Helena", latencyMs: 1000 }),
      ev({ kind: "reação da Helena", latencyMs: 2000 }),
      ev({ kind: "reação da Helena", latencyMs: 3000 }),
      ev({ kind: "reação da Helena", latencyMs: 9000, outcome: "tempo_esgotado" }),
      ev({ kind: "reação da Helena", outcome: "modo_simples", model: null }),
    ]);
    const s = m.stages.find((x) => x.kind === "reação da Helena")!;
    expect(s.calls).toBe(4);
    expect(s.p50Ms).toBe(2000);
    expect(s.p95Ms).toBe(3000);
    expect(s.failures).toBe(1);
    expect(s.fallbacks).toBe(1);
  });

  it("chamadas por modelo, só as que foram ao modelo", () => {
    const m = computeMetrics([
      ev({ model: "featherless:moonshotai/Kimi-K2-Instruct-0905#1", costUsd: 0.002 }),
      ev({ model: "featherless:moonshotai/Kimi-K2-Instruct-0905#2", costUsd: 0.001 }),
      ev({ model: "regra local", kind: "valor da resposta" }),
    ]);
    expect(m.models).toEqual([{ model: "moonshotai/Kimi-K2-Instruct-0905", calls: 2, costUsd: 0.003 }]);
  });
});

describe("decisões em código não contam como chamada de IA", () => {
  it("etapas e chamadas só com o que foi ao modelo ou caiu no modo simples", () => {
    const m = computeMetrics([
      ev({ kind: "classificar", model: "featherless:m#1", costUsd: 0.001, latencyMs: 2000 }),
      ev({ kind: "gravidade", model: "regra em código" }),
      ev({ kind: "convite", model: "regra em código" }),
      ev({ kind: "valor da resposta", model: "regra local" }),
      ev({ kind: "indício", model: null }),
      ev({ kind: "resumo do questionário", model: null, outcome: "modo_simples" }),
    ]);
    expect(m.aiCalls).toBe(1);
    expect(m.stages.map((s) => s.kind).sort()).toEqual(["classificar", "resumo do questionário"]);
  });
});

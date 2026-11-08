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
    expect(m.models).toHaveLength(1);
    expect(m.models[0]).toMatchObject({ model: "moonshotai/Kimi-K2-Instruct-0905", calls: 2, costUsd: 0.003 });
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

describe("seção WhatsApp da Medição", () => {
  const msg = (id: string, via: "texto" | "áudio", ms: number) => ev({ kind: "resposta no WhatsApp", model: null, waMessageId: id, latencyMs: ms, detail: `${via} · 1 mensagem · answer`, runId: "r1" });
  it("mensagens, áudios, custo e chamadas por mensagem, tempo de resposta e como as respostas foram lidas", () => {
    const m = computeMetrics([
      msg("w1", "texto", 2000),
      ev({ kind: "ler resposta", waMessageId: "w1", costUsd: 0.0008, tokensIn: 700, tokensOut: 40, runId: "r1" }),
      ev({ kind: "valor da resposta", model: "IA", waMessageId: "w1", detail: "“uns 7” → 7 (IA)", runId: "r1" }),
      msg("w2", "áudio", 8000),
      ev({ kind: "transcrição do áudio", model: "Whisper (Voicebox)", waMessageId: "w2", latencyMs: 6000, runId: "r1" }),
      ev({ kind: "ler resposta", waMessageId: "w2", costUsd: 0.0010, tokensIn: 800, tokensOut: 60, runId: "r1" }),
      ev({ kind: "valor da resposta", model: "IA", waMessageId: "w2", detail: "“bastante” → 8? (IA, pediu confirmação)", runId: "r1" }),
      msg("w3", "texto", 30),
      ev({ kind: "valor da resposta", model: "regra em código", waMessageId: "w3", detail: "Confirmou 8 para WPAI_Q5", runId: "r1" }),
      msg("w4", "texto", 1500),
      ev({ kind: "valor da resposta", model: "regra local", outcome: "descartado", waMessageId: "w4", detail: "“4” → sem valor (regra local)", runId: "r1" }),
      ev({ kind: "transcrição do áudio", model: null, outcome: "erro", waMessageId: "w5", runId: "r1" }),
    ]);
    expect(m.whatsapp).toMatchObject({ messages: 4, audio: 1, transcriptionFailures: 1, readings: 3 });
    expect(m.whatsapp.costPerMessage).toBeCloseTo(0.00045);
    expect(m.whatsapp.aiCallsPerMessage).toBeCloseTo(0.5);
    expect(m.whatsapp.replyP50Ms).toBe(1500);
    expect(m.whatsapp.replyP95Ms).toBe(8000);
    expect(m.whatsapp.firstTime).toBeCloseTo(1 / 3);
    expect(m.whatsapp.confirmed).toBeCloseTo(1 / 3);
    expect(m.whatsapp.rejected).toBeCloseTo(1 / 3);
    expect(m.whatsapp.localRule).toBeCloseTo(1 / 3);
  });

  it("por modelo: tokens de entrada e saída e custo por mil tokens", () => {
    const m = computeMetrics([
      ev({ model: "featherless:moonshotai/Kimi#1", costUsd: 0.0008, tokensIn: 700, tokensOut: 100 }),
      ev({ model: "featherless:moonshotai/Kimi#2", costUsd: 0.0008, tokensIn: 700, tokensOut: 100 }),
    ]);
    expect(m.models[0]).toMatchObject({ model: "moonshotai/Kimi", calls: 2, tokensIn: 1400, tokensOut: 200 });
    expect(m.models[0].usdPer1kTokens).toBeCloseTo(0.001);
  });

  it("sem mensagens: tudo vazio, sem dividir por zero", () => {
    const m = computeMetrics([]);
    expect(m.whatsapp).toMatchObject({ messages: 0, costPerMessage: null, replyP50Ms: null, firstTime: null });
  });
});

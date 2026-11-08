import { describe, expect, it } from "vitest";
import { createInterviewMock } from "@/lib/ai/interview-mock";
import { getInterviewAi } from "@/lib/ai/interview";
import { assertNoForbidden } from "@/lib/ai/forbidden-terms";
import { hasAdvice } from "@/lib/interview/filters";
import { buildAgenda } from "@/lib/interview/agenda";
import { FIXTURES } from "@/lib/interview/fixtures";
import type { Finding, Turn } from "@/lib/interview/types";

const ai = createInterviewMock();
const probe = "O que você anda sentindo nas últimas semanas?";

describe("mock extractFindings", () => {
  it("sintoma com duração", async () => {
    const f = await ai.extractFindings({ blockId: "saude", probeText: probe, text: "Cansaço todo dia, há uns três meses" });
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ tema: "sintoma", duracao: "há uns três meses", pediuParar: false });
  });
  it("chefia e trabalho", async () => {
    const [f] = await ai.extractFindings({ blockId: "trabalho", probeText: probe, text: "meu chefe cobra meta até tarde" });
    expect(f).toMatchObject({ tema: "chefia", mencionaTrabalho: true });
  });
  it("pedido de parar", async () => {
    const [f] = await ai.extractFindings({ blockId: "barreiras", probeText: probe, text: "quero parar" });
    expect(f.pediuParar).toBe(true);
  });
  it("texto é aparado em 160 caracteres", async () => {
    const [f] = await ai.extractFindings({ blockId: "saude", probeText: probe, text: "a".repeat(400) });
    expect(f.texto.length).toBeLessThanOrEqual(160);
  });
});

describe("mock phraseAck", () => {
  it("devolve frase curta e limpa", async () => {
    const ack = await ai.phraseAck({ lastText: "cansaço", findings: [{ tema: "sintoma", texto: "cansaço", duracao: null, intensidade: null, mencionaTrabalho: false, pediuParar: false }], probeText: probe });
    expect(["Hmm, entendi.", "Certo.", "Sei.", "Entendi, obrigada por me contar.", "Hum, faz sentido."]).toContain(ack);
    expect(assertNoForbidden(ack)).toEqual([]);
    expect(hasAdvice(ack)).toBe(false);
    expect(await ai.phraseAck({ lastText: "", findings: [], probeText: probe })).toBe("Certo.");
  });
});

describe("mock summarize", () => {
  it("toda entrada tem origem; blocos pulados vão para nao_respondido", async () => {
    const turns: Turn[] = [
      { idx: 0, speaker: "ai", text: probe, blockId: "saude", probeId: null, startedMs: 0, durationMs: null },
      { idx: 1, speaker: "person", text: "cansaço há 3 meses", blockId: "saude", probeId: null, startedMs: 5000, durationMs: 3000 },
      { idx: 2, speaker: "ai", text: "E no trabalho?", blockId: "trabalho", probeId: null, startedMs: 9000, durationMs: null },
      { idx: 3, speaker: "person", text: "meta até tarde", blockId: "trabalho", probeId: null, startedMs: 72000, durationMs: 2000 },
    ];
    const findings: Finding[] = [
      { tema: "sintoma", texto: "cansaço", duracao: "há 3 meses", intensidade: null, mencionaTrabalho: false, pediuParar: false, turnIdx: 1, blockId: "saude" },
      { tema: "carga", texto: "meta até tarde", duracao: null, intensidade: null, mencionaTrabalho: true, pediuParar: false, turnIdx: 3, blockId: "trabalho" },
    ];
    const s = await ai.summarize({ turns, findings, agenda: buildAgenda(FIXTURES.prioridade), skipped: ["barreiras"] });
    expect(s.dificuldades_relatadas[0]).toMatchObject({ texto: "cansaço", duracao: "há 3 meses", origem: [{ turnIdx: 1, label: "turno 1 · 00:05" }] });
    expect(s.fatores_do_trabalho[0].origem).toEqual([{ turnIdx: 3, label: "turno 3 · 01:12" }]);
    expect(s.nao_respondido).toContain("Sobre buscar ajuda");
    expect(s.sinais_de_alerta).toEqual({ risco: false, origem: [] });
    expect(s.turnos).toBe(2);
    for (const list of [s.dificuldades_relatadas, s.impacto_no_trabalho, s.fatores_do_trabalho, s.barreiras_atendimento, s.pontos_para_avaliacao])
      for (const e of list) expect(e.origem.length).toBeGreaterThanOrEqual(1);
  });
});

describe("getInterviewAi", () => {
  it("em mock devolve o mock", async () => {
    expect(await getInterviewAi().phraseAck({ lastText: "", findings: [], probeText: probe })).toBe("Certo.");
  });
});

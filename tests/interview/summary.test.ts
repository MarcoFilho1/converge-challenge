import { describe, expect, it } from "vitest";
import { createInterviewMock } from "@/lib/ai/interview-mock";
import { createState, isFinal, step } from "@/lib/interview/engine";
import { FIXTURES } from "@/lib/interview/fixtures";
import { buildSummary, validateSummary } from "@/lib/interview/summary";
import type { Turn } from "@/lib/interview/types";

const turns: Turn[] = [
  { idx: 0, speaker: "ai", text: "pergunta", blockId: "saude", probeId: null, startedMs: 0, durationMs: null },
  { idx: 1, speaker: "person", text: "cansaço", blockId: "saude", probeId: null, startedMs: 65000, durationMs: 2000 },
];
const ok = { turnIdx: 1, label: "turno 1 · 01:05" };
const raw = {
  dificuldades_relatadas: [
    { texto: "cansaço", duracao: null, origem: [ok] },
    { texto: "sem origem", duracao: null, origem: [] },
    { texto: "turno que não existe", duracao: null, origem: [{ turnIdx: 99, label: "x" }] },
    { texto: "aponta para a IA", duracao: null, origem: [{ turnIdx: 0, label: "x" }] },
    { texto: "sinais de burnout", duracao: null, origem: [ok] },
  ],
  impacto_no_trabalho: [],
  fatores_do_trabalho: [{ texto: "meta", origem: [ok] }],
  barreiras_atendimento: [],
  sinais_de_alerta: { risco: false, origem: [] },
  pontos_para_avaliacao: [{ texto: "você tem depressão", origem: [ok] }],
  nao_respondido: [],
  duracao_min: 999,
  turnos: 999,
};

describe("validateSummary", () => {
  it("descarta entradas sem origem válida ou com termo proibido e recalcula totais", () => {
    const s = validateSummary(raw, turns);
    expect(s.dificuldades_relatadas.map((d) => d.texto)).toEqual(["cansaço"]);
    expect(s.fatores_do_trabalho).toHaveLength(1);
    expect(s.pontos_para_avaliacao).toEqual([]);
    expect(s.turnos).toBe(1);
    expect(s.duracao_min).toBeCloseTo(1.1, 1);
  });
  it("rejeita lixo que não é resumo", () => {
    expect(() => validateSummary({ foo: 1 }, turns)).toThrow();
  });
});

describe("buildSummary", () => {
  it("resumo da entrevista inteira tem entradas e toda origem aponta para turno da pessoa", async () => {
    const ai = createInterviewMock();
    const T0 = 0;
    let r = await step(createState(FIXTURES.prioridade, { mode: "live", nowMs: T0 }), { kind: "start", consent: true }, ai, T0);
    const byBlock: Record<string, string> = {
      abertura: "pode sim",
      saude: "um cansaço grande há uns três meses, pior no fim do dia; já fui ao médico",
      trabalho: "muita meta e hora extra no fechamento, meu chefe cobra muito",
      barreiras: "não tenho tempo e tenho medo da empresa saber",
      seguranca: "não, nada disso",
    };
    let t = 0;
    while (!isFinal(r.state.status) && t < 30) r = await step(r.state, { kind: "speech", text: byBlock[r.say.blockId] ?? "não sei", durationMs: 2000 }, ai, (++t) * 10_000);
    const s = await buildSummary(r.state, ai);
    const all = [...s.dificuldades_relatadas, ...s.impacto_no_trabalho, ...s.fatores_do_trabalho, ...s.barreiras_atendimento, ...s.pontos_para_avaliacao];
    expect(all.length).toBeGreaterThanOrEqual(3);
    for (const e of all) for (const o of e.origem) expect(r.state.turns[o.turnIdx]?.speaker).toBe("person");
    expect(s.turnos).toBe(r.state.turns.filter((x) => x.speaker === "person").length);
  });
});

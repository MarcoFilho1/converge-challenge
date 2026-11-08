import { describe, expect, it } from "vitest";
import { buildAgenda } from "@/lib/interview/agenda";
import { flagsFromRun, fromQuestionnaireRun } from "@/lib/interview/adapters/questionnaire";
import { FIXTURES } from "@/lib/interview/fixtures";
import type { Score } from "@/lib/instruments/types";

const ids = (a: ReturnType<typeof buildAgenda>) => a.blocks.map((b) => b.id);
const find = (a: ReturnType<typeof buildAgenda>, id: string) => a.blocks.find((b) => b.id === id)!;
const sc = (instrument: string, dimension: string, flagged: boolean): Score => ({ instrument, dimension, value: 0, cutoff: 0, flagged, complete: true });

describe("buildAgenda", () => {
  it("prioridade: três domínios obrigatórios, na ordem, com 3 sondas", () => {
    const a = buildAgenda(FIXTURES.prioridade);
    expect(ids(a)).toEqual(["abertura", "saude", "trabalho", "barreiras", "seguranca", "fechamento"]);
    for (const id of ["saude", "trabalho", "barreiras"]) expect(find(a, id)).toMatchObject({ required: true, maxProbes: 3 });
    expect(a.skipInterview).toBe(false);
  });

  it("atenção: trabalhou doente e prejuízo 4 tornam saúde, trabalho e barreiras obrigatórios", () => {
    const a = buildAgenda(FIXTURES.atencao);
    expect(find(a, "saude").required).toBe(true);
    expect(find(a, "trabalho").required).toBe(true);
    expect(find(a, "barreiras").required).toBe(true);
  });

  it("sem indício: domínios viram confirmação com 1 sonda", () => {
    const a = buildAgenda(FIXTURES.semIndicio);
    expect(ids(a)).toEqual(["abertura", "saude", "trabalho", "barreiras", "seguranca", "fechamento"]);
    for (const id of ["saude", "trabalho", "barreiras"]) expect(find(a, id)).toMatchObject({ required: false, maxProbes: 1 });
  });

  it("só ritmo alto: trabalho obrigatório vem antes das confirmações", () => {
    const a = buildAgenda({ ...FIXTURES.semIndicio, flags: { ...FIXTURES.semIndicio.flags, ritmoAlto: true } });
    expect(ids(a)).toEqual(["abertura", "trabalho", "saude", "barreiras", "seguranca", "fechamento"]);
    expect(find(a, "barreiras").required).toBe(false);
  });

  it("urgência não entrevista", () => {
    expect(buildAgenda({ ...FIXTURES.prioridade, severity: "urgency" }).skipInterview).toBe(true);
  });
});

describe("flagsFromRun / fromQuestionnaireRun", () => {
  it("lê as flags dos escores e respostas", () => {
    const flags = flagsFromRun({ TRUNK: 2, WPAI_Q5: 6 }, [sc("COPSOQ", "ritmo", true), sc("BAT12", "total", true), sc("PHQ2", "total", false)]);
    expect(flags).toEqual({ trabalhouDoente: true, prejuizoTrabalho: 6, exaustao: true, humor: false, ansiedade: false, assedio: false, ritmoAlto: true });
  });

  it("monta o InterviewInput a partir do run", () => {
    const run = { id: "run-1", severity: "priority" } as never;
    const input = fromQuestionnaireRun(run, { TRUNK: 1 }, [], "Dra. Ana", { OPEN_1: "muita meta" });
    expect(input).toMatchObject({ runId: "run-1", severity: "priority", doctorName: "Dra. Ana", abertas: { OPEN_1: "muita meta" } });
    expect(input.flags.trabalhouDoente).toBe(false);
    expect(input.flags.prejuizoTrabalho).toBeNull();
  });
});

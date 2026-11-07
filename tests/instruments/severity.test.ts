import { describe, expect, it } from "vitest";
import { computeSeverity, DEMO_ITEMS, FULL_ITEMS, scoreRun } from "@/lib/instruments";

const sev = (answers: Record<string, number | null>, demo = false, crisisText = false) =>
  computeSeverity({ answers, scores: scoreRun(answers, demo), demoShort: demo, crisisText });

const fill = (prefix: string, n: number, value: number) =>
  Object.fromEntries(Array.from({ length: n }, (_, i) => [`${prefix}${i + 1}`, value]));
const bat = (v: number) => Object.fromEntries([1, 3, 4, 9, 11, 13, 14, 17, 18, 19, 20, 23].map((n) => [`BAT_${n}`, v]));
const copsoq = { COPSOQ_2A: 1, COPSOQ_4A: 3, COPSOQ_12B: 3, COPSOQ_23: 5 };

describe("computeSeverity · demo", () => {
  it("personagem do palco cai em prioridade", () => {
    // sim · 6 · 4 · 2 · 2 · 0 · 4 · aberta
    const r = sev({ TRUNK: 2, WPAI_Q5: 6, BAT_1: 4, PHQ9_1: 2, PHQ9_2: 2, PHQ9_9: 0, COPSOQ_2A: 4, OPEN_1: null }, true);
    expect(r.severity).toBe("priority");
  });

  it("item 9 maior que zero é urgência", () => {
    const r = sev({ TRUNK: 1, BAT_1: 1, PHQ9_1: 0, PHQ9_2: 0, PHQ9_9: 1, COPSOQ_2A: 0 }, true);
    expect(r.severity).toBe("urgency");
  });

  it("os 8 itens da demo existem", () => {
    expect(DEMO_ITEMS).toHaveLength(8);
  });
});

describe("computeSeverity · completo", () => {
  const base = { TRUNK: 1, PHQ9_1: 0, PHQ9_2: 0, PHQ9_9: 0, GAD7_1: 0, GAD7_2: 0, ...bat(1), ...copsoq };

  it("tudo baixo = sem indício e completo", () => {
    const r = sev(base);
    expect(r).toMatchObject({ severity: "none", partial: false, clinicalOnly: false });
  });

  it("A + B sem sofrimento = atenção", () => {
    expect(sev({ ...base, TRUNK: 2, WPAI_Q5: 5 }).severity).toBe("attention");
  });

  it("C sozinho = atenção com sinal clínico sem presenteísmo", () => {
    const r = sev({ ...base, ...fill("PHQ9_", 8, 1), PHQ9_1: 2, PHQ9_2: 2, PHQ9_9: 0 });
    expect(r).toMatchObject({ severity: "attention", clinicalOnly: true });
  });

  it("C grave sozinho = prioridade", () => {
    expect(sev({ ...base, ...fill("PHQ9_", 8, 2), PHQ9_9: 0 }).severity).toBe("priority");
  });

  it("C com A = prioridade", () => {
    const r = sev({ ...base, TRUNK: 2, WPAI_Q5: 1, ...bat(3) });
    expect(r).toMatchObject({ severity: "priority", clinicalOnly: false });
  });

  it("assédio sozinho = atenção", () => {
    expect(sev({ ...base, COPSOQ_23: 2 }).severity).toBe("attention");
  });

  it("sinal de crise no texto = urgência mesmo com item 9 zero", () => {
    expect(sev(base, false, true).severity).toBe("urgency");
  });

  it("item aplicável sem resposta deixa o caso parcial", () => {
    const semUltimoBat: Record<string, number> = { ...base };
    delete semUltimoBat.BAT_23;
    expect(sev(semUltimoBat).partial).toBe(true);
  });

  it("FULL_ITEMS tem os blocos esperados", () => {
    expect(FULL_ITEMS.length).toBeGreaterThanOrEqual(35);
  });
});

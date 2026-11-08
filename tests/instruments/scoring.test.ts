import { describe, expect, it } from "vitest";
import { scoreRun } from "@/lib/instruments";

const find = (scores: ReturnType<typeof scoreRun>, instrument: string, dimension: string) =>
  scores.find((s) => s.instrument === instrument && s.dimension === dimension);

const fill = (prefix: string, n: number, value: number) =>
  Object.fromEntries(Array.from({ length: n }, (_, i) => [`${prefix}${i + 1}`, value]));

describe("scoreRun", () => {
  it("PHQ-9 completo: soma, corte 10, marcado", () => {
    const s = scoreRun({ ...fill("PHQ9_", 9, 2) }, false);
    expect(find(s, "PHQ9", "total")).toMatchObject({ value: 18, cutoff: 10, flagged: true, complete: true });
  });

  it("PHQ-9 incompleto pela porta: sem total, mas PHQ-2 e item 9 aparecem", () => {
    const s = scoreRun({ PHQ9_1: 0, PHQ9_2: 1, PHQ9_9: 0 }, false);
    expect(find(s, "PHQ9", "total")).toBeUndefined();
    expect(find(s, "PHQ2", "total")).toMatchObject({ value: 1, flagged: false });
    expect(find(s, "PHQ9", "item9")).toMatchObject({ value: 0, cutoff: 1, flagged: false });
  });

  it("BAT-12: média, corte 2,54", () => {
    const s = scoreRun({ ...Object.fromEntries([1, 3, 4, 9, 11, 13, 14, 17, 18, 19, 20, 23].map((n) => [`BAT_${n}`, 3])) }, false);
    expect(find(s, "BAT12", "total")).toMatchObject({ value: 3, cutoff: 2.54, flagged: true, complete: true });
  });

  it("BAT-12 com itens faltando é marcado como incompleto e não sinaliza", () => {
    const s = scoreRun({ BAT_1: 5, BAT_3: 5 }, false);
    expect(find(s, "BAT12", "total")).toMatchObject({ complete: false, flagged: false });
  });

  it("WPAI Q5: corte operacional 3", () => {
    expect(find(scoreRun({ WPAI_Q5: 6 }, false), "WPAI", "work_impairment")).toMatchObject({
      value: 6,
      cutoff: 3,
      flagged: true,
    });
  });

  it("COPSOQ 23: qualquer sim sinaliza assédio", () => {
    expect(find(scoreRun({ COPSOQ_23: 4 }, false), "COPSOQ", "assedio")).toMatchObject({ flagged: true });
    expect(find(scoreRun({ COPSOQ_23: 5 }, false), "COPSOQ", "assedio")).toMatchObject({ flagged: false });
  });

  it("demo: BAT item 1 vira escore descritivo com corte 4", () => {
    expect(find(scoreRun({ BAT_1: 4 }, true), "BAT", "item1")).toMatchObject({ value: 4, cutoff: 4, flagged: true });
  });
});

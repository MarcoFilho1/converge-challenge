import { describe, expect, it } from "vitest";
import { clinicalSignal, toScoreChip } from "@/lib/case/score-chips";

const s = (instrument: string, dimension: string, value: number, cutoff: number, flagged: boolean) => ({
  instrument, dimension, value, cutoff, flagged, complete: true,
});

describe("toScoreChip", () => {
  it.each([
    [s("PHQ2", "total", 4, 3, true), "PHQ-2", "/6"],
    [s("PHQ9", "total", 13, 10, true), "PHQ-9", "/27"],
    [s("PHQ9", "item9", 0, 1, false), "PHQ-9 item 9", "/3"],
    [s("GAD7", "total", 11, 10, true), "GAD-7", "/21"],
    [s("BAT12", "total", 3.42, 2.54, true), "BAT-12", "/5"],
    [s("BAT", "item1", 4, 4, true), "BAT item 1", "/5"],
    [s("WPAI", "work_impairment", 6, 3, true), "WPAI", "/10"],
    [s("COPSOQ", "ritmo", 4, 3, true), "Ritmo", "/4"],
  ])("rótulo e máximo certos para %o", (score, label, max) => {
    expect(toScoreChip(score)).toMatchObject({ label, maxLabel: max });
  });
});

describe("clinicalSignal (critério C, igual ao motor)", () => {
  it("demo: BAT item 1 sinalizado acende C", () => {
    expect(clinicalSignal([s("BAT", "item1", 4, 4, true)], true)).toBe(true);
  });
  it("completo: PHQ-2 aberto pela porta NÃO é C", () => {
    expect(clinicalSignal([s("PHQ2", "total", 2, 2, true)], false)).toBe(false);
  });
  it("completo: PHQ-9 total sinalizado é C", () => {
    expect(clinicalSignal([s("PHQ9", "total", 12, 10, true)], false)).toBe(true);
  });
});

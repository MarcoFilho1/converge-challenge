import type { QueueScoreChip } from "@/lib/demo/fixtures";

type ScoreLike = {
  instrument: string;
  dimension: string;
  value: number;
  cutoff: number;
  flagged: boolean;
  complete: boolean;
};

/** Rótulo e máximo de cada escore que o motor grava (completo e versão curta da demo). */
const FORMAT: Record<string, { label: string; max: string; decimals?: number }> = {
  "WPAI/work_impairment": { label: "WPAI", max: "/10" },
  "PHQ2/total": { label: "PHQ-2", max: "/6" },
  "PHQ9/total": { label: "PHQ-9", max: "/27" },
  "PHQ9/item9": { label: "PHQ-9 item 9", max: "/3" },
  "GAD2/total": { label: "GAD-2", max: "/6" },
  "GAD7/total": { label: "GAD-7", max: "/21" },
  "BAT12/total": { label: "BAT-12", max: "/5", decimals: 2 },
  "BAT/item1": { label: "BAT item 1", max: "/5" },
  "COPSOQ/ritmo": { label: "Ritmo", max: "/4" },
  "COPSOQ/influencia": { label: "Influência", max: "/4" },
  "COPSOQ/apoio_superior": { label: "Apoio do superior", max: "/4" },
  "COPSOQ/assedio": { label: "Assédio (5 = não)", max: "/5" },
};

export function toScoreChip(s: ScoreLike): QueueScoreChip | null {
  const f = FORMAT[`${s.instrument}/${s.dimension}`];
  if (!f) return null;
  return {
    instrument: s.instrument,
    dimension: s.dimension,
    label: f.label,
    value: Number(s.value.toFixed(f.decimals ?? 0)),
    maxLabel: f.max,
    cutoff: s.cutoff,
    flagged: s.flagged,
    complete: s.complete,
  };
}

/**
 * Critério C exatamente como em src/lib/instruments/severity.ts:
 * demo = BAT item 1 ou PHQ-2 sinalizados; completo = BAT-12, PHQ-9 ou GAD-7 totais sinalizados.
 * (No roteiro completo, PHQ-2 sinalizado só abre a porta do PHQ-9; não é sinal clínico.)
 */
export function clinicalSignal(scores: ScoreLike[], demoShort: boolean): boolean {
  const on = (i: string, d: string) => scores.some((s) => s.instrument === i && s.dimension === d && s.flagged);
  return demoShort
    ? on("BAT", "item1") || on("PHQ2", "total")
    : on("BAT12", "total") || on("PHQ9", "total") || on("GAD7", "total");
}

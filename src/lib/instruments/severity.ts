import { getItems, TRUNK_YES } from "./items";
import { CUTOFFS } from "./scoring";
import type { Answers, Score } from "./types";

export type SeverityLevel = "none" | "attention" | "priority" | "urgency";

const score = (scores: Score[], instrument: string, dimension: string) =>
  scores.find((s) => s.instrument === instrument && s.dimension === dimension);

/**
 * Regra de indício (docs/questionario-whatsapp.md, seção 7):
 *   URGÊNCIA   = PHQ9 item 9 >= 1 OU crise no texto
 *   PRIORIDADE = C E (A OU B), OU C grave
 *   ATENÇÃO    = (A E B) OU C OU assédio
 * A = tronco sim; B = WPAI Q5 >= 3;
 * C = BAT-12 >= 2,54 OU PHQ-9 >= 10 OU GAD-7 >= 10 (só com instrumento completo);
 * C grave = BAT-12 >= 2,96 OU PHQ-9 >= 15 OU GAD-7 >= 15.
 * Demo: C = BAT item 1 >= 4 OU PHQ-2 >= 3; sem C grave.
 */
export function computeSeverity(input: {
  answers: Answers;
  scores: Score[];
  demoShort: boolean;
  crisisText: boolean;
}): { severity: SeverityLevel; clinicalOnly: boolean; partial: boolean } {
  const { answers, scores, demoShort, crisisText } = input;

  const A = answers.TRUNK === TRUNK_YES;
  const B = !!score(scores, "WPAI", "work_impairment")?.flagged;

  let C: boolean;
  let Cgrave = false;
  if (demoShort) {
    C = !!score(scores, "BAT", "item1")?.flagged || !!score(scores, "PHQ2", "total")?.flagged;
  } else {
    const bat = score(scores, "BAT12", "total");
    const phq = score(scores, "PHQ9", "total");
    const gad = score(scores, "GAD7", "total");
    C = !!bat?.flagged || !!phq?.flagged || !!gad?.flagged;
    Cgrave =
      (!!bat?.flagged && bat.value >= CUTOFFS.BAT12_SEVERE) ||
      (!!phq && phq.value >= CUTOFFS.PHQ9_SEVERE) ||
      (!!gad && gad.value >= CUTOFFS.GAD7_SEVERE);
  }
  const W = !!score(scores, "COPSOQ", "assedio")?.flagged;
  const urgency = !!score(scores, "PHQ9", "item9")?.flagged || crisisText;

  const severity: SeverityLevel = urgency
    ? "urgency"
    : (C && (A || B)) || Cgrave
      ? "priority"
      : (A && B) || C || W
        ? "attention"
        : "none";

  const partial = getItems(demoShort).some(
    (item) => item.instrument !== "OPEN" && (!item.when || item.when(answers)) && (answers[item.code] ?? null) === null,
  );

  return { severity, clinicalOnly: C && !A, partial };
}

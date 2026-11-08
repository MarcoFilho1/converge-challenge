import type { QuestionnaireRun } from "@/db/schema";
import { TRUNK_YES } from "@/lib/instruments/items";
import type { Answers, Score } from "@/lib/instruments/types";
import type { InterviewInput } from "../types";

const flagged = (scores: Score[], instrument: string, dimension: string) =>
  scores.some((s) => s.instrument === instrument && s.dimension === dimension && s.flagged);

export function flagsFromRun(answers: Answers, scores: Score[]): InterviewInput["flags"] {
  return {
    trabalhouDoente: answers.TRUNK === TRUNK_YES,
    prejuizoTrabalho: answers.WPAI_Q5 ?? null,
    exaustao: flagged(scores, "BAT12", "total") || flagged(scores, "BAT", "item1"),
    humor: flagged(scores, "PHQ9", "total") || flagged(scores, "PHQ2", "total"),
    ansiedade: flagged(scores, "GAD7", "total") || flagged(scores, "GAD2", "total"),
    assedio: flagged(scores, "COPSOQ", "assedio"),
    ritmoAlto: flagged(scores, "COPSOQ", "ritmo"),
  };
}

export function fromQuestionnaireRun(
  run: Pick<QuestionnaireRun, "id" | "severity">,
  answers: Answers,
  scores: Score[],
  doctorName: string,
  openTexts: { OPEN_1?: string; OPEN_2?: string } = {},
): InterviewInput {
  return { runId: run.id, severity: run.severity, flags: flagsFromRun(answers, scores), abertas: openTexts, doctorName };
}

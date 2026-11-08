import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { answers, evidence, questionnaireRuns, scores, summaries } from "@/db/schema";
import { assertNoForbidden, FORBIDDEN_REPLACEMENT, getAi, RunSummarySchema, type RunSummary } from "@/lib/ai";
import { getItems } from "@/lib/instruments";
import type { Answers } from "@/lib/instruments/types";

/** Troca por um aviso qualquer texto do resumo que traga termo clínico proibido. */
function sanitize(summary: RunSummary): RunSummary {
  const clean = (text: string) => {
    if (assertNoForbidden(text).length === 0) return text;
    console.warn("[summary] trecho removido por termo proibido");
    return FORBIDDEN_REPLACEMENT;
  };
  return {
    dificuldades_relatadas: summary.dificuldades_relatadas.map((d) => ({ ...d, relato: clean(d.relato) })),
    impacto_funcional: { ...summary.impacto_funcional, texto: clean(summary.impacto_funcional.texto) },
    fatores_do_trabalho: summary.fatores_do_trabalho.map((f) => ({ ...f, texto: clean(f.texto) })),
    pontos_para_avaliar: summary.pontos_para_avaliar.map((p) => ({ ...p, texto: clean(p.texto) })),
    nao_respondido: summary.nao_respondido,
  };
}

/** Gera e grava o resumo estruturado de um questionário encerrado. */
export async function buildSummary(runId: string): Promise<void> {
  const [run] = await db.select().from(questionnaireRuns).where(eq(questionnaireRuns.id, runId));
  if (!run) return;
  const items = getItems(run.demoShort);
  const answerRows = await db.select().from(answers).where(eq(answers.runId, runId));
  const scoreRows = await db.select().from(scores).where(eq(scores.runId, runId));
  const evidenceRows = await db
    .select({ itemCode: answers.itemCode, theme: evidence.theme, explanation: evidence.explanation })
    .from(evidence)
    .innerJoin(answers, eq(evidence.answerId, answers.id))
    .where(eq(evidence.runId, runId));

  const answerMap: Answers = Object.fromEntries(answerRows.map((a) => [a.itemCode, a.valueNumeric]));
  const missing = new Set<string>();
  for (const item of items) {
    const applies = !item.when || item.when(answerMap);
    const row = answerRows.find((a) => a.itemCode === item.code);
    const empty = !row || (item.scale ? row.valueNumeric === null : !row.rawText.trim());
    if (applies && empty) missing.add(item.instrument);
  }

  const summary = await getAi().summarizeRun({
    answers: answerRows
      .map((a) => ({ item: items.find((i) => i.code === a.itemCode), rawText: a.rawText, value: a.valueNumeric }))
      .filter((a): a is { item: NonNullable<typeof a.item>; rawText: string; value: number | null } => !!a.item),
    scores: scoreRows.map(({ instrument, dimension, value, cutoff, flagged, complete }) => ({
      instrument,
      dimension,
      value,
      cutoff,
      flagged,
      complete,
    })),
    evidence: evidenceRows,
    missingInstruments: [...missing],
  });

  const json = sanitize(RunSummarySchema.parse(summary));
  await db
    .insert(summaries)
    .values({ runId, json })
    .onConflictDoUpdate({ target: summaries.runId, set: { json, createdAt: new Date() } });
}

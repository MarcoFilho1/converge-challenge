import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { answers, evidence, questionnaireRuns, type DocKind } from "@/db/schema";
import { assertNoForbidden, getAi, type Chunk } from "@/lib/ai";
import { getItems } from "@/lib/instruments";
import type { InstrumentCode } from "@/lib/instruments/types";
import { searchChunks } from "@/lib/rag/search";
import { recordEvent } from "@/lib/obs/events";

/** Que tipo de documento contextualiza cada instrumento, além da ficha do próprio instrumento. */
const CONTEXT_KINDS: Record<InstrumentCode, DocKind[]> = {
  TRUNK: ["norma", "guia"],
  WPAI: ["norma", "guia"],
  PHQ9: ["crise", "instrumento"],
  GAD7: ["instrumento", "guia"],
  BAT12: ["guia", "instrumento"],
  COPSOQ: ["guia", "norma"],
  OPEN: ["guia", "norma"],
};

async function retrieve(instrument: InstrumentCode, query: string): Promise<Chunk[]> {
  const own = await searchChunks(query, { k: 2, instruments: [instrument === "TRUNK" ? "TRUNK" : instrument] });
  const context = await searchChunks(query, { k: 3, kinds: CONTEXT_KINDS[instrument] });
  const seen = new Set<string>();
  return [...own, ...context].filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)));
}

/**
 * Explica uma resposta com trechos da base. Grava um registro de evidence por trecho, nunca sem trecho
 * e nunca com termo clínico proibido. Não altera a gravidade, que é calculada em código.
 */
export async function recordEvidence(
  answerId: string,
): Promise<{ stored: boolean; reason?: "not_relevant" | "no_chunks" | "forbidden" | "no_item" }> {
  const [row] = await db
    .select({ answer: answers, demoShort: questionnaireRuns.demoShort })
    .from(answers)
    .innerJoin(questionnaireRuns, eq(answers.runId, questionnaireRuns.id))
    .where(eq(answers.id, answerId));
  if (!row) return { stored: false, reason: "no_item" };
  const item = getItems(row.demoShort).find((i) => i.code === row.answer.itemCode);
  if (!item || !item.scale) return { stored: false, reason: "no_item" };

  const chunks = await retrieve(item.instrument, `${item.text} ${row.answer.rawText}`);
  const skip = (reason: "not_relevant" | "no_chunks" | "forbidden", detail: string) => {
    recordEvent({ kind: "indício", outcome: "descartado", answerId, runId: row.answer.runId, detail: `${item.code}: ${detail}` });
    return { stored: false as const, reason };
  };
  if (chunks.length === 0) return skip("no_chunks", "a busca não trouxe trecho");

  const out = await getAi().classifyAnswer({
    item,
    answerText: row.answer.rawText,
    value: row.answer.valueNumeric,
    chunks,
  });
  if (!out.relevante) return skip("not_relevant", `${chunks.length} trechos buscados, nenhum relevante para a resposta`);
  const allowed = new Set(chunks.map((c) => c.id));
  const trechos = out.trechos.filter((t) => allowed.has(t.chunkId));
  if (trechos.length === 0) return skip("no_chunks", "a IA citou trecho que não veio da busca; descartado");
  if (assertNoForbidden(`${out.tema} ${out.explicacao}`).length > 0) {
    console.warn("[evidence] explicação descartada por termo proibido", answerId);
    return skip("forbidden", "explicação com termo clínico proibido; descartada");
  }

  await db.delete(evidence).where(eq(evidence.answerId, answerId));
  await db.insert(evidence).values(
    trechos.map((t) => ({
      runId: row.answer.runId,
      answerId,
      theme: out.tema,
      explanation: out.explicacao,
      chunkId: t.chunkId,
      source: "rag" as const,
    })),
  );
  const titles = [...new Set(trechos.map((t) => chunks.find((c) => c.id === t.chunkId)?.documentTitle).filter(Boolean))];
  recordEvent({ kind: "indício", outcome: "ok", answerId, runId: row.answer.runId, detail: `${item.code}: ${trechos.length} de ${chunks.length} trechos citados (${titles.join("; ")})` });
  return { stored: true };
}

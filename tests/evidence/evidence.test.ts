import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { pushSchemaToTestDb, truncateAll } from "../helpers/db";
import { TEST_MANIFEST } from "../helpers/knowledge";

const PHONE = "5581999990003";
let n = 0;
const say = async (text: string) => {
  const { handleIncoming } = await import("@/lib/engine/engine");
  return handleIncoming({ phone: PHONE, text, waMessageId: `ev-${Date.now()}-${n++}` });
};

async function demoRunUpTo(answers: string[]) {
  const { db } = await import("@/db/client");
  const { contacts } = await import("@/db/schema");
  const [c] = await db.insert(contacts).values({ name: "Caio Teste", phoneE164: PHONE }).returning();
  const { startRun } = await import("@/lib/engine/engine");
  const { runId } = await startRun(c.id, { demoShort: true });
  await say("1");
  for (const a of answers) await say(a);
  return runId;
}

async function evidenceOf(runId: string) {
  const { db } = await import("@/db/client");
  const { evidence, answers } = await import("@/db/schema");
  return db
    .select({ itemCode: answers.itemCode, chunkId: evidence.chunkId, theme: evidence.theme, explanation: evidence.explanation })
    .from(evidence)
    .innerJoin(answers, eq(evidence.answerId, answers.id))
    .where(eq(evidence.runId, runId));
}

beforeAll(async () => {
  pushSchemaToTestDb();
  await truncateAll();
  const { ingestDocuments } = await import("@/lib/rag/ingest");
  await ingestDocuments(TEST_MANIFEST, "knowledge");
});
beforeEach(async () => {
  await truncateAll();
});

describe("indícios com trecho de origem", () => {
  it("resposta alta grava indício ligado a um trecho do próprio instrumento", async () => {
    const runId = await demoRunUpTo(["sim", "6", "4", "3"]); // ... PHQ9_1 = 3
    const rows = await evidenceOf(runId);
    const phq = rows.filter((r) => r.itemCode === "PHQ9_1");
    expect(phq.length).toBeGreaterThan(0);
    expect(phq.every((r) => r.chunkId)).toBe(true);
  });

  it("resposta baixa não grava indício", async () => {
    const runId = await demoRunUpTo(["não", "1", "1", "0"]);
    const rows = await evidenceOf(runId);
    expect(rows.filter((r) => r.itemCode === "PHQ9_1")).toHaveLength(0);
  });

  it("nenhum indício usa termo clínico proibido", async () => {
    const runId = await demoRunUpTo(["sim", "9", "5", "3", "3"]);
    const { assertNoForbidden } = await import("@/lib/ai");
    for (const r of await evidenceOf(runId)) expect(assertNoForbidden(r.explanation)).toEqual([]);
  });

  it("indício não muda a gravidade calculada em código", async () => {
    const runId = await demoRunUpTo(["sim", "6", "4", "2", "2", "0", "4", "metas dobraram"]);
    const { db } = await import("@/db/client");
    const { questionnaireRuns } = await import("@/db/schema");
    const [run] = await db.select().from(questionnaireRuns).where(eq(questionnaireRuns.id, runId));
    expect(run.severity).toBe("priority");
  });
});

describe("resumo estruturado", () => {
  it("questionário concluído ganha resumo válido, sem termo proibido", async () => {
    const runId = await demoRunUpTo(["sim", "6", "4", "2", "2", "0", "4", "metas dobraram e não tenho apoio"]);
    const { db } = await import("@/db/client");
    const { summaries } = await import("@/db/schema");
    const [row] = await db.select().from(summaries).where(eq(summaries.runId, runId));
    expect(row).toBeTruthy();
    const { RunSummarySchema, assertNoForbidden } = await import("@/lib/ai");
    const parsed = RunSummarySchema.parse(row.json);
    expect(parsed.fatores_do_trabalho.some((f) => f.texto.includes("metas dobraram"))).toBe(true);
    expect(assertNoForbidden(JSON.stringify(parsed))).toEqual([]);
  });

  it("resumo lista o que ficou sem resposta quando a pessoa para", async () => {
    const runId = await demoRunUpTo(["sim", "6"]);
    await say("parar");
    const { db } = await import("@/db/client");
    const { summaries } = await import("@/db/schema");
    const [row] = await db.select().from(summaries).where(eq(summaries.runId, runId));
    const { RunSummarySchema } = await import("@/lib/ai");
    expect(RunSummarySchema.parse(row.json).nao_respondido.length).toBeGreaterThan(0);
  });
});

describe("sanitizeSummary", () => {
  it("mantém linha que cita o texto validado do item e remove rótulo clínico", async () => {
    const { sanitizeSummary } = await import("@/lib/evidence/summarize");
    const out = sanitizeSummary({
      dificuldades_relatadas: [
        { relato: 'Respondeu "0" para: Você tem um alto grau de influência nas decisões sobre o seu trabalho?', origem: ["COPSOQ_4A"] },
        { relato: "Você tem burnout", origem: ["BAT_1"] },
      ],
      impacto_funcional: { texto: "ok", origem: [] },
      fatores_do_trabalho: [],
      pontos_para_avaliar: [],
      nao_respondido: [],
    });
    expect(out.dificuldades_relatadas[0].relato).toContain("alto grau de influência");
    expect(out.dificuldades_relatadas[1].relato).toBe("[texto removido: termo não permitido]");
  });
});

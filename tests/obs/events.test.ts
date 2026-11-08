import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { pushSchemaToTestDb, truncateAll } from "../helpers/db";

const PHONE = "5581933330001";
let n = 0;
const say = async (text: string) => {
  const { handleIncoming } = await import("@/lib/engine/engine");
  return handleIncoming({ phone: PHONE, text, waMessageId: `obs-${Date.now()}-${n++}` });
};
async function eventsOf(runId: string) {
  const { settleEvents } = await import("@/lib/obs/events");
  await settleEvents();
  const { db } = await import("@/db/client");
  const { agentEvents } = await import("@/db/schema");
  const { eq } = await import("drizzle-orm");
  return db.select().from(agentEvents).where(eq(agentEvents.runId, runId));
}

beforeAll(() => pushSchemaToTestDb());
beforeEach(async () => {
  await truncateAll();
});

describe("rastro do agente", () => {
  it("cada chamada de modelo vira um evento com caso, etapa, modelo, tokens, custo e tempo", async () => {
    const { db } = await import("@/db/client");
    const { contacts, questionnaireRuns } = await import("@/db/schema");
    const [c] = await db.insert(contacts).values({ name: "Obs", phoneE164: PHONE }).returning();
    const [run] = await db.insert(questionnaireRuns).values({ contactId: c.id, status: "done" }).returning();
    const { withObsContext } = await import("@/lib/obs/context");
    const { withChat } = await import("@/lib/ai/llm");
    const target = { label: "featherless:m#1", key: "k1", model: "m" };
    await withObsContext({ runId: run.id }, () =>
      withChat(async () => ({ usage: { inputTokens: 120, outputTokens: 30, raw: { cost: 0.0012 } } }), [target], "classificar"),
    );
    await withObsContext({ runId: run.id }, () =>
      withChat(async () => {
        throw Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" });
      }, [target], "resumo do questionário").catch(() => null),
    );
    const rows = await eventsOf(run.id);
    const ok = rows.find((r) => r.kind === "classificar")!;
    expect(ok).toMatchObject({ outcome: "ok", model: "featherless:m#1", tokensIn: 120, tokensOut: 30, costUsd: 0.0012 });
    expect(ok.latencyMs).toBeGreaterThanOrEqual(0);
    expect(rows.find((r) => r.kind === "resumo do questionário")?.outcome).toBe("tempo_esgotado");
  });

  it("o questionário registra o valor de cada resposta, o convite e os indícios", async () => {
    const { db } = await import("@/db/client");
    const { contacts } = await import("@/db/schema");
    const [c] = await db.insert(contacts).values({ name: "Obs Demo", phoneE164: PHONE }).returning();
    const { startRun, settleBackground } = await import("@/lib/engine/engine");
    const { runId } = await startRun(c.id, { demoShort: true });
    for (const t of ["1", "1", "7", "com frequência", "2", "2", "0", "4", "metas"]) await say(t);
    await settleBackground();
    const rows = await eventsOf(runId);
    const values = rows.filter((r) => r.kind === "valor da resposta");
    expect(values).toHaveLength(7);
    expect(values.some((r) => r.detail === "“com frequência” → 4 (regra local)")).toBe(true);
    expect(rows.some((r) => r.kind === "convite" && r.outcome === "ok")).toBe(true);
    expect(rows.filter((r) => r.kind === "indício").length).toBeGreaterThan(0);
  });

  it("frase de risco registra o corte de crise com o padrão que disparou", async () => {
    const { db } = await import("@/db/client");
    const { contacts } = await import("@/db/schema");
    await db.insert(contacts).values({ name: "Obs Crise", phoneE164: PHONE });
    const r = await say("penso em me matar");
    const rows = await eventsOf(r.runId!);
    const crise = rows.find((x) => x.kind === "crise");
    expect(crise?.detail).toMatch(/me matar/);
  });

  it("o caso traz o rastro em ordem de tempo", async () => {
    const { db } = await import("@/db/client");
    const { contacts } = await import("@/db/schema");
    await db.insert(contacts).values({ name: "Obs Caso", phoneE164: PHONE });
    const r = await say("penso em me matar");
    await eventsOf(r.runId!);
    const { getCase } = await import("@/lib/case/query");
    const c = await getCase(r.runId!);
    expect(c.trail?.map((e) => e.kind)).toContain("crise");
  });
});

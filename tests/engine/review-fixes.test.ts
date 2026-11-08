import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { asc, eq } from "drizzle-orm";
import { pushSchemaToTestDb, truncateAll } from "../helpers/db";
import { computeSeverity, FULL_ITEMS, nextItemIndex, scoreRun } from "@/lib/instruments";

const PHONE = "5581999990002";
let n = 0;
const id = () => `fix-${Date.now()}-${n++}`;

async function setupContact() {
  const { db } = await import("@/db/client");
  const { contacts } = await import("@/db/schema");
  const [c] = await db.insert(contacts).values({ name: "Bia Teste", phoneE164: PHONE }).returning();
  return c;
}
const say = async (text: string, waMessageId = id()) => {
  const { handleIncoming } = await import("@/lib/engine/engine");
  return handleIncoming({ phone: PHONE, text, waMessageId });
};

describe("revisão 1 · instrumento incompleto não some da gravidade", () => {
  it("PHQ-9 com um item nulo e soma alta continua sinalizando", () => {
    const answers = {
      TRUNK: 1,
      PHQ9_1: 3, PHQ9_2: 3, PHQ9_3: 3, PHQ9_4: 3, PHQ9_5: null, PHQ9_6: 3, PHQ9_7: 3, PHQ9_8: 3, PHQ9_9: 0,
      GAD7_1: 0, GAD7_2: 0,
    };
    const scores = scoreRun(answers, false);
    const phq = scores.find((s) => s.instrument === "PHQ9" && s.dimension === "total");
    expect(phq).toMatchObject({ value: 21, flagged: true, complete: false });
    expect(computeSeverity({ answers, scores, demoShort: false, crisisText: false }).severity).toBe("priority");
  });

  it("BAT-12 com até metade faltando usa a média dos presentes", () => {
    const answers = { BAT_1: 4, BAT_3: 4, BAT_4: 4, BAT_9: 4, BAT_11: 4, BAT_13: 4, BAT_14: 4, BAT_17: null };
    const bat = scoreRun(answers, false).find((s) => s.instrument === "BAT12");
    expect(bat).toMatchObject({ value: 4, flagged: true, complete: false });
  });
});

describe("revisão 4 · porta com resposta nula fica aberta", () => {
  const idx = (code: string) => FULL_ITEMS.findIndex((i) => i.code === code);
  it("PHQ9_1 nulo abre os itens 3 a 8", () => {
    expect(nextItemIndex(FULL_ITEMS, { PHQ9_1: null, PHQ9_2: 1 }, idx("PHQ9_2") + 1)).toBe(idx("PHQ9_3"));
  });
  it("GAD7_2 nulo abre os itens 3 a 7", () => {
    expect(nextItemIndex(FULL_ITEMS, { GAD7_1: 0, GAD7_2: null }, idx("GAD7_2") + 1)).toBe(idx("GAD7_3"));
  });
  it("tronco nulo pergunta a WPAI", () => {
    expect(nextItemIndex(FULL_ITEMS, { TRUNK: null }, idx("TRUNK") + 1)).toBe(idx("WPAI_Q5"));
  });
});

describe("revisão 2 e 3 · motor", () => {
  beforeAll(() => pushSchemaToTestDb());
  beforeEach(async () => {
    await truncateAll();
  });

  it("duas mensagens quase juntas são processadas em ordem", async () => {
    const contact = await setupContact();
    const { startRun } = await import("@/lib/engine/engine");
    const { runId } = await startRun(contact.id, { demoShort: true });
    await say("sim");
    const [a, b] = await Promise.all([say("sim"), say("6")]);
    expect([a.event, b.event]).toEqual(["answer", "answer"]);
    const { db } = await import("@/db/client");
    const { answers } = await import("@/db/schema");
    const rows = await db.select().from(answers).where(eq(answers.runId, runId)).orderBy(asc(answers.createdAt));
    expect(rows.map((r) => [r.itemCode, r.valueNumeric])).toEqual([["TRUNK", 2], ["WPAI_Q5", 6]]);
  });

  it("webhook duplicado chegando junto responde uma vez só", async () => {
    const contact = await setupContact();
    const { startRun } = await import("@/lib/engine/engine");
    await startRun(contact.id, { demoShort: true });
    await say("sim");
    const results = await Promise.all([say("sim", "same-id"), say("sim", "same-id")]);
    expect(results.map((r) => r.event).sort()).toEqual(["answer", "duplicate"]);
  });

  it("CONTINUAR depois de recusar pede consentimento de novo", async () => {
    const contact = await setupContact();
    const { startRun } = await import("@/lib/engine/engine");
    await startRun(contact.id, { demoShort: true });
    await say("não quero");
    const r = await say("CONTINUAR");
    expect(r.event).not.toBe("resumed");
    expect(r.outbound.join("\n")).toMatch(/Vamos começar/i);
  });
});

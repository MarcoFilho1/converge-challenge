import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { asc, eq } from "drizzle-orm";
import { pushSchemaToTestDb, truncateAll } from "../helpers/db";

const PHONE = "5581999990001";
let n = 0;
const msgId = () => `wa-${Date.now()}-${n++}`;

async function setup() {
  const { db } = await import("@/db/client");
  const { contacts } = await import("@/db/schema");
  const [c] = await db.insert(contacts).values({ name: "Ana Teste", phoneE164: PHONE, sector: "Atendimento" }).returning();
  return c;
}

async function say(text: string, id = msgId()) {
  const { handleIncoming } = await import("@/lib/engine/engine");
  return handleIncoming({ phone: PHONE, text, waMessageId: id });
}

async function getRun(runId: string) {
  const { db } = await import("@/db/client");
  const { questionnaireRuns } = await import("@/db/schema");
  const [r] = await db.select().from(questionnaireRuns).where(eq(questionnaireRuns.id, runId));
  return r;
}

async function answersOf(runId: string) {
  const { db } = await import("@/db/client");
  const { answers } = await import("@/db/schema");
  return db.select().from(answers).where(eq(answers.runId, runId)).orderBy(asc(answers.createdAt));
}

beforeAll(() => pushSchemaToTestDb());
beforeEach(async () => {
  await truncateAll();
});

describe("motor do questionário", () => {
  it("demo: consentimento + 8 respostas do personagem termina em prioridade", async () => {
    const contact = await setup();
    const { startRun } = await import("@/lib/engine/engine");
    const start = await startRun(contact.id, { demoShort: true });
    expect(start.outbound[0]).toMatch(/aceita participar/i);

    const consent = await say("1");
    expect(consent.event).toBe("consent_ok");
    expect(consent.outbound.join("\n")).toContain("NOS ÚLTIMOS 30 DIAS");

    let last;
    for (const text of ["sim", "6", "4", "2", "2", "0", "4", "metas dobraram e não tenho apoio"]) last = await say(text);
    expect(last!.event).toBe("finished");
    expect(last!.outbound.join("\n")).toContain("188");

    const run = await getRun(start.runId);
    expect(run.status).toBe("done");
    expect(run.severity).toBe("priority");
    expect(await answersOf(start.runId)).toHaveLength(8);
  });

  it("recusa no consentimento encerra sem perguntas", async () => {
    const contact = await setup();
    const { startRun } = await import("@/lib/engine/engine");
    const { runId } = await startRun(contact.id, { demoShort: true });
    const r = await say("2");
    expect(r.event).toBe("declined");
    expect((await getRun(runId)).status).toBe("stopped");
  });

  it("resposta fora da escala repete uma vez e na segunda grava vazio e segue", async () => {
    const contact = await setup();
    const { startRun } = await import("@/lib/engine/engine");
    const { runId } = await startRun(contact.id, { demoShort: true });
    await say("1");
    await say("sim");
    const first = await say("11");
    expect(first.event).toBe("repeat");
    const second = await say("talvez");
    expect(second.event).toBe("answer");
    const rows = await answersOf(runId);
    expect(rows.find((a) => a.itemCode === "WPAI_Q5")?.valueNumeric).toBeNull();
  });

  it("frase de risco interrompe, manda 188 e CONTINUAR retoma no mesmo ponto", async () => {
    const contact = await setup();
    const { startRun } = await import("@/lib/engine/engine");
    const { runId } = await startRun(contact.id, { demoShort: true });
    await say("1");
    await say("sim");
    await say("6");
    const crisis = await say("às vezes quero sumir");
    expect(crisis.event).toBe("crisis");
    expect(crisis.outbound.join("\n")).toContain("188");
    const crisisRun = await getRun(runId);
    expect(crisisRun).toMatchObject({ status: "crisis", severity: "urgency" });

    const resumed = await say("CONTINUAR");
    expect(resumed.event).toBe("resumed");
    expect(resumed.outbound.join("\n")).toContain("mentalmente exausto");
    const newRun = await getRun(resumed.runId!);
    expect(newRun.resumedFromRunId).toBe(runId);
    expect(newRun.status).toBe("in_progress");
    expect(await answersOf(newRun.id)).toHaveLength(2);
  });

  it("item 9 maior que zero vira crise com urgência", async () => {
    const contact = await setup();
    const { startRun } = await import("@/lib/engine/engine");
    const { runId } = await startRun(contact.id, { demoShort: true });
    for (const t of ["1", "não", "1", "1", "0", "0"]) await say(t);
    const r = await say("1");
    expect(r.event).toBe("crisis");
    expect(await getRun(runId)).toMatchObject({ status: "crisis", severity: "urgency" });
  });

  it("PARAR encerra com escores parciais", async () => {
    const contact = await setup();
    const { startRun } = await import("@/lib/engine/engine");
    const { runId } = await startRun(contact.id, { demoShort: true });
    for (const t of ["1", "sim", "6"]) await say(t);
    const r = await say("parar");
    expect(r.event).toBe("stopped");
    expect(await getRun(runId)).toMatchObject({ status: "stopped", partial: true });
  });

  it("mesmo id de mensagem duas vezes não avança", async () => {
    const contact = await setup();
    const { startRun } = await import("@/lib/engine/engine");
    const { runId } = await startRun(contact.id, { demoShort: true });
    await say("1");
    const before = (await getRun(runId)).currentItem;
    await say("sim", "dup-1");
    const dup = await say("sim", "dup-1");
    expect(dup.event).toBe("duplicate");
    expect(dup.outbound).toEqual([]);
    expect((await getRun(runId)).currentItem).toBe(before + 1);
  });

  it("CONTINUAR no meio do questionário só repete a pergunta atual", async () => {
    const contact = await setup();
    const { startRun } = await import("@/lib/engine/engine");
    const { runId } = await startRun(contact.id, { demoShort: true });
    await say("1");
    await say("sim");
    const r = await say("continuar");
    expect(r.event).toBe("already_running");
    expect(r.outbound.join("\n")).toContain("Durante os últimos sete dias");
    expect((await getRun(runId)).retryCount).toBe(0);
  });

  it("número desconhecido recebe um aviso e não cria questionário", async () => {
    const { handleIncoming } = await import("@/lib/engine/engine");
    const r = await handleIncoming({ phone: "5581000000000", text: "oi", waMessageId: msgId() });
    expect(r.event).toBe("ignored_unknown");
    expect(r.outbound).toHaveLength(1);
    expect(r.runId).toBeNull();
  });

  it("frase de risco sem questionário ativo cria caso de urgência", async () => {
    await setup();
    const r = await say("penso em me matar");
    expect(r.event).toBe("crisis");
    expect(await getRun(r.runId!)).toMatchObject({ status: "crisis", severity: "urgency" });
  });

  it("roteiro completo pula a WPAI quando o tronco é não", async () => {
    const contact = await setup();
    const { startRun } = await import("@/lib/engine/engine");
    await startRun(contact.id, { demoShort: false });
    await say("1");
    const r = await say("não");
    expect(r.outbound.join("\n")).toContain("Pouco interesse ou pouco prazer");
  });
});

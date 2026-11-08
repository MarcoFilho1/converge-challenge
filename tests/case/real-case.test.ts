import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { pushSchemaToTestDb, truncateAll } from "../helpers/db";

const PHONE = "5581922220001";
let n = 0;
const say = async (text: string) => {
  const { handleIncoming } = await import("@/lib/engine/engine");
  return handleIncoming({ phone: PHONE, text, waMessageId: `case-${Date.now()}-${n++}` });
};

beforeAll(() => pushSchemaToTestDb());
beforeEach(async () => {
  await truncateAll();
});

describe("Caso real nunca mostra dado sintético", () => {
  it("crise sem questionário: só a mensagem real, sem indícios, resumo ou entrevista inventados", async () => {
    const { db } = await import("@/db/client");
    const { contacts } = await import("@/db/schema");
    await db.insert(contacts).values({ name: "Pessoa Caso Real", phoneE164: PHONE });
    const r = await say("penso em me matar");
    const { getCase } = await import("@/lib/case/query");
    const c = await getCase(r.runId!);
    expect(c.run.contactName).toBe("Pessoa Caso Real");
    expect(c.messages.map((m) => m.text).join(" ")).toContain("penso em me matar");
    expect(c.evidence).toEqual([]);
    expect(c.interviews).toEqual([]);
    expect(c.interviewDetail).toBeNull();
    expect(c.patient?.interview.state).toBe("nao_indicada");
    expect(JSON.stringify(c)).not.toMatch(/Mariana|fila de chamados/);
  });

  it("demo com BAT item 1 alto acende o critério C na trilha", async () => {
    const { db } = await import("@/db/client");
    const { contacts } = await import("@/db/schema");
    const [contact] = await db.insert(contacts).values({ name: "Pessoa Demo C", phoneE164: PHONE }).returning();
    const { startRun } = await import("@/lib/engine/engine");
    const { runId } = await startRun(contact.id, { demoShort: true });
    for (const t of ["sim", "sim", "6", "com frequência", "mais da metade dos dias", "mais da metade dos dias", "nunca", "sempre", "metas"]) await say(t);
    const { getCase } = await import("@/lib/case/query");
    const c = await getCase(runId);
    expect(c.run.severity).toBe("priority");
    expect(c.run.ruleTrace.hasClinicalSignal).toBe(true);
    expect(c.run.scores.find((x) => x.label === "PHQ-9 item 9")?.maxLabel).toBe("/3");
    expect(c.run.wellbeingIndex).toBe(20);
    expect(c.patient?.interview.state).toBe("convidada");
  });

  it("conversa marca o que veio de áudio e mostra como cada resposta foi entendida", async () => {
    const { db } = await import("@/db/client");
    const { contacts } = await import("@/db/schema");
    const [contact] = await db.insert(contacts).values({ name: "Pessoa Áudio", phoneE164: PHONE }).returning();
    const { startRun, handleIncoming } = await import("@/lib/engine/engine");
    const { runId } = await startRun(contact.id, { demoShort: true });
    await say("sim");
    await handleIncoming({ phone: PHONE, text: "sim, fui trabalhar gripado", waMessageId: `case-audio-${n++}`, viaAudio: true });
    await say("6");
    await say("acho que com frequência");
    const { getCase } = await import("@/lib/case/query");
    const c = await getCase(runId);
    const audio = c.messages.find((m) => m.text === "sim, fui trabalhar gripado");
    expect(audio).toMatchObject({ viaAudio: true, reading: { label: "sim", how: "regra" } });
    expect(c.messages.find((m) => m.text === "acho que com frequência")).toMatchObject({ viaAudio: false, reading: { label: "com frequência" } });
    expect(c.messages.find((m) => m.text === "6")?.reading).toMatchObject({ label: "6 de 10" });
  });

  it("id que não existe não vira caso sintético", async () => {
    const { getCase } = await import("@/lib/case/query");
    await expect(getCase("00000000-0000-4000-8000-000000000000")).rejects.toThrow();
  });
});

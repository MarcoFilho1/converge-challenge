import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { pushSchemaToTestDb, truncateAll } from "../helpers/db";

const PHONE = "5581999990004";
let n = 0;
const say = async (text: string) => {
  const { handleIncoming } = await import("@/lib/engine/engine");
  return handleIncoming({ phone: PHONE, text, waMessageId: `sev-${Date.now()}-${n++}` });
};

async function contact() {
  const { db } = await import("@/db/client");
  const { contacts } = await import("@/db/schema");
  const [c] = await db.insert(contacts).values({ name: "Dani Teste", phoneE164: PHONE, sector: "QA" }).returning();
  return c;
}

beforeAll(() => pushSchemaToTestDb());
beforeEach(async () => {
  await truncateAll();
});

describe("gravidade por pessoa", () => {
  it("urgência por crise continua valendo depois do CONTINUAR", async () => {
    const c = await contact();
    const { startRun } = await import("@/lib/engine/engine");
    await startRun(c.id, { demoShort: true });
    for (const t of ["sim", "sim", "2"]) await say(t);
    const crisis = await say("às vezes quero sumir");
    for (const t of ["CONTINUAR", "nunca", "nenhuma vez", "nenhuma vez", "nunca", "nunca", "fim"]) await say(t);

    const { listContactSeverities } = await import("@/lib/severity/contact");
    const [row] = await listContactSeverities();
    expect(row.contactId).toBe(c.id);
    expect(row.severity).toBe("urgency");
    expect(row.runId).toBe(crisis.runId);
    expect(row.openRuns).toBe(2);
  });

  it("caso encerrado pelo médico deixa de contar", async () => {
    const c = await contact();
    await say("penso em me matar");
    const { listContactSeverities } = await import("@/lib/severity/contact");
    const [before] = await listContactSeverities();
    expect(before.severity).toBe("urgency");

    const { db } = await import("@/db/client");
    const { questionnaireRuns } = await import("@/db/schema");
    await db.update(questionnaireRuns).set({ caseState: "encerrado" }).where(eq(questionnaireRuns.id, before.runId));
    expect(await listContactSeverities()).toEqual([]);
    void c;
  });

  it("ordena pessoas por gravidade e depois pelo mais recente", async () => {
    const { db } = await import("@/db/client");
    const { contacts, questionnaireRuns } = await import("@/db/schema");
    const people = await db
      .insert(contacts)
      .values([
        { name: "A", phoneE164: "5581900000001" },
        { name: "B", phoneE164: "5581900000002" },
        { name: "C", phoneE164: "5581900000003" },
      ])
      .returning();
    const t = (m: number) => new Date(Date.UTC(2026, 10, 7, 20, m));
    await db.insert(questionnaireRuns).values([
      { contactId: people[0].id, status: "done", severity: "attention", finishedAt: t(1) },
      { contactId: people[1].id, status: "done", severity: "priority", finishedAt: t(2) },
      { contactId: people[2].id, status: "done", severity: "priority", finishedAt: t(3) },
      { contactId: people[0].id, status: "in_progress", severity: "none" },
    ]);
    const { listContactSeverities } = await import("@/lib/severity/contact");
    expect((await listContactSeverities()).map((r) => r.contactName)).toEqual(["C", "B", "A"]);
  });
});

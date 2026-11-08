import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { pushSchemaToTestDb, truncateAll } from "../helpers/db";

beforeAll(() => pushSchemaToTestDb());
beforeEach(async () => {
  await truncateAll();
});

describe("Fila: uma linha por pessoa", () => {
  it("urgência por crise continua no topo depois de um questionário novo sem indício", async () => {
    const { db } = await import("@/db/client");
    const { contacts, questionnaireRuns } = await import("@/db/schema");
    const [c] = await db.insert(contacts).values({ name: "Pessoa Fila", phoneE164: "5581911110001" }).returning();
    const t = (m: number) => new Date(Date.UTC(2026, 10, 8, 1, m));
    const [crisis] = await db
      .insert(questionnaireRuns)
      .values({ contactId: c.id, status: "crisis", severity: "urgency", finishedAt: t(1) })
      .returning();
    await db.insert(questionnaireRuns).values({ contactId: c.id, status: "done", severity: "none", finishedAt: t(5) });

    const { listQueue } = await import("@/lib/queue/query");
    const { rows, isSyntheticFallback } = await listQueue();
    expect(isSyntheticFallback).toBe(false);
    expect(rows).toHaveLength(1);
    expect(rows[0].runId).toBe(crisis.id);
    expect(rows[0].severity).toBe("urgency");
  });

  it("caso encerrado pelo médico sai da fila", async () => {
    const { db } = await import("@/db/client");
    const { contacts, questionnaireRuns } = await import("@/db/schema");
    const [c] = await db.insert(contacts).values({ name: "Pessoa Encerrada", phoneE164: "5581911110002" }).returning();
    const [c2] = await db.insert(contacts).values({ name: "Pessoa Aberta", phoneE164: "5581911110003" }).returning();
    await db.insert(questionnaireRuns).values([
      { contactId: c.id, status: "done", severity: "priority", caseState: "encerrado", finishedAt: new Date() },
      { contactId: c2.id, status: "done", severity: "attention", finishedAt: new Date() },
    ]);
    const { listQueue } = await import("@/lib/queue/query");
    const { rows } = await listQueue();
    expect(rows.map((r) => r.contactName)).toEqual(["Pessoa Aberta"]);
  });
});

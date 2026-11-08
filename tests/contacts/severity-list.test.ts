import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { pushSchemaToTestDb, truncateAll } from "../helpers/db";

beforeAll(() => pushSchemaToTestDb());
beforeEach(async () => {
  await truncateAll();
});

describe("Contatos: gravidade por pessoa", () => {
  it("urgência anterior vale mesmo com questionário novo em andamento; sem avaliação = null", async () => {
    const { db } = await import("@/db/client");
    const { contacts, questionnaireRuns } = await import("@/db/schema");
    const [rui, nova] = await db
      .insert(contacts)
      .values([
        { name: "Rui Lista", phoneE164: "5581933330001" },
        { name: "Nova Lista", phoneE164: "5581933330002" },
      ])
      .returning();
    await db.insert(questionnaireRuns).values({ contactId: rui.id, status: "crisis", severity: "urgency", finishedAt: new Date(Date.now() - 60000) });
    await db.insert(questionnaireRuns).values({ contactId: rui.id, status: "in_progress", severity: "none" });
    void nova;

    const { listContactsWithRuns } = await import("@/lib/contacts/query");
    const { rows } = await listContactsWithRuns();
    const byName = Object.fromEntries(rows.map((r) => [r.name, r]));
    expect(byName["Rui Lista"].severity).toBe("urgency");
    expect(byName["Nova Lista"].severity).toBeNull();
  });
});

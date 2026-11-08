import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { pushSchemaToTestDb, truncateAll } from "../helpers/db";

describe("schema", () => {
  beforeAll(async () => {
    pushSchemaToTestDb();
    await truncateAll();
  });

  it("stores a contact and a pending questionnaire run", async () => {
    const { db } = await import("@/db/client");
    const { contacts, questionnaireRuns } = await import("@/db/schema");
    const [contact] = await db
      .insert(contacts)
      .values({ name: "Pessoa Teste", phoneE164: "5581999990001", sector: "Atendimento", role: "Analista" })
      .returning();
    const [run] = await db.insert(questionnaireRuns).values({ contactId: contact.id }).returning();
    const [read] = await db.select().from(questionnaireRuns).where(eq(questionnaireRuns.id, run.id));
    expect(read.status).toBe("pending");
    expect(read.severity).toBe("none");
    expect(read.partial).toBe(false);
  });

  it("stores a 1536-dim embedding and finds it by cosine distance", async () => {
    const { db } = await import("@/db/client");
    const { documents, documentChunks } = await import("@/db/schema");
    const { sql } = await import("drizzle-orm");
    const [doc] = await db
      .insert(documents)
      .values({ title: "Doc", kind: "norma", sourceUrl: "https://x", license: "pública", file: "x.pdf" })
      .returning();
    const vec = Array.from({ length: 1536 }, (_, i) => (i === 0 ? 1 : 0));
    await db.insert(documentChunks).values({ documentId: doc.id, page: 1, text: "trecho", embedding: vec });
    const rows = await db.execute(
      sql`select text from document_chunks order by embedding <=> ${JSON.stringify(vec)}::vector limit 1`,
    );
    expect(rows[0].text).toBe("trecho");
  });
});

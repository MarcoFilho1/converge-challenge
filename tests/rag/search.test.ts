import { beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { pushSchemaToTestDb } from "../helpers/db";
import { TEST_MANIFEST } from "../helpers/knowledge";

beforeAll(async () => {
  pushSchemaToTestDb();
  const { ingestDocuments } = await import("@/lib/rag/ingest");
  await ingestDocuments(TEST_MANIFEST, "knowledge");
});

describe("ingestão e busca", () => {
  it("grava documentos e trechos com vetor", async () => {
    const { db } = await import("@/db/client");
    const rows = await db.execute(sql`select count(*)::int as n from document_chunks`);
    expect(rows[0].n).toBeGreaterThan(10);
  });

  it("acha o trecho do item 9 do PHQ-9", async () => {
    const { searchChunks } = await import("@/lib/rag/search");
    const chunks = await searchChunks("pensamentos de morte item 9 se ferir", { k: 3 });
    expect(chunks.some((c) => c.documentTitle.includes("PHQ-9"))).toBe(true);
  });

  it("ficha em Markdown vira um trecho por seção, com o título da seção", async () => {
    const { searchChunks } = await import("@/lib/rag/search");
    const [top] = await searchChunks("item 9 pensamentos de morte ou autolesão", { k: 1, instruments: ["PHQ9"], kinds: ["instrumento"] });
    expect(top.text.startsWith("Item 9: pensamentos de morte ou autolesão")).toBe(true);
  });

  it("filtra pelos documentos de um instrumento", async () => {
    const { searchChunks } = await import("@/lib/rag/search");
    const chunks = await searchChunks("esgotamento no trabalho", { k: 3, instruments: ["BAT12"] });
    expect(chunks.length).toBeGreaterThan(0);
    for (const c of chunks) expect(c.documentTitle).toMatch(/BAT/);
  });

  it("filtra por tipo de documento", async () => {
    const { searchChunks } = await import("@/lib/rag/search");
    const chunks = await searchChunks("gerenciamento de riscos ocupacionais", { k: 3, kinds: ["norma"] });
    expect(chunks.length).toBeGreaterThan(0);
    for (const c of chunks) expect(c.documentTitle).toMatch(/NR-/);
  });

  it("ingerir de novo não duplica", async () => {
    const { db } = await import("@/db/client");
    const before = (await db.execute(sql`select count(*)::int as n from documents`))[0].n;
    const { ingestDocuments } = await import("@/lib/rag/ingest");
    await ingestDocuments(TEST_MANIFEST, "knowledge");
    const after = (await db.execute(sql`select count(*)::int as n from documents`))[0].n;
    expect(after).toBe(before);
  });
});

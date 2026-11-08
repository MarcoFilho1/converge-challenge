import path from "node:path";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { documentChunks, documents, type DocKind } from "@/db/schema";
import { getAi } from "@/lib/ai";
import { chunkText } from "./chunk";
import { extractText } from "./extract";

export type ManifestEntry = {
  file: string;
  title: string;
  kind: DocKind;
  license: string;
  sourceUrl: string;
  instruments: string[];
};

const EMBED_BATCH = 64;

/** Lê, divide, embeda e grava cada documento. Reingerir o mesmo arquivo substitui o anterior. */
export async function ingestDocuments(entries: ManifestEntry[], baseDir: string) {
  let totalChunks = 0;
  for (const entry of entries) {
    const { pages } = await extractText(path.join(baseDir, entry.file));
    const pieces = pages.flatMap((p) => chunkText(p.text).map((text) => ({ page: p.page, text })));
    const embeddings: number[][] = [];
    for (let i = 0; i < pieces.length; i += EMBED_BATCH) {
      embeddings.push(...(await getAi().embed(pieces.slice(i, i + EMBED_BATCH).map((p) => p.text))));
    }
    await db.transaction(async (tx) => {
      await tx.delete(documents).where(eq(documents.file, entry.file));
      const [doc] = await tx
        .insert(documents)
        .values({
          title: entry.title,
          file: entry.file,
          kind: entry.kind,
          license: entry.license,
          sourceUrl: entry.sourceUrl,
          instruments: entry.instruments,
        })
        .returning();
      for (let i = 0; i < pieces.length; i += 200) {
        await tx.insert(documentChunks).values(
          pieces.slice(i, i + 200).map((p, j) => ({
            documentId: doc.id,
            page: p.page,
            text: p.text,
            embedding: embeddings[i + j],
          })),
        );
      }
    });
    totalChunks += pieces.length;
  }
  return { documents: entries.length, chunks: totalChunks };
}

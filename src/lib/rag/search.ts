import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import type { DocKind } from "@/db/schema";
import { getAi, type Chunk } from "@/lib/ai";

/**
 * O Qwen3 Embedding rende melhor quando a pergunta de busca vem com uma instrução do que se procura
 * (os documentos são gravados sem ela). Com vetores locais, a pergunta vai como está.
 */
export function queryForEmbedding(query: string, env: Record<string, string | undefined> = process.env): string {
  if (env.AI_EMBEDDINGS !== "featherless") return query;
  return `Instruct: Dada a resposta de um trabalhador a um questionário de saúde ocupacional, encontre trechos de normas, guias e instrumentos validados que explicam esse sinal\nQuery: ${query}`;
}

/** Busca vetorial (distância de cosseno no pgvector), com filtro opcional por tipo de documento e por instrumento. */
export async function searchChunks(
  query: string,
  opts: { k?: number; kinds?: DocKind[]; instruments?: string[] } = {},
): Promise<Chunk[]> {
  const k = opts.k ?? 5;
  const [vector] = await getAi().embed([queryForEmbedding(query)]);
  const vec = JSON.stringify(vector);
  const kindFilter = opts.kinds?.length
    ? sql`and d.kind = any(array[${sql.join(opts.kinds.map((x) => sql`${x}`), sql`, `)}]::doc_kind[])`
    : sql``;
  const instrumentFilter = opts.instruments?.length
    ? sql`and d.instruments && array[${sql.join(opts.instruments.map((x) => sql`${x}`), sql`, `)}]::text[]`
    : sql``;
  const rows = await db.execute(sql`
    select c.id, c.page, c.text, d.title
    from document_chunks c
    join documents d on d.id = c.document_id
    where true ${kindFilter} ${instrumentFilter}
    order by c.embedding <=> ${vec}::vector
    limit ${k}
  `);
  return rows.map((r) => ({
    id: String(r.id),
    documentTitle: String(r.title),
    page: r.page === null ? null : Number(r.page),
    text: String(r.text),
  }));
}

import { config } from "dotenv";
config({ path: ".env" });

async function main() {
  const { readFile } = await import("node:fs/promises");
  const { ingestDocuments } = await import("../src/lib/rag/ingest");
  const manifest = JSON.parse(await readFile("knowledge/manifest.json", "utf8"));
  const started = Date.now();
  const out = await ingestDocuments(manifest, "knowledge");
  console.log(`Base ingerida: ${out.documents} documentos, ${out.chunks} trechos (${((Date.now() - started) / 1000).toFixed(1)} s, IA=${process.env.AI_PROVIDER ?? "mock"})`);
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});

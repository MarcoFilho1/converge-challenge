import { config } from "dotenv";
config({ path: ".env" });

/**
 * Confere a chave da IA real em menos de um minuto, sem tocar no banco.
 * Uso: preencha AI_GATEWAY_API_KEY no .env e rode `pnpm ai:check`.
 */
async function main() {
  if (!process.env.AI_GATEWAY_API_KEY) {
    console.log("AI_GATEWAY_API_KEY está vazio no .env. Preencha a chave e rode de novo.");
    process.exit(1);
  }
  const { embedMany, gateway, generateText, Output } = await import("ai");
  const { z } = await import("zod");
  const chat = process.env.AI_CHAT_MODEL ?? "anthropic/claude-sonnet-5-5";
  const emb = process.env.AI_EMBEDDING_MODEL ?? "openai/text-embedding-3-small";
  let ok = true;

  const t1 = Date.now();
  try {
    const { embeddings } = await embedMany({ model: gateway.embeddingModel(emb), values: ["cansaço no trabalho"] });
    const dims = embeddings[0].length;
    const good = dims === 1536;
    ok &&= good;
    console.log(`${good ? "OK  " : "FALHOU"} Embeddings (${emb}): ${dims} dimensões, ${Date.now() - t1} ms${good ? "" : " — o banco espera 1536"}`);
  } catch (e) {
    ok = false;
    console.log(`FALHOU Embeddings (${emb}): ${(e as Error).message}`);
  }

  const t2 = Date.now();
  try {
    const { output } = await generateText({
      model: chat,
      temperature: 0,
      output: Output.object({ schema: z.object({ value: z.number().nullable() }) }),
      prompt: 'Escala 0 nenhuma vez, 1 vários dias, 2 mais da metade dos dias, 3 quase todos os dias. Resposta: "quase todo dia". Devolva o valor.',
    });
    const good = output.value === 3;
    ok &&= good;
    console.log(`${good ? "OK  " : "FALHOU"} Chat (${chat}): interpretou "quase todo dia" como ${output.value}, ${Date.now() - t2} ms`);
  } catch (e) {
    ok = false;
    console.log(`FALHOU Chat (${chat}): ${(e as Error).message}`);
  }

  if (ok) {
    console.log("\nChave funcionando. Para ligar a IA real:");
    console.log("  1. No .env, troque AI_PROVIDER=mock por AI_PROVIDER=gateway");
    console.log("  2. Rode `pnpm ingest` de novo (os vetores mudam de espaço)");
    console.log("  3. Rode `pnpm evals` para conferir origem, termos e crise com a IA real");
  }
  process.exit(ok ? 0 : 1);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});

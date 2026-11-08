import { config } from "dotenv";
config({ path: ".env" });

/**
 * Confere as chaves da IA real em menos de um minuto, sem tocar no banco.
 * Testa cada alvo (modelo × chave da Featherless, ou o AI Gateway) e, se houver AI_GATEWAY_API_KEY, os vetores.
 * Uso: `pnpm ai:check`.
 */
async function main() {
  const { generateText, Output, embedMany, gateway } = await import("ai");
  const { z } = await import("zod");
  const { chatTargets, hasChatKey } = await import("../src/lib/ai/llm");
  if (!hasChatKey()) {
    console.log("Nenhuma chave de IA no .env (FEATHERLESS_API_KEY_1 ou AI_GATEWAY_API_KEY).");
    process.exit(1);
  }
  let working = 0;
  for (const target of chatTargets()) {
    const t = Date.now();
    try {
      const { output, usage } = await generateText({
        model: target.model,
        temperature: 0,
        maxRetries: 0,
        abortSignal: AbortSignal.timeout(30_000),
        output: Output.object({ schema: z.object({ value: z.number().nullable() }) }),
        prompt: 'Escala 0 nenhuma vez, 1 vários dias, 2 mais da metade dos dias, 3 quase todos os dias. Resposta: "quase todo dia". Devolva o valor.',
      });
      const good = output.value === 3;
      if (good) working++;
      const cost = (usage.raw as { cost?: number } | undefined)?.cost;
      console.log(`${good ? "OK  " : "FALHOU"} ${target.label}: "quase todo dia" → ${output.value}, ${Date.now() - t} ms${cost !== undefined ? `, US$ ${cost.toFixed(6)}` : ""}`);
    } catch (e) {
      console.log(`FALHOU ${target.label}: ${(e as Error).message.slice(0, 160)}`);
    }
  }
  if (process.env.AI_GATEWAY_API_KEY) {
    const emb = process.env.AI_EMBEDDING_MODEL ?? "openai/text-embedding-3-small";
    try {
      const { embeddings } = await embedMany({ model: gateway.embeddingModel(emb), values: ["cansaço no trabalho"] });
      console.log(`${embeddings[0].length === 1536 ? "OK  " : "FALHOU"} Vetores (${emb}): ${embeddings[0].length} dimensões`);
    } catch (e) {
      console.log(`FALHOU Vetores (${emb}): ${(e as Error).message}`);
    }
  } else {
    console.log("Vetores: locais (sem AI Gateway). A busca usa o índice já gravado.");
  }
  console.log(working > 0 ? `\n${working} alvo(s) funcionando. Se um ficar sem crédito, o sistema passa para o próximo.` : "\nNenhum alvo funcionando.");
  process.exit(working > 0 ? 0 : 1);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});

import { embedMany, gateway, generateText, Output } from "ai";
import { z } from "zod";
import { CLASSIFY_SYSTEM, INTERPRET_SYSTEM, SUMMARY_SYSTEM } from "./prompts";
import { ClassificationSchema, RunSummarySchema, type AiProvider } from "./types";
import { createMockProvider } from "./mock";
import { EMBEDDING_DIMENSIONS } from "@/db/schema";

const chatModel = () => process.env.AI_CHAT_MODEL ?? "anthropic/claude-sonnet-5-5";
const embeddingModel = () => process.env.AI_EMBEDDING_MODEL ?? "openai/text-embedding-3-small";

/** Falha do modelo nunca derruba a conversa: registra e usa o caminho simulado. */
async function orFallback<T>(label: string, real: () => Promise<T>, fallback: () => Promise<T>): Promise<T> {
  try {
    return await real();
  } catch (err) {
    console.error(`[ai:gateway] ${label} falhou; usando modo simulado`, err);
    return fallback();
  }
}

export function createGatewayProvider(): AiProvider {
  const local = createMockProvider();
  return {
    // Sem fallback: misturar vetores reais e simulados no mesmo índice estragaria a busca.
    async embed(texts) {
      const { embeddings } = await embedMany({ model: gateway.embeddingModel(embeddingModel()), values: texts });
      const wrong = embeddings.find((e) => e.length !== EMBEDDING_DIMENSIONS);
      if (wrong) {
        throw new Error(
          `Modelo de embedding devolveu ${wrong.length} dimensões; o banco espera ${EMBEDDING_DIMENSIONS}. Use AI_EMBEDDING_MODEL=openai/text-embedding-3-small.`,
        );
      }
      return embeddings;
    },

    async interpretAnswer(item, text) {
      const quick = await local.interpretAnswer(item, text);
      if (quick !== null || !item.scale) return quick;
      const scale = item.scale;
      return orFallback(
        "interpretAnswer",
        async () => {
          const { output } = await generateText({
            model: chatModel(),
            system: INTERPRET_SYSTEM,
            temperature: 0,
            output: Output.object({ schema: z.object({ value: z.number().nullable() }) }),
            prompt: JSON.stringify({ item: item.text, scale, resposta: text }),
          });
          const v = output.value;
          return v !== null && v >= scale.min && v <= scale.max ? v : null;
        },
        async () => null,
      );
    },

    async classifyAnswer(input) {
      if (input.chunks.length === 0) return { relevante: false, tema: input.item.instrument, explicacao: "", trechos: [] };
      return orFallback(
        "classifyAnswer",
        async () => {
          const { output } = await generateText({
            model: chatModel(),
            system: CLASSIFY_SYSTEM,
            temperature: 0,
            output: Output.object({ schema: ClassificationSchema }),
            prompt: JSON.stringify(input),
          });
          const allowed = new Set(input.chunks.map((c) => c.id));
          const trechos = output.trechos.filter((t) => allowed.has(t.chunkId));
          return { ...output, trechos, relevante: output.relevante && trechos.length > 0 };
        },
        () => local.classifyAnswer(input),
      );
    },

    async summarizeRun(input) {
      return orFallback(
        "summarizeRun",
        async () => {
          const { output } = await generateText({
            model: chatModel(),
            system: SUMMARY_SYSTEM,
            temperature: 0,
            output: Output.object({ schema: RunSummarySchema }),
            prompt: JSON.stringify(input),
          });
          return output;
        },
        () => local.summarizeRun(input),
      );
    },
  };
}

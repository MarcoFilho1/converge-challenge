import { embedMany, gateway, generateText, Output } from "ai";
import { z } from "zod";
import { CLASSIFY_SYSTEM, INTERPRET_SYSTEM, SUMMARY_SYSTEM } from "./prompts";
import { ClassificationSchema, RunSummarySchema, type AiProvider } from "./types";
import { createMockProvider } from "./mock";
import { chatCallOptions, featherlessEmbed, featherlessKeys, withChat } from "./llm";
import { recordEvent } from "@/lib/obs/events";
import { EMBEDDING_DIMENSIONS } from "@/db/schema";

const embeddingModel = () => process.env.AI_EMBEDDING_MODEL ?? "openai/text-embedding-3-small";

const STAGE: Record<string, string> = { interpretAnswer: "interpretar", classifyAnswer: "classificar", summarizeRun: "resumo do questionário" };

/** Falha do modelo nunca derruba a conversa: registra e usa o caminho simulado. */
async function orFallback<T>(label: string, real: () => Promise<T>, fallback: () => Promise<T>): Promise<T> {
  try {
    return await real();
  } catch (err) {
    console.error(`[ai:gateway] ${label} falhou; usando modo simulado`, err);
    recordEvent({ kind: STAGE[label] ?? label, outcome: "modo_simples", detail: "nenhum modelo respondeu; usado o caminho simples" });
    return fallback();
  }
}

export function createGatewayProvider(): AiProvider {
  const local = createMockProvider();
  return {
    // Sem fallback: misturar vetores reais e simulados no mesmo índice estragaria a busca.
    async embed(texts) {
      // Sem AI Gateway: Qwen3 Embedding da Featherless se AI_EMBEDDINGS=featherless (a base precisa ser reingerida
      // com o mesmo modelo); senão vetores locais, no mesmo espaço do índice já gravado.
      if (!process.env.AI_GATEWAY_API_KEY) {
        if (process.env.AI_EMBEDDINGS === "featherless" && featherlessKeys().length > 0) return featherlessEmbed(texts, EMBEDDING_DIMENSIONS);
        return local.embed(texts);
      }
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
          const { output } = await withChat((model) => generateText({
            model,
            ...chatCallOptions("fast"),
            system: INTERPRET_SYSTEM,
            temperature: 0,
            output: Output.object({ schema: z.object({ value: z.number().nullable() }) }),
            prompt: JSON.stringify({ item: item.text, scale, resposta: text }),
          }), "fast", "interpretar");
          const v = output.value;
          const value = v !== null && v >= scale.min && v <= scale.max ? v : null;
          recordEvent({ kind: "valor da resposta", outcome: value === null ? "descartado" : "ok", model: "IA", detail: `“${text}” → ${value ?? "sem valor"} (IA)` });
          return value;
        },
        async () => null,
      );
    },

    async classifyAnswer(input) {
      if (input.chunks.length === 0) return { relevante: false, tema: input.item.instrument, explicacao: "", trechos: [] };
      return orFallback(
        "classifyAnswer",
        async () => {
          const { output } = await withChat((model) => generateText({
            model,
            ...chatCallOptions("long"),
            system: CLASSIFY_SYSTEM,
            temperature: 0,
            output: Output.object({ schema: ClassificationSchema }),
            prompt: JSON.stringify(input),
          }), "long", "classificar");
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
          const { output } = await withChat((model) => generateText({
            model,
            ...chatCallOptions("long"),
            system: SUMMARY_SYSTEM,
            temperature: 0,
            output: Output.object({ schema: RunSummarySchema }),
            prompt: JSON.stringify(input),
          }), "long", "resumo do questionário");
          return output;
        },
        () => local.summarizeRun(input),
      );
    },
  };
}

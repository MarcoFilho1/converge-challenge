import { embedMany, gateway, generateText, Output } from "ai";
import { z } from "zod";
import { CLASSIFY_SYSTEM, INTERPRET_SYSTEM, SUMMARY_SYSTEM } from "./prompts";
import { ClassificationSchema, RunSummarySchema, type AiProvider } from "./types";
import { createMockProvider } from "./mock";

const chatModel = () => process.env.AI_CHAT_MODEL ?? "anthropic/claude-sonnet-5-5";
const embeddingModel = () => process.env.AI_EMBEDDING_MODEL ?? "openai/text-embedding-3-small";

export function createGatewayProvider(): AiProvider {
  const local = createMockProvider();
  return {
    async embed(texts) {
      const { embeddings } = await embedMany({ model: gateway.embeddingModel(embeddingModel()), values: texts });
      return embeddings;
    },

    async interpretAnswer(item, text) {
      const quick = await local.interpretAnswer(item, text);
      if (quick !== null || !item.scale) return quick;
      const { output } = await generateText({
        model: chatModel(),
        system: INTERPRET_SYSTEM,
        temperature: 0,
        output: Output.object({ schema: z.object({ value: z.number().nullable() }) }),
        prompt: JSON.stringify({ item: item.text, scale: item.scale, resposta: text }),
      });
      const v = output.value;
      return v !== null && v >= item.scale.min && v <= item.scale.max ? v : null;
    },

    async classifyAnswer(input) {
      if (input.chunks.length === 0) return { relevante: false, tema: input.item.instrument, explicacao: "", trechos: [] };
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

    async summarizeRun(input) {
      const { output } = await generateText({
        model: chatModel(),
        system: SUMMARY_SYSTEM,
        temperature: 0,
        output: Output.object({ schema: RunSummarySchema }),
        prompt: JSON.stringify(input),
      });
      return output;
    },
  };
}

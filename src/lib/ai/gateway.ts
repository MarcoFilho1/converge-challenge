import { embedMany, gateway, generateText, Output } from "ai";
import { z } from "zod";
import { CLASSIFY_SYSTEM, INTERPRET_SYSTEM, READ_REPLY_SYSTEM, SUMMARY_SYSTEM } from "./prompts";
import { readReplyLocal } from "./read-local";
import { normalizeText } from "@/lib/crisis/detect";
import type { Item } from "@/lib/instruments/types";
import { ClassificationSchema, RunSummarySchema, type AiProvider } from "./types";
import { createMockProvider } from "./mock";
import { chatCallOptions, featherlessEmbed, featherlessKeys, withChat } from "./llm";
import { recordEvent } from "@/lib/obs/events";
import { EMBEDDING_DIMENSIONS } from "@/db/schema";

const ReadReplySchema = z.object({
  intent: z.enum(["answer", "yes", "no", "doubt", "stop", "skip", "correction", "other"]),
  value: z.number().nullable(),
  quote: z.string().nullable(),
  confidence: z.enum(["alta", "baixa"]),
  mentions: z.array(z.string()),
});

/** Item para o prompt: texto e escala como valor → rótulo (ou faixa de 0 a 10). */
function describeItem(item: Item | null) {
  if (!item) return null;
  const s = item.scale;
  const escala = !s ? "resposta aberta" : s.labels ? s.labels.map((l, i) => `${s.min + i} = ${l}`).join("; ") : `número de ${s.min} a ${s.max}${item.scaleLine ? ` (${item.scaleLine})` : ""}`;
  return { codigo: item.code, texto: item.text, escala };
}

/** Mensagem que já é exatamente um rótulo, um sim ou um não: a regra local basta, sem gastar IA. */
function isTrivial(text: string): boolean {
  const n = normalizeText(text).replace(/[!.]+$/g, "").trim();
  return n.split(/\s+/).length <= 4 && /^(sim|nao|nunca|sempre|raramente|frequentemente|com frequencia|algumas vezes|as vezes|nenhuma vez|varios dias|mais da metade dos dias|quase todos os dias|parar)$/.test(n);
}

const embeddingModel = () => process.env.AI_EMBEDDING_MODEL ?? "openai/text-embedding-3-small";

const STAGE: Record<string, string> = { readReply: "ler resposta", interpretAnswer: "interpretar", classifyAnswer: "classificar", summarizeRun: "resumo do questionário" };

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

    async readReply(input) {
      const local = readReplyLocal(input);
      if (isTrivial(input.text)) return local;
      return orFallback(
        "readReply",
        async () => {
          const { output } = await withChat((model) => generateText({
            model,
            ...chatCallOptions("fast"),
            system: READ_REPLY_SYSTEM,
            temperature: 0,
            output: Output.object({ schema: ReadReplySchema }),
            prompt: JSON.stringify({
              stage: input.stage,
              item: describeItem(input.item),
              anterior: describeItem(input.previous),
              proximos: input.upcoming,
              mensagem: input.text,
            }),
          }), "fast", "ler resposta");
          const allowed = new Set(input.upcoming.map((u) => u.code));
          const reading = { ...output, value: Number.isFinite(output.value) ? output.value : null, mentions: output.mentions.filter((c) => allowed.has(c)), source: "ia" as const };
          recordEvent({ kind: "leitura da resposta", outcome: "ok", model: "IA", detail: `“${input.text.slice(0, 80)}” → ${reading.intent}${reading.value !== null ? ` ${reading.value}` : ""} (${reading.confidence})` });
          return reading;
        },
        async () => local,
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

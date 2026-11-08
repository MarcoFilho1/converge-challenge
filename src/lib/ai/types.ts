import { z } from "zod";
import type { Item, Score } from "@/lib/instruments/types";

export type Chunk = { id: string; documentTitle: string; page: number | null; text: string };

export const ClassificationSchema = z.object({
  relevante: z.boolean(),
  tema: z.string(),
  explicacao: z.string(),
  trechos: z.array(
    z.object({
      chunkId: z.string(),
      documento: z.string(),
      pagina: z.number().nullable(),
      texto: z.string(),
    }),
  ),
});
export type Classification = z.infer<typeof ClassificationSchema>;

const Cited = z.object({ texto: z.string(), origem: z.array(z.string()) });

export const RunSummarySchema = z.object({
  dificuldades_relatadas: z.array(z.object({ relato: z.string(), origem: z.array(z.string()) })),
  impacto_funcional: Cited,
  fatores_do_trabalho: z.array(Cited),
  pontos_para_avaliar: z.array(Cited),
  nao_respondido: z.array(z.string()),
});
export type RunSummary = z.infer<typeof RunSummarySchema>;

export type ClassifyInput = { item: Item; answerText: string; value: number | null; chunks: Chunk[] };

export type RunContext = {
  answers: { item: Item; rawText: string; value: number | null }[];
  scores: Score[];
  evidence: { itemCode: string; theme: string; explanation: string }[];
  missingInstruments: string[];
};

/** Em que ponto da conversa a mensagem chegou. */
export type ReplyStage = "consent" | "item" | "confirm";
export type ReadReplyInput = {
  stage: ReplyStage;
  /** Item atual (null no consentimento). */
  item: Item | null;
  /** Item anterior, para a pessoa corrigir a resposta que acabou de dar. */
  previous: Item | null;
  /** Até 3 próximos itens: a IA aponta se a fala já tocou neles (só muda a frase de ligação, nunca preenche). */
  upcoming: { code: string; text: string }[];
  text: string;
};
export type ReplyIntent = "answer" | "yes" | "no" | "doubt" | "stop" | "skip" | "correction" | "other";
/** O que a IA (ou a regra local) propõe. Quem decide se grava é o conferidor em código (engine/reading.ts). */
export type ReplyReading = {
  intent: ReplyIntent;
  /** Valor na escala do item atual (ou do anterior, quando intent = correction). */
  value: number | null;
  /** Trecho literal da fala que sustenta o valor. */
  quote: string | null;
  confidence: "alta" | "baixa";
  /** Códigos de `upcoming` que a fala já abordou. */
  mentions: string[];
  source: "ia" | "regra";
};

export interface AiProvider {
  embed(texts: string[]): Promise<number[][]>;
  /** Legado: só valor. O motor usa readReply. */
  interpretAnswer(item: Item, text: string): Promise<number | null>;
  /** Lê a mensagem do colaborador: intenção, valor proposto, trecho literal e próximos itens já abordados. */
  readReply(input: ReadReplyInput): Promise<ReplyReading>;
  classifyAnswer(input: ClassifyInput): Promise<Classification>;
  summarizeRun(input: RunContext): Promise<RunSummary>;
}

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

export interface AiProvider {
  embed(texts: string[]): Promise<number[][]>;
  interpretAnswer(item: Item, text: string): Promise<number | null>;
  classifyAnswer(input: ClassifyInput): Promise<Classification>;
  summarizeRun(input: RunContext): Promise<RunSummary>;
}

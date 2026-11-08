/**
 * Camada de IA da entrevista por voz. Separada de src/lib/ai/types.ts para não colidir com o MVP1.
 * O LLM só: extrai o que foi dito, redige 1 frase de acolhimento e monta o resumo. Nunca escolhe a pergunta.
 */
import { z } from "zod";
import type { Agenda } from "@/lib/interview/agenda";
import type { InterviewSummary } from "@/lib/interview/contract";
import { FINDING_THEMES, type BlockId, type Finding, type Turn } from "@/lib/interview/types";
import { createInterviewGateway } from "./interview-gateway";
import { createInterviewMock } from "./interview-mock";
import { aiMode } from "./index";

export const FindingDraftSchema = z.object({
  tema: z.enum(FINDING_THEMES as [string, ...string[]]).transform((t) => t as Finding["tema"]),
  texto: z.string(),
  duracao: z.string().nullable(),
  intensidade: z.enum(["leve", "moderada", "forte"]).nullable(),
  mencionaTrabalho: z.boolean(),
  pediuParar: z.boolean(),
});
export type FindingDraft = Omit<Finding, "turnIdx" | "blockId">;

export interface InterviewAi {
  extractFindings(input: { blockId: BlockId; probeText: string; text: string }): Promise<FindingDraft[]>;
  phraseAck(input: { lastText: string; findings: FindingDraft[]; probeText: string }): Promise<string>;
  summarize(input: { turns: Turn[]; findings: Finding[]; agenda: Agenda; skipped: BlockId[] }): Promise<InterviewSummary>;
}

let cached: { mode: string; ai: InterviewAi } | null = null;

/** AI_PROVIDER=featherless ou gateway usa o modelo real; qualquer outro valor usa o mock. */
export function getInterviewAi(): InterviewAi {
  const mode = aiMode();
  if (cached?.mode !== mode) {
    cached = { mode, ai: mode === "real" ? createInterviewGateway() : createInterviewMock() };
  }
  return cached.ai;
}

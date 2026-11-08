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

/** O que a IA decide numa fala, numa chamada só: o que foi dito, a reação e o que vem depois. */
export type TurnPlan = {
  achados: FindingDraft[];
  reacao: string;
  proxima: "sonda" | "aprofundar" | "seguir";
  sondaId: string | null;
  pergunta: string | null;
};

export type PlanInput = {
  blockId: BlockId;
  blockLabel: string;
  lastQuestion: string;
  lastText: string;
  recent: { speaker: "ai" | "person"; text: string }[];
  recentReactions: string[];
  candidates: { id: string; text: string }[];
  allowFollowUp: boolean;
  nextBlockQuestion: string | null;
  /** Perguntas-base dos blocos que ainda vêm: o aprofundamento não pode adiantar esses assuntos. */
  upcomingQuestions: string[];
  /** O que a pessoa já contou na entrevista (para não perguntar de novo). */
  alreadySaid: string[];
};

export const TurnPlanSchema = z.object({
  achados: z.array(FindingDraftSchema),
  reacao: z.string(),
  proxima: z.enum(["sonda", "aprofundar", "seguir"]),
  sondaId: z.string().nullable(),
  pergunta: z.string().nullable(),
});

export interface InterviewAi {
  extractFindings(input: { blockId: BlockId; probeText: string; text: string }): Promise<FindingDraft[]>;
  phraseAck(input: { lastText: string; findings: FindingDraft[]; probeText: string; recentReactions?: string[]; recent?: PlanInput["recent"] }): Promise<string>;
  /** Uma chamada por fala (extrair + reagir + decidir). Sem ela, o motor usa extractFindings + phraseAck. */
  planTurn?(input: PlanInput): Promise<TurnPlan>;
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

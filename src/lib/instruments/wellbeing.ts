/**
 * Índice de bem-estar de 0 a 100 (100 = melhor), calculado em código a partir das respostas.
 *
 * Cada resposta de escala vira "quanto pesa" de 0 a 1 na própria escala; cada instrumento é a média
 * das suas respostas; o índice é 100 × (1 − média dos instrumentos). Assim todo instrumento pesa igual,
 * por mais itens que tenha. O item 9 do PHQ-9 fica de fora: risco é tratado pelo corte de crise.
 *
 * É um resumo para ordenar e decidir o convite, não um instrumento validado. A gravidade continua
 * sendo a regra de cada instrumento (severity.ts).
 */
import { getItems } from "./items";
import type { SeverityLevel } from "./severity";
import type { Answers } from "./types";

const OUTSIDE_INDEX = new Set(["PHQ9_9"]);

export function wellbeingIndex(answers: Answers, demoShort: boolean): number | null {
  const byInstrument = new Map<string, number[]>();
  for (const item of getItems(demoShort)) {
    const value = answers[item.code];
    if (!item.scale || OUTSIDE_INDEX.has(item.code) || value === null || value === undefined) continue;
    const { min, max, higherIsWorse } = item.scale;
    if (max === min) continue;
    const weight = higherIsWorse ? (value - min) / (max - min) : (max - value) / (max - min);
    byInstrument.set(item.instrument, [...(byInstrument.get(item.instrument) ?? []), Math.min(1, Math.max(0, weight))]);
  }
  if (byInstrument.size === 0) return null;
  const means = [...byInstrument.values()].map((ws) => ws.reduce((a, b) => a + b, 0) / ws.length);
  const burden = means.reduce((a, b) => a + b, 0) / means.length;
  return Math.round(100 * (1 - burden));
}

/** Limite do convite automático (INTERVIEW_INVITE_THRESHOLD, padrão 70). */
export const inviteThreshold = () => Number(process.env.INTERVIEW_INVITE_THRESHOLD ?? 70);

/**
 * Convida para a entrevista quem tem índice abaixo do limite ou indício pela regra validada.
 * Urgência nunca: quem está em risco precisa de contato humano, não de uma entrevista com IA.
 */
export function shouldInviteToInterview(input: { severity: SeverityLevel; index: number | null; threshold: number }): boolean {
  if (input.severity === "urgency") return false;
  if (input.severity === "priority" || input.severity === "attention") return true;
  return input.index !== null && input.index < input.threshold;
}

import { assertNoForbidden } from "@/lib/ai/forbidden-terms";
import { normalizeText } from "@/lib/crisis/detect";

/** Padrões de conselho: a entrevistadora reflete e pergunta, nunca orienta. Aplicados ao texto normalizado. */
export const ADVICE_PATTERNS: RegExp[] = [
  /\bvoce dev(eria|ia|e)\b/,
  /\bprocure\b/,
  /\btente\b/,
  /\be importante que voce\b/,
  /\brecomendo\b/,
  /\bsugiro\b/,
  /\bo ideal e\b/,
  /\bfaca\b/,
];

export function hasAdvice(text: string): boolean {
  const n = normalizeText(text);
  return ADVICE_PATTERNS.some((p) => p.test(n));
}

/** Texto gerado pelo LLM só sai se estiver limpo; senão, vazio. */
export function cleanGenerated(text: string): string {
  const t = text.trim();
  if (!t) return "";
  if (assertNoForbidden(t).length > 0 || hasAdvice(t)) return "";
  return t;
}

/**
 * Padrões de risco que faltam em src/lib/crisis/patterns.ts (achados pelos evals da entrevista).
 * Aplicados ALÉM do detector do MVP1, nunca em vez dele. Avisar o dono do MVP1 para incorporar.
 */
export const EXTRA_CRISIS_PATTERNS: RegExp[] = [
  /\b(pensado|pensei|penso|pensando|pensamentos?) (em|de) (morrer|me matar|sumir|desaparecer|me machucar)\b/,
  /\bvontade de (morrer|sumir|desaparecer|nao existir)\b/,
];

export function extraCrisis(text: string): boolean {
  const n = normalizeText(text);
  return EXTRA_CRISIS_PATTERNS.some((p) => p.test(n));
}

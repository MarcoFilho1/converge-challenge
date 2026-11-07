import { normalizeText } from "@/lib/crisis/detect";

/** Termos que nunca aparecem em texto gerado para o colaborador ou o médico. */
export const FORBIDDEN_TERMS = [
  "você tem",
  "você está com",
  "diagnóstico",
  "burnout",
  "depressão",
  "transtorno",
  "doença mental",
];

export function assertNoForbidden(text: string): string[] {
  const normalized = normalizeText(text);
  return FORBIDDEN_TERMS.filter((term) => normalized.includes(normalizeText(term)));
}

export const FORBIDDEN_REPLACEMENT = "[texto removido: termo não permitido]";

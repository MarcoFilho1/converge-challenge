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

/**
 * Termos proibidos encontrados no texto. `allow` remove antes trechos legítimos que contêm o termo,
 * como o texto validado de um item ("Você tem um alto grau de influência…", COPSOQ 4A).
 */
export function assertNoForbidden(text: string, opts: { allow?: string[] } = {}): string[] {
  let normalized = normalizeText(text);
  for (const phrase of opts.allow ?? []) normalized = normalized.split(normalizeText(phrase)).join(" ");
  return FORBIDDEN_TERMS.filter((term) => normalized.includes(normalizeText(term)));
}

export const FORBIDDEN_REPLACEMENT = "[texto removido: termo não permitido]";

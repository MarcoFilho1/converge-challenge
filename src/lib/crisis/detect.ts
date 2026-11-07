import { CRISIS_PATTERNS } from "./patterns";

export function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function detectCrisis(text: string): { hit: boolean; pattern?: string } {
  const normalized = normalizeText(text);
  const match = CRISIS_PATTERNS.find((pattern) => pattern.test(normalized));
  return match ? { hit: true, pattern: match.source } : { hit: false };
}

/**
 * Conferidor da leitura da resposta: a IA (ou a regra local) propõe, este código decide se grava,
 * pede confirmação ou descarta. Puro, sem banco.
 */
import { normalizeText } from "@/lib/crisis/detect";
import type { Item } from "@/lib/instruments/types";
import type { ReplyReading } from "@/lib/ai/types";

export type Verdict =
  | { kind: "accept"; value: number; quote: string; source: "ia" | "regra" }
  | { kind: "confirm"; value: number; quote: string }
  | { kind: "reject" };

/** Negação explícita: único jeito de gravar "nenhuma vez" no item 9 sem confirmar. */
const EXPLICIT_NO = /\b(nunca|nenhuma vez|nenhum dia|nao|jamais|em nenhum momento)\b/;

export function judgeReading(item: Item, text: string, r: ReplyReading): Verdict {
  const scale = item.scale;
  if (!scale || r.value === null || !Number.isInteger(r.value) || r.value < scale.min || r.value > scale.max) return { kind: "reject" };
  const quote = r.quote?.trim() ?? "";
  const nQuote = normalizeText(quote);
  if (!nQuote || !normalizeText(text).includes(nQuote)) return { kind: "reject" };
  const hasDigit = /\d/.test(nQuote);
  if (scale.labels && /^[\d\s.,]+$/.test(nQuote)) return { kind: "reject" };

  if (item.code === "PHQ9_9" && r.value === 0) {
    return r.confidence === "alta" && EXPLICIT_NO.test(nQuote) ? { kind: "accept", value: 0, quote, source: r.source } : { kind: "confirm", value: 0, quote };
  }
  if (!scale.labels && !hasDigit) return { kind: "confirm", value: r.value, quote };
  if (r.confidence === "baixa") return { kind: "confirm", value: r.value, quote };
  return { kind: "accept", value: r.value, quote, source: r.source };
}

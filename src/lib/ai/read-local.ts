/**
 * Leitura da resposta por regra local: é o modo simulado e a reserva quando a IA não responde.
 * Número só vale na escala de 0 a 10 (WPAI); nas escalas com rótulos, a pessoa responde com palavras.
 */
import { normalizeText } from "@/lib/crisis/detect";
import type { Item } from "@/lib/instruments/types";
import type { ReadReplyInput, ReplyReading } from "./types";

/** Jeitos comuns de dizer cada rótulo (chave = rótulo normalizado). */
const SYNONYMS: Record<string, string[]> = {
  // PHQ-9 / GAD-7
  "nenhuma vez": ["nenhuma vez", "nenhum dia", "nunca", "jamais", "em nenhum momento"],
  "varios dias": ["varios dias", "alguns dias", "uns dias", "poucos dias", "as vezes", "de vez em quando", "um pouco"],
  "mais da metade dos dias": ["mais da metade dos dias", "mais da metade", "metade dos dias", "boa parte dos dias", "muitos dias", "a maioria dos dias"],
  "quase todos os dias": ["quase todos os dias", "quase todo dia", "todo dia", "todos os dias", "o tempo todo", "direto", "sempre"],
  // BAT-12 e COPSOQ (frequência)
  nunca: ["nunca", "jamais", "em nenhum momento"],
  raramente: ["raramente", "quase nunca", "dificilmente", "pouquissimas vezes"],
  "algumas vezes": ["algumas vezes", "as vezes", "de vez em quando", "uma vez ou outra"],
  "as vezes": ["as vezes", "algumas vezes", "de vez em quando", "uma vez ou outra"],
  "com frequencia": ["com frequencia", "frequentemente", "muitas vezes", "quase sempre", "bastante"],
  frequentemente: ["frequentemente", "com frequencia", "muitas vezes", "quase sempre", "bastante"],
  sempre: ["sempre", "o tempo todo", "todo dia", "todos os dias", "direto"],
  // COPSOQ 23 (bullying)
  "sim, diariamente": ["diariamente", "todo dia", "todos os dias"],
  "sim, semanalmente": ["semanalmente", "toda semana", "todas as semanas"],
  "sim, mensalmente": ["mensalmente", "todo mes", "todos os meses"],
  "sim, poucas vezes": ["poucas vezes", "algumas vezes", "uma vez ou outra"],
};

const YES_WORDS = /^(sim|s|ss|claro|aceito|pode|bora|vamos|ok|okay|quero|manda|topo|beleza|isso|exato|correto|certo|com certeza|aham|uhum|e isso|isso mesmo|pode ser)\b/;
const NO_WORDS = /^(nao|n|nope|prefiro nao|agora nao|nao quero|errado|negativo)\b/;
const STOP = /\b(quero parar|parar|chega por hoje|nao quero mais (responder|continuar)|encerrar)\b/;
const SKIP = /\b(pular|pula|pule|prefiro nao (responder|falar|dizer)|nao quero responder)\b/;
const CORRECTION = /\b(quis dizer|na verdade|corrigindo|errei|me enganei|digitei errado|falei errado)\b/;
const DOUBT = /\b(o que (e|significa|quer dizer)|nao entendi|como assim|explica|nao sei o que)\b/;

type Match = { value: number; start: number; end: number; quote: string };

function findAll(haystack: string, needle: string): number[] {
  const out: number[] = [];
  const re = new RegExp(`(^|[^a-z0-9])${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=$|[^a-z0-9])`, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(haystack))) out.push(m.index + m[1].length);
  return out;
}

/** Todos os rótulos (e sinônimos) achados na fala, sem os que estão dentro de um trecho maior. */
function labelMatches(item: Item, text: string): Match[] {
  const scale = item.scale!;
  const labels = scale.labels ?? [];
  const found: Match[] = [];
  labels.forEach((label, i) => {
    const key = normalizeText(label);
    const phrases = [key, ...(SYNONYMS[key] ?? [])];
    for (const phrase of phrases) {
      for (const start of findAll(text, phrase)) found.push({ value: scale.min + i, start, end: start + phrase.length, quote: phrase });
    }
  });
  // sim/não da pergunta-tronco
  if (labels.length === 2 && labels.map(normalizeText).join("|") === "nao|sim") {
    if (YES_WORDS.test(text)) found.push({ value: scale.min + 1, start: 0, end: text.split(/[^a-z]+/)[0].length, quote: text.split(/[^a-z]+/)[0] });
    else if (NO_WORDS.test(text)) found.push({ value: scale.min, start: 0, end: 3, quote: "nao" });
  }
  return found.filter((m) => !found.some((o) => o !== m && o.start <= m.start && o.end >= m.end && o.end - o.start > m.end - m.start));
}

function scaleReading(item: Item, text: string): Pick<ReplyReading, "value" | "quote" | "confidence"> {
  const scale = item.scale;
  if (!scale) return { value: null, quote: null, confidence: "baixa" };
  if (!scale.labels) {
    // escala numérica (WPAI 0–10): o número é a resposta
    const m = text.match(/(?:^|[^0-9])(\d{1,2})(?![0-9])/);
    if (!m) return { value: null, quote: null, confidence: "baixa" };
    const v = Number(m[1]);
    return v >= scale.min && v <= scale.max ? { value: v, quote: m[1], confidence: "alta" } : { value: null, quote: null, confidence: "baixa" };
  }
  const matches = labelMatches(item, text).sort((a, b) => a.start - b.start);
  if (matches.length === 0) return { value: null, quote: null, confidence: "baixa" };
  const values = new Set(matches.map((m) => m.value));
  const last = matches[matches.length - 1];
  return { value: last.value, quote: last.quote, confidence: values.size > 1 ? "baixa" : "alta" };
}

export function readReplyLocal(input: ReadReplyInput): ReplyReading {
  const text = normalizeText(input.text).replace(/[!.]+$/g, "").trim();
  const base: ReplyReading = { intent: "other", value: null, quote: null, confidence: "alta", mentions: [], source: "regra" };

  if (input.stage === "consent" || input.stage === "confirm") {
    if (NO_WORDS.test(text)) return { ...base, intent: "no" };
    // pergunta antes do sim: "isso é sigiloso mesmo?" é dúvida, não aceite
    if (DOUBT.test(text) || text.endsWith("?")) return { ...base, intent: "doubt" };
    if (YES_WORDS.test(text)) return { ...base, intent: "yes" };
    if (input.stage === "confirm" && input.item) {
      const r = scaleReading(input.item, text);
      if (r.value !== null) return { ...base, intent: "answer", ...r };
    }
    return base;
  }

  if (STOP.test(text)) return { ...base, intent: "stop" };
  if (SKIP.test(text)) return { ...base, intent: "skip" };
  if (CORRECTION.test(text) && input.previous?.scale) {
    const r = scaleReading(input.previous, text);
    if (r.value !== null) return { ...base, intent: "correction", ...r };
  }
  if (input.item) {
    const r = scaleReading(input.item, text);
    if (r.value !== null) return { ...base, intent: "answer", ...r };
  }
  if (DOUBT.test(text) || text.endsWith("?")) return { ...base, intent: "doubt" };
  return base;
}

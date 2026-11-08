import { recordEvent } from "@/lib/obs/events";
import { EMBEDDING_DIMENSIONS } from "@/db/schema";
import { normalizeText } from "@/lib/crisis/detect";
import type { Item } from "@/lib/instruments/types";
import type { AiProvider, Classification, ClassifyInput, RunContext, RunSummary } from "./types";

function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function embedOne(text: string): number[] {
  const vec = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
  const words = normalizeText(text).split(/[^a-z0-9]+/).filter((w) => w.length >= 3);
  const add = (feature: string, weight: number) => {
    const h = fnv1a(feature);
    vec[h % EMBEDDING_DIMENSIONS] += (h >>> 31 === 1 ? 1 : -1) * weight;
  };
  for (const word of words) {
    add(`w:${word}`, 1);
    for (let i = 0; i + 3 <= word.length; i++) add(`t:${word.slice(i, i + 3)}`, 0.3);
  }
  const norm = Math.sqrt(vec.reduce((s, x) => s + x * x, 0));
  if (norm === 0) {
    vec[0] = 1;
    return vec;
  }
  return vec.map((x) => x / norm);
}

const YES = ["sim", "s", "ss", "claro", "aham", "yes"];
const NO = ["nao", "n", "no", "nunca"];

export function isInWorseHalf(item: Item, value: number | null): boolean {
  if (!item.scale || value === null) return false;
  const mid = item.scale.min + (item.scale.max - item.scale.min) / 2;
  return item.scale.higherIsWorse ? value >= mid : value <= mid;
}

function interpretLocal(item: Item, text: string): number | null {
  const scale = item.scale;
  if (!scale) return null;
  const normalized = normalizeText(text);
  const numberMatch = normalized.match(/(?:^|\s)(\d+(?:[.,]\d+)?)(?=\s|$|[.!?])/);
  if (numberMatch && item.choices) return item.choices[numberMatch[1]] ?? null;
  if (numberMatch) {
    const value = Number(numberMatch[1].replace(",", "."));
    return value >= scale.min && value <= scale.max ? value : null;
  }
  const isYesNo = scale.labels?.length === 2 && scale.labels.map(normalizeText).join("|") === "nao|sim";
  if (isYesNo) {
    const first = normalized.split(/[^a-z]+/)[0];
    if (YES.includes(first)) return scale.min + 1;
    if (NO.includes(first)) return scale.min;
  }
  if (scale.labels && normalizeText(scale.labels[0]) === "nenhuma vez" && /\b(nunca|nenhum dia|nenhuma)\b/.test(normalized)) {
    return scale.min;
  }
  if (scale.labels) {
    let best: { value: number; length: number } | null = null;
    scale.labels.forEach((label, i) => {
      const nl = normalizeText(label);
      if (normalized.includes(nl) && (!best || nl.length > best.length)) {
        best = { value: scale.min + i, length: nl.length };
      }
    });
    if (best) return (best as { value: number }).value;
  }
  return null;
}

export function createMockProvider(): AiProvider {
  return {
    async embed(texts) {
      return texts.map(embedOne);
    },

    async interpretAnswer(item, text) {
      const value = interpretLocal(item, text);
      if (value !== null) recordEvent({ kind: "valor da resposta", outcome: "ok", model: "regra local", detail: `“${text}” → ${value} (regra local)` });
      return value;
    },

    async classifyAnswer({ item, value, chunks }: ClassifyInput): Promise<Classification> {
      const relevante = isInWorseHalf(item, value) && chunks.length > 0;
      if (!relevante) return { relevante: false, tema: item.instrument, explicacao: "", trechos: [] };
      return {
        relevante: true,
        tema: item.instrument,
        explicacao: `Resposta ${value} ao item ${item.code} está na faixa de atenção da escala; ver trecho de referência.`,
        trechos: chunks.slice(0, 2).map((c) => ({
          chunkId: c.id,
          documento: c.documentTitle,
          pagina: c.page,
          texto: c.text.slice(0, 400),
        })),
      };
    },

    async summarizeRun({ answers, scores, evidence, missingInstruments }: RunContext): Promise<RunSummary> {
      const evidenced = new Set(evidence.map((e) => e.itemCode));
      const dificuldades = answers
        .filter((a) => a.item.scale && (evidenced.has(a.item.code) || isInWorseHalf(a.item, a.value)))
        .sort((a, b) => Number(evidenced.has(b.item.code)) - Number(evidenced.has(a.item.code)))
        .map((a) => ({ relato: `Respondeu "${a.rawText}" para: ${a.item.text}`, origem: [a.item.code] }));
      const impact = scores.filter((s) => s.instrument === "WPAI" || s.instrument === "SPS6");
      const fatores = answers
        .filter((a) => a.item.instrument === "OPEN" && a.rawText.trim())
        .map((a) => ({ texto: `Sobre "${a.item.text}": ${a.rawText}`, origem: [a.item.code] }));
      return {
        dificuldades_relatadas: dificuldades,
        impacto_funcional: {
          texto: impact.length
            ? impact.map((s) => `${s.instrument} ${s.dimension}: ${s.value} (corte ${s.cutoff})`).join("; ")
            : "Sem dados de impacto funcional.",
          origem: impact.map((s) => `${s.instrument}/${s.dimension}`),
        },
        fatores_do_trabalho: fatores,
        pontos_para_avaliar: scores
          .filter((s) => s.flagged)
          .map((s) => ({
            texto: `${s.instrument} ${s.dimension} acima do ponto de atenção: ${s.value} (corte ${s.cutoff}).`,
            origem: [`${s.instrument}/${s.dimension}`],
          })),
        nao_respondido: missingInstruments,
      };
    },
  };
}

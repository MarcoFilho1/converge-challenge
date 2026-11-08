/**
 * Frase de risco com negação ("não, nunca pensei em me machucar").
 *
 * A regra de risco (patterns.ts) continua sendo a primeira rede e nunca é desligada. Só quando há
 * negação nas palavras antes do trecho de risco a IA dá um veredito: afirmado corta, negado segue,
 * ambíguo pede confirmação. Erro, demora ou modo simulado contam como ambíguo: nada passa por falha.
 */
import { generateText, Output } from "ai";
import { z } from "zod";
import { aiMode } from "@/lib/ai";
import { chatCallOptions, hasChatKey, withChat } from "@/lib/ai/llm";
import { recordEvent } from "@/lib/obs/events";
import { detectCrisis, normalizeText } from "./detect";
import { CRISIS_PATTERNS } from "./patterns";

export type RiskVerdict = "afirmado" | "negado" | "ambiguo";
export type RiskAction = "sem_risco" | "cortar" | "seguir" | "confirmar";

const NEGATION = /\b(nao|nunca|jamais|nem|nenhum|nenhuma)\b/;
const WINDOW_WORDS = 6;

/** Há negação nas até 6 palavras antes de algum trecho de risco? O "não" dentro do próprio trecho não conta. */
export function negationBeforeRisk(text: string, patterns: RegExp[] = CRISIS_PATTERNS): boolean {
  const n = normalizeText(text);
  return patterns.some((p) => {
    const m = new RegExp(p.source, p.flags.includes("g") ? p.flags : `${p.flags}g`);
    for (const hit of n.matchAll(m)) {
      const before = n.slice(0, hit.index).split(/[^a-z]+/).filter(Boolean).slice(-WINDOW_WORDS).join(" ");
      if (NEGATION.test(before)) return true;
    }
    return false;
  });
}

const RISK_SYSTEM = `Você apoia a segurança de uma triagem de saúde ocupacional.
Leia a mensagem e diga se a pessoa AFIRMA ter pensamentos ou intenção de se machucar, de morrer ou de não estar mais aqui (afirmado),
se NEGA isso de forma clara (negado), ou se não dá para ter certeza (ambiguo).
Em qualquer dúvida, responda ambiguo. Exemplos: "não, nunca pensei em me machucar" → negado; "não aguento mais, quero me matar" → afirmado;
"não sei se quero me machucar" → ambiguo; "não, mas às vezes penso que seria melhor sumir" → ambiguo.`;

async function judgeWithAi(text: string): Promise<RiskVerdict> {
  if (aiMode() !== "real" || !hasChatKey()) return "ambiguo";
  const { output } = await withChat(
    (model) =>
      generateText({
        model,
        ...chatCallOptions("fast"),
        system: RISK_SYSTEM,
        temperature: 0,
        output: Output.object({ schema: z.object({ risco: z.enum(["afirmado", "negado", "ambiguo"]) }) }),
        prompt: text,
      }),
    "fast",
    "avaliar negação",
  );
  return output.risco;
}

let judge: (text: string) => Promise<RiskVerdict> = judgeWithAi;
/** Só para testes. */
export function setRiskJudge(fn: (text: string) => Promise<RiskVerdict>) {
  judge = fn;
}
export function resetRiskJudge() {
  judge = judgeWithAi;
}

/**
 * O que fazer com a mensagem. `extraHit` e `extraPatterns` deixam a entrevista somar os padrões dela.
 */
export async function assessRisk(text: string, opts: { extraHit?: boolean; extraPatterns?: RegExp[] } = {}): Promise<RiskAction> {
  const hit = detectCrisis(text).hit || !!opts.extraHit;
  if (!hit) return "sem_risco";
  if (!negationBeforeRisk(text, [...CRISIS_PATTERNS, ...(opts.extraPatterns ?? [])])) return "cortar";
  let verdict: RiskVerdict;
  try {
    verdict = await judge(text);
  } catch {
    verdict = "ambiguo";
  }
  recordEvent({ kind: "avaliar negação", outcome: "ok", model: "regra + IA", detail: `“${text.slice(0, 120)}” → ${verdict}` });
  return verdict === "afirmado" ? "cortar" : verdict === "negado" ? "seguir" : "confirmar";
}

/** Resposta à pergunta de confirmação: só um "não" claro deixa seguir. */
export function isClearNo(text: string): boolean {
  const n = normalizeText(text).replace(/[.!]+$/, "");
  if (/\b(mas|porem|talvez|as vezes|nao sei|sei la)\b/.test(n)) return false;
  return /^(nao|n|2|nunca|jamais)\b/.test(n);
}

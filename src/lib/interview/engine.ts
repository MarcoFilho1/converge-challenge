/**
 * Motor da entrevista: puro, sem I/O. A pauta e a escolha da pergunta são código;
 * o LLM (InterviewAi) só extrai o que foi dito e redige uma frase curta de acolhimento.
 */
import type { InterviewAi } from "@/lib/ai/interview";
import { detectCrisis, normalizeText } from "@/lib/crisis/detect";
import { buildAgenda, type Agenda } from "./agenda";
import { askedHelena, asksRepeat, cleanGenerated, extraCrisis } from "./filters";
import { ASKED_ACK, BLOCKS, CRISIS_SPEECH, REPEAT_ASK_PREFIX, DECLINE_SPEECH, DEFAULT_PRAZO, REPEAT_PREFIX, URGENCY_SPEECH, renderText } from "./protocol";
import { fechamentoIndex, selectNext } from "./select";
import type { Aviso, BlockId, Finding, InterviewInput, InterviewStatus, Turn } from "./types";

export const MAX_PERSON_TURNS = 12;
export const MAX_DURATION_MS = 15 * 60_000;
/**
 * Pergunta de segurança: "sim" claro (ou padrão de risco) corta em crise; "não" claro segue.
 * Qualquer outra coisa ("não sei", "às vezes", recusa) → a Helena pergunta de outro jeito; se continuar sem resposta clara,
 * vira aviso no relatório com as duas falas citadas (decisão do Marco, 8/11).
 */
const SAFETY_YES = /^(sim|tive|ja tive|tenho tido|acho que sim|penso|pensei|tenho pensado|ja pensei)\b/;
const SAFETY_NO = /^(nao|nunca|nada disso|de jeito nenhum|jamais)\b/;
const SAFETY_DOUBT = /\b(mas|as vezes|sim|talvez|nao sei|vale a pena|de vez em quando|tive|tenho|penso|pensei|pensando|um pouco|acho)\b/;
export const SAFETY_UNANSWERED = "pergunta de segurança não respondida";

const strip = (t: string) => normalizeText(t).replace(/[.,!?;:…"“”()\-]+/g, " ").replace(/\s+/g, " ").trim();

function safetyClearlyNo(text: string): boolean {
  const n = strip(text);
  return SAFETY_NO.test(n) && !SAFETY_DOUBT.test(n);
}

function safetyClearlyYes(text: string): boolean {
  return SAFETY_YES.test(strip(text));
}

/** Resposta que não responde: só "não sei/sei lá/talvez…" (sem conteúdo depois) ou recusa explícita. */
const EVASIVE = /^(nao sei|sei la|talvez|nao lembro|nao tenho certeza|pode ser|sei nao|nem sei)( (dizer|responder|ao certo|direito|bem|nao|nao sei))*$/;
const REFUSAL = /\b(prefiro nao (responder|falar|dizer|comentar)|nao quero (responder|falar|comentar)|pode pular|pula essa|pular essa|sem comentarios?)\b/;

export function isEvasive(text: string): boolean {
  const n = strip(text);
  return EVASIVE.test(n) || REFUSAL.test(n);
}

export type InterviewMode = "live" | "cache_only";

export type InterviewState = {
  agenda: Agenda;
  blockIndex: number;
  probesAsked: string[];
  currentProbeId: string | null;
  turns: Turn[];
  findings: Finding[];
  status: InterviewStatus;
  startedMs: number;
  endedMs: number | null;
  mode: InterviewMode;
  repeatCount: number;
  rephraseCount: number;
  skipped: BlockId[];
  avisos: Aviso[];
  vars: { medico: string; prazo: string };
  input: InterviewInput;
};

export type InterviewEvent =
  | { kind: "start"; consent: boolean }
  | { kind: "speech"; text: string; durationMs: number | null }
  | { kind: "skip" }
  | { kind: "stop" };

/** parts: quando há reação + pergunta, cada uma vira um áudio próprio (a pergunta sempre do cache). */
export type UtterancePart = { text: string; cacheKey: string };
export type Utterance = { text: string; probeId: string | null; blockId: BlockId; cacheKey: string | null; final: boolean; crisis: boolean; parts?: UtterancePart[] };

export function isFinal(status: InterviewStatus): boolean {
  return status === "crisis" || status === "done" || status === "stopped";
}

export function createState(input: InterviewInput, opts: { mode: InterviewMode; nowMs: number }): InterviewState {
  return {
    agenda: buildAgenda(input),
    blockIndex: 0,
    probesAsked: [],
    currentProbeId: null,
    turns: [],
    findings: [],
    status: "consent",
    startedMs: opts.nowMs,
    endedMs: null,
    mode: opts.mode,
    repeatCount: 0,
    rephraseCount: 0,
    skipped: [],
    avisos: [],
    vars: { medico: input.doctorName, prazo: DEFAULT_PRAZO },
    input,
  };
}

type Ctx = { state: InterviewState; ai: InterviewAi; nowMs: number };

function pushTurn(state: InterviewState, t: Omit<Turn, "idx">): InterviewState {
  return { ...state, turns: [...state.turns, { ...t, idx: state.turns.length }] };
}

function aiTurn(ctx: Ctx, say: Utterance, status: InterviewStatus): { state: InterviewState; say: Utterance } {
  const final = isFinal(status);
  let state = pushTurn(ctx.state, { speaker: "ai", text: say.text, blockId: say.blockId, probeId: say.probeId, startedMs: ctx.nowMs - ctx.state.startedMs, durationMs: null });
  state = { ...state, status, currentProbeId: say.probeId, endedMs: final ? ctx.nowMs : state.endedMs };
  return { state, say: { ...say, final } };
}

function fixed(blockId: BlockId, text: string, cacheKey: string, crisis = false): Utterance {
  return { text, probeId: null, blockId, cacheKey, final: false, crisis };
}

function closing(ctx: Ctx, status: "done" | "stopped") {
  const idx = fechamentoIndex(ctx.state.agenda);
  const state = { ...ctx.state, blockIndex: idx };
  return aiTurn({ ...ctx, state }, fixed("fechamento", renderText(BLOCKS.fechamento.base, state.vars), "fechamento:base"), status);
}

function crisis(ctx: Ctx) {
  return aiTurn(ctx, fixed(currentBlockId(ctx.state), CRISIS_SPEECH(ctx.state.vars.medico), "crise:base", true), "crisis");
}

function currentBlockId(state: InterviewState): BlockId {
  return state.agenda.blocks[state.blockIndex].id;
}

function currentQuestion(state: InterviewState, blockId: BlockId): { text: string; rephrase: string | null } {
  const probe = BLOCKS[blockId].probes.find((p) => p.id === state.currentProbeId);
  if (probe) return { text: probe.text, rephrase: probe.rephrase };
  return { text: renderText(BLOCKS[blockId].base, state.vars), rephrase: BLOCKS[blockId].rephrase ?? null };
}

function addAviso(state: InterviewState, texto: string, turnIdxs: number[]): InterviewState {
  return { ...state, avisos: [...(state.avisos ?? []), { texto, turnIdxs }] };
}

/** Pergunta-base sem resposta = o bloco inteiro fica sem resposta; vai para a base do próximo bloco. */
function nextBlockBase(ctx: Ctx, s: InterviewState) {
  const blockId = currentBlockId(s);
  const moved = { ...s, skipped: s.skipped.includes(blockId) ? s.skipped : [...s.skipped, blockId], blockIndex: Math.min(s.blockIndex + 1, s.agenda.blocks.length - 1) };
  const next = moved.agenda.blocks[moved.blockIndex].id;
  if (next === "fechamento") return closing({ ...ctx, state: moved }, "done");
  return aiTurn({ ...ctx, state: moved }, { text: renderText(BLOCKS[next].base, moved.vars), probeId: null, blockId: next, cacheKey: `${next}:base`, final: false, crisis: false }, "running");
}

/** Depois de uma pergunta sem resposta: sai do bloco se era a base, senão segue para a próxima sonda. */
function moveOn(ctx: Ctx, s: InterviewState) {
  const blockId = currentBlockId(s);
  if (s.currentProbeId === null && BLOCKS[blockId].probes.length > 0) return nextBlockBase(ctx, s);
  return advance({ ...ctx, state: s }, "", []);
}

/** Ao sair de um domínio sem nenhum achado, ele vira "não respondido". */
function leaveBlock(state: InterviewState, blockId: BlockId): InterviewState {
  const def = BLOCKS[blockId];
  if (blockId === "seguranca") {
    const answered = state.turns.some((t) => t.speaker === "person" && t.blockId === "seguranca" && normalizeText(t.text).length >= 2);
    return answered || state.skipped.includes("seguranca") ? state : { ...state, skipped: [...state.skipped, "seguranca"] };
  }
  if (def.probes.length === 0) return state;
  const hasFindings = state.findings.some((f) => f.blockId === blockId);
  return hasFindings || state.skipped.includes(blockId) ? state : { ...state, skipped: [...state.skipped, blockId] };
}

async function advance(ctx: Ctx, lastText: string, newFindings: Finding[]) {
  let { state } = ctx;
  const fromBlock = currentBlockId(state);
  const personTurns = state.turns.filter((t) => t.speaker === "person").length;
  const segIndex = state.agenda.blocks.findIndex((b) => b.id === "seguranca");
  const segurancaPending = state.blockIndex < segIndex;
  const budgetLeft = MAX_PERSON_TURNS - personTurns - (segurancaPending ? 1 : 0);
  const outOfTime = ctx.nowMs - state.startedMs >= MAX_DURATION_MS;
  let sel = selectNext(state.agenda, state.blockIndex, state.probesAsked, state.turns, state.findings);
  if (budgetLeft <= 0 || outOfTime) {
    // teto: segurança nunca cai; o resto vai para o fechamento
    if (segurancaPending) sel = { kind: "block", blockId: "seguranca", blockIndex: segIndex };
    else return closing({ ...ctx, state: leaveBlock(state, fromBlock) }, "done");
  }
  let probeText: string;
  let probeId: string | null;
  let blockId: BlockId;
  if (sel.kind === "probe") {
    probeText = sel.probe.text;
    probeId = sel.probe.id;
    blockId = sel.blockId;
    state = { ...state, probesAsked: [...state.probesAsked, probeId] };
  } else {
    state = leaveBlock(state, fromBlock);
    state = { ...state, blockIndex: sel.blockIndex };
    blockId = sel.blockId;
    probeId = null;
    if (blockId === "fechamento") return closing({ ...ctx, state }, "done");
    probeText = renderText(BLOCKS[blockId].base, state.vars);
  }

  const wantsAck = state.mode === "live" && fromBlock !== "abertura" && blockId !== "seguranca";
  const ack = !wantsAck ? "" : askedHelena(lastText) ? ASKED_ACK : cleanGenerated(await ctx.ai.phraseAck({ lastText, findings: newFindings, probeText }));
  const text = [ack, probeText].filter(Boolean).join(" ");
  const probeKey = `${blockId}:${probeId ?? "base"}`;
  const cacheKey = ack ? null : probeKey;
  const parts = ack ? [{ text: ack, cacheKey: `ack:${ack}` }, { text: probeText, cacheKey: probeKey }] : undefined;
  return aiTurn({ ...ctx, state }, { text, probeId, blockId, cacheKey, final: false, crisis: false, parts }, "running");
}

export async function step(state: InterviewState, event: InterviewEvent, ai: InterviewAi, nowMs: number): Promise<{ state: InterviewState; say: Utterance }> {
  const ctx: Ctx = { state, ai, nowMs };
  if (isFinal(state.status)) throw new Error(`entrevista já encerrada (${state.status})`);

  if (event.kind === "start") {
    if (!event.consent) return aiTurn(ctx, fixed("abertura", DECLINE_SPEECH, "abertura:recusa"), "stopped");
    if (state.agenda.skipInterview) return aiTurn(ctx, fixed("abertura", URGENCY_SPEECH(state.vars.medico), "abertura:urgencia", true), "crisis");
    return aiTurn(ctx, fixed("abertura", renderText(BLOCKS.abertura.base, state.vars), "abertura:base"), "running");
  }
  if (state.status !== "running") throw new Error("entrevista ainda não começou");

  if (event.kind === "stop") return closing(ctx, "stopped");

  if (event.kind === "skip") {
    const blockId = currentBlockId(state);
    const q = currentQuestion(state, blockId);
    const s = addAviso({ ...state, repeatCount: 0, rephraseCount: 0 }, `Preferiu pular: “${q.text}”`, []);
    return moveOn(ctx, s);
  }

  // speech
  const text = event.text.trim();
  const blockId = currentBlockId(state);
  let s = pushTurn(state, { speaker: "person", text, blockId, probeId: state.currentProbeId, startedMs: nowMs - state.startedMs, durationMs: event.durationMs });

  if (detectCrisis(text).hit || extraCrisis(text)) return crisis({ ...ctx, state: s });
  if (blockId === "seguranca" && safetyClearlyYes(text)) return crisis({ ...ctx, state: s });

  const q = currentQuestion(state, blockId);
  const thisTurn = s.turns.length - 1;

  if (normalizeText(text).length < 2) {
    if (s.repeatCount === 0) {
      // a fonte da verdade é a pergunta atual, nunca o texto falado (que pode ter acolhimento gerado)
      s = { ...s, repeatCount: 1 };
      const probeKey = `${blockId}:${state.currentProbeId ?? "base"}`;
      return aiTurn({ ...ctx, state: s }, { text: REPEAT_PREFIX + q.text, probeId: state.currentProbeId, blockId, cacheKey: `${blockId}:repeat:${state.currentProbeId ?? "base"}`, final: false, crisis: false, parts: [{ text: REPEAT_PREFIX.trim(), cacheKey: "prefixo:repetir" }, { text: q.text, cacheKey: probeKey }] }, "running");
    }
    s = addAviso({ ...s, repeatCount: 0, rephraseCount: 0 }, `Sem resposta: “${q.text}”`, []);
    return moveOn(ctx, s);
  }
  s = { ...s, repeatCount: 0 };

  if (blockId !== "abertura" && asksRepeat(text)) {
    const firstTime = (s.rephraseCount ?? 0) === 0 && q.rephrase;
    s = { ...s, rephraseCount: 1 };
    const say = firstTime ? q.rephrase! : REPEAT_ASK_PREFIX + q.text;
    const key = firstTime ? `${blockId}:${state.currentProbeId ?? "base"}:rephrase` : `${blockId}:${state.currentProbeId ?? "base"}:claro`;
    const parts = firstTime ? undefined : [{ text: REPEAT_ASK_PREFIX.trim(), cacheKey: "prefixo:claro" }, { text: q.text, cacheKey: `${blockId}:${state.currentProbeId ?? "base"}` }];
    return aiTurn({ ...ctx, state: s }, { text: say, probeId: state.currentProbeId, blockId, cacheKey: key, final: false, crisis: false, parts }, "running");
  }

  const evasive = blockId === "seguranca" ? !safetyClearlyNo(text) : blockId !== "abertura" && isEvasive(text);
  if (evasive) {
    if ((s.rephraseCount ?? 0) === 0 && q.rephrase) {
      s = { ...s, rephraseCount: 1 };
      return aiTurn({ ...ctx, state: s }, { text: q.rephrase, probeId: state.currentProbeId, blockId, cacheKey: `${blockId}:${state.currentProbeId ?? "base"}:rephrase`, final: false, crisis: false }, "running");
    }
    const prevPerson = [...s.turns].slice(0, -1).reverse().find((t) => t.speaker === "person" && t.blockId === blockId);
    const idxs = prevPerson ? [prevPerson.idx, thisTurn] : [thisTurn];
    const quotes = idxs.map((i) => `“${s.turns[i].text}”`).join(" e ");
    const texto = blockId === "seguranca"
      ? `Pergunta de segurança sem resposta clara. Respostas: ${quotes}. Vale perguntar de novo na consulta.`
      : `Não quis responder: “${q.text}”. Respostas: ${quotes}.`;
    s = addAviso({ ...s, rephraseCount: 0 }, texto, idxs);
    return moveOn(ctx, s);
  }
  s = { ...s, rephraseCount: 0 };

  let newFindings: Finding[] = [];
  if (blockId !== "abertura" && blockId !== "seguranca") {
    const probeText = state.turns.at(-1)?.text ?? "";
    const drafts = await ai.extractFindings({ blockId, probeText, text });
    const turnIdx = s.turns.length - 1;
    newFindings = drafts.map((d) => ({ ...d, turnIdx, blockId }));
    s = { ...s, findings: [...s.findings, ...newFindings] };
  }
  if (newFindings.some((f) => f.pediuParar)) return closing({ ...ctx, state: s }, "stopped");

  return advance({ ...ctx, state: s }, text, newFindings);
}

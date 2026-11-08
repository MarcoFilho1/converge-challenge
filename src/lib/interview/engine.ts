/**
 * Motor da entrevista: puro, sem I/O. A pauta e a escolha da pergunta são código;
 * o LLM (InterviewAi) só extrai o que foi dito e redige uma frase curta de acolhimento.
 */
import type { InterviewAi } from "@/lib/ai/interview";
import { detectCrisis, normalizeText } from "@/lib/crisis/detect";
import { buildAgenda, type Agenda } from "./agenda";
import { cleanGenerated, extraCrisis } from "./filters";
import { BLOCKS, CRISIS_SPEECH, DECLINE_SPEECH, DEFAULT_PRAZO, REPEAT_PREFIX, URGENCY_SPEECH, renderText } from "./protocol";
import { fechamentoIndex, selectNext } from "./select";
import type { BlockId, Finding, InterviewInput, InterviewStatus, Turn } from "./types";

export const MAX_PERSON_TURNS = 12;
export const MAX_DURATION_MS = 15 * 60_000;
const SAFETY_YES = /^(sim|tive|ja tive|as vezes|um pouco|acho que sim)\b/;

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
  skipped: BlockId[];
  vars: { medico: string; prazo: string };
  input: InterviewInput;
};

export type InterviewEvent =
  | { kind: "start"; consent: boolean }
  | { kind: "speech"; text: string; durationMs: number | null }
  | { kind: "skip" }
  | { kind: "stop" };

export type Utterance = { text: string; probeId: string | null; blockId: BlockId; cacheKey: string | null; final: boolean; crisis: boolean };

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
    skipped: [],
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

/** Ao sair de um domínio sem nenhum achado, ele vira "não respondido". */
function leaveBlock(state: InterviewState, blockId: BlockId): InterviewState {
  const def = BLOCKS[blockId];
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
  const ack = wantsAck ? cleanGenerated(await ctx.ai.phraseAck({ lastText, findings: newFindings, probeText })) : "";
  const text = [ack, probeText].filter(Boolean).join(" ");
  const cacheKey = ack ? null : `${blockId}:${probeId ?? "base"}`;
  return aiTurn({ ...ctx, state }, { text, probeId, blockId, cacheKey, final: false, crisis: false }, "running");
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
    // pergunta-base pulada = bloco inteiro pulado
    const s = state.currentProbeId === null && BLOCKS[blockId].probes.length > 0
      ? { ...state, skipped: state.skipped.includes(blockId) ? state.skipped : [...state.skipped, blockId], blockIndex: Math.min(state.blockIndex + 1, state.agenda.blocks.length - 1) }
      : state;
    if (s.blockIndex !== state.blockIndex) {
      const next = s.agenda.blocks[s.blockIndex].id;
      if (next === "fechamento") return closing({ ...ctx, state: s }, "done");
      const text = renderText(BLOCKS[next].base, s.vars);
      return aiTurn({ ...ctx, state: s }, { text, probeId: null, blockId: next, cacheKey: `${next}:base`, final: false, crisis: false }, "running");
    }
    return advance({ ...ctx, state: s }, "", []);
  }

  // speech
  const text = event.text.trim();
  const blockId = currentBlockId(state);
  let s = pushTurn(state, { speaker: "person", text, blockId, probeId: state.currentProbeId, startedMs: nowMs - state.startedMs, durationMs: event.durationMs });

  if (detectCrisis(text).hit || extraCrisis(text)) return crisis({ ...ctx, state: s });
  if (blockId === "seguranca" && SAFETY_YES.test(normalizeText(text))) return crisis({ ...ctx, state: s });

  if (normalizeText(text).length < 2) {
    if (s.repeatCount === 0) {
      const last = state.turns.at(-1);
      const probe = last?.text.replace(/^Entendi\. |^Certo\. /, "") ?? renderText(BLOCKS[blockId].base, s.vars);
      s = { ...s, repeatCount: 1 };
      return aiTurn({ ...ctx, state: s }, { text: REPEAT_PREFIX + probe, probeId: state.currentProbeId, blockId, cacheKey: `${blockId}:repeat:${state.currentProbeId ?? "base"}`, final: false, crisis: false }, "running");
    }
    s = { ...s, repeatCount: 0 };
    return advance({ ...ctx, state: s }, "", []);
  }
  s = { ...s, repeatCount: 0 };

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

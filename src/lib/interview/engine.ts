/**
 * Motor da entrevista: puro, sem I/O. A pauta e a escolha da pergunta são código;
 * o LLM (InterviewAi) só extrai o que foi dito e redige uma frase curta de acolhimento.
 */
import type { InterviewAi, PlanInput, TurnPlan } from "@/lib/ai/interview";
import { detectCrisis, normalizeText } from "@/lib/crisis/detect";
import { buildAgenda, type Agenda } from "./agenda";
import { askedHelena, asksRepeat, cleanGenerated, EXTRA_CRISIS_PATTERNS, extraCrisis } from "./filters";
import { assessRisk } from "@/lib/crisis/judge";
import { clampInput, detectInjection } from "@/lib/ai/injection";
import { ABANDON_AVISO_PREFIX, ASKED_ACK, BLOCKS, CRISIS_SPEECH, REPEAT_ASK_PREFIX, DECLINE_SPEECH, DEFAULT_PRAZO, REPEAT_PREFIX, URGENCY_SPEECH, renderText } from "./protocol";
import { candidateProbes, fechamentoIndex, selectNext } from "./select";
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

/** "não tive", "não tenho", "nunca tive", "não penso nisso": a negação vale para o verbo, não é dúvida. */
const NEGATED_VERB = /\b(nao|nunca|jamais)( (nao|mais|isso|disso|nisso|nada))* (tive|tenho|tenho tido|penso|pensei|tenho pensado|pensando)( (nao|isso|disso|nisso|nada))*\b/g;

function safetyClearlyNo(text: string): boolean {
  const n = strip(text).replace(NEGATED_VERB, "nao");
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
  /** "abandonada": encerrada pelo servidor porque a pessoa sumiu (página fechada ou conexão perdida). */
  endReason?: "abandonada";
  vars: { medico: string; prazo: string };
  input: InterviewInput;
  /** Blocos em que a Helena já fez a pergunta de aprofundamento (no máximo uma por bloco). */
  followUps?: BlockId[];
  /** Texto do aprofundamento atual (currentProbeId = "aprofundar:<bloco>"). */
  followUpText?: string | null;
  /** Reações já ditas, para não repetir abertura nem frase. */
  reactions?: string[];
  /** Falas da pessoa que tentaram mudar as regras da IA: nunca vão para a IA nem para o resumo. */
  injectionTurns?: number[];
};

/** Resposta fixa a uma tentativa de mudar as regras; depois a Helena repete a pergunta atual. */
export const GUARD_PREFIX = "Eu só consigo seguir com as perguntas desta conversa.";
const MASKED = "[fala removida: tentativa de mudar as instruções]";
const MAX_INJECTION_ATTEMPTS = 3;

/** Turnos como a IA pode vê-los: falas de ataque mascaradas. */
export function turnsForAi(state: InterviewState): Turn[] {
  const flagged = new Set(state.injectionTurns ?? []);
  return state.turns.map((t) => (flagged.has(t.idx) ? { ...t, text: MASKED } : t));
}

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

const FOLLOW_UP = "aprofundar:";
const isFollowUp = (probeId: string | null | undefined) => !!probeId && probeId.startsWith(FOLLOW_UP);

/** Chave do áudio da pergunta atual. Aprofundamento é texto novo: a chave é o próprio texto. */
function questionKey(state: InterviewState, blockId: BlockId): string {
  if (isFollowUp(state.currentProbeId)) return `aprofundar:${state.followUpText ?? ""}`;
  return `${blockId}:${state.currentProbeId ?? "base"}`;
}

function currentQuestion(state: InterviewState, blockId: BlockId): { text: string; rephrase: string | null } {
  if (isFollowUp(state.currentProbeId)) return { text: state.followUpText ?? "", rephrase: null };
  const probe = BLOCKS[blockId].probes.find((p) => p.id === state.currentProbeId);
  if (probe) return { text: probe.text, rephrase: probe.rephrase };
  return { text: renderText(BLOCKS[blockId].base, state.vars), rephrase: BLOCKS[blockId].rephrase ?? null };
}

function addAviso(state: InterviewState, texto: string, turnIdxs: number[]): InterviewState {
  return { ...state, avisos: [...(state.avisos ?? []), { texto, turnIdxs }] };
}

export { ABANDON_AVISO_PREFIX };

/** Hora absoluta (ms) da última coisa que aconteceu na entrevista: fim do último turno. */
export function lastActivityMs(state: InterviewState): number {
  const last = state.turns.at(-1);
  return state.startedMs + (last ? last.startedMs + (last.durationMs ?? 0) : 0);
}

/**
 * Encerra uma entrevista que ficou parada (a pessoa fechou a página ou perdeu a conexão).
 * Não cria fala nova da Helena (ninguém ouviria); o fim fica na última atividade e o médico recebe um aviso.
 */
export function abandon(state: InterviewState): InterviewState {
  const endedMs = lastActivityMs(state);
  const min = Math.max(1, Math.round((endedMs - state.startedMs) / 60_000));
  const closed: InterviewState = { ...state, status: "stopped", endReason: "abandonada", endedMs, currentProbeId: null };
  return addAviso(closed, `${ABANDON_AVISO_PREFIX} depois de ${min} min. O resumo usa só o que foi dito até ali.`, []);
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

const OPENER = /^(hmm+|hum+|humm+|sei|entendi|certo|ok|ah|uhum|aham|t[aá] bom|claro)\s*[,.!…]?\s*/i;
const capitalize = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/**
 * Reação limpa: sem termo proibido, sem conselho, sem pergunta, curta, sem repetir frase já dita.
 * Se a reação anterior já começou com "Hmm"/"Entendi"/"Sei", esta perde a abertura e vai direto ao conteúdo.
 */
const FILLER_END = /[,\s]*\b(ent[aã]o|n[eé]|entendi|viu|mesmo)\s*[.!…]*$/i;
const fillerOf = (t: string) => normalizeText(FILLER_END.exec(t)?.[1] ?? "");

export function cleanReaction(text: string, previous: string[]): string {
  let t = cleanGenerated(text ?? "");
  if (!t || t.endsWith("?") || t.split(/\s+/).length > 20) return "";
  // Mesmo final da reação anterior ("…, então."): corta o final repetido.
  const lastFiller = previous.length ? fillerOf(previous[previous.length - 1]) : "";
  if (lastFiller && fillerOf(t) === lastFiller) t = `${t.replace(FILLER_END, "").trim()}.`;
  if (previous.slice(-2).some((r) => OPENER.test(r))) {
    while (OPENER.test(t)) t = t.replace(OPENER, "");
    t = capitalize(t.trim());
  }
  if (!t || previous.map((r) => normalizeText(r)).includes(normalizeText(t))) return "";
  return t;
}

const SELF_HARM = /\b(se machuc|se ferir|se feriu|suicid|morrer|se matar|tirar a (sua |propria )?vida|nao estar mais aqui)/;

const STOP = new Set(["voce", "isso", "esse", "essa", "como", "quando", "onde", "qual", "quais", "para", "mais", "menos", "agora", "hoje", "algum", "alguma", "anda", "esta", "estao", "sobre", "porque", "tambem", "muito", "pouco", "coisa", "voces", "dessa", "desse", "disso", "nessa", "nesse"]);
const contentWords = (t: string) => new Set(normalizeText(t).split(/[^a-z]+/).filter((w) => w.length >= 4 && !STOP.has(w)));

/** Duas perguntas tratam do mesmo assunto quando dividem duas ou mais palavras de conteúdo. */
function sameTopic(a: string, b: string): boolean {
  const wb = contentWords(b);
  return [...contentWords(a)].filter((w) => wb.has(w)).length >= 2;
}

/** Pergunta de aprofundamento escrita pela IA: só passa se for curta, aberta, limpa, longe do tema de risco e de assuntos que ainda vêm. */
export function validFollowUp(text: string | null, state: InterviewState, upcoming: string[] = []): string | null {
  const t = (text ?? "").trim();
  if (!t.endsWith("?")) return null;
  const words = t.split(/\s+/).length;
  if (words < 3 || words > 22) return null;
  if (cleanGenerated(t) !== t) return null;
  const n = normalizeText(t);
  if (detectCrisis(t).hit || extraCrisis(t) || SELF_HARM.test(n)) return null;
  if (state.turns.some((x) => x.speaker === "ai" && normalizeText(x.text).includes(n))) return null;
  if (upcoming.some((q) => sameTopic(t, q))) return null;
  return t;
}

function recentTurns(state: InterviewState): PlanInput["recent"] {
  return turnsForAi(state).slice(-6).map((t) => ({ speaker: t.speaker as "ai" | "person", text: t.text }));
}

function planInput(state: InterviewState, blockId: BlockId, lastText: string): PlanInput {
  const block = state.agenda.blocks[state.blockIndex];
  const next = state.agenda.blocks[Math.min(state.blockIndex + 1, state.agenda.blocks.length - 1)];
  return {
    blockId,
    blockLabel: BLOCKS[blockId].label,
    lastQuestion: currentQuestion(state, blockId).text,
    lastText: clampInput(lastText),
    recent: recentTurns(state),
    recentReactions: (state.reactions ?? []).slice(-3),
    candidates: candidateProbes(block, state.probesAsked, state.turns, state.findings).map((p) => ({ id: p.id, text: p.text })),
    allowFollowUp: BLOCKS[blockId].probes.length > 0 && !(state.followUps ?? []).includes(blockId),
    nextBlockQuestion: next && next.id !== "fechamento" && next.id !== blockId ? renderText(BLOCKS[next.id].base, state.vars) : null,
    alreadySaid: state.findings.map((f) => f.texto).filter(Boolean),
    upcomingQuestions: state.agenda.blocks
      .slice(state.blockIndex + 1)
      .filter((b) => b.id !== "fechamento" && b.id !== "seguranca")
      .map((b) => renderText(BLOCKS[b.id].base, state.vars)),
  };
}

type Choice = { kind: "followup"; text: string } | { kind: "probe"; id: string } | { kind: "leave" };

async function advance(ctx: Ctx, lastText: string, newFindings: Finding[], override?: { ack: string; choice: Choice | null }) {
  let { state } = ctx;
  const fromBlock = currentBlockId(state);
  const personTurns = state.turns.filter((t) => t.speaker === "person").length;
  const segIndex = state.agenda.blocks.findIndex((b) => b.id === "seguranca");
  const segurancaPending = state.blockIndex < segIndex;
  const budgetLeft = MAX_PERSON_TURNS - personTurns - (segurancaPending ? 1 : 0);
  const outOfTime = ctx.nowMs - state.startedMs >= MAX_DURATION_MS;
  let sel = selectNext(state.agenda, state.blockIndex, state.probesAsked, state.turns, state.findings);
  const exhausted = budgetLeft <= 0 || outOfTime;
  if (exhausted) {
    // teto: segurança nunca cai; o resto vai para o fechamento
    if (segurancaPending) sel = { kind: "block", blockId: "seguranca", blockIndex: segIndex };
    else return closing({ ...ctx, state: leaveBlock(state, fromBlock) }, "done");
  } else if (override?.choice) {
    const choice = override.choice;
    if (choice.kind === "followup") {
      const ack = override.ack;
      const followed: InterviewState = {
        ...state,
        followUps: [...(state.followUps ?? []), fromBlock],
        followUpText: choice.text,
        reactions: ack ? [...(state.reactions ?? []), ack] : state.reactions,
      };
      const qKey = `aprofundar:${choice.text}`;
      const parts = ack ? [{ text: ack, cacheKey: `ack:${ack}` }, { text: choice.text, cacheKey: qKey }] : undefined;
      return aiTurn(
        { ...ctx, state: followed },
        { text: [ack, choice.text].filter(Boolean).join(" "), probeId: `${FOLLOW_UP}${fromBlock}`, blockId: fromBlock, cacheKey: ack ? null : qKey, final: false, crisis: false, parts },
        "running",
      );
    }
    if (choice.kind === "probe") {
      const probe = candidateProbes(state.agenda.blocks[state.blockIndex], state.probesAsked, state.turns, state.findings).find((p) => p.id === choice.id);
      if (probe) sel = { kind: "probe", blockId: fromBlock, probe };
    }
    if (choice.kind === "leave") {
      const nextIndex = Math.min(state.blockIndex + 1, state.agenda.blocks.length - 1);
      sel = { kind: "block", blockId: state.agenda.blocks[nextIndex].id, blockIndex: nextIndex };
    }
  }
  // Conversa guiada pela IA com escolha inválida: a primeira opção que ainda cabe (sem assunto já dito), ou o próximo bloco.
  if (override && !exhausted && !(override.choice?.kind === "leave") && !(sel.kind === "probe" && override.choice?.kind === "probe" && sel.probe.id === override.choice.id)) {
    const first = candidateProbes(state.agenda.blocks[state.blockIndex], state.probesAsked, state.turns, state.findings)[0];
    if (first) sel = { kind: "probe", blockId: fromBlock, probe: first };
    else {
      const nextIndex = Math.min(state.blockIndex + 1, state.agenda.blocks.length - 1);
      sel = { kind: "block", blockId: state.agenda.blocks[nextIndex].id, blockIndex: nextIndex };
    }
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
  const ack = !wantsAck
    ? ""
    : askedHelena(lastText)
      ? ASKED_ACK
      : override
        ? override.ack
        : cleanReaction(await ctx.ai.phraseAck({ lastText, findings: newFindings, probeText, recentReactions: (state.reactions ?? []).slice(-3), recent: recentTurns(state) }), state.reactions ?? []);
  if (ack) state = { ...state, reactions: [...(state.reactions ?? []), ack] };
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

  // Risco: a regra decide; com negação antes do trecho, a IA julga. Só um "negado" claro deixa a conversa seguir.
  if (detectCrisis(text).hit || extraCrisis(text)) {
    const action = await assessRisk(text, { extraHit: extraCrisis(text), extraPatterns: EXTRA_CRISIS_PATTERNS });
    if (action !== "seguir") return crisis({ ...ctx, state: s });
  }
  if (blockId === "seguranca" && safetyClearlyYes(text)) return crisis({ ...ctx, state: s });

  // Tentativa de mudar as regras da IA: a fala não vai para a IA, a Helena repete a pergunta e a médica é avisada.
  if (detectInjection(text).hit) {
    const idx = s.turns.length - 1;
    const attempts = (s.injectionTurns ?? []).length + 1;
    s = addAviso({ ...s, injectionTurns: [...(s.injectionTurns ?? []), idx] }, `Tentou mudar as regras da entrevista: “${text.slice(0, 120)}”. A Helena não obedeceu e seguiu a pauta.`, [idx]);
    if (attempts >= MAX_INJECTION_ATTEMPTS) return closing({ ...ctx, state: s }, "stopped");
    const asked = currentQuestion(state, blockId);
    return aiTurn(
      { ...ctx, state: s },
      {
        text: `${GUARD_PREFIX} ${asked.text}`,
        probeId: state.currentProbeId,
        blockId,
        cacheKey: null,
        final: false,
        crisis: false,
        parts: [{ text: GUARD_PREFIX, cacheKey: "guarda:prefixo" }, { text: asked.text, cacheKey: questionKey(state, blockId) }],
      },
      "running",
    );
  }

  const q = currentQuestion(state, blockId);
  const thisTurn = s.turns.length - 1;

  if (normalizeText(text).length < 2) {
    if (s.repeatCount === 0) {
      // a fonte da verdade é a pergunta atual, nunca o texto falado (que pode ter acolhimento gerado)
      s = { ...s, repeatCount: 1 };
      const probeKey = questionKey(state, blockId);
      return aiTurn({ ...ctx, state: s }, { text: REPEAT_PREFIX + q.text, probeId: state.currentProbeId, blockId, cacheKey: isFollowUp(state.currentProbeId) ? null : `${blockId}:repeat:${state.currentProbeId ?? "base"}`, final: false, crisis: false, parts: [{ text: REPEAT_PREFIX.trim(), cacheKey: "prefixo:repetir" }, { text: q.text, cacheKey: probeKey }] }, "running");
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
    const parts = firstTime ? undefined : [{ text: REPEAT_ASK_PREFIX.trim(), cacheKey: "prefixo:claro" }, { text: q.text, cacheKey: questionKey(state, blockId) }];
    return aiTurn({ ...ctx, state: s }, { text: say, probeId: state.currentProbeId, blockId, cacheKey: isFollowUp(state.currentProbeId) ? null : key, final: false, crisis: false, parts }, "running");
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

  // Conversa guiada pela IA, numa chamada só: extrai, reage e escolhe o que vem depois (validado em código).
  if (ai.planTurn && s.mode === "live" && blockId !== "abertura" && blockId !== "seguranca") {
    const input = planInput(s, blockId, text);
    let p: TurnPlan | null = null;
    try {
      p = await ai.planTurn(input);
    } catch {
      p = null;
    }
    if (p) {
      const turnIdx = s.turns.length - 1;
      const planned = p.achados.map((d) => ({ ...d, turnIdx, blockId }));
      s = { ...s, findings: [...s.findings, ...planned] };
      if (planned.some((f) => f.pediuParar)) return closing({ ...ctx, state: s }, "stopped");
      const ack = askedHelena(text) ? ASKED_ACK : cleanReaction(p.reacao, s.reactions ?? []);
      const follow = p.proxima === "aprofundar" && input.allowFollowUp ? validFollowUp(p.pergunta, s, input.upcomingQuestions) : null;
      const choice: Choice | null = follow
        ? { kind: "followup", text: follow }
        : p.proxima === "sonda" && p.sondaId
          ? { kind: "probe", id: p.sondaId }
          : p.proxima === "seguir"
            ? { kind: "leave" }
            : null;
      return advance({ ...ctx, state: s }, text, planned, { ack, choice });
    }
  }

  let newFindings: Finding[] = [];
  if (blockId !== "abertura" && blockId !== "seguranca") {
    const probeText = state.turns.at(-1)?.text ?? "";
    const drafts = await ai.extractFindings({ blockId, probeText, text: clampInput(text) });
    const turnIdx = s.turns.length - 1;
    newFindings = drafts.map((d) => ({ ...d, turnIdx, blockId }));
    s = { ...s, findings: [...s.findings, ...newFindings] };
  }
  if (newFindings.some((f) => f.pediuParar)) return closing({ ...ctx, state: s }, "stopped");

  return advance({ ...ctx, state: s }, text, newFindings);
}

import { getAi } from "@/lib/ai";
import { CRISIS_REPLY } from "@/lib/crisis/messages";
import { detectCrisis, normalizeText } from "@/lib/crisis/detect";
import { computeSeverity, getItems, inviteThreshold, nextItemIndex, scoreRun, shouldInviteToInterview, wellbeingIndex } from "@/lib/instruments";
import type { QuestionnaireRun } from "@/db/schema";
import { copy, formatItem } from "./copy";
import * as repo from "./repo";

export type EngineEvent =
  | "ignored_unknown"
  | "duplicate"
  | "consent_ok"
  | "consent_repeat"
  | "declined"
  | "answer"
  | "repeat"
  | "stopped"
  | "crisis"
  | "resumed"
  | "finished"
  | "no_active_run"
  | "already_running";

export type EngineResult = {
  outbound: string[];
  /** Ids das linhas em `messages` de cada outbound, na mesma ordem (para marcar entrega). */
  outboundIds: string[];
  runId: string | null;
  event: EngineEvent;
};

type Hooks = {
  onAnswer?: (answerId: string) => Promise<void>;
  onRunFinished?: (runId: string) => Promise<void>;
  /** Cria o convite da entrevista e devolve o link para o colaborador. */
  onInvite?: (runId: string) => Promise<string>;
};
/** Por padrão: cada resposta ganha indícios com trecho (RAG) e cada questionário encerrado ganha resumo. */
const hooks: Hooks = {
  onAnswer: async (answerId) => {
    await (await import("@/lib/evidence")).recordEvidence(answerId);
  },
  onRunFinished: async (runId) => {
    await (await import("@/lib/evidence")).buildSummary(runId);
  },
  onInvite: async (runId) => {
    const { getInterviewService } = await import("@/lib/interview/service");
    return (await getInterviewService().createInvite(runId)).inviteUrl;
  },
};
/** Troca os ganchos (testes ou outro pipeline). Erros nos ganchos nunca derrubam a conversa. */
export function registerEngineHooks(h: Hooks) {
  Object.assign(hooks, h);
}
async function runHook(fn: (() => Promise<void>) | undefined) {
  try {
    await fn?.();
  } catch (err) {
    console.error("[engine] gancho falhou", err);
  }
}

const YES = new Set(["1", "sim", "s", "aceito", "sim, aceito", "aceitar", "ok"]);
const NO = new Set(["2", "nao", "n", "nao quero", "nao quero participar"]);
const unknownNotified = new Set<string>();

export async function startRun(
  contactId: string,
  opts: { demoShort?: boolean } = {},
): Promise<{ runId: string; outbound: string[]; outboundIds: string[] }> {
  const contact = await repo.getContact(contactId);
  if (!contact) throw new Error("Contato não encontrado");
  const demoShort = opts.demoShort ?? process.env.DEMO_SHORT === "true";
  const active = await repo.getActiveRun(contactId);
  if (active) await repo.updateRun(active.id, { status: "stopped", finishedAt: new Date() });
  const run = await repo.createRun({ contactId, status: "consent", demoShort, startedAt: new Date() });
  const outbound = [copy.consent(contact.name, demoShort)];
  const outboundIds = await recordOut(contactId, run.id, outbound);
  return { runId: run.id, outbound, outboundIds };
}

async function recordOut(contactId: string, runId: string | null, outbound: string[]): Promise<string[]> {
  const ids: string[] = [];
  for (const text of outbound) {
    const id = await repo.insertMessage({ contactId, runId, direction: "out", text });
    if (id) ids.push(id);
  }
  return ids;
}

/** Uma fila por telefone: mensagens da mesma pessoa são processadas uma de cada vez, na ordem de chegada. */
const queues = new Map<string, Promise<unknown>>();
function serialize<T>(key: string, task: () => Promise<T>): Promise<T> {
  const previous = queues.get(key) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(task);
  queues.set(key, current);
  current.finally(() => {
    if (queues.get(key) === current) queues.delete(key);
  }).catch(() => undefined);
  return current;
}

export async function finishRun(
  run: QuestionnaireRun,
  status: "done" | "stopped" | "crisis",
  opts: { crisisText?: boolean } = {},
): Promise<{ invite: string[] }> {
  const answers = await repo.getAnswers(run.id);
  const scores = scoreRun(answers, run.demoShort);
  await repo.replaceScores(run.id, scores);
  const { severity, clinicalOnly, partial } = computeSeverity({
    answers,
    scores,
    demoShort: run.demoShort,
    crisisText: !!opts.crisisText || status === "crisis",
  });
  await repo.updateRun(run.id, { status, severity, clinicalOnly, partial, finishedAt: new Date(), retryCount: 0 });
  await runHook(hooks.onRunFinished && (() => hooks.onRunFinished!(run.id)));
  if (status !== "done") return { invite: [] };
  return { invite: await maybeInvite(run.id, severity, wellbeingIndex(answers, run.demoShort)) };
}

/**
 * Convite automático (ligado por padrão; INTERVIEW_AUTO_INVITE=false desliga): índice abaixo do limite
 * ou indício pela regra. Falha ao criar o convite nunca derruba o encerramento.
 */
async function maybeInvite(runId: string, severity: Parameters<typeof shouldInviteToInterview>[0]["severity"], index: number | null): Promise<string[]> {
  if (process.env.INTERVIEW_AUTO_INVITE === "false" || !hooks.onInvite) return [];
  if (!shouldInviteToInterview({ severity, index, threshold: inviteThreshold() })) return [];
  try {
    return [copy.interviewInvite(await hooks.onInvite(runId))];
  } catch (err) {
    console.error("[engine] não consegui criar o convite da entrevista", err);
    return [];
  }
}

export function handleIncoming(input: { phone: string; text: string; waMessageId: string }): Promise<EngineResult> {
  return serialize(input.phone, () => processIncoming(input));
}

async function processIncoming(input: { phone: string; text: string; waMessageId: string }): Promise<EngineResult> {
  const { phone, text, waMessageId } = input;
  const none = (event: EngineEvent, outbound: string[] = []): EngineResult => ({ outbound, outboundIds: [], runId: null, event });

  const contact = await repo.findContactByPhone(phone);
  if (!contact) {
    if (unknownNotified.has(phone)) return none("ignored_unknown");
    if (unknownNotified.size > 5000) unknownNotified.clear();
    unknownNotified.add(phone);
    return none("ignored_unknown", [copy.unknownNumber]);
  }

  const active = await repo.getActiveRun(contact.id);
  // Gravar primeiro: o índice único em wa_message_id torna a detecção de duplicata atômica.
  const inboundId = await repo.insertMessage({
    contactId: contact.id,
    runId: active?.id ?? null,
    direction: "in",
    text,
    waMessageId: waMessageId || null,
  });
  if (!inboundId) return none("duplicate");

  const reply = async (runId: string | null, event: EngineEvent, outbound: string[]): Promise<EngineResult> => {
    const outboundIds = await recordOut(contact.id, runId, outbound);
    return { outbound, outboundIds, runId, event };
  };

  // 1. Corte de crise: sempre primeiro, antes de qualquer IA.
  if (detectCrisis(text).hit) {
    if (active) {
      await finishRun(active, "crisis", { crisisText: true });
      return reply(active.id, "crisis", [CRISIS_REPLY]);
    }
    const run = await repo.createRun({
      contactId: contact.id,
      status: "crisis",
      severity: "urgency",
      partial: true,
      startedAt: new Date(),
      finishedAt: new Date(),
    });
    await repo.setMessageRun(inboundId, run.id);
    return reply(run.id, "crisis", [CRISIS_REPLY]);
  }

  const command = normalizeText(text).replace(/[.!]+$/, "");

  // 2. Comandos.
  if (command === "parar") {
    if (!active) return reply(null, "no_active_run", [copy.noActiveRun]);
    await finishRun(active, "stopped");
    return reply(active.id, "stopped", [copy.stopped]);
  }

  if (command === "continuar" && !active) {
    const latest = await repo.getLatestRun(contact.id);
    if (!latest || (latest.status !== "crisis" && latest.status !== "stopped") || latest.currentItem < 0) {
      return reply(null, "no_active_run", [copy.noActiveRun]);
    }
    // Sem consentimento dado antes, não há o que retomar: pede o consentimento de novo.
    if (!latest.consentedAt) {
      const started = await startRun(contact.id, { demoShort: latest.demoShort });
      return { ...started, event: "consent_repeat" };
    }
    const items = getItems(latest.demoShort);
    const run = await repo.createRun({
      contactId: contact.id,
      status: "in_progress",
      demoShort: latest.demoShort,
      resumedFromRunId: latest.id,
      consentedAt: latest.consentedAt,
      startedAt: new Date(),
    });
    await repo.copyAnswers(latest.id, run.id);
    const answers = await repo.getAnswers(run.id);
    const from = items.findIndex((it, i) => i >= latest.currentItem && answers[it.code] === undefined);
    const next = from < 0 ? -1 : nextItemIndex(items, answers, from);
    if (next < 0) {
      const { invite } = await finishRun(run, "done");
      return reply(run.id, "finished", [copy.closing(), ...invite]);
    }
    await repo.updateRun(run.id, { currentItem: next });
    return reply(run.id, "resumed", [copy.resumed, formatItem(items[next])]);
  }

  if (command === "comecar" && !active) {
    const started = await startRun(contact.id);
    return { ...started, event: "consent_repeat" };
  }

  if (!active) return reply(null, "no_active_run", [copy.noActiveRun]);

  const items = getItems(active.demoShort);

  // 3. Consentimento.
  if (active.status === "consent") {
    if (YES.has(command)) {
      const first = nextItemIndex(items, {}, 0);
      await repo.updateRun(active.id, { status: "in_progress", currentItem: first, consentedAt: new Date() });
      return reply(active.id, "consent_ok", [copy.opening, formatItem(items[first])]);
    }
    if (NO.has(command)) {
      await repo.updateRun(active.id, { status: "stopped", finishedAt: new Date() });
      return reply(active.id, "declined", [copy.declined]);
    }
    return reply(active.id, "consent_repeat", [copy.consentRepeat]);
  }

  // 4. Resposta a um item.
  const item = items[active.currentItem];
  if (command === "continuar" || command === "comecar") {
    return reply(active.id, "already_running", [copy.alreadyRunning, formatItem(item)]);
  }
  let value: number | null = null;
  let rawText = text;
  if (item.scale) {
    value = await getAi().interpretAnswer(item, text);
    if (value === null && active.retryCount === 0) {
      await repo.updateRun(active.id, { retryCount: 1 });
      return reply(active.id, "repeat", [copy.repeat, formatItem(item)]);
    }
  } else if (command === "pular") {
    rawText = "";
  }

  const answerRow = await repo.upsertAnswer(active.id, item, rawText, value);
  await runHook(hooks.onAnswer && (() => hooks.onAnswer!(answerRow.id)));

  const answers = await repo.getAnswers(active.id);
  const next = nextItemIndex(items, answers, active.currentItem + 1);

  // Item 9 do PHQ-9 positivo: mensagem de segurança e urgência (manual Pfizer p. 2).
  if (item.code === "PHQ9_9" && value !== null && value >= 1) {
    await repo.updateRun(active.id, { currentItem: next });
    await finishRun({ ...active, currentItem: next }, "crisis");
    return reply(active.id, "crisis", [CRISIS_REPLY]);
  }

  if (next < 0) {
    const { invite } = await finishRun(active, "done");
    return reply(active.id, "finished", [copy.closing(), ...invite]);
  }
  await repo.updateRun(active.id, { currentItem: next, retryCount: 0 });
  return reply(active.id, "answer", [formatItem(items[next])]);
}

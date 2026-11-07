import { getAi } from "@/lib/ai";
import { CRISIS_REPLY } from "@/lib/crisis/messages";
import { detectCrisis, normalizeText } from "@/lib/crisis/detect";
import { computeSeverity, getItems, nextItemIndex, scoreRun } from "@/lib/instruments";
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
  | "no_active_run";

export type EngineResult = { outbound: string[]; runId: string | null; event: EngineEvent };

type Hooks = {
  onAnswer?: (answerId: string) => Promise<void>;
  onRunFinished?: (runId: string) => Promise<void>;
};
const hooks: Hooks = {};
/** Ganchos opcionais (T9 registra o RAG e o resumo aqui). Erros nos ganchos nunca derrubam a conversa. */
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

export async function startRun(contactId: string, opts: { demoShort?: boolean } = {}): Promise<{ runId: string; outbound: string[] }> {
  const contact = await repo.getContact(contactId);
  if (!contact) throw new Error("Contato não encontrado");
  const demoShort = opts.demoShort ?? process.env.DEMO_SHORT === "true";
  const active = await repo.getActiveRun(contactId);
  if (active) await repo.updateRun(active.id, { status: "stopped", finishedAt: new Date() });
  const run = await repo.createRun({ contactId, status: "consent", demoShort, startedAt: new Date() });
  const outbound = [copy.consent(contact.name, demoShort)];
  await recordOut(contactId, run.id, outbound);
  return { runId: run.id, outbound };
}

async function recordOut(contactId: string, runId: string | null, outbound: string[]) {
  for (const text of outbound) await repo.insertMessage({ contactId, runId, direction: "out", text });
}

export async function finishRun(
  run: QuestionnaireRun,
  status: "done" | "stopped" | "crisis",
  opts: { crisisText?: boolean } = {},
): Promise<void> {
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
}

export async function handleIncoming(input: { phone: string; text: string; waMessageId: string }): Promise<EngineResult> {
  const { phone, text, waMessageId } = input;
  if (waMessageId && (await repo.messageExists(waMessageId))) return { outbound: [], runId: null, event: "duplicate" };

  const contact = await repo.findContactByPhone(phone);
  if (!contact) {
    if (unknownNotified.has(phone)) return { outbound: [], runId: null, event: "ignored_unknown" };
    unknownNotified.add(phone);
    return { outbound: [copy.unknownNumber], runId: null, event: "ignored_unknown" };
  }

  const active = await repo.getActiveRun(contact.id);
  await repo.insertMessage({ contactId: contact.id, runId: active?.id ?? null, direction: "in", text, waMessageId });

  const reply = async (runId: string | null, event: EngineEvent, outbound: string[]): Promise<EngineResult> => {
    await recordOut(contact.id, runId, outbound);
    return { outbound, runId, event };
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
    const items = getItems(latest.demoShort);
    const run = await repo.createRun({
      contactId: contact.id,
      status: "in_progress",
      demoShort: latest.demoShort,
      resumedFromRunId: latest.id,
      startedAt: new Date(),
    });
    await repo.copyAnswers(latest.id, run.id);
    const answers = await repo.getAnswers(run.id);
    const from = items.findIndex((it, i) => i >= latest.currentItem && answers[it.code] === undefined);
    const next = from < 0 ? -1 : nextItemIndex(items, answers, from);
    if (next < 0) {
      await finishRun(run, "done");
      return reply(run.id, "finished", [copy.closing()]);
    }
    await repo.updateRun(run.id, { currentItem: next });
    return reply(run.id, "resumed", [copy.resumed, formatItem(items[next])]);
  }

  if (command === "comecar" && !active) {
    const { runId, outbound } = await startRun(contact.id);
    return { outbound, runId, event: "consent_repeat" };
  }

  if (!active) return reply(null, "no_active_run", [copy.noActiveRun]);

  const items = getItems(active.demoShort);

  // 3. Consentimento.
  if (active.status === "consent") {
    if (YES.has(command)) {
      const first = nextItemIndex(items, {}, 0);
      await repo.updateRun(active.id, { status: "in_progress", currentItem: first });
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
    await finishRun(active, "done");
    return reply(active.id, "finished", [copy.closing()]);
  }
  await repo.updateRun(active.id, { currentItem: next, retryCount: 0 });
  return reply(active.id, "answer", [formatItem(items[next])]);
}

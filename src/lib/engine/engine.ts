import { getAi } from "@/lib/ai";
import { CRISIS_REPLY } from "@/lib/crisis/messages";
import { detectCrisis, normalizeText } from "@/lib/crisis/detect";
import { assessRisk, isClearNo } from "@/lib/crisis/judge";
import { computeSeverity, getItems, inviteThreshold, nextItemIndex, scoreRun, shouldInviteToInterview, wellbeingIndex } from "@/lib/instruments";
import type { QuestionnaireRun } from "@/db/schema";
import { copy, formatItem } from "./copy";
import { judgeReading } from "./reading";
import type { ReplyStage } from "@/lib/ai/types";
import type { Item } from "@/lib/instruments/types";
import * as repo from "./repo";
import { withObsContext } from "@/lib/obs/context";
import { recordEvent } from "@/lib/obs/events";

const SEVERITY_LABEL = { urgency: "Urgência", priority: "Prioridade", attention: "Atenção", none: "Sem indício" } as const;
/** "\\bme (machucar|ferir)\\b" → "me (machucar|ferir)" */
const readablePattern = (p?: string) => (p ?? "").replace(/\\b/g, "").trim();

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
  | "already_running"
  | "crisis_confirm"
  | "crisis_denied"
  | "media"
  | "joined"
  | "doubt"
  | "confirm"
  | "corrected";

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
const defaultHooks: Hooks = {
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
const hooks: Hooks = { ...defaultHooks };
/** Troca os ganchos (testes ou outro pipeline). Erros nos ganchos nunca derrubam a conversa. */
export function registerEngineHooks(h: Hooks) {
  Object.assign(hooks, h);
}
/** Volta aos ganchos padrão (testes). */
export function restoreDefaultEngineHooks() {
  Object.assign(hooks, defaultHooks);
}

/**
 * Indícios e resumo rodam em segundo plano: a pessoa recebe a próxima pergunta sem esperar a IA.
 * O resumo de um questionário só começa depois que os indícios dele terminaram.
 */
const pending = new Map<string, Promise<void>[]>();
function inBackground(runId: string, task: () => Promise<void>, after: Promise<unknown>[] = []): void {
  const p = Promise.allSettled(after).then(() => withObsContext({ runId }, () => runHook(task)));
  const list = pending.get(runId) ?? [];
  list.push(p);
  pending.set(runId, list);
  p.finally(() => {
    const now = (pending.get(runId) ?? []).filter((x) => x !== p);
    if (now.length) pending.set(runId, now);
    else pending.delete(runId);
  });
}
/** Espera tudo o que está em segundo plano terminar (testes, evals e scripts). */
export async function settleBackground(): Promise<void> {
  while (pending.size > 0) await Promise.allSettled([...pending.values()].flat());
}
async function runHook(fn: (() => Promise<void>) | undefined) {
  try {
    await fn?.();
  } catch (err) {
    console.error("[engine] gancho falhou", err);
  }
}

// Número não é atalho de opção: "1" e "2" não aceitam nem recusam. Fora destes, a IA lê a mensagem.
const YES = new Set(["sim", "s", "aceito", "sim, aceito", "aceitar", "ok", "pode", "bora", "vamos", "claro", "isso", "isso mesmo", "exatamente", "exato", "correto", "certo", "e isso"]);
const NO = new Set(["nao", "n", "nao quero", "nao quero participar", "prefiro nao"]);
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
  const index = wellbeingIndex(answers, run.demoShort);
  recordEvent({
    kind: "gravidade",
    outcome: "ok",
    model: "regra em código",
    runId: run.id,
    detail: `${SEVERITY_LABEL[severity]}${index !== null ? ` · índice ${index}/100` : ""}${partial ? " · questionário incompleto" : ""}`,
  });
  if (hooks.onRunFinished) inBackground(run.id, () => hooks.onRunFinished!(run.id), [...(pending.get(run.id) ?? [])]);
  if (status !== "done") return { invite: [] };
  return { invite: await maybeInvite(run.id, severity, index) };
}

/**
 * Convite automático (ligado por padrão; INTERVIEW_AUTO_INVITE=false desliga): índice abaixo do limite
 * ou indício pela regra. Falha ao criar o convite nunca derruba o encerramento.
 */
async function maybeInvite(runId: string, severity: Parameters<typeof shouldInviteToInterview>[0]["severity"], index: number | null): Promise<string[]> {
  if (process.env.INTERVIEW_AUTO_INVITE === "false" || !hooks.onInvite) return [];
  const threshold = inviteThreshold();
  const needed = shouldInviteToInterview({ severity, index, threshold });
  // Só na demonstração (INTERVIEW_INVITE_ALL=true): todo mundo é convidado, menos urgência, com uma nota explicando o uso real.
  const demoOnly = !needed && severity !== "urgency" && process.env.INTERVIEW_INVITE_ALL === "true";
  if (!needed && !demoOnly) {
    recordEvent({
      kind: "convite",
      outcome: "descartado",
      model: "regra em código",
      runId,
      detail: severity === "urgency" ? "Não convidou: urgência pede contato humano" : `Não convidou: índice ${index ?? "—"} acima do limite de ${threshold} e sem critério da regra`,
    });
    return [];
  }
  try {
    const url = await hooks.onInvite(runId);
    recordEvent({
      kind: "convite",
      outcome: "ok",
      model: "regra em código",
      runId,
      detail: demoOnly
        ? `Convite de demonstração: em uso real não convidaria (índice ${index ?? "—"}, acima do limite de ${threshold}, sem critério da regra)`
        : `Convite da entrevista enviado pelo WhatsApp (${SEVERITY_LABEL[severity]}, índice ${index ?? "—"}, limite ${threshold})`,
    });
    return [copy.interviewInvite(url, demoOnly ? threshold : undefined)];
  } catch (err) {
    console.error("[engine] não consegui criar o convite da entrevista", err);
    recordEvent({ kind: "convite", outcome: "erro", runId, detail: err instanceof Error ? err.message : String(err) });
    return [];
  }
}

export function handleIncoming(input: { phone: string; text: string; waMessageId: string; viaAudio?: boolean; name?: string }): Promise<EngineResult> {
  return serialize(input.phone, () => processIncoming(input));
}

/**
 * Figurinha, foto, vídeo, arquivo ou áudio que não deu para transcrever: resposta padrão e, no meio do
 * questionário, a pergunta atual de novo. Número desconhecido não recebe resposta.
 */
export function handleMedia(input: { phone: string; waMessageId: string; media: string }): Promise<EngineResult> {
  return serialize(input.phone, async () => {
    const none: EngineResult = { outbound: [], outboundIds: [], runId: null, event: "ignored_unknown" };
    const contact = await repo.findContactByPhone(input.phone);
    if (!contact) return none;
    const active = await repo.getActiveRun(contact.id);
    const inboundId = await repo.insertMessage({
      contactId: contact.id,
      runId: active?.id ?? null,
      direction: "in",
      text: `[${input.media}]`,
      waMessageId: input.waMessageId || null,
    });
    if (!inboundId) return { ...none, event: "duplicate" };
    const failedAudio = input.media === "áudio sem transcrição";
    const outbound = [failedAudio ? copy.audioFailed : copy.mediaUnsupported];
    if (active?.status === "in_progress") outbound.push(formatItem(getItems(active.demoShort)[active.currentItem]));
    else if (active?.status === "consent") outbound.push(copy.consentRepeat);
    recordEvent({ kind: failedAudio ? "transcrição do áudio" : "mídia", outcome: failedAudio ? "erro" : "descartado", runId: active?.id ?? null, detail: failedAudio ? "Não deu para transcrever o áudio; pediu para escrever" : `Recebeu ${input.media}; respondeu que só lê texto e áudio` });
    const outboundIds = await recordOut(contact.id, active?.id ?? null, outbound);
    return { outbound, outboundIds, runId: active?.id ?? null, event: "media" };
  });
}

async function processIncoming(input: { phone: string; text: string; waMessageId: string; viaAudio?: boolean; name?: string }): Promise<EngineResult> {
  const { phone, text, waMessageId } = input;
  const none = (event: EngineEvent, outbound: string[] = []): EngineResult => ({ outbound, outboundIds: [], runId: null, event });

  let contact = await repo.findContactByPhone(phone);
  // Entrada aberta (OPEN_ENTRY=true, demo): quem mandar mensagem vira colaborador na hora, com o nome do perfil.
  let joined = false;
  if (!contact && process.env.OPEN_ENTRY === "true") {
    contact = await repo.createContact({ name: input.name || `Colaborador ${phone.slice(-4)}`, phoneE164: phone, sector: "Demo" });
    joined = !!contact;
    if (joined) recordEvent({ kind: "entrada", outcome: "ok", model: "regra em código", detail: `Número novo entrou pela entrada aberta (${input.name ? "nome do perfil" : "sem nome no perfil"})` });
  }
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
    viaAudio: !!input.viaAudio,
  });
  if (!inboundId) return none("duplicate");

  const reply = async (runId: string | null, event: EngineEvent, outbound: string[]): Promise<EngineResult> => {
    // Sem eco do áudio para a pessoa: a transcrição fica gravada (messages.via_audio) e o médico a vê marcada no Caso.
    const outboundIds = await recordOut(contact.id, runId, outbound);
    return { outbound, outboundIds, runId, event };
  };

  // 1. Corte de crise: sempre primeiro. A regra decide; a IA só é chamada se houver negação antes do trecho de risco.
  const cutCrisis = async (crisisDetail: string): Promise<EngineResult> => {
    if (active) {
      recordEvent({ kind: "crise", outcome: "ok", model: "regra em código", runId: active.id, detail: crisisDetail });
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
    recordEvent({ kind: "crise", outcome: "ok", model: "regra em código", runId: run.id, detail: crisisDetail });
    return reply(run.id, "crisis", [CRISIS_REPLY]);
  };

  // 1a. A última mensagem do bot foi a pergunta de confirmação: só um "não" claro deixa seguir.
  if ((await repo.lastOutboundText(contact.id)) === copy.crisisConfirm) {
    if (!isClearNo(text)) return cutCrisis(`Na confirmação de risco respondeu: “${text.slice(0, 120)}”. CVV 188 e SAMU 192 enviados`);
    recordEvent({ kind: "crise", outcome: "descartado", model: "regra em código", runId: active?.id ?? null, detail: `Confirmou que não tem pensado em se machucar: “${text.slice(0, 80)}”` });
    if (active?.status === "in_progress") {
      return reply(active.id, "crisis_denied", [copy.crisisDenied, formatItem(getItems(active.demoShort)[active.currentItem])]);
    }
    return reply(active?.id ?? null, "crisis_denied", [copy.crisisDenied]);
  }

  const crisis = detectCrisis(text);
  if (crisis.hit) {
    const action = await withObsContext({ runId: active?.id ?? null }, () => assessRisk(text));
    if (action === "cortar") {
      return cutCrisis(`Frase de risco: “${text.slice(0, 120)}” (padrão ${readablePattern(crisis.pattern)}). CVV 188 e SAMU 192 enviados`);
    }
    if (action === "confirmar") {
      recordEvent({ kind: "crise", outcome: "ok", model: "regra + IA", runId: active?.id ?? null, detail: `Frase de risco com negação, sem certeza: perguntou para confirmar (“${text.slice(0, 100)}”)` });
      return reply(active?.id ?? null, "crisis_confirm", [copy.crisisConfirm]);
    }
    recordEvent({ kind: "crise", outcome: "descartado", model: "regra + IA", runId: active?.id ?? null, detail: `Frase de risco negada pela pessoa: “${text.slice(0, 100)}”` });
  }

  // 1b. Número que acabou de entrar: começa pelo consentimento, qualquer que tenha sido a primeira mensagem.
  if (joined) {
    const started = await startRun(contact.id);
    await repo.setMessageRun(inboundId, started.runId);
    return { ...started, event: "joined" };
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

  // 3. Consentimento: sim/não por extenso; o resto a IA lê (aceite, recusa ou dúvida).
  if (active.status === "consent") {
    let intent: "yes" | "no" | "doubt" | "other" = YES.has(command) ? "yes" : NO.has(command) ? "no" : "other";
    if (intent === "other") {
      const r = await readReply(active.id, "consent", null, null, [], text);
      intent = r.intent === "yes" || r.intent === "no" || r.intent === "doubt" ? r.intent : "other";
    }
    if (intent === "yes") {
      const first = nextItemIndex(items, {}, 0);
      await repo.updateRun(active.id, { status: "in_progress", currentItem: first, consentedAt: new Date() });
      return reply(active.id, "consent_ok", [copy.opening, formatItem(items[first])]);
    }
    if (intent === "no") {
      await repo.updateRun(active.id, { status: "stopped", finishedAt: new Date() });
      return reply(active.id, "declined", [copy.declined]);
    }
    return reply(active.id, "consent_repeat", [intent === "doubt" ? copy.consentDoubt : copy.consentRepeat]);
  }

  // 4. Resposta a um item.
  const item = items[active.currentItem];
  if (command === "continuar" || command === "comecar") {
    return reply(active.id, "already_running", [copy.alreadyRunning, formatItem(item)]);
  }

  const answersNow = await repo.getAnswers(active.id);
  const previous = previousItem(items, answersNow, active.currentItem);

  /** Grava a resposta do item atual, avança e manda a próxima pergunta (com frase de ligação se a fala já tocou nela). */
  const saveAndAdvance = async (value: number | null, rawText: string, meta: repo.AnswerMeta, mentions: string[] = [], prefix: string[] = []): Promise<EngineResult> => {
    const answerRow = await repo.upsertAnswer(active.id, item, rawText, value, { messageId: inboundId, ...meta });
    if (hooks.onAnswer) inBackground(active.id, () => hooks.onAnswer!(answerRow.id));

    const answers = await repo.getAnswers(active.id);
    const next = nextItemIndex(items, answers, active.currentItem + 1);

    // Item 9 do PHQ-9 positivo: mensagem de segurança e urgência (manual Pfizer p. 2).
    if (item.code === "PHQ9_9" && value !== null && value >= 1) {
      recordEvent({ kind: "crise", outcome: "ok", model: "regra em código", runId: active.id, detail: `Item 9 do PHQ-9 = ${value}. CVV 188 e SAMU 192 enviados` });
      await repo.updateRun(active.id, { currentItem: next, pendingValue: null });
      await finishRun({ ...active, currentItem: next }, "crisis");
      return reply(active.id, "crisis", [CRISIS_REPLY]);
    }

    if (next < 0) {
      const { invite } = await finishRun(active, "done");
      return reply(active.id, "finished", [...prefix, copy.closing(), ...invite]);
    }
    await repo.updateRun(active.id, { currentItem: next, retryCount: 0, pendingValue: null });
    const question = formatItem(items[next]);
    const bridged = mentions.includes(items[next].code) ? `${copy.bridge}\n${question}` : question;
    return reply(active.id, "answer", [...prefix, bridged]);
  };

  // 4a. Resposta aberta: grava como veio ("pular" grava vazio).
  if (!item.scale) {
    return saveAndAdvance(null, command === "pular" ? "" : text, { source: "aberta" });
  }

  // 4b. Confirmação pendente ("Só para confirmar: vários dias?").
  if (active.pendingValue !== null && active.pendingValue !== undefined) {
    const pending = active.pendingValue;
    let intent = YES.has(command) ? "yes" : NO.has(command) ? "no" : null;
    if (!intent) intent = (await readReply(active.id, "confirm", item, previous, [], text)).intent;
    await repo.updateRun(active.id, { pendingValue: null });
    if (intent === "yes") {
      recordEvent({ kind: "valor da resposta", outcome: "ok", model: "regra em código", runId: active.id, detail: `Confirmou ${pending} para ${item.code}` });
      const firstText = (await repo.getAnswerRows(active.id)).find((a) => a.itemCode === item.code);
      return saveAndAdvance(pending, firstText?.rawText ?? text, { source: "ia_confirmada", quote: firstText?.quote ?? null, messageId: firstText?.messageId ?? inboundId });
    }
    if (intent === "no") {
      recordEvent({ kind: "leitura da resposta", outcome: "descartado", model: "regra em código", runId: active.id, detail: `Não confirmou o valor proposto (${pending}); perguntou de novo com as opções` });
      return reply(active.id, "repeat", [copy.repeat(item)]);
    }
    // respondeu outra coisa: vale como resposta nova, lida abaixo
  }

  // 4c. A IA lê; o código decide.
  const upcoming = items.slice(active.currentItem + 1).filter((i) => i.scale).slice(0, 3).map((i) => ({ code: i.code, text: i.text }));
  const reading = await readReply(active.id, "item", item, previous, upcoming, text);

  if (reading.intent === "doubt") {
    return reply(active.id, "doubt", [copy.doubt(item), formatItem(item)]);
  }
  if (reading.intent === "stop" && reading.confidence === "alta") {
    await finishRun(active, "stopped");
    return reply(active.id, "stopped", [copy.stopped]);
  }
  if (reading.intent === "skip") {
    recordEvent({ kind: "leitura da resposta", outcome: "ok", model: reading.source === "ia" ? "IA" : "regra local", runId: active.id, detail: `Preferiu não responder ${item.code}` });
    return saveAndAdvance(null, text, { source: reading.source === "ia" ? "ia" : "regra" });
  }
  if (reading.intent === "correction" && previous?.scale) {
    const v = judgeReading(previous, text, reading);
    if (v.kind === "accept") {
      await repo.upsertAnswer(active.id, previous, text, v.value, { source: v.source === "ia" ? "ia" : "regra", quote: v.quote, messageId: inboundId });
      recordEvent({ kind: "leitura da resposta", outcome: "ok", model: "regra em código", runId: active.id, detail: `Corrigiu ${previous.code} para ${v.value}` });
      if (previous.code === "PHQ9_9" && v.value >= 1) {
        recordEvent({ kind: "crise", outcome: "ok", model: "regra em código", runId: active.id, detail: `Correção do item 9 do PHQ-9 para ${v.value}. CVV 188 e SAMU 192 enviados` });
        await finishRun(active, "crisis");
        return reply(active.id, "crisis", [CRISIS_REPLY]);
      }
      return reply(active.id, "corrected", [copy.corrected, formatItem(item)]);
    }
  }

  const verdict = judgeReading(item, text, reading);
  const by = reading.source === "ia" ? "IA" : "regra local";
  recordEvent({
    kind: "valor da resposta",
    outcome: verdict.kind === "reject" ? "descartado" : "ok",
    model: by,
    runId: active.id,
    detail:
      verdict.kind === "accept"
        ? `“${text.slice(0, 80)}” → ${verdict.value} (${by})`
        : verdict.kind === "confirm"
          ? `“${text.slice(0, 80)}” → ${verdict.value}? (${by}, pediu confirmação)`
          : `“${text.slice(0, 80)}” → sem valor (${by}${reading.value !== null ? `; proposta ${reading.value} recusada pelo código` : ""})`,
  });
  if (verdict.kind === "accept") {
    return saveAndAdvance(verdict.value, text, { source: verdict.source === "ia" ? "ia" : "regra", quote: verdict.quote }, reading.mentions);
  }
  if (verdict.kind === "confirm") {
    // guarda a fala original sem valor até o "sim"
    await repo.upsertAnswer(active.id, item, text, null, { source: null, quote: verdict.quote, messageId: inboundId });
    await repo.updateRun(active.id, { pendingValue: verdict.value });
    return reply(active.id, "confirm", [copy.confirm(item, verdict.value)]);
  }
  // não deu para ler: repete uma vez com as opções; na segunda, grava vazio e segue
  if (active.retryCount === 0) {
    await repo.updateRun(active.id, { retryCount: 1 });
    return reply(active.id, "repeat", [copy.repeat(item)]);
  }
  return saveAndAdvance(null, text, { source: null });
}

/** Lê a mensagem com a IA (ou a regra local, se a IA não responder), dentro do rastro do questionário. */
function readReply(runId: string, stage: ReplyStage, item: Item | null, previous: Item | null, upcoming: { code: string; text: string }[], text: string) {
  return withObsContext({ runId }, () => getAi().readReply({ stage, item, previous, upcoming, text }));
}

/** Último item com escala já respondido antes do atual (o único que a pessoa pode corrigir). */
function previousItem(items: Item[], answers: Record<string, number | null | undefined>, current: number): Item | null {
  for (let i = current - 1; i >= 0; i--) {
    if (answers[items[i].code] !== undefined) return items[i].scale ? items[i] : null;
  }
  return null;
}


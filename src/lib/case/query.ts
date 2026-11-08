import { wellbeingIndex } from "@/lib/instruments";
import { getSettings } from "@/lib/settings";
import { patientSummary } from "@/lib/case/patient-summary";
import { and, asc, eq, inArray, or } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db/client";
import {
  agentEvents,
  answers,
  contacts,
  documentChunks,
  documents,
  evidence,
  messages,
  questionnaireRuns,
  scores,
  summaries,
} from "@/db/schema";
import { RunSummarySchema, type RunSummary } from "@/lib/ai/types";
import { TRUNK_YES, getItems } from "@/lib/instruments";
import { valueLabel } from "@/lib/engine/copy";
import { clinicalSignal, toScoreChip } from "@/lib/case/score-chips";
import type { InterviewDetail, InterviewListItem } from "@/lib/interview/contract";
import {
  getSyntheticCaseDetail,
  SYNTHETIC_QUEUE_ROWS,
  type CaseDetailData,
  type CaseEvidenceItem,
  type QueueScoreChip,
  type TrailItem,
} from "@/lib/demo/fixtures";

export async function getCase(runId: string): Promise<CaseDetailData> {
  const data = await loadCase(runId);
  return {
    ...data,
    trail: SYNTHETIC_QUEUE_ROWS.some((r) => r.runId === runId) ? [] : await loadTrail(runId, data.interviews.map((i) => i.id)),
    patient: patientSummary({ run: data.run, interviews: data.interviews, interviewDetail: data.interviewDetail, summary: data.summary, threshold: (await getSettings()).inviteThreshold }),
  };
}

async function loadCase(runId: string): Promise<CaseDetailData> {
  // Se for um ID sintético de demonstração, retorna a fixture completa correspondente
  if (SYNTHETIC_QUEUE_ROWS.some((r) => r.runId === runId)) {
    return getSyntheticCaseDetail(runId);
  }

  try {
    const [runRow] = await db
      .select({
        run: questionnaireRuns,
        contact: contacts,
      })
      .from(questionnaireRuns)
      .innerJoin(contacts, eq(questionnaireRuns.contactId, contacts.id))
      .where(eq(questionnaireRuns.id, runId));

    if (!runRow) notFound();

    const { run, contact } = runRow;
    const [runMessages, runScores, runAnswers, runEvidenceRows, [summaryRow]] = await Promise.all([
      db.select().from(messages).where(eq(messages.runId, run.id)).orderBy(asc(messages.createdAt)),
      db.select().from(scores).where(eq(scores.runId, run.id)),
      db.select().from(answers).where(eq(answers.runId, run.id)),
      db
        .select({
          ev: evidence,
          chunk: documentChunks,
          doc: documents,
          ans: answers,
        })
        .from(evidence)
        .innerJoin(documentChunks, eq(evidence.chunkId, documentChunks.id))
        .innerJoin(documents, eq(documentChunks.documentId, documents.id))
        .leftJoin(answers, eq(evidence.answerId, answers.id))
        .where(eq(evidence.runId, run.id)),
      db.select().from(summaries).where(eq(summaries.runId, run.id)),
    ]);

    const chips: QueueScoreChip[] = runScores
      .map(toScoreChip)
      .filter((c): c is QueueScoreChip => c !== null);

    // "entendido como …": cada resposta aponta para a mensagem de onde saiu
    const readingByMessage = new Map(runAnswers.filter((a) => a.messageId).map((a) => [a.messageId!, a]));
    const itemsByCode = new Map(getItems(run.demoShort).map((i) => [i.code, i]));
    const trunkAns = runAnswers.find((a) => a.itemCode === "TRUNK" || a.itemCode === "SPS6_TRUNK");
    const phq9Item9 = runAnswers.find((a) => a.itemCode === "PHQ9_9");

    const mappedEvidence: CaseEvidenceItem[] = runEvidenceRows.map(({ ev, chunk, doc, ans }) => ({
      id: ev.id,
      itemCode: ans?.itemCode ?? ev.theme,
      theme: ev.theme,
      explanation: ev.explanation,
      source: ev.source,
      chunk: {
        id: chunk.id,
        documentTitle: doc.title,
        page: chunk.page,
        text: chunk.text,
      },
    }));

    const parsedSummary = summaryRow?.json ? RunSummarySchema.safeParse(summaryRow.json) : null;
    const validSummary: RunSummary | null = parsedSummary?.success ? parsedSummary.data : null;

    // Caso real: nunca completar com dados sintéticos. Vazio aparece como vazio.
    const { interviews, interviewDetail } = await loadInterviews(run.id);

    return {
      run: {
        runId: run.id,
        contactId: contact.id,
        contactName: contact.name,
        phoneE164: contact.phoneE164,
        sector: contact.sector ?? "Geral",
        role: contact.role ?? "Colaborador",
        severity: run.severity,
        clinicalOnly: run.clinicalOnly,
        partial: run.partial,
        status: run.status,
        caseState: run.caseState,
        startedAt: (run.startedAt ?? run.createdAt).toISOString(),
        finishedAt: run.finishedAt ? run.finishedAt.toISOString() : null,
        ruleTrace: {
          hasPresenteeismTrunk: trunkAns?.valueNumeric === TRUNK_YES,
          hasWorkImpairment: runScores.some((s) => s.instrument === "WPAI" && s.flagged),
          hasClinicalSignal: clinicalSignal(runScores, run.demoShort),
          hasCrisis: run.status === "crisis" || (phq9Item9?.valueNumeric ?? 0) >= 1,
        },
        scores: chips,
        wellbeingIndex: wellbeingIndex(Object.fromEntries(runAnswers.map((a) => [a.itemCode, a.valueNumeric])), run.demoShort),
        hasVoiceInterview: interviews.length > 0,
        voiceInterviewToken: interviews[0]?.inviteUrl?.split("/").pop() ?? "",
      },
      messages: runMessages.map((m) => {
        const a = readingByMessage.get(m.id);
        const item = a ? itemsByCode.get(a.itemCode) : undefined;
        return {
          id: m.id,
          direction: m.direction,
          text: m.text,
          createdAt: m.createdAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
          viaAudio: m.viaAudio,
          reading:
            a && item?.scale && a.valueNumeric !== null && (a.source === "regra" || a.source === "ia" || a.source === "ia_confirmada")
              ? { label: valueLabel(item, a.valueNumeric), how: a.source }
              : undefined,
        };
      }),
      evidence: mappedEvidence,
      summary: validSummary,
      interviews,
      interviewDetail,
    };
  } catch (err) {
    // Sem fallback sintético para caso real: erro de verdade vira página de erro.
    throw err;
  }
}

/** Rastro do agente: eventos do questionário e das entrevistas ligadas a ele. Sem a tabela: vazio. */
async function loadTrail(runId: string, interviewIds: string[]): Promise<TrailItem[]> {
  try {
    const where = interviewIds.length
      ? or(eq(agentEvents.runId, runId), inArray(agentEvents.interviewId, interviewIds))
      : eq(agentEvents.runId, runId);
    const [rows, inbound] = await Promise.all([
      db.select().from(agentEvents).where(where).orderBy(asc(agentEvents.createdAt)).limit(400),
      db.select({ waMessageId: messages.waMessageId, text: messages.text, viaAudio: messages.viaAudio, createdAt: messages.createdAt })
        .from(messages)
        .where(and(eq(messages.runId, runId), eq(messages.direction, "in"))),
    ]);
    // texto da mensagem que disparou cada passo, para o rastro agrupar por mensagem
    const msgByWa = new Map(
      inbound
        .filter((m) => m.waMessageId)
        .map((m) => [m.waMessageId!, { text: m.text, viaAudio: m.viaAudio, at: m.createdAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Recife" }) }]),
    );
    return rows.map((e) => ({
      id: e.id,
      at: e.createdAt.toISOString(),
      kind: e.kind,
      outcome: e.outcome,
      model: e.model,
      latencyMs: e.latencyMs,
      costUsd: e.costUsd,
      tokensIn: e.tokensIn,
      tokensOut: e.tokensOut,
      detail: e.detail,
      inInterview: !!e.interviewId,
      waMessageId: e.waMessageId,
      message: e.waMessageId ? (msgByWa.get(e.waMessageId) ?? null) : null,
    }));
  } catch (err) {
    console.warn("[caso] rastro indisponível", err instanceof Error ? err.message : err);
    return [];
  }
}

/** Entrevistas reais do caso (serviço da entrevista). Sem tabelas ou sem entrevista: lista vazia. */
async function loadInterviews(runId: string): Promise<{ interviews: InterviewListItem[]; interviewDetail: InterviewDetail | null }> {
  try {
    const { getInterviewService } = await import("@/lib/interview/service");
    const service = getInterviewService();
    const interviews = await service.listForRun(runId);
    const withSummary = interviews.find((i) => i.hasSummary) ?? interviews[0];
    const interviewDetail = withSummary ? await service.detail(withSummary.id) : null;
    return { interviews, interviewDetail };
  } catch (err) {
    console.error("[caso] não consegui carregar entrevistas", err);
    return { interviews: [], interviewDetail: null };
  }
}

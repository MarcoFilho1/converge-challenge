import { asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db/client";
import {
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
import { TRUNK_YES } from "@/lib/instruments";
import { clinicalSignal, toScoreChip } from "@/lib/case/score-chips";
import type { InterviewDetail, InterviewListItem } from "@/lib/interview/contract";
import {
  getSyntheticCaseDetail,
  SYNTHETIC_QUEUE_ROWS,
  type CaseDetailData,
  type CaseEvidenceItem,
  type QueueScoreChip,
} from "@/lib/demo/fixtures";

export async function getCase(runId: string): Promise<CaseDetailData> {
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
        hasVoiceInterview: interviews.length > 0,
        voiceInterviewToken: interviews[0]?.inviteUrl?.split("/").pop() ?? "",
      },
      messages: runMessages.map((m) => ({
        id: m.id,
        direction: m.direction,
        text: m.text,
        createdAt: m.createdAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      })),
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

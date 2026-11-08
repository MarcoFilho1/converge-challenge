import { asc, eq } from "drizzle-orm";
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
import {
  getSyntheticCaseDetail,
  SYNTHETIC_INTERVIEW_DETAIL,
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

    if (!runRow) {
      return getSyntheticCaseDetail(runId);
    }

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

    const chips: QueueScoreChip[] = runScores.map((s) => ({
      instrument: s.instrument,
      dimension: s.dimension,
      label:
        s.instrument === "BAT12"
          ? `BAT-12 (${s.dimension})`
          : s.instrument === "PHQ9"
            ? "PHQ-9"
            : s.instrument === "GAD7"
              ? "GAD-7"
              : s.instrument,
      value: Number(s.value.toFixed(s.instrument === "BAT12" ? 2 : 0)),
      maxLabel: s.instrument === "BAT12" ? "/5" : s.instrument === "PHQ9" ? "/27" : s.instrument === "GAD7" ? "/21" : "/10",
      cutoff: s.cutoff,
      flagged: s.flagged,
      complete: s.complete,
    }));

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

    // Se o banco ainda não tem evidências/resumo (M4 RAG ainda não rodou), mostra um fallback explicativo
    const fallbackDetail = getSyntheticCaseDetail("11111111-1111-4111-8111-111111111102");

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
          hasClinicalSignal: runScores.some(
            (s) => (s.instrument === "BAT12" || s.instrument === "PHQ9" || s.instrument === "GAD7") && s.flagged,
          ),
          hasCrisis: run.status === "crisis" || (phq9Item9?.valueNumeric ?? 0) >= 1,
        },
        scores: chips.length > 0 ? chips : fallbackDetail.run.scores,
        hasVoiceInterview: true,
        voiceInterviewToken: `entrevista-${run.id.slice(0, 8)}`,
      },
      messages:
        runMessages.length > 0
          ? runMessages.map((m) => ({
              id: m.id,
              direction: m.direction,
              text: m.text,
              createdAt: m.createdAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
            }))
          : fallbackDetail.messages,
      evidence: mappedEvidence.length > 0 ? mappedEvidence : fallbackDetail.evidence,
      summary: validSummary ?? fallbackDetail.summary,
      interviews: [
        {
          id: SYNTHETIC_INTERVIEW_DETAIL.id,
          status: "done",
          startedAt: SYNTHETIC_INTERVIEW_DETAIL.startedAt,
          durationMs: SYNTHETIC_INTERVIEW_DETAIL.durationMs,
          hasSummary: true,
          inviteUrl: `/entrevista/entrevista-${run.id.slice(0, 8)}`,
        },
      ],
      interviewDetail: {
        ...SYNTHETIC_INTERVIEW_DETAIL,
        runId: run.id,
        contact: { name: contact.name, sector: contact.sector ?? "Geral" },
        severity: run.severity,
      },
    };
  } catch {
    return getSyntheticCaseDetail(runId);
  }
}

import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { listContactSeverities } from "@/lib/severity/contact";
import { answers, contacts, questionnaireRuns, scores, type Severity } from "@/db/schema";
import { SYNTHETIC_QUEUE_ROWS, type QueueRow, type QueueScoreChip } from "@/lib/demo/fixtures";
import { TRUNK_YES } from "@/lib/instruments";

const SEVERITY_RANK: Record<Severity, number> = {
  urgency: 0,
  priority: 1,
  attention: 2,
  none: 3,
};

function formatScoreChip(s: {
  instrument: string;
  dimension: string;
  value: number;
  cutoff: number;
  flagged: boolean;
  complete: boolean;
}): QueueScoreChip | null {
  if (s.instrument === "WPAI" && s.dimension === "work_impairment") {
    return {
      instrument: s.instrument,
      dimension: s.dimension,
      label: "WPAI",
      value: Number(s.value.toFixed(0)),
      maxLabel: "/10",
      cutoff: s.cutoff,
      flagged: s.flagged,
      complete: s.complete,
    };
  }
  if (s.instrument === "BAT12" && s.dimension === "total") {
    return {
      instrument: s.instrument,
      dimension: s.dimension,
      label: "BAT-12",
      value: Number(s.value.toFixed(2)),
      maxLabel: "/5",
      cutoff: s.cutoff,
      flagged: s.flagged,
      complete: s.complete,
    };
  }
  if (s.instrument === "PHQ9" && s.dimension === "total") {
    return {
      instrument: s.instrument,
      dimension: s.dimension,
      label: "PHQ-9",
      value: Number(s.value.toFixed(0)),
      maxLabel: "/27",
      cutoff: s.cutoff,
      flagged: s.flagged,
      complete: s.complete,
    };
  }
  if (s.instrument === "GAD7" && s.dimension === "total") {
    return {
      instrument: s.instrument,
      dimension: s.dimension,
      label: "GAD-7",
      value: Number(s.value.toFixed(0)),
      maxLabel: "/21",
      cutoff: s.cutoff,
      flagged: s.flagged,
      complete: s.complete,
    };
  }
  return null;
}

export async function listQueue(): Promise<{ rows: QueueRow[]; isSyntheticFallback: boolean }> {
  try {
    const dbRuns = await db
      .select({
        run: questionnaireRuns,
        contact: contacts,
      })
      .from(questionnaireRuns)
      .innerJoin(contacts, eq(questionnaireRuns.contactId, contacts.id))
      .where(inArray(questionnaireRuns.status, ["done", "crisis", "stopped"]))
      .orderBy(desc(questionnaireRuns.finishedAt), desc(questionnaireRuns.createdAt));

    if (dbRuns.length === 0) {
      const completedSynthetic = SYNTHETIC_QUEUE_ROWS.filter(
        (r) => r.status === "done" || r.status === "crisis" || r.status === "stopped",
      );
      return { rows: completedSynthetic, isSyntheticFallback: true };
    }

    const runIds = dbRuns.map((r) => r.run.id);
    const allScores = await db.select().from(scores).where(inArray(scores.runId, runIds));
    const allAnswers = await db.select().from(answers).where(inArray(answers.runId, runIds));

    const rows: QueueRow[] = dbRuns.map(({ run, contact }) => {
      const runScores = allScores.filter((s) => s.runId === run.id);
      const runAnswers = allAnswers.filter((a) => a.runId === run.id);
      const chips = runScores.map(formatScoreChip).filter((c): c is QueueScoreChip => c !== null);

      const trunkAns = runAnswers.find((a) => a.itemCode === "TRUNK" || a.itemCode === "SPS6_TRUNK");
      const phq9Item9 = runAnswers.find((a) => a.itemCode === "PHQ9_9");

      const hasPresenteeismTrunk = trunkAns?.valueNumeric === TRUNK_YES;
      const hasWorkImpairment = runScores.some(
        (s) => (s.instrument === "WPAI" || s.instrument === "SPS6") && s.flagged,
      );
      const hasClinicalSignal = runScores.some(
        (s) => (s.instrument === "BAT12" || s.instrument === "PHQ9" || s.instrument === "GAD7") && s.flagged,
      );
      const hasCrisis = run.status === "crisis" || (phq9Item9?.valueNumeric ?? 0) >= 1;

      return {
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
          hasPresenteeismTrunk,
          hasWorkImpairment,
          hasClinicalSignal,
          hasCrisis,
        },
        scores: chips,
        hasVoiceInterview: run.severity === "priority" || run.severity === "attention",
        voiceInterviewToken: `entrevista-${run.id.slice(0, 8)}`,
      };
    });

    // Uma linha por pessoa: o caso que define a gravidade dela (maior entre os não encerrados).
    // Assim uma urgência por crise não some quando a pessoa escreve CONTINUAR e abre outro questionário.
    const keep = new Set((await listContactSeverities()).map((c) => c.runId));
    const perPerson = rows.filter((r) => keep.has(r.runId));
    rows.length = 0;
    rows.push(...perPerson);

    rows.sort((a, b) => {
      const sevDiff = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
      if (sevDiff !== 0) return sevDiff;
      const tA = a.finishedAt ? new Date(a.finishedAt).getTime() : 0;
      const tB = b.finishedAt ? new Date(b.finishedAt).getTime() : 0;
      return tB - tA;
    });

    return { rows, isSyntheticFallback: false };
  } catch {
    const completedSynthetic = SYNTHETIC_QUEUE_ROWS.filter(
      (r) => r.status === "done" || r.status === "crisis" || r.status === "stopped",
    );
    return { rows: completedSynthetic, isSyntheticFallback: true };
  }
}

import { desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { listContactSeverities } from "@/lib/severity/contact";
import { clinicalSignal, toScoreChip } from "@/lib/case/score-chips";
import { answers, contacts, questionnaireRuns, scores, type Severity } from "@/db/schema";
import { SYNTHETIC_QUEUE_ROWS, type QueueRow, type QueueScoreChip } from "@/lib/demo/fixtures";
import { TRUNK_YES } from "@/lib/instruments";

const SEVERITY_RANK: Record<Severity, number> = {
  urgency: 0,
  priority: 1,
  attention: 2,
  none: 3,
};

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
    // Etiqueta "entrevista Helena" só quando existe entrevista de verdade para o caso.
    const interviewRuns = new Set<string>();
    try {
      const rowsI = await db.execute<{ run_id: string }>(sql`select distinct run_id from interviews where run_id is not null`);
      for (const r of rowsI) interviewRuns.add(String(r.run_id));
    } catch {
      // Sem a tabela de entrevistas (frente ainda não integrada): nenhuma etiqueta.
    }
    const allScores = await db.select().from(scores).where(inArray(scores.runId, runIds));
    const allAnswers = await db.select().from(answers).where(inArray(answers.runId, runIds));

    const rows: QueueRow[] = dbRuns.map(({ run, contact }) => {
      const runScores = allScores.filter((s) => s.runId === run.id);
      const runAnswers = allAnswers.filter((a) => a.runId === run.id);
      const chips = runScores
        .map(toScoreChip)
        .filter((c): c is QueueScoreChip => c !== null);

      const trunkAns = runAnswers.find((a) => a.itemCode === "TRUNK" || a.itemCode === "SPS6_TRUNK");
      const phq9Item9 = runAnswers.find((a) => a.itemCode === "PHQ9_9");

      const hasPresenteeismTrunk = trunkAns?.valueNumeric === TRUNK_YES;
      const hasWorkImpairment = runScores.some(
        (s) => (s.instrument === "WPAI" || s.instrument === "SPS6") && s.flagged,
      );
      const hasClinicalSignal = clinicalSignal(runScores, run.demoShort);
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
        hasVoiceInterview: interviewRuns.has(run.id),
        voiceInterviewToken: "",
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

import { and, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/db/client";
import { contacts, questionnaireRuns, type Severity } from "@/db/schema";

export const SEVERITY_RANK: Record<Severity, number> = { urgency: 0, priority: 1, attention: 2, none: 3 };

export type ContactSeverity = {
  contactId: string;
  contactName: string;
  sector: string | null;
  phoneE164: string;
  /** Maior gravidade entre os questionários encerrados que o médico ainda não fechou. */
  severity: Severity;
  /** O questionário que define essa gravidade (abrir este no Caso). */
  runId: string;
  /** Quantos questionários encerrados e não fechados a pessoa tem. */
  openRuns: number;
  lastFinishedAt: Date | null;
};

/**
 * Gravidade por pessoa, para a Fila: o máximo entre os runs encerrados (done, crisis, stopped)
 * cujo caso não foi marcado "encerrado" pelo médico. Assim uma urgência por crise não some
 * quando a pessoa escreve CONTINUAR e abre um questionário novo.
 */
export async function listContactSeverities(): Promise<ContactSeverity[]> {
  const rows = await db
    .select({ run: questionnaireRuns, contact: contacts })
    .from(questionnaireRuns)
    .innerJoin(contacts, eq(questionnaireRuns.contactId, contacts.id))
    .where(
      and(
        inArray(questionnaireRuns.status, ["done", "crisis", "stopped"]),
        ne(questionnaireRuns.caseState, "encerrado"),
      ),
    );

  const byContact = new Map<string, ContactSeverity>();
  for (const { run, contact } of rows) {
    const current = byContact.get(contact.id);
    const finished = run.finishedAt ?? run.createdAt;
    if (!current) {
      byContact.set(contact.id, {
        contactId: contact.id,
        contactName: contact.name,
        sector: contact.sector,
        phoneE164: contact.phoneE164,
        severity: run.severity,
        runId: run.id,
        openRuns: 1,
        lastFinishedAt: finished,
      });
      continue;
    }
    current.openRuns += 1;
    const worse = SEVERITY_RANK[run.severity] < SEVERITY_RANK[current.severity];
    const sameButNewer =
      SEVERITY_RANK[run.severity] === SEVERITY_RANK[current.severity] &&
      finished.getTime() > (current.lastFinishedAt?.getTime() ?? 0);
    if (worse || sameButNewer) {
      current.severity = run.severity;
      current.runId = run.id;
    }
    if (!current.lastFinishedAt || finished > current.lastFinishedAt) current.lastFinishedAt = finished;
  }

  return [...byContact.values()].sort(
    (a, b) =>
      SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
      (b.lastFinishedAt?.getTime() ?? 0) - (a.lastFinishedAt?.getTime() ?? 0),
  );
}

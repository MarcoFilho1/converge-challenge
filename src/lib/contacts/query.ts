import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { contacts, questionnaireRuns, type RunStatus, type Severity } from "@/db/schema";
import { SYNTHETIC_QUEUE_ROWS } from "@/lib/demo/fixtures";

export interface ContactListRow {
  id: string;
  name: string;
  phoneE164: string;
  sector: string;
  role: string;
  latestRunId: string | null;
  status: RunStatus;
  severity: Severity;
  updatedAt: string;
}

export async function listContactsWithRuns(): Promise<{
  rows: ContactListRow[];
  isSyntheticFallback: boolean;
}> {
  try {
    const dbContacts = await db.select().from(contacts).orderBy(desc(contacts.createdAt));
    if (dbContacts.length === 0) {
      return {
        rows: SYNTHETIC_QUEUE_ROWS.map((r) => ({
          id: r.contactId,
          name: r.contactName,
          phoneE164: r.phoneE164,
          sector: r.sector,
          role: r.role,
          latestRunId: r.runId,
          status: r.status,
          severity: r.severity,
          updatedAt: r.finishedAt ?? r.startedAt,
        })),
        isSyntheticFallback: true,
      };
    }

    const allRuns = await db
      .select()
      .from(questionnaireRuns)
      .orderBy(desc(questionnaireRuns.createdAt));

    const rows: ContactListRow[] = dbContacts.map((c) => {
      const latest = allRuns.find((r) => r.contactId === c.id);
      return {
        id: c.id,
        name: c.name,
        phoneE164: c.phoneE164,
        sector: c.sector ?? "Geral",
        role: c.role ?? "Colaborador",
        latestRunId: latest?.id ?? null,
        status: latest?.status ?? "pending",
        severity: latest?.severity ?? "none",
        updatedAt: (latest?.finishedAt ?? latest?.startedAt ?? c.createdAt).toISOString(),
      };
    });

    return { rows, isSyntheticFallback: false };
  } catch {
    return {
      rows: SYNTHETIC_QUEUE_ROWS.map((r) => ({
        id: r.contactId,
        name: r.contactName,
        phoneE164: r.phoneE164,
        sector: r.sector,
        role: r.role,
        latestRunId: r.runId,
        status: r.status,
        severity: r.severity,
        updatedAt: r.finishedAt ?? r.startedAt,
      })),
      isSyntheticFallback: true,
    };
  }
}

export async function seedDemoDatabaseIfEmpty(): Promise<{ seeded: number }> {
  let count = 0;
  for (const row of SYNTHETIC_QUEUE_ROWS) {
    const [existing] = await db
      .select()
      .from(contacts)
      .where(eq(contacts.phoneE164, row.phoneE164));

    let contactId = existing?.id;
    if (!contactId) {
      const [inserted] = await db
        .insert(contacts)
        .values({
          name: row.contactName,
          phoneE164: row.phoneE164,
          sector: row.sector,
          role: row.role,
        })
        .returning();
      contactId = inserted!.id;
    }

    const existingRuns = await db
      .select()
      .from(questionnaireRuns)
      .where(eq(questionnaireRuns.contactId, contactId));

    if (existingRuns.length === 0) {
      await db.insert(questionnaireRuns).values({
        contactId,
        status: row.status,
        severity: row.severity,
        clinicalOnly: row.clinicalOnly,
        partial: row.partial,
        caseState: row.caseState,
        startedAt: new Date(row.startedAt),
        finishedAt: row.finishedAt ? new Date(row.finishedAt) : null,
      });
      count++;
    }
  }
  return { seeded: count };
}

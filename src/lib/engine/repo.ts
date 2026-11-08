import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { answers, contacts, messages, questionnaireRuns, scores, type QuestionnaireRun } from "@/db/schema";
import type { Answers, Item, Score } from "@/lib/instruments/types";

export async function findContactByPhone(phone: string) {
  const [c] = await db.select().from(contacts).where(eq(contacts.phoneE164, phone));
  return c ?? null;
}

/** Cadastro na hora (entrada aberta): se dois pedidos chegarem juntos, devolve o que já existe. */
export async function createContact(input: { name: string; phoneE164: string; sector?: string }) {
  const [c] = await db.insert(contacts).values(input).onConflictDoNothing().returning();
  return c ?? (await findContactByPhone(input.phoneE164));
}

export async function getContact(id: string) {
  const [c] = await db.select().from(contacts).where(eq(contacts.id, id));
  return c ?? null;
}

export async function getActiveRun(contactId: string) {
  const [r] = await db
    .select()
    .from(questionnaireRuns)
    .where(and(eq(questionnaireRuns.contactId, contactId), inArray(questionnaireRuns.status, ["consent", "in_progress"])))
    .orderBy(desc(questionnaireRuns.createdAt))
    .limit(1);
  return r ?? null;
}

export async function getLatestRun(contactId: string) {
  const [r] = await db
    .select()
    .from(questionnaireRuns)
    .where(eq(questionnaireRuns.contactId, contactId))
    .orderBy(desc(questionnaireRuns.createdAt))
    .limit(1);
  return r ?? null;
}

export async function getRun(id: string) {
  const [r] = await db.select().from(questionnaireRuns).where(eq(questionnaireRuns.id, id));
  return r ?? null;
}

export async function createRun(values: typeof questionnaireRuns.$inferInsert) {
  const [r] = await db.insert(questionnaireRuns).values(values).returning();
  return r;
}

export async function updateRun(id: string, patch: Partial<QuestionnaireRun>) {
  await db.update(questionnaireRuns).set(patch).where(eq(questionnaireRuns.id, id));
}

/** Grava a mensagem e devolve o id, ou null se o waMessageId já existia (duplicata). */
export async function insertMessage(values: typeof messages.$inferInsert): Promise<string | null> {
  const rows = await db.insert(messages).values(values).onConflictDoNothing().returning({ id: messages.id });
  return rows[0]?.id ?? null;
}

export async function setMessageRun(messageId: string, runId: string) {
  await db.update(messages).set({ runId }).where(eq(messages.id, messageId));
}

/** Depois do envio: guarda o id do WhatsApp ou marca que não foi entregue. */
/** Texto da última mensagem que o bot mandou para a pessoa (para saber se esperava uma confirmação). */
export async function lastOutboundText(contactId: string): Promise<string | null> {
  const [row] = await db
    .select({ text: messages.text })
    .from(messages)
    .where(and(eq(messages.contactId, contactId), eq(messages.direction, "out")))
    .orderBy(desc(messages.createdAt))
    .limit(1);
  return row?.text ?? null;
}

export async function markDelivery(messageId: string, waMessageId: string | null) {
  await db
    .update(messages)
    .set(waMessageId ? { waMessageId, deliveryFailed: false } : { deliveryFailed: true })
    .where(eq(messages.id, messageId));
}

export async function getAnswers(runId: string): Promise<Answers> {
  const rows = await db.select().from(answers).where(eq(answers.runId, runId));
  return Object.fromEntries(rows.map((r) => [r.itemCode, r.valueNumeric]));
}

export async function getAnswerRows(runId: string) {
  return db.select().from(answers).where(eq(answers.runId, runId));
}

export async function upsertAnswer(runId: string, item: Item, rawText: string, value: number | null) {
  const [row] = await db
    .insert(answers)
    .values({ runId, instrument: item.instrument, itemCode: item.code, rawText, valueNumeric: value })
    .onConflictDoUpdate({ target: [answers.runId, answers.itemCode], set: { rawText, valueNumeric: value } })
    .returning();
  return row;
}

export async function copyAnswers(fromRunId: string, toRunId: string) {
  const rows = await getAnswerRows(fromRunId);
  if (rows.length === 0) return;
  await db.insert(answers).values(
    rows.map((r) => ({ runId: toRunId, instrument: r.instrument, itemCode: r.itemCode, rawText: r.rawText, valueNumeric: r.valueNumeric })),
  );
}

export async function replaceScores(runId: string, list: Score[]) {
  await db.delete(scores).where(eq(scores.runId, runId));
  if (list.length) await db.insert(scores).values(list.map((s) => ({ runId, ...s })));
}

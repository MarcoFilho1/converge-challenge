/** Avisos da médica no painel: gravar, listar, contar não lidos e marcar como lidos. */
import { count, desc, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { doctorNotices, type DoctorNotice } from "@/db/schema";

export type NoticeInput = { kind: string; contactName: string; runId: string | null; interviewId: string | null; text: string };

export async function saveNotice(n: NoticeInput): Promise<void> {
  await db.insert(doctorNotices).values(n);
}

export async function listNotices(limit = 100): Promise<DoctorNotice[]> {
  return db.select().from(doctorNotices).orderBy(desc(doctorNotices.createdAt)).limit(limit);
}

/** Sem a tabela ainda (banco antigo): zero, sem derrubar o painel. */
export async function countUnread(): Promise<number> {
  try {
    const [r] = await db.select({ n: count() }).from(doctorNotices).where(isNull(doctorNotices.readAt));
    return Number(r?.n ?? 0);
  } catch {
    return 0;
  }
}

export async function markAllRead(): Promise<void> {
  await db.update(doctorNotices).set({ readAt: new Date() }).where(isNull(doctorNotices.readAt));
}

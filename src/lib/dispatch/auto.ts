/**
 * Disparo automático do questionário: reenvia para os colaboradores cadastrados de N em N dias.
 * Só roda ligado nas configurações, em dia útil das 9h às 18h (Recife), com limite por rodada
 * para o número do bot não ser bloqueado pelo WhatsApp.
 */
import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { contacts, questionnaireRuns } from "@/db/schema";
import { recordEvent } from "@/lib/obs/events";
import { getSettings } from "@/lib/settings";

export function withinBusinessHours(now: Date): boolean {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Recife", weekday: "short", hour: "numeric", hour12: false }).formatToParts(now);
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0) % 24;
  return !["Sat", "Sun"].includes(weekday) && hour >= 9 && hour < 18;
}

export type DispatchDeps = {
  now?: Date;
  /** Envio de uma mensagem (padrão: WhatsApp pela Evolution). */
  send?: (phoneE164: string, text: string) => Promise<unknown>;
  maxPerRun?: number;
};

/** Devolve quantos questionários foram disparados nesta rodada. */
export async function runAutoDispatch(deps: DispatchDeps = {}): Promise<number> {
  const settings = await getSettings();
  const now = deps.now ?? new Date();
  if (!settings.autoDispatch || !withinBusinessHours(now)) return 0;
  const cutoff = now.getTime() - settings.autoDispatchDays * 86_400_000;
  const max = deps.maxPerRun ?? Number(process.env.AUTO_DISPATCH_MAX_PER_RUN ?? 20);
  const send =
    deps.send ??
    (async (phone: string, text: string) => {
      const { sendText } = await import("@/lib/whatsapp/evolution");
      return sendText(phone, text);
    });
  const { startRun } = await import("@/lib/engine/engine");

  let sent = 0;
  for (const c of await db.select().from(contacts)) {
    if (sent >= max) break;
    const [last] = await db.select().from(questionnaireRuns).where(eq(questionnaireRuns.contactId, c.id)).orderBy(desc(questionnaireRuns.createdAt)).limit(1);
    const lastAt = last ? (last.startedAt ?? last.createdAt).getTime() : null;
    if (lastAt !== null && lastAt > cutoff) continue;
    if (last && (last.status === "consent" || last.status === "in_progress")) continue;
    try {
      const { runId, outbound } = await startRun(c.id);
      for (const text of outbound) await send(c.phoneE164, text);
      recordEvent({ kind: "disparo automático", outcome: "ok", model: "regra em código", runId, detail: `Questionário reenviado (${lastAt ? `último há mais de ${settings.autoDispatchDays} dias` : "nunca respondeu"})` });
      sent++;
    } catch (err) {
      recordEvent({ kind: "disparo automático", outcome: "erro", model: "regra em código", detail: err instanceof Error ? err.message : String(err) });
    }
  }
  return sent;
}

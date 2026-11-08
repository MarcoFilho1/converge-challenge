/**
 * Aviso ao médico pelo WhatsApp do consultório quando uma entrevista termina.
 * Só diz QUEM e ONDE ver (link do Caso); nenhum dado clínico vai na mensagem, nem na crise:
 * o conteúdo fica no Caso, atrás do login do médico.
 */
import { recordEvent } from "@/lib/obs/events";
import { toE164 } from "@/lib/whatsapp/phone";
import type { InterviewState } from "./engine";

export type NoticeKind = "done" | "stopped" | "abandoned" | "declined" | "crisis";

export function noticeKind(state: InterviewState): NoticeKind {
  if (state.status === "crisis") return "crisis";
  if (state.status === "done") return "done";
  if (state.endReason === "abandonada") return "abandoned";
  return state.turns.some((t) => t.speaker === "person") ? "stopped" : "declined";
}

export function doctorNotice(i: { kind: NoticeKind; contactName: string; caseUrl: string }): string {
  const head = "Consultório NR-7 · praevenius";
  const body: Record<NoticeKind, string> = {
    done: `${i.contactName} terminou a entrevista com a Helena. O resumo está pronto no Caso:`,
    stopped: `${i.contactName} encerrou a entrevista antes do fim. O resumo do que foi dito está no Caso:`,
    abandoned: `A entrevista de ${i.contactName} parou sem despedida (página fechada ou conexão perdida). O resumo do que foi dito está no Caso:`,
    declined: `${i.contactName} preferiu não fazer a entrevista. Veja o Caso:`,
    crisis: `A entrevista de ${i.contactName} precisa da sua atenção hoje. Abra o Caso:`,
  };
  return `${head}\n${body[i.kind]} ${i.caseUrl}`;
}

export type NotifyInput = { runId: string | null; interviewId: string; state: InterviewState };
export type NotifyDeps = {
  send?: (phoneE164: string, text: string) => Promise<unknown>;
  /** Aviso no painel da médica (padrão: tabela doctor_notices). Sempre gravado, com ou sem WhatsApp. */
  saveNotice?: (n: { kind: NoticeKind; contactName: string; runId: string | null; interviewId: string | null; text: string }) => Promise<unknown>;
  lookupName?: (runId: string) => Promise<string | null>;
  /** Nome e telefone de quem fez a entrevista (para o aviso ao participante na demo). */
  lookupContact?: (runId: string) => Promise<{ name: string; phone: string } | null>;
  doctorPhone?: string;
  baseUrl?: string;
};
export type NotifyResult = "enviado" | "sem_numero" | "sem_caso" | "erro";

async function defaultLookupContact(runId: string): Promise<{ name: string; phone: string } | null> {
  const { db } = await import("@/db/client");
  const { contacts, questionnaireRuns } = await import("@/db/schema");
  const { eq } = await import("drizzle-orm");
  const [r] = await db
    .select({ name: contacts.name, phone: contacts.phoneE164 })
    .from(questionnaireRuns)
    .innerJoin(contacts, eq(contacts.id, questionnaireRuns.contactId))
    .where(eq(questionnaireRuns.id, runId));
  return r ?? null;
}

async function defaultLookupName(runId: string): Promise<string | null> {
  const { db } = await import("@/db/client");
  const { contacts, questionnaireRuns } = await import("@/db/schema");
  const { eq } = await import("drizzle-orm");
  const [r] = await db
    .select({ name: contacts.name })
    .from(questionnaireRuns)
    .innerJoin(contacts, eq(contacts.id, questionnaireRuns.contactId))
    .where(eq(questionnaireRuns.id, runId));
  return r?.name ?? null;
}

/** WhatsApp do consultório; se ele estiver fora e a médica tiver ligado o Telegram, vai pela reserva. */
async function defaultSend(phoneE164: string, text: string) {
  const { sendToPerson } = await import("@/lib/channels/send");
  return sendToPerson(phoneE164, text);
}

async function defaultSaveNotice(n: Parameters<NonNullable<NotifyDeps["saveNotice"]>>[0]) {
  const { saveNotice } = await import("@/lib/notices/store");
  await saveNotice(n);
}

/** Frase do aviso no painel: a mesma do WhatsApp, sem o cabeçalho e sem o link (o painel já leva ao caso). */
export function panelNotice(kind: NoticeKind, contactName: string): string {
  return doctorNotice({ kind, contactName, caseUrl: "" }).split("\n").slice(1).join(" ").replace(/:\s*$/, ".").trim();
}

/** Nunca lança: o fim da entrevista não pode cair porque o WhatsApp está fora. */
export async function notifyDoctor(n: NotifyInput, deps: NotifyDeps = {}): Promise<NotifyResult> {
  const { getSettings } = await import("@/lib/settings");
  const settings = await getSettings();
  const phone = toE164(deps.doctorPhone ?? settings.doctorWhatsapp ?? "");
  // Demonstração: quem fez a entrevista recebe no próprio WhatsApp o aviso que iria para a médica.
  if (settings.notifyParticipant && n.runId) {
    try {
      const who = await (deps.lookupContact ?? defaultLookupContact)(n.runId);
      if (who?.phone) {
        const base = (deps.baseUrl ?? process.env.INTERVIEW_PUBLIC_URL ?? "http://localhost:3100").replace(/\/$/, "");
        const text = `_Demonstração: este é o aviso que a médica do trabalho receberia no WhatsApp quando uma entrevista termina._\n\n${doctorNotice({ kind: noticeKind(n.state), contactName: who.name, caseUrl: `${base}/caso/${n.runId}` })}`;
        await (deps.send ?? defaultSend)(who.phone, text);
        recordEvent({ kind: "aviso ao participante", outcome: "ok", detail: "aviso da médica enviado a quem fez a entrevista (demo)", interviewId: n.interviewId, runId: n.runId });
      }
    } catch (err) {
      console.warn("[entrevista] aviso ao participante falhou", err instanceof Error ? err.message : err);
    }
  }
  const event = (outcome: "ok" | "descartado" | "erro", detail: string) =>
    recordEvent({ kind: "aviso ao médico", outcome, detail, interviewId: n.interviewId, runId: n.runId });
  // Aviso no painel: sempre, com ou sem o WhatsApp da médica configurado.
  if (n.runId) {
    try {
      const contactName = (deps.lookupContact ? (await deps.lookupContact(n.runId))?.name : await (deps.lookupName ?? defaultLookupName)(n.runId)) ?? "Um colaborador";
      const kind = noticeKind(n.state);
      await (deps.saveNotice ?? defaultSaveNotice)({ kind, contactName, runId: n.runId, interviewId: n.interviewId, text: panelNotice(kind, contactName) });
    } catch (err) {
      console.warn("[entrevista] aviso no painel falhou", err instanceof Error ? err.message : err);
    }
  }
  if (!phone) { event("descartado", "DOCTOR_WHATSAPP vazio"); return "sem_numero"; }
  // entrevista de demonstração (sem questionário ligado) não tem Caso para abrir
  if (!n.runId) { event("descartado", "entrevista sem caso"); return "sem_caso"; }
  try {
    const name = (await (deps.lookupName ?? defaultLookupName)(n.runId)) ?? "Um colaborador";
    const base = (deps.baseUrl ?? process.env.INTERVIEW_PUBLIC_URL ?? "http://localhost:3100").replace(/\/$/, "");
    const kind = noticeKind(n.state);
    await (deps.send ?? defaultSend)(phone, doctorNotice({ kind, contactName: name, caseUrl: `${base}/caso/${n.runId}` }));
    event("ok", kind);
    return "enviado";
  } catch (err) {
    console.warn("[entrevista] aviso ao médico falhou", err instanceof Error ? err.message : err);
    event("erro", err instanceof Error ? err.message : "falha no envio");
    return "erro";
  }
}

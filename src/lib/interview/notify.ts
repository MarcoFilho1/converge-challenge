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
  lookupName?: (runId: string) => Promise<string | null>;
  doctorPhone?: string;
  baseUrl?: string;
};
export type NotifyResult = "enviado" | "sem_numero" | "sem_caso" | "erro";

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

async function defaultSend(phoneE164: string, text: string) {
  const { sendText } = await import("@/lib/whatsapp/evolution");
  return sendText(phoneE164, text);
}

/** Nunca lança: o fim da entrevista não pode cair porque o WhatsApp está fora. */
export async function notifyDoctor(n: NotifyInput, deps: NotifyDeps = {}): Promise<NotifyResult> {
  const phone = toE164(deps.doctorPhone ?? process.env.DOCTOR_WHATSAPP ?? "");
  const event = (outcome: "ok" | "descartado" | "erro", detail: string) =>
    recordEvent({ kind: "aviso ao médico", outcome, detail, interviewId: n.interviewId, runId: n.runId });
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

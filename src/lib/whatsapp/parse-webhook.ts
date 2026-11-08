import { jidToPhone } from "./phone";

export type ParsedWebhook =
  | { kind: "message"; phone: string; text: string; waMessageId: string; fromMe: boolean }
  | { kind: "connection"; state: string }
  | { kind: "ignore" };

type Payload = {
  event?: string;
  data?: {
    state?: string;
    key?: { remoteJid?: string; remoteJidAlt?: string; senderPn?: string; fromMe?: boolean; id?: string };
    message?: { conversation?: string; extendedTextMessage?: { text?: string } } | null;
  };
};

/** Lê o corpo do webhook da Evolution API v2 (eventos messages.upsert e connection.update). */
export function parseWebhook(body: unknown): ParsedWebhook {
  if (!body || typeof body !== "object") return { kind: "ignore" };
  const { event, data } = body as Payload;
  const ev = (event ?? "").toLowerCase().replace(/_/g, ".");

  if (ev === "connection.update" && data?.state) return { kind: "connection", state: data.state };
  if (ev !== "messages.upsert" || !data?.key?.remoteJid || !data.key.id) return { kind: "ignore" };
  // Baileys recente pode entregar contatos como "<id>@lid"; o número real vem em remoteJidAlt ou senderPn.
  const jid = [data.key.remoteJid, data.key.remoteJidAlt, data.key.senderPn].find((j) => j?.endsWith("@s.whatsapp.net"));
  if (!jid) {
    if (!data.key.remoteJid.endsWith("@g.us")) console.warn("[webhook] mensagem ignorada, remoteJid sem número:", data.key.remoteJid);
    return { kind: "ignore" };
  }

  const text = data.message?.conversation ?? data.message?.extendedTextMessage?.text;
  if (!text || !text.trim()) return { kind: "ignore" };

  return {
    kind: "message",
    phone: jidToPhone(jid),
    text: text.trim(),
    waMessageId: data.key.id,
    fromMe: !!data.key.fromMe,
  };
}

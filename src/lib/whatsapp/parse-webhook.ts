import { jidToPhone } from "./phone";

export type MediaKind = "figurinha" | "foto" | "vídeo" | "arquivo";

export type ParsedWebhook =
  | { kind: "message"; phone: string; text: string; waMessageId: string; fromMe: boolean }
  | { kind: "audio"; phone: string; waMessageId: string; fromMe: boolean; base64: string | null; mime: string }
  | { kind: "media"; phone: string; waMessageId: string; fromMe: boolean; media: MediaKind }
  | { kind: "connection"; state: string }
  | { kind: "ignore" };

type Payload = {
  event?: string;
  data?: {
    state?: string;
    key?: { remoteJid?: string; remoteJidAlt?: string; senderPn?: string; fromMe?: boolean; id?: string };
    message?: {
      conversation?: string;
      extendedTextMessage?: { text?: string };
      audioMessage?: { mimetype?: string };
      stickerMessage?: object;
      imageMessage?: object;
      videoMessage?: object;
      documentMessage?: object;
      documentWithCaptionMessage?: object;
      /** Com o webhook em base64, a Evolution manda o arquivo da mídia aqui. */
      base64?: string;
    } | null;
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

  const phone = jidToPhone(jid);
  const fromMe = !!data.key.fromMe;
  const msg = data.message ?? {};
  if (msg.audioMessage) {
    return { kind: "audio", phone, waMessageId: data.key.id, fromMe, base64: msg.base64 ?? null, mime: msg.audioMessage.mimetype ?? "audio/ogg" };
  }
  const media: MediaKind | null = msg.stickerMessage
    ? "figurinha"
    : msg.imageMessage
      ? "foto"
      : msg.videoMessage
        ? "vídeo"
        : msg.documentMessage || msg.documentWithCaptionMessage
          ? "arquivo"
          : null;
  if (media) return { kind: "media", phone, waMessageId: data.key.id, fromMe, media };

  const text = msg.conversation ?? msg.extendedTextMessage?.text;
  if (!text || !text.trim()) return { kind: "ignore" };

  return {
    kind: "message",
    phone: jidToPhone(jid),
    text: text.trim(),
    waMessageId: data.key.id,
    fromMe: !!data.key.fromMe,
  };
}

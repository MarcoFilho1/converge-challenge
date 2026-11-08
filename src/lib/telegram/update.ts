/** Traduz um "update" do Telegram no que o bot precisa saber. Só conversas privadas; grupos são ignorados. */
export type TelegramIncoming =
  | { kind: "start"; chatId: string; messageId: string; name?: string }
  | { kind: "text"; chatId: string; messageId: string; name?: string; text: string }
  | { kind: "voice"; chatId: string; messageId: string; name?: string; fileId: string; mime: string }
  | { kind: "media"; chatId: string; messageId: string; name?: string; media: string }
  | { kind: "contact"; chatId: string; messageId: string; name?: string; phone: string; own: boolean }
  | { kind: "ignored" };

type Msg = {
  message_id?: number;
  chat?: { id?: number | string; type?: string };
  from?: { id?: number | string; first_name?: string; last_name?: string; is_bot?: boolean };
  text?: string;
  voice?: { file_id?: string; mime_type?: string };
  audio?: { file_id?: string; mime_type?: string };
  contact?: { phone_number?: string; user_id?: number | string };
  sticker?: unknown;
  photo?: unknown;
  video?: unknown;
  video_note?: unknown;
  document?: unknown;
  location?: unknown;
};

const MEDIA: [keyof Msg, string][] = [
  ["sticker", "figurinha"],
  ["photo", "foto"],
  ["video", "vídeo"],
  ["video_note", "vídeo"],
  ["document", "arquivo"],
  ["location", "localização"],
];

export function parseUpdate(update: unknown): TelegramIncoming {
  const msg = (update as { message?: Msg } | null)?.message;
  if (!msg?.chat || msg.chat.type !== "private" || msg.from?.is_bot) return { kind: "ignored" };
  const chatId = String(msg.chat.id ?? "");
  if (!chatId || msg.message_id === undefined) return { kind: "ignored" };
  const base = {
    chatId,
    messageId: String(msg.message_id),
    name: [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(" ").trim() || undefined,
  };

  if (msg.contact?.phone_number) {
    const own = msg.contact.user_id !== undefined && String(msg.contact.user_id) === String(msg.from?.id);
    return { kind: "contact", ...base, phone: msg.contact.phone_number, own };
  }
  const voice = msg.voice ?? msg.audio;
  if (voice?.file_id) return { kind: "voice", ...base, fileId: voice.file_id, mime: voice.mime_type ?? "audio/ogg" };
  if (typeof msg.text === "string") {
    const text = msg.text.trim();
    if (/^\/start(\s|$|@)/i.test(text)) return { kind: "start", ...base };
    if (text) return { kind: "text", ...base, text };
    return { kind: "ignored" };
  }
  for (const [key, label] of MEDIA) if (msg[key]) return { kind: "media", ...base, media: label };
  return { kind: "ignored" };
}

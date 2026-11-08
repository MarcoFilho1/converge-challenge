/**
 * Envio para uma pessoa com reserva: WhatsApp é o principal; se ele falhar (ou estiver fora do ar)
 * e a pessoa tiver o Telegram ligado, a mensagem vai pelo Telegram.
 * "Pessoa" é o telefone E.164 ou "tg:<chat>" (quem entrou só pelo Telegram).
 */
import { and, desc, eq } from "drizzle-orm";
import { recordEvent } from "@/lib/obs/events";
import { chatForPerson, isTelegramOnlyKey } from "@/lib/telegram/links";

export type Channel = "whatsapp" | "telegram";
export type SendResult = { channel: Channel; messageId: string };

const ATTEMPTS = 3;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Id gravado em messages.wa_message_id para mensagens enviadas pelo Telegram. */
export const telegramOutId = (chatId: string, messageId: string) => `tg-out:${chatId}:${messageId}`;
/** Id gravado em messages.wa_message_id para mensagens recebidas pelo Telegram. */
export const telegramInId = (chatId: string, messageId: string) => `tg:${chatId}:${messageId}`;

async function viaWhatsapp(phone: string, text: string, attempts: number): Promise<string> {
  const { whatsappSimulatedDown } = await import("./status");
  if (whatsappSimulatedDown()) throw new Error("WhatsApp fora do ar (ensaio de queda ligado na Conexão).");
  const { sendText } = await import("@/lib/whatsapp/evolution");
  const delay = Number(process.env.SEND_RETRY_DELAY_MS ?? 1500);
  let last: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const { waMessageId } = await sendText(phone, text);
      return waMessageId ?? "sem-id";
    } catch (err) {
      last = err;
      console.error(`[envio] WhatsApp falhou (tentativa ${attempt}/${attempts}) para ${phone}`, err);
      if (attempt < attempts) await wait(delay * attempt);
    }
  }
  throw last instanceof Error ? last : new Error("Falha no envio pelo WhatsApp.");
}

async function viaTelegram(chatId: string, text: string): Promise<string> {
  const [{ sendMessage }, { toTelegramHtml, toTelegramPlain }] = await Promise.all([import("@/lib/telegram/api"), import("@/lib/telegram/format")]);
  const { messageId } = await sendMessage(chatId, toTelegramHtml(text), { plain: toTelegramPlain(text) });
  return telegramOutId(chatId, messageId);
}

/** Canal da última mensagem que a pessoa mandou (para lembretes irem aonde ela está conversando). */
export async function lastInboundChannel(personKey: string): Promise<Channel | null> {
  if (isTelegramOnlyKey(personKey)) return "telegram";
  try {
    const { db } = await import("@/db/client");
    const { contacts, messages } = await import("@/db/schema");
    const [row] = await db
      .select({ id: messages.waMessageId })
      .from(messages)
      .innerJoin(contacts, eq(contacts.id, messages.contactId))
      .where(and(eq(contacts.phoneE164, personKey), eq(messages.direction, "in")))
      .orderBy(desc(messages.createdAt))
      .limit(1);
    if (!row) return null;
    return row.id?.startsWith("tg:") ? "telegram" : "whatsapp";
  } catch {
    return null;
  }
}

async function safeChatFor(personKey: string): Promise<string | null> {
  try {
    return await chatForPerson(personKey);
  } catch {
    return null;
  }
}

/**
 * Envia e devolve por onde foi. Lança só se nenhum canal entregou.
 * prefer: "whatsapp" (padrão), "telegram", ou "last" (o canal em que a pessoa escreveu por último).
 */
export async function sendToPerson(
  personKey: string,
  text: string,
  opts: { prefer?: Channel | "last"; runId?: string | null } = {},
): Promise<SendResult> {
  if (isTelegramOnlyKey(personKey)) {
    return { channel: "telegram", messageId: await viaTelegram(personKey.slice(3), text) };
  }
  const chatId = await safeChatFor(personKey);
  if (!chatId) return { channel: "whatsapp", messageId: await viaWhatsapp(personKey, text, ATTEMPTS) };

  const intended: Channel = opts.prefer === "last" ? ((await lastInboundChannel(personKey)) ?? "whatsapp") : (opts.prefer ?? "whatsapp");
  let first = intended;
  let waKnownDown = false;
  if (intended === "whatsapp") {
    const { whatsappStatus } = await import("./status");
    // Já se sabe que o WhatsApp caiu: vai direto pela reserva, sem esperar as tentativas.
    waKnownDown = !(await whatsappStatus()).online;
    if (waKnownDown) first = "telegram";
  }

  const order: Channel[] = first === "telegram" ? ["telegram", "whatsapp"] : ["whatsapp", "telegram"];
  let last: unknown;
  for (const channel of order) {
    try {
      const messageId = channel === "telegram" ? await viaTelegram(chatId, text) : await viaWhatsapp(personKey, text, ATTEMPTS);
      if (channel !== intended) {
        recordEvent({
          kind: "envio",
          outcome: "ok",
          model: `reserva: ${channel === "telegram" ? "Telegram" : "WhatsApp"}`,
          runId: opts.runId ?? null,
          detail: channel === "telegram" ? `WhatsApp ${waKnownDown ? "fora do ar" : "falhou"}; mensagem entregue pelo Telegram` : "Telegram falhou; mensagem entregue pelo WhatsApp",
        });
      }
      return { channel, messageId };
    } catch (err) {
      last = err;
    }
  }
  throw last instanceof Error ? last : new Error("Nenhum canal entregou a mensagem.");
}

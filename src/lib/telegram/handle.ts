/**
 * Conversa pelo Telegram, a reserva do WhatsApp. Usa o mesmo motor do questionário.
 * Primeira mensagem: dois botões. "Já comecei pelo WhatsApp" compartilha o número e continua o mesmo caso;
 * "Começar agora" entra só pelo Telegram (pela entrada aberta da demo).
 */
import type { EngineResult } from "@/lib/engine/engine";
import { recordEvent } from "@/lib/obs/events";
import { toE164 } from "@/lib/whatsapp/phone";
import { telegramInId, telegramOutId } from "@/lib/channels/send";
import type { ReplyMarkup } from "./api";
import { toTelegramHtml, toTelegramPlain } from "./format";
import { telegramOnlyKey } from "./links";
import { parseUpdate } from "./update";

export const BUTTON_CONTINUE = "📱 Já comecei pelo WhatsApp";
export const BUTTON_NEW = "Começar agora";

export const tgCopy = {
  welcome: [
    "Olá! Aqui é o canal reserva da saúde ocupacional (Praevenius).",
    "O canal principal é o WhatsApp. Este Telegram serve para quando o WhatsApp estiver fora do ar.",
    "",
    `• *Já começou pelo WhatsApp?* Toque em “${BUTTON_CONTINUE}”. O Telegram vai pedir para compartilhar seu número, e você continua de onde parou.`,
    `• *Primeira vez?* Toque em “${BUTTON_NEW}”.`,
  ].join("\n"),
  ownNumberOnly: `Para continuar, toque no botão “${BUTTON_CONTINUE}”. Ele compartilha o seu próprio número.`,
  badNumber: `Não consegui ler esse número. Toque em “${BUTTON_NEW}” para começar por aqui.`,
  doctorLinked: "Pronto. Se o WhatsApp do consultório cair, os avisos das entrevistas chegam por aqui.",
};

const KEYBOARD: ReplyMarkup = {
  keyboard: [[{ text: BUTTON_CONTINUE, request_contact: true }], [{ text: BUTTON_NEW }]],
  resize_keyboard: true,
  one_time_keyboard: true,
};
const REMOVE: ReplyMarkup = { remove_keyboard: true };

type Engine = {
  handleIncoming: (i: { phone: string; text: string; waMessageId: string; viaAudio?: boolean; name?: string }) => Promise<EngineResult>;
  handleMedia: (i: { phone: string; waMessageId: string; media: string }) => Promise<EngineResult>;
  greetLinked: (i: { phone: string; name?: string }) => Promise<EngineResult>;
};
export type TelegramDeps = {
  engine: Engine;
  personForChat: (chatId: string) => Promise<string | null>;
  linkChat: (chatId: string, personKey: string) => Promise<void>;
  /** Envia (texto no estilo do WhatsApp) e devolve o id do Telegram. */
  send: (chatId: string, text: string, markup?: ReplyMarkup) => Promise<string>;
  markDelivery: (messageId: string, externalId: string | null) => Promise<void>;
  transcribe: (fileId: string, mime: string) => Promise<string>;
  /** Qual destas formas do número já está cadastrada (para ligar ao mesmo caso), ou null. */
  findContactPhone: (variants: string[]) => Promise<string | null>;
};

async function defaultDeps(): Promise<TelegramDeps> {
  const [engine, links, api, repo] = await Promise.all([
    import("@/lib/engine/engine"),
    import("./links"),
    import("./api"),
    import("@/lib/engine/repo"),
  ]);
  return {
    engine,
    personForChat: links.personForChat,
    linkChat: links.linkChat,
    send: async (chatId, text, markup) => (await api.sendMessage(chatId, toTelegramHtml(text), { replyMarkup: markup, plain: toTelegramPlain(text) })).messageId,
    markDelivery: repo.markDelivery,
    findContactPhone: async (variants) => {
      const { db } = await import("@/db/client");
      const { contacts } = await import("@/db/schema");
      const { inArray } = await import("drizzle-orm");
      const [row] = await db.select({ phone: contacts.phoneE164 }).from(contacts).where(inArray(contacts.phoneE164, variants)).limit(1);
      return row?.phone ?? null;
    },
    transcribe: async (fileId, mime) => {
      const { transcribeAudio } = await import("@/lib/voice/transcribe-message");
      return (await transcribeAudio(await api.downloadFile(fileId), mime)).text;
    },
  };
}

const doctorKey = () => toE164(process.env.DOCTOR_WHATSAPP ?? "");

/** Número compartilhado no Telegram (sempre com o código do país) → só os dígitos. */
export function phoneKey(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 8 ? digits : null;
}

/**
 * Celular brasileiro com e sem o 9 da frente: o WhatsApp de contas antigas guarda sem o 9,
 * o Telegram manda com o 9. As duas formas são a mesma pessoa.
 */
export function brPhoneVariants(key: string): string[] {
  if (!key.startsWith("55")) return [key];
  if (key.length === 13 && key[4] === "9") return [key, key.slice(0, 4) + key.slice(5)];
  if (key.length === 12 && /[6-9]/.test(key[4])) return [key, `${key.slice(0, 4)}9${key.slice(4)}`];
  return [key];
}

export async function handleTelegramUpdate(update: unknown, injected?: TelegramDeps): Promise<void> {
  const msg = parseUpdate(update);
  if (msg.kind === "ignored") return;
  const deps = injected ?? (await defaultDeps());
  const { chatId } = msg;

  const deliver = async (result: EngineResult, firstMarkup?: ReplyMarkup) => {
    for (let i = 0; i < result.outbound.length; i++) {
      let externalId: string | null = null;
      try {
        externalId = telegramOutId(chatId, await deps.send(chatId, result.outbound[i], i === 0 ? firstMarkup : undefined));
      } catch (err) {
        console.error(`[telegram] envio falhou para ${chatId}`, err);
        recordEvent({ kind: "envio", outcome: "erro", runId: result.runId, detail: `Mensagem ${i + 1} não entregue no Telegram` });
      }
      const rowId = result.outboundIds?.[i];
      if (rowId) await deps.markDelivery(rowId, externalId).catch((e) => console.error("[telegram] não consegui registrar a entrega", e));
    }
  };
  const say = (text: string, markup?: ReplyMarkup) => deps.send(chatId, text, markup).catch((err) => console.error(`[telegram] envio falhou para ${chatId}`, err));

  // Número compartilhado: liga esta conversa à pessoa e continua o mesmo caso.
  if (msg.kind === "contact") {
    if (!msg.own) return void (await say(tgCopy.ownNumberOnly, KEYBOARD));
    const shared = phoneKey(msg.phone);
    if (!shared) return void (await say(tgCopy.badNumber, KEYBOARD));
    const variants = brPhoneVariants(shared);
    const doctor = doctorKey();
    if (doctor && variants.includes(doctor)) {
      await deps.linkChat(chatId, doctor);
      return void (await say(tgCopy.doctorLinked, REMOVE));
    }
    const key = (await deps.findContactPhone(variants)) ?? shared;
    await deps.linkChat(chatId, key);
    recordEvent({ kind: "entrada", outcome: "ok", model: "Telegram", detail: "Pessoa ligou o Telegram compartilhando o número; o mesmo caso continua" });
    return deliver(await deps.engine.greetLinked({ phone: key, name: msg.name }), REMOVE);
  }

  const person = await deps.personForChat(chatId);

  if (!person) {
    if (msg.kind === "text" && msg.text === BUTTON_NEW) {
      const key = telegramOnlyKey(chatId);
      await deps.linkChat(chatId, key);
      return deliver(await deps.engine.greetLinked({ phone: key, name: msg.name }), REMOVE);
    }
    return void (await say(tgCopy.welcome, KEYBOARD));
  }

  // A médica ligou o Telegram só para receber avisos: não vira colaboradora.
  if (person === doctorKey()) return void (await say(tgCopy.doctorLinked, REMOVE));

  const waMessageId = telegramInId(chatId, msg.messageId);
  if (msg.kind === "start") return deliver(await deps.engine.greetLinked({ phone: person, name: msg.name }));
  if (msg.kind === "text") return deliver(await deps.engine.handleIncoming({ phone: person, text: msg.text, waMessageId, name: msg.name }));
  if (msg.kind === "media") return deliver(await deps.engine.handleMedia({ phone: person, waMessageId, media: msg.media }));

  // Áudio de voz: mesmo Whisper do WhatsApp.
  const started = Date.now();
  let heard: string | null = null;
  try {
    heard = await deps.transcribe(msg.fileId, msg.mime);
  } catch (err) {
    console.error("[telegram] não consegui transcrever o áudio", err);
  }
  if (!heard) return deliver(await deps.engine.handleMedia({ phone: person, waMessageId, media: "áudio sem transcrição" }));
  const result = await deps.engine.handleIncoming({ phone: person, text: heard, waMessageId, viaAudio: true, name: msg.name });
  if (result.event !== "duplicate" && result.event !== "ignored_unknown") {
    recordEvent({ kind: "transcrição do áudio", outcome: "ok", model: "Whisper (Voicebox)", runId: result.runId, latencyMs: Date.now() - started, detail: `“${heard.slice(0, 160)}” (Telegram)` });
  }
  return deliver(result);
}

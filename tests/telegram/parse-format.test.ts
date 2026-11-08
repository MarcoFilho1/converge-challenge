import { describe, expect, it } from "vitest";
import { toTelegramHtml, toTelegramPlain } from "@/lib/telegram/format";
import { parseUpdate } from "@/lib/telegram/update";
import { primaryChannel, type PublicChannels } from "@/lib/channels/public";

const msg = (extra: Record<string, unknown>, chatType = "private") => ({
  update_id: 1,
  message: { message_id: 7, chat: { id: 42, type: chatType }, from: { id: 42, first_name: "Paula", last_name: "Lima" }, ...extra },
});

describe("formatação para o Telegram", () => {
  it("negrito e itálico do WhatsApp viram HTML, e o texto é escapado", () => {
    expect(toTelegramHtml("*Quem vê:* só a médica")).toBe("<b>Quem vê:</b> só a médica");
    expect(toTelegramHtml("_Demonstração: aqui_ todos")).toBe("<i>Demonstração: aqui</i> todos");
    expect(toTelegramHtml("1 < 2 & 3 > 2")).toBe("1 &lt; 2 &amp; 3 &gt; 2");
  });

  it("não quebra link com sublinhado no meio", () => {
    const url = "https://x.dev/entrevista/abc_def_ghi";
    expect(toTelegramHtml(`abra este link: ${url}`)).toBe(`abra este link: ${url}`);
  });

  it("frase que cita 'Este WhatsApp' fica neutra; versão sem marcação existe para reserva", () => {
    expect(toTelegramPlain("• Este WhatsApp não é atendido o tempo todo. *Oi*")).toBe("• Este canal não é atendido o tempo todo. Oi");
  });
});

describe("leitura do update do Telegram", () => {
  it("texto, /start (com ou sem parâmetro) e nome do perfil", () => {
    expect(parseUpdate(msg({ text: "1" }))).toEqual({ kind: "text", chatId: "42", messageId: "7", name: "Paula Lima", text: "1" });
    expect(parseUpdate(msg({ text: "/start entrar" })).kind).toBe("start");
    expect(parseUpdate(msg({ text: "/start" })).kind).toBe("start");
  });

  it("número compartilhado: marca se é o da própria pessoa", () => {
    expect(parseUpdate(msg({ contact: { phone_number: "+5581999990001", user_id: 42 } }))).toMatchObject({ kind: "contact", phone: "+5581999990001", own: true });
    expect(parseUpdate(msg({ contact: { phone_number: "+5581999990002", user_id: 99 } }))).toMatchObject({ kind: "contact", own: false });
  });

  it("voz vira áudio; figurinha e foto viram mídia; grupo é ignorado", () => {
    expect(parseUpdate(msg({ voice: { file_id: "F1", mime_type: "audio/ogg" } }))).toMatchObject({ kind: "voice", fileId: "F1", mime: "audio/ogg" });
    expect(parseUpdate(msg({ sticker: {} }))).toMatchObject({ kind: "media", media: "figurinha" });
    expect(parseUpdate(msg({ photo: [{}] }))).toMatchObject({ kind: "media", media: "foto" });
    expect(parseUpdate(msg({ text: "oi" }, "group")).kind).toBe("ignored");
    expect(parseUpdate({ update_id: 2, edited_message: {} }).kind).toBe("ignored");
  });
});

describe("canal principal da página de entrada", () => {
  const base: PublicChannels = {
    whatsapp: { online: true, link: "https://wa.me/55", simulatedDown: false },
    telegram: { online: true, link: "https://t.me/PraeveniusBot?start=entrar", username: "PraeveniusBot" },
    checkedAt: "",
  };
  it("WhatsApp no ar é o principal; caído, o Telegram assume; os dois fora, nenhum", () => {
    expect(primaryChannel(base)).toBe("whatsapp");
    expect(primaryChannel({ ...base, whatsapp: { ...base.whatsapp, online: false } })).toBe("telegram");
    expect(primaryChannel({ ...base, whatsapp: { ...base.whatsapp, online: false }, telegram: { ...base.telegram, online: false } })).toBe("none");
  });
});

import { describe, expect, it } from "vitest";
import { parseWebhook } from "@/lib/whatsapp/parse-webhook";

const upsert = (data: Record<string, unknown>) => ({ event: "messages.upsert", instance: "consultorio", data });

describe("parseWebhook", () => {
  it("lê mensagem simples (conversation)", () => {
    const out = parseWebhook(
      upsert({ key: { remoteJid: "5581999990001@s.whatsapp.net", fromMe: false, id: "ABC" }, message: { conversation: "sim" } }),
    );
    expect(out).toEqual({ kind: "message", phone: "5581999990001", text: "sim", waMessageId: "ABC", fromMe: false });
  });

  it("lê texto estendido (resposta citando outra mensagem)", () => {
    const out = parseWebhook(
      upsert({
        key: { remoteJid: "5581999990001@s.whatsapp.net", fromMe: false, id: "DEF" },
        message: { extendedTextMessage: { text: "2" } },
      }),
    );
    expect(out).toMatchObject({ kind: "message", text: "2" });
  });

  it("marca mensagens enviadas pelo próprio celular", () => {
    const out = parseWebhook(
      upsert({ key: { remoteJid: "5581999990001@s.whatsapp.net", fromMe: true, id: "G" }, message: { conversation: "oi" } }),
    );
    expect(out).toMatchObject({ kind: "message", fromMe: true });
  });

  it("ignora grupos", () => {
    const out = parseWebhook(
      upsert({ key: { remoteJid: "123-456@g.us", fromMe: false, id: "H" }, message: { conversation: "oi" } }),
    );
    expect(out).toEqual({ kind: "ignore" });
  });

  it("ignora mensagem sem texto (áudio, imagem)", () => {
    const out = parseWebhook(
      upsert({ key: { remoteJid: "5581999990001@s.whatsapp.net", fromMe: false, id: "I" }, message: { audioMessage: {} } }),
    );
    expect(out).toEqual({ kind: "ignore" });
  });

  it("lê atualização de conexão", () => {
    expect(parseWebhook({ event: "connection.update", instance: "consultorio", data: { state: "open" } })).toEqual({
      kind: "connection",
      state: "open",
    });
  });

  it("ignora lixo", () => {
    expect(parseWebhook(null)).toEqual({ kind: "ignore" });
    expect(parseWebhook({ event: "contacts.update" })).toEqual({ kind: "ignore" });
  });
});

describe("parseWebhook · contatos @lid", () => {
  it("usa o número alternativo quando o remoteJid é @lid", () => {
    const out = parseWebhook({
      event: "messages.upsert",
      data: {
        key: { remoteJid: "123456789@lid", remoteJidAlt: "5581999990001@s.whatsapp.net", fromMe: false, id: "L1" },
        message: { conversation: "sim" },
      },
    });
    expect(out).toMatchObject({ kind: "message", phone: "5581999990001", text: "sim" });
  });

  it("usa senderPn quando não há remoteJidAlt", () => {
    const out = parseWebhook({
      event: "messages.upsert",
      data: {
        key: { remoteJid: "123456789@lid", senderPn: "5581999990001@s.whatsapp.net", fromMe: false, id: "L2" },
        message: { conversation: "2" },
      },
    });
    expect(out).toMatchObject({ kind: "message", phone: "5581999990001" });
  });
});

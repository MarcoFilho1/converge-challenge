import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EngineResult } from "@/lib/engine/engine";
import { brPhoneVariants, BUTTON_CONTINUE, BUTTON_NEW, handleTelegramUpdate, phoneKey, tgCopy, type TelegramDeps } from "@/lib/telegram/handle";

const result = (outbound: string[], event: EngineResult["event"] = "answer"): EngineResult => ({ outbound, outboundIds: outbound.map((_, i) => `row${i}`), runId: "r1", event });

let links: Map<string, string>;
let registered: string[];
let sent: { chatId: string; text: string; markup?: unknown }[];
let deps: TelegramDeps;
const engine = { handleIncoming: vi.fn(), handleMedia: vi.fn(), greetLinked: vi.fn() };
const markDelivery = vi.fn();
const transcribe = vi.fn();

const update = (extra: Record<string, unknown>, id = 10) => ({
  update_id: id,
  message: { message_id: id, chat: { id: 555, type: "private" }, from: { id: 555, first_name: "Paula" }, ...extra },
});

beforeEach(() => {
  links = new Map();
  registered = [];
  sent = [];
  Object.values(engine).forEach((f) => f.mockReset());
  markDelivery.mockReset().mockResolvedValue(undefined);
  transcribe.mockReset();
  process.env.DOCTOR_WHATSAPP = "81988887777";
  deps = {
    engine,
    personForChat: async (c) => links.get(c) ?? null,
    linkChat: async (c, k) => void links.set(c, k),
    send: async (chatId, text, markup) => {
      sent.push({ chatId, text, markup });
      return String(sent.length);
    },
    markDelivery,
    transcribe,
    findContactPhone: async (variants) => variants.find((v) => registered.includes(v)) ?? null,
  };
});

describe("conversa pelo Telegram", () => {
  it("primeira mensagem: boas-vindas com os dois botões, sem chamar o motor", async () => {
    await handleTelegramUpdate(update({ text: "/start entrar" }), deps);
    expect(sent).toHaveLength(1);
    expect(sent[0].text).toBe(tgCopy.welcome);
    const keyboard = (sent[0].markup as { keyboard: { text: string; request_contact?: boolean }[][] }).keyboard.flat();
    expect(keyboard).toEqual([{ text: BUTTON_CONTINUE, request_contact: true }, { text: BUTTON_NEW }]);
    expect(engine.greetLinked).not.toHaveBeenCalled();
    expect(engine.handleIncoming).not.toHaveBeenCalled();
  });

  it("compartilhou o próprio número: liga ao telefone e continua o mesmo caso, tirando os botões", async () => {
    engine.greetLinked.mockResolvedValue(result(["Pronto, encontrei seu atendimento.", "Pergunta 3"], "resumed"));
    await handleTelegramUpdate(update({ contact: { phone_number: "+55 81 99999-0001", user_id: 555 } }), deps);
    expect(links.get("555")).toBe("5581999990001");
    expect(engine.greetLinked).toHaveBeenCalledWith({ phone: "5581999990001", name: "Paula" });
    expect(sent.map((s) => s.text)).toEqual(["Pronto, encontrei seu atendimento.", "Pergunta 3"]);
    expect(sent[0].markup).toEqual({ remove_keyboard: true });
    expect(markDelivery).toHaveBeenCalledWith("row0", "tg-out:555:1");
    expect(markDelivery).toHaveBeenCalledWith("row1", "tg-out:555:2");
  });

  it("cadastro do WhatsApp sem o 9 e Telegram com o 9: liga à mesma pessoa", async () => {
    registered = ["558199990001"];
    engine.greetLinked.mockResolvedValue(result(["Pronto"], "resumed"));
    await handleTelegramUpdate(update({ contact: { phone_number: "5581999990001", user_id: 555 } }), deps);
    expect(links.get("555")).toBe("558199990001");
    expect(engine.greetLinked).toHaveBeenCalledWith({ phone: "558199990001", name: "Paula" });
  });

  it("número de outra pessoa não liga nada", async () => {
    await handleTelegramUpdate(update({ contact: { phone_number: "+5581999990002", user_id: 999 } }), deps);
    expect(links.size).toBe(0);
    expect(sent[0].text).toBe(tgCopy.ownNumberOnly);
  });

  it("'Começar agora': entra só pelo Telegram, com a chave tg:<conversa>", async () => {
    engine.greetLinked.mockResolvedValue(result(["Olá, Paula. Você aceita participar?"], "joined"));
    await handleTelegramUpdate(update({ text: BUTTON_NEW }), deps);
    expect(links.get("555")).toBe("tg:555");
    expect(engine.greetLinked).toHaveBeenCalledWith({ phone: "tg:555", name: "Paula" });
  });

  it("a médica liga o Telegram para avisos e não vira colaboradora", async () => {
    await handleTelegramUpdate(update({ contact: { phone_number: "+5581988887777", user_id: 555 } }), deps);
    expect(links.get("555")).toBe("5581988887777");
    expect(sent[0].text).toBe(tgCopy.doctorLinked);
    await handleTelegramUpdate(update({ text: "oi" }, 11), deps);
    expect(engine.handleIncoming).not.toHaveBeenCalled();
    expect(engine.greetLinked).not.toHaveBeenCalled();
  });

  it("já ligado: texto vai ao motor com id próprio do Telegram", async () => {
    links.set("555", "5581999990001");
    engine.handleIncoming.mockResolvedValue(result(["Pergunta 4"]));
    await handleTelegramUpdate(update({ text: "2" }, 12), deps);
    expect(engine.handleIncoming).toHaveBeenCalledWith({ phone: "5581999990001", text: "2", waMessageId: "tg:555:12", name: "Paula" });
    expect(sent.map((s) => s.text)).toEqual(["Pergunta 4"]);
  });

  it("áudio de voz: transcreve e passa ao motor como áudio; se falhar, pede para escrever", async () => {
    links.set("555", "5581999990001");
    transcribe.mockResolvedValueOnce("sim, trabalhei doente");
    engine.handleIncoming.mockResolvedValue(result(["Ouvi seu áudio", "Pergunta 5"]));
    await handleTelegramUpdate(update({ voice: { file_id: "F1", mime_type: "audio/ogg" } }, 13), deps);
    expect(transcribe).toHaveBeenCalledWith("F1", "audio/ogg");
    expect(engine.handleIncoming).toHaveBeenCalledWith(expect.objectContaining({ text: "sim, trabalhei doente", viaAudio: true, waMessageId: "tg:555:13" }));

    transcribe.mockRejectedValueOnce(new Error("Whisper fora"));
    engine.handleMedia.mockResolvedValue(result(["Não consegui ouvir"], "media"));
    await handleTelegramUpdate(update({ voice: { file_id: "F2" } }, 14), deps);
    expect(engine.handleMedia).toHaveBeenCalledWith({ phone: "5581999990001", waMessageId: "tg:555:14", media: "áudio sem transcrição" });
  });

  it("envio que falha marca a mensagem como não entregue", async () => {
    links.set("555", "5581999990001");
    engine.handleIncoming.mockResolvedValue(result(["Pergunta 4"]));
    deps.send = async () => {
      throw new Error("Telegram fora");
    };
    await handleTelegramUpdate(update({ text: "2" }, 15), deps);
    expect(markDelivery).toHaveBeenCalledWith("row0", null);
  });

  it("chave do número: dígitos com o código do país; celular brasileiro com e sem o 9", () => {
    expect(phoneKey("+55 (81) 99999-0001")).toBe("5581999990001");
    expect(phoneKey("+1 415 555 0100")).toBe("14155550100");
    expect(phoneKey("123")).toBeNull();
    expect(brPhoneVariants("5581999990001")).toEqual(["5581999990001", "558199990001"]);
    expect(brPhoneVariants("558199990001")).toEqual(["558199990001", "5581999990001"]);
    expect(brPhoneVariants("558133330001")).toEqual(["558133330001"]);
    expect(brPhoneVariants("14155550100")).toEqual(["14155550100"]);
  });
});

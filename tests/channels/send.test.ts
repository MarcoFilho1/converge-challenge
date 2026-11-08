import { beforeEach, describe, expect, it, vi } from "vitest";

const sendText = vi.fn();
const sendMessage = vi.fn();
const chatForPerson = vi.fn();
const recordEvent = vi.fn();
let waOnline = true;

vi.mock("@/lib/whatsapp/evolution", () => ({ sendText: (...a: unknown[]) => sendText(...a) }));
vi.mock("@/lib/telegram/api", () => ({ sendMessage: (...a: unknown[]) => sendMessage(...a), telegramEnabled: () => true }));
vi.mock("@/lib/telegram/links", () => ({
  chatForPerson: (...a: unknown[]) => chatForPerson(...a),
  isTelegramOnlyKey: (k: string) => k.startsWith("tg:"),
}));
vi.mock("@/lib/obs/events", () => ({ recordEvent: (...a: unknown[]) => recordEvent(...a) }));
vi.mock("@/lib/channels/status", () => ({
  whatsappSimulatedDown: () => false,
  whatsappStatus: async () => ({ online: waOnline, phone: null }),
}));

const PHONE = "5581999990001";

beforeEach(() => {
  process.env.SEND_RETRY_DELAY_MS = "0";
  waOnline = true;
  sendText.mockReset();
  sendMessage.mockReset().mockResolvedValue({ messageId: "77" });
  chatForPerson.mockReset().mockResolvedValue(null);
  recordEvent.mockReset();
});

describe("envio com reserva", () => {
  it("sem Telegram ligado: só WhatsApp, com 3 tentativas, e lança se todas falharem", async () => {
    const { sendToPerson } = await import("@/lib/channels/send");
    sendText.mockRejectedValue(new Error("fora"));
    await expect(sendToPerson(PHONE, "oi")).rejects.toThrow("fora");
    expect(sendText).toHaveBeenCalledTimes(3);
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("WhatsApp falha e a pessoa tem Telegram: entrega pelo Telegram e registra no rastro", async () => {
    const { sendToPerson } = await import("@/lib/channels/send");
    chatForPerson.mockResolvedValue("555");
    sendText.mockRejectedValue(new Error("fora"));
    const out = await sendToPerson(PHONE, "*Lembrete*", { runId: "r1" });
    expect(out).toEqual({ channel: "telegram", messageId: "tg-out:555:77" });
    expect(sendMessage).toHaveBeenCalledWith("555", "<b>Lembrete</b>", { plain: "Lembrete" });
    expect(recordEvent).toHaveBeenCalledWith(expect.objectContaining({ kind: "envio", model: "reserva: Telegram", runId: "r1", detail: expect.stringContaining("WhatsApp falhou") }));
  });

  it("WhatsApp já sabido fora do ar: vai direto pelo Telegram, sem esperar as tentativas", async () => {
    const { sendToPerson } = await import("@/lib/channels/send");
    chatForPerson.mockResolvedValue("555");
    waOnline = false;
    const out = await sendToPerson(PHONE, "oi");
    expect(out.channel).toBe("telegram");
    expect(sendText).not.toHaveBeenCalled();
    expect(recordEvent).toHaveBeenCalledWith(expect.objectContaining({ detail: expect.stringContaining("fora do ar") }));
  });

  it("WhatsApp no ar: usa o WhatsApp mesmo com Telegram ligado", async () => {
    const { sendToPerson } = await import("@/lib/channels/send");
    chatForPerson.mockResolvedValue("555");
    sendText.mockResolvedValue({ waMessageId: "W1" });
    expect(await sendToPerson(PHONE, "oi")).toEqual({ channel: "whatsapp", messageId: "W1" });
    expect(sendMessage).not.toHaveBeenCalled();
    expect(recordEvent).not.toHaveBeenCalled();
  });

  it("quem entrou só pelo Telegram recebe só pelo Telegram", async () => {
    const { sendToPerson } = await import("@/lib/channels/send");
    const out = await sendToPerson("tg:555", "oi");
    expect(out).toEqual({ channel: "telegram", messageId: "tg-out:555:77" });
    expect(sendText).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const handleIncoming = vi.fn();
const handleMedia = vi.fn();
const transcribeAudio = vi.fn();
const getMediaBase64 = vi.fn();
const sendText = vi.fn();
const saveConnectionState = vi.fn();

vi.mock("@/lib/engine/engine", () => ({ handleIncoming: (...a: unknown[]) => handleIncoming(...a), handleMedia: (...a: unknown[]) => handleMedia(...a) }));
vi.mock("@/lib/whatsapp/evolution", () => ({ sendText: (...a: unknown[]) => sendText(...a), getMediaBase64: (...a: unknown[]) => getMediaBase64(...a) }));
vi.mock("@/lib/voice/transcribe-message", () => ({ transcribeAudio: (...a: unknown[]) => transcribeAudio(...a) }));
vi.mock("@/lib/whatsapp/session", () => ({ saveConnectionState: (...a: unknown[]) => saveConnectionState(...a) }));
const recordEvent = vi.fn();
vi.mock("@/lib/obs/events", () => ({ recordEvent: (...a: unknown[]) => recordEvent(...a) }));
const markDelivery = vi.fn();
vi.mock("@/lib/engine/repo", () => ({ markDelivery: (...a: unknown[]) => markDelivery(...a) }));

const body = (fromMe: boolean, id = "X1") => ({
  event: "messages.upsert",
  instance: "consultorio",
  data: { key: { remoteJid: "5581999990001@s.whatsapp.net", fromMe, id }, message: { conversation: "sim" } },
});

const post = async (payload: unknown, secret = "segredo") => {
  const { POST } = await import("@/app/api/webhook/whatsapp/route");
  return POST(
    new Request("http://localhost/api/webhook/whatsapp", {
      method: "POST",
      headers: { "content-type": "application/json", "x-webhook-secret": secret },
      body: JSON.stringify(payload),
    }),
  );
};

beforeEach(() => {
  process.env.WEBHOOK_SECRET = "segredo";
  handleIncoming.mockReset();
  handleMedia.mockReset();
  transcribeAudio.mockReset();
  getMediaBase64.mockReset();
  sendText.mockReset();
  saveConnectionState.mockReset();
  recordEvent.mockReset();
});

describe("POST /api/webhook/whatsapp", () => {
  it("recusa sem o segredo certo", async () => {
    const res = await post(body(false), "errado");
    expect(res.status).toBe(401);
    expect(handleIncoming).not.toHaveBeenCalled();
  });

  it("ignora mensagem do próprio celular", async () => {
    const res = await post(body(true));
    expect(res.status).toBe(200);
    expect(handleIncoming).not.toHaveBeenCalled();
  });

  it("passa a mensagem ao motor e envia cada resposta em ordem", async () => {
    handleIncoming.mockResolvedValue({ outbound: ["a", "b"], runId: "r", event: "answer" });
    sendText.mockResolvedValue({ waMessageId: "out" });
    const res = await post(body(false));
    expect(res.status).toBe(200);
    expect(handleIncoming).toHaveBeenCalledWith({ phone: "5581999990001", text: "sim", waMessageId: "X1" });
    expect(sendText.mock.calls.map((c) => c[1])).toEqual(["a", "b"]);
  });

  it("duplicado não envia nada", async () => {
    handleIncoming.mockResolvedValue({ outbound: [], runId: null, event: "duplicate" });
    await post(body(false));
    expect(sendText).not.toHaveBeenCalled();
  });

  it("erro no motor não derruba o webhook", async () => {
    handleIncoming.mockRejectedValue(new Error("banco fora"));
    const res = await post(body(false));
    expect(res.status).toBe(200);
  });

  it("tenta de novo quando o envio falha e não pula as mensagens seguintes", async () => {
    process.env.SEND_RETRY_DELAY_MS = "0";
    handleIncoming.mockResolvedValue({ outbound: ["crise", "depois"], outboundIds: ["m1", "m2"], runId: "r", event: "crisis" });
    sendText
      .mockRejectedValueOnce(new Error("fora"))
      .mockRejectedValueOnce(new Error("fora"))
      .mockResolvedValueOnce({ waMessageId: "ok1" })
      .mockRejectedValue(new Error("fora de vez"));
    const res = await post(body(false, "R1"));
    expect(res.status).toBe(200);
    expect(sendText.mock.calls.map((c) => c[1])).toEqual(["crise", "crise", "crise", "depois", "depois", "depois"]);
    expect(markDelivery).toHaveBeenCalledWith("m1", "ok1");
    expect(markDelivery).toHaveBeenCalledWith("m2", null);
  });

  it("em produção, recusa tudo se o segredo não estiver configurado", async () => {
    process.env.WEBHOOK_SECRET = "";
    const env = process.env as Record<string, string | undefined>;
    const previous = env.NODE_ENV;
    env.NODE_ENV = "production";
    try {
      const res = await post(body(false, "P1"), "");
      expect(res.status).toBe(503);
      expect(handleIncoming).not.toHaveBeenCalled();
    } finally {
      env.NODE_ENV = previous;
    }
  });

  it("grava o estado da conexão", async () => {
    await post({ event: "connection.update", instance: "consultorio", data: { state: "open" } });
    expect(saveConnectionState).toHaveBeenCalledWith("open");
  });

  it("áudio: transcreve e passa o texto ao motor marcado como áudio", async () => {
    transcribeAudio.mockResolvedValue({ text: "sim, trabalhei doente", ms: 900 });
    handleIncoming.mockResolvedValue({ outbound: ["Ouvi seu áudio: “sim, trabalhei doente”", "próxima"], outboundIds: ["m1", "m2"], runId: "r1", event: "answer" });
    sendText.mockResolvedValue({ waMessageId: "w" });
    await post({
      event: "messages.upsert",
      data: { key: { remoteJid: "5581999990001@s.whatsapp.net", fromMe: false, id: "AU1" }, message: { audioMessage: { mimetype: "audio/ogg" }, base64: "T2dnUw==" } },
    });
    expect(transcribeAudio).toHaveBeenCalledWith(Buffer.from("T2dnUw==", "base64"), "audio/ogg");
    expect(handleIncoming).toHaveBeenCalledWith({ phone: "5581999990001", text: "sim, trabalhei doente", waMessageId: "AU1", viaAudio: true });
    expect(sendText).toHaveBeenCalledTimes(2);
  });

  it("áudio sem base64 no corpo: busca o arquivo na Evolution pelo id", async () => {
    getMediaBase64.mockResolvedValue({ base64: "T2dnUw==", mime: "audio/ogg" });
    transcribeAudio.mockResolvedValue({ text: "não", ms: 800 });
    handleIncoming.mockResolvedValue({ outbound: [], outboundIds: [], runId: null, event: "answer" });
    await post({ event: "messages.upsert", data: { key: { remoteJid: "5581999990001@s.whatsapp.net", fromMe: false, id: "AU2" }, message: { audioMessage: {} } } });
    expect(getMediaBase64).toHaveBeenCalledWith("AU2");
    expect(handleIncoming).toHaveBeenCalledWith(expect.objectContaining({ text: "não", viaAudio: true }));
  });

  it("áudio que não deu para transcrever: o motor pede para escrever", async () => {
    transcribeAudio.mockRejectedValue(new Error("Whisper fora"));
    handleMedia.mockResolvedValue({ outbound: ["Não consegui ouvir"], outboundIds: ["m1"], runId: null, event: "media" });
    sendText.mockResolvedValue({ waMessageId: "w" });
    await post({ event: "messages.upsert", data: { key: { remoteJid: "5581999990001@s.whatsapp.net", fromMe: false, id: "AU3" }, message: { audioMessage: {}, base64: "T2dnUw==" } } });
    expect(handleIncoming).not.toHaveBeenCalled();
    expect(handleMedia).toHaveBeenCalledWith({ phone: "5581999990001", waMessageId: "AU3", media: "áudio sem transcrição" });
    expect(sendText).toHaveBeenCalledWith("5581999990001", "Não consegui ouvir");
  });

  it("figurinha: resposta padrão do motor", async () => {
    handleMedia.mockResolvedValue({ outbound: ["só leio texto"], outboundIds: ["m1"], runId: null, event: "media" });
    sendText.mockResolvedValue({ waMessageId: "w" });
    await post({ event: "messages.upsert", data: { key: { remoteJid: "5581999990001@s.whatsapp.net", fromMe: false, id: "ST1" }, message: { stickerMessage: {} } } });
    expect(handleMedia).toHaveBeenCalledWith({ phone: "5581999990001", waMessageId: "ST1", media: "figurinha" });
    expect(sendText).toHaveBeenCalledWith("5581999990001", "só leio texto");
  });
});

describe("tempo de resposta no rastro", () => {
  it("cada mensagem atendida grava quanto a pessoa esperou, ligada ao id dela", async () => {
    handleIncoming.mockResolvedValue({ outbound: ["a", "b"], outboundIds: [], runId: "r1", event: "answer" });
    sendText.mockResolvedValue({ waMessageId: "w" });
    await post(body(false, "MSG-1"));
    const ev = recordEvent.mock.calls.map((c) => c[0]).find((e) => e.kind === "resposta no WhatsApp");
    expect(ev).toMatchObject({ outcome: "ok", runId: "r1", waMessageId: "MSG-1" });
    expect(typeof ev.latencyMs).toBe("number");
    expect(ev.detail).toMatch(/texto · 2 mensagens enviadas · resposta gravada/);
  });

  it("duplicata e número desconhecido não contam como resposta", async () => {
    handleIncoming.mockResolvedValue({ outbound: [], outboundIds: [], runId: null, event: "duplicate" });
    await post(body(false, "MSG-2"));
    expect(recordEvent.mock.calls.map((c) => c[0].kind)).not.toContain("resposta no WhatsApp");
  });

  it("áudio: a transcrição e a resposta levam o id da mensagem", async () => {
    transcribeAudio.mockResolvedValue({ text: "sim", ms: 900 });
    handleIncoming.mockResolvedValue({ outbound: ["a"], outboundIds: [], runId: "r1", event: "answer" });
    sendText.mockResolvedValue({ waMessageId: "w" });
    await post({ event: "messages.upsert", data: { key: { remoteJid: "5581999990001@s.whatsapp.net", fromMe: false, id: "AUD-1" }, message: { audioMessage: { mimetype: "audio/ogg" }, base64: "AAAA" } } });
    const kinds = recordEvent.mock.calls.map((c) => c[0]).filter((e) => e.waMessageId === "AUD-1").map((e) => e.kind);
    expect(kinds).toEqual(["transcrição do áudio", "resposta no WhatsApp"]);
    expect(recordEvent.mock.calls.map((c) => c[0]).find((e) => e.kind === "resposta no WhatsApp").detail).toMatch(/^áudio/);
  });
});

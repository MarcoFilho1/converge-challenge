import { beforeEach, describe, expect, it, vi } from "vitest";

const handleIncoming = vi.fn();
const sendText = vi.fn();
const saveConnectionState = vi.fn();

vi.mock("@/lib/engine/engine", () => ({ handleIncoming: (...a: unknown[]) => handleIncoming(...a) }));
vi.mock("@/lib/whatsapp/evolution", () => ({ sendText: (...a: unknown[]) => sendText(...a) }));
vi.mock("@/lib/whatsapp/session", () => ({ saveConnectionState: (...a: unknown[]) => saveConnectionState(...a) }));
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
  sendText.mockReset();
  saveConnectionState.mockReset();
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

  it("grava o estado da conexão", async () => {
    await post({ event: "connection.update", instance: "consultorio", data: { state: "open" } });
    expect(saveConnectionState).toHaveBeenCalledWith("open");
  });
});

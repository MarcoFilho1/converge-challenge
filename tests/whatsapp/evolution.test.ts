import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EvolutionError, ensureInstance, getQr, getState, sendText } from "@/lib/whatsapp/evolution";

type Call = { url: string; init: RequestInit };
let calls: Call[] = [];

function stubFetch(responder: (url: string, init: RequestInit) => { status: number; body: unknown }) {
  vi.stubGlobal("fetch", async (url: string, init: RequestInit = {}) => {
    calls.push({ url, init });
    const { status, body } = responder(url, init);
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  });
}

beforeEach(() => {
  calls = [];
  process.env.EVOLUTION_URL = "http://evo.test";
  process.env.EVOLUTION_API_KEY = "k";
  process.env.EVOLUTION_INSTANCE = "consultorio";
  process.env.APP_PUBLIC_URL = "http://host.docker.internal:3100";
  process.env.WHATSAPP_DRY_RUN = "false";
  process.env.WEBHOOK_SECRET = "segredo";
});
afterEach(() => {
  vi.unstubAllGlobals();
  process.env.WHATSAPP_DRY_RUN = "true";
});

describe("sendText", () => {
  it("monta URL, header apikey e corpo, e devolve o id da mensagem", async () => {
    stubFetch(() => ({ status: 201, body: { key: { id: "WA123", remoteJid: "x", fromMe: true } } }));
    const out = await sendText("5581999990000", "Olá", 1200);
    expect(out.waMessageId).toBe("WA123");
    expect(calls[0].url).toBe("http://evo.test/message/sendText/consultorio");
    expect((calls[0].init.headers as Record<string, string>).apikey).toBe("k");
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ number: "5581999990000", text: "Olá", delay: 1200 });
  });

  it("não chama a Evolution em modo dry-run", async () => {
    process.env.WHATSAPP_DRY_RUN = "true";
    stubFetch(() => ({ status: 500, body: {} }));
    const out = await sendText("5581999990000", "Olá");
    expect(out.waMessageId).toBe("dry-run");
    expect(calls).toHaveLength(0);
  });

  it("converte falha de rede em EvolutionError com status 0", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("fetch failed");
    });
    await expect(sendText("5581999990000", "Olá")).rejects.toMatchObject({ name: "EvolutionError", status: 0 });
  });

  it("converte resposta de erro em EvolutionError legível", async () => {
    stubFetch(() => ({ status: 400, body: { response: { message: ["número inválido"] } } }));
    const err = await sendText("5581999990000", "Olá").catch((e) => e);
    expect(err).toBeInstanceOf(EvolutionError);
    expect(err.status).toBe(400);
    expect(err.message).toContain("número inválido");
  });
});

describe("resposta não-JSON", () => {
  it("vira EvolutionError legível (ex.: página 502 de proxy)", async () => {
    vi.stubGlobal("fetch", async () => new Response("<html>502 Bad Gateway</html>", { status: 502 }));
    const err = await sendText("5581999990000", "Olá").catch((e) => e);
    expect(err).toBeInstanceOf(EvolutionError);
    expect(err.status).toBe(502);
  });
});

describe("ensureInstance", () => {
  it("cria a instância Baileys com webhook do app", async () => {
    stubFetch(() => ({ status: 201, body: { instance: { instanceName: "consultorio" } } }));
    await ensureInstance();
    const body = JSON.parse(calls[0].init.body as string);
    expect(calls[0].url).toBe("http://evo.test/instance/create");
    expect(body.integration).toBe("WHATSAPP-BAILEYS");
    expect(body.qrcode).toBe(true);
    expect(body.webhook.url).toBe("http://host.docker.internal:3100/api/webhook/whatsapp");
    expect(body.webhook.events).toEqual(["MESSAGES_UPSERT", "CONNECTION_UPDATE"]);
  });

  it("sempre reaplica o webhook com o cabeçalho secreto", async () => {
    stubFetch(() => ({ status: 201, body: {} }));
    await ensureInstance();
    const set = calls.find((c) => c.url === "http://evo.test/webhook/set/consultorio");
    expect(set).toBeTruthy();
    const body = JSON.parse(set!.init.body as string);
    expect(body.webhook.headers).toEqual({ "x-webhook-secret": "segredo" });
    expect(body.webhook.url).toBe("http://host.docker.internal:3100/api/webhook/whatsapp");
  });

  it("trata 'já existe' como sucesso", async () => {
    stubFetch((url) =>
      url.endsWith("/instance/create")
        ? { status: 403, body: { status: 403, response: { message: ['This name "consultorio" is already in use.'] } } }
        : { status: 201, body: {} },
    );
    await expect(ensureInstance()).resolves.toBeUndefined();
  });
});

describe("getQr e getState", () => {
  it("lê o base64 do QR", async () => {
    stubFetch(() => ({ status: 200, body: { base64: "data:image/png;base64,AAA", code: "2@x", count: 1 } }));
    expect(await getQr()).toEqual({ base64: "data:image/png;base64,AAA", code: "2@x", count: 1 });
  });

  it("lê o estado da conexão", async () => {
    stubFetch(() => ({ status: 200, body: { instance: { instanceName: "consultorio", state: "open" } } }));
    expect(await getState()).toBe("open");
  });

  it("estado é 'close' quando a instância não existe", async () => {
    stubFetch(() => ({ status: 404, body: { response: { message: ["instance does not exist"] } } }));
    expect(await getState()).toBe("close");
  });
});

export class EvolutionError extends Error {
  readonly name = "EvolutionError";
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export type ConnectionState = "open" | "connecting" | "close" | "refused";

const cfg = () => ({
  url: (process.env.EVOLUTION_URL ?? "http://localhost:8082").replace(/\/$/, ""),
  key: process.env.EVOLUTION_API_KEY ?? "",
  instance: process.env.EVOLUTION_INSTANCE ?? "consultorio",
  appUrl: (process.env.APP_PUBLIC_URL ?? "http://host.docker.internal:3100").replace(/\/$/, ""),
});

function errorMessage(body: unknown): string {
  const b = body as { response?: { message?: unknown }; message?: unknown; error?: unknown } | null;
  const msg = b?.response?.message ?? b?.message ?? b?.error;
  if (Array.isArray(msg)) return msg.map(String).join("; ");
  return msg ? String(msg) : "erro desconhecido";
}

async function call<T>(method: "GET" | "POST" | "DELETE", path: string, body?: unknown): Promise<T> {
  const { url, key } = cfg();
  let res: Response;
  try {
    res = await fetch(`${url}${path}`, {
      method,
      headers: { "content-type": "application/json", apikey: key },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    throw new EvolutionError("Não foi possível falar com o WhatsApp (Evolution API fora do ar?).", 0);
  }
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    if (res.ok) throw new EvolutionError("Evolution respondeu algo que não é JSON.", res.status);
    json = { message: text.slice(0, 120) };
  }
  if (!res.ok) throw new EvolutionError(`Evolution respondeu ${res.status}: ${errorMessage(json)}`, res.status);
  return json as T;
}

function webhookConfig() {
  const { appUrl } = cfg();
  return {
    enabled: true,
    url: `${appUrl}/api/webhook/whatsapp`,
    headers: { "x-webhook-secret": process.env.WEBHOOK_SECRET ?? "" },
    byEvents: false,
    // Áudio chega com o arquivo junto, para transcrever sem outra chamada.
    base64: true,
    events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE"],
  };
}

/** Cria a instância Baileys (se não existir) e sempre reaplica o webhook com o cabeçalho secreto. */
export async function ensureInstance(): Promise<void> {
  const { instance } = cfg();
  try {
    await call("POST", "/instance/create", {
      instanceName: instance,
      qrcode: true,
      integration: "WHATSAPP-BAILEYS",
      groupsIgnore: true,
      webhook: webhookConfig(),
    });
  } catch (err) {
    if (!(err instanceof EvolutionError && err.status === 403 && /already in use/i.test(err.message))) throw err;
  }
  await call("POST", `/webhook/set/${instance}`, { webhook: webhookConfig() });
}

export async function getQr(): Promise<{ base64: string | null; code: string | null; count: number }> {
  const out = await call<{ base64?: string; code?: string; count?: number }>(
    "GET",
    `/instance/connect/${cfg().instance}`,
  );
  return { base64: out.base64 ?? null, code: out.code ?? null, count: out.count ?? 0 };
}

export async function getState(): Promise<ConnectionState> {
  try {
    const out = await call<{ instance?: { state?: string } }>("GET", `/instance/connectionState/${cfg().instance}`);
    const state = out.instance?.state;
    return state === "open" || state === "connecting" || state === "refused" ? state : "close";
  } catch (err) {
    if (err instanceof EvolutionError && err.status === 404) return "close";
    throw err;
  }
}

export async function getConnectedPhone(): Promise<string | null> {
  const list = await call<{ ownerJid?: string | null }[]>(
    "GET",
    `/instance/fetchInstances?instanceName=${encodeURIComponent(cfg().instance)}`,
  );
  const jid = list?.[0]?.ownerJid;
  return jid ? jid.split("@")[0].split(":")[0] : null;
}

export async function sendText(phoneE164: string, text: string, delayMs = 1200): Promise<{ waMessageId: string | null }> {
  if (process.env.WHATSAPP_DRY_RUN === "true") return { waMessageId: "dry-run" };
  const out = await call<{ key?: { id?: string } }>("POST", `/message/sendText/${cfg().instance}`, {
    number: phoneE164,
    text,
    delay: delayMs,
  });
  return { waMessageId: out.key?.id ?? null };
}

/** Arquivo de uma mídia recebida (quando não veio no corpo do webhook). */
export async function getMediaBase64(waMessageId: string): Promise<{ base64: string; mime: string }> {
  const out = await call<{ base64?: string; mimetype?: string }>("POST", `/chat/getBase64FromMediaMessage/${cfg().instance}`, {
    message: { key: { id: waMessageId } },
    convertToMp4: false,
  });
  if (!out.base64) throw new EvolutionError("Evolution não devolveu o arquivo da mídia.", 0);
  return { base64: out.base64, mime: out.mimetype ?? "audio/ogg" };
}

export async function logoutInstance(): Promise<void> {
  try {
    await call("DELETE", `/instance/logout/${cfg().instance}`);
  } catch (err) {
    if (!(err instanceof EvolutionError) || (err.status !== 404 && err.status !== 400)) throw err;
  }
}

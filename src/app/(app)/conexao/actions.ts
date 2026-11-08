"use server";

import {
  ensureInstance,
  EvolutionError,
  getConnectedPhone,
  getQr,
  getState,
  logoutInstance,
  type ConnectionState,
} from "@/lib/whatsapp/evolution";

export interface ConnectionStatusPayload {
  state: ConnectionState;
  qrBase64: string | null;
  phone: string | null;
  instanceName: string;
  webhookUrl: string;
  updatedAt: string;
  error?: string;
}

let instanceEnsured = false;

export async function fetchConnection(): Promise<ConnectionStatusPayload> {
  const instanceName = process.env.EVOLUTION_INSTANCE ?? "consultorio";
  const appUrl = (process.env.APP_PUBLIC_URL ?? "http://host.docker.internal:3100").replace(/\/$/, "");
  const webhookUrl = `${appUrl}/api/webhook/whatsapp`;

  try {
    if (!instanceEnsured) {
      await ensureInstance();
      instanceEnsured = true;
    }

    const state = await getState();
    if (state === "open") {
      const phone = await getConnectedPhone();
      return {
        state,
        qrBase64: null,
        phone,
        instanceName,
        webhookUrl,
        updatedAt: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      };
    }

    const qr = await getQr();
    return {
      state,
      qrBase64: qr.base64,
      phone: null,
      instanceName,
      webhookUrl,
      updatedAt: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    };
  } catch (err) {
    const message =
      err instanceof EvolutionError
        ? err.message
        : "Serviço Evolution API indisponível no momento (verifique o container Docker na porta 8082).";
    return {
      state: "close",
      qrBase64: null,
      phone: null,
      instanceName,
      webhookUrl,
      updatedAt: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      error: message,
    };
  }
}

export async function resetConnection(): Promise<ConnectionStatusPayload> {
  try {
    instanceEnsured = false;
    await logoutInstance();
    await ensureInstance();
    instanceEnsured = true;
  } catch {
    // prossegue para ler o estado atual e reportar de forma limpa
  }
  return fetchConnection();
}

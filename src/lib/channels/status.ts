/**
 * Estado dos dois canais (WhatsApp principal, Telegram reserva) para a página de entrada,
 * a faixa do painel e a escolha do canal no envio. Guardado por alguns segundos para não
 * consultar a Evolution a cada mensagem.
 */
import { telegramEnabled } from "@/lib/telegram/api";

export type ChannelStatus = {
  whatsapp: { online: boolean; phone: string | null; simulatedDown: boolean };
  telegram: { online: boolean; username: string | null };
  checkedAt: string;
};

type G = typeof globalThis & {
  __waSimulatedDown?: boolean;
  __waStatusCache?: { at: number; online: boolean; phone: string | null };
  __tgPoller?: { lastOkAt: number; username: string | null; running: boolean };
};
const g = globalThis as G;

const CACHE_MS = 5_000;
const CHECK_TIMEOUT_MS = 2_500;

/** Ensaio da queda: o WhatsApp passa a contar como fora do ar, sem desconectar o celular. */
export function setWhatsappSimulatedDown(down: boolean) {
  g.__waSimulatedDown = down;
  g.__waStatusCache = undefined;
}
export const whatsappSimulatedDown = () => g.__waSimulatedDown === true;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error("tempo esgotado")), ms))]);
}

/** WhatsApp no ar = Evolution responde e a sessão do celular está "open". */
export async function whatsappStatus(): Promise<{ online: boolean; phone: string | null }> {
  if (whatsappSimulatedDown()) return { online: false, phone: g.__waStatusCache?.phone ?? envPhone() };
  const cache = g.__waStatusCache;
  if (cache && Date.now() - cache.at < CACHE_MS) return { online: cache.online, phone: cache.phone };
  let online = false;
  let phone = cache?.phone ?? null;
  try {
    const { getState, getConnectedPhone } = await import("@/lib/whatsapp/evolution");
    online = (await withTimeout(getState(), CHECK_TIMEOUT_MS)) === "open";
    if (online && !phone) phone = await withTimeout(getConnectedPhone(), CHECK_TIMEOUT_MS).catch(() => null);
  } catch {
    online = false;
  }
  phone = phone ?? envPhone();
  g.__waStatusCache = { at: Date.now(), online, phone };
  return { online, phone };
}

/** Número do bot informado no .env, para o link do WhatsApp quando a Evolution não responde. */
const envPhone = () => process.env.WHATSAPP_PUBLIC_NUMBER?.replace(/\D/g, "") || null;

/** Chamado pelo leitor do Telegram a cada consulta que deu certo. */
export function markTelegramAlive(username?: string | null) {
  g.__tgPoller = { running: true, lastOkAt: Date.now(), username: username ?? g.__tgPoller?.username ?? null };
}

export function telegramStatus(): { online: boolean; username: string | null } {
  const username = process.env.TELEGRAM_BOT_USERNAME?.replace(/^@/, "") || g.__tgPoller?.username || null;
  if (!telegramEnabled()) return { online: false, username };
  // Sem leitor neste processo (TELEGRAM_POLLING=false), vale o token configurado.
  if (!g.__tgPoller) return { online: process.env.TELEGRAM_POLLING === "false", username };
  return { online: Date.now() - g.__tgPoller.lastOkAt < 90_000, username };
}

export async function getChannelStatus(): Promise<ChannelStatus> {
  const wa = await whatsappStatus();
  return {
    whatsapp: { ...wa, simulatedDown: whatsappSimulatedDown() },
    telegram: telegramStatus(),
    checkedAt: new Date().toISOString(),
  };
}

export const whatsappLink = (phone: string | null) => (phone ? `https://wa.me/${phone}?text=${encodeURIComponent("Oi")}` : null);
export const telegramLink = (username: string | null) => (username ? `https://t.me/${username}?start=entrar` : null);

/** Estado sem dado interno, para a página pública e a faixa do painel. */
export async function getPublicChannels(): Promise<import("./public").PublicChannels> {
  const s = await getChannelStatus();
  return {
    whatsapp: { online: s.whatsapp.online, link: whatsappLink(s.whatsapp.phone), simulatedDown: s.whatsapp.simulatedDown },
    telegram: { online: s.telegram.online, link: telegramLink(s.telegram.username), username: s.telegram.username },
    checkedAt: s.checkedAt,
  };
}

/**
 * Leitor do Telegram por consulta longa (getUpdates): o servidor pergunta "tem mensagem nova?" e o
 * Telegram segura a resposta até chegar alguma (até 25 s). Não precisa de endereço público.
 * Só pode haver um leitor por token: rode um servidor só com TELEGRAM_BOT_TOKEN.
 */
import { markTelegramAlive } from "@/lib/channels/status";
import { getMe, tgCall, TelegramError } from "./api";
import { handleTelegramUpdate } from "./handle";

type G = typeof globalThis & { __tgPollerStarted?: boolean };

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Mensagens da mesma conversa são tratadas em ordem; conversas diferentes, em paralelo. */
const chains = new Map<string, Promise<void>>();
function enqueue(chatKey: string, task: () => Promise<void>) {
  const next = (chains.get(chatKey) ?? Promise.resolve()).then(task).catch((err) => console.error("[telegram] erro ao tratar mensagem", err));
  chains.set(chatKey, next);
  next.finally(() => {
    if (chains.get(chatKey) === next) chains.delete(chatKey);
  });
}

export function startTelegramPoller(): void {
  const g = globalThis as G;
  if (g.__tgPollerStarted) return;
  g.__tgPollerStarted = true;
  void loop();
}

async function loop() {
  let username: string | null = null;
  try {
    username = (await getMe()).username ?? null;
    // Se um webhook estiver configurado, o Telegram não entrega por getUpdates.
    await tgCall("deleteWebhook", { drop_pending_updates: false });
    markTelegramAlive(username);
    console.info(`[telegram] reserva ligada: @${username ?? "?"}`);
  } catch (err) {
    console.warn("[telegram] não consegui ligar o bot agora; tento de novo", err instanceof Error ? err.message : err);
  }

  let offset = 0;
  let failures = 0;
  for (;;) {
    try {
      const updates = await tgCall<{ update_id: number; message?: { chat?: { id?: number } } }[]>(
        "getUpdates",
        { offset, timeout: 25, allowed_updates: ["message"] },
        35_000,
      );
      markTelegramAlive(username);
      failures = 0;
      for (const u of updates) {
        offset = u.update_id + 1;
        enqueue(String(u.message?.chat?.id ?? u.update_id), () => handleTelegramUpdate(u));
      }
    } catch (err) {
      failures++;
      const conflict = err instanceof TelegramError && err.status === 409;
      if (failures === 1 || failures % 20 === 0) {
        console.warn(
          conflict ? "[telegram] outro servidor está lendo este bot (409). Deixe só um ligado com TELEGRAM_BOT_TOKEN." : "[telegram] consulta falhou",
          err instanceof Error ? err.message : err,
        );
      }
      await wait(Math.min(30_000, 2_000 * failures));
    }
  }
}

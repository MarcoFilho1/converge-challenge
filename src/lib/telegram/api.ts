/**
 * Cliente mínimo da Bot API do Telegram, a reserva do WhatsApp.
 * As mensagens chegam por consulta longa (getUpdates): não precisa de endereço público nem de túnel.
 */
export class TelegramError extends Error {
  readonly name = "TelegramError";
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export const telegramToken = () => process.env.TELEGRAM_BOT_TOKEN?.trim() ?? "";
export const telegramEnabled = () => telegramToken().length > 0;
const dryRun = () => process.env.TELEGRAM_DRY_RUN === "true";

type ApiResponse<T> = { ok: boolean; result?: T; description?: string; error_code?: number };

export async function tgCall<T>(method: string, body: Record<string, unknown> = {}, timeoutMs = 10_000): Promise<T> {
  const token = telegramToken();
  if (!token) throw new TelegramError("TELEGRAM_BOT_TOKEN não configurado.", 0);
  let res: Response;
  try {
    res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    throw new TelegramError("Não foi possível falar com o Telegram.", 0);
  }
  let json: ApiResponse<T> | null = null;
  try {
    json = (await res.json()) as ApiResponse<T>;
  } catch {
    /* corpo vazio ou não JSON */
  }
  if (!res.ok || !json?.ok) {
    throw new TelegramError(`Telegram respondeu ${json?.error_code ?? res.status}: ${json?.description ?? "erro desconhecido"}`, json?.error_code ?? res.status);
  }
  return json.result as T;
}

export type ReplyMarkup =
  | { keyboard: { text: string; request_contact?: boolean }[][]; resize_keyboard?: boolean; one_time_keyboard?: boolean; is_persistent?: boolean }
  | { remove_keyboard: true };

export async function sendMessage(
  chatId: string,
  html: string,
  opts: { replyMarkup?: ReplyMarkup; plain?: string } = {},
): Promise<{ messageId: string }> {
  if (dryRun()) return { messageId: "dry-run" };
  const base = { chat_id: chatId, link_preview_options: { is_disabled: true }, ...(opts.replyMarkup ? { reply_markup: opts.replyMarkup } : {}) };
  try {
    const out = await tgCall<{ message_id: number }>("sendMessage", { ...base, text: html, parse_mode: "HTML" });
    return { messageId: String(out.message_id) };
  } catch (err) {
    // Formatação recusada (400 "can't parse entities"): manda o texto puro para a pessoa não ficar sem resposta.
    if (err instanceof TelegramError && err.status === 400 && opts.plain !== undefined) {
      const out = await tgCall<{ message_id: number }>("sendMessage", { ...base, text: opts.plain });
      return { messageId: String(out.message_id) };
    }
    throw err;
  }
}

/** Arquivo de uma mensagem recebida (áudio de voz), baixado do Telegram. */
export async function downloadFile(fileId: string): Promise<Buffer> {
  const file = await tgCall<{ file_path?: string }>("getFile", { file_id: fileId });
  if (!file.file_path) throw new TelegramError("Telegram não devolveu o caminho do arquivo.", 0);
  const res = await fetch(`https://api.telegram.org/file/bot${telegramToken()}/${file.file_path}`, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new TelegramError(`Download do arquivo falhou (${res.status}).`, res.status);
  return Buffer.from(await res.arrayBuffer());
}

export async function getMe(): Promise<{ username?: string; first_name?: string }> {
  return tgCall("getMe");
}

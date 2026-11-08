/**
 * As mensagens do motor são escritas no estilo do WhatsApp (*negrito*, _itálico_).
 * Aqui viram HTML do Telegram, sem quebrar links que têm "_" no meio.
 */
const BOLD = /\*([^*\n]+)\*/g;
const ITALIC = /(^|[\s(“"])_([^_\n]+)_(?=$|[\s.,;:!?)”"])/gm;

/** Frases que citam o WhatsApp como o canal da conversa ficam neutras no Telegram. */
function neutralChannel(text: string): string {
  return text.replace(/Este WhatsApp não é atendido/g, "Este canal não é atendido");
}

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function toTelegramHtml(text: string): string {
  return escapeHtml(neutralChannel(text)).replace(BOLD, "<b>$1</b>").replace(ITALIC, "$1<i>$2</i>");
}

/** Mesmo texto, sem marcação: usado se o Telegram recusar o HTML. */
export function toTelegramPlain(text: string): string {
  return neutralChannel(text).replace(BOLD, "$1").replace(ITALIC, "$1$2");
}

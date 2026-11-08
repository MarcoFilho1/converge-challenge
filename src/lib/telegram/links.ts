import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { telegramLinks } from "@/db/schema";

/** Chave de quem começou direto pelo Telegram, sem compartilhar o número. */
export const telegramOnlyKey = (chatId: string) => `tg:${chatId}`;
export const isTelegramOnlyKey = (key: string) => key.startsWith("tg:");

/** A pessoa (telefone ou "tg:<chat>") ligada a esta conversa do Telegram, ou null. */
export async function personForChat(chatId: string): Promise<string | null> {
  const [row] = await db.select().from(telegramLinks).where(eq(telegramLinks.chatId, chatId));
  return row?.personKey ?? null;
}

export async function linkChat(chatId: string, personKey: string): Promise<void> {
  await db
    .insert(telegramLinks)
    .values({ chatId, personKey, linkedAt: new Date() })
    .onConflictDoUpdate({ target: telegramLinks.chatId, set: { personKey, linkedAt: new Date() } });
}

/** A conversa do Telegram desta pessoa (a ligação mais recente), ou null. */
export async function chatForPerson(personKey: string): Promise<string | null> {
  if (isTelegramOnlyKey(personKey)) return personKey.slice(3);
  const [row] = await db
    .select()
    .from(telegramLinks)
    .where(eq(telegramLinks.personKey, personKey))
    .orderBy(desc(telegramLinks.linkedAt))
    .limit(1);
  return row?.chatId ?? null;
}

/**
 * Cria SÓ a tabela do Telegram (telegram_links) no banco de DATABASE_URL, sem tocar nas outras.
 * Uso: pnpm telegram:db
 */
import "./_env";
import postgres from "postgres";

const SQL = `
CREATE TABLE IF NOT EXISTS telegram_links (
  chat_id text PRIMARY KEY,
  person_key text NOT NULL,
  linked_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS telegram_links_person_idx ON telegram_links(person_key);
`;

(async () => {
  const sql = postgres(process.env.DATABASE_URL!);
  await sql.unsafe(SQL);
  const [{ n }] = await sql`select count(*)::int as n from telegram_links`;
  console.log(`Tabela telegram_links pronta (${n} conversas ligadas).`);
  await sql.end();
})();

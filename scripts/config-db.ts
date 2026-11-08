/**
 * Cria SÓ a tabela das configurações da médica (app_settings) no banco de DATABASE_URL, sem tocar nas outras.
 * Uso: pnpm config:db
 */
import "./_env";
import postgres from "postgres";

const SQL = `
CREATE TABLE IF NOT EXISTS app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
`;

(async () => {
  const sql = postgres(process.env.DATABASE_URL!);
  await sql.unsafe(SQL);
  const [{ n }] = await sql`select count(*)::int as n from app_settings`;
  console.log(`Tabela app_settings pronta (${n} configuração(ões) salvas).`);
  await sql.end();
})();

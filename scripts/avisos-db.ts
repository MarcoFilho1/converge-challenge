/**
 * Cria SÓ a tabela dos avisos da médica (doctor_notices) no banco de DATABASE_URL, sem tocar nas outras.
 * Uso: pnpm avisos:db
 */
import "./_env";
import postgres from "postgres";

const SQL = `
CREATE TABLE IF NOT EXISTS doctor_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  run_id uuid,
  interview_id uuid,
  kind text NOT NULL,
  contact_name text NOT NULL,
  text text NOT NULL,
  read_at timestamptz
);
CREATE INDEX IF NOT EXISTS doctor_notices_created_idx ON doctor_notices(created_at);
`;

(async () => {
  const sql = postgres(process.env.DATABASE_URL!);
  await sql.unsafe(SQL);
  const [{ n }] = await sql`select count(*)::int as n from doctor_notices`;
  console.log(`Tabela doctor_notices pronta (${n} avisos).`);
  await sql.end();
})();

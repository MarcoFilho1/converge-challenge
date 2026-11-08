/**
 * Cria SÓ as tabelas da entrevista no banco apontado por DATABASE_URL, sem tocar nas tabelas do MVP1.
 * (drizzle-kit push --force a partir desta branch apagaria colunas que o MVP1 criou depois.)
 * Uso: pnpm entrevista:db
 */
import "./_env";
import postgres from "postgres";

const SQL = `
DO $$ BEGIN
  CREATE TYPE interview_status AS ENUM ('consent','running','crisis','done','stopped');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS interviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES questionnaire_runs(id) ON DELETE SET NULL,
  token text NOT NULL,
  status interview_status NOT NULL DEFAULT 'consent',
  mode text NOT NULL DEFAULT 'live',
  agenda jsonb NOT NULL,
  state jsonb NOT NULL,
  interviewer_profile text,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS interviews_token_idx ON interviews(token);
CREATE INDEX IF NOT EXISTS interviews_run_idx ON interviews(run_id);

CREATE TABLE IF NOT EXISTS interview_turns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id uuid NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
  idx integer NOT NULL,
  speaker text NOT NULL,
  text text NOT NULL,
  block_id text NOT NULL,
  probe_id text,
  audio_path text,
  started_ms integer NOT NULL,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS interview_turns_idx ON interview_turns(interview_id, idx);

CREATE TABLE IF NOT EXISTS interview_summaries (
  interview_id uuid PRIMARY KEY REFERENCES interviews(id) ON DELETE CASCADE,
  json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
`;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL não definido");
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  await sql.unsafe(SQL);
  const rows = await sql`select table_name from information_schema.tables where table_schema='public' and table_name like 'interview%' order by 1`;
  console.log("tabelas da entrevista:", rows.map((r) => r.table_name).join(", "));
  await sql.end();
}
main().catch((e) => { console.error(e); process.exit(1); });

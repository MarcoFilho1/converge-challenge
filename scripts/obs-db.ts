/**
 * Cria SÓ a tabela do rastro do agente (agent_events) no banco de DATABASE_URL, sem tocar nas outras.
 * Uso: pnpm obs:db
 */
import "./_env";
import postgres from "postgres";

const SQL = `
CREATE TABLE IF NOT EXISTS agent_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  run_id uuid,
  interview_id uuid,
  answer_id uuid,
  kind text NOT NULL,
  outcome text NOT NULL,
  model text,
  tokens_in integer,
  tokens_out integer,
  cost_usd real,
  latency_ms integer,
  detail text
);
CREATE INDEX IF NOT EXISTS agent_events_run_idx ON agent_events(run_id);
CREATE INDEX IF NOT EXISTS agent_events_interview_idx ON agent_events(interview_id);
CREATE INDEX IF NOT EXISTS agent_events_created_idx ON agent_events(created_at);
`;

(async () => {
  const sql = postgres(process.env.DATABASE_URL!);
  await sql.unsafe(SQL);
  const [{ n }] = await sql`select count(*)::int as n from agent_events`;
  console.log(`Tabela agent_events pronta (${n} eventos).`);
  await sql.end();
})();

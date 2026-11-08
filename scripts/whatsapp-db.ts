/**
 * Acrescenta SÓ as colunas do questionário em linguagem natural no banco de DATABASE_URL, sem tocar no resto.
 * Idempotente. Uso: pnpm whatsapp:db
 */
import "./_env";
import postgres from "postgres";

const SQL = `
ALTER TABLE messages ADD COLUMN IF NOT EXISTS via_audio boolean NOT NULL DEFAULT false;
ALTER TABLE answers ADD COLUMN IF NOT EXISTS source text;
ALTER TABLE answers ADD COLUMN IF NOT EXISTS quote text;
ALTER TABLE answers ADD COLUMN IF NOT EXISTS message_id uuid;
ALTER TABLE questionnaire_runs ADD COLUMN IF NOT EXISTS pending_value real;
`;

(async () => {
  const sql = postgres(process.env.DATABASE_URL!);
  await sql.unsafe(SQL);
  console.log("Colunas do WhatsApp em linguagem natural prontas (messages.via_audio, answers.source/quote/message_id, questionnaire_runs.pending_value).");
  await sql.end();
})();

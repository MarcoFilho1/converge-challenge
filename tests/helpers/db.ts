import { execSync } from "node:child_process";
import { sql } from "drizzle-orm";

let pushed = false;

export function pushSchemaToTestDb() {
  if (pushed) return;
  if (!process.env.TEST_DATABASE_URL?.includes("_test")) throw new Error("banco de teste inválido");
  execSync("pnpm exec drizzle-kit push --force", {
    env: { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL },
    stdio: "pipe",
  });
  pushed = true;
}

export async function truncateAll() {
  const { db } = await import("@/db/client");
  await db.execute(sql`
    TRUNCATE interview_summaries, interview_turns, interviews, evidence, summaries, scores, answers, messages, questionnaire_runs, contacts, wa_sessions
    RESTART IDENTITY CASCADE
  `);
}

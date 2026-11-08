/** Tabelas da entrevista por voz (MVP2). Separadas de schema.ts para não colidir com o MVP1. */
import { integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid, index } from "drizzle-orm/pg-core";
import { questionnaireRuns } from "./schema";

export const interviewStatus = pgEnum("interview_status", ["consent", "running", "crisis", "done", "stopped"]);

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const interviews = pgTable(
  "interviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id").references(() => questionnaireRuns.id, { onDelete: "set null" }),
    token: text("token").notNull(),
    status: interviewStatus("status").notNull().default("consent"),
    mode: text("mode").notNull().default("live"),
    agenda: jsonb("agenda").notNull(),
    state: jsonb("state").notNull(),
    interviewerProfile: text("interviewer_profile"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("interviews_token_idx").on(t.token), index("interviews_run_idx").on(t.runId)],
);

export const interviewTurns = pgTable(
  "interview_turns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    interviewId: uuid("interview_id").notNull().references(() => interviews.id, { onDelete: "cascade" }),
    idx: integer("idx").notNull(),
    speaker: text("speaker").notNull(),
    text: text("text").notNull(),
    blockId: text("block_id").notNull(),
    probeId: text("probe_id"),
    audioPath: text("audio_path"),
    startedMs: integer("started_ms").notNull(),
    durationMs: integer("duration_ms"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("interview_turns_idx").on(t.interviewId, t.idx)],
);

export const interviewSummaries = pgTable("interview_summaries", {
  interviewId: uuid("interview_id").primaryKey().references(() => interviews.id, { onDelete: "cascade" }),
  json: jsonb("json").notNull(),
  createdAt: createdAt(),
});

export type InterviewRow = typeof interviews.$inferSelect;
export type InterviewTurnRow = typeof interviewTurns.$inferSelect;

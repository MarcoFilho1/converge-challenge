import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
} from "drizzle-orm/pg-core";

export const EMBEDDING_DIMENSIONS = 1536;

export const runStatus = pgEnum("run_status", ["pending", "consent", "in_progress", "done", "stopped", "crisis"]);
export const severity = pgEnum("severity", ["none", "attention", "priority", "urgency"]);
export const direction = pgEnum("direction", ["in", "out"]);
export const docKind = pgEnum("doc_kind", ["instrumento", "norma", "guia", "crise"]);
export const caseState = pgEnum("case_state", ["aberto", "encaminhado", "acompanhando", "encerrado"]);
export const evidenceSource = pgEnum("evidence_source", ["rule", "rag"]);

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const contacts = pgTable(
  "contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    phoneE164: text("phone_e164").notNull(),
    sector: text("sector"),
    role: text("role"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("contacts_phone_idx").on(t.phoneE164)],
);

export const questionnaireRuns = pgTable(
  "questionnaire_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    status: runStatus("status").notNull().default("pending"),
    currentItem: integer("current_item").notNull().default(0),
    retryCount: integer("retry_count").notNull().default(0),
    severity: severity("severity").notNull().default("none"),
    partial: boolean("partial").notNull().default(false),
    clinicalOnly: boolean("clinical_only").notNull().default(false),
    demoShort: boolean("demo_short").notNull().default(false),
    resumedFromRunId: uuid("resumed_from_run_id"),
    caseState: caseState("case_state").notNull().default("aberto"),
    consentedAt: timestamp("consented_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("runs_contact_idx").on(t.contactId)],
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    runId: uuid("run_id").references(() => questionnaireRuns.id, { onDelete: "set null" }),
    direction: direction("direction").notNull(),
    text: text("text").notNull(),
    waMessageId: text("wa_message_id"),
    deliveryFailed: boolean("delivery_failed").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("messages_wa_id_idx").on(t.waMessageId), index("messages_run_idx").on(t.runId)],
);

export const answers = pgTable(
  "answers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .notNull()
      .references(() => questionnaireRuns.id, { onDelete: "cascade" }),
    instrument: text("instrument").notNull(),
    itemCode: text("item_code").notNull(),
    rawText: text("raw_text").notNull(),
    valueNumeric: real("value_numeric"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("answers_run_item_idx").on(t.runId, t.itemCode)],
);

export const scores = pgTable(
  "scores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .notNull()
      .references(() => questionnaireRuns.id, { onDelete: "cascade" }),
    instrument: text("instrument").notNull(),
    dimension: text("dimension").notNull(),
    value: real("value").notNull(),
    cutoff: real("cutoff").notNull(),
    flagged: boolean("flagged").notNull(),
    complete: boolean("complete").notNull(),
  },
  (t) => [uniqueIndex("scores_run_dim_idx").on(t.runId, t.instrument, t.dimension)],
);

export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  file: text("file").notNull(),
  kind: docKind("kind").notNull(),
  license: text("license").notNull(),
  sourceUrl: text("source_url").notNull(),
  /** Códigos de instrumento que este documento explica (TRUNK, WPAI, PHQ9, GAD7, BAT12, COPSOQ). */
  instruments: text("instruments").array().notNull().default(sql`'{}'::text[]`),
  createdAt: createdAt(),
});

export const documentChunks = pgTable(
  "document_chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    page: integer("page"),
    text: text("text").notNull(),
    embedding: vector("embedding", { dimensions: EMBEDDING_DIMENSIONS }).notNull(),
  },
  (t) => [index("chunks_embedding_idx").using("hnsw", t.embedding.op("vector_cosine_ops"))],
);

export const evidence = pgTable(
  "evidence",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .notNull()
      .references(() => questionnaireRuns.id, { onDelete: "cascade" }),
    answerId: uuid("answer_id").references(() => answers.id, { onDelete: "cascade" }),
    theme: text("theme").notNull(),
    explanation: text("explanation").notNull(),
    chunkId: uuid("chunk_id")
      .notNull()
      .references(() => documentChunks.id, { onDelete: "cascade" }),
    source: evidenceSource("source").notNull().default("rag"),
    createdAt: createdAt(),
  },
  (t) => [index("evidence_run_idx").on(t.runId)],
);

export const summaries = pgTable("summaries", {
  runId: uuid("run_id")
    .primaryKey()
    .references(() => questionnaireRuns.id, { onDelete: "cascade" }),
  json: jsonb("json").notNull(),
  createdAt: createdAt(),
});

export const waSessions = pgTable("wa_sessions", {
  instanceName: text("instance_name").primaryKey(),
  state: text("state").notNull(),
  phone: text("phone"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Rastro do agente: cada chamada de modelo e cada decisão (valor interpretado, indício, crise, convite, envio).
 * Fica no nosso banco, sem serviço externo de rastreio, porque as conversas são dados de saúde.
 * run_id e interview_id não têm chave estrangeira: o rastro sobrevive se o caso for apagado.
 */
export const agentEvents = pgTable(
  "agent_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    createdAt: createdAt(),
    runId: uuid("run_id"),
    interviewId: uuid("interview_id"),
    answerId: uuid("answer_id"),
    kind: text("kind").notNull(),
    outcome: text("outcome").notNull(),
    model: text("model"),
    tokensIn: integer("tokens_in"),
    tokensOut: integer("tokens_out"),
    costUsd: real("cost_usd"),
    latencyMs: integer("latency_ms"),
    detail: text("detail"),
  },
  (t) => [index("agent_events_run_idx").on(t.runId), index("agent_events_interview_idx").on(t.interviewId), index("agent_events_created_idx").on(t.createdAt)],
);
export type AgentEvent = typeof agentEvents.$inferSelect;

export type Contact = typeof contacts.$inferSelect;
export type QuestionnaireRun = typeof questionnaireRuns.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Answer = typeof answers.$inferSelect;
export type ScoreRow = typeof scores.$inferSelect;
export type EvidenceRow = typeof evidence.$inferSelect;
export type DocumentRow = typeof documents.$inferSelect;
export type DocumentChunkRow = typeof documentChunks.$inferSelect;
export type RunStatus = (typeof runStatus.enumValues)[number];
export type Severity = (typeof severity.enumValues)[number];
export type DocKind = (typeof docKind.enumValues)[number];
export type CaseState = (typeof caseState.enumValues)[number];

import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { questionnaireRuns } from "@/db/schema";
import { interviewSummaries, interviewTurns, interviews, type InterviewRow } from "@/db/schema-interview";
import type { InterviewSummary } from "./contract";
import type { InterviewState } from "./engine";
import type { Turn } from "./types";

/** db ou uma transação aberta com db.transaction. */
export type Executor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

export function transaction<T>(fn: (tx: Executor) => Promise<T>): Promise<T> {
  return db.transaction((tx) => fn(tx));
}

export async function createInterview(v: { runId: string | null; token: string; state: InterviewState; profile: string | null }): Promise<InterviewRow> {
  const [row] = await db
    .insert(interviews)
    .values({ runId: v.runId, token: v.token, status: v.state.status, mode: v.state.mode, agenda: v.state.agenda, state: v.state, interviewerProfile: v.profile })
    .returning();
  return row;
}

export async function getInterviewByToken(token: string): Promise<InterviewRow | null> {
  const [r] = await db.select().from(interviews).where(eq(interviews.token, token));
  return r ?? null;
}

export async function getInterview(id: string): Promise<InterviewRow | null> {
  const [r] = await db.select().from(interviews).where(eq(interviews.id, id));
  return r ?? null;
}

/** Lock otimista: só grava se o estado salvo ainda tem `expectedTurns` turnos. */
export async function saveState(id: string, state: InterviewState, expectedTurns: number, ex: Executor = db): Promise<boolean> {
  const rows = await ex
    .update(interviews)
    .set({
      state,
      status: state.status,
      startedAt: state.turns.length > 0 ? new Date(state.startedMs) : null,
      endedAt: state.endedMs ? new Date(state.endedMs) : null,
    })
    .where(and(eq(interviews.id, id), sql`jsonb_array_length(${interviews.state}->'turns') = ${expectedTurns}`))
    .returning({ id: interviews.id });
  return rows.length === 1;
}

export async function insertTurn(interviewId: string, turn: Turn & { audioPath?: string | null }, ex: Executor = db) {
  const [row] = await ex
    .insert(interviewTurns)
    .values({ interviewId, idx: turn.idx, speaker: turn.speaker, text: turn.text, blockId: turn.blockId, probeId: turn.probeId, audioPath: turn.audioPath ?? null, startedMs: turn.startedMs, durationMs: turn.durationMs })
    .returning();
  return row;
}

export async function listTurns(interviewId: string) {
  return db.select().from(interviewTurns).where(eq(interviewTurns.interviewId, interviewId)).orderBy(asc(interviewTurns.idx));
}

export async function getTurn(interviewId: string, idx: number) {
  const [t] = await db.select().from(interviewTurns).where(and(eq(interviewTurns.interviewId, interviewId), eq(interviewTurns.idx, idx)));
  return t ?? null;
}

export async function saveSummary(interviewId: string, summary: InterviewSummary) {
  await db.insert(interviewSummaries).values({ interviewId, json: summary }).onConflictDoUpdate({ target: interviewSummaries.interviewId, set: { json: summary } });
}

export async function getSummary(interviewId: string): Promise<InterviewSummary | null> {
  const [r] = await db.select().from(interviewSummaries).where(eq(interviewSummaries.interviewId, interviewId));
  return (r?.json as InterviewSummary) ?? null;
}

export async function listByRun(runId: string): Promise<InterviewRow[]> {
  return db.select().from(interviews).where(eq(interviews.runId, runId)).orderBy(desc(interviews.createdAt));
}

export async function markRunUrgency(runId: string, ex: Executor = db) {
  await ex.update(questionnaireRuns).set({ severity: "urgency" }).where(eq(questionnaireRuns.id, runId));
}

export async function setTurnAudio(interviewId: string, idx: number, audioPath: string) {
  await db.update(interviewTurns).set({ audioPath }).where(and(eq(interviewTurns.interviewId, interviewId), eq(interviewTurns.idx, idx)));
}

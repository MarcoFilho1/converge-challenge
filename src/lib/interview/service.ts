/**
 * Serviço da entrevista: liga motor (puro), banco (repo) e voz (VoiceProvider).
 * Cada turno é uma requisição; o estado inteiro vive em interviews.state (jsonb) com lock otimista.
 */
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getInterviewAi, type InterviewAi } from "@/lib/ai/interview";
import { scoreRun } from "@/lib/instruments";
import * as mvp1 from "@/lib/engine/repo";
import { db } from "@/db/client";
import { contacts, questionnaireRuns } from "@/db/schema";
import type { InterviewRow } from "@/db/schema-interview";
import { eq } from "drizzle-orm";
import { getOrGenerate, getVoice, toWav16k, voiceProfileName, VoiceUnavailable, type VoiceProvider } from "@/lib/voice";
import { fromQuestionnaireRun } from "./adapters/questionnaire";
import { BLOCK_LABELS, type InterviewDetail, type InterviewListItem, type InterviewView, type TurnResponse } from "./contract";
import { createState, isFinal, step, type InterviewEvent, type InterviewMode, type InterviewState, type Utterance } from "./engine";
import { FIXTURES, type FixtureName } from "./fixtures";
import { BLOCKS } from "./protocol";
import { formatOrigin } from "./origin";
import * as repo from "./repo";
import { buildSummary } from "./summary";
import type { BlockId } from "./types";

export class InterviewNotFound extends Error { name = "InterviewNotFound"; }
export class InterviewConflict extends Error { name = "InterviewConflict"; }
export class AudioInvalid extends Error { name = "AudioInvalid"; }
/** Voicebox não transcreveu: a tela deve cair para o modo texto. Nenhum turno é gravado. */
export class SttUnavailable extends Error { name = "SttUnavailable"; }

/** Pico do wav 16-bit abaixo de ~-44 dBFS = silêncio. */
export function isSilent(wav: Buffer, threshold = 200): boolean {
  const dataAt = wav.indexOf("data", 12);
  const start = dataAt >= 0 ? dataAt + 8 : 44;
  let peak = 0;
  for (let i = start; i + 1 < wav.length; i += 2) {
    const v = Math.abs(wav.readInt16LE(i));
    if (v > peak) { peak = v; if (peak >= threshold) return false; }
  }
  return true;
}

export type ServiceDeps = {
  voice?: VoiceProvider;
  ai?: InterviewAi;
  dataRoot?: string;
  profile?: string;
  now?: () => number;
  publicUrl?: () => string;
  mode?: () => InterviewMode;
  interviewerName?: () => string;
};

type AiAudio = { url: string | null; voice: TurnResponse["voice"]; path: string | null };

export function createInterviewService(deps: ServiceDeps = {}) {
  const voice = deps.voice ?? getVoice();
  const ai = deps.ai ?? getInterviewAi();
  const dataRoot = deps.dataRoot ?? join(process.cwd(), "data");
  const profile = deps.profile ?? voiceProfileName();
  const now = deps.now ?? (() => Date.now());
  const publicUrl = deps.publicUrl ?? (() => process.env.INTERVIEW_PUBLIC_URL ?? "http://localhost:3100");
  const mode = deps.mode ?? (() => (process.env.INTERVIEW_MODE === "cache_only" ? "cache_only" : "live"));
  const interviewerName = deps.interviewerName ?? (() => process.env.INTERVIEWER_NAME ?? "Helena");
  const cacheRoot = join(dataRoot, "voz");

  const stateOf = (row: InterviewRow) => row.state as InterviewState;
  const inviteUrl = (token: string) => `${publicUrl().replace(/\/$/, "")}/entrevista/${token}`;

  function blockInfo(state: InterviewState, blockId: BlockId) {
    const index = state.agenda.blocks.findIndex((b) => b.id === blockId);
    return { id: blockId, label: BLOCK_LABELS[blockId], index: index + 1, total: state.agenda.blocks.length };
  }

  function listItem(row: InterviewRow, hasSummary: boolean): InterviewListItem {
    const s = stateOf(row);
    return {
      id: row.id,
      status: row.status,
      startedAt: row.startedAt ? row.startedAt.toISOString() : null,
      durationMs: s.endedMs ? s.endedMs - s.startedMs : null,
      hasSummary,
      inviteUrl: inviteUrl(row.token),
    };
  }

  async function mustGet(token: string): Promise<InterviewRow> {
    const row = await repo.getInterviewByToken(token);
    if (!row) throw new InterviewNotFound("token_invalido");
    return row;
  }

  async function aiAudio(row: InterviewRow, say: Utterance, turnIdx: number): Promise<AiAudio> {
    try {
      if (say.cacheKey) {
        const path = await getOrGenerate(voice, profile, say.cacheKey, say.text, cacheRoot);
        return path ? { url: `/api/entrevista/${row.token}/fala/${turnIdx}`, voice: "cache", path } : { url: null, voice: "browser", path: null };
      }
      const out = await voice.tts(say.text);
      if (!out) return { url: null, voice: "browser", path: null };
      const dir = join(dataRoot, "entrevistas", row.id);
      mkdirSync(dir, { recursive: true });
      const path = join(dir, `ai-${turnIdx}-${randomBytes(4).toString("hex")}.wav`);
      writeFileSync(path, out.audio);
      return { url: `/api/entrevista/${row.token}/fala/${turnIdx}`, voice: "live", path };
    } catch (err) {
      if (err instanceof VoiceUnavailable) return { url: null, voice: "browser", path: null };
      throw err;
    }
  }

  /**
   * Aplica um evento. Ordem: motor → transação (lock otimista + turnos + urgência) → só então áudio da IA.
   * Quem perde a corrida não gera TTS nem deixa arquivo; o banco nunca fica com estado e turnos divergentes.
   */
  async function apply(row: InterviewRow, event: InterviewEvent, personAudioPath: string | null, heard: string | null): Promise<TurnResponse> {
    const before = stateOf(row);
    const nowMs = now();
    const { state, say } = await step(before, event, ai, nowMs);
    const newTurns = state.turns.slice(before.turns.length);
    const aiTurnIdx = state.turns.length - 1;

    try {
      await repo.transaction(async (tx) => {
        const ok = await repo.saveState(row.id, state, before.turns.length, tx);
        if (!ok) throw new InterviewConflict("estado_invalido");
        for (const t of newTurns) await repo.insertTurn(row.id, { ...t, audioPath: t.speaker === "person" ? personAudioPath : null }, tx);
        if (state.status === "crisis" && row.runId) await repo.markRunUrgency(row.runId, tx);
      });
    } catch (err) {
      if (personAudioPath) rmSync(personAudioPath, { force: true });
      throw err;
    }

    const audio = await aiAudio(row, say, aiTurnIdx);
    if (audio.path) await repo.setTurnAudio(row.id, aiTurnIdx, audio.path);
    if (isFinal(state.status)) await repo.saveSummary(row.id, await buildSummary(state, ai));

    const resp: TurnResponse = {
      status: state.status,
      heard,
      say: say.text,
      audioUrl: audio.url,
      voice: audio.voice,
      block: blockInfo(state, say.blockId),
      turnIndex: aiTurnIdx,
      elapsedMs: nowMs - state.startedMs,
      final: say.final,
    };
    if (state.status === "crisis") resp.crisis = { cvv: "188", samu: "192", doctorNotified: !!row.runId };
    return resp;
  }

  async function running(token: string): Promise<InterviewRow> {
    const row = await mustGet(token);
    if (row.status !== "running") throw new InterviewConflict("estado_invalido");
    return row;
  }

  return {
    async createInvite(runId: string | null, opts: { fixture?: FixtureName } = {}): Promise<InterviewListItem> {
      let input;
      if (runId) {
        const run = await mvp1.getRun(runId);
        if (!run) throw new InterviewNotFound("run_invalido");
        const answers = await mvp1.getAnswers(runId);
        const rows = await mvp1.getAnswerRows(runId);
        const open = Object.fromEntries(rows.filter((r) => r.instrument === "OPEN").map((r) => [r.itemCode, r.rawText])) as { OPEN_1?: string; OPEN_2?: string };
        input = fromQuestionnaireRun(run, answers, scoreRun(answers, run.demoShort), process.env.DOCTOR_NAME ?? "Dra. Ana Lima", open);
      } else {
        input = { ...FIXTURES[opts.fixture ?? "prioridade"], doctorName: process.env.DOCTOR_NAME ?? FIXTURES.prioridade.doctorName };
      }
      const state = createState(input, { mode: mode(), nowMs: now() });
      const row = await repo.createInterview({ runId, token: randomBytes(16).toString("hex"), state, profile });
      return listItem(row, false);
    },

    async viewByToken(token: string): Promise<InterviewView | null> {
      const row = await repo.getInterviewByToken(token);
      if (!row) return null;
      const s = stateOf(row);
      const lastAi = [...s.turns].reverse().find((t) => t.speaker === "ai");
      const lastAiRow = lastAi ? await repo.getTurn(row.id, lastAi.idx) : null;
      const audioUrl = lastAiRow?.audioPath ? `/api/entrevista/${token}/fala/${lastAi!.idx}` : null;
      return {
        id: row.id,
        status: row.status,
        interviewer: { name: interviewerName(), avatarUrl: "/entrevistadora.png" },
        doctorName: s.vars.medico,
        estimatedMinutes: 10,
        block: lastAi ? blockInfo(s, lastAi.blockId) : null,
        currentUtterance: lastAi ? { text: lastAi.text, audioUrl, voice: audioUrl ? "cache" : "browser" } : null,
        turnsCount: s.turns.length,
        elapsedMs: s.turns.length ? now() - s.startedMs : 0,
      };
    },

    async start(token: string, consent: boolean): Promise<TurnResponse> {
      const row = await mustGet(token);
      if (row.status !== "consent") throw new InterviewConflict("estado_invalido");
      // o relógio da entrevista começa agora, não na criação do convite
      const fresh: InterviewRow = { ...row, state: { ...stateOf(row), startedMs: now() } };
      return apply(fresh, { kind: "start", consent }, null, null);
    },

    async turn(token: string, input: { audio?: { buffer: Buffer; mime: string }; text?: string; clientMs?: number | null }): Promise<TurnResponse> {
      const row = await running(token);
      let text = input.text?.trim() ?? "";
      let audioPath: string | null = null;
      if (input.audio) {
        let wav: Buffer;
        try {
          wav = await toWav16k(input.audio.buffer, input.audio.mime);
        } catch (err) {
          throw new AudioInvalid(err instanceof Error ? err.message : "audio_invalido");
        }
        try {
          // áudio mudo: o Whisper inventa texto ("E aí E aí"); trata como "não ouvi" sem transcrever
          text = isSilent(wav) ? "" : (await voice.stt(wav, "audio/wav")).text;
        } catch (err) {
          if (err instanceof VoiceUnavailable) throw new SttUnavailable(err.message);
          throw err;
        }
        const dir = join(dataRoot, "entrevistas", row.id);
        mkdirSync(dir, { recursive: true });
        audioPath = join(dir, `${stateOf(row).turns.length}-${randomBytes(4).toString("hex")}.wav`);
        writeFileSync(audioPath, wav);
      }
      return apply(row, { kind: "speech", text, durationMs: input.clientMs ?? null }, audioPath, text);
    },

    async skip(token: string): Promise<TurnResponse> {
      return apply(await running(token), { kind: "skip" }, null, null);
    },

    async stop(token: string): Promise<TurnResponse> {
      return apply(await running(token), { kind: "stop" }, null, null);
    },

    async detail(id: string): Promise<InterviewDetail | null> {
      const row = await repo.getInterview(id);
      if (!row) return null;
      const s = stateOf(row);
      const turns = await repo.listTurns(id);
      const summary = await repo.getSummary(id);
      let contact: InterviewDetail["contact"] = null;
      let severity: InterviewDetail["severity"] = null;
      if (row.runId) {
        const [r] = await db
          .select({ name: contacts.name, sector: contacts.sector, severity: questionnaireRuns.severity })
          .from(questionnaireRuns)
          .innerJoin(contacts, eq(contacts.id, questionnaireRuns.contactId))
          .where(eq(questionnaireRuns.id, row.runId));
        if (r) { contact = { name: r.name, sector: r.sector }; severity = r.severity; }
      } else {
        severity = s.input.severity;
      }
      return {
        id: row.id,
        runId: row.runId,
        contact,
        severity,
        status: row.status,
        mode: s.mode,
        startedAt: row.startedAt ? row.startedAt.toISOString() : null,
        endedAt: row.endedAt ? row.endedAt.toISOString() : null,
        durationMs: s.endedMs ? s.endedMs - s.startedMs : null,
        blocks: s.agenda.blocks.map((b) => ({ id: b.id, label: BLOCKS[b.id].label, required: b.required })),
        turns: turns.map((t) => ({
          idx: t.idx,
          speaker: t.speaker as "ai" | "person",
          text: t.text,
          blockId: t.blockId as BlockId,
          startedMs: t.startedMs,
          durationMs: t.durationMs,
          audioUrl: t.speaker === "person" && t.audioPath ? `/api/medico/entrevista/${id}/audio/${t.idx}` : null,
        })),
        summary,
      };
    },

    async listForRun(runId: string): Promise<InterviewListItem[]> {
      const rows = await repo.listByRun(runId);
      return Promise.all(rows.map(async (r) => listItem(r, (await repo.getSummary(r.id)) !== null)));
    },

    async personAudioPath(id: string, idx: number): Promise<string | null> {
      const t = await repo.getTurn(id, idx);
      return t?.speaker === "person" && t.audioPath && existsSync(t.audioPath) ? t.audioPath : null;
    },

    async aiAudioPath(token: string, turnIdx: number): Promise<string | null> {
      const row = await repo.getInterviewByToken(token);
      if (!row) return null;
      const t = await repo.getTurn(row.id, turnIdx);
      return t?.speaker === "ai" && t.audioPath && existsSync(t.audioPath) ? t.audioPath : null;
    },

    formatOrigin,
  };
}

export type InterviewService = ReturnType<typeof createInterviewService>;

let defaultService: InterviewService | null = null;
export function getInterviewService(): InterviewService {
  return (defaultService ??= createInterviewService());
}

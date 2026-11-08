import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { pushSchemaToTestDb, truncateAll } from "../helpers/db";
import { createInterviewMock } from "@/lib/ai/interview-mock";
import { createNoVoice } from "@/lib/voice/none";
import { VoiceUnavailable, type VoiceProvider } from "@/lib/voice/types";
import { pcmToWav } from "@/lib/voice/elevenlabs";

process.env.INTERVIEW_PUBLIC_URL = "http://localhost:3100";

async function makeService(voice: VoiceProvider = createNoVoice()) {
  const { createInterviewService } = await import("@/lib/interview/service");
  return createInterviewService({ voice, ai: createInterviewMock(), dataRoot: mkdtempSync(join(tmpdir(), "ent-")), profile: "teste" });
}

async function makeRun() {
  const { db } = await import("@/db/client");
  const { contacts, questionnaireRuns, answers } = await import("@/db/schema");
  const [c] = await db.insert(contacts).values({ name: "Ana Teste", phoneE164: "5581999990009", sector: "Atendimento" }).returning();
  const [run] = await db.insert(questionnaireRuns).values({ contactId: c.id, severity: "priority", status: "done", demoShort: true }).returning();
  await db.insert(answers).values([
    { runId: run.id, instrument: "TRUNK", itemCode: "TRUNK", rawText: "sim", valueNumeric: 2 },
    { runId: run.id, instrument: "WPAI", itemCode: "WPAI_Q5", rawText: "7", valueNumeric: 7 },
    { runId: run.id, instrument: "OPEN", itemCode: "OPEN_1", rawText: "as metas", valueNumeric: null },
  ]);
  return run;
}

describe("serviço da entrevista", () => {
  beforeAll(() => pushSchemaToTestDb());
  beforeEach(async () => truncateAll());

  it("convite por fixture, start e turnos por texto", async () => {
    const svc = await makeService();
    const invite = await svc.createInvite(null, { fixture: "prioridade" });
    expect(invite.inviteUrl).toMatch(/^http:\/\/localhost:3100\/entrevista\/[0-9a-f]{32}$/);
    const token = invite.inviteUrl.split("/").pop()!;

    const view = await svc.viewByToken(token);
    expect(view).toMatchObject({ status: "consent", interviewer: { name: expect.any(String) }, block: null, currentUtterance: null });

    const started = await svc.start(token, true);
    expect(started).toMatchObject({ status: "running", voice: "browser", audioUrl: null, turnIndex: 0, final: false });
    expect(started.say).toContain("Dra. Ana Lima");

    const t1 = await svc.turn(token, { text: "pode sim" });
    expect(t1.heard).toBe("pode sim");
    expect(t1.turnIndex).toBe(2);
    expect(t1.block.id).toBe("saude");

    const after = await svc.viewByToken(token);
    expect(after?.turnsCount).toBe(3);
    expect(after?.currentUtterance?.text).toBe(t1.say);

    const stopped = await svc.stop(token);
    expect(stopped.status).toBe("stopped");
    expect(stopped.final).toBe(true);
    const detail = await svc.detail(after!.id);
    expect(detail?.summary).not.toBeNull();
    expect(detail?.turns.map((t) => t.speaker)).toEqual(["ai", "person", "ai", "ai"]);

    const { InterviewConflict } = await import("@/lib/interview/service");
    await expect(svc.turn(token, { text: "oi" })).rejects.toBeInstanceOf(InterviewConflict);
  });

  it("convite ligado a um run real; crise marca urgência no run e lista por run", async () => {
    const svc = await makeService();
    const run = await makeRun();
    const invite = await svc.createInvite(run.id);
    const token = invite.inviteUrl.split("/").pop()!;
    expect((await svc.listForRun(run.id)).map((i) => i.id)).toEqual([invite.id]);

    await svc.start(token, true);
    const r = await svc.turn(token, { text: "não aguento mais, quero me matar" });
    expect(r.status).toBe("crisis");
    expect(r.crisis).toMatchObject({ cvv: "188", samu: "192" });

    const { db } = await import("@/db/client");
    const { questionnaireRuns } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    const [after] = await db.select().from(questionnaireRuns).where(eq(questionnaireRuns.id, run.id));
    expect(after.severity).toBe("urgency");

    const detail = await svc.detail(invite.id);
    expect(detail?.contact?.name).toBe("Ana Teste");
    expect(detail?.severity).toBe("urgency");
    expect(detail?.summary?.sinais_de_alerta.risco).toBe(true);
  });

  it("token inválido e estado inválido", async () => {
    const svc = await makeService();
    const { InterviewNotFound, InterviewConflict } = await import("@/lib/interview/service");
    expect(await svc.viewByToken("nope")).toBeNull();
    await expect(svc.start("nope", true)).rejects.toBeInstanceOf(InterviewNotFound);
    const invite = await svc.createInvite(null, { fixture: "atencao" });
    const token = invite.inviteUrl.split("/").pop()!;
    await expect(svc.turn(token, { text: "oi" })).rejects.toBeInstanceOf(InterviewConflict);
  });

  it("voz que falha no tts não quebra o turno; voz que funciona grava áudio e dá URL", async () => {
    const failing: VoiceProvider = { async tts() { throw new VoiceUnavailable("fora"); }, async stt() { throw new VoiceUnavailable("fora"); }, async health() { return false; } };
    const svc1 = await makeService(failing);
    const i1 = await svc1.createInvite(null, { fixture: "atencao" });
    const tok1 = i1.inviteUrl.split("/").pop()!;
    const s1 = await svc1.start(tok1, true);
    expect(s1.audioUrl).toBeNull();
    expect(s1.voice).toBe("browser");

    const working: VoiceProvider = {
      async tts() { return { audio: pcmToWav(Buffer.alloc(480), 24000), mime: "audio/wav" }; },
      async stt() { return { text: "cansaço há dois meses", ms: 10 }; },
      async health() { return true; },
    };
    const svc2 = await makeService(working);
    const i2 = await svc2.createInvite(null, { fixture: "prioridade" });
    const tok2 = i2.inviteUrl.split("/").pop()!;
    const s2 = await svc2.start(tok2, true);
    expect(s2.audioUrl).toBe(`/api/entrevista/${tok2}/fala/0`);
    expect(s2.voice).toBe("cache");
    expect(await svc2.aiAudioPath(tok2, 0)).toBeTruthy();

    // áudio da pessoa já em wav 16k passa sem ffmpeg
    const wav16k = Buffer.alloc(100);
    wav16k.write("RIFF", 0); wav16k.write("WAVE", 8); wav16k.writeUInt16LE(1, 22); wav16k.writeUInt32LE(16000, 24);
    for (let i = 44; i + 1 < wav16k.length; i += 2) wav16k.writeInt16LE(i % 4 ? 3000 : -3000, i); // som, não silêncio
    const t = await svc2.turn(tok2, { audio: { buffer: wav16k, mime: "audio/wav" }, clientMs: 2500 });
    expect(t.heard).toBe("cansaço há dois meses");
    expect(await svc2.personAudioPath(i2.id, 1)).toBeTruthy();
    expect(t.voice).toBe("cache"); // saindo da abertura não há acolhimento gerado
    const t2 = await svc2.turn(tok2, { audio: { buffer: wav16k, mime: "audio/wav" } });
    expect(t2.voice).toBe("live"); // acolhimento + pergunta = fala nova, TTS ao vivo
    expect(t2.audioUrl).toBe(`/api/entrevista/${tok2}/fala/${t2.turnIndex}`);
  });
});

describe("som de escuta enquanto a Helena pensa", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("devolve um áudio curto de escuta, gerado uma vez e depois do cache; token inválido não tem som", async () => {
    let calls = 0;
    const voice: VoiceProvider = {
      async tts() {
        calls++;
        return { audio: pcmToWav(Buffer.alloc(480), 24000), mime: "audio/wav" };
      },
      async stt() {
        return { text: "", ms: 0 };
      },
      async health() {
        return true;
      },
    };
    const svc = await makeService(voice);
    const run = await makeRun();
    const token = (await svc.createInvite(run.id)).inviteUrl.split("/").pop()!;
    const a = await svc.listeningCuePath(token, 0);
    const b = await svc.listeningCuePath(token, 0);
    expect(a).toBeTruthy();
    expect(b).toBe(a);
    expect(calls).toBe(1);
    expect(await svc.listeningCuePath(token, 7)).toBeTruthy();
    expect(await svc.listeningCuePath("nao-existe", 0)).toBeNull();
  });

  it("sem voz configurada, não há som de escuta", async () => {
    const svc = await makeService();
    const run = await makeRun();
    const token = (await svc.createInvite(run.id)).inviteUrl.split("/").pop()!;
    expect(await svc.listeningCuePath(token, 0)).toBeNull();
  });
});

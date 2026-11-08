/** Reação + pergunta viram dois áudios: a pergunta vem do cache, só a reação é gerada. Economiza a cota da voz. */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { pushSchemaToTestDb, truncateAll } from "../helpers/db";
import { concatWav } from "@/lib/voice/convert";
import { pcmToWav } from "@/lib/voice/elevenlabs";
import { createInterviewMock } from "@/lib/ai/interview-mock";
import { createState, step } from "@/lib/interview/engine";
import { FIXTURES } from "@/lib/interview/fixtures";
import { ACK_PHRASES } from "@/lib/interview/protocol";
import type { VoiceProvider } from "@/lib/voice/types";

describe("concatWav", () => {
  it("junta o PCM e refaz o cabeçalho", () => {
    const a = pcmToWav(Buffer.alloc(100, 1), 24000), b = pcmToWav(Buffer.alloc(60, 2), 24000);
    const c = concatWav([a, b]);
    expect(c.readUInt32LE(40)).toBe(160);
    expect(c.readUInt32LE(24)).toBe(24000);
    expect(c.length).toBe(44 + 160);
  });
});

describe("motor separa reação e pergunta", () => {
  it("fala com reação traz duas partes; a pergunta tem chave de cache", async () => {
    const ai = createInterviewMock();
    let r = await step(createState(FIXTURES.prioridade, { mode: "live", nowMs: 0 }), { kind: "start", consent: true }, ai, 0);
    r = await step(r.state, { kind: "speech", text: "pode", durationMs: 1 }, ai, 1000);
    r = await step(r.state, { kind: "speech", text: "um cansaço grande", durationMs: 1 }, ai, 2000);
    expect(r.say.parts).toHaveLength(2);
    expect(ACK_PHRASES).toContain(r.say.parts![0].text);
    expect(r.say.parts![1].cacheKey).toBe(`saude:${r.say.probeId}`);
    expect(r.say.text).toBe(`${r.say.parts![0].text} ${r.say.parts![1].text}`);
  });
});

describe("serviço gera só o que falta", () => {
  beforeAll(() => pushSchemaToTestDb());
  beforeEach(async () => truncateAll());

  it("depois do primeiro uso, reação fixa + pergunta não chamam a voz de novo", async () => {
    const spoken: string[] = [];
    const voice: VoiceProvider = {
      async tts(text) { spoken.push(text); return { audio: pcmToWav(Buffer.alloc(480), 24000), mime: "audio/wav" }; },
      async stt() { return { text: "", ms: 0 }; },
      async health() { return true; },
    };
    const { createInterviewService } = await import("@/lib/interview/service");
    const svc = createInterviewService({ voice, ai: createInterviewMock(), dataRoot: mkdtempSync(join(tmpdir(), "ent-")), profile: "t" });
    const run = async () => {
      const inv = await svc.createInvite(null, { fixture: "prioridade" });
      const token = inv.inviteUrl.split("/").pop()!;
      await svc.start(token, true);
      await svc.turn(token, { text: "pode" });
      return svc.turn(token, { text: "um cansaço grande" });
    };
    const first = await run();
    expect(first.audioUrl).toBeTruthy();
    // nunca gera reação + pergunta numa fala só
    expect(spoken.some((t) => ACK_PHRASES.some((a) => t.startsWith(a + " ")))).toBe(false);
    expect(spoken.some((t) => ACK_PHRASES.includes(t))).toBe(true);
    const before = spoken.length;
    await run(); // mesma entrevista de novo: tudo do cache
    expect(spoken.length).toBe(before);
  });
});

describe("créditos da voz acabaram no meio da entrevista", () => {
  beforeAll(() => pushSchemaToTestDb());
  beforeEach(async () => truncateAll());

  it("reação gerada que falha vira reação gravada; a pergunta sai do cache e nunca cai na voz do navegador", async () => {
    const { VoiceUnavailable } = await import("@/lib/voice/types");
    const { getOrGenerate } = await import("@/lib/voice/cache");
    const root = mkdtempSync(join(tmpdir(), "ent-"));
    let quotaOver = false;
    const voice: VoiceProvider = {
      async tts() {
        if (quotaOver) throw new VoiceUnavailable("quota_exceeded");
        return { audio: pcmToWav(Buffer.alloc(480), 24000), mime: "audio/wav" };
      },
      async stt() { return { text: "", ms: 0 }; },
      async health() { return true; },
    };
    // pré-gravado: perguntas e reações fixas
    for (const a of ACK_PHRASES) await getOrGenerate(voice, "t", `ack:${a}`, a, join(root, "voz"));
    const { BLOCKS, renderText, DEFAULT_PRAZO } = await import("@/lib/interview/protocol");
    const vars = { medico: process.env.DOCTOR_NAME ?? "Dra. Ana Lima", prazo: DEFAULT_PRAZO };
    for (const b of Object.values(BLOCKS)) {
      await getOrGenerate(voice, "t", `${b.id}:base`, renderText(b.base, vars), join(root, "voz"));
      for (const pr of b.probes) await getOrGenerate(voice, "t", `${b.id}:${pr.id}`, pr.text, join(root, "voz"));
    }
    const { createInterviewService } = await import("@/lib/interview/service");
    const { createInterviewMock } = await import("@/lib/ai/interview-mock");
    const base = createInterviewMock();
    // IA que gera reação nova (não gravada)
    const ai = { ...base, phraseAck: async () => "Entendi, o cansaço piora no fim do expediente." };
    const svc = createInterviewService({ voice, ai, dataRoot: root, profile: "t" });
    const inv = await svc.createInvite(null, { fixture: "prioridade" });
    const token = inv.inviteUrl.split("/").pop()!;
    await svc.start(token, true);
    await svc.turn(token, { text: "pode" }); // grava a pergunta-base de saúde no cache
    await svc.turn(token, { text: "um cansaço grande" }); // grava a sonda seguinte
    quotaOver = true;
    const r = await svc.turn(token, { text: "piora no fim do dia" });
    expect(r.voice).not.toBe("browser");
    expect(r.audioUrl).toBeTruthy();
  });
});

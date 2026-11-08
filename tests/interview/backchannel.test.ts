/** A Helena reage como numa conversa: concorda, responde "você entendeu?", e repete quando pedem. */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { pushSchemaToTestDb, truncateAll } from "../helpers/db";
import { createInterviewMock } from "@/lib/ai/interview-mock";
import { createState, step, type InterviewState } from "@/lib/interview/engine";
import { FIXTURES } from "@/lib/interview/fixtures";
import { BLOCKS, REPEAT_PREFIX } from "@/lib/interview/protocol";
import { hasAdvice } from "@/lib/interview/filters";
import { assertNoForbidden } from "@/lib/ai/forbidden-terms";
import type { VoiceProvider } from "@/lib/voice/types";

const ai = createInterviewMock();
const speak = (s: InterviewState, text: string, at = 10_000) => step(s, { kind: "speech", text, durationMs: 1000 }, ai, at);
async function inSaude() {
  let r = await step(createState(FIXTURES.prioridade, { mode: "live", nowMs: 0 }), { kind: "start", consent: true }, ai, 0);
  r = await speak(r.state, "pode");
  return r;
}

describe("sinais de escuta", () => {
  it("pergunta para a Helena no fim da fala → ela responde antes de seguir", async () => {
    const r = await inSaude();
    const out = await speak(r.state, "ando muito cansada há uns três meses, você entendeu?");
    expect(out.say.text).toMatch(/^Entendi sim, não se preocupa\. /);
    expect(out.state.findings).toHaveLength(1);
  });

  it("acolhimentos variam e soam falados", async () => {
    const acks = new Set<string>();
    for (const t of ["cansaço todo dia", "dor de cabeça há semanas", "não durmo direito", "fico irritada fácil", "sinto um aperto no peito"]) {
      acks.add(await ai.phraseAck({ lastText: t, findings: [{ tema: "sintoma", texto: t, duracao: null, intensidade: null, mencionaTrabalho: false, pediuParar: false }], probeText: "Desde quando?" }));
    }
    expect(acks.size).toBeGreaterThanOrEqual(3);
    for (const a of acks) { expect(assertNoForbidden(a)).toEqual([]); expect(hasAdvice(a)).toBe(false); }
  });

  it.each(["pode repetir?", "como assim?", "não entendi a pergunta"])("'%s' → pergunta de outro jeito, sem aviso", async (frase) => {
    const r = await inSaude();
    const out = await speak(r.state, frase);
    expect(out.say.text).toBe(BLOCKS.saude.rephrase);
    expect(out.state.avisos).toHaveLength(0);
    expect(out.state.findings).toHaveLength(0);
  });

  it("pedido de repetir depois da segunda forma repete a pergunta original", async () => {
    let r = await inSaude();
    r = await speak(r.state, "como assim?");
    r = await speak(r.state, "pode repetir?");
    expect(r.say.text).toBe(REPEAT_PREFIX.replace("Não consegui ouvir bem. ", "Claro. ") + BLOCKS.saude.base);
    expect(r.state.avisos).toHaveLength(0);
  });
});

describe("áudio mudo não vira resposta inventada", () => {
  beforeAll(() => pushSchemaToTestDb());
  beforeEach(async () => truncateAll());

  it("silêncio não chama o Whisper e a Helena diz que não ouviu", async () => {
    const calls = { stt: 0 };
    const voice: VoiceProvider = { async tts() { return null; }, async stt() { calls.stt++; return { text: "E aí E aí", ms: 1 }; }, async health() { return true; } };
    const { createInterviewService } = await import("@/lib/interview/service");
    const svc = createInterviewService({ voice, ai, dataRoot: mkdtempSync(join(tmpdir(), "ent-")), profile: "t" });
    const inv = await svc.createInvite(null, { fixture: "prioridade" });
    const token = inv.inviteUrl.split("/").pop()!;
    await svc.start(token, true);
    const silence = Buffer.alloc(44 + 32000); // 1 s de wav 16 kHz mono zerado
    silence.write("RIFF", 0); silence.write("WAVE", 8); silence.write("fmt ", 12); silence.writeUInt32LE(16, 16); silence.writeUInt16LE(1, 20); silence.writeUInt16LE(1, 22); silence.writeUInt32LE(16000, 24); silence.writeUInt32LE(32000, 28); silence.writeUInt16LE(2, 32); silence.writeUInt16LE(16, 34); silence.write("data", 36); silence.writeUInt32LE(32000, 40);
    const r = await svc.turn(token, { audio: { buffer: silence, mime: "audio/wav" } });
    expect(calls.stt).toBe(0);
    expect(r.heard).toBe("");
    expect(r.say.startsWith(REPEAT_PREFIX)).toBe(true);
  });
});

describe("áudio vazio (botão Pronto sem gravação) não é erro", () => {
  beforeAll(() => pushSchemaToTestDb());
  beforeEach(async () => truncateAll());
  it("vira 'não consegui ouvir' em vez de audio_invalido", async () => {
    const voice: VoiceProvider = { async tts() { return null; }, async stt() { throw new Error("não deveria chamar"); }, async health() { return true; } };
    const { createInterviewService } = await import("@/lib/interview/service");
    const svc = createInterviewService({ voice, ai, dataRoot: mkdtempSync(join(tmpdir(), "ent-")), profile: "t" });
    const inv = await svc.createInvite(null, { fixture: "prioridade" });
    const token = inv.inviteUrl.split("/").pop()!;
    await svc.start(token, true);
    const r = await svc.turn(token, { audio: { buffer: Buffer.alloc(0), mime: "audio/webm" } });
    expect(r.heard).toBe("");
    expect(r.say.startsWith(REPEAT_PREFIX)).toBe(true);
  });
});

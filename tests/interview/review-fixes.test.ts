/** Testes das correções da revisão final da branch (cada um falhou antes da correção). */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { pushSchemaToTestDb, truncateAll } from "../helpers/db";
import { createInterviewMock } from "@/lib/ai/interview-mock";
import { createState, isFinal, step, type InterviewState } from "@/lib/interview/engine";
import { FIXTURES } from "@/lib/interview/fixtures";
import { REPEAT_PREFIX } from "@/lib/interview/protocol";
import { buildSummary, validateSummary } from "@/lib/interview/summary";
import { VoiceUnavailable, type VoiceProvider } from "@/lib/voice/types";

const ai = createInterviewMock();
const speak = (s: InterviewState, text: string, at = 10_000) => step(s, { kind: "speech", text, durationMs: 1000 }, ai, at);
async function startAt(fx = FIXTURES.prioridade) {
  return step(createState(fx, { mode: "live", nowMs: 0 }), { kind: "start", consent: true }, ai, 0);
}
async function untilSafety(fx = FIXTURES.semIndicio) {
  let r = await startAt(fx);
  let t = 0;
  while (r.say.blockId !== "seguranca" && t++ < 20) r = await speak(r.state, "nada demais", t * 1000);
  expect(r.say.blockId).toBe("seguranca");
  return r;
}

describe("C1: rotas sem runtime incompatível com cacheComponents", () => {
  it("nenhum route.ts da entrevista exporta runtime", () => {
    const files = execFileSync("find", ["src/app/api/entrevista", "src/app/api/medico", "-name", "route.ts"]).toString().trim().split("\n");
    expect(files.length).toBeGreaterThanOrEqual(10);
    for (const f of files) expect(readFileSync(f, "utf8"), f).not.toMatch(/export const runtime/);
  });
});

describe("C2: 'parar' no meio da frase não encerra", () => {
  it.each(["não consigo parar nem pra almoçar", "quando chega o fechamento piora", "não consigo encerrar o dia"])("%s", async (frase) => {
    const [f] = await ai.extractFindings({ blockId: "trabalho", probeText: "", text: frase });
    expect(f.pediuParar).toBe(false);
  });
  it.each(["quero parar", "prefiro encerrar aqui", "não quero mais falar", "chega por hoje", "parar"])("intenção clara: %s", async (frase) => {
    const [f] = await ai.extractFindings({ blockId: "saude", probeText: "", text: frase });
    expect(f.pediuParar).toBe(true);
  });
});

describe("I3 (revisto pelo Marco): segurança ambígua pergunta de novo, não vira crise direto", () => {
  it.each(["não", "não, nada disso", "nunca"])("negação clara segue: %s", async (frase) => {
    const r = await untilSafety();
    const out = await speak(r.state, frase, 60_000);
    expect(out.state.status).toBe("done");
  });
});

describe("I4: segurança pulada deixa rastro", () => {
  it("skip na segurança → nao_respondido e risco sem falso 'tudo bem'", async () => {
    const r = await untilSafety();
    const out = await step(r.state, { kind: "skip" }, ai, 60_000);
    expect(out.state.skipped).toContain("seguranca");
    const s = await buildSummary(out.state, ai);
    expect(s.nao_respondido.some((x) => /seguran/i.test(x))).toBe(true);
  });
});

describe("I5: repetição usa a pergunta fixa, não o acolhimento", () => {
  it("live: repete só a sonda", async () => {
    let r = await startAt();
    r = await speak(r.state, "pode");
    r = await speak(r.state, "um cansaço grande");
    expect(r.say.text.startsWith("Entendi. ")).toBe(true);
    const probeOnly = r.say.text.replace(/^Entendi\. /, "");
    const fakeAck = { ...r.state, turns: r.state.turns.map((t, i) => (i === r.state.turns.length - 1 ? { ...t, text: "Entendi, o cansaço é grande. " + probeOnly } : t)) };
    const rep = await speak(fakeAck, "");
    expect(rep.say.text).toBe(REPEAT_PREFIX + probeOnly);
  });
});

describe("I8: risco do LLM sem origem não passa", () => {
  it("risco true sem origem válida vira false", () => {
    const s = validateSummary({
      dificuldades_relatadas: [], impacto_no_trabalho: [], fatores_do_trabalho: [], barreiras_atendimento: [],
      sinais_de_alerta: { risco: true, origem: [] }, pontos_para_avaliacao: [], nao_respondido: [],
    }, [{ idx: 0, speaker: "ai", text: "x", blockId: "saude", probeId: null, startedMs: 0, durationMs: null }]);
    expect(s.sinais_de_alerta.risco).toBe(false);
  });
});

describe("I11: áudio de pessoa nunca vai para o git", () => {
  it("data/ está no .gitignore", () => {
    expect(() => execFileSync("git", ["check-ignore", "-q", "data/entrevistas/x/1.wav"])).not.toThrow();
  });
});

describe("serviço: lock, transação, STT fora", () => {
  beforeAll(() => pushSchemaToTestDb());
  beforeEach(async () => truncateAll());

  const wav16k = () => { const b = Buffer.alloc(100); b.write("RIFF", 0); b.write("WAVE", 8); b.writeUInt16LE(1, 22); b.writeUInt32LE(16000, 24); return b; };

  async function svcWith(voice: VoiceProvider, root = mkdtempSync(join(tmpdir(), "ent-"))) {
    const { createInterviewService } = await import("@/lib/interview/service");
    return { svc: createInterviewService({ voice, ai, dataRoot: root, profile: "t" }), root };
  }

  it("I6: turnos simultâneos geram a fala da IA uma vez só (áudio depois do lock) e não deixam áudio órfão", async () => {
    const calls = { n: 0 };
    const voice: VoiceProvider = {
      async tts() { calls.n++; await new Promise((r) => setTimeout(r, 30)); return { audio: Buffer.from("RIFFxxxxWAVEfmt "), mime: "audio/wav" }; },
      async stt() { return { text: "pode", ms: 1 }; },
      async health() { return true; },
    };
    const { svc, root } = await svcWith(voice);
    const inv = await svc.createInvite(null, { fixture: "prioridade" });
    const token = inv.inviteUrl.split("/").pop()!;
    await svc.start(token, true);
    const before = calls.n;
    const results = await Promise.allSettled([
      svc.turn(token, { audio: { buffer: wav16k(), mime: "audio/wav" } }),
      svc.turn(token, { audio: { buffer: wav16k(), mime: "audio/wav" } }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(calls.n - before).toBe(1);
    const personWavs = readdirSync(join(root, "entrevistas", inv.id)).filter((f) => !f.startsWith("ai-"));
    expect(personWavs).toHaveLength(1);
  });

  it("I7: falha ao gravar turno não deixa o estado andar sozinho", async () => {
    const { createNoVoice } = await import("@/lib/voice/none");
    const { svc } = await svcWith(createNoVoice());
    const inv = await svc.createInvite(null, { fixture: "prioridade" });
    const token = inv.inviteUrl.split("/").pop()!;
    await svc.start(token, true);
    const repo = await import("@/lib/interview/repo");
    await repo.insertTurn(inv.id, { idx: 1, speaker: "person", text: "intruso", blockId: "abertura", probeId: null, startedMs: 0, durationMs: null });
    await expect(svc.turn(token, { text: "pode" })).rejects.toThrow();
    expect((await svc.viewByToken(token))?.turnsCount).toBe(1);
  });

  it("I9: STT fora do ar → erro stt_indisponivel, sem turno gravado", async () => {
    const voice: VoiceProvider = { async tts() { return null; }, async stt() { throw new VoiceUnavailable("fora"); }, async health() { return false; } };
    const { svc } = await svcWith(voice);
    const { SttUnavailable } = await import("@/lib/interview/service");
    const inv = await svc.createInvite(null, { fixture: "prioridade" });
    const token = inv.inviteUrl.split("/").pop()!;
    await svc.start(token, true);
    await expect(svc.turn(token, { audio: { buffer: wav16k(), mime: "audio/wav" } })).rejects.toBeInstanceOf(SttUnavailable);
    expect((await svc.viewByToken(token))?.turnsCount).toBe(1);
  });
});

describe("I9 na rota: 503", () => {
  it("errorResponse mapeia SttUnavailable para 503 stt_indisponivel", async () => {
    const { errorResponse } = await import("@/lib/interview/http");
    const { SttUnavailable } = await import("@/lib/interview/service");
    const res = errorResponse(new SttUnavailable("x"));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "stt_indisponivel" });
  });
});

void isFinal;

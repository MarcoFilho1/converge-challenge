import { describe, expect, it } from "vitest";
import { createInterviewMock } from "@/lib/ai/interview-mock";
import { createState, isFinal, step, type InterviewState } from "@/lib/interview/engine";
import { FIXTURES } from "@/lib/interview/fixtures";
import { REPEAT_PREFIX } from "@/lib/interview/protocol";

const ai = createInterviewMock();
const T0 = 1_000_000;

async function start(fixture = FIXTURES.prioridade, mode: "live" | "cache_only" = "live") {
  const s0 = createState(fixture, { mode, nowMs: T0 });
  return step(s0, { kind: "start", consent: true }, ai, T0);
}
const speak = (s: InterviewState, text: string, at = T0 + 10_000) => step(s, { kind: "speech", text, durationMs: 3000 }, ai, at);
const personTurns = (s: InterviewState) => s.turns.filter((t) => t.speaker === "person").length;

describe("motor de turnos", () => {
  it("(a) start fala a abertura com o nome do médico e fica running", async () => {
    const { state, say } = await start();
    expect(state.status).toBe("running");
    expect(say.text).toContain("Dra. Ana Lima");
    expect(say.blockId).toBe("abertura");
    expect(say.final).toBe(false);
    expect(state.turns).toHaveLength(1);
  });

  it("(b) urgência no questionário não entrevista", async () => {
    const { state, say } = await start({ ...FIXTURES.prioridade, severity: "urgency" });
    expect(state.status).toBe("crisis");
    expect(say.final).toBe(true);
    expect(say.text).toContain("188");
  });

  it("(c) frase de risco corta em crise", async () => {
    const s1 = await start();
    const { state, say } = await speak(s1.state, "não aguento mais, quero me matar");
    expect(state.status).toBe("crisis");
    expect(say.crisis).toBe(true);
    expect(say.text).toContain("188");
    expect(say.final).toBe(true);
    expect(isFinal(state.status)).toBe(true);
  });

  it("(d) 'sim' no bloco de segurança corta em crise", async () => {
    let r = await start(FIXTURES.semIndicio);
    // sem indício: pode começar → saude (confirmação) → trabalho → barreiras → seguranca
    const answers = ["pode", "nada demais", "tranquilo", "nada", "não precisei", "um pouco", "tanto faz", "não", "nada", "não sei"];
    for (const a of answers) {
      r = await speak(r.state, a);
      if (r.say.blockId === "seguranca") break;
    }
    expect(r.say.blockId).toBe("seguranca");
    r = await speak(r.state, "sim");
    expect(r.state.status).toBe("crisis");
  });

  it("(e) fala vazia repete a pergunta uma vez, depois segue", async () => {
    let r = await start();
    r = await speak(r.state, "pode");
    const asked = r.say.text;
    r = await speak(r.state, "");
    expect(r.say.text.startsWith(REPEAT_PREFIX)).toBe(true);
    expect(r.say.text).toContain(asked.split(" ").slice(-3).join(" "));
    r = await speak(r.state, "   ");
    expect(r.say.text.startsWith(REPEAT_PREFIX)).toBe(false);
    expect(r.state.status).toBe("running");
  });

  it("(f) entrevista inteira termina em done com achados e dentro do teto", async () => {
    let r = await start();
    const byBlock: Record<string, string> = {
      abertura: "pode sim",
      saude: "um cansaço grande há uns três meses, pior no fim do dia; já fui ao médico",
      trabalho: "muita meta e hora extra no fechamento, meu chefe cobra muito",
      barreiras: "não tenho tempo e tenho medo da empresa saber",
      seguranca: "não, nada disso",
    };
    let guard = 0;
    while (!isFinal(r.state.status) && guard++ < 30) {
      r = await speak(r.state, byBlock[r.say.blockId] ?? "não sei");
    }
    expect(r.state.status).toBe("done");
    expect(r.say.blockId).toBe("fechamento");
    expect(r.say.final).toBe(true);
    expect(personTurns(r.state)).toBeLessThanOrEqual(12);
    expect(r.state.findings.length).toBeGreaterThanOrEqual(3);
    const blocksVisited = new Set(r.state.turns.map((t) => t.blockId));
    expect(blocksVisited).toContain("seguranca");
  });

  it("(g) pedido de parar leva ao fechamento como stopped", async () => {
    let r = await start();
    r = await speak(r.state, "pode");
    r = await speak(r.state, "quero parar, por favor");
    expect(r.state.status).toBe("stopped");
    expect(r.say.blockId).toBe("fechamento");
    expect(r.say.final).toBe(true);
  });

  it("stop e consentimento negado encerram", async () => {
    const r = await start();
    const stopped = await step(r.state, { kind: "stop" }, ai, T0);
    expect(stopped.state.status).toBe("stopped");
    const s0 = createState(FIXTURES.prioridade, { mode: "live", nowMs: T0 });
    const declined = await step(s0, { kind: "start", consent: false }, ai, T0);
    expect(declined.state.status).toBe("stopped");
    expect(declined.say.final).toBe(true);
  });

  it("(h) cache_only nunca gera texto fora do cache", async () => {
    let r = await start(FIXTURES.prioridade, "cache_only");
    expect(r.say.cacheKey).not.toBeNull();
    for (const a of ["pode", "cansaço há meses", "muita meta", "sem tempo", "não"]) {
      r = await speak(r.state, a);
      expect(r.say.cacheKey, r.say.text).not.toBeNull();
      if (isFinal(r.state.status)) break;
    }
  });

  it("live mode junta acolhimento + pergunta e marca cacheKey nulo", async () => {
    let r = await start();
    r = await speak(r.state, "pode");
    r = await speak(r.state, "cansaço há três meses");
    expect(r.say.text.startsWith("Entendi. ")).toBe(true);
    expect(r.say.cacheKey).toBeNull();
  });

  it("(i) teto de 12 turnos da pessoa força o fechamento", async () => {
    let r = await start();
    let n = 0;
    while (!isFinal(r.state.status) && n < 20) {
      r = await speak(r.state, `resposta ${n}`);
      n++;
    }
    expect(personTurns(r.state)).toBeLessThanOrEqual(12);
    expect(["done", "stopped"]).toContain(r.state.status);
  });

  it("teto de 15 minutos força o fechamento", async () => {
    let r = await start();
    r = await speak(r.state, "pode", T0 + 5_000);
    r = await speak(r.state, "cansaço", T0 + 16 * 60_000);
    expect(r.say.blockId).toBe("seguranca");
    r = await speak(r.state, "não", T0 + 17 * 60_000);
    expect(r.say.blockId).toBe("fechamento");
    expect(r.state.status).toBe("done");
  });

  it("skip pula a pergunta atual sem extrair", async () => {
    let r = await start();
    r = await speak(r.state, "pode");
    const before = r.state.findings.length;
    const skipped = await step(r.state, { kind: "skip" }, ai, T0 + 20_000);
    expect(skipped.state.findings.length).toBe(before);
    expect(skipped.state.turns.at(-1)?.speaker).toBe("ai");
    expect(skipped.say.text).not.toBe(r.say.text);
  });

  it("skip em todo o bloco de saúde marca o bloco como não respondido", async () => {
    let r = await start();
    r = await speak(r.state, "pode");
    let guard = 0;
    while (r.say.blockId === "saude" && guard++ < 10) r = await step(r.state, { kind: "skip" }, ai, T0 + 30_000);
    expect(r.state.skipped).toContain("saude");
  });
});

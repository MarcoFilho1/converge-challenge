/** "Não sei", "às vezes", recusa: a Helena pergunta de outro jeito; na segunda vez vira aviso no relatório. */
import { describe, expect, it } from "vitest";
import { createInterviewMock } from "@/lib/ai/interview-mock";
import { createState, step, type InterviewState } from "@/lib/interview/engine";
import { FIXTURES } from "@/lib/interview/fixtures";
import { BLOCKS } from "@/lib/interview/protocol";
import { buildSummary } from "@/lib/interview/summary";
import { assertNoForbidden } from "@/lib/ai/forbidden-terms";
import { hasAdvice } from "@/lib/interview/filters";

const ai = createInterviewMock();
const speak = (s: InterviewState, text: string, at = 10_000) => step(s, { kind: "speech", text, durationMs: 1000 }, ai, at);
async function inSaude() {
  let r = await step(createState(FIXTURES.prioridade, { mode: "live", nowMs: 0 }), { kind: "start", consent: true }, ai, 0);
  r = await speak(r.state, "pode");
  expect(r.say.blockId).toBe("saude");
  return r;
}
async function inSafety() {
  let r = await step(createState(FIXTURES.semIndicio, { mode: "live", nowMs: 0 }), { kind: "start", consent: true }, ai, 0);
  let t = 0;
  while (r.say.blockId !== "seguranca" && t++ < 20) r = await speak(r.state, "nada demais", t * 1000);
  expect(r.say.blockId).toBe("seguranca");
  return r;
}

describe("protocolo: toda pergunta tem uma segunda forma", () => {
  it("bases e sondas têm rephrase diferente, sem termo proibido nem conselho", () => {
    for (const b of Object.values(BLOCKS)) {
      const qs = b.id === "abertura" || b.id === "fechamento" ? [] : [{ text: b.base, rephrase: b.rephrase }, ...b.probes];
      for (const q of qs) {
        expect(q.rephrase, q.text).toBeTruthy();
        expect(q.rephrase).not.toBe(q.text);
        expect(assertNoForbidden(q.rephrase!)).toEqual([]);
        expect(hasAdvice(q.rephrase!)).toBe(false);
      }
    }
  });
});

describe("domínios", () => {
  it("'não sei' → pergunta de outro jeito, mesmo bloco, sem extrair", async () => {
    const r = await inSaude();
    const out = await speak(r.state, "não sei");
    expect(out.say.text).toBe(BLOCKS.saude.rephrase);
    expect(out.say.blockId).toBe("saude");
    expect(out.say.cacheKey).toBe("saude:base:rephrase");
    expect(out.state.findings).toHaveLength(0);
    expect(out.state.status).toBe("running");
  });

  it("resposta de verdade depois da segunda forma segue normal", async () => {
    let r = await inSaude();
    r = await speak(r.state, "sei lá");
    r = await speak(r.state, "um cansaço grande há uns três meses");
    expect(r.state.findings).toHaveLength(1);
    expect(r.state.avisos).toHaveLength(0);
  });

  it("recusa na segunda vez → aviso 'não quis responder' e sai do bloco", async () => {
    let r = await inSaude();
    r = await speak(r.state, "não sei");
    r = await speak(r.state, "prefiro não responder");
    expect(r.state.avisos).toHaveLength(1);
    expect(r.state.avisos[0].texto).toContain("Não quis responder");
    expect(r.state.avisos[0].texto).toContain(BLOCKS.saude.base);
    expect(r.say.blockId).not.toBe("saude");
  });

  it("sonda recusada duas vezes → aviso e próxima sonda do mesmo bloco", async () => {
    let r = await inSaude();
    r = await speak(r.state, "um cansaço grande, pior no fim do dia"); // sem duração → pergunta "desde quando"
    expect(r.say.probeId).toBe("desdeQuando");
    r = await speak(r.state, "não sei");
    expect(r.say.text).toBe(BLOCKS.saude.probes.find((p) => p.id === "desdeQuando")!.rephrase);
    r = await speak(r.state, "não lembro");
    expect(r.state.avisos[0].texto).toContain("Desde quando é assim?");
    expect(r.say.blockId).toBe("saude");
    expect(r.say.probeId).not.toBe("desdeQuando");
  });

  it("'não sei' com conteúdo depois não é recusa", async () => {
    const r = await inSaude();
    const out = await speak(r.state, "não sei explicar, é um cansaço que não passa");
    expect(out.state.findings).toHaveLength(1);
  });

  it("pular pergunta também vira aviso", async () => {
    const r = await inSaude();
    const out = await step(r.state, { kind: "skip" }, ai, 20_000);
    expect(out.state.avisos[0].texto).toContain("Preferiu pular");
  });

  it("silêncio duas vezes vira aviso de sem resposta", async () => {
    let r = await inSaude();
    r = await speak(r.state, "");
    r = await speak(r.state, "");
    expect(r.state.avisos[0].texto).toContain("Sem resposta");
  });
});

describe("pergunta de segurança", () => {
  it.each(["não sei", "às vezes", "talvez", "não, mas às vezes penso que não vale a pena"])("'%s' → pergunta de outro jeito, sem crise", async (frase) => {
    const r = await inSafety();
    const out = await speak(r.state, frase, 60_000);
    expect(out.state.status).toBe("running");
    expect(out.say.text).toBe(BLOCKS.seguranca.rephrase);
    expect(out.say.blockId).toBe("seguranca");
  });

  it("depois da segunda forma: 'sim' → crise", async () => {
    let r = await inSafety();
    r = await speak(r.state, "não sei", 60_000);
    r = await speak(r.state, "sim", 61_000);
    expect(r.state.status).toBe("crisis");
  });

  it("depois da segunda forma: 'não' → encerra normal, sem aviso", async () => {
    let r = await inSafety();
    r = await speak(r.state, "às vezes", 60_000);
    r = await speak(r.state, "não", 61_000);
    expect(r.state.status).toBe("done");
    expect(r.state.avisos).toHaveLength(0);
  });

  it("de novo sem resposta clara → aviso com as duas respostas citadas e encerra", async () => {
    let r = await inSafety();
    r = await speak(r.state, "não sei", 60_000);
    r = await speak(r.state, "prefiro não falar disso", 61_000);
    expect(r.state.status).toBe("done");
    expect(r.state.avisos).toHaveLength(1);
    expect(r.state.avisos[0].texto).toContain("segurança");
    expect(r.state.avisos[0].turnIdxs).toHaveLength(2);
    const s = await buildSummary(r.state, ai);
    expect(s.avisos).toHaveLength(1);
    expect(s.avisos[0].origem).toHaveLength(2);
    expect(s.avisos[0].origem.every((o) => r.state.turns[o.turnIdx].speaker === "person")).toBe(true);
  });

  it("'sim' direto continua cortando em crise", async () => {
    const r = await inSafety();
    expect((await speak(r.state, "sim", 60_000)).state.status).toBe("crisis");
  });
});

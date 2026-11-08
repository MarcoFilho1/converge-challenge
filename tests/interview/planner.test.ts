/** A Helena conduz a conversa: reage sem vício, aprofunda no que a pessoa disse e escolhe a pergunta que faz sentido. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createInterviewMock } from "@/lib/ai/interview-mock";
import type { InterviewAi, TurnPlan } from "@/lib/ai/interview";
import { createState, step, type InterviewState } from "@/lib/interview/engine";
import { FIXTURES } from "@/lib/interview/fixtures";
import { BLOCKS } from "@/lib/interview/protocol";

const T0 = 1_000_000;
const planTurn = vi.fn<NonNullable<InterviewAi["planTurn"]>>();
const ai: InterviewAi = { ...createInterviewMock(), planTurn };

const plan = (p: Partial<TurnPlan>): TurnPlan => ({ achados: [], reacao: "", proxima: "sonda", sondaId: null, pergunta: null, ...p });
const speak = (s: InterviewState, text: string, at = T0 + 10_000) => step(s, { kind: "speech", text, durationMs: 3000 }, ai, at);

async function inSaude() {
  let r = await step(createState(FIXTURES.prioridade, { mode: "live", nowMs: T0 }), { kind: "start", consent: true }, ai, T0);
  r = await speak(r.state, "pode");
  expect(r.say.blockId).toBe("saude");
  return r;
}

beforeEach(() => planTurn.mockReset());

describe("aprofundar no que a pessoa disse", () => {
  it("a IA pode fazer uma pergunta de aprofundamento sobre a fala, com a reação antes", async () => {
    const r0 = await inSaude();
    planTurn.mockResolvedValueOnce(plan({ reacao: "Faz sentido não ter reparado antes.", proxima: "aprofundar", pergunta: "E como você percebeu que algo mudou?" }));
    const r = await speak(r0.state, "não sei, nunca tinha notado isso");
    expect(r.say.text).toBe("Faz sentido não ter reparado antes. E como você percebeu que algo mudou?");
    expect(r.state.currentProbeId).toBe("aprofundar:saude");
    const input = planTurn.mock.calls[0][0];
    expect(input.allowFollowUp).toBe(true);
    expect(input.lastText).toBe("não sei, nunca tinha notado isso");
    expect(input.candidates.length).toBeGreaterThan(0);
  });

  it("só um aprofundamento por bloco: no segundo, a IA nem pode e o código usa a lista", async () => {
    const r0 = await inSaude();
    planTurn.mockResolvedValueOnce(plan({ proxima: "aprofundar", pergunta: "E como você percebeu que algo mudou?" }));
    const r1 = await speak(r0.state, "não sei, nunca tinha notado isso");
    planTurn.mockResolvedValueOnce(plan({ proxima: "aprofundar", pergunta: "E o que mais você sentiu nessa época?" }));
    const r2 = await speak(r1.state, "foi quando as metas dobraram");
    expect(planTurn.mock.calls[1][0].allowFollowUp).toBe(false);
    expect(BLOCKS.saude.probes.map((p) => p.id)).toContain(r2.say.probeId);
  });

  it("pergunta de aprofundamento com conselho, sem interrogação ou longa demais é descartada", async () => {
    for (const pergunta of ["Você deveria procurar um médico?", "Me conte mais sobre isso", "E " + "muito ".repeat(30) + "?"]) {
      const r0 = await inSaude();
      planTurn.mockResolvedValueOnce(plan({ proxima: "aprofundar", pergunta }));
      const r = await speak(r0.state, "um cansaço grande");
      expect(r.say.text).not.toContain(pergunta);
      expect(BLOCKS.saude.probes.map((p) => p.id)).toContain(r.say.probeId);
    }
  });

  it("pedir para repetir depois de um aprofundamento repete o aprofundamento", async () => {
    const r0 = await inSaude();
    planTurn.mockResolvedValueOnce(plan({ proxima: "aprofundar", pergunta: "E como você percebeu que algo mudou?" }));
    const r1 = await speak(r0.state, "não sei, nunca tinha notado isso");
    const r2 = await speak(r1.state, "pode repetir?");
    expect(r2.say.text).toContain("E como você percebeu que algo mudou?");
  });
});

describe("escolher a próxima pergunta", () => {
  it("a IA escolhe uma pergunta da lista pelo id quando ela faz sentido", async () => {
    const r0 = await inSaude();
    planTurn.mockResolvedValueOnce(plan({ proxima: "sonda", sondaId: "piora" }));
    const r = await speak(r0.state, "um cansaço grande há três meses");
    expect(r.say.probeId).toBe("piora");
  });

  it("id que não existe ou já foi perguntado: o código escolhe pela lista", async () => {
    const r0 = await inSaude();
    planTurn.mockResolvedValueOnce(plan({ proxima: "sonda", sondaId: "inventada" }));
    const r = await speak(r0.state, "um cansaço grande há três meses");
    expect(BLOCKS.saude.probes.map((p) => p.id)).toContain(r.say.probeId);
  });

  it("'seguir' passa para a pergunta-base do próximo bloco", async () => {
    const r0 = await inSaude();
    planTurn.mockResolvedValueOnce(plan({ proxima: "seguir" }));
    const r = await speak(r0.state, "já contei tudo sobre a saúde");
    expect(r.say.blockId).not.toBe("saude");
    expect(r.say.probeId).toBeNull();
  });

  it("o que a IA extraiu vira achado; se a pessoa pediu para parar, encerra", async () => {
    const r0 = await inSaude();
    planTurn.mockResolvedValueOnce(
      plan({ achados: [{ tema: "sintoma", texto: "cansaço grande", duracao: "há 3 meses", intensidade: "forte", mencionaTrabalho: false, pediuParar: false }] }),
    );
    const r1 = await speak(r0.state, "um cansaço grande há três meses");
    expect(r1.state.findings.at(-1)).toMatchObject({ tema: "sintoma", blockId: "saude" });
    planTurn.mockResolvedValueOnce(plan({ achados: [{ tema: "outro", texto: "quero parar", duracao: null, intensidade: null, mencionaTrabalho: false, pediuParar: true }] }));
    const r2 = await speak(r1.state, "quero parar por aqui");
    expect(r2.state.status).toBe("stopped");
  });
});

describe("reação sem vício", () => {
  it("não repete a abertura da reação anterior e recebe as reações já usadas", async () => {
    const r0 = await inSaude();
    planTurn.mockResolvedValueOnce(plan({ reacao: "Hmm, entendi, o cansaço pesa no fim do dia.", proxima: "sonda", sondaId: "piora" }));
    const r1 = await speak(r0.state, "um cansaço grande no fim do dia");
    planTurn.mockResolvedValueOnce(plan({ reacao: "Hmm, entendi, as metas apertaram.", proxima: "sonda", sondaId: "alivia" }));
    const r2 = await speak(r1.state, "piora no fechamento, as metas apertaram");
    expect(planTurn.mock.calls[1][0].recentReactions).toContain("Hmm, entendi, o cansaço pesa no fim do dia.");
    expect(r2.say.text.startsWith("As metas apertaram.")).toBe(true);
  });

  it("reação vazia é permitida: só a pergunta", async () => {
    const r0 = await inSaude();
    planTurn.mockResolvedValueOnce(plan({ reacao: "", proxima: "sonda", sondaId: "piora" }));
    const r = await speak(r0.state, "um cansaço grande");
    expect(r.say.text).toBe(BLOCKS.saude.probes.find((p) => p.id === "piora")!.text);
  });
});

describe("aprofundamento não adianta assunto de outro bloco", () => {
  it("pergunta que repete a base de um bloco que ainda vem é descartada", async () => {
    let r = await inSaude();
    planTurn.mockResolvedValueOnce(plan({ proxima: "seguir" }));
    r = await speak(r.state, "um cansaço grande há meses");
    expect(r.say.blockId).toBe("trabalho");
    planTurn.mockResolvedValueOnce(plan({ proxima: "aprofundar", pergunta: "O que te segurou de buscar ajuda até agora?" }));
    const r2 = await speak(r.state, "nunca procurei ninguém");
    expect(r2.say.text).not.toContain("buscar ajuda");
    expect(planTurn.mock.calls[1][0].upcomingQuestions.join(" ")).toMatch(/buscar ajuda/);
  });
});

describe("sem repetir o que já foi dito", () => {
  it("reação que termina igual à anterior ('…, então.') perde o final repetido", async () => {
    const r0 = await inSaude();
    planTurn.mockResolvedValueOnce(plan({ reacao: "Cansaço no fim do dia, então.", proxima: "sonda", sondaId: "piora" }));
    const r1 = await speak(r0.state, "um cansaço no fim do dia");
    planTurn.mockResolvedValueOnce(plan({ reacao: "Fechamento de mês é puxado, então.", proxima: "sonda", sondaId: "alivia" }));
    const r2 = await speak(r1.state, "piora no fechamento");
    expect(r2.say.text.startsWith("Fechamento de mês é puxado.")).toBe(true);
  });

  it("a pergunta da lista sobre um assunto que a pessoa já trouxe no bloco sai das opções", async () => {
    let r = await inSaude();
    planTurn.mockResolvedValueOnce(plan({ proxima: "seguir" }));
    r = await speak(r.state, "um cansaço grande há meses");
    expect(r.say.blockId).toBe("trabalho");
    planTurn.mockResolvedValueOnce(
      plan({ achados: [{ tema: "chefia", texto: "meu chefe é legal mas cobra muito", duracao: null, intensidade: null, mencionaTrabalho: true, pediuParar: false }], proxima: "sonda", sondaId: "chefia" }),
    );
    const r2 = await speak(r.state, "meu chefe é legal, mas cobra muito");
    expect(r2.say.probeId).not.toBe("chefia");
    expect(planTurn.mock.calls[1][0].alreadySaid).toEqual([]);
    planTurn.mockResolvedValueOnce(plan({ proxima: "sonda", sondaId: "pausa" }));
    await speak(r2.state, "umas duas horas a mais");
    expect(planTurn.mock.calls[2][0].alreadySaid).toContain("meu chefe é legal mas cobra muito");
    expect(planTurn.mock.calls[2][0].candidates.map((c) => c.id)).not.toContain("chefia");
  });
});

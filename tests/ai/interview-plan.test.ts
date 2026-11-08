import { beforeEach, describe, expect, it, vi } from "vitest";

const generateText = vi.fn();
vi.mock("ai", async (orig) => ({ ...(await orig<typeof import("ai")>()), generateText: (...a: unknown[]) => generateText(...a) }));

const input = {
  blockId: "saude" as const,
  blockLabel: "Saúde",
  lastQuestion: "Desde quando é assim?",
  lastText: "não sei, nunca tinha notado isso",
  recent: [{ speaker: "ai" as const, text: "Desde quando é assim?" }, { speaker: "person" as const, text: "não sei, nunca tinha notado isso" }],
  recentReactions: ["Hmm, entendi, o cansaço pesa."],
  candidates: [{ id: "piora", text: "O que você percebe que piora?" }],
  allowFollowUp: true,
  nextBlockQuestion: "E no trabalho, o que está mais difícil agora?",
  upcomingQuestions: ["E no trabalho, o que está mais difícil agora?"],
  alreadySaid: [],
};

beforeEach(() => {
  generateText.mockReset();
  vi.unstubAllEnvs();
});

describe("planTurn no modelo real", () => {
  it("manda a conversa recente, as reações usadas e as opções, e devolve o plano", async () => {
    vi.stubEnv("FEATHERLESS_API_KEY_1", "fl");
    const plan = { achados: [], reacao: "Faz sentido não ter reparado.", proxima: "aprofundar", sondaId: null, pergunta: "E como você percebeu que algo mudou?" };
    generateText.mockResolvedValue({ output: plan, usage: {} });
    const { createInterviewGateway } = await import("@/lib/ai/interview-gateway");
    expect(await createInterviewGateway().planTurn!(input)).toEqual(plan);
    const call = generateText.mock.calls[0][0] as { prompt: string; temperature: number };
    const sent = JSON.parse(call.prompt);
    expect(sent.reacoesJaUsadas).toEqual(["Hmm, entendi, o cansaço pesa."]);
    expect(sent.opcoes).toEqual([{ id: "piora", pergunta: "O que você percebe que piora?" }]);
    expect(sent.podeAprofundar).toBe(true);
    expect(call.temperature).toBeGreaterThan(0);
  });

  it("se nenhum modelo responder, cai no caminho simples: extração e reação simuladas, próxima pela lista", async () => {
    vi.stubEnv("FEATHERLESS_API_KEY_1", "fl");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    generateText.mockRejectedValue(new Error("fora do ar"));
    const { createInterviewGateway } = await import("@/lib/ai/interview-gateway");
    const p = await createInterviewGateway().planTurn!(input);
    expect(p.proxima).toBe("sonda");
    expect(p.sondaId).toBeNull();
    expect(p.pergunta).toBeNull();
  });
});

describe("instruções da Helena", () => {
  it("a reação não sugere mais abrir com 'Hmm' e pede para não repetir", async () => {
    const { ACK_SYSTEM, PLAN_SYSTEM } = await import("@/lib/ai/interview-prompts");
    expect(ACK_SYSTEM).not.toMatch(/Hmm/);
    expect(PLAN_SYSTEM).not.toMatch(/"Hmm/);
    expect(PLAN_SYSTEM).toMatch(/não repita/i);
    expect(PLAN_SYSTEM).toMatch(/aprofundar/);
  });
});

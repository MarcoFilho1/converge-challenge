import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Item } from "@/lib/instruments/types";

const generateText = vi.fn();
const embedMany = vi.fn();
vi.mock("ai", () => ({
  generateText: (...a: unknown[]) => generateText(...a),
  embedMany: (...a: unknown[]) => embedMany(...a),
  gateway: { embeddingModel: (id: string) => ({ id }) },
  Output: { object: (o: unknown) => o },
}));

const phq1: Item = {
  code: "PHQ9_1",
  instrument: "PHQ9",
  text: "Pouco interesse ou pouco prazer em fazer as coisas",
  scale: { min: 0, max: 3, higherIsWorse: true, labels: ["nenhuma vez", "vários dias", "mais da metade dos dias", "quase todos os dias"] },
};
const chunk = { id: "c1", documentTitle: "PHQ-9", page: 1, text: "Item 1" };

beforeEach(() => {
  vi.unstubAllEnvs();
  generateText.mockReset();
  embedMany.mockReset();
});

describe("provedor gateway", () => {
  it("embeda com o modelo configurado e recusa dimensão diferente de 1536", async () => {
    vi.stubEnv("AI_GATEWAY_API_KEY", "gw");
    const { createGatewayProvider } = await import("@/lib/ai/gateway");
    embedMany.mockResolvedValue({ embeddings: [new Array(1536).fill(0.1)] });
    expect((await createGatewayProvider().embed(["x"]))[0]).toHaveLength(1536);
    embedMany.mockResolvedValue({ embeddings: [new Array(3072).fill(0.1)] });
    await expect(createGatewayProvider().embed(["x"])).rejects.toThrow(/1536/);
  });

  it("sem chave do AI Gateway, os vetores continuam locais (mesmo espaço do índice já gravado)", async () => {
    vi.stubEnv("FEATHERLESS_API_KEY_1", "fl");
    const { createGatewayProvider } = await import("@/lib/ai/gateway");
    const [v] = await createGatewayProvider().embed(["cansaço no trabalho"]);
    expect(v).toHaveLength(1536);
    expect(embedMany).not.toHaveBeenCalled();
  });

  it("com chave da Featherless, o resumo vai para o modelo dela com limite de tempo", async () => {
    vi.stubEnv("FEATHERLESS_API_KEY_1", "fl");
    vi.stubEnv("AI_CHAT_MODEL", "moonshotai/Kimi-K2-Instruct-0905");
    const { createGatewayProvider } = await import("@/lib/ai/gateway");
    generateText.mockResolvedValue({
      output: { dificuldades_relatadas: [], impacto_funcional: { texto: "", origem: [] }, fatores_do_trabalho: [], pontos_para_avaliar: [], nao_respondido: [] },
    });
    await createGatewayProvider().summarizeRun({ answers: [], scores: [], evidence: [], missingInstruments: [] });
    const call = generateText.mock.calls[0][0] as { model: { modelId: string; provider: string }; abortSignal: AbortSignal; maxRetries: number };
    expect(call.model.modelId).toBe("moonshotai/Kimi-K2-Instruct-0905");
    expect(call.model.provider).toContain("featherless");
    expect(call.abortSignal).toBeInstanceOf(AbortSignal);
    expect(call.maxRetries).toBe(0);
  });

  it("interpreta localmente antes de gastar chamada de modelo", async () => {
    const { createGatewayProvider } = await import("@/lib/ai/gateway");
    expect(await createGatewayProvider().interpretAnswer(phq1, "2")).toBe(2);
    expect(generateText).not.toHaveBeenCalled();
  });

  it("descarta valor fora da escala vindo do modelo", async () => {
    const { createGatewayProvider } = await import("@/lib/ai/gateway");
    generateText.mockResolvedValue({ output: { value: 9 } });
    expect(await createGatewayProvider().interpretAnswer(phq1, "bastante")).toBeNull();
  });

  it("descarta trecho inventado e só marca relevante com trecho real", async () => {
    const { createGatewayProvider } = await import("@/lib/ai/gateway");
    generateText.mockResolvedValue({
      output: {
        relevante: true,
        tema: "PHQ9",
        explicacao: "Resposta alta.",
        trechos: [{ chunkId: "inventado", documento: "x", pagina: 1, texto: "y" }],
      },
    });
    const out = await createGatewayProvider().classifyAnswer({ item: phq1, answerText: "3", value: 3, chunks: [chunk] });
    expect(out.relevante).toBe(false);
    expect(out.trechos).toEqual([]);
  });

  it("se o modelo falhar, cai no modo simulado em vez de derrubar a conversa", async () => {
    const { createGatewayProvider } = await import("@/lib/ai/gateway");
    generateText.mockRejectedValue(new Error("401 chave inválida"));
    const out = await createGatewayProvider().classifyAnswer({ item: phq1, answerText: "3", value: 3, chunks: [chunk] });
    expect(out.relevante).toBe(true);
    expect(out.trechos[0].chunkId).toBe("c1");
  });
});

describe("busca semântica com o Qwen3 Embedding da Featherless", () => {
  const vec = (n: number) => new Array(n).fill(0.01);

  it("AI_EMBEDDINGS=featherless: pede 1536 dimensões ao Qwen3 Embedding e devolve os vetores", async () => {
    vi.stubEnv("FEATHERLESS_API_KEY_1", "k1");
    vi.stubEnv("AI_EMBEDDINGS", "featherless");
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: [{ embedding: vec(1536) }, { embedding: vec(1536) }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { createGatewayProvider } = await import("@/lib/ai/gateway");
    const out = await createGatewayProvider().embed(["cansaço", "metas"]);
    expect(out).toHaveLength(2);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.featherless.ai/v1/embeddings");
    expect(JSON.parse(String(init.body))).toMatchObject({ model: "Qwen/Qwen3-Embedding-8B", dimensions: 1536, input: ["cansaço", "metas"] });
    expect(embedMany).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("chave sem crédito passa para a próxima; dimensão errada é recusada", async () => {
    vi.stubEnv("FEATHERLESS_API_KEY_1", "k1");
    vi.stubEnv("FEATHERLESS_API_KEY_2", "k2");
    vi.stubEnv("AI_EMBEDDINGS", "featherless");
    const used: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_u: string, init: RequestInit) => {
      const key = (init.headers as Record<string, string>).Authorization;
      used.push(key);
      return key.endsWith("k1") ? new Response('{"error":{"message":"Insufficient credits"}}', { status: 402 }) : new Response(JSON.stringify({ data: [{ embedding: vec(1536) }] }), { status: 200 });
    }));
    const { createGatewayProvider } = await import("@/lib/ai/gateway");
    expect((await createGatewayProvider().embed(["x"]))[0]).toHaveLength(1536);
    expect(used).toEqual(["Bearer k1", "Bearer k2"]);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ data: [{ embedding: vec(1024) }] }), { status: 200 })));
    await expect(createGatewayProvider().embed(["x"])).rejects.toThrow(/1536/);
    vi.unstubAllGlobals();
  });
});

describe("readReply pela IA", () => {
  const base = { stage: "item" as const, item: phq1, previous: null, upcoming: [{ code: "PHQ9_2", text: "Se sentir para baixo" }] };

  it("fala livre vai para o modelo rápido; mentions só com códigos dos próximos itens", async () => {
    vi.stubEnv("FEATHERLESS_API_KEY_1", "fl");
    const { createGatewayProvider } = await import("@/lib/ai/gateway");
    generateText.mockResolvedValue({ output: { intent: "answer", value: 3, quote: "quase todo dia", confidence: "alta", mentions: ["PHQ9_2", "INVENTADO"] } });
    const r = await createGatewayProvider().readReply({ ...base, text: "quase todo dia, tô sem vontade e meio pra baixo" });
    expect(r).toMatchObject({ intent: "answer", value: 3, quote: "quase todo dia", source: "ia", mentions: ["PHQ9_2"] });
    expect(generateText).toHaveBeenCalledTimes(1);
  });

  it("rótulo exato não gasta chamada de modelo", async () => {
    vi.stubEnv("FEATHERLESS_API_KEY_1", "fl");
    const { createGatewayProvider } = await import("@/lib/ai/gateway");
    const r = await createGatewayProvider().readReply({ ...base, text: "Vários dias" });
    expect(r).toMatchObject({ value: 1, source: "regra" });
    expect(generateText).not.toHaveBeenCalled();
  });

  it("IA fora do ar: cai para a regra local sem lançar erro", async () => {
    vi.stubEnv("FEATHERLESS_API_KEY_1", "fl");
    const { createGatewayProvider } = await import("@/lib/ai/gateway");
    generateText.mockRejectedValue(new Error("timeout"));
    const r = await createGatewayProvider().readReply({ ...base, text: "acho que quase todo dia" });
    expect(r).toMatchObject({ value: 3, source: "regra" });
  });
});

describe("readReply: atalho da regra local só quando ela entende", () => {
  it("palavra curta que a regra local não conhece nesta escala vai para a IA", async () => {
    vi.stubEnv("FEATHERLESS_API_KEY_1", "fl");
    const { createGatewayProvider } = await import("@/lib/ai/gateway");
    generateText.mockResolvedValue({ output: { intent: "answer", value: 1, quote: "raramente", confidence: "baixa", mentions: [] } });
    const r = await createGatewayProvider().readReply({ stage: "item", item: phq1, previous: null, upcoming: [], text: "raramente" });
    expect(generateText).toHaveBeenCalledTimes(1);
    expect(r).toMatchObject({ value: 1, source: "ia" });
  });
});

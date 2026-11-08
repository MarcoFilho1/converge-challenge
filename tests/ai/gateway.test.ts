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
  generateText.mockReset();
  embedMany.mockReset();
});

describe("provedor gateway", () => {
  it("embeda com o modelo configurado e recusa dimensão diferente de 1536", async () => {
    const { createGatewayProvider } = await import("@/lib/ai/gateway");
    embedMany.mockResolvedValue({ embeddings: [new Array(1536).fill(0.1)] });
    expect((await createGatewayProvider().embed(["x"]))[0]).toHaveLength(1536);
    embedMany.mockResolvedValue({ embeddings: [new Array(3072).fill(0.1)] });
    await expect(createGatewayProvider().embed(["x"])).rejects.toThrow(/1536/);
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

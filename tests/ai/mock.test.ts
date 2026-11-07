import { describe, expect, it } from "vitest";
import { createMockProvider } from "@/lib/ai/mock";
import type { Item } from "@/lib/instruments/types";
import { RunSummarySchema } from "@/lib/ai/types";

const ai = createMockProvider();

const phq1: Item = {
  code: "PHQ9_1",
  instrument: "PHQ9",
  text: "Pouco interesse ou pouco prazer em fazer as coisas",
  scale: {
    min: 0,
    max: 3,
    higherIsWorse: true,
    labels: ["nenhuma vez", "vários dias", "mais da metade dos dias", "quase todos os dias"],
  },
};
const trunk: Item = {
  code: "TRUNK",
  instrument: "TRUNK",
  text: "No último mês, você trabalhou mesmo com algum problema de saúde?",
  scale: { min: 0, max: 1, higherIsWorse: true, labels: ["não", "sim"] },
};
const chunk = { id: "c1", documentTitle: "PHQ-9", page: 1, text: "Item 1 avalia anedonia" };

const cosine = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i], 0);

describe("mock embed", () => {
  it("é determinístico e tem 1536 dimensões", async () => {
    const [a, b] = await ai.embed(["cansaço no trabalho", "cansaço no trabalho"]);
    expect(a).toHaveLength(1536);
    expect(a).toEqual(b);
  });

  it("separa textos diferentes", async () => {
    const [a, b] = await ai.embed(["pensamentos de morte", "fechamento mensal do financeiro"]);
    expect(cosine(a, b)).toBeLessThan(0.99);
  });
});

describe("mock interpretAnswer", () => {
  it("lê sim/não no tronco com escala 1 não, 2 sim", async () => {
    const trunk12: Item = { ...trunk, scale: { min: 1, max: 2, higherIsWorse: true, labels: ["não", "sim"] } };
    expect(await ai.interpretAnswer(trunk12, "Sim")).toBe(2);
    expect(await ai.interpretAnswer(trunk12, "nao")).toBe(1);
  });
  it("lê número dentro da escala", async () => {
    expect(await ai.interpretAnswer(phq1, "2")).toBe(2);
  });
  it("lê o rótulo da escala por extenso", async () => {
    expect(await ai.interpretAnswer(phq1, "Quase todos os dias")).toBe(3);
  });
  it("lê sim/não no tronco", async () => {
    expect(await ai.interpretAnswer(trunk, "sim")).toBe(1);
    expect(await ai.interpretAnswer(trunk, "Não")).toBe(0);
  });
  it("devolve null para número fora da escala ou texto sem sentido", async () => {
    expect(await ai.interpretAnswer(phq1, "7")).toBeNull();
    expect(await ai.interpretAnswer(phq1, "talvez")).toBeNull();
  });
});

describe("mock classifyAnswer", () => {
  it("marca relevante com valor alto e trecho disponível", async () => {
    const out = await ai.classifyAnswer({ item: phq1, answerText: "3", value: 3, chunks: [chunk] });
    expect(out.relevante).toBe(true);
    expect(out.trechos).toHaveLength(1);
    expect(out.trechos[0].chunkId).toBe("c1");
  });
  it("nunca marca relevante sem trechos", async () => {
    const out = await ai.classifyAnswer({ item: phq1, answerText: "3", value: 3, chunks: [] });
    expect(out.relevante).toBe(false);
  });
  it("não marca relevante com valor baixo", async () => {
    const out = await ai.classifyAnswer({ item: phq1, answerText: "0", value: 0, chunks: [chunk] });
    expect(out.relevante).toBe(false);
  });
});

describe("mock summarizeRun", () => {
  it("gera resumo válido com origem e lista o que faltou", async () => {
    const summary = await ai.summarizeRun({
      answers: [
        { item: trunk, rawText: "sim", value: 1 },
        { item: phq1, rawText: "3", value: 3 },
      ],
      scores: [
        { instrument: "PHQ9", dimension: "total", value: 3, cutoff: 10, flagged: false, complete: false },
      ],
      evidence: [{ itemCode: "PHQ9_1", theme: "PHQ9", explanation: "Resposta alta ao item PHQ9_1." }],
      missingInstruments: ["GAD7"],
    });
    expect(RunSummarySchema.safeParse(summary).success).toBe(true);
    expect(summary.nao_respondido).toContain("GAD7");
    expect(summary.dificuldades_relatadas[0].origem).toContain("PHQ9_1");
  });
});

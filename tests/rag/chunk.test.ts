import { describe, expect, it } from "vitest";
import { chunkText } from "@/lib/rag/chunk";

describe("chunkText", () => {
  const sentence = "O trabalhador relatou cansaço ao fim do dia e dificuldade de concentração. ";
  const text = sentence.repeat(70); // ~5.300 caracteres

  it("divide texto longo em pedaços de até 1800 caracteres", () => {
    const chunks = chunkText(text);
    expect(chunks.length).toBeGreaterThanOrEqual(3);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(1800);
  });

  it("pedaços vizinhos se sobrepõem", () => {
    const [a, b] = chunkText(text);
    expect(b.startsWith(a.slice(-100).trim().slice(0, 40)) || a.includes(b.slice(0, 60))).toBe(true);
  });

  it("corta em fim de frase quando possível", () => {
    const [a] = chunkText(text);
    expect(a.trim().endsWith(".")).toBe(true);
  });

  it("ignora texto vazio e junta espaços", () => {
    expect(chunkText("   \n\n  ")).toEqual([]);
    expect(chunkText("a\n\n\nb   c")).toEqual(["a b c"]);
  });
});

describe("splitMarkdownSections", () => {
  it("separa por títulos de nível 2 e mantém o título no começo", async () => {
    const { splitMarkdownSections } = await import("@/lib/rag/extract");
    const md = "# Doc\n\nIntro.\n\n## Parte A\n\nTexto A.\n\n## Parte B\n\nTexto B.";
    expect(splitMarkdownSections(md)).toEqual([
      { page: 1, text: "Doc Intro." },
      { page: 2, text: "Parte A: Texto A." },
      { page: 3, text: "Parte B: Texto B." },
    ]);
  });
});

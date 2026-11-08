import { describe, expect, it } from "vitest";
import { DEMO_ITEMS, FULL_ITEMS, getItems, nextItemIndex } from "@/lib/instruments";

const codes = (items: { code: string }[]) => items.map((i) => i.code);

describe("roteiros", () => {
  it("demo tem os 8 itens da pesquisa, na ordem", () => {
    expect(codes(DEMO_ITEMS)).toEqual([
      "TRUNK", "WPAI_Q5", "BAT_1", "PHQ9_1", "PHQ9_2", "PHQ9_9", "COPSOQ_2A", "OPEN_1",
    ]);
  });

  it("completo começa pelo núcleo de triagem e termina nas abertas", () => {
    const c = codes(FULL_ITEMS);
    expect(c.slice(0, 4)).toEqual(["TRUNK", "WPAI_Q5", "PHQ9_1", "PHQ9_2"]);
    expect(c.slice(-2)).toEqual(["OPEN_1", "OPEN_2"]);
    expect(c).toContain("PHQ9_9");
    expect(c.filter((x) => x.startsWith("BAT_"))).toHaveLength(12);
    expect(c.filter((x) => x.startsWith("COPSOQ_"))).toEqual(["COPSOQ_2A", "COPSOQ_4A", "COPSOQ_12B", "COPSOQ_23"]);
    expect(c.some((x) => x.startsWith("SPS6"))).toBe(false);
  });

  it("getItems escolhe o roteiro", () => {
    expect(getItems(true)).toBe(DEMO_ITEMS);
    expect(getItems(false)).toBe(FULL_ITEMS);
  });

  it("todo item fechado tem instrução e escala; abertas não têm escala", () => {
    for (const item of FULL_ITEMS) {
      if (item.instrument === "OPEN") expect(item.scale).toBeNull();
      else {
        expect(item.scale).not.toBeNull();
        expect(item.instruction).toBeTruthy();
      }
    }
  });
});

describe("nextItemIndex (portas de entrada)", () => {
  const idx = (code: string) => FULL_ITEMS.findIndex((i) => i.code === code);

  it("pula a WPAI Q5 quando o tronco é não", () => {
    expect(nextItemIndex(FULL_ITEMS, { TRUNK: 1 }, idx("TRUNK") + 1)).toBe(idx("PHQ9_1"));
  });

  it("pergunta a WPAI Q5 quando o tronco é sim", () => {
    expect(nextItemIndex(FULL_ITEMS, { TRUNK: 2 }, idx("TRUNK") + 1)).toBe(idx("WPAI_Q5"));
  });

  it("PHQ-2 menor que 2 pula direto para o item 9", () => {
    expect(nextItemIndex(FULL_ITEMS, { TRUNK: 1, PHQ9_1: 1, PHQ9_2: 0 }, idx("PHQ9_2") + 1)).toBe(idx("PHQ9_9"));
  });

  it("PHQ-2 maior ou igual a 2 abre os itens 3 a 8", () => {
    expect(nextItemIndex(FULL_ITEMS, { TRUNK: 1, PHQ9_1: 1, PHQ9_2: 1 }, idx("PHQ9_2") + 1)).toBe(idx("PHQ9_3"));
  });

  it("GAD-2 menor que 2 pula para o BAT", () => {
    expect(nextItemIndex(FULL_ITEMS, { GAD7_1: 0, GAD7_2: 1 }, idx("GAD7_2") + 1)).toBe(idx("BAT_1"));
  });

  it("devolve -1 no fim", () => {
    expect(nextItemIndex(FULL_ITEMS, {}, FULL_ITEMS.length)).toBe(-1);
  });
});

describe("linhas de apoio: explicação simples abaixo da pergunta validada", () => {
  it("a pergunta-tronco ganha exemplos de sinais de adoecimento, sem mudar o texto validado", async () => {
    const { getItems } = await import("@/lib/instruments");
    const { formatItem } = await import("@/lib/engine/copy");
    const trunk = getItems(true).find((i) => i.code === "TRUNK")!;
    const msg = formatItem(trunk);
    expect(msg).toContain("NOS ÚLTIMOS 30 DIAS, você esteve presente no trabalho apesar de apresentar algum problema de saúde ou algum sinal ou sintoma de adoecimento?");
    expect(msg).toContain("(Por exemplo: dor, gripe, dor de cabeça, cansaço forte, ansiedade, tristeza ou insônia.)");
    expect(msg.indexOf("(Por exemplo")).toBeLessThan(msg.indexOf("1 sim · 2 não"));
  });

  it("prejuízo, exaustão e humor ganham uma linha curta; a pergunta sobre se ferir não", async () => {
    const { getItems } = await import("@/lib/instruments");
    const { formatItem } = await import("@/lib/engine/copy");
    const by = (code: string) => formatItem(getItems(true).find((i) => i.code === code)!);
    expect(by("WPAI_Q5")).toMatch(/\(Em resumo: de 0 a 10/);
    expect(by("BAT_1")).toMatch(/\(Ou seja: /);
    expect(by("PHQ9_2")).toMatch(/\(Ou seja: /);
    expect(by("PHQ9_9")).not.toMatch(/\((Ou seja|Por exemplo|Em resumo)/);
  });

  it("a versão completa usa as mesmas linhas", async () => {
    const { getItems } = await import("@/lib/instruments");
    const full = getItems(false);
    expect(full.find((i) => i.code === "TRUNK")?.help).toMatch(/Por exemplo/);
    expect(full.find((i) => i.code === "WPAI_Q5")?.help).toMatch(/Em resumo/);
  });
});

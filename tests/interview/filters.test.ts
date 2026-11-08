import { describe, expect, it } from "vitest";
import { cleanGenerated, extraCrisis, hasAdvice } from "@/lib/interview/filters";
import { formatOrigin } from "@/lib/interview/origin";

describe("filtro de conselho", () => {
  it("detecta conselho", () => {
    expect(hasAdvice("Você deveria descansar")).toBe(true);
    expect(hasAdvice("Procure um médico")).toBe(true);
    expect(hasAdvice("É importante que você durma")).toBe(true);
    expect(hasAdvice("Recomendo uma pausa")).toBe(true);
  });
  it("não marca reflexo neutro", () => {
    expect(hasAdvice("Entendi, você falou do fechamento do mês.")).toBe(false);
    expect(hasAdvice("Obrigada por contar.")).toBe(false);
  });
  it("cleanGenerated zera texto proibido ou com conselho e apara o resto", () => {
    expect(cleanGenerated("Você tem sinais de burnout")).toBe("");
    expect(cleanGenerated("Tente dormir mais")).toBe("");
    expect(cleanGenerated("  Entendi.  ")).toBe("Entendi.");
  });
});

describe("padrões extras de crise", () => {
  it("pega formas que o detector do MVP1 não cobre", () => {
    expect(extraCrisis("tenho pensado em morrer")).toBe(true);
    expect(extraCrisis("tenho vontade de sumir")).toBe(true);
    expect(extraCrisis("pensei em mudar de emprego")).toBe(false);
  });
});

describe("formatOrigin", () => {
  it("formata turno e minuto", () => {
    expect(
      formatOrigin({ idx: 3, speaker: "person", text: "x", blockId: "saude", probeId: null, startedMs: 72000, durationMs: null }),
    ).toBe("turno 3 · 01:12");
  });
});

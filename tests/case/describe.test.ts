import { describe, expect, it } from "vitest";
import { describeCase, reasonsFor } from "@/lib/case/describe";

const chip = (instrument: string, dimension: string, value: number, flagged: boolean) => ({
  instrument, dimension, label: "", value, maxLabel: "", cutoff: 0, flagged, complete: true,
});
const base = {
  severity: "none" as const,
  status: "done" as const,
  clinicalOnly: false,
  partial: false,
  ruleTrace: { hasPresenteeismTrunk: false, hasWorkImpairment: false, hasClinicalSignal: false, hasCrisis: false },
  scores: [] as ReturnType<typeof chip>[],
};

describe("describeCase: a frase que explica o caso", () => {
  it("crise por texto", () => {
    expect(describeCase({ ...base, severity: "urgency", status: "crisis", ruleTrace: { ...base.ruleTrace, hasCrisis: true } }))
      .toBe("Escreveu uma frase de risco. Recebeu CVV 188 e SAMU 192.");
  });

  it("crise pelo item 9", () => {
    expect(describeCase({ ...base, severity: "urgency", ruleTrace: { ...base.ruleTrace, hasCrisis: true }, scores: [chip("PHQ9", "item9", 2, true)] }))
      .toBe("Marcou pensamentos de risco no item 9 do PHQ-9. Recebeu CVV 188 e SAMU 192.");
  });

  it("prioridade da demo: trabalhou doente, prejuízo e esgotamento", () => {
    expect(describeCase({
      ...base, severity: "priority",
      ruleTrace: { hasPresenteeismTrunk: true, hasWorkImpairment: true, hasClinicalSignal: true, hasCrisis: false },
      scores: [chip("WPAI", "work_impairment", 6, true), chip("BAT", "item1", 4, true), chip("PHQ2", "total", 2, false)],
    })).toBe("Trabalhou doente, prejuízo 6/10 e esgotamento frequente.");
  });

  it("sinal clínico sem presenteísmo", () => {
    expect(describeCase({
      ...base, severity: "attention", clinicalOnly: true,
      ruleTrace: { ...base.ruleTrace, hasClinicalSignal: true },
      scores: [chip("PHQ9", "total", 12, true)],
    })).toBe("Humor baixo (PHQ-9 12/27). Não relatou presenteísmo.");
  });

  it("assédio relatado", () => {
    expect(describeCase({ ...base, severity: "attention", scores: [chip("COPSOQ", "assedio", 3, true)] }))
      .toBe("Relatou assédio no trabalho nos últimos 12 meses.");
  });

  it("parcial avisa", () => {
    expect(describeCase({
      ...base, severity: "attention", partial: true,
      ruleTrace: { ...base.ruleTrace, hasPresenteeismTrunk: true, hasWorkImpairment: true },
      scores: [chip("WPAI", "work_impairment", 5, true)],
    })).toBe("Trabalhou doente e prejuízo 5/10. Parou antes do fim.");
  });

  it("sem indício", () => {
    expect(describeCase(base)).toBe("Nenhum sinal acima do corte.");
  });
});

describe("reasonsFor: o porquê da gravidade, com a origem", () => {
  it("lista cada critério ativo com sua fonte", () => {
    const r = reasonsFor({
      ...base, severity: "priority",
      ruleTrace: { hasPresenteeismTrunk: true, hasWorkImpairment: true, hasClinicalSignal: true, hasCrisis: false },
      scores: [chip("WPAI", "work_impairment", 6, true), chip("BAT", "item1", 4, true)],
    });
    expect(r).toEqual([
      { text: "Trabalhou com problema de saúde no último mês.", source: "pergunta-tronco" },
      { text: "Prejuízo no trabalho de 6/10, acima do corte 3.", source: "WPAI Q5" },
      { text: "Esgotamento acima do corte.", source: "BAT item 1" },
    ]);
  });
});

describe("números em português", () => {
  it("BAT-12 com vírgula decimal", () => {
    expect(describeCase({ ...base, severity: "attention", clinicalOnly: true, ruleTrace: { ...base.ruleTrace, hasClinicalSignal: true }, scores: [chip("BAT12", "total", 3.42, true)] }))
      .toBe("Esgotamento (BAT-12 3,42/5). Não relatou presenteísmo.");
  });
});

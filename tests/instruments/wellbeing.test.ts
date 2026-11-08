import { describe, expect, it } from "vitest";
import { shouldInviteToInterview, wellbeingIndex } from "@/lib/instruments/wellbeing";

const PRIORIDADE = { TRUNK: 2, WPAI_Q5: 7, BAT_1: 4, PHQ9_1: 2, PHQ9_2: 2, PHQ9_9: 0, COPSOQ_2A: 4, OPEN_1: null };
const SEM_INDICIO = { TRUNK: 1, WPAI_Q5: 0, BAT_1: 1, PHQ9_1: 0, PHQ9_2: 0, PHQ9_9: 0, COPSOQ_2A: 1, OPEN_1: null };

describe("índice de bem-estar (0 a 100, 100 = melhor)", () => {
  it("cada instrumento pesa igual: média do quanto cada resposta pesa na escala dela", () => {
    expect(wellbeingIndex(PRIORIDADE, true)).toBe(18);
    expect(wellbeingIndex(SEM_INDICIO, true)).toBe(95);
  });

  it("todas as respostas no melhor valor dão 100", () => {
    expect(wellbeingIndex({ TRUNK: 1, WPAI_Q5: 0, BAT_1: 1, PHQ9_1: 0, PHQ9_2: 0, PHQ9_9: 0, COPSOQ_2A: 0 }, true)).toBe(100);
  });

  it("o item 9 do PHQ-9 fica fora do índice: risco é tratado pelo corte de crise", () => {
    expect(wellbeingIndex({ ...PRIORIDADE, PHQ9_9: 3 }, true)).toBe(18);
  });

  it("sem nenhuma resposta de escala, não há índice", () => {
    expect(wellbeingIndex({}, true)).toBeNull();
    expect(wellbeingIndex({ TRUNK: null }, true)).toBeNull();
  });
});

describe("quem é convidado para a entrevista", () => {
  it("índice abaixo do limite convida", () => {
    expect(shouldInviteToInterview({ severity: "none", index: 65, threshold: 70 })).toBe(true);
    expect(shouldInviteToInterview({ severity: "none", index: 95, threshold: 70 })).toBe(false);
  });

  it("prioridade ou atenção pela regra validada convida mesmo com índice alto", () => {
    expect(shouldInviteToInterview({ severity: "priority", index: 80, threshold: 70 })).toBe(true);
    expect(shouldInviteToInterview({ severity: "attention", index: 90, threshold: 70 })).toBe(true);
  });

  it("urgência nunca recebe convite de entrevista com IA", () => {
    expect(shouldInviteToInterview({ severity: "urgency", index: 10, threshold: 70 })).toBe(false);
  });
});

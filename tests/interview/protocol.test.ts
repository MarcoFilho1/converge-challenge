import { describe, expect, it } from "vitest";
import { BLOCKS, CRISIS_SPEECH, DEFAULT_PRAZO, PROTOCOL_VERSION, REPEAT_PREFIX, renderText } from "@/lib/interview/protocol";
import { hasAdvice } from "@/lib/interview/filters";
import { assertNoForbidden } from "@/lib/ai/forbidden-terms";

const ids = (b: keyof typeof BLOCKS) => BLOCKS[b].probes.map((p) => p.id);

describe("protocolo v0", () => {
  it("tem os 6 blocos e segurança não tem sondas", () => {
    expect(Object.keys(BLOCKS).sort()).toEqual(["abertura", "barreiras", "fechamento", "saude", "seguranca", "trabalho"]);
    expect(BLOCKS.seguranca.probes).toEqual([]);
    expect(PROTOCOL_VERSION).toBe("v0-nao-assinado");
  });

  it("sondas por bloco na ordem", () => {
    expect(ids("saude")).toEqual(["desdeQuando", "frequencia", "piora", "alivia", "procurou", "tratamento"]);
    expect(ids("trabalho")).toEqual(["quandoMudou", "carga", "pausa", "chefia", "oQueFaltaria"]);
    expect(ids("barreiras")).toEqual(["horarioGarantido", "pertoOuOnline", "medoEmpresa"]);
  });

  it("maxTurns por bloco", () => {
    expect(Object.fromEntries(Object.values(BLOCKS).map((b) => [b.id, b.maxTurns]))).toEqual({
      abertura: 1, saude: 4, trabalho: 4, barreiras: 3, seguranca: 1, fechamento: 1,
    });
  });

  it("nenhum texto fixo tem termo proibido nem conselho", () => {
    const texts = [
      ...Object.values(BLOCKS).flatMap((b) => [b.base, ...b.probes.map((p) => p.text)]),
      CRISIS_SPEECH("Dra. Ana"),
      REPEAT_PREFIX,
    ];
    for (const t of texts) {
      expect(assertNoForbidden(t), t).toEqual([]);
      expect(hasAdvice(t), t).toBe(false);
    }
  });

  it("renderText substitui as variáveis", () => {
    const out = renderText(BLOCKS.abertura.base, { medico: "Dra. Ana", prazo: DEFAULT_PRAZO });
    expect(out).toContain("Dra. Ana");
    expect(out).not.toContain("{");
    expect(renderText(BLOCKS.fechamento.base, { medico: "Dra. Ana", prazo: "uma semana" })).toContain("uma semana");
    expect(CRISIS_SPEECH("Dra. Ana")).toContain("188");
    expect(CRISIS_SPEECH("Dra. Ana")).toContain("192");
  });
});

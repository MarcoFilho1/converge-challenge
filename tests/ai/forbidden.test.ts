import { describe, expect, it } from "vitest";
import { assertNoForbidden } from "@/lib/ai/forbidden-terms";

describe("assertNoForbidden", () => {
  it("encontra rótulos clínicos", () => {
    expect(assertNoForbidden("Você tem burnout")).toEqual(["você tem", "burnout"]);
  });
  it("ignora acento e maiúsculas", () => {
    expect(assertNoForbidden("sugere DEPRESSAO")).toEqual(["depressão"]);
  });
  it("aceita linguagem de indício", () => {
    expect(assertNoForbidden("Relatou cansaço quase todos os dias; indício de esgotamento.")).toEqual([]);
  });
});

describe("assertNoForbidden com textos permitidos", () => {
  it("ignora o termo quando ele faz parte do texto validado de um item", () => {
    const item = "Você tem um alto grau de influência nas decisões sobre o seu trabalho?";
    expect(assertNoForbidden(`Respondeu "0" para: ${item}`, { allow: [item] })).toEqual([]);
  });
  it("continua pegando o termo fora do texto permitido", () => {
    const item = "Você tem um alto grau de influência nas decisões sobre o seu trabalho?";
    expect(assertNoForbidden(`${item} Você tem burnout.`, { allow: [item] })).toEqual(["você tem", "burnout"]);
  });
});

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

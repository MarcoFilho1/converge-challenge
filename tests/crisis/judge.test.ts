import { afterEach, describe, expect, it } from "vitest";
import { assessRisk, negationBeforeRisk, resetRiskJudge, setRiskJudge } from "@/lib/crisis/judge";

afterEach(() => resetRiskJudge());

describe("negação antes da frase de risco", () => {
  it("acha negação nas palavras antes do trecho de risco", () => {
    expect(negationBeforeRisk("não, nunca pensei em me machucar")).toBe(true);
    expect(negationBeforeRisk("jamais pensei em suicídio")).toBe(true);
    expect(negationBeforeRisk("não aguento mais, quero me matar")).toBe(true);
  });

  it("sem negação antes, ou com o 'não' dentro da própria frase de risco, não é caso de negação", () => {
    expect(negationBeforeRisk("penso em me matar")).toBe(false);
    expect(negationBeforeRisk("não quero mais viver")).toBe(false);
    expect(negationBeforeRisk("não vale a pena continuar")).toBe(false);
    expect(negationBeforeRisk("tudo certo por aqui")).toBe(false);
  });
});

describe("avaliação da frase de risco", () => {
  it("sem frase de risco: nada a fazer", async () => {
    expect(await assessRisk("tudo tranquilo")).toBe("sem_risco");
  });

  it("frase de risco sem negação: corte imediato, sem perguntar à IA", async () => {
    let asked = false;
    setRiskJudge(async () => {
      asked = true;
      return "negado";
    });
    expect(await assessRisk("penso em me matar")).toBe("cortar");
    expect(asked).toBe(false);
  });

  it("com negação, a IA decide: afirmado corta, negado segue, ambíguo pede confirmação", async () => {
    setRiskJudge(async () => "afirmado");
    expect(await assessRisk("não aguento mais, quero me matar")).toBe("cortar");
    setRiskJudge(async () => "negado");
    expect(await assessRisk("não, nunca pensei em me machucar")).toBe("seguir");
    setRiskJudge(async () => "ambiguo");
    expect(await assessRisk("não, nunca pensei em me machucar")).toBe("confirmar");
  });

  it("se a IA falhar, pede confirmação: nunca deixa passar por erro", async () => {
    setRiskJudge(async () => {
      throw new Error("fora do ar");
    });
    expect(await assessRisk("não, nunca pensei em me machucar")).toBe("confirmar");
  });

  it("sem IA real (modo simulado), pede confirmação", async () => {
    expect(await assessRisk("não, nunca pensei em me machucar")).toBe("confirmar");
  });
});

import { describe, expect, it } from "vitest";
import { detectCrisis } from "@/lib/crisis/detect";
import { CRISIS_REPLY } from "@/lib/crisis/messages";

const positives = [
  "às vezes penso em me matar",
  "queria tirar minha vida",
  "vou acabar com tudo",
  "acho que não vale a pena viver",
  "NAO AGUENTO MAIS VIVER",
  "quero sumir",
  "tenho vontade de me machucar",
  "já pensei em me cortar",
  "seria melhor morrer",
  "penso em suicídio",
  "me cortei de novo ontem",
  "me machuquei de propósito",
  "já me feri antes",
];

const negatives = [
  "estou cansado demais",
  "não aguento mais esse chefe",
  "quero férias",
  "dormi mal essa semana",
  "tudo bem por aqui",
];

describe("detectCrisis", () => {
  it.each(positives)("dispara para: %s", (text) => {
    expect(detectCrisis(text).hit).toBe(true);
  });

  it.each(negatives)("não dispara para: %s", (text) => {
    expect(detectCrisis(text).hit).toBe(false);
  });

  it("informa qual padrão disparou", () => {
    expect(detectCrisis("penso em me matar").pattern).toBeTruthy();
  });
});

describe("CRISIS_REPLY", () => {
  it("traz CVV 188, SAMU 192 e como continuar", () => {
    expect(CRISIS_REPLY).toContain("188");
    expect(CRISIS_REPLY).toContain("192");
    expect(CRISIS_REPLY).toContain("CONTINUAR");
  });

  it("não usa rótulo clínico", () => {
    expect(CRISIS_REPLY.toLowerCase()).not.toMatch(/depress|burnout|diagn|transtorno|você tem/);
  });
});

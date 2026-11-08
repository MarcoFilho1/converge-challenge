import { describe, expect, it } from "vitest";
import { createMockProvider } from "@/lib/ai/mock";
import { getItems } from "@/lib/instruments";
import type { ReadReplyInput } from "@/lib/ai/types";

const items = getItems(false);
const item = (code: string) => items.find((i) => i.code === code)!;
const ai = createMockProvider();
const read = (over: Partial<ReadReplyInput> & { text: string }) =>
  ai.readReply({ stage: "item", item: null, previous: null, upcoming: [], ...over });

describe("readReply · regra local (mock e reserva quando a IA cai)", () => {
  it("frequência em palavras vira o valor da escala, com o trecho literal", async () => {
    const r = await read({ item: item("PHQ9_1"), text: "Ah, acho que quase todo dia" });
    expect(r).toMatchObject({ intent: "answer", value: 3, source: "regra" });
    expect(r.quote).toBe("quase todo dia");
  });

  it("número no meio da frase não vira valor em escala com rótulos", async () => {
    const r = await read({ item: item("PHQ9_3"), text: "faz 3 meses que durmo mal" });
    expect(r.value).not.toBe(3);
  });

  it("número sozinho não é atalho de opção", async () => {
    const r = await read({ item: item("PHQ9_1"), text: "2" });
    expect(r.value).toBeNull();
    expect(r.intent).toBe("other");
  });

  it("na escala de 0 a 10 o número é a resposta", async () => {
    const r = await read({ item: item("WPAI_Q5"), text: "uns 7" });
    expect(r).toMatchObject({ intent: "answer", value: 7 });
    expect(r.quote).toContain("7");
  });

  it("'quase nunca' no BAT é raramente, não nunca", async () => {
    const r = await read({ item: item("BAT_1"), text: "quase nunca" });
    expect(r.value).toBe(2);
  });

  it("pergunta-tronco: sim e não por extenso", async () => {
    expect((await read({ item: item("TRUNK"), text: "sim, trabalhei gripado" })).value).toBe(2);
    expect((await read({ item: item("TRUNK"), text: "não" })).value).toBe(1);
  });

  it("dúvida sobre a pergunta", async () => {
    expect((await read({ item: item("WPAI_Q5"), text: "o que é produtividade?" })).intent).toBe("doubt");
    expect((await read({ item: item("PHQ9_1"), text: "não entendi a pergunta" })).intent).toBe("doubt");
  });

  it("correção usa a escala do item anterior", async () => {
    const r = await read({ item: item("PHQ9_2"), previous: item("PHQ9_1"), text: "não, quis dizer vários dias" });
    expect(r).toMatchObject({ intent: "correction", value: 1 });
  });

  it("parar e pular", async () => {
    expect((await read({ item: item("PHQ9_1"), text: "quero parar" })).intent).toBe("stop");
    expect((await read({ item: item("PHQ9_1"), text: "prefiro não responder essa" })).intent).toBe("skip");
  });

  it("consentimento em linguagem natural", async () => {
    expect((await read({ stage: "consent", text: "bora, pode mandar" })).intent).toBe("yes");
    expect((await read({ stage: "consent", text: "prefiro não" })).intent).toBe("no");
    expect((await read({ stage: "consent", text: "isso é sigiloso mesmo?" })).intent).toBe("doubt");
  });

  it("confirmação: sim e não", async () => {
    expect((await read({ stage: "confirm", item: item("PHQ9_9"), text: "isso mesmo" })).intent).toBe("yes");
    expect((await read({ stage: "confirm", item: item("PHQ9_9"), text: "não, errado" })).intent).toBe("no");
  });

  it("dois valores diferentes na mesma fala: certeza baixa", async () => {
    const r = await read({ item: item("PHQ9_1"), text: "nenhuma vez, quer dizer, vários dias" });
    expect(r.confidence).toBe("baixa");
  });
});

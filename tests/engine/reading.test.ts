import { describe, expect, it } from "vitest";
import { judgeReading } from "@/lib/engine/reading";
import { getItems } from "@/lib/instruments";
import type { ReplyReading } from "@/lib/ai/types";

const items = getItems(false);
const item = (code: string) => items.find((i) => i.code === code)!;
const r = (over: Partial<ReplyReading>): ReplyReading => ({ intent: "answer", value: null, quote: null, confidence: "alta", mentions: [], source: "ia", ...over });

describe("conferidor: a IA sugere, o código decide", () => {
  it("aceita valor na escala com trecho que existe na fala", () => {
    expect(judgeReading(item("PHQ9_1"), "Acho que quase todo dia", r({ value: 3, quote: "quase todo dia" }))).toEqual({ kind: "accept", value: 3, quote: "quase todo dia", source: "ia" });
  });

  it("sem valor ou fora da escala: descarta", () => {
    expect(judgeReading(item("PHQ9_1"), "sei lá", r({ value: null }))).toEqual({ kind: "reject" });
    expect(judgeReading(item("PHQ9_1"), "quase todo dia", r({ value: 7, quote: "quase todo dia" }))).toEqual({ kind: "reject" });
  });

  it("trecho inventado (não está na fala): descarta", () => {
    expect(judgeReading(item("PHQ9_1"), "ando meio assim", r({ value: 3, quote: "quase todos os dias" }))).toEqual({ kind: "reject" });
  });

  it("trecho só com número em escala com rótulos: descarta", () => {
    expect(judgeReading(item("PHQ9_3"), "faz 3 meses que durmo mal", r({ value: 3, quote: "3" }))).toEqual({ kind: "reject" });
  });

  it("acento e caixa não impedem achar o trecho", () => {
    expect(judgeReading(item("PHQ9_1"), "VÁRIOS dias", r({ value: 1, quote: "vários dias" })).kind).toBe("accept");
  });

  it("item 9: zero só com negação explícita e certeza alta", () => {
    expect(judgeReading(item("PHQ9_9"), "nunca", r({ value: 0, quote: "nunca" })).kind).toBe("accept");
    expect(judgeReading(item("PHQ9_9"), "não, nenhuma vez", r({ value: 0, quote: "nenhuma vez" })).kind).toBe("accept");
    expect(judgeReading(item("PHQ9_9"), "acho que tá tudo bem", r({ value: 0, quote: "tudo bem" })).kind).toBe("confirm");
    expect(judgeReading(item("PHQ9_9"), "nunca", r({ value: 0, quote: "nunca", confidence: "baixa" })).kind).toBe("confirm");
  });

  it("item 9: hesitação ('acho que não', 'talvez não') sempre confirma, mesmo com 'não' e certeza alta", () => {
    expect(judgeReading(item("PHQ9_9"), "acho que não", r({ value: 0, quote: "acho que não" })).kind).toBe("confirm");
    expect(judgeReading(item("PHQ9_9"), "talvez não", r({ value: 0, quote: "não" })).kind).toBe("confirm");
    expect(judgeReading(item("PHQ9_9"), "acredito que nunca", r({ value: 0, quote: "nunca" })).kind).toBe("confirm");
  });

  it("item 9 maior que zero com trecho válido: aceita (o motor trata como crise)", () => {
    expect(judgeReading(item("PHQ9_9"), "às vezes penso nisso", r({ value: 1, quote: "às vezes" })).kind).toBe("accept");
  });

  it("0 a 10 sem número na fala: confirma", () => {
    expect(judgeReading(item("WPAI_Q5"), "afetou bastante", r({ value: 7, quote: "afetou bastante" }))).toEqual({ kind: "confirm", value: 7, quote: "afetou bastante" });
    expect(judgeReading(item("WPAI_Q5"), "uns 7", r({ value: 7, quote: "7" })).kind).toBe("accept");
  });

  it("certeza baixa: confirma", () => {
    expect(judgeReading(item("PHQ9_1"), "nenhuma vez, quer dizer, vários dias", r({ value: 1, quote: "vários dias", confidence: "baixa" })).kind).toBe("confirm");
  });
});

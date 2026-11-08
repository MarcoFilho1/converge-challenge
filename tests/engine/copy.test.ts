import { describe, expect, it } from "vitest";
import { assertNoForbidden } from "@/lib/ai/forbidden-terms";
import { copy, formatItem, optionsLine } from "@/lib/engine/copy";
import { getItems } from "@/lib/instruments";

const items = getItems(false);
const item = (code: string) => items.find((i) => i.code === code)!;
const OPTION_NUMBER = /\b\d+\s*\(?\s*(sim|n[ãa]o|nenhuma vez|nunca|raramente|sempre)\b/i; // "1 sim", "0 nenhuma vez"
/** "0 nenhuma vez", "1 vários dias"…: número seguido do rótulo da opção. */
const numberedLabel = (it: ReturnType<typeof item>) => (it.scale?.labels ?? []).some((l, i) => new RegExp(`\\b${it.scale!.min + i}\\s+${l}`, "i").test(formatItem(it)));

describe("textos do WhatsApp em linguagem natural", () => {
  it("primeira mensagem: enxuta, diz que aceita texto livre e áudio, sem número de opção", () => {
    const t = copy.consent("Ana Teste", false);
    expect(t).toMatch(/do seu jeito/i);
    expect(t).toMatch(/áudio/i);
    expect(t).toMatch(/188/);
    expect(t).toMatch(/192/);
    expect(t).not.toMatch(OPTION_NUMBER);
    expect(t.split("\n").filter((l) => l.trim()).length).toBeLessThanOrEqual(9);
  });

  it("nenhuma pergunta mostra número de opção, exceto a escala de 0 a 10", () => {
    for (const it of items.filter((i) => i.scale)) {
      const text = formatItem(it);
      if (it.code === "WPAI_Q5") expect(text).toMatch(/0 a 10/);
      else {
        expect(text).not.toMatch(OPTION_NUMBER);
        expect(numberedLabel(it)).toBe(false);
      }
    }
  });

  it("as opções aparecem por extenso; pergunta-tronco na ordem do consentimento", () => {
    expect(optionsLine(item("PHQ9_1"))).toBe("nenhuma vez · vários dias · mais da metade dos dias · quase todos os dias");
    expect(optionsLine(item("TRUNK"))).toBe("sim · não");
  });

  it("confirmação diz o que foi entendido; repetição traz as opções", () => {
    expect(copy.confirm(item("PHQ9_1"), 1)).toMatch(/vários dias/);
    expect(copy.confirm(item("WPAI_Q5"), 7)).toMatch(/7 de 10/);
    expect(copy.repeat(item("BAT_1"))).toContain(optionsLine(item("BAT_1")));
  });

  it("sem eco do áudio e sem pedir número", () => {
    expect("heardAudio" in copy).toBe(false);
    for (const v of Object.values(copy)) if (typeof v === "string") expect(v).not.toMatch(/(responda|responder) com o \*?n[úu]mero/i);
    expect(copy.opening).not.toMatch(/n[úu]mero/i);
  });

  it("dúvida usa a linha de apoio fixa; item 9 tem explicação própria, sem texto gerado", () => {
    expect(copy.doubt(item("WPAI_Q5"))).toBe(item("WPAI_Q5").help);
    expect(copy.doubt(item("PHQ9_9"))).toMatch(/2 semanas/);
  });

  it("nenhum texto novo usa termo proibido", () => {
    const all = [copy.consent("Ana", true), copy.consentRepeat, copy.consentDoubt, copy.opening, copy.corrected, copy.bridge, copy.repeat(item("PHQ9_1")), copy.confirm(item("PHQ9_9"), 0), copy.doubt(item("GAD7_1"))];
    for (const t of all) expect(assertNoForbidden(t)).toEqual([]);
  });
});

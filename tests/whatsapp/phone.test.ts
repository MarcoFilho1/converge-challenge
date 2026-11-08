import { describe, expect, it } from "vitest";
import { jidToPhone, toE164 } from "@/lib/whatsapp/phone";

describe("toE164", () => {
  it("adiciona 55 a número brasileiro com DDD", () => {
    expect(toE164("(81) 99999-0000")).toBe("5581999990000");
  });
  it("mantém número que já tem 55", () => {
    expect(toE164("+55 81 99999-0000")).toBe("5581999990000");
  });
  it("aceita fixo de 10 dígitos", () => {
    expect(toE164("81 3333-4444")).toBe("558133334444");
  });
  it("recusa número inválido", () => {
    expect(toE164("1234")).toBeNull();
    expect(toE164("abc")).toBeNull();
  });
});

describe("jidToPhone", () => {
  it("tira o sufixo do WhatsApp", () => {
    expect(jidToPhone("5581999990000@s.whatsapp.net")).toBe("5581999990000");
  });
  it("tira o sufixo de dispositivo", () => {
    expect(jidToPhone("5581999990000:12@s.whatsapp.net")).toBe("5581999990000");
  });
});

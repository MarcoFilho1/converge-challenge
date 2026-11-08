import { describe, expect, it } from "vitest";
import { formatWhen } from "@/lib/case/when";

const now = new Date("2026-11-08T03:00:00Z"); // 00:00 em Recife (UTC-3)

describe("formatWhen (fuso de Recife)", () => {
  it("virada do dia conta pelo fuso de Recife", () => expect(formatWhen("2026-11-08T02:41:00Z", now)).toBe("ontem, 23:41"));
  it("hoje cedo", () => expect(formatWhen("2026-11-08T03:05:00Z", new Date("2026-11-08T12:00:00Z"))).toBe("hoje, 00:05"));
  it("ontem", () => expect(formatWhen("2026-11-07T20:12:00Z", new Date("2026-11-08T12:00:00Z"))).toBe("ontem, 17:12"));
  it("antes de ontem vira data", () => expect(formatWhen("2026-11-05T13:00:00Z", new Date("2026-11-08T12:00:00Z"))).toBe("05/11, 10:00"));
});

import { describe, expect, it } from "vitest";
import { groupTrail } from "@/lib/obs/trail-groups";
import type { TrailItem } from "@/lib/demo/fixtures";

const t = (id: string, over: Partial<TrailItem>): TrailItem => ({
  id, at: "2026-11-08T10:00:00Z", kind: "x", outcome: "ok", model: null, latencyMs: null, costUsd: null, tokensIn: null, tokensOut: null,
  detail: null, inInterview: false, waMessageId: null, message: null, ...over,
});

describe("rastro do Caso agrupado por mensagem", () => {
  it("junta os passos de cada mensagem, na ordem em que a mensagem apareceu, com custo, chamadas de IA e tempo de resposta", () => {
    const groups = groupTrail([
      t("1", { kind: "gravidade" }),
      t("2", { kind: "transcrição do áudio", waMessageId: "w1", message: { text: "sim", viaAudio: true, at: "10:01" } }),
      t("3", { kind: "ler resposta", waMessageId: "w1", model: "featherless:k#1", costUsd: 0.0008 }),
      t("4", { kind: "ler resposta", waMessageId: "w2", model: "featherless:k#1", costUsd: 0.0009, message: { text: "uns 7", viaAudio: false, at: "10:02" } }),
      t("5", { kind: "indício", waMessageId: "w1", model: "featherless:k#1", costUsd: 0.002 }),
      t("6", { kind: "resposta no WhatsApp", waMessageId: "w1", latencyMs: 8800 }),
    ]);
    expect(groups.map((g) => (g.kind === "message" ? g.waMessageId : g.item.id))).toEqual(["1", "w1", "w2"]);
    const w1 = groups[1];
    expect(w1.kind === "message" && w1).toMatchObject({ text: "sim", viaAudio: true, aiCalls: 2, replyMs: 8800 });
    expect(w1.kind === "message" && w1.costUsd).toBeCloseTo(0.0028);
    expect(w1.kind === "message" && w1.items.map((i) => i.id)).toEqual(["2", "3", "5", "6"]);
  });

  it("sem id de mensagem, cada passo fica solto como antes", () => {
    const groups = groupTrail([t("1", {}), t("2", { inInterview: true })]);
    expect(groups.every((g) => g.kind === "step")).toBe(true);
  });
});

import { describe, expect, it, vi } from "vitest";
import { createInterviewGateway } from "@/lib/ai/interview-gateway";
import { getInterviewAi } from "@/lib/ai/interview";
import { createInterviewMock } from "@/lib/ai/interview-mock";
import { ACK_SYSTEM, EXTRACT_SYSTEM, INTERVIEW_SUMMARY_SYSTEM } from "@/lib/ai/interview-prompts";

const probe = "Desde quando é assim?";

describe("gateway da entrevista", () => {
  it("sem chave, cai no mock sem lançar", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    delete process.env.AI_GATEWAY_API_KEY;
    const ai = createInterviewGateway();
    const ack = await ai.phraseAck({ lastText: "cansaço", findings: [], probeText: probe });
    expect(typeof ack).toBe("string");
    const f = await ai.extractFindings({ blockId: "saude", probeText: probe, text: "cansaço há 3 meses" });
    expect(f[0]).toMatchObject({ tema: "sintoma" });
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("getInterviewAi devolve o gateway real em AI_PROVIDER=featherless", () => {
    process.env.AI_PROVIDER = "featherless";
    const ai = getInterviewAi();
    expect(ai.phraseAck.toString()).toBe(createInterviewGateway().phraseAck.toString());
    process.env.AI_PROVIDER = "mock";
  });

  it("getInterviewAi devolve o mock em AI_PROVIDER=mock", () => {
    process.env.AI_PROVIDER = "mock";
    const ai = getInterviewAi();
    expect(ai.phraseAck.toString()).toBe(createInterviewMock().phraseAck.toString());
  });

  it("prompts carregam as regras de linguagem e proíbem conselho", () => {
    for (const p of [EXTRACT_SYSTEM, ACK_SYSTEM, INTERVIEW_SUMMARY_SYSTEM]) expect(p).toContain("indício");
    expect(ACK_SYSTEM).toMatch(/15 palavras/);
    expect(INTERVIEW_SUMMARY_SYSTEM).toContain("turnIdx");
  });
});

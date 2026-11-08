import { describe, expect, it, vi } from "vitest";
import { assertNoForbidden } from "@/lib/ai/forbidden-terms";
import { doctorNotice, noticeKind, notifyDoctor, type NoticeKind } from "@/lib/interview/notify";
import type { InterviewState } from "@/lib/interview/engine";

const URL = "https://demo.example/caso/abc";

function fakeState(over: Partial<InterviewState>): InterviewState {
  return { status: "done", turns: [], avisos: [], ...over } as unknown as InterviewState;
}
const person = { idx: 1, speaker: "person", text: "oi", blockId: "abertura", probeId: null, startedMs: 0, durationMs: 1000 };

describe("aviso ao médico pelo WhatsApp", () => {
  it("cada fim tem sua frase, com o nome e o link do Caso", () => {
    const kinds: NoticeKind[] = ["done", "stopped", "abandoned", "declined", "crisis"];
    for (const kind of kinds) {
      const text = doctorNotice({ kind, contactName: "Ana Teste", caseUrl: URL });
      expect(text).toContain("Ana Teste");
      expect(text).toContain(URL);
      expect(assertNoForbidden(text)).toEqual([]);
    }
    expect(doctorNotice({ kind: "done", contactName: "Ana", caseUrl: URL })).toMatch(/terminou a entrevista/);
    expect(doctorNotice({ kind: "abandoned", contactName: "Ana", caseUrl: URL })).toMatch(/página fechada ou conexão perdida/);
    expect(doctorNotice({ kind: "declined", contactName: "Ana", caseUrl: URL })).toMatch(/preferiu não fazer/);
  });

  it("nenhum dado clínico na mensagem, nem na crise", () => {
    const crisis = doctorNotice({ kind: "crisis", contactName: "Ana", caseUrl: URL });
    expect(crisis).toMatch(/hoje/);
    for (const kind of ["done", "stopped", "abandoned", "declined", "crisis"] as NoticeKind[]) {
      const text = doctorNotice({ kind, contactName: "Ana", caseUrl: URL }).toLowerCase();
      for (const word of ["risco", "crise", "suic", "morte", "matar", "cvv", "phq", "sintoma", "ansiedade", "cansaço", "esgotamento"]) {
        expect(text).not.toContain(word);
      }
    }
  });

  it("descobre o tipo de fim pelo estado", () => {
    expect(noticeKind(fakeState({ status: "done", turns: [person] as never }))).toBe("done");
    expect(noticeKind(fakeState({ status: "crisis", turns: [person] as never }))).toBe("crisis");
    expect(noticeKind(fakeState({ status: "stopped", turns: [person] as never }))).toBe("stopped");
    expect(noticeKind(fakeState({ status: "stopped", turns: [] }))).toBe("declined");
    expect(noticeKind(fakeState({ status: "stopped", turns: [person] as never, endReason: "abandonada" }))).toBe("abandoned");
  });

  it("envia para o número do médico; sem número ou sem caso, não envia", async () => {
    const send = vi.fn().mockResolvedValue({ waMessageId: "x" });
    const lookupName = vi.fn().mockResolvedValue("Ana Teste");
    const state = fakeState({ status: "done", turns: [person] as never });

    expect(await notifyDoctor({ runId: "run-1", interviewId: "i-1", state }, { send, lookupName, doctorPhone: "81 99999-0001", baseUrl: "https://demo.example/" })).toBe("enviado");
    expect(send).toHaveBeenCalledWith("5581999990001", expect.stringContaining("https://demo.example/caso/run-1"));

    send.mockClear();
    expect(await notifyDoctor({ runId: "run-1", interviewId: "i-1", state }, { send, lookupName, doctorPhone: "", baseUrl: "https://demo.example" })).toBe("sem_numero");
    expect(await notifyDoctor({ runId: null, interviewId: "i-1", state }, { send, lookupName, doctorPhone: "81999990001", baseUrl: "https://demo.example" })).toBe("sem_caso");
    expect(send).not.toHaveBeenCalled();
  });

  it("falha no WhatsApp não lança erro", async () => {
    const send = vi.fn().mockRejectedValue(new Error("desconectado"));
    const state = fakeState({ status: "done", turns: [person] as never });
    await expect(notifyDoctor({ runId: "run-1", interviewId: "i-1", state }, { send, lookupName: async () => "Ana", doctorPhone: "81999990001", baseUrl: "https://x" })).resolves.toBe("erro");
  });
});

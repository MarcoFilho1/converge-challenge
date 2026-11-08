import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { pushSchemaToTestDb, truncateAll } from "../helpers/db";
import { createInterviewMock } from "@/lib/ai/interview-mock";
import { createNoVoice } from "@/lib/voice/none";
import { abandon, lastActivityMs, ABANDON_AVISO_PREFIX, type InterviewState } from "@/lib/interview/engine";

process.env.INTERVIEW_PUBLIC_URL = "http://localhost:3100";

const MIN = 60_000;

async function makeService(clock: { t: number }, notify = vi.fn().mockResolvedValue(undefined)) {
  const { createInterviewService } = await import("@/lib/interview/service");
  const svc = createInterviewService({
    voice: createNoVoice(), ai: createInterviewMock(), dataRoot: mkdtempSync(join(tmpdir(), "ab-")), profile: "teste",
    now: () => clock.t, idleMs: 10 * MIN, notify,
  });
  return { svc, notify };
}

async function makeRun() {
  const { db } = await import("@/db/client");
  const { contacts, questionnaireRuns } = await import("@/db/schema");
  const [c] = await db.insert(contacts).values({ name: "Ana Teste", phoneE164: "5581999990019", sector: "Atendimento" }).returning();
  const [run] = await db.insert(questionnaireRuns).values({ contactId: c.id, severity: "priority", status: "done", demoShort: true }).returning();
  return run;
}

describe("abandon (motor puro)", () => {
  const base = {
    status: "running", startedMs: 1_000_000, endedMs: null, currentProbeId: "saude:base", avisos: [],
    turns: [
      { idx: 0, speaker: "ai", text: "Oi", blockId: "abertura", probeId: null, startedMs: 0, durationMs: null },
      { idx: 1, speaker: "person", text: "pode", blockId: "abertura", probeId: null, startedMs: 5_000, durationMs: 2_000 },
      { idx: 2, speaker: "ai", text: "Como anda?", blockId: "saude", probeId: "saude:base", startedMs: 9_000, durationMs: null },
    ],
  } as unknown as InterviewState;

  it("última atividade = início + fim do último turno", () => {
    expect(lastActivityMs(base)).toBe(1_009_000);
  });

  it("encerra sem turno novo, com aviso e fim na última atividade", () => {
    const s = abandon(base);
    expect(s.status).toBe("stopped");
    expect(s.endReason).toBe("abandonada");
    expect(s.endedMs).toBe(1_009_000);
    expect(s.currentProbeId).toBeNull();
    expect(s.turns).toHaveLength(3);
    expect(s.avisos.at(-1)?.texto.startsWith(ABANDON_AVISO_PREFIX)).toBe(true);
    expect(s.avisos.at(-1)?.turnIdxs).toEqual([]);
  });
});

describe("entrevista abandonada vira resumo e aviso", () => {
  beforeAll(() => pushSchemaToTestDb());
  beforeEach(async () => truncateAll());

  it("parada há mais de 10 min: encerra, gera resumo e avisa o médico uma vez", async () => {
    const clock = { t: 10_000_000 };
    const { svc, notify } = await makeService(clock);
    const run = await makeRun();
    const invite = await svc.createInvite(run.id);
    const token = invite.inviteUrl.split("/").pop()!;
    await svc.start(token, true);
    clock.t += 20_000;
    await svc.turn(token, { text: "um cansaço grande há três meses" });

    const turnsBefore = (await svc.detail(invite.id))!.turns.length;
    clock.t += 9 * MIN;
    expect(await svc.closeIdle()).toBe(0);

    clock.t += 2 * MIN;
    expect(await svc.closeIdle()).toBe(1);
    expect(await svc.closeIdle()).toBe(0);

    const detail = await svc.detail(invite.id);
    expect(detail?.status).toBe("stopped");
    expect(detail?.summary).not.toBeNull();
    expect(detail?.summary?.avisos.some((a) => a.texto.startsWith(ABANDON_AVISO_PREFIX))).toBe(true);
    expect(detail?.turns).toHaveLength(turnsBefore); // nenhuma fala nova da Helena
    expect(detail?.durationMs).toBeLessThan(MIN);

    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify.mock.calls[0][0]).toMatchObject({ runId: run.id, interviewId: invite.id });
    expect(notify.mock.calls[0][0].state.endReason).toBe("abandonada");

    const { InterviewConflict } = await import("@/lib/interview/service");
    await expect(svc.turn(token, { text: "voltei" })).rejects.toBeInstanceOf(InterviewConflict);
  });

  it("convite não aceito não é encerrado", async () => {
    const clock = { t: 10_000_000 };
    const { svc } = await makeService(clock);
    await svc.createInvite(null, { fixture: "prioridade" });
    clock.t += 60 * MIN;
    expect(await svc.closeIdle()).toBe(0);
  });

  it("fim normal também avisa o médico, uma vez", async () => {
    const clock = { t: 10_000_000 };
    const { svc, notify } = await makeService(clock);
    const run = await makeRun();
    const invite = await svc.createInvite(run.id);
    const token = invite.inviteUrl.split("/").pop()!;
    await svc.start(token, true);
    expect(notify).not.toHaveBeenCalled();
    await svc.stop(token);
    await vi.waitFor(() => expect(notify).toHaveBeenCalledTimes(1));
    expect(notify.mock.calls[0][0].state.status).toBe("stopped");
  });

  it("falha no aviso não derruba o fim da entrevista", async () => {
    const clock = { t: 10_000_000 };
    const { svc } = await makeService(clock, vi.fn().mockRejectedValue(new Error("whatsapp fora")));
    const run = await makeRun();
    const token = (await svc.createInvite(run.id)).inviteUrl.split("/").pop()!;
    await svc.start(token, true);
    await expect(svc.stop(token)).resolves.toMatchObject({ status: "stopped", final: true });
  });
});

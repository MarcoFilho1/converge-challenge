import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { pushSchemaToTestDb, truncateAll } from "../helpers/db";
import { createState } from "@/lib/interview/engine";
import { FIXTURES } from "@/lib/interview/fixtures";

describe("repositório da entrevista", () => {
  beforeAll(() => pushSchemaToTestDb());
  beforeEach(async () => truncateAll());

  it("cria, lê por token e salva estado com lock otimista", async () => {
    const repo = await import("@/lib/interview/repo");
    const state = createState(FIXTURES.atencao, { mode: "live", nowMs: 1000 });
    const created = await repo.createInterview({ runId: null, token: "tok-1", state, profile: null });
    expect(created.id).toBeTruthy();
    const byToken = await repo.getInterviewByToken("tok-1");
    expect(byToken?.id).toBe(created.id);
    expect(byToken?.status).toBe("consent");
    expect(await repo.getInterviewByToken("nope")).toBeNull();

    const next = { ...state, status: "running" as const, turns: [{ idx: 0, speaker: "ai" as const, text: "oi", blockId: "abertura" as const, probeId: null, startedMs: 0, durationMs: null }] };
    expect(await repo.saveState(created.id, next, 0)).toBe(true);
    expect(await repo.saveState(created.id, next, 0)).toBe(false); // agora há 1 turno; expectedTurns 0 é conflito
    expect((await repo.getInterview(created.id))?.status).toBe("running");
  });

  it("turnos: insere, lista em ordem e rejeita idx duplicado", async () => {
    const repo = await import("@/lib/interview/repo");
    const state = createState(FIXTURES.atencao, { mode: "live", nowMs: 1000 });
    const { id } = await repo.createInterview({ runId: null, token: "tok-2", state, profile: null });
    await repo.insertTurn(id, { idx: 0, speaker: "ai", text: "oi", blockId: "abertura", probeId: null, startedMs: 0, durationMs: null });
    await repo.insertTurn(id, { idx: 1, speaker: "person", text: "pode", blockId: "abertura", probeId: null, startedMs: 4000, durationMs: 1000, audioPath: "data/x.wav" });
    const turns = await repo.listTurns(id);
    expect(turns.map((t) => t.idx)).toEqual([0, 1]);
    expect(turns[1].audioPath).toBe("data/x.wav");
    await expect(repo.insertTurn(id, { idx: 1, speaker: "ai", text: "dup", blockId: "abertura", probeId: null, startedMs: 0, durationMs: null })).rejects.toThrow();
  });

  it("resumo e lista por run; crise marca urgência no run", async () => {
    const repo = await import("@/lib/interview/repo");
    const { db } = await import("@/db/client");
    const { contacts, questionnaireRuns } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    const [c] = await db.insert(contacts).values({ name: "Teste", phoneE164: "5581999990002" }).returning();
    const [run] = await db.insert(questionnaireRuns).values({ contactId: c.id, severity: "priority" }).returning();

    const state = createState(FIXTURES.prioridade, { mode: "live", nowMs: 1000 });
    const { id } = await repo.createInterview({ runId: run.id, token: "tok-3", state, profile: "helena" });
    await repo.saveSummary(id, { dificuldades_relatadas: [], impacto_no_trabalho: [], fatores_do_trabalho: [], barreiras_atendimento: [], sinais_de_alerta: { risco: false, origem: [] }, pontos_para_avaliacao: [], nao_respondido: [], duracao_min: 1, turnos: 1 });
    expect((await repo.getSummary(id))?.turnos).toBe(1);
    expect((await repo.listByRun(run.id)).map((i) => i.id)).toEqual([id]);

    await repo.markRunUrgency(run.id);
    const [after] = await db.select().from(questionnaireRuns).where(eq(questionnaireRuns.id, run.id));
    expect(after.severity).toBe("urgency");
  });
});

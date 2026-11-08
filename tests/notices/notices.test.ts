import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { pushSchemaToTestDb, truncateAll } from "../helpers/db";

beforeAll(() => pushSchemaToTestDb());
beforeEach(async () => {
  await truncateAll();
});

describe("avisos da médica no painel", () => {
  it("grava, lista do mais novo para o mais antigo, conta os não lidos e marca como lidos", async () => {
    const { saveNotice, listNotices, countUnread, markAllRead } = await import("@/lib/notices/store");
    await saveNotice({ kind: "done", contactName: "Ana Teste", runId: null, interviewId: null, text: "Ana Teste terminou a entrevista com a Helena." });
    await new Promise((r) => setTimeout(r, 5));
    await saveNotice({ kind: "crisis", contactName: "Bia Teste", runId: null, interviewId: null, text: "A entrevista de Bia Teste precisa da sua atenção hoje." });
    const list = await listNotices();
    expect(list.map((n) => n.contactName)).toEqual(["Bia Teste", "Ana Teste"]);
    expect(await countUnread()).toBe(2);
    await markAllRead();
    expect(await countUnread()).toBe(0);
    expect((await listNotices())[0].readAt).not.toBeNull();
  });

  it("o fim da entrevista gera o aviso no painel mesmo sem o WhatsApp da médica configurado", async () => {
    const { notifyDoctor } = await import("@/lib/interview/notify");
    const saved: { kind: string; contactName: string }[] = [];
    const r = await notifyDoctor(
      { runId: "00000000-0000-4000-8000-000000000001", interviewId: "00000000-0000-4000-8000-000000000002", state: { status: "done", turns: [], avisos: [] } as never },
      { doctorPhone: "", lookupName: async () => "Ana Teste", saveNotice: async (n) => void saved.push(n) },
    );
    expect(r).toBe("sem_numero");
    expect(saved).toEqual([expect.objectContaining({ kind: "done", contactName: "Ana Teste" })]);
  });
});

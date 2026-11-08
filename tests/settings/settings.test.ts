import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { pushSchemaToTestDb, truncateAll } from "../helpers/db";

beforeAll(() => pushSchemaToTestDb());
beforeEach(async () => {
  await truncateAll();
  (await import("@/lib/settings")).resetSettingsCache();
});
afterEach(() => vi.unstubAllEnvs());

describe("configurações da médica", () => {
  it("sem nada salvo, usa o padrão (do .env ou do código): limite 70, convite automático ligado, disparo desligado", async () => {
    const { getSettings } = await import("@/lib/settings");
    const s = await getSettings();
    expect(s.inviteThreshold).toBe(70);
    expect(s.autoInvite).toBe(true);
    expect(s.autoDispatch).toBe(false);
    expect(s.autoDispatchDays).toBe(30);
    expect(s.idleMinutes).toBe(10);
  });

  it("o que a médica salva vale mais que o .env, na hora", async () => {
    vi.stubEnv("INTERVIEW_INVITE_THRESHOLD", "70");
    const { getSettings, saveSettings } = await import("@/lib/settings");
    await saveSettings({ inviteThreshold: 60, inviteAll: true });
    const s = await getSettings();
    expect(s.inviteThreshold).toBe(60);
    expect(s.inviteAll).toBe(true);
  });

  it("valida: limite de 0 a 100, minutos de 1 a 120, telefone com DDD", async () => {
    const { saveSettings } = await import("@/lib/settings");
    await expect(saveSettings({ inviteThreshold: 150 })).rejects.toThrow(/0 a 100/);
    await expect(saveSettings({ inviteThreshold: Number.NaN })).rejects.toThrow(/0 a 100/);
    await expect(saveSettings({ idleMinutes: 0 })).rejects.toThrow(/1 a 120/);
    await expect(saveSettings({ doctorWhatsapp: "123" })).rejects.toThrow(/telefone/i);
    await expect(saveSettings({ doctorWhatsapp: "(81) 99999-0001" })).resolves.toBeTruthy();
  });

  it("cada mudança vai para o rastro com o valor antigo e o novo", async () => {
    const { saveSettings } = await import("@/lib/settings");
    await saveSettings({ inviteThreshold: 55, autoInvite: false });
    const { settleEvents } = await import("@/lib/obs/events");
    await settleEvents();
    const { db } = await import("@/db/client");
    const { agentEvents } = await import("@/db/schema");
    const rows = await db.select().from(agentEvents).where(eq(agentEvents.kind, "configuração"));
    expect(rows[0]?.detail).toMatch(/limite do índice: 70 → 55/);
    expect(rows[0]?.detail).toMatch(/convite automático: ligado → desligado/);
  });

  it("voltar ao padrão apaga o que foi salvo", async () => {
    const { getSettings, saveSettings, resetSettings } = await import("@/lib/settings");
    await saveSettings({ inviteThreshold: 40 });
    await resetSettings();
    expect((await getSettings()).inviteThreshold).toBe(70);
  });
});

describe("as configurações mudam o que o sistema faz", () => {
  async function demoRun(phone: string, answers: string[]) {
    const { db } = await import("@/db/client");
    const { contacts } = await import("@/db/schema");
    const [c] = await db.insert(contacts).values({ name: "Pessoa Config", phoneE164: phone }).returning();
    const { startRun, handleIncoming } = await import("@/lib/engine/engine");
    await startRun(c.id, { demoShort: true });
    let k = 0;
    let last;
    for (const t of ["sim", ...answers]) last = await handleIncoming({ phone, text: t, waMessageId: `cfg-${phone}-${k++}` });
    return last!;
  }

  it("convite automático desligado: nem quem precisa recebe o convite", async () => {
    const { saveSettings } = await import("@/lib/settings");
    await saveSettings({ autoInvite: false });
    const last = await demoRun("5581944440001", ["sim", "7", "com frequência", "mais da metade dos dias", "mais da metade dos dias", "nunca", "sempre", "as metas dobraram"]);
    expect(last.outbound.join(" ")).not.toMatch(/Helena/);
  });

  it("entrevista para todos ligada: quem está bem também é convidado", async () => {
    const { saveSettings } = await import("@/lib/settings");
    await saveSettings({ inviteAll: true });
    const last = await demoRun("5581944440002", ["não", "0", "nunca", "nenhuma vez", "nenhuma vez", "nunca", "raramente", "tudo tranquilo"]);
    expect(last.outbound.join(" ")).toMatch(/demonstração/i);
  });

  it("limite digitado muda quem é convidado (sem indício e índice 74: convida com limite 80)", async () => {
    const { saveSettings } = await import("@/lib/settings");
    await saveSettings({ inviteThreshold: 80 });
    const last = await demoRun("5581944440003", ["não", "2", "raramente", "vários dias", "vários dias", "nenhuma vez", "às vezes", "nada de mais"]);
    expect(last.outbound.join(" ")).toMatch(/Helena/);
    expect(last.outbound.join(" ")).not.toMatch(/demonstração/i);
  });

  it("as mesmas respostas com o limite padrão 70: índice 74 não convida", async () => {
    const last = await demoRun("5581944440004", ["não", "2", "raramente", "vários dias", "vários dias", "nenhuma vez", "às vezes", "nada de mais"]);
    expect(last.outbound.join(" ")).not.toMatch(/Helena/);
  });

  it("aviso também ao participante (demo): quem fez a entrevista recebe o aviso que iria para a médica", async () => {
    const { saveSettings } = await import("@/lib/settings");
    await saveSettings({ notifyParticipant: true, doctorWhatsapp: "" });
    const { notifyDoctor } = await import("@/lib/interview/notify");
    const sent: { phone: string; text: string }[] = [];
    await notifyDoctor(
      { runId: "00000000-0000-4000-8000-000000000009", interviewId: "00000000-0000-4000-8000-000000000010", state: { status: "done", turns: [], avisos: [] } as never },
      {
        lookupContact: async () => ({ name: "Jurado", phone: "5581955550001" }),
        saveNotice: async () => {},
        send: async (phone, text) => void sent.push({ phone, text }),
      },
    );
    expect(sent).toHaveLength(1);
    expect(sent[0].phone).toBe("5581955550001");
    expect(sent[0].text).toMatch(/demonstração/i);
    expect(sent[0].text).toMatch(/terminou a entrevista/);
  });
});

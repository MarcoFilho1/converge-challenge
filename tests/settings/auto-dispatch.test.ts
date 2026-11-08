import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { pushSchemaToTestDb, truncateAll } from "../helpers/db";

beforeAll(() => pushSchemaToTestDb());
beforeEach(async () => {
  await truncateAll();
  (await import("@/lib/settings")).resetSettingsCache();
});

const WEEKDAY_10H = new Date("2026-11-10T13:00:00Z"); // terça, 10h em Recife
const WEEKDAY_22H = new Date("2026-11-11T01:00:00Z"); // terça, 22h em Recife
const SUNDAY_10H = new Date("2026-11-08T13:00:00Z");

describe("disparo automático do questionário", () => {
  it("só em dia útil, das 9h às 18h no horário de Recife", async () => {
    const { withinBusinessHours } = await import("@/lib/dispatch/auto");
    expect(withinBusinessHours(WEEKDAY_10H)).toBe(true);
    expect(withinBusinessHours(WEEKDAY_22H)).toBe(false);
    expect(withinBusinessHours(SUNDAY_10H)).toBe(false);
  });

  it("desligado nas configurações: não manda nada", async () => {
    const { db } = await import("@/db/client");
    const { contacts } = await import("@/db/schema");
    await db.insert(contacts).values({ name: "Nunca respondeu", phoneE164: "5581966660001" });
    const { runAutoDispatch } = await import("@/lib/dispatch/auto");
    const sent: string[] = [];
    expect(await runAutoDispatch({ now: WEEKDAY_10H, send: async (p) => void sent.push(p) })).toBe(0);
    expect(sent).toEqual([]);
  });

  it("ligado: manda para quem nunca respondeu ou respondeu há mais de N dias, e pula quem respondeu há pouco", async () => {
    const { db } = await import("@/db/client");
    const { contacts, questionnaireRuns } = await import("@/db/schema");
    const [never] = await db.insert(contacts).values({ name: "Nunca", phoneE164: "5581966660002" }).returning();
    const [old] = await db.insert(contacts).values({ name: "Antigo", phoneE164: "5581966660003" }).returning();
    const [recent] = await db.insert(contacts).values({ name: "Recente", phoneE164: "5581966660004" }).returning();
    const day = 86_400_000;
    await db.insert(questionnaireRuns).values({ contactId: old.id, status: "done", startedAt: new Date(WEEKDAY_10H.getTime() - 40 * day), finishedAt: new Date(WEEKDAY_10H.getTime() - 40 * day) });
    await db.insert(questionnaireRuns).values({ contactId: recent.id, status: "done", startedAt: new Date(WEEKDAY_10H.getTime() - 5 * day), finishedAt: new Date(WEEKDAY_10H.getTime() - 5 * day) });
    const { saveSettings } = await import("@/lib/settings");
    await saveSettings({ autoDispatch: true, autoDispatchDays: 30 });
    const { runAutoDispatch } = await import("@/lib/dispatch/auto");
    const sent: string[] = [];
    const n = await runAutoDispatch({ now: WEEKDAY_10H, send: async (p) => void sent.push(p) });
    expect(n).toBe(2);
    expect(sent.sort()).toEqual([never.phoneE164, old.phoneE164].sort());
    expect(sent).not.toContain(recent.phoneE164);
  });

  it("fora do horário comercial, mesmo ligado, espera", async () => {
    const { db } = await import("@/db/client");
    const { contacts } = await import("@/db/schema");
    await db.insert(contacts).values({ name: "Nunca", phoneE164: "5581966660005" });
    const { saveSettings } = await import("@/lib/settings");
    await saveSettings({ autoDispatch: true });
    const { runAutoDispatch } = await import("@/lib/dispatch/auto");
    expect(await runAutoDispatch({ now: WEEKDAY_22H, send: async () => {} })).toBe(0);
  });

  it("respeita o limite por rodada, para o número do bot não ser bloqueado", async () => {
    const { db } = await import("@/db/client");
    const { contacts } = await import("@/db/schema");
    for (let i = 0; i < 5; i++) await db.insert(contacts).values({ name: `P${i}`, phoneE164: `558196667000${i}` });
    const { saveSettings } = await import("@/lib/settings");
    await saveSettings({ autoDispatch: true });
    const { runAutoDispatch } = await import("@/lib/dispatch/auto");
    expect(await runAutoDispatch({ now: WEEKDAY_10H, send: async () => {}, maxPerRun: 3 })).toBe(3);
  });
});

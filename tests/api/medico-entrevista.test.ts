import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { pushSchemaToTestDb, truncateAll } from "../helpers/db";
import { InterviewDetail, InterviewListItem } from "@/lib/interview/contract";

process.env.INTERVIEW_PUBLIC_URL = "http://localhost:3100";
process.env.VOICE_PROVIDER = "none";
process.env.VOICEBOX_PROFILE_ID = ""; // não usar o cache local de falas da Helena

const COOKIE = { cookie: "session=ok" };
const P = <T,>(params: T) => ({ params: Promise.resolve(params) });
const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("http://x", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
const get = (headers: Record<string, string> = {}) => new Request("http://x", { headers });

async function makeRun() {
  const { db } = await import("@/db/client");
  const { contacts, questionnaireRuns } = await import("@/db/schema");
  const [c] = await db.insert(contacts).values({ name: "Bia Teste", phoneE164: "5581999990011", sector: "Logística" }).returning();
  const [run] = await db.insert(questionnaireRuns).values({ contactId: c.id, severity: "attention", status: "done", demoShort: true }).returning();
  return run;
}

describe("rotas do médico", () => {
  beforeAll(() => pushSchemaToTestDb());
  beforeEach(async () => truncateAll());

  it("sem cookie → 401 em todas", async () => {
    const { POST } = await import("@/app/api/medico/entrevista/route");
    const { GET } = await import("@/app/api/medico/entrevista/[id]/route");
    const { GET: list } = await import("@/app/api/medico/caso/[runId]/entrevistas/route");
    const { GET: audio } = await import("@/app/api/medico/entrevista/[id]/audio/[idx]/route");
    expect((await POST(post({ fixture: "atencao" }))).status).toBe(401);
    expect((await GET(get(), P({ id: "x" }))).status).toBe(401);
    expect((await list(get(), P({ runId: "x" }))).status).toBe(401);
    expect((await audio(get(), P({ id: "x", idx: "1" }))).status).toBe(401);
  });

  it("convite por fixture, detalhe e áudio inexistente", async () => {
    const { POST } = await import("@/app/api/medico/entrevista/route");
    const { GET } = await import("@/app/api/medico/entrevista/[id]/route");
    const { GET: audio } = await import("@/app/api/medico/entrevista/[id]/audio/[idx]/route");
    const created = await POST(post({ fixture: "atencao" }, COOKIE));
    expect(created.status).toBe(200);
    const item = InterviewListItem.parse(await created.json());

    const { POST: start } = await import("@/app/api/entrevista/[token]/start/route");
    const { POST: turno } = await import("@/app/api/entrevista/[token]/turno/route");
    const token = item.inviteUrl.split("/").pop()!;
    await start(post({ consent: true }), P({ token }));
    await turno(post({ text: "pode" }), P({ token }));
    await turno(post({ text: "um cansaço há semanas" }), P({ token }));

    const d = await GET(get(COOKIE), P({ id: item.id }));
    expect(d.status).toBe(200);
    const detail = InterviewDetail.parse(await d.json());
    expect(detail.status).toBe("running");
    expect(detail.severity).toBe("attention");
    expect(detail.turns.length).toBeGreaterThanOrEqual(5);
    for (let i = 1; i < detail.turns.length; i++) expect(detail.turns[i].startedMs).toBeGreaterThanOrEqual(detail.turns[i - 1].startedMs);
    expect(detail.summary).toBeNull();

    expect((await audio(get(COOKIE), P({ id: item.id, idx: "1" }))).status).toBe(404);
    expect((await GET(get(COOKIE), P({ id: "00000000-0000-0000-0000-000000000000" }))).status).toBe(404);
  });

  it("convite ligado a um run e lista na aba do caso", async () => {
    const run = await makeRun();
    const { POST } = await import("@/app/api/medico/entrevista/route");
    const { GET: list } = await import("@/app/api/medico/caso/[runId]/entrevistas/route");
    expect(await (await list(get(COOKIE), P({ runId: run.id }))).json()).toEqual([]);
    const created = await POST(post({ runId: run.id }, COOKIE));
    expect(created.status).toBe(200);
    const items = (await (await list(get(COOKIE), P({ runId: run.id }))).json()) as unknown[];
    expect(items).toHaveLength(1);
    InterviewListItem.parse(items[0]);
    expect((await POST(post({}, COOKIE))).status).toBe(400);
    expect((await POST(post({ runId: "00000000-0000-0000-0000-000000000000" }, COOKIE))).status).toBe(404);
  });
});

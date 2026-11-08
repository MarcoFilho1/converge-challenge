import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { pushSchemaToTestDb, truncateAll } from "../helpers/db";
import { TurnResponse, InterviewView } from "@/lib/interview/contract";

process.env.INTERVIEW_PUBLIC_URL = "http://localhost:3100";
process.env.VOICE_PROVIDER = "none";

const P = (token: string, extra: Record<string, string> = {}) => ({ params: Promise.resolve({ token, ...extra }) });
const json = (url: string, body: unknown) => new Request(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

async function invite() {
  const { getInterviewService } = await import("@/lib/interview/service");
  const item = await getInterviewService().createInvite(null, { fixture: "prioridade" });
  return item.inviteUrl.split("/").pop()!;
}

describe("rotas do colaborador", () => {
  beforeAll(() => pushSchemaToTestDb());
  beforeEach(async () => truncateAll());

  it("GET com token inválido → 404", async () => {
    const { GET } = await import("@/app/api/entrevista/[token]/route");
    const res = await GET(new Request("http://x/api/entrevista/nope"), P("nope"));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "token_invalido" });
  });

  it("fluxo start → turno (json) → stop com respostas no contrato", async () => {
    const token = await invite();
    const { GET } = await import("@/app/api/entrevista/[token]/route");
    const { POST: start } = await import("@/app/api/entrevista/[token]/start/route");
    const { POST: turno } = await import("@/app/api/entrevista/[token]/turno/route");
    const { POST: stop } = await import("@/app/api/entrevista/[token]/stop/route");

    const view = InterviewView.parse(await (await GET(new Request("http://x"), P(token))).json());
    expect(view.status).toBe("consent");

    const s = await start(json("http://x", { consent: true }), P(token));
    expect(s.status).toBe(200);
    const sr = TurnResponse.parse(await s.json());
    expect(sr.status).toBe("running");

    const t = await turno(json("http://x", { text: "pode sim" }), P(token));
    expect(t.status).toBe(200);
    expect(TurnResponse.parse(await t.json()).heard).toBe("pode sim");

    const form = new FormData();
    form.append("text", "cansaço há meses");
    const t2 = await turno(new Request("http://x", { method: "POST", body: form }), P(token));
    expect(t2.status).toBe(200);

    const e = await stop(new Request("http://x", { method: "POST" }), P(token));
    const er = TurnResponse.parse(await e.json());
    expect(er.status).toBe("stopped");
    expect(er.final).toBe(true);
  });

  it("turno em consent → 409; depois de encerrada → 409", async () => {
    const token = await invite();
    const { POST: turno } = await import("@/app/api/entrevista/[token]/turno/route");
    const r = await turno(json("http://x", { text: "oi" }), P(token));
    expect(r.status).toBe(409);
    expect(await r.json()).toEqual({ error: "estado_invalido" });
  });

  it("dois turnos em paralelo: um 200 e um 409", async () => {
    const token = await invite();
    const { POST: start } = await import("@/app/api/entrevista/[token]/start/route");
    const { POST: turno } = await import("@/app/api/entrevista/[token]/turno/route");
    await start(json("http://x", { consent: true }), P(token));
    const [a, b] = await Promise.all([
      turno(json("http://x", { text: "pode" }), P(token)),
      turno(json("http://x", { text: "pode" }), P(token)),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
  });

  it("skip funciona e fala/0 sem voz → 404; áudio inválido → 400", async () => {
    const token = await invite();
    const { POST: start } = await import("@/app/api/entrevista/[token]/start/route");
    const { POST: skip } = await import("@/app/api/entrevista/[token]/skip/route");
    const { POST: turno } = await import("@/app/api/entrevista/[token]/turno/route");
    const { GET: fala } = await import("@/app/api/entrevista/[token]/fala/[turnIdx]/route");
    await start(json("http://x", { consent: true }), P(token));
    const sk = await skip(new Request("http://x", { method: "POST" }), P(token));
    expect(sk.status).toBe(200);
    const f = await fala(new Request("http://x"), P(token, { turnIdx: "0" }));
    expect(f.status).toBe(404);
    const form = new FormData();
    form.append("audio", new Blob([new Uint8Array(Buffer.from("isto nao e audio"))], { type: "audio/webm" }), "fala.webm");
    const bad = await turno(new Request("http://x", { method: "POST", body: form }), P(token));
    expect(bad.status).toBe(400);
    expect(await bad.json()).toEqual({ error: "audio_invalido" });
  });
});

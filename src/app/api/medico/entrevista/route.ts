import { requireDoctor } from "@/lib/interview/guard";
import { errorResponse, json } from "@/lib/interview/http";
import { FIXTURES, type FixtureName } from "@/lib/interview/fixtures";
import { getInterviewService } from "@/lib/interview/service";

export const runtime = "nodejs";

/** Cria o convite para a entrevista: {runId} (caso real) ou {fixture} (dados sintéticos, dev/demo). */
export async function POST(req: Request) {
  const denied = requireDoctor(req);
  if (denied) return denied;
  try {
    const body = (await req.json().catch(() => ({}))) as { runId?: unknown; fixture?: unknown };
    const runId = typeof body.runId === "string" ? body.runId : null;
    const fixture = typeof body.fixture === "string" && body.fixture in FIXTURES ? (body.fixture as FixtureName) : null;
    if (!runId && !fixture) return json({ error: "corpo_invalido" }, 400);
    return json(await getInterviewService().createInvite(runId, fixture ? { fixture } : {}));
  } catch (err) {
    return errorResponse(err);
  }
}

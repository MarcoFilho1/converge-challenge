import { requireDoctor } from "@/lib/interview/guard";
import { errorResponse, json, wavResponse } from "@/lib/interview/http";
import { getInterviewService } from "@/lib/interview/service";

export async function GET(req: Request, ctx: { params: Promise<{ id: string; idx: string }> }) {
  const denied = requireDoctor(req);
  if (denied) return denied;
  try {
    const { id, idx } = await ctx.params;
    const n = Number(idx);
    if (!Number.isInteger(n) || n < 0) return json({ error: "turno_invalido" }, 400);
    const path = await getInterviewService().personAudioPath(id, n);
    return path ? wavResponse(path) : json({ error: "sem_audio" }, 404);
  } catch (err) {
    return errorResponse(err);
  }
}

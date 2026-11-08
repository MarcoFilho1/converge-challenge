import { getInterviewService } from "@/lib/interview/service";
import { errorResponse, json, wavResponse } from "@/lib/interview/http";

export async function GET(_req: Request, ctx: { params: Promise<{ token: string; turnIdx: string }> }) {
  try {
    const { token, turnIdx } = await ctx.params;
    const idx = Number(turnIdx);
    if (!Number.isInteger(idx) || idx < 0) return json({ error: "turno_invalido" }, 400);
    const path = await getInterviewService().aiAudioPath(token, idx);
    return path ? wavResponse(path) : json({ error: "sem_audio" }, 404);
  } catch (err) {
    return errorResponse(err);
  }
}

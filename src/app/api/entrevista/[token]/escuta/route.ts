import { getInterviewService } from "@/lib/interview/service";
import { errorResponse, json, wavResponse } from "@/lib/interview/http";

/** Som curto de escuta, tocado pela tela enquanto a Helena pensa. ?i= escolhe qual. */
export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await ctx.params;
    const i = Number(new URL(req.url).searchParams.get("i") ?? 0) || 0;
    const path = await getInterviewService().listeningCuePath(token, i);
    return path ? wavResponse(path) : json({ error: "sem_audio" }, 404);
  } catch (err) {
    return errorResponse(err);
  }
}

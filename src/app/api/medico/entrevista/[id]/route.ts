import { requireDoctor } from "@/lib/interview/guard";
import { errorResponse, json } from "@/lib/interview/http";
import { getInterviewService } from "@/lib/interview/service";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = requireDoctor(req);
  if (denied) return denied;
  try {
    const { id } = await ctx.params;
    const detail = await getInterviewService().detail(id);
    return detail ? json(detail) : json({ error: "nao_encontrada" }, 404);
  } catch (err) {
    return errorResponse(err);
  }
}

import { requireDoctor } from "@/lib/interview/guard";
import { errorResponse, json } from "@/lib/interview/http";
import { getInterviewService } from "@/lib/interview/service";

export const runtime = "nodejs";

export async function GET(req: Request, ctx: { params: Promise<{ runId: string }> }) {
  const denied = requireDoctor(req);
  if (denied) return denied;
  try {
    const { runId } = await ctx.params;
    return json(await getInterviewService().listForRun(runId));
  } catch (err) {
    return errorResponse(err);
  }
}

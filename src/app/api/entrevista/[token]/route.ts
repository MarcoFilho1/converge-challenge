import { getInterviewService } from "@/lib/interview/service";
import { errorResponse, json } from "@/lib/interview/http";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await ctx.params;
    const view = await getInterviewService().viewByToken(token);
    return view ? json(view) : json({ error: "token_invalido" }, 404);
  } catch (err) {
    return errorResponse(err);
  }
}

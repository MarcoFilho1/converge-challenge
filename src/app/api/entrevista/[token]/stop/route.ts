import { getInterviewService } from "@/lib/interview/service";
import { errorResponse, json } from "@/lib/interview/http";

export async function POST(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await ctx.params;
    return json(await getInterviewService().stop(token));
  } catch (err) {
    return errorResponse(err);
  }
}

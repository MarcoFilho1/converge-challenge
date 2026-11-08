import { getInterviewService } from "@/lib/interview/service";
import { errorResponse, json } from "@/lib/interview/http";

export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as { consent?: unknown };
    return json(await getInterviewService().start(token, body.consent === true));
  } catch (err) {
    return errorResponse(err);
  }
}

import { getInterviewService } from "@/lib/interview/service";
import { errorResponse, json, readTurnBody } from "@/lib/interview/http";

export const runtime = "nodejs";

export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await ctx.params;
    const body = await readTurnBody(req);
    if (body instanceof Response) return body;
    return json(await getInterviewService().turn(token, body));
  } catch (err) {
    return errorResponse(err);
  }
}

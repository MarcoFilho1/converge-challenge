import { connection } from "next/server";
import { getPublicChannels } from "@/lib/channels/status";

/** Estado dos canais (público: só diz se cada um está no ar e os links de entrada). */
export async function GET() {
  await connection();
  return Response.json(await getPublicChannels(), { headers: { "cache-control": "no-store" } });
}

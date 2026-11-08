import { readFileSync } from "node:fs";
import { AudioInvalid, InterviewConflict, InterviewNotFound, SttUnavailable } from "./service";

export const MAX_AUDIO_BYTES = 5 * 1024 * 1024;

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
}

/** Mapeia os erros tipados do serviço para as respostas do contrato. */
export function errorResponse(err: unknown): Response {
  if (err instanceof InterviewNotFound) return json({ error: "token_invalido" }, 404);
  if (err instanceof InterviewConflict) return json({ error: "estado_invalido" }, 409);
  if (err instanceof AudioInvalid) return json({ error: "audio_invalido" }, 400);
  if (err instanceof SttUnavailable) return json({ error: "stt_indisponivel" }, 503);
  console.error("[entrevista] erro inesperado", err);
  return json({ error: "erro_interno" }, 500);
}

export function wavResponse(path: string): Response {
  const buf = readFileSync(path);
  return new Response(new Uint8Array(buf), { status: 200, headers: { "content-type": "audio/wav", "content-length": String(buf.length), "cache-control": "private, max-age=3600", "content-disposition": "inline" } });
}

/** Lê o corpo de um turno: multipart (audio | text, clientMs) ou JSON {text}. */
export async function readTurnBody(req: Request): Promise<{ audio?: { buffer: Buffer; mime: string }; text?: string; clientMs?: number | null } | Response> {
  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    const body = (await req.json().catch(() => ({}))) as { text?: unknown; clientMs?: unknown };
    return { text: typeof body.text === "string" ? body.text : "", clientMs: typeof body.clientMs === "number" ? body.clientMs : null };
  }
  const form = await req.formData().catch(() => null);
  if (!form) return json({ error: "corpo_invalido" }, 400);
  const audio = form.get("audio");
  const text = form.get("text");
  const clientMsRaw = form.get("clientMs");
  const clientMs = typeof clientMsRaw === "string" && clientMsRaw !== "" ? Number(clientMsRaw) : null;
  if (audio instanceof Blob) {
    if (audio.size > MAX_AUDIO_BYTES) return json({ error: "audio_grande" }, 413);
    return { audio: { buffer: Buffer.from(await audio.arrayBuffer()), mime: audio.type || "audio/webm" }, clientMs };
  }
  return { text: typeof text === "string" ? text : "", clientMs };
}

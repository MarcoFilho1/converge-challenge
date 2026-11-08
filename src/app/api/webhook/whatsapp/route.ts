import { handleIncoming, handleMedia, type EngineResult } from "@/lib/engine/engine";
import { markDelivery } from "@/lib/engine/repo";
import { getMediaBase64 } from "@/lib/whatsapp/evolution";
import { sendToPerson } from "@/lib/channels/send";
import { whatsappSimulatedDown } from "@/lib/channels/status";
import { transcribeAudio } from "@/lib/voice/transcribe-message";
import { parseWebhook } from "@/lib/whatsapp/parse-webhook";
import { saveConnectionState } from "@/lib/whatsapp/session";
import { recordEvent } from "@/lib/obs/events";

const ok = () => Response.json({ ok: true });

/** Envia cada resposta do motor em ordem e registra a entrega. */
async function deliver(phone: string, result: EngineResult) {
  for (let i = 0; i < result.outbound.length; i++) {
    // WhatsApp primeiro (a pessoa escreveu por ele); se falhar e ela tiver o Telegram ligado, vai pela reserva.
    let waId: string | null = null;
    try {
      waId = (await sendToPerson(phone, result.outbound[i], { prefer: "whatsapp", runId: result.runId })).messageId;
    } catch {
      recordEvent({ kind: "envio", outcome: "erro", runId: result.runId, detail: `Mensagem ${i + 1} não entregue no WhatsApp depois de 3 tentativas` });
    }
    const messageId = result.outboundIds?.[i];
    if (!messageId) continue;
    try {
      await markDelivery(messageId, waId);
    } catch (e) {
      console.error("[webhook] não consegui registrar a entrega", e);
    }
  }
}

/** Áudio do WhatsApp → texto pelo Whisper. null se não deu: o motor pede para escrever e registra no rastro. */
async function transcribe(waMessageId: string, base64: string | null, mime: string): Promise<{ text: string; ms: number } | null> {
  const started = Date.now();
  try {
    const media = base64 ? { base64, mime } : await getMediaBase64(waMessageId);
    const { text } = await transcribeAudio(Buffer.from(media.base64, "base64"), media.mime);
    return { text, ms: Date.now() - started };
  } catch (err) {
    console.error("[webhook] não consegui transcrever o áudio", err);
    return null;
  }
}

/** Webhook da Evolution API. Rota pública, protegida pelo cabeçalho x-webhook-secret. */
export async function POST(request: Request) {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    console.error("[webhook] WEBHOOK_SECRET não configurado: recusando mensagens em produção.");
    return Response.json({ ok: false }, { status: 503 });
  }
  if (!secret) console.warn("[webhook] WEBHOOK_SECRET vazio: webhook aberto (só aceitável em desenvolvimento).");
  if (secret && request.headers.get("x-webhook-secret") !== secret) {
    return Response.json({ ok: false }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return ok();
  }

  const parsed = parseWebhook(body);
  // Ensaio de queda ligado na Conexão: o WhatsApp se comporta como fora do ar e não responde ninguém.
  if (parsed.kind !== "connection" && whatsappSimulatedDown()) return ok();
  try {
    if (parsed.kind === "connection") {
      await saveConnectionState(parsed.state);
    } else if (parsed.kind === "message" && !parsed.fromMe) {
      await deliver(parsed.phone, await handleIncoming({ phone: parsed.phone, text: parsed.text, waMessageId: parsed.waMessageId, name: parsed.name }));
    } else if (parsed.kind === "audio" && !parsed.fromMe) {
      const heard = await transcribe(parsed.waMessageId, parsed.base64, parsed.mime);
      const result = heard
        ? await handleIncoming({ phone: parsed.phone, text: heard.text, waMessageId: parsed.waMessageId, viaAudio: true, name: parsed.name })
        : await handleMedia({ phone: parsed.phone, waMessageId: parsed.waMessageId, media: "áudio sem transcrição" });
      if (heard && result.event !== "duplicate" && result.event !== "ignored_unknown") {
        recordEvent({ kind: "transcrição do áudio", outcome: "ok", model: "Whisper (Voicebox)", runId: result.runId, latencyMs: heard.ms, detail: `“${heard.text.slice(0, 160)}”` });
      }
      await deliver(parsed.phone, result);
    } else if (parsed.kind === "media" && !parsed.fromMe) {
      await deliver(parsed.phone, await handleMedia({ phone: parsed.phone, waMessageId: parsed.waMessageId, media: parsed.media }));
    }
  } catch (err) {
    console.error("[webhook] erro ao processar mensagem", err);
  }
  return ok();
}

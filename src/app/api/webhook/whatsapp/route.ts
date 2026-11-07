import { handleIncoming } from "@/lib/engine/engine";
import { markDelivery } from "@/lib/engine/repo";
import { sendText } from "@/lib/whatsapp/evolution";
import { parseWebhook } from "@/lib/whatsapp/parse-webhook";
import { saveConnectionState } from "@/lib/whatsapp/session";

const ok = () => Response.json({ ok: true });

const SEND_ATTEMPTS = 3;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Envia com retentativa. Devolve o id do WhatsApp ou null se todas as tentativas falharem. */
async function sendWithRetry(phone: string, text: string): Promise<string | null> {
  const delay = Number(process.env.SEND_RETRY_DELAY_MS ?? 1500);
  for (let attempt = 1; attempt <= SEND_ATTEMPTS; attempt++) {
    try {
      const { waMessageId } = await sendText(phone, text);
      return waMessageId ?? "sem-id";
    } catch (err) {
      console.error(`[webhook] envio falhou (tentativa ${attempt}/${SEND_ATTEMPTS}) para ${phone}`, err);
      if (attempt < SEND_ATTEMPTS) await wait(delay * attempt);
    }
  }
  return null;
}

/** Webhook da Evolution API. Rota pública, protegida pelo cabeçalho x-webhook-secret. */
export async function POST(request: Request) {
  const secret = process.env.WEBHOOK_SECRET;
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
  try {
    if (parsed.kind === "connection") {
      await saveConnectionState(parsed.state);
    } else if (parsed.kind === "message" && !parsed.fromMe) {
      const result = await handleIncoming({ phone: parsed.phone, text: parsed.text, waMessageId: parsed.waMessageId });
      for (let i = 0; i < result.outbound.length; i++) {
        const waId = await sendWithRetry(parsed.phone, result.outbound[i]);
        const messageId = result.outboundIds?.[i];
        if (!messageId) continue;
        try {
          await markDelivery(messageId, waId);
        } catch (e) {
          console.error("[webhook] não consegui registrar a entrega", e);
        }
      }
    }
  } catch (err) {
    console.error("[webhook] erro ao processar mensagem", err);
  }
  return ok();
}

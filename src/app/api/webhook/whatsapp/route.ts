import { handleIncoming } from "@/lib/engine/engine";
import { sendText } from "@/lib/whatsapp/evolution";
import { parseWebhook } from "@/lib/whatsapp/parse-webhook";
import { saveConnectionState } from "@/lib/whatsapp/session";

const ok = () => Response.json({ ok: true });

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
      for (const text of result.outbound) await sendText(parsed.phone, text);
    }
  } catch (err) {
    console.error("[webhook] erro ao processar mensagem", err);
  }
  return ok();
}

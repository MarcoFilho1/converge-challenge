/**
 * Agrupa o rastro do Caso por mensagem do WhatsApp: cada mensagem recebida vira um bloco com tudo o que ela
 * disparou (transcrição, leitura, crise, indícios em segundo plano, envio). Passos sem mensagem ficam soltos.
 */
import type { TrailItem } from "@/lib/demo/fixtures";

export type TrailGroup =
  | { kind: "step"; item: TrailItem }
  | {
      kind: "message";
      waMessageId: string;
      text: string | null;
      viaAudio: boolean;
      at: string | null;
      items: TrailItem[];
      costUsd: number;
      aiCalls: number;
      /** do webhook chegar até a última resposta sair */
      replyMs: number | null;
    };

const isModelCall = (e: TrailItem) => !!e.model && /^(featherless|gateway):/.test(e.model);

export function groupTrail(trail: TrailItem[]): TrailGroup[] {
  const out: TrailGroup[] = [];
  const byId = new Map<string, Extract<TrailGroup, { kind: "message" }>>();
  for (const item of trail) {
    if (!item.waMessageId) {
      out.push({ kind: "step", item });
      continue;
    }
    let g = byId.get(item.waMessageId);
    if (!g) {
      g = { kind: "message", waMessageId: item.waMessageId, text: null, viaAudio: false, at: null, items: [], costUsd: 0, aiCalls: 0, replyMs: null };
      byId.set(item.waMessageId, g);
      out.push(g);
    }
    g.items.push(item);
    if (item.message && g.text === null) Object.assign(g, { text: item.message.text, viaAudio: item.message.viaAudio, at: item.message.at });
    g.costUsd += item.costUsd ?? 0;
    if (isModelCall(item)) g.aiCalls += 1;
    if (item.kind === "resposta no WhatsApp") g.replyMs = item.latencyMs;
  }
  return out;
}

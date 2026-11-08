/**
 * Avaliação da leitura das respostas do WhatsApp com o modelo real (readReply + conferidor em código).
 * Uso: AI_PROVIDER=featherless pnpm evals:whatsapp   (grava o relatório em docs/medicoes-whatsapp.md; sai 1 se falhar a meta)
 */
import "../scripts/_env";
import { writeFileSync } from "node:fs";
import { getItems } from "@/lib/instruments";
import { aiMode, getAi } from "@/lib/ai";
import { costTotals } from "@/lib/ai/llm";
import { judgeReading } from "@/lib/engine/reading";
import { CASES, type Case } from "./whatsapp-respostas";

process.env.OBS_DISABLED = "true";
const items = getItems(false);
const byCode = (c: string | null | undefined) => (c ? items.find((i) => i.code === c) ?? null : null);

function decision(c: Case, r: Awaited<ReturnType<ReturnType<typeof getAi>["readReply"]>>): string {
  if (c.stage === "consent" || c.stage === "confirm") return r.intent;
  if (r.intent === "doubt" || r.intent === "stop" || r.intent === "skip") return r.intent;
  if (r.intent === "correction" && c.previous) {
    const v = judgeReading(byCode(c.previous)!, c.text, r);
    return v.kind === "accept" ? `correction:${v.value}` : "reject";
  }
  const v = judgeReading(byCode(c.code)!, c.text, r);
  return v.kind === "accept" ? String(v.value) : v.kind === "confirm" ? `confirm:${v.value}` : "reject";
}

function matches(got: string, want: (number | string)[]): boolean {
  return want.some((w) => {
    if (typeof w === "number") return got === String(w);
    const m = /^confirm:(\d+)-(\d+)$/.exec(w);
    if (m) {
      const g = /^confirm:(\d+)$/.exec(got);
      return !!g && Number(g[1]) >= Number(m[1]) && Number(g[1]) <= Number(m[2]);
    }
    return got === w;
  });
}

async function main() {
  const ai = getAi();
  const rows: { c: Case; got: string; ok: boolean; ms: number; source: string; quote: string | null; mentions: string[] }[] = [];
  for (const c of CASES) {
    const item = byCode(c.code);
    const t0 = Date.now();
    const r = await ai.readReply({
      stage: c.stage ?? "item",
      item,
      previous: byCode(c.previous),
      upcoming: (c.upcoming ?? []).map((code) => ({ code, text: byCode(code)!.text })),
      text: c.text,
    });
    const got = decision(c, r);
    rows.push({ c, got, ok: matches(got, c.want), ms: Date.now() - t0, source: r.source, quote: r.quote, mentions: r.mentions });
    process.stdout.write(rows.at(-1)!.ok ? "." : "x");
  }
  console.log();

  const ok = rows.filter((r) => r.ok).length;
  const item9 = rows.filter((r) => r.c.code === "PHQ9_9" && !r.ok && (r.got === "0" || (/^confirm:0$/.test(r.got) && r.c.want.some((w) => typeof w === "number" && w >= 1))));
  const digitGrab = rows.filter((r) => r.c.nota?.includes("não pegar") && !r.ok);
  const ia = rows.filter((r) => r.source === "ia");
  const ms = ia.map((r) => r.ms).sort((a, b) => a - b);
  const pct = (p: number) => (ms.length ? ms[Math.min(ms.length - 1, Math.ceil((p / 100) * ms.length) - 1)] : 0);
  const cost = costTotals()["ler resposta"] ?? { calls: 0, usd: 0 };
  const confirmRate = rows.filter((r) => r.got.startsWith("confirm")).length / rows.length;
  const mentionCase = rows.find((r) => r.c.nota?.includes("mentions deve ter"));
  const noMentionCase = rows.find((r) => r.c.nota?.includes("mentions deve ficar vazio"));
  const mentionsOk = !!mentionCase?.mentions.includes("PHQ9_4") && noMentionCase?.mentions.length === 0;
  const acc = ok / rows.length;
  const pass = acc >= 0.95 && item9.length === 0 && digitGrab.length === 0 && mentionsOk;

  const failures = rows.filter((r) => !r.ok).map((r) => `| ${r.c.stage ?? "item"} · ${r.c.code ?? "—"} | “${r.c.text}” | ${r.c.want.join(" ou ")} | ${r.got} | ${r.quote ? `“${r.quote}”` : "—"} |`);
  const report = [
    "# Medições · leitura das respostas do WhatsApp",
    "",
    `Rodada de ${new Date().toLocaleString("pt-BR", { timeZone: "America/Recife" })} ${aiMode() === "real" ? `com o modelo real (${process.env.AI_FAST_MODEL ?? "modelo rápido padrão"} na Featherless)` : "SEM IA (só a regra local)"}, \`pnpm evals:whatsapp\`.`,
    "Cada resposta passa por readReply (IA) e pelo conferidor em código (judgeReading), exatamente como no motor.",
    "",
    "| Medida | Resultado | Meta |",
    "|---|---|---|",
    `| Acerto | ${ok}/${rows.length} (${(acc * 100).toFixed(1)}%) | ≥ 95% |`,
    `| Erros no item 9 (gravar "nenhuma vez" sem negação, ou perder um valor ≥ 1) | ${item9.length} | 0 |`,
    `| Número pescado do meio da frase | ${digitGrab.length} | 0 |`,
    `| Pediu confirmação | ${(confirmRate * 100).toFixed(0)}% das respostas | — |`,
    `| Chamadas de IA | ${ia.length} (as outras ${rows.length - ia.length} eram rótulo exato, resolvidas pela regra local) | — |`,
    `| Tempo por chamada de IA | p50 ${pct(50)} ms · p95 ${pct(95)} ms | — |`,
    `| Custo (devolvido pela Featherless) | US$ ${cost.usd.toFixed(6)} no total · US$ ${(cost.calls ? cost.usd / cost.calls : 0).toFixed(7)} por chamada | — |`,
    `| Frase de ligação: fala que toca no próximo item | mentions = [${mentionCase?.mentions.join(", ") ?? ""}] | contém PHQ9_4 |`,
    `| Frase de ligação: assunto só parecido | mentions = [${noMentionCase?.mentions.join(", ") ?? ""}] | vazio |`,
    "",
    failures.length ? "## Erros\n\n| Onde | Resposta | Esperado | Obtido | Trecho da IA |\n|---|---|---|---|---|\n" + failures.join("\n") : "## Erros\n\nNenhum.",
    "",
    `Resultado: ${pass ? "PASSOU" : "NÃO PASSOU"} na meta.`,
    "",
  ].join("\n");
  writeFileSync("docs/medicoes-whatsapp.md", report);
  console.log(report);
  process.exit(pass ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });

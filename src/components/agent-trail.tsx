import type { TrailItem } from "@/lib/demo/fixtures";

const OUTCOME: Record<string, { label: string; bg: string; ink: string } | null> = {
  ok: null,
  descartado: { label: "descartado", bg: "var(--raised)", ink: "var(--muted)" },
  modo_simples: { label: "modo simples", bg: "var(--sev-attention-bg)", ink: "var(--sev-attention-ink)" },
  tempo_esgotado: { label: "demorou demais", bg: "var(--sev-attention-bg)", ink: "var(--sev-attention-ink)" },
  sem_credito: { label: "sem crédito", bg: "var(--sev-urgency-bg)", ink: "var(--sev-urgency-ink)" },
  erro: { label: "erro", bg: "var(--sev-urgency-bg)", ink: "var(--sev-urgency-ink)" },
};

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "America/Recife" });
const secs = (ms: number) => `${(ms / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} s`;
const usd = (v: number) => `US$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`;
/** "featherless:moonshotai/Kimi-K2-Instruct-0905#2" → "Kimi-K2-Instruct-0905 · chave 2" */
const model = (m: string | null) => {
  if (!m) return null;
  const hit = /^(?:featherless|gateway):(?:[^/]+\/)?(.+?)(?:#(\d+))?$/.exec(m);
  return hit ? `${hit[1]}${hit[2] ? ` · chave ${hit[2]}` : ""}` : m;
};
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** O que o agente fez neste caso, passo a passo: decisões em código e chamadas de IA com modelo, tempo e custo. */
export function AgentTrail({ trail }: { trail: TrailItem[] }) {
  if (trail.length === 0) {
    return <p className="text-[14px] text-[var(--muted)]">Ainda não há passos registrados para este caso.</p>;
  }
  const aiCalls = trail.filter((e) => e.model && /^(featherless|gateway):/.test(e.model));
  const cost = trail.reduce((a, e) => a + (e.costUsd ?? 0), 0);
  const aiTime = aiCalls.reduce((a, e) => a + (e.latencyMs ?? 0), 0);
  const fallbacks = trail.filter((e) => e.outcome === "modo_simples").length;

  return (
    <div>
      <p className="text-[13px] text-[var(--muted)]">
        {trail.length} passos · {aiCalls.length} chamadas de IA · {usd(cost)} · {secs(aiTime)} de IA
        {fallbacks > 0 ? ` · ${fallbacks} no modo simples` : ""}
      </p>
      <ol className="mt-3 border-l border-[var(--rule)]">
        {trail.map((e) => {
          const o = OUTCOME[e.outcome] ?? null;
          const m = model(e.model);
          return (
            <li key={e.id} className="relative pb-3 pl-4">
              <span
                className="absolute -left-[4.5px] top-[7px] h-2 w-2 rounded-full"
                style={{ background: e.inInterview ? "var(--peach)" : o ? o.ink : "var(--brand)" }}
                aria-hidden="true"
              />
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[13px]">
                <span className="tabular-nums text-[var(--muted)]">{time(e.at)}</span>
                <span className="font-medium text-[var(--ink)]">
                  {e.inInterview ? "Entrevista · " : ""}
                  {capital(e.kind)}
                </span>
                {o && (
                  <span className="rounded-full px-2 py-px text-[12px]" style={{ background: o.bg, color: o.ink }}>
                    {o.label}
                  </span>
                )}
                {m && <span className="text-[12px] text-[var(--muted)]">{m}</span>}
                {e.latencyMs !== null && <span className="tabular-nums text-[12px] text-[var(--muted)]">{secs(e.latencyMs)}</span>}
                {e.costUsd !== null && <span className="tabular-nums text-[12px] text-[var(--muted)]">{usd(e.costUsd)}</span>}
              </div>
              {e.detail && <p className="mt-0.5 text-[13px] text-[var(--ink-2)]">{e.detail}</p>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

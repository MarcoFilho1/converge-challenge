/**
 * Matriz de Trilha de Gravidade (A · B · C + Crise)
 * Elemento assinatura do Consultório NR-7: expõe com transparência determinística
 * quais critérios em código ativaram a classificação do caso.
 */
import type { Severity } from "@/db/schema";

export interface RuleMatrixProps {
  hasPresenteeismTrunk: boolean; // A
  hasWorkImpairment: boolean;    // B (WPAI >= 3)
  hasClinicalSignal: boolean;    // C (BAT >= 2.54 | PHQ >= 10 | GAD >= 10)
  hasCrisis: boolean;            // PHQ9_9 >= 1 ou padrão de crise no texto
  clinicalOnly?: boolean;
  partial?: boolean;
  severity: Severity;
  compact?: boolean;
}

export function RuleTraceStrip({
  hasPresenteeismTrunk,
  hasWorkImpairment,
  hasClinicalSignal,
  hasCrisis,
  clinicalOnly,
  partial,
  compact = false,
}: RuleMatrixProps) {
  const items = [
    {
      code: "A",
      short: "Presenteísmo",
      detail: "Trabalhou com problema de saúde (tronco)",
      active: hasPresenteeismTrunk,
      alert: false,
    },
    {
      code: "B",
      short: "Prejuízo ≥ 3",
      detail: "WPAI-GH prejuízo funcional nas tarefas",
      active: hasWorkImpairment,
      alert: false,
    },
    {
      code: "C",
      short: "Sinal clínico",
      detail: "BAT-12, PHQ-9 ou GAD-7 acima do corte",
      active: hasClinicalSignal,
      alert: false,
    },
    {
      code: "Crise",
      short: "Segurança",
      detail: "Item 9 do PHQ-9 ≥ 1 ou menção de risco",
      active: hasCrisis,
      alert: true,
    },
  ];

  if (compact) {
    return (
      <div className="inline-flex items-center gap-1" title="Trilha determinística em código (A · B · C · Crise)">
        {items.map((it) => (
          <span
            key={it.code}
            className="tabular-nums inline-flex h-6 items-center rounded-[4px] border px-1.5 text-[13px] font-medium"
            style={{
              backgroundColor: it.active
                ? it.alert
                  ? "var(--sev-urgency-bg)"
                  : "var(--raised)"
                : "transparent",
              borderColor: it.active
                ? it.alert
                  ? "var(--sev-urgency-border)"
                  : "var(--border)"
                : "var(--border)",
              color: it.active
                ? it.alert
                  ? "var(--sev-urgency-ink)"
                  : "var(--ink)"
                : "var(--muted)",
            }}
          >
            {it.code}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-[8px] border border-[var(--border)] bg-[var(--raised)] p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[13px] font-medium text-[var(--muted)]">
          Regra determinística de triagem (calculada em código, sem LLM)
        </span>
        <div className="flex flex-wrap items-center gap-1.5">
          {clinicalOnly && (
            <span className="rounded-[4px] border border-[var(--sev-attention-border)] bg-[var(--sev-attention-bg)] px-2 py-0.5 text-[13px] font-medium text-[var(--sev-attention-ink)]">
              Sinal clínico sem presenteísmo relatado
            </span>
          )}
          {partial && (
            <span className="rounded-[4px] border border-[var(--border)] bg-[var(--card)] px-2 py-0.5 text-[13px] font-medium text-[var(--muted)]">
              Questionário parcial
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {items.map((it) => (
          <div
            key={it.code}
            className="rounded-[6px] border px-2.5 py-2"
            style={{
              backgroundColor: it.active
                ? it.alert
                  ? "var(--sev-urgency-bg)"
                  : "var(--card)"
                : "var(--bg)",
              borderColor: it.active
                ? it.alert
                  ? "var(--sev-urgency-border)"
                  : "var(--border)"
                : "var(--border)",
            }}
          >
            <div className="flex items-center justify-between gap-1">
              <span
                className="tabular-nums text-[13px] font-medium"
                style={{
                  color: it.active
                    ? it.alert
                      ? "var(--sev-urgency-ink)"
                      : "var(--ink)"
                    : "var(--muted)",
                }}
              >
                [{it.code}] {it.short}
              </span>
              <span
                className="tabular-nums text-[13px] font-medium"
                style={{
                  color: it.active
                    ? it.alert
                      ? "var(--alert)"
                      : "var(--ink)"
                    : "var(--muted)",
                }}
              >
                {it.active ? "ATIVO" : "-"}
              </span>
            </div>
            <p className="mt-0.5 text-[13px] leading-[18px] text-[var(--muted)]">{it.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function formatPhoneBr(phoneE164: string): string {
  const digits = phoneE164.replace(/\D/g, "");
  if (digits.length === 13 && digits.startsWith("55")) {
    const ddd = digits.slice(2, 4);
    const p1 = digits.slice(4, 9);
    const p2 = digits.slice(9, 13);
    return `+55 (${ddd}) ${p1}-${p2}`;
  }
  if (digits.length === 12 && digits.startsWith("55")) {
    const ddd = digits.slice(2, 4);
    const p1 = digits.slice(4, 8);
    const p2 = digits.slice(8, 12);
    return `+55 (${ddd}) ${p1}-${p2}`;
  }
  return phoneE164;
}

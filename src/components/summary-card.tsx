import type { RunSummary } from "@/lib/ai/types";

export function SummaryCard({ summary }: { summary: RunSummary | null }) {
  if (!summary) {
    return (
      <section className="rounded-[8px] border border-[var(--border)] bg-[var(--card)] p-4">
        <h2 className="text-[15px] font-medium text-[var(--ink)]">
          Resumo estruturado para prontuário NR-7
        </h2>
        <p className="mt-2 text-[13px] text-[var(--muted)]">
          Resumo estruturado será gerado ao término do questionário.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-[8px] border border-[var(--border)] bg-[var(--card)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] pb-3">
        <div>
          <h2 className="text-[15px] font-medium text-[var(--ink)]">
            Síntese estruturada do questionário (linguagem de indício)
          </h2>
          <p className="text-[12px] text-[var(--muted)]">
            Validada contra lista de termos proibidos · Cada frase referencia o item respondido.
          </p>
        </div>
      </div>

      <div className="mt-3 space-y-3 text-[13px]">
        {/* Dificuldades relatadas */}
        <div className="rounded-[6px] border border-[var(--border)] bg-[var(--bg)] p-3">
          <div className="text-[12px] font-medium text-[var(--muted)]">
            Dificuldades relatadas pelo colaborador
          </div>
          <ul className="mt-1.5 space-y-1.5">
            {summary.dificuldades_relatadas.map((d, i) => (
              <li key={i} className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-[var(--ink)]">{d.relato}</span>
                <span className="mono-code text-[11px] text-[var(--muted)]">
                  [{d.origem.join(", ")}]
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Impacto funcional */}
        <div className="rounded-[6px] border border-[var(--border)] bg-[var(--bg)] p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12px] font-medium text-[var(--muted)]">
              Impacto funcional no trabalho (presenteísmo)
            </span>
            <span className="mono-code text-[11px] text-[var(--muted)]">
              [{summary.impacto_funcional.origem.join(", ")}]
            </span>
          </div>
          <p className="mt-1 text-[var(--ink)]">{summary.impacto_funcional.texto}</p>
        </div>

        {/* Fatores do trabalho */}
        <div className="rounded-[6px] border border-[var(--border)] bg-[var(--bg)] p-3">
          <div className="text-[12px] font-medium text-[var(--muted)]">
            Fatores organizacionais e condições de trabalho citados
          </div>
          <ul className="mt-1.5 space-y-1.5">
            {summary.fatores_do_trabalho.map((f, i) => (
              <li key={i} className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-[var(--ink)]">{f.texto}</span>
                <span className="mono-code text-[11px] text-[var(--muted)]">
                  [{f.origem.join(", ")}]
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Pontos para avaliar na consulta ocupacional */}
        <div className="rounded-[6px] border border-[var(--border)] bg-[var(--raised)] p-3">
          <div className="text-[12px] font-medium text-[var(--ink)]">
            Pontos sugeridos para avaliação médica presencial
          </div>
          <ul className="mt-1.5 space-y-1.5">
            {summary.pontos_para_avaliar.map((p, i) => (
              <li key={i} className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-[var(--ink)]">{p.texto}</span>
                <span className="mono-code text-[11px] text-[var(--muted)]">
                  [{p.origem.join(", ")}]
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Não respondido */}
        {summary.nao_respondido.length > 0 && (
          <div className="text-[12px] text-[var(--muted)]">
            <span className="font-medium">Blocos não respondidos / parciais:</span>{" "}
            {summary.nao_respondido.join(" · ")}
          </div>
        )}
      </div>
    </section>
  );
}

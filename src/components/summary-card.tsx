import type { RunSummary } from "@/lib/ai/types";

function Origin({ codes }: { codes: string[] }) {
  if (codes.length === 0) return null;
  return <span className="ml-1.5 text-[12px] text-[var(--muted)]">{codes.join(", ")}</span>;
}

function Block({ title, items }: { title: string; items: { texto: string; origem: string[] }[] }) {
  if (items.length === 0) return null;
  return (
    <section>
      <h3 className="text-[13px] font-semibold text-[var(--ink)]">{title}</h3>
      <ul className="mt-1.5 space-y-1.5 pl-5 text-[14px]">
        {items.map((it) => (
          <li key={it.texto} className="list-disc">
            {it.texto}
            <Origin codes={it.origem} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Resumo estruturado do questionário: cada frase com o item de origem ao lado. */
export function SummaryCard({ summary }: { summary: RunSummary | null }) {
  if (!summary) {
    return <p className="text-[14px] text-[var(--muted)]">O resumo aparece quando o questionário termina.</p>;
  }
  return (
    <div className="max-w-[760px] space-y-5">
      <Block
        title="O que relatou"
        items={summary.dificuldades_relatadas.map((d) => ({ texto: d.relato, origem: d.origem }))}
      />
      <Block title="Impacto no trabalho" items={summary.impacto_funcional.texto ? [summary.impacto_funcional] : []} />
      <Block title="Fatores do trabalho citados" items={summary.fatores_do_trabalho} />
      <Block title="Pontos para avaliar na consulta" items={summary.pontos_para_avaliar} />
      {summary.nao_respondido.length > 0 && (
        <p className="text-[13px] text-[var(--muted)]">Sem resposta: {summary.nao_respondido.join(", ")}.</p>
      )}
    </div>
  );
}

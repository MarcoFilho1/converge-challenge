import type { CaseEvidenceItem } from "@/lib/demo/fixtures";

export function EvidenceList({ evidence }: { evidence: CaseEvidenceItem[] }) {
  return (
    <section className="rounded-[8px] border border-[var(--border)] bg-[var(--card)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] pb-3">
        <div>
          <h2 className="text-[15px] font-medium text-[var(--ink)]">
            Indícios clínicos e normativos com fonte verificável
          </h2>
          <p className="text-[12px] text-[var(--muted)]">
            Todo indício exige trecho de origem da base de conhecimento (RAG + regra em código).
          </p>
        </div>
        <span className="mono-code rounded-[4px] border border-[var(--border)] bg-[var(--bg)] px-2 py-0.5 text-[11px] text-[var(--muted)]">
          {evidence.length} {evidence.length === 1 ? "evidência citada" : "evidências citadas"}
        </span>
      </div>

      {evidence.length === 0 ? (
        <div className="mt-3 rounded-[6px] border border-dashed border-[var(--border)] p-4 text-[13px] text-[var(--muted)]">
          Nenhum indício acima do ponto de corte foi identificado neste questionário.
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          {evidence.map((ev) => (
            <article
              key={ev.id}
              className="rounded-[8px] border border-[var(--border)] bg-[var(--bg)] p-3.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="mono-code rounded-[4px] border border-[var(--control)] bg-[var(--card)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--ink)]">
                    {ev.itemCode}
                  </span>
                  <h3 className="text-[14px] font-medium text-[var(--ink)]">{ev.theme}</h3>
                </div>
                <span className="mono-code text-[11px] text-[var(--muted)]">
                  Origem: {ev.source === "rule" ? "Regra determinística" : "RAG documental"}
                </span>
              </div>

              <p className="mt-1.5 text-[13px] leading-[19px] text-[var(--ink)]">
                {ev.explanation}
              </p>

              {/* Citação literal do documento de origem */}
              <blockquote className="mt-2.5 rounded-[6px] border border-[var(--border)] bg-[var(--card)] p-3 text-[12px] leading-[18px] text-[var(--muted)]">
                <div className="mb-1 flex flex-wrap items-center justify-between gap-1 text-[11px] font-medium text-[var(--ink)]">
                  <span>Fonte: {ev.chunk.documentTitle}</span>
                  {ev.chunk.page !== null && (
                    <span className="mono-code text-[var(--muted)]">pág. {ev.chunk.page}</span>
                  )}
                </div>
                <p className="italic">&ldquo;{ev.chunk.text}&rdquo;</p>
              </blockquote>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

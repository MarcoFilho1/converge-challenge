import type { InterviewState, PatientSummary } from "@/lib/case/patient-summary";

const STATE_STYLE: Record<InterviewState, { dot: string }> = {
  nao_necessaria: { dot: "var(--sev-none-ink)" },
  nao_indicada: { dot: "var(--alert)" },
  sem_convite: { dot: "var(--sev-attention-dot)" },
  convidada: { dot: "var(--brand)" },
  em_andamento: { dot: "var(--brand)" },
  interrompida: { dot: "var(--sev-attention-dot)" },
  crise_na_entrevista: { dot: "var(--alert)" },
  concluida: { dot: "var(--sev-none-ink)" },
};

function List({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <section>
      <h3 className="text-[13px] font-semibold text-[var(--ink)]">{title}</h3>
      <ul className="mt-1.5 space-y-1.5 pl-5 text-[14px] text-[var(--ink-2)] marker:text-[var(--brand)]">
        {items.map((t) => (
          <li key={t} className="list-disc">
            {t}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Resumo da pessoa: a entrevista (se precisou, como foi), o que pede atenção e o que levar para a consulta. */
export function PatientSummaryCard({ patient, onOpenInterview }: { patient: PatientSummary; onOpenInterview?: () => void }) {
  const { interview, howItWent, attention, forConsult } = patient;
  const style = STATE_STYLE[interview.state];
  const urgent = interview.state === "nao_indicada" || interview.state === "crise_na_entrevista";
  const hasInterview = interview.state !== "nao_necessaria" && interview.state !== "nao_indicada" && interview.state !== "sem_convite";

  return (
    <section aria-label="Resumo da pessoa" className="mt-4 rounded-[16px] border border-[var(--rule)] px-6 py-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="mt-[7px] inline-block h-2 w-2 flex-none rounded-full" style={{ background: style.dot }} aria-hidden="true" />
          <div>
            <p className="text-[15px] font-medium text-[var(--ink)]">{interview.headline}</p>
            {interview.detail && <p className="mt-0.5 text-[13px] text-[var(--muted)]">{interview.detail}</p>}
          </div>
        </div>
        {hasInterview && onOpenInterview && (
          <button type="button" onClick={onOpenInterview} className="cursor-pointer text-[13px] font-medium text-[var(--brand)] underline underline-offset-2">
            Ver a entrevista
          </button>
        )}
      </div>

      {attention.length > 0 && (
        <div
          className="mt-4 rounded-[12px] px-4 py-3"
          style={urgent ? { background: "var(--sev-urgency-bg)", color: "var(--sev-urgency-ink)" } : { background: "var(--sev-attention-bg)", color: "var(--sev-attention-ink)" }}
        >
          <h3 className="text-[13px] font-semibold">Pede atenção</h3>
          <ul className="mt-1 space-y-1 pl-5 text-[14px]">
            {attention.map((t) => (
              <li key={t} className="list-disc">
                {t}
              </li>
            ))}
          </ul>
        </div>
      )}

      {(howItWent.length > 0 || forConsult.length > 0) && (
        <div className="mt-4 grid grid-cols-1 gap-5 md:grid-cols-2">
          <List title="Como foi a entrevista" items={howItWent} />
          <List title="Para levar à consulta" items={forConsult} />
        </div>
      )}
    </section>
  );
}

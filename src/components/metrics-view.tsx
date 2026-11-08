import type { Metrics } from "@/lib/obs/metrics";

const usd = (v: number | null, digits = 4) =>
  v === null ? "—" : `US$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
const secs = (ms: number | null) => (ms === null ? "—" : `${(ms / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} s`);
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <th className={`border-b border-[var(--border)] px-3 pb-2.5 text-[12px] font-normal text-[var(--muted)] ${right ? "text-right" : "text-left"}`}>{children}</th>;
}
function Td({ children, right, strong }: { children: React.ReactNode; right?: boolean; strong?: boolean }) {
  return (
    <td className={`border-b border-[var(--rule)] px-3 py-3 text-[14px] ${right ? "text-right tabular-nums" : ""} ${strong ? "font-semibold text-[var(--ink)]" : "text-[var(--ink-2)]"}`}>
      {children}
    </td>
  );
}

/** Página Medição: quanto custa e quanto demora cada atendimento, e quão confiável é cada etapa. */
export function MetricsView({ metrics, since, events }: { metrics: Metrics; since: string | null; events: number }) {
  const m = metrics;
  const perCase = m.costPerQuestionnaire !== null || m.costPerInterview !== null ? (m.costPerQuestionnaire ?? 0) + (m.costPerInterview ?? 0) : null;
  const fallbacks = m.stages.reduce((a, s) => a + s.fallbacks, 0);
  const sinceText = since ? new Date(since).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Recife" }) : null;

  return (
    <div>
      <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.02em]">Medição</h1>
      <p className="mt-1 max-w-[70ch] text-[14px] text-[var(--muted)]">
        Custo, tempo e confiabilidade do agente, calculados do rastro gravado no nosso banco.
        {sinceText ? ` ${events} passos registrados desde ${sinceText}.` : " Ainda não há passos registrados."}
      </p>

      <div className="mt-6 rounded-[16px] bg-[var(--brand-tint)] px-6 py-5">
        <p className="text-[13px] text-[var(--brand-deep)]">Custo de IA por atendimento completo, questionário mais entrevista</p>
        <p className="mt-1 text-[32px] font-semibold tabular-nums tracking-[-0.02em] text-[var(--brand-deep)]">{usd(perCase, 3)}</p>
        <p className="mt-2 max-w-[72ch] text-[13px] text-[var(--ink-2)]">
          Para comparar: uma consulta de exame periódico reserva cerca de 20 minutos do médico do trabalho, perto de R$ 32 só de salário
          (Rev Bras Med Trab 2022; Portal Salário, CAGED).
        </p>
      </div>

      <table className="mt-8 w-full border-collapse" aria-label="Resumo">
        <thead>
          <tr>
            <Th>Resumo</Th>
            <Th right>Valor</Th>
          </tr>
        </thead>
        <tbody>
          <tr><Td>Questionários com passos registrados</Td><Td right strong>{m.questionnaires}</Td></tr>
          <tr><Td>Custo médio por questionário</Td><Td right strong>{usd(m.costPerQuestionnaire)}</Td></tr>
          <tr><Td>Entrevistas com passos registrados</Td><Td right strong>{m.interviews}</Td></tr>
          <tr><Td>Custo médio por entrevista</Td><Td right strong>{usd(m.costPerInterview)}</Td></tr>
          <tr><Td>Chamadas de IA</Td><Td right strong>{m.aiCalls}</Td></tr>
          <tr><Td>Vezes que a IA não respondeu e o sistema seguiu no modo simples</Td><Td right strong>{fallbacks}</Td></tr>
          <tr><Td>Custo total registrado</Td><Td right strong>{usd(m.totalCost)}</Td></tr>
        </tbody>
      </table>

      <h2 className="mt-10 text-[15px] font-semibold">Por etapa</h2>
      <p className="mt-1 text-[13px] text-[var(--muted)]">Tempo típico é a mediana; pior tempo é o p95 das chamadas que deram certo.</p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse" aria-label="Por etapa">
          <thead>
            <tr>
              <Th>Etapa</Th>
              <Th right>Chamadas</Th>
              <Th right>Tempo típico</Th>
              <Th right>Pior tempo</Th>
              <Th right>Falhas</Th>
              <Th right>Modo simples</Th>
              <Th right>Custo</Th>
            </tr>
          </thead>
          <tbody>
            {m.stages.map((s) => (
              <tr key={s.kind}>
                <Td strong>{capital(s.kind)}</Td>
                <Td right>{s.calls}</Td>
                <Td right>{secs(s.p50Ms)}</Td>
                <Td right>{secs(s.p95Ms)}</Td>
                <Td right>{s.failures}</Td>
                <Td right>{s.fallbacks}</Td>
                <Td right>{usd(s.costUsd)}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {m.models.length > 0 && (
        <>
          <h2 className="mt-10 text-[15px] font-semibold">Por modelo</h2>
          <table className="mt-3 w-full border-collapse" aria-label="Por modelo">
            <thead>
              <tr>
                <Th>Modelo</Th>
                <Th right>Chamadas</Th>
                <Th right>Custo</Th>
              </tr>
            </thead>
            <tbody>
              {m.models.map((x) => (
                <tr key={x.model}>
                  <Td strong>{x.model}</Td>
                  <Td right>{x.calls}</Td>
                  <Td right>{usd(x.costUsd)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      <p className="mt-6 text-[12px] text-[var(--muted)]">Custo informado pela Featherless em cada chamada. A gravidade e o convite são regras em código e não custam nada.</p>
    </div>
  );
}

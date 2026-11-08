import Link from "next/link";
import type { Severity } from "@/db/schema";
import { describeCase } from "@/lib/case/describe";
import { formatWhen } from "@/lib/case/when";
import type { QueueRow } from "@/lib/demo/fixtures";

const GROUPS: { severity: Severity; label: string; dot: string }[] = [
  { severity: "urgency", label: "Urgência", dot: "var(--alert)" },
  { severity: "priority", label: "Prioridade", dot: "var(--sev-priority-dot)" },
  { severity: "attention", label: "Atenção", dot: "var(--sev-attention-dot)" },
];

const CASE_STATE_LABEL: Record<string, string> = {
  encaminhado: "Encaminhado",
  acompanhando: "Em acompanhamento",
  encerrado: "Encerrado",
};

/** Fila "Prontuário em ordem": uma tabela agrupada por gravidade; cor só no ponto do grupo. */
export function QueueView({ rows, isSyntheticFallback }: { rows: QueueRow[]; isSyntheticFallback: boolean }) {
  const open = rows.filter((r) => r.severity !== "none");
  const none = rows.filter((r) => r.severity === "none");
  const oldest = [...open]
    .filter((r) => r.finishedAt)
    .sort((a, b) => new Date(a.finishedAt!).getTime() - new Date(b.finishedAt!).getTime())[0];

  const lead =
    open.length === 0
      ? "Nenhum caso esperando avaliação."
      : `${open.length} ${open.length === 1 ? "caso espera" : "casos esperam"} avaliação.` +
        (oldest?.finishedAt ? ` O mais antigo chegou ${formatWhen(oldest.finishedAt)}.` : "");

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-semibold leading-tight tracking-[-0.015em]">Fila de triagem</h1>
          <p className="mt-1 text-[14px] text-[var(--muted)]">{lead}</p>
        </div>
        <Link
          href="/contatos"
          className="inline-flex h-[36px] items-center rounded-full bg-[var(--primary)] px-4 text-[13px] font-medium text-[#FFFFFF] hover:bg-[var(--primary-hover)]"
        >
          Disparar questionário
        </Link>
      </div>

      {isSyntheticFallback && (
        <p className="mt-4 text-[13px] text-[var(--muted)]">
          Dados de demonstração: ainda não há questionários concluídos.{" "}
          <Link href="/contatos" className="text-[var(--brand)] underline underline-offset-2">
            Cadastrar colaboradores
          </Link>
        </p>
      )}

      {open.length === 0 ? (
        <div className="mt-8 border-t border-[var(--rule)] pt-8 text-[14px] text-[var(--muted)]">
          Quando um questionário mostrar sinal acima do corte, o caso aparece aqui.
        </div>
      ) : (
        <>
          {/* Desktop e tablet: tabela agrupada */}
          <table className="mt-7 hidden w-full border-collapse md:table" aria-label="Casos abertos">
            <thead>
              <tr className="text-left text-[12px] text-[var(--muted)]">
                <th className="w-[32%] border-b border-[var(--border)] px-3 pb-2.5 font-normal">Colaborador</th>
                <th className="border-b border-[var(--border)] px-3 pb-2.5 font-normal">O que apareceu</th>
                <th className="w-[150px] border-b border-[var(--border)] px-3 pb-2.5 text-right font-normal">Respondeu</th>
                <th className="w-[72px] border-b border-[var(--border)] pb-2.5"><span className="sr-only">Ação</span></th>
              </tr>
            </thead>
            <tbody>
              {GROUPS.map((g) => {
                const groupRows = open.filter((r) => r.severity === g.severity);
                if (groupRows.length === 0) return null;
                return [
                  <tr key={`${g.severity}-h`}>
                    <td colSpan={4} className="px-3 pb-2 pt-6 text-[13px] font-semibold">
                      <span className="mr-2 inline-block h-2 w-2 rounded-full align-middle" style={{ background: g.dot }} aria-hidden="true" />
                      {g.label} <span className="tabular-nums font-normal text-[var(--muted)]">{groupRows.length}</span>
                    </td>
                  </tr>,
                  ...groupRows.map((r) => (
                    <tr key={r.runId} className="align-top transition-colors hover:bg-[var(--bg)]">
                      <td className="border-b border-[var(--rule)] px-3 py-3.5">
                        <Link href={`/caso/${r.runId}`} className="font-semibold text-[var(--ink)] no-underline hover:underline">
                          {r.contactName}
                        </Link>
                        <div className="text-[13px] text-[var(--muted)]">
                          {r.sector} · {r.role}
                        </div>
                      </td>
                      <td className="border-b border-[var(--rule)] px-3 py-3.5 text-[14px]">{describeCase(r)}</td>
                      <td className="border-b border-[var(--rule)] px-3 py-3.5 text-right text-[13px] tabular-nums">
                        {r.finishedAt ? formatWhen(r.finishedAt) : "—"}
                        {r.caseState !== "aberto" && (
                          <div className="text-[12px] text-[var(--muted)]">{CASE_STATE_LABEL[r.caseState] ?? r.caseState}</div>
                        )}
                      </td>
                      <td className="border-b border-[var(--rule)] py-3.5 pr-3 text-right">
                        <Link href={`/caso/${r.runId}`} className="text-[13px] font-medium no-underline" aria-label={`Abrir caso de ${r.contactName}`}>
                          Abrir
                        </Link>
                      </td>
                    </tr>
                  )),
                ];
              })}
            </tbody>
          </table>

          {/* Celular: lista */}
          <div className="mt-6 md:hidden">
            {GROUPS.map((g) => {
              const groupRows = open.filter((r) => r.severity === g.severity);
              if (groupRows.length === 0) return null;
              return (
                <section key={g.severity} className="mb-5" aria-label={g.label}>
                  <h2 className="mb-1 text-[13px] font-semibold">
                    <span className="mr-2 inline-block h-2 w-2 rounded-full align-middle" style={{ background: g.dot }} aria-hidden="true" />
                    {g.label} <span className="tabular-nums font-normal text-[var(--muted)]">{groupRows.length}</span>
                  </h2>
                  {groupRows.map((r) => (
                    <Link
                      key={r.runId}
                      href={`/caso/${r.runId}`}
                      className="block border-b border-[var(--rule)] py-3 text-[var(--ink)] no-underline"
                    >
                      <div className="flex justify-between gap-3">
                        <span className="font-semibold">{r.contactName}</span>
                        <span className="text-[12px] tabular-nums text-[var(--muted)]">{r.finishedAt ? formatWhen(r.finishedAt) : "—"}</span>
                      </div>
                      <div className="mt-0.5 text-[14px] text-[var(--ink-2)]">{describeCase(r)}</div>
                    </Link>
                  ))}
                </section>
              );
            })}
          </div>
        </>
      )}

      <p className="mt-5 text-[13px] text-[var(--muted)]">
        {none.length > 0 ? `${none.length} ${none.length === 1 ? "pessoa sem indício fica" : "pessoas sem indício ficam"} em ` : "Quem ainda não respondeu fica em "}
        <Link href="/contatos" className="text-[var(--brand)] underline underline-offset-2">
          Colaboradores
        </Link>
        .
      </p>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { RuleTraceStrip } from "@/components/ui/primitives";
import {
  AvatarInitial,
  CaseStateChip,
  SeverityBadge,
} from "@/components/ui/severity-badge";
import type { Severity } from "@/db/schema";
import type { QueueRow } from "@/lib/demo/fixtures";

export function QueueView({
  rows,
  isSyntheticFallback,
}: {
  rows: QueueRow[];
  isSyntheticFallback: boolean;
}) {
  const router = useRouter();
  const [selectedSeverity, setSelectedSeverity] = useState<Severity | "all">("all");
  const [sectorFilter, setSectorFilter] = useState<string>("all");

  const urgencyCount = rows.filter((r) => r.severity === "urgency").length;
  const priorityCount = rows.filter((r) => r.severity === "priority").length;
  const attentionCount = rows.filter((r) => r.severity === "attention").length;
  const noneCount = rows.filter((r) => r.severity === "none").length;

  const sectors = Array.from(new Set(rows.map((r) => r.sector)));

  const visibleRows = rows.filter((r) => {
    if (selectedSeverity !== "all" && r.severity !== selectedSeverity) return false;
    if (sectorFilter !== "all" && r.sector !== sectorFilter) return false;
    return true;
  });

  const topUrgentOrPriority = rows.find(
    (r) => r.severity === "urgency" || r.severity === "priority",
  );

  const countCards: {
    id: Severity;
    label: string;
    rule: string;
    count: number;
    highlightUrgent?: boolean;
  }[] = [
    {
      id: "urgency",
      label: "Urgência imediata",
      rule: "PHQ-9 #9 ≥ 1 ou crise",
      count: urgencyCount,
      highlightUrgent: urgencyCount > 0,
    },
    {
      id: "priority",
      label: "Prioridade clínica",
      rule: "Regra B · A+B e C",
      count: priorityCount,
    },
    {
      id: "attention",
      label: "Atenção ocupacional",
      rule: "Regra A · A+B ou C",
      count: attentionCount,
    },
    {
      id: "none",
      label: "Sem indício",
      rule: "Abaixo do corte",
      count: noneCount,
    },
  ];

  return (
    <div className="space-y-5">
      {isSyntheticFallback && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-[8px] border border-[var(--sev-attention-border)] bg-[var(--sev-attention-bg)] px-4 py-3 text-[13px] text-[var(--sev-attention-ink)]"
        >
          <div>
            <strong className="font-semibold">
              Aviso importante · Base sintética de demonstração ativa:
            </strong>{" "}
            O banco Postgres não possui questionários reais concluídos no momento (ou está indisponível). Os 10 casos abaixo são personagens fictícios para demonstração e não representam pacientes reais.
          </div>
          <Link
            href="/contatos"
            className="inline-flex h-[30px] shrink-0 items-center rounded-[6px] border border-[var(--sev-attention-border)] bg-[var(--card)] px-3 text-[13px] font-medium text-[var(--ink)] hover:bg-[var(--raised)]"
          >
            Gerenciar contatos / popular banco →
          </Link>
        </div>
      )}

      {/* Cabeçalho com a descoberta principal (app-screens §2.2 & §4.3) */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--border)] pb-4">
        <div>
          <h1 className="text-[22px] font-semibold leading-[28px] tracking-tight text-[var(--ink)]">
            Fila de triagem NR-7
          </h1>
          <p className="mt-1 text-[14px] text-[var(--muted)]">
            {urgencyCount > 0
              ? `${urgencyCount} caso em urgência imediata (protocolo CVV 188 acionado) e ${priorityCount} em prioridade aguardam avaliação médica.`
              : `${priorityCount} casos em prioridade e ${attentionCount} em atenção ordenados por gravidade determinística.`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/contatos"
            className="inline-flex h-[32px] items-center rounded-[6px] border border-[var(--control)] bg-[var(--card)] px-3 text-[13px] font-medium text-[var(--ink)] hover:bg-[var(--raised)]"
          >
            Disparar novo lote
          </Link>
          {topUrgentOrPriority && (
            <Link
              href={`/caso/${topUrgentOrPriority.runId}`}
              className="inline-flex h-[32px] items-center rounded-[6px] bg-[var(--primary)] px-3.5 text-[13px] font-medium text-[#FFFFFF] hover:bg-[#3E2A27]"
            >
              Avaliar próximo caso crítico →
            </Link>
          )}
        </div>
      </div>

      {/* 4 cartões de contagem que filtram a fila (framed-sheet list pattern) */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {countCards.map((card) => {
          const active = selectedSeverity === card.id;
          return (
            <button
              key={card.id}
              type="button"
              onClick={() =>
                setSelectedSeverity((prev) => (prev === card.id ? "all" : card.id))
              }
              className="flex cursor-pointer flex-col justify-between rounded-[8px] border p-3.5 text-left transition-colors"
              style={{
                backgroundColor: active
                  ? "var(--raised)"
                  : card.highlightUrgent
                    ? "var(--sev-urgency-bg)"
                    : "var(--card)",
                borderColor: active
                  ? "var(--brand)"
                  : card.highlightUrgent
                    ? "var(--sev-urgency-border)"
                    : "var(--border)",
                borderWidth: active ? "1.5px" : "1px",
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className="text-[13px] font-medium"
                  style={{
                    color: card.highlightUrgent ? "var(--sev-urgency-ink)" : "var(--ink)",
                  }}
                >
                  {card.label}
                </span>
                {active && (
                  <span className="tabular-nums text-[13px] text-[var(--brand)]">ativo</span>
                )}
              </div>
              <div className="mt-2 flex items-baseline justify-between gap-2">
                <span
                  className="tabular-nums text-[28px] font-normal leading-none"
                  style={{
                    color: card.highlightUrgent ? "var(--sev-urgency-ink)" : "var(--ink)",
                  }}
                >
                  {card.count}
                </span>
                <span className="text-[13px] text-[var(--muted)]">{card.rule}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Tabela da fila ordenada por gravidade */}
      <section className="rounded-[8px] border border-[var(--border)] bg-[var(--card)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <label htmlFor="sector-select" className="text-[13px] text-[var(--muted)]">
              Setor:
            </label>
            <select
              id="sector-select"
              value={sectorFilter}
              onChange={(e) => setSectorFilter(e.target.value)}
              className="h-[32px] rounded-[6px] border border-[var(--control)] bg-[#FFFFFF] px-2.5 text-[13px] text-[var(--ink)]"
            >
              <option value="all">Todos os setores ({rows.length})</option>
              {sectors.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            {selectedSeverity !== "all" && (
              <button
                type="button"
                onClick={() => setSelectedSeverity("all")}
                className="h-[30px] cursor-pointer rounded-[5px] border border-[var(--border)] bg-[var(--raised)] px-2.5 text-[13px] text-[var(--ink)]"
              >
                Limpar filtro ×
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 text-[13px] text-[var(--muted)]">
            {isSyntheticFallback && (
              <span className="rounded-[4px] border border-[var(--border)] bg-[var(--bg)] px-2 py-0.5 text-[13px]">
                Base sintética (10 casos concluídos)
              </span>
            )}
            <span>
              Mostrando <strong className="tabular-nums text-[var(--ink)]">{visibleRows.length}</strong> de {rows.length} casos
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="h-[38px] border-b border-[var(--border)] text-[13px] font-normal text-[var(--muted)]">
                <th className="py-2 pl-4 pr-3 font-normal">Colaborador e setor</th>
                <th className="py-2 px-3 font-normal">Gravidade</th>
                <th className="hidden md:table-cell py-2 px-3 font-normal">Trilha em código</th>
                <th className="hidden lg:table-cell py-2 px-3 font-normal">Escores validados</th>
                <th className="hidden sm:table-cell py-2 px-3 font-normal">Conduta</th>
                <th className="hidden xl:table-cell py-2 px-3 font-normal text-right">Concluído</th>
                <th className="py-2 pl-3 pr-4 font-normal text-right">Prontuário</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--rule)] text-[14px]">
              {visibleRows.map((row) => {
                const finishedTime = row.finishedAt
                  ? new Date(row.finishedAt).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "-";

                return (
                  <tr
                    key={row.runId}
                    onClick={() => router.push(`/caso/${row.runId}`)}
                    className="h-[64px] cursor-pointer transition-colors hover:bg-[var(--raised)]"
                  >
                    <td className="py-2.5 pl-4 pr-3">
                      <div className="flex items-center gap-2.5">
                        <AvatarInitial name={row.contactName} />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Link
                              href={`/caso/${row.runId}`}
                              onClick={(e) => e.stopPropagation()}
                              className="font-medium text-[var(--ink)] hover:underline"
                            >
                              {row.contactName}
                            </Link>
                            {row.clinicalOnly && (
                              <span className="rounded-[3px] border border-[var(--sev-attention-border)] bg-[var(--sev-attention-bg)] px-1.5 py-0.2 text-[13px] font-medium text-[var(--sev-attention-ink)]">
                                sinal clínico sem presenteísmo
                              </span>
                            )}
                            {row.partial && (
                              <span className="rounded-[3px] border border-[var(--border)] bg-[var(--bg)] px-1.5 py-0.2 text-[13px] text-[var(--muted)]">
                                parcial
                              </span>
                            )}
                            {row.hasVoiceInterview && (
                              <span className="rounded-[3px] border border-[var(--border)] bg-[var(--raised)] px-1.5 py-0.2 text-[13px] font-medium text-[var(--ink)]">
                                entrevista Helena
                              </span>
                            )}
                          </div>
                          <div className="text-[13px] text-[var(--muted)]">
                            {row.sector} · {row.role}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <SeverityBadge severity={row.severity} />
                    </td>

                    <td className="hidden md:table-cell py-2.5 px-3 whitespace-nowrap">
                      <RuleTraceStrip
                        hasPresenteeismTrunk={row.ruleTrace.hasPresenteeismTrunk}
                        hasWorkImpairment={row.ruleTrace.hasWorkImpairment}
                        hasClinicalSignal={row.ruleTrace.hasClinicalSignal}
                        hasCrisis={row.ruleTrace.hasCrisis}
                        severity={row.severity}
                        compact
                      />
                    </td>

                    <td className="hidden lg:table-cell py-2.5 px-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {row.scores.map((s) => (
                          <span
                            key={`${s.instrument}-${s.dimension}`}
                            className="tabular-nums inline-flex flex-none items-center gap-1 whitespace-nowrap rounded-[4px] border px-2 py-0.5 text-[13px]"
                            style={{
                              backgroundColor: s.flagged ? "var(--sev-urgency-bg)" : "var(--bg)",
                              borderColor: s.flagged ? "var(--sev-urgency-border)" : "var(--border)",
                              color: s.flagged ? "var(--sev-urgency-ink)" : "var(--ink)",
                              fontWeight: s.flagged ? 500 : 400,
                            }}
                          >
                            <span>{s.label}</span>
                            <span>{s.value}</span>
                            <span className="opacity-75">{s.maxLabel}</span>
                          </span>
                        ))}
                      </div>
                    </td>

                    <td className="hidden sm:table-cell py-2.5 px-3 whitespace-nowrap">
                      <CaseStateChip state={row.caseState} />
                    </td>

                    <td className="hidden xl:table-cell num tabular-nums py-2.5 px-3 text-[13px] text-[var(--muted)] whitespace-nowrap">
                      Hoje, {finishedTime}
                    </td>

                    <td
                      className="py-2.5 pl-3 pr-4 text-right whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Link
                        href={`/caso/${row.runId}`}
                        className="inline-flex h-[30px] items-center rounded-[5px] border border-[var(--control)] bg-[#FFFFFF] px-2.5 text-[13px] font-medium text-[var(--ink)] hover:bg-[var(--raised)]"
                      >
                        Abrir caso →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

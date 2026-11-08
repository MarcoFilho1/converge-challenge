"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  addContact,
  importCsv,
  seedSyntheticContactsAction,
  sendQuestionnaire,
  sendReminder,
  type ContactActionResult,
} from "@/app/(app)/contatos/actions";
import { formatPhoneBr } from "@/components/ui/primitives";
import { AvatarInitial, RunStatusText } from "@/components/ui/severity-badge";

const SEV_DOT: Record<string, string> = {
  urgency: "var(--alert)",
  priority: "var(--sev-priority-dot)",
  attention: "var(--sev-attention-dot)",
  none: "var(--sev-none-ink)",
};
const SEV_LABEL: Record<string, string> = { urgency: "Urgência", priority: "Prioridade", attention: "Atenção", none: "Sem indício" };
import type { ContactListRow } from "@/lib/contacts/query";

type FilterKind = "all" | "active_or_pending" | "done" | "flagged";

const SAMPLE_CSV = `nome,telefone,setor,cargo
Mariana Cavalcanti,(81) 99000-0002,Atendimento,Analista de Relacionamento
Rafael Albuquerque,(81) 99000-0003,Administrativo,Analista Financeiro
Beatriz Nogueira,(81) 99000-0004,Operações,Supervisora de Turno`;

export function ContactsTable({
  initialRows,
  isSyntheticFallback,
}: {
  initialRows: ContactListRow[];
  isSyntheticFallback: boolean;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filter, setFilter] = useState<FilterKind>("all");
  const [search, setSearch] = useState("");
  const [csvDrawerOpen, setCsvDrawerOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [feedback, setFeedback] = useState<ContactActionResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const totalCount = initialRows.length;
  const activeOrPendingCount = initialRows.filter(
    (r) => r.status === "pending" || r.status === "consent" || r.status === "in_progress",
  ).length;
  const doneCount = initialRows.filter((r) => r.status === "done").length;
  const flaggedCount = initialRows.filter(
    (r) => r.severity === "urgency" || r.severity === "priority" || r.severity === "attention",
  ).length;

  const filteredRows = initialRows.filter((r) => {
    if (filter === "active_or_pending") {
      if (r.status !== "pending" && r.status !== "consent" && r.status !== "in_progress") return false;
    } else if (filter === "done") {
      if (r.status !== "done") return false;
    } else if (filter === "flagged") {
      if (!r.severity || r.severity === "none") return false;
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      return (
        r.name.toLowerCase().includes(q) ||
        r.sector.toLowerCase().includes(q) ||
        r.role.toLowerCase().includes(q) ||
        r.phoneE164.includes(q)
      );
    }
    return true;
  });

  const allVisibleSelected =
    filteredRows.length > 0 && filteredRows.every((r) => selectedIds.includes(r.id));

  const toggleAllVisible = () => {
    if (allVisibleSelected) {
      setSelectedIds((prev) => prev.filter((id) => !filteredRows.some((r) => r.id === id)));
    } else {
      const visibleIds = filteredRows.map((r) => r.id);
      setSelectedIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const toggleRow = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleSendQuestionnaire = (ids: string[]) => {
    startTransition(async () => {
      const res = await sendQuestionnaire(ids);
      setFeedback(res);
    });
  };

  const handleSendReminder = (ids: string[]) => {
    startTransition(async () => {
      const res = await sendReminder(ids);
      setFeedback(res);
    });
  };

  const handleSeedDb = () => {
    startTransition(async () => {
      const res = await seedSyntheticContactsAction();
      setFeedback(res);
    });
  };

  const filterCards: { id: FilterKind; label: string; count: number }[] = [
    { id: "all", label: "Todos", count: totalCount },
    { id: "active_or_pending", label: "Aguardando resposta", count: activeOrPendingCount },
    { id: "done", label: "Concluído", count: doneCount },
    { id: "flagged", label: "Com indício", count: flaggedCount },
  ];

  return (
    <div className="space-y-6">
      {/* Título e ação primária */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.02em] text-[var(--ink)]">Colaboradores</h1>
          <p className="mt-1 text-[14px] text-[var(--muted)]">
            {totalCount} {totalCount === 1 ? "pessoa" : "pessoas"} · {flaggedCount} com indício. Selecione quem vai receber o questionário.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isSyntheticFallback && (
            <button
              type="button"
              onClick={handleSeedDb}
              disabled={isPending}
              className="h-[32px] cursor-pointer rounded-full border border-[var(--control)] bg-[var(--raised)] px-3 text-[13px] font-medium text-[var(--ink)] hover:bg-[var(--active)]"
            >
              Carregar dados de demonstração
            </button>
          )}
          <button
            type="button"
            onClick={() => setAddOpen((v) => !v)}
            className="h-[36px] cursor-pointer rounded-full border border-[var(--border)] bg-[var(--card)] px-4 text-[13px] font-medium text-[var(--ink)] hover:border-[var(--brand-soft)] hover:bg-[var(--brand-tint)] hover:text-[var(--brand-deep)]"
          >
            {addOpen ? "Fechar cadastro" : "Adicionar colaborador"}
          </button>
          <button
            type="button"
            onClick={() => setCsvDrawerOpen((v) => !v)}
            className="h-[36px] cursor-pointer rounded-full border border-[var(--border)] bg-[var(--card)] px-4 text-[13px] font-medium text-[var(--ink)] hover:border-[var(--brand-soft)] hover:bg-[var(--brand-tint)] hover:text-[var(--brand-deep)]"
          >
            {csvDrawerOpen ? "Fechar importação CSV" : "Importar CSV"}
          </button>
          <button
            type="button"
            disabled={isPending || selectedIds.length === 0}
            onClick={() => handleSendQuestionnaire(selectedIds)}
            className="h-[36px] cursor-pointer rounded-full bg-[var(--primary)] px-4 text-[13px] font-medium text-[#FFFFFF] shadow-[0_1px_2px_rgba(0,80,140,0.25)] hover:bg-[var(--primary-hover)] disabled:opacity-45"
          >
            Enviar questionário ({selectedIds.length})
          </button>
        </div>
      </div>

      {/* Feedback de Server Action */}
      {feedback && (
        <div
          role="status"
          className="rounded-[8px] border px-4 py-3 text-[13px]"
          style={{
            backgroundColor: feedback.ok ? "var(--sev-none-bg)" : "var(--sev-urgency-bg)",
            borderColor: feedback.ok ? "var(--sev-none-border)" : "var(--sev-urgency-border)",
            color: feedback.ok ? "var(--sev-none-ink)" : "var(--sev-urgency-ink)",
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium">{feedback.message}</span>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="text-[12px] underline cursor-pointer"
            >
              Fechar
            </button>
          </div>
          {feedback.errors && feedback.errors.length > 0 && (
            <ul className="mt-1.5 list-disc pl-5 text-[12px]">
              {feedback.errors.map((e) => (
                <li key={e.line}>
                  Linha {e.line}: {e.reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Filtros como abas de texto */}
      <nav className="flex flex-wrap gap-5 border-b border-[var(--border)]" aria-label="Filtrar colaboradores">
        {filterCards.map((c) => {
          const active = filter === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setFilter(c.id)}
              aria-pressed={active}
              className={`-mb-px cursor-pointer border-b-2 pb-2.5 text-[13px] ${
                active ? "border-[var(--brand)] font-semibold text-[var(--brand-deep)]" : "border-transparent text-[var(--muted)] hover:text-[var(--ink)]"
              }`}
            >
              {c.label}{" "}
              <span
                className={`ml-0.5 rounded-full px-1.5 py-px text-[12px] tabular-nums ${
                  active ? "bg-[var(--brand-soft)] text-[var(--brand-deep)]" : "bg-[var(--raised)] text-[var(--muted)]"
                }`}
              >
                {c.count}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Painel expansível de Importação CSV */}
      {csvDrawerOpen && (
        <section className="rounded-[8px] border border-[var(--border)] bg-[var(--raised)] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3">
            <div>
              <h2 className="text-[15px] font-medium text-[var(--ink)]">
                Importar lista de colaboradores por CSV
              </h2>
              <p className="text-[12px] text-[var(--muted)]">
                Cabeçalho esperado: <code className="mono-code">nome,telefone,setor,cargo</code> (aceita vírgula ou ponto e vírgula).
              </p>
            </div>
          </div>

          <form
            action={(fd) => {
              startTransition(async () => {
                const res = await importCsv(fd);
                setFeedback(res);
                if (res.ok) setCsvDrawerOpen(false);
              });
            }}
            className="grid grid-cols-1 gap-4 lg:grid-cols-12"
          >
            <div className="lg:col-span-8">
              <label htmlFor="csvText" className="block text-[13px] font-medium text-[var(--ink)] mb-1.5">
                Linhas em formato CSV
              </label>
              <textarea
                id="csvText"
                name="csvText"
                rows={4}
                defaultValue={SAMPLE_CSV}
                className="mono-code w-full rounded-[8px] border border-[var(--control)] bg-[#FFFFFF] p-2.5 text-[12px] text-[var(--ink)]"
              />
            </div>

            <div className="flex flex-col justify-between lg:col-span-4">
              <div>
                <label htmlFor="csvFile" className="block text-[13px] font-medium text-[var(--ink)] mb-1.5">
                  Ou envie arquivo .csv
                </label>
                <input
                  id="csvFile"
                  name="csvFile"
                  type="file"
                  accept=".csv,text/csv"
                  className="w-full rounded-[8px] border border-[var(--control)] bg-[#FFFFFF] px-2.5 py-1.5 text-[12px] text-[var(--muted)]"
                />
              </div>

              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCsvDrawerOpen(false)}
                  className="h-[34px] cursor-pointer rounded-full border border-[var(--control)] bg-[#FFFFFF] px-3 text-[13px] text-[var(--ink)]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="h-[34px] cursor-pointer rounded-full bg-[var(--primary)] px-4 text-[13px] font-medium text-[#FFFFFF]"
                >
                  Processar CSV
                </button>
              </div>
            </div>
          </form>
        </section>
      )}

      {/* Cadastro individual, aberto só quando pedido */}
      {addOpen && (
      <section className="rounded-[12px] bg-[var(--bg)] p-4">
        <h2 className="text-[14px] font-medium text-[var(--ink)] mb-3">
          Cadastrar colaborador individualmente
        </h2>
        <form
          action={(fd) => {
            startTransition(async () => {
              const res = await addContact(fd);
              setFeedback(res);
            });
          }}
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12 items-end"
        >
          <div className="lg:col-span-3">
            <label htmlFor="contact-name" className="block text-[12px] font-medium text-[var(--muted)] mb-1">
              Nome completo
            </label>
            <input
              id="contact-name"
              name="name"
              type="text"
              required
              placeholder="Ex.: Patrícia Gomes"
              className="h-[36px] w-full rounded-[8px] border border-[var(--control)] bg-[#FFFFFF] px-2.5 text-[13px] text-[var(--ink)]"
            />
          </div>

          <div className="lg:col-span-3">
            <label htmlFor="contact-phone" className="block text-[12px] font-medium text-[var(--muted)] mb-1">
              Telefone WhatsApp (DDD + número)
            </label>
            <input
              id="contact-phone"
              name="phone"
              type="tel"
              required
              placeholder="(81) 99999-0000"
              className="mono-code h-[36px] w-full rounded-[8px] border border-[var(--control)] bg-[#FFFFFF] px-2.5 text-[13px] text-[var(--ink)]"
            />
          </div>

          <div className="lg:col-span-2">
            <label htmlFor="contact-sector" className="block text-[12px] font-medium text-[var(--muted)] mb-1">
              Setor
            </label>
            <input
              id="contact-sector"
              name="sector"
              type="text"
              defaultValue="Atendimento"
              className="h-[36px] w-full rounded-[8px] border border-[var(--control)] bg-[#FFFFFF] px-2.5 text-[13px] text-[var(--ink)]"
            />
          </div>

          <div className="lg:col-span-2">
            <label htmlFor="contact-role" className="block text-[12px] font-medium text-[var(--muted)] mb-1">
              Cargo / Função
            </label>
            <input
              id="contact-role"
              name="role"
              type="text"
              defaultValue="Analista"
              className="h-[36px] w-full rounded-[8px] border border-[var(--control)] bg-[#FFFFFF] px-2.5 text-[13px] text-[var(--ink)]"
            />
          </div>

          <div className="lg:col-span-2">
            <button
              type="submit"
              disabled={isPending}
              className="h-[36px] w-full cursor-pointer rounded-full border border-[var(--control)] bg-[var(--raised)] px-3 text-[13px] font-medium text-[var(--ink)] hover:bg-[var(--active)]"
            >
              + Adicionar
            </button>
          </div>
        </form>
      </section>
      )}

      {/* Barra de busca e ações de lote + Tabela de contatos */}
      <section>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
          <div className="flex items-center gap-3">
            <label htmlFor="search-contacts" className="sr-only">
              Filtrar por nome, setor ou telefone
            </label>
            <input
              id="search-contacts"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, setor ou telefone…"
              className="h-[34px] w-[260px] rounded-[8px] border border-[var(--control)] bg-[#FFFFFF] px-2.5 text-[13px] text-[var(--ink)]"
            />
            <span className="text-[12px] text-[var(--muted)]">
              Exibindo <strong className="tabular-nums text-[var(--ink)]">{filteredRows.length}</strong> de {totalCount}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isPending || selectedIds.length === 0}
              onClick={() => handleSendReminder(selectedIds)}
              className="h-[30px] cursor-pointer rounded-full border border-[var(--control)] bg-[#FFFFFF] px-2.5 text-[12px] font-medium text-[var(--ink)] hover:bg-[var(--raised)] disabled:opacity-45"
            >
              Enviar lembrete ({selectedIds.length})
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="h-[38px] border-b border-[var(--border)] text-[12px] font-normal text-[var(--muted)]">
                <th className="w-[40px] pl-4 pr-2">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleAllVisible}
                    aria-label="Selecionar todos os colaboradores visíveis"
                    className="h-4 w-4 rounded border-[var(--control)]"
                  />
                </th>
                <th className="py-2 pr-4 font-normal">Colaborador</th>
                <th className="py-2 px-3 font-normal">Setor e função</th>
                <th className="py-2 px-3 font-normal">Estado da coleta</th>
                <th className="py-2 px-3 font-normal">Gravidade atual</th>
                <th className="py-2 px-3 font-normal text-right">Telefone (E.164)</th>
                <th className="py-2 pl-3 pr-4 font-normal text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--rule)] text-[14px]">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[13px] text-[var(--muted)]">
                    Nenhum colaborador corresponde ao filtro selecionado.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => {
                  const isSelected = selectedIds.includes(row.id);
                  return (
                    <tr
                      key={row.id}
                      className={`h-[52px] transition-colors ${isSelected ? "" : "hover:bg-[var(--brand-tint)]"}`}
                      style={{
                        backgroundColor: isSelected ? "var(--brand-soft)" : undefined,
                      }}
                    >
                      <td className="pl-4 pr-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleRow(row.id)}
                          aria-label={`Selecionar ${row.name}`}
                          className="h-4 w-4 rounded border-[var(--control)]"
                        />
                      </td>
                      <td className="py-2 pr-4">
                        <div className="flex items-center gap-2.5">
                          <AvatarInitial name={row.name} />
                          <div className="min-w-0">
                            {row.latestRunId ? (
                              <Link
                                href={`/caso/${row.latestRunId}`}
                                className="font-medium text-[var(--ink)] hover:underline truncate block"
                              >
                                {row.name}
                              </Link>
                            ) : (
                              <span className="font-medium text-[var(--ink)] truncate block">
                                {row.name}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        <div className="text-[13px] text-[var(--ink)]">{row.sector}</div>
                        <div className="text-[12px] text-[var(--muted)]">{row.role}</div>
                      </td>
                      <td className="py-2 px-3">
                        <RunStatusText status={row.status} />
                      </td>
                      <td className="py-2 px-3">
                        {row.severity ? (
                          <span
                            className={`inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] ${row.severity === "none" ? "text-[var(--muted)]" : "rounded-full px-2.5 py-0.5 font-medium"}`}
                            style={
                              row.severity === "none"
                                ? undefined
                                : { background: `var(--sev-${row.severity}-bg)`, color: `var(--sev-${row.severity}-ink)` }
                            }
                          >
                            <span className="inline-block h-2 w-2 rounded-full" style={{ background: SEV_DOT[row.severity] }} aria-hidden="true" />
                            {SEV_LABEL[row.severity]}
                          </span>
                        ) : (
                          <span className="text-[13px] text-[var(--muted)]" title="Ainda sem questionário concluído">—</span>
                        )}
                      </td>
                      <td className="num tabular-nums py-2 px-3 text-[13px] text-[var(--muted)]">
                        {formatPhoneBr(row.phoneE164)}
                      </td>
                      <td className="py-2 pl-3 pr-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => handleSendQuestionnaire([row.id])}
                            className="h-[28px] cursor-pointer rounded-full border border-[var(--control)] bg-[#FFFFFF] px-2.5 text-[12px] font-medium text-[var(--ink)] hover:bg-[var(--raised)]"
                          >
                            Disparar
                          </button>
                          {row.latestRunId && (
                            <Link
                              href={`/caso/${row.latestRunId}`}
                              className="inline-flex h-[28px] items-center rounded-full px-2 text-[12px] font-medium text-[var(--ink)] hover:underline"
                            >
                              Caso →
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

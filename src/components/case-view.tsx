"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { fetchCaseLive, setCaseState } from "@/app/(app)/caso/[runId]/actions";
import { ConversationPanel } from "@/components/conversation";
import { EvidenceList } from "@/components/evidence-list";
import { InterviewTab } from "@/components/interview-tab";
import { SummaryCard } from "@/components/summary-card";
import { formatPhoneBr, RuleTraceStrip } from "@/components/ui/primitives";
import {
  CaseStateChip,
  RunStatusText,
  SeverityBadge,
} from "@/components/ui/severity-badge";
import type { CaseState } from "@/db/schema";
import type { CaseDetailData } from "@/lib/demo/fixtures";

export function CaseView({
  initialData,
  initialTab = "questionario",
}: {
  initialData: CaseDetailData;
  initialTab?: "questionario" | "entrevista";
}) {
  const [data, setData] = useState<CaseDetailData>(initialData);
  const [activeTab, setActiveTab] = useState<"questionario" | "entrevista">(
    initialTab
  );
  const [caseState, setLocalCaseState] = useState<CaseState>(initialData.run.caseState);
  const [isPending, startTransition] = useTransition();

  // Polling de 3s enquanto o questionário estiver em andamento (in_progress)
  useEffect(() => {
    if (data.run.status !== "in_progress") return;
    const timer = setInterval(() => {
      fetchCaseLive(data.run.runId)
        .then((next) => setData(next))
        .catch(() => {});
    }, 3000);
    return () => clearInterval(timer);
  }, [data.run.runId, data.run.status]);

  const handleStateChange = (nextState: "encaminhado" | "acompanhando" | "encerrado") => {
    setLocalCaseState(nextState);
    startTransition(async () => {
      await setCaseState(data.run.runId, nextState);
    });
  };

  const { run, messages, evidence, summary, interviews, interviewDetail } = data;

  return (
    <div className="space-y-5">
      {/* Breadcrumb + Nome do colaborador (h1) + Condutas clínicas à direita (framed-sheet detail pattern) */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--border)] pb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-[13px] text-[var(--muted)]">
            <Link href="/fila" className="hover:text-[var(--ink)] hover:underline">
              ← Fila de triagem
            </Link>
            <span>/</span>
            <span>{run.sector}</span>
            <span>·</span>
            <span>{run.role}</span>
            <span>·</span>
            <span className="mono-code">{formatPhoneBr(run.phoneE164)}</span>
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
            <h1 className="text-[22px] font-semibold leading-[28px] tracking-tight text-[var(--ink)]">
              {run.contactName}
            </h1>
            <SeverityBadge severity={run.severity} />
            <CaseStateChip state={caseState} />
            <RunStatusText status={run.status} />
          </div>
        </div>

        {/* Três botões de desfecho do médico (Task 15) */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={isPending}
            onClick={() => handleStateChange("encaminhado")}
            className="h-[32px] cursor-pointer rounded-[6px] px-3 text-[13px] font-medium transition-colors"
            style={{
              backgroundColor: caseState === "encaminhado" ? "var(--primary)" : "var(--card)",
              color: caseState === "encaminhado" ? "#FFFFFF" : "var(--ink)",
              border: "1px solid var(--control)",
            }}
          >
            Encaminhar consulta
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => handleStateChange("acompanhando")}
            className="h-[32px] cursor-pointer rounded-[6px] px-3 text-[13px] font-medium transition-colors"
            style={{
              backgroundColor: caseState === "acompanhando" ? "var(--primary)" : "var(--card)",
              color: caseState === "acompanhando" ? "#FFFFFF" : "var(--ink)",
              border: "1px solid var(--control)",
            }}
          >
            Acompanhar no PCMSO
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => handleStateChange("encerrado")}
            className="h-[32px] cursor-pointer rounded-[6px] px-3 text-[13px] font-medium transition-colors"
            style={{
              backgroundColor: caseState === "encerrado" ? "var(--primary)" : "var(--card)",
              color: caseState === "encerrado" ? "#FFFFFF" : "var(--muted)",
              border: "1px solid var(--border)",
            }}
          >
            Encerrar caso
          </button>
        </div>
      </div>

      {/* Elemento assinatura: Matriz de Trilha de Gravidade (A · B · C + Crise) */}
      <RuleTraceStrip
        hasPresenteeismTrunk={run.ruleTrace.hasPresenteeismTrunk}
        hasWorkImpairment={run.ruleTrace.hasWorkImpairment}
        hasClinicalSignal={run.ruleTrace.hasClinicalSignal}
        hasCrisis={run.ruleTrace.hasCrisis}
        clinicalOnly={run.clinicalOnly}
        partial={run.partial}
        severity={run.severity}
      />

      {/* Faixa de Escores Validados dividida por fios de 1px */}
      <div className="grid grid-cols-2 divide-y divide-[var(--border)] rounded-[8px] border border-[var(--border)] bg-[var(--card)] sm:grid-cols-4 sm:divide-x sm:divide-y-0">
        {run.scores.map((s) => (
          <div key={`${s.instrument}-${s.dimension}`} className="p-3.5">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[12px] font-medium text-[var(--muted)]">{s.label}</span>
              <span
                className="mono-code rounded-[3px] px-1.5 py-0.5 text-[11px] font-medium"
                style={{
                  backgroundColor: s.flagged ? "var(--sev-urgency-bg)" : "var(--bg)",
                  color: s.flagged ? "var(--sev-urgency-ink)" : "var(--muted)",
                }}
              >
                corte ≥ {s.cutoff}
              </span>
            </div>
            <div className="mt-1.5 flex items-baseline justify-between">
              <span
                className="mono-code text-[24px] font-normal leading-none"
                style={{ color: s.flagged ? "var(--brand)" : "var(--ink)" }}
              >
                {s.value}
                <span className="ml-1 text-[13px] text-[var(--muted)]">{s.maxLabel}</span>
              </span>
              <span className="text-[11px] text-[var(--muted)]">
                {s.complete ? (s.flagged ? "Acima do corte" : "Dentro da faixa") : "Parcial"}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Abas sublinhadas de 2px em linha de 1px (framed-sheet detail pattern) */}
      <div className="border-b border-[var(--border)]">
        <div className="flex items-center gap-6">
          <button
            type="button"
            onClick={() => setActiveTab("questionario")}
            className="relative cursor-pointer pb-2.5 text-[14px] transition-colors"
            style={{
              color: activeTab === "questionario" ? "var(--ink)" : "var(--muted)",
              fontWeight: activeTab === "questionario" ? 600 : 400,
            }}
          >
            Questionário WhatsApp & Evidências ({evidence.length})
            {activeTab === "questionario" && (
              <span
                className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-[var(--brand)]"
                aria-hidden="true"
              />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("entrevista")}
            className="relative cursor-pointer pb-2.5 text-[14px] transition-colors flex items-center gap-2"
            style={{
              color: activeTab === "entrevista" ? "var(--ink)" : "var(--muted)",
              fontWeight: activeTab === "entrevista" ? 600 : 400,
            }}
          >
            <span>Entrevista por Voz · Helena (MVP2)</span>
            <span className="mono-code rounded-[4px] border border-[var(--border)] bg-[var(--raised)] px-1.5 py-0.2 text-[11px] font-medium text-[var(--ink)]">
              {interviewDetail ? "Resumo pronto" : "Convidar"}
            </span>
            {activeTab === "entrevista" && (
              <span
                className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-[var(--brand)]"
                aria-hidden="true"
              />
            )}
          </button>
        </div>
      </div>

      {/* Conteúdo da aba ativa */}
      {activeTab === "questionario" ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 items-start">
          <div className="lg:col-span-5">
            <ConversationPanel
              messages={messages}
              status={run.status}
              contactName={run.contactName}
            />
          </div>
          <div className="space-y-4 lg:col-span-7">
            <EvidenceList evidence={evidence} />
            <SummaryCard summary={summary} />
          </div>
        </div>
      ) : (
        <InterviewTab
          runId={run.runId}
          contactName={run.contactName}
          initialInterviews={interviews}
          initialDetail={interviewDetail}
        />
      )}
    </div>
  );
}

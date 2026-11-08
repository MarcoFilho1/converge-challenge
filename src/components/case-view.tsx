"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { fetchCaseLive, setCaseState } from "@/app/(app)/caso/[runId]/actions";
import { ConversationPanel } from "@/components/conversation";
import { EvidenceList } from "@/components/evidence-list";
import { InterviewTab } from "@/components/interview-tab";
import { SummaryCard } from "@/components/summary-card";
import type { CaseState, Severity } from "@/db/schema";
import { describeCase, fmt, reasonsFor } from "@/lib/case/describe";
import { formatWhen } from "@/lib/case/when";
import type { CaseDetailData } from "@/lib/demo/fixtures";

const SEVERITY: Record<Severity, { label: string; dot: string; why: string }> = {
  urgency: { label: "Urgência", dot: "var(--alert)", why: "Por que é urgência" },
  priority: { label: "Prioridade", dot: "var(--sev-priority-dot)", why: "Por que é prioridade" },
  attention: { label: "Atenção", dot: "var(--sev-attention-dot)", why: "Por que pede atenção" },
  none: { label: "Sem indício", dot: "var(--sev-none-ink)", why: "Sem sinal acima do corte" },
};

const STATE_LABEL: Record<CaseState, string> = {
  aberto: "Aberto",
  encaminhado: "Encaminhado para consulta",
  acompanhando: "Em acompanhamento",
  encerrado: "Encerrado",
};

/** A resposta aberta da pessoa ("o que está mais difícil"), tirada da conversa. */
function openAnswer(messages: CaseDetailData["messages"]): string | null {
  const i = messages.findIndex((m) => m.direction === "out" && /mais difícil agora/i.test(m.text));
  if (i < 0) return null;
  const reply = messages.slice(i + 1).find((m) => m.direction === "in");
  const text = reply?.text.trim();
  return text && !/^pular$/i.test(text) ? text : null;
}

function Fold({
  title,
  hint,
  open,
  onToggle,
  children,
  foldRef,
}: {
  title: string;
  hint: string;
  open: boolean;
  onToggle: (open: boolean) => void;
  children: React.ReactNode;
  foldRef?: React.Ref<HTMLDetailsElement>;
}) {
  return (
    <details
      ref={foldRef}
      open={open}
      onToggle={(e) => onToggle((e.currentTarget as HTMLDetailsElement).open)}
      className="border-b border-[var(--rule)]"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between py-3.5 text-[14px] font-medium [&::-webkit-details-marker]:hidden">
        <span>{title}</span>
        <span className="text-[13px] font-normal text-[var(--muted)]">
          {hint} <span aria-hidden="true" className={`inline-block transition-transform ${open ? "rotate-90" : ""}`}>›</span>
        </span>
      </summary>
      {open && <div className="pb-5">{children}</div>}
    </details>
  );
}

/** Caso "Prontuário em ordem": uma página para ler de cima para baixo; o detalhe técnico fica dobrado. */
export function CaseView({
  initialData,
  initialTab = "questionario",
}: {
  initialData: CaseDetailData;
  initialTab?: "questionario" | "entrevista";
}) {
  const [data, setData] = useState<CaseDetailData>(initialData);
  const [caseState, setLocalCaseState] = useState<CaseState>(initialData.run.caseState);
  const [isPending, startTransition] = useTransition();
  const [openFolds, setOpenFolds] = useState({
    resumo: false,
    fontes: false,
    conversa: false,
    entrevista: initialTab === "entrevista",
  });
  const interviewRef = useRef<HTMLDetailsElement>(null);

  // Atualiza a cada 3 s enquanto o questionário ainda está em andamento.
  useEffect(() => {
    if (data.run.status !== "in_progress" && data.run.status !== "consent") return;
    const timer = setInterval(() => {
      fetchCaseLive(data.run.runId).then(setData).catch(() => {});
    }, 3000);
    return () => clearInterval(timer);
  }, [data.run.runId, data.run.status]);

  const changeState = (next: "encaminhado" | "acompanhando" | "encerrado") => {
    setLocalCaseState(next);
    startTransition(async () => {
      await setCaseState(data.run.runId, next);
    });
  };

  const openInterview = () => {
    setOpenFolds((f) => ({ ...f, entrevista: true }));
    requestAnimationFrame(() => interviewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const { run, messages, evidence, summary, interviews, interviewDetail } = data;
  const sev = SEVERITY[run.severity];
  const quote = openAnswer(messages);
  const reasons = reasonsFor(run);
  const facts = run.scores.filter((s) => !(s.instrument === "COPSOQ" && s.dimension !== "ritmo"));
  const running = run.status === "in_progress" || run.status === "consent";
  const interviewHint =
    interviews.length === 0
      ? "ainda não convidada"
      : interviews[0].hasSummary
        ? "resumo pronto"
        : "convite enviado";

  return (
    <article>
      <div className="max-w-[760px]">
      <Link href="/fila" className="text-[13px] text-[var(--muted)] no-underline hover:text-[var(--ink)]">
        ← Fila
      </Link>
      <h1 className="mt-2.5 text-[28px] font-semibold leading-tight tracking-[-0.02em]">{run.contactName}</h1>
      <p className="mt-1 text-[14px] text-[var(--muted)]">
        <span className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ background: sev.dot }} aria-hidden="true" />
        {sev.label} · {run.sector} · {run.role}
        {run.finishedAt ? ` · respondeu ${formatWhen(run.finishedAt)}` : running ? " · questionário em andamento" : ""}
      </p>

      <p className="mt-6 text-[18px] leading-[1.55]">
        {describeCase(run)}
        {quote && (
          <>
            {" "}O que mais pesa, nas próprias palavras: <q>{quote}</q>.
          </>
        )}
      </p>

      {facts.length > 0 && (
        <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[14px] text-[var(--ink-2)]">
          {facts.map((s) => (
            <span key={`${s.instrument}-${s.dimension}`} className="whitespace-nowrap">
              {s.label}{" "}
              <b className="tabular-nums font-semibold" style={{ color: s.flagged ? "var(--alert)" : "var(--ink)" }}>
                {fmt(s.value)}
                {s.maxLabel}
              </b>
            </span>
          ))}
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={() => changeState("encaminhado")}
          aria-pressed={caseState === "encaminhado"}
          className="h-[36px] cursor-pointer rounded-full bg-[var(--primary)] px-4 text-[13px] font-medium text-[#FFFFFF] hover:bg-[var(--primary-hover)] disabled:opacity-60"
        >
          Encaminhar consulta
        </button>
        <button
          type="button"
          onClick={openInterview}
          className="h-[36px] cursor-pointer rounded-full border border-[var(--border)] px-4 text-[13px] font-medium hover:bg-[var(--raised)]"
        >
          Convidar para entrevista
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => changeState("acompanhando")}
          aria-pressed={caseState === "acompanhando"}
          className="h-[36px] cursor-pointer rounded-full border border-[var(--border)] px-4 text-[13px] font-medium hover:bg-[var(--raised)] disabled:opacity-60"
        >
          Acompanhar
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => changeState("encerrado")}
          className="h-[36px] cursor-pointer rounded-full px-3 text-[13px] text-[var(--muted)] hover:bg-[var(--raised)] hover:text-[var(--ink)] disabled:opacity-60"
        >
          Encerrar caso
        </button>
        {caseState !== "aberto" && (
          <span className="text-[13px] text-[var(--muted)]" role="status">
            {STATE_LABEL[caseState]}
          </span>
        )}
      </div>

      <h2 className="mt-9 text-[15px] font-semibold">{sev.why}</h2>
      {reasons.length > 0 ? (
        <ul className="mt-2.5 space-y-2 pl-5 text-[14px]">
          {reasons.map((r) => (
            <li key={r.text} className="list-disc">
              {r.text} <span className="text-[12px] text-[var(--muted)]">{r.source}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-[14px] text-[var(--muted)]">Nenhum critério da regra foi atingido.</p>
      )}
      <p className="mt-3 text-[12px] text-[var(--muted)]">A gravidade é calculada em código; a IA só organiza e cita.</p>
      </div>

      <div className="mt-8 border-t border-[var(--rule)]">
        <Fold
          title="Resumo do questionário"
          hint={summary ? "pronto" : "ainda não gerado"}
          open={openFolds.resumo}
          onToggle={(o) => setOpenFolds((f) => ({ ...f, resumo: o }))}
        >
          <SummaryCard summary={summary} />
        </Fold>
        <Fold
          title="Fontes citadas"
          hint={`${evidence.length} ${evidence.length === 1 ? "trecho" : "trechos"}`}
          open={openFolds.fontes}
          onToggle={(o) => setOpenFolds((f) => ({ ...f, fontes: o }))}
        >
          <EvidenceList evidence={evidence} />
        </Fold>
        <Fold
          title="Conversa no WhatsApp"
          hint={`${messages.length} ${messages.length === 1 ? "mensagem" : "mensagens"}`}
          open={openFolds.conversa}
          onToggle={(o) => setOpenFolds((f) => ({ ...f, conversa: o }))}
        >
          <ConversationPanel messages={messages} status={run.status} contactName={run.contactName} />
        </Fold>
        <Fold
          foldRef={interviewRef}
          title="Entrevista com a Helena"
          hint={interviewHint}
          open={openFolds.entrevista}
          onToggle={(o) => setOpenFolds((f) => ({ ...f, entrevista: o }))}
        >
          <InterviewTab
            runId={run.runId}
            contactName={run.contactName}
            initialInterviews={interviews}
            initialDetail={interviewDetail}
          />
        </Fold>
      </div>
    </article>
  );
}

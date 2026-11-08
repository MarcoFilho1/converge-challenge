import type { CaseState, RunStatus, Severity } from "@/db/schema";

const SEVERITY_META: Record<
  Severity,
  { label: string; bg: string; ink: string; border: string; dot: string }
> = {
  urgency: {
    label: "Urgência",
    bg: "var(--sev-urgency-bg)",
    ink: "var(--sev-urgency-ink)",
    border: "var(--sev-urgency-border)",
    dot: "var(--brand)",
  },
  priority: {
    label: "Prioridade",
    bg: "var(--sev-priority-bg)",
    ink: "var(--sev-priority-ink)",
    border: "var(--sev-priority-border)",
    dot: "#C24E32",
  },
  attention: {
    label: "Atenção",
    bg: "var(--sev-attention-bg)",
    ink: "var(--sev-attention-ink)",
    border: "var(--sev-attention-border)",
    dot: "#B57917",
  },
  none: {
    label: "Sem indício",
    bg: "var(--sev-none-bg)",
    ink: "var(--sev-none-ink)",
    border: "var(--sev-none-border)",
    dot: "var(--positive)",
  },
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  const m = SEVERITY_META[severity] ?? SEVERITY_META.none;
  return (
    <span
      className="inline-flex flex-none items-center gap-1.5 whitespace-nowrap rounded-[4px] border px-2 py-0.5 text-[13px] font-medium leading-[18px]"
      style={{
        backgroundColor: m.bg,
        color: m.ink,
        borderColor: m.border,
      }}
    >
      <span
        className="h-1.5 w-1.5 flex-none rounded-full"
        style={{ backgroundColor: m.dot }}
        aria-hidden="true"
      />
      {m.label}
    </span>
  );
}

const RUN_STATUS_LABELS: Record<RunStatus, string> = {
  pending: "Não enviado",
  consent: "Aguardando aceite",
  in_progress: "Em andamento",
  done: "Concluído",
  stopped: "Interrompido",
  crisis: "Corte de crise",
};

export function RunStatusText({ status }: { status: RunStatus }) {
  const label = RUN_STATUS_LABELS[status] ?? status;
  const isCrisis = status === "crisis";
  const isRunning = status === "in_progress" || status === "consent";
  return (
    <span
      className="inline-flex flex-none items-center gap-1.5 whitespace-nowrap text-[13px]"
      style={{
        color: isCrisis ? "var(--brand)" : isRunning ? "var(--ink)" : "var(--muted)",
        fontWeight: isCrisis || isRunning ? 500 : 400,
      }}
    >
      {label}
    </span>
  );
}

const CASE_STATE_LABELS: Record<CaseState, string> = {
  aberto: "Aberto para avaliação",
  encaminhado: "Encaminhado",
  acompanhando: "Em acompanhamento",
  encerrado: "Encerrado",
};

export function CaseStateChip({ state }: { state: CaseState }) {
  const isActioned = state === "encaminhado" || state === "acompanhando";
  return (
    <span
      className="inline-flex flex-none items-center whitespace-nowrap rounded-[4px] border px-2 py-0.5 text-[13px] font-medium leading-[18px]"
      style={{
        backgroundColor: isActioned ? "var(--raised)" : "transparent",
        borderColor: "var(--border)",
        color: state === "encerrado" ? "var(--muted)" : "var(--ink)",
      }}
    >
      {CASE_STATE_LABELS[state] ?? state}
    </span>
  );
}

export function AvatarInitial({ name }: { name: string }) {
  const parts = name.trim().split(/\s+/);
  const initials =
    parts.length >= 2
      ? `${parts[0]?.[0] ?? ""}${parts[parts.length - 1]?.[0] ?? ""}`.toUpperCase()
      : (parts[0]?.slice(0, 2) ?? "CL").toUpperCase();

  // Paleta de tintas pálidas de identidade (nunca saturada, >= 60 graus de diferença)
  const PALETTE = [
    { bg: "#F4E5DF", ink: "#4A251D" },
    { bg: "#E4ECE8", ink: "#1E3F30" },
    { bg: "#EDE6D8", ink: "#47371B" },
    { bg: "#E3E8EE", ink: "#203347" },
    { bg: "#EFE2E6", ink: "#4A202D" },
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  const color = PALETTE[hash % PALETTE.length]!;

  return (
    <span
      className="inline-flex h-7 w-7 flex-none items-center justify-center rounded-full text-[13px] font-medium select-none"
      style={{ backgroundColor: color.bg, color: color.ink }}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}

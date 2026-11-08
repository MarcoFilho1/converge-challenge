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
    dot: "var(--alert)",
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
        color: isCrisis ? "var(--alert)" : isRunning ? "var(--ink)" : "var(--muted)",
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

/** Iniciais só com letras: o nome do perfil do WhatsApp pode trazer emoji, parênteses e números. */
export function initialsOf(name: string): string {
  const words = name
    .replace(/\([^)]*\)/g, " ")
    .split(/\s+/)
    .map((w) => [...w].filter((ch) => /\p{L}/u.test(ch)).join(""))
    .filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
}

export function AvatarInitial({ name, size = "sm" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const initials = initialsOf(name);

  // Paleta de tintas pálidas de identidade (nunca saturada, >= 60 graus de diferença)
  const PALETTE = [
    { bg: "#FEEBDF", ink: "#6E3A1C" },
    { bg: "#DDEBF6", ink: "#0B4A78" },
    { bg: "#E4EFE9", ink: "#1E4A34" },
    { bg: "#E6ECEF", ink: "#24363B" },
    { bg: "#EDE8F4", ink: "#3E2F5B" },
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  const color = PALETTE[hash % PALETTE.length]!;

  return (
    <span
      className={`inline-flex flex-none items-center justify-center rounded-full font-semibold select-none ${
        size === "lg" ? "h-12 w-12 text-[16px]" : size === "md" ? "h-9 w-9 text-[13px]" : "h-7 w-7 text-[12px]"
      }`}
      style={{ backgroundColor: color.bg, color: color.ink }}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}

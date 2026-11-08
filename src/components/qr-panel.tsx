"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import {
  fetchConnection,
  resetConnection,
  type ConnectionStatusPayload,
} from "@/app/(app)/conexao/actions";
import { formatPhoneBr } from "@/components/ui/primitives";

const STATE_META: Record<
  ConnectionStatusPayload["state"],
  { label: string; bg: string; ink: string; border: string; description: string }
> = {
  open: {
    label: "Conectado e pronto para envio",
    bg: "var(--sev-none-bg)",
    ink: "var(--sev-none-ink)",
    border: "var(--sev-none-border)",
    description:
      "O aparelho do consultório está pareado via Baileys. O webhook recebe respostas em tempo real e passa todas pelo corte de crise antes da IA.",
  },
  connecting: {
    label: "Aguardando leitura do QR Code",
    bg: "var(--sev-attention-bg)",
    ink: "var(--sev-attention-ink)",
    border: "var(--sev-attention-border)",
    description:
      "Abra o WhatsApp no celular do consultório em Aparelhos conectados → Conectar um aparelho e aponte a câmera para o quadro ao lado.",
  },
  close: {
    label: "Sessão desconectada",
    bg: "var(--sev-priority-bg)",
    ink: "var(--sev-priority-ink)",
    border: "var(--sev-priority-border)",
    description:
      "Gere uma nova sessão ou leia o código QR abaixo para vincular o número que enviará os questionários validados.",
  },
  refused: {
    label: "Conexão recusada pelo aparelho",
    bg: "var(--sev-urgency-bg)",
    ink: "var(--sev-urgency-ink)",
    border: "var(--sev-urgency-border)",
    description:
      "A sessão anterior expirou ou foi desconectada no celular. Clique em Nova sessão para gerar um novo QR Code.",
  },
};

export function QrPanel({ initial }: { initial: ConnectionStatusPayload }) {
  const [status, setStatus] = useState<ConnectionStatusPayload>(initial);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (status.state === "open") return;
    const timer = setInterval(() => {
      fetchConnection()
        .then((next) => setStatus(next))
        .catch(() => {});
    }, 3000);
    return () => clearInterval(timer);
  }, [status.state]);

  const handleRefresh = () => {
    startTransition(async () => {
      const next = await fetchConnection();
      setStatus(next);
    });
  };

  const handleReset = () => {
    startTransition(async () => {
      const next = await resetConnection();
      setStatus(next);
    });
  };

  const meta = STATE_META[status.state] ?? STATE_META.close;
  const qrSrc =
    status.qrBase64 && status.qrBase64.startsWith("data:image")
      ? status.qrBase64
      : status.qrBase64
        ? `data:image/png;base64,${status.qrBase64}`
        : null;

  return (
    <div className="max-w-[960px]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-semibold leading-tight tracking-[-0.015em] text-[var(--ink)]">WhatsApp do consultório</h1>
          <p className="mt-1 text-[14px] text-[var(--muted)]">
            {status.state === "open" && status.phone
              ? `Conectado em ${formatPhoneBr(status.phone)}. Pronto para enviar questionários.`
              : "Leia o QR Code com o celular do consultório para ligar o bot."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isPending}
            className="h-[34px] cursor-pointer rounded-full border border-[var(--border)] px-3.5 text-[13px] font-medium hover:bg-[var(--raised)] disabled:opacity-60"
          >
            {isPending ? "Verificando…" : "Atualizar"}
          </button>
          <button
            type="button"
            onClick={handleReset}
            disabled={isPending}
            className="h-[34px] cursor-pointer rounded-full px-3 text-[13px] text-[var(--muted)] hover:bg-[var(--raised)] hover:text-[var(--ink)] disabled:opacity-60"
          >
            Gerar novo QR Code
          </button>
          {status.state === "open" && (
            <Link
              href="/contatos"
              className="inline-flex h-[34px] items-center rounded-full bg-[var(--primary)] px-4 text-[13px] font-medium text-[#FFFFFF] no-underline hover:bg-[var(--primary-hover)]"
            >
              Ir para colaboradores
            </Link>
          )}
        </div>
      </div>

      {status.error && (
        <div role="status" className="mt-5 rounded-[10px] bg-[var(--sev-attention-bg)] px-4 py-3 text-[13px] text-[var(--sev-attention-ink)]">
          {status.error}{" "}
          <button type="button" onClick={handleRefresh} className="cursor-pointer font-medium underline">
            Tentar de novo
          </button>
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 items-start gap-10 md:grid-cols-[280px_1fr]">
        <div className="flex flex-col items-center rounded-[14px] bg-[var(--bg)] p-6">
          {status.state === "open" ? (
            <div className="py-10 text-center">
              <span
                className="inline-flex items-center rounded-full px-3 py-1 text-[13px] font-medium"
                style={{ backgroundColor: meta.bg, color: meta.ink }}
              >
                {meta.label}
              </span>
              <p className="mt-3 text-[15px] font-medium tabular-nums">{status.phone ? formatPhoneBr(status.phone) : "Aparelho vinculado"}</p>
            </div>
          ) : qrSrc ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={qrSrc} alt="QR Code para conectar o WhatsApp do consultório" className="h-[232px] w-[232px] rounded-[8px] bg-[#FFFFFF] p-2" />
          ) : (
            <p className="py-16 text-center text-[13px] text-[var(--muted)]">Gerando o código…</p>
          )}
          <p className="mt-3 text-center text-[12px] text-[var(--muted)]">
            {meta.label} · atualizado às <span className="tabular-nums">{status.updatedAt}</span>
          </p>
        </div>

        <div>
          <h2 className="text-[15px] font-semibold">Como conectar</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-[14px]">
            <li>Abra o WhatsApp no celular do consultório.</li>
            <li>Vá em Aparelhos conectados e toque em Conectar um aparelho.</li>
            <li>Aponte a câmera para o código ao lado. A tela muda sozinha quando conectar.</li>
          </ol>
          <p className="mt-5 text-[14px] text-[var(--ink-2)]">
            Depois de conectado, o bot pede consentimento antes da primeira pergunta e responde a PARAR e CONTINUAR. Frases de risco são tratadas em código, antes de qualquer IA.
          </p>
          <details className="mt-6 border-t border-[var(--rule)] pt-3">
            <summary className="cursor-pointer text-[13px] font-medium text-[var(--muted)] hover:text-[var(--ink)]">Detalhes técnicos</summary>
            <dl className="mt-3 space-y-2 text-[13px]">
              <div className="flex justify-between gap-4"><dt className="text-[var(--muted)]">Instância</dt><dd>{status.instanceName}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-[var(--muted)]">Webhook</dt><dd className="break-all text-right">{status.webhookUrl}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-[var(--muted)]">Intervalo entre mensagens</dt><dd className="tabular-nums">1,2 s</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-[var(--muted)]">Mensagem repetida</dt><dd>ignorada pelo id do WhatsApp</dd></div>
            </dl>
          </details>
        </div>
      </div>
    </div>
  );
}

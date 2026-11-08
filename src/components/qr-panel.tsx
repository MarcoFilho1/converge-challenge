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
    <div className="space-y-6">
      {/* Cabeçalho da página (regra app-screens §4.3: substantivo 22px, pergunta respondida abaixo, 1 ação primária) */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--border)] pb-4">
        <div>
          <p className="eyebrow mb-1">Canal do consultório</p>
          <h1 className="text-[22px] font-semibold leading-[28px] tracking-tight text-[var(--ink)]">
            Conexão do aparelho WhatsApp
          </h1>
          <p className="mt-1 text-[14px] text-[var(--muted)]">
            {status.state === "open" && status.phone
              ? `Aparelho conectado em ${formatPhoneBr(status.phone)} · Pronto para disparar questionários NR-7.`
              : `Instância "${status.instanceName}" aguardando pareamento por QR Code · Atualização automática a cada 3 s.`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="mono-code text-[12px] text-[var(--muted)]">
            Atualizado às {status.updatedAt}
          </span>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isPending}
            className="h-[32px] cursor-pointer rounded-[6px] border border-[var(--control)] bg-[var(--card)] px-3 text-[13px] font-medium text-[var(--ink)] hover:bg-[var(--raised)] disabled:opacity-60"
          >
            {isPending ? "Verificando…" : "Atualizar estado"}
          </button>
          <button
            type="button"
            onClick={handleReset}
            disabled={isPending}
            className="h-[32px] cursor-pointer rounded-[6px] border border-[var(--sev-urgency-border)] bg-[var(--sev-urgency-bg)] px-3 text-[13px] font-medium text-[var(--sev-urgency-ink)] hover:opacity-90 disabled:opacity-60"
          >
            Nova sessão
          </button>
          <Link
            href="/contatos"
            className="inline-flex h-[32px] items-center rounded-[6px] bg-[var(--primary)] px-3.5 text-[13px] font-medium text-[#FFFFFF] hover:bg-[var(--primary-hover)]"
          >
            Ir para contatos e disparo →
          </Link>
        </div>
      </div>

      {/* Faixa de indicadores técnicos da ponte Evolution API (dividida por fios de 1px) */}
      <div className="grid grid-cols-1 divide-y divide-[var(--border)] rounded-[8px] border border-[var(--border)] bg-[var(--card)] sm:grid-cols-4 sm:divide-x sm:divide-y-0">
        <div className="p-4">
          <div className="text-[12px] text-[var(--muted)]">Estado da sessão</div>
          <div className="mt-1.5 flex items-center gap-2">
            <span
              className="inline-flex items-center rounded-[4px] border px-2 py-0.5 text-[12px] font-medium"
              style={{
                backgroundColor: meta.bg,
                color: meta.ink,
                borderColor: meta.border,
              }}
            >
              {meta.label}
            </span>
          </div>
        </div>

        <div className="p-4">
          <div className="text-[12px] text-[var(--muted)]">Número pareado</div>
          <div className="mono-code mt-1 text-[20px] font-normal text-[var(--ink)]">
            {status.phone ? formatPhoneBr(status.phone) : "—"}
          </div>
        </div>

        <div className="p-4">
          <div className="text-[12px] text-[var(--muted)]">Cadência segura anti-bloqueio</div>
          <div className="mono-code mt-1 text-[20px] font-normal text-[var(--ink)]">
            1.200 <span className="text-[13px] text-[var(--muted)]">ms / msg</span>
          </div>
        </div>

        <div className="p-4">
          <div className="text-[12px] text-[var(--muted)]">Filtro de crise no webhook</div>
          <div className="mono-code mt-1 text-[20px] font-normal text-[var(--ink)]">
            100% <span className="text-[13px] text-[var(--muted)]">determinístico</span>
          </div>
        </div>
      </div>

      {status.error && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-2 rounded-[8px] border border-[var(--sev-attention-border)] bg-[var(--sev-attention-bg)] px-4 py-2.5 text-[13px] text-[var(--sev-attention-ink)]"
        >
          <span>
            <strong>Aviso da ponte WhatsApp:</strong> {status.error}
          </span>
          <button
            type="button"
            onClick={handleRefresh}
            className="underline font-medium cursor-pointer"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Duas colunas balanceadas (mesma altura de base, sem vazio): QR Code à esquerda + Roteiro operacional à direita */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 items-start">
        <section className="rounded-[8px] border border-[var(--border)] bg-[var(--card)] p-5 lg:col-span-5">
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
            <h2 className="text-[16px] font-medium text-[var(--ink)]">
              {status.state === "open" ? "Aparelho autenticado" : "Leitura do QR Code"}
            </h2>
            <span className="mono-code text-[12px] text-[var(--muted)]">
              Baileys v2.3.7
            </span>
          </div>

          <div className="mt-4 flex flex-col items-center justify-center rounded-[8px] border border-[var(--border)] bg-[var(--bg)] p-6">
            {status.state === "open" ? (
              <div className="py-8 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-[var(--sev-none-border)] bg-[var(--sev-none-bg)] text-[var(--sev-none-ink)]">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M5 13L9 17L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <p className="mt-3 text-[15px] font-medium text-[var(--ink)]">
                  Sessão ativa no consultório
                </p>
                <p className="mono-code mt-1 text-[13px] text-[var(--muted)]">
                  {status.phone ? formatPhoneBr(status.phone) : "Aparelho vinculado"}
                </p>
              </div>
            ) : qrSrc ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrSrc}
                  alt="QR Code para conexão do WhatsApp do consultório"
                  className="h-[224px] w-[224px] rounded-[6px] border border-[var(--border)] bg-[#FFFFFF] p-2"
                />
                <p className="mt-3 text-center text-[12px] text-[var(--muted)]">
                  Aponte a câmera do WhatsApp para conectar o número do consultório.
                </p>
              </>
            ) : (
              <div className="flex flex-col items-center py-4 text-center">
                {/* Grade geométrica representativa quando Evolution ainda está gerando o código */}
                <svg
                  width="180"
                  height="180"
                  viewBox="0 0 180 180"
                  className="rounded-[6px] border border-[var(--border)] bg-[#FFFFFF] p-3"
                  role="img"
                  aria-label="Quadro de pareamento QR aguardando geração da instância"
                >
                  <rect x="14" y="14" width="42" height="42" fill="none" stroke="#24363B" strokeWidth="6" />
                  <rect x="26" y="26" width="18" height="18" fill="#24363B" />
                  <rect x="124" y="14" width="42" height="42" fill="none" stroke="#24363B" strokeWidth="6" />
                  <rect x="136" y="26" width="18" height="18" fill="#24363B" />
                  <rect x="14" y="124" width="42" height="42" fill="none" stroke="#24363B" strokeWidth="6" />
                  <rect x="26" y="136" width="18" height="18" fill="#24363B" />
                  <rect x="74" y="26" width="12" height="12" fill="#51646A" />
                  <rect x="94" y="42" width="12" height="12" fill="#24363B" />
                  <rect x="74" y="74" width="32" height="32" fill="none" stroke="#006EB8" strokeWidth="4" />
                  <rect x="84" y="84" width="12" height="12" fill="#006EB8" />
                  <rect x="124" y="86" width="14" height="14" fill="#51646A" />
                  <rect x="86" y="128" width="14" height="14" fill="#24363B" />
                  <rect x="124" y="124" width="28" height="28" fill="none" stroke="#51646A" strokeWidth="4" />
                </svg>
                <p className="mt-3 text-[13px] font-medium text-[var(--ink)]">
                  Aguardando QR Code da Evolution API
                </p>
                <p className="mt-1 max-w-[34ch] text-[12px] text-[var(--muted)]">
                  Clique em &ldquo;Nova sessão&rdquo; se o código não aparecer em alguns segundos.
                </p>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-[8px] border border-[var(--border)] bg-[var(--card)] p-5 lg:col-span-7">
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
            <h2 className="text-[16px] font-medium text-[var(--ink)]">
              Como funciona a coleta pelo celular do consultório
            </h2>
            <span className="mono-code text-[12px] text-[var(--muted)]">
              Porta 8082 → 3100
            </span>
          </div>

          <p className="mt-3 text-[13px] leading-[20px] text-[var(--muted)]">
            {meta.description}
          </p>

          <dl className="mt-4 divide-y divide-[var(--rule)] border-t border-[var(--border)] text-[13px]">
            <div className="flex items-center justify-between py-2.5">
              <dt className="text-[var(--muted)]">Instância Evolution API</dt>
              <dd className="mono-code font-medium text-[var(--ink)]">{status.instanceName}</dd>
            </div>
            <div className="flex items-center justify-between py-2.5">
              <dt className="text-[var(--muted)]">Destino do Webhook (MESSAGES_UPSERT)</dt>
              <dd className="mono-code text-[12px] text-[var(--ink)]">{status.webhookUrl}</dd>
            </div>
            <div className="flex items-center justify-between py-2.5">
              <dt className="text-[var(--muted)]">Consentimento exigido na abertura</dt>
              <dd className="font-medium text-[var(--ink)]">Resposta &ldquo;1 (Sim, aceito)&rdquo; antes do item 1</dd>
            </div>
            <div className="flex items-center justify-between py-2.5">
              <dt className="text-[var(--muted)]">Comandos de controle do colaborador</dt>
              <dd className="mono-code text-[12px] text-[var(--ink)]">PARAR · CONTINUAR · PULAR</dd>
            </div>
            <div className="flex items-center justify-between py-2.5">
              <dt className="text-[var(--muted)]">Proteção contra duplicidade de mensagem</dt>
              <dd className="text-[var(--ink)]">Índice único por <code className="mono-code">wa_message_id</code></dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
}

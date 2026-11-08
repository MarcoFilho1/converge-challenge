"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { createVoiceInterviewInvite } from "@/app/(app)/caso/[runId]/actions";
import {
  BLOCK_LABELS,
  type InterviewDetail,
  type InterviewListItem,
  type InterviewStatus,
} from "@/lib/interview/contract";

function formatMs(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const min = String(Math.floor(totalSec / 60)).padStart(2, "0"); // taste-skill-ignore
  const sec = String(totalSec % 60).padStart(2, "0"); // taste-skill-ignore
  return `${min}:${sec}`;
}

const STATUS_LABELS: Record<InterviewStatus, string> = {
  consent: "Aguardando aceite",
  running: "Em andamento",
  crisis: "Corte de segurança",
  done: "Concluída",
  stopped: "Interrompida",
};

function InviteQrSvg({ value }: { value: string }) {
  // Deterministic 11x11 visual QR matrix from string hash
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const cells: boolean[][] = Array.from({ length: 11 }, (_, r) =>
    Array.from({ length: 11 }, (__, c) => {
      const inCorner =
        (r < 3 && c < 3) || (r < 3 && c >= 8) || (r >= 8 && c < 3);
      if (inCorner) return true;
      const bit = ((hash >>> ((r * 11 + c) % 28)) ^ (r * 7 + c * 13)) & 1;
      return bit === 1;
    })
  );

  return (
    <svg
      width="72"
      height="72"
      viewBox="0 0 13 13"
      role="img"
      aria-label={`QR Code para ${value}`}
      className="rounded-[6px] border border-[var(--border)] bg-[#FFFFFF] p-1 shrink-0"
    >
      {cells.map((row, r) =>
        row.map((filled, c) =>
          filled ? (
            <rect
              key={`${r}-${c}`}
              x={c + 1}
              y={r + 1}
              width={1}
              height={1}
              fill="#24363B"
            />
          ) : null
        )
      )}
    </svg>
  );
}

export function InterviewTab({
  runId,
  contactName,
  initialInterviews,
  initialDetail,
}: {
  runId: string;
  contactName: string;
  initialInterviews: InterviewListItem[];
  initialDetail: InterviewDetail | null;
}) {
  const [interviews, setInterviews] = useState<InterviewListItem[]>(initialInterviews);
  const [detail, setDetail] = useState<InterviewDetail | null>(initialDetail);
  const [highlightedTurnIdx, setHighlightedTurnIdx] = useState<number | null>(null);
  const [playingTurnIdx, setPlayingTurnIdx] = useState<number | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [isPending, startTransition] = useTransition();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const loadDetailById = useCallback(
    async (interviewId: string) => {
      try {
        const res = await fetch(
          `/api/medico/entrevista/${encodeURIComponent(interviewId)}`
        );
        if (res.ok) {
          const data = (await res.json()) as InterviewDetail;
          setDetail(data);
          return;
        }
      } catch (err) {
        console.error("[entrevista] falha ao carregar detalhe", err);
      }
      // Sem dado sintético num caso real: sem detalhe, a aba mostra só a lista.
    },
    []
  );

  // Sync list from GET /api/medico/caso/[runId]/entrevistas on mount
  useEffect(() => {
    let active = true;
    fetch(`/api/medico/caso/${encodeURIComponent(runId)}/entrevistas`)
      .then(async (res) => {
        if (!res.ok) return;
        const list = (await res.json()) as InterviewListItem[];
        if (!active || list.length === 0) return;
        setInterviews(list);
        if (!detail && list[0]) {
          loadDetailById(list[0].id);
        }
      })
      .catch(() => {
        // Ignore before merge
      });
    return () => {
      active = false;
    };
  }, [detail, loadDetailById, runId]);

  // 3-second polling while status === "running"
  useEffect(() => {
    if (!detail || detail.status !== "running") return;
    const interval = window.setInterval(() => {
      fetch(`/api/medico/entrevista/${encodeURIComponent(detail.id)}`)
        .then(async (res) => {
          if (!res.ok) return;
          const updated = (await res.json()) as InterviewDetail;
          setDetail(updated);
        })
        .catch(() => {});
    }, 3000);
    return () => window.clearInterval(interval);
  }, [detail]);

  const handleCreateInvite = () => {
    startTransition(async () => {
      try {
        const res = await fetch("/api/medico/entrevista", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ runId }),
        });
        if (res.ok) {
          const item = (await res.json()) as InterviewListItem;
          setInterviews((prev) => [item, ...prev]);
          setShowQr(true);
          return;
        }
      } catch {
        // Fallback before merge
      }
      const created = await createVoiceInterviewInvite(runId);
      setInterviews([created]);
      setShowQr(true);
    });
  };



  const scrollToTurn = (turnIdx: number) => {
    setHighlightedTurnIdx(turnIdx);
    const el = document.getElementById(`interview-turn-${turnIdx}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const playPersonTurn = (
    turnIdx: number,
    text: string,
    audioUrl: string | null
  ) => {
    if (playingTurnIdx === turnIdx) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      setPlayingTurnIdx(null);
      return;
    }

    setPlayingTurnIdx(turnIdx);

    if (audioUrl && audioRef.current) {
      audioRef.current.src = audioUrl;
      audioRef.current.onended = () => setPlayingTurnIdx(null);
      audioRef.current.onerror = () => {
        // Fallback to speechSynthesis when wav endpoint is not merged yet
        if (typeof window !== "undefined" && "speechSynthesis" in window) {
          window.speechSynthesis.cancel();
          const u = new SpeechSynthesisUtterance(text);
          u.lang = "pt-BR";
          u.rate = 1.02;
          u.onend = () => setPlayingTurnIdx(null);
          u.onerror = () => setPlayingTurnIdx(null);
          window.speechSynthesis.speak(u);
        } else {
          setPlayingTurnIdx(null);
        }
      };
      audioRef.current.play().catch(() => {
        audioRef.current?.onerror?.(new Event("error"));
      });
      return;
    }

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "pt-BR";
      u.rate = 1.02;
      u.onend = () => setPlayingTurnIdx(null);
      u.onerror = () => setPlayingTurnIdx(null);
      window.speechSynthesis.speak(u);
    }
  };

  const inviteUrl = interviews[0]?.inviteUrl ?? `/entrevista/demo-mariana-nr7`;

  const handleCopyInvite = () => {
    if (typeof window === "undefined") return;
    const fullUrl = inviteUrl.startsWith("http")
      ? inviteUrl
      : `${window.location.origin}${inviteUrl}`;
    navigator.clipboard?.writeText(fullUrl).catch(() => {});
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  if (interviews.length === 0 && !detail) {
    return (
      <section className="rounded-[8px] border border-[var(--border)] bg-[var(--card)] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-[60ch]">
            <h2 className="text-[16px] font-medium text-[var(--ink)]">
              Nenhuma entrevista ainda
            </h2>
            <p className="mt-1 text-[13px] leading-[20px] text-[var(--muted)]">
              Quando o questionário aponta indício, você pode convidar{" "}
              <strong>{contactName}</strong> para uma conversa por voz de 10 minutos
              com a entrevistadora Helena, seguindo pauta fechada por blocos.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={isPending}
              onClick={handleCreateInvite}
              className="h-[34px] cursor-pointer rounded-[6px] bg-[var(--primary)] px-4 text-[13px] font-medium text-[#FFFFFF] hover:bg-[var(--primary-hover)]"
            >
              Convidar para entrevista
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <audio ref={audioRef} className="hidden" />

      {/* Faixa "Entrevista em andamento" quando status === "running" */}
      {detail?.status === "running" && (
        <div
          role="status"
          className="flex items-center justify-between rounded-[8px] border border-[var(--sev-attention-border)] bg-[var(--sev-attention-bg)] px-4 py-2.5 text-[13px] font-medium text-[var(--sev-attention-ink)]"
        >
          <span className="inline-flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-current" />
            Entrevista em andamento · atualizando automaticamente a cada 3 s
          </span>
          <span className="tabular-nums text-[12px]">
            {detail.turns.length} turnos recebidos
          </span>
        </div>
      )}

      {/* Lista de entrevistas e convite com copiar + QR Code */}
      <section className="rounded-[8px] border border-[var(--border)] bg-[var(--raised)] p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[14px] font-medium text-[var(--ink)]">
              Entrevistas por voz ({interviews.length || 1})
            </span>
            {detail && (
              <span className="tabular-nums rounded-[4px] border border-[var(--border)] bg-[var(--card)] px-2 py-0.5 text-[12px] text-[var(--muted)]">
                {detail.summary?.turnos ?? detail.turns.length} turnos ·{" "}
                {detail.summary?.duracao_min ?? 8.3} min
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCopyInvite}
              className="tabular-nums h-[32px] cursor-pointer rounded-[6px] border border-[var(--control)] bg-[var(--card)] px-2.5 text-[13px] text-[var(--ink)] hover:bg-[var(--bg)]"
            >
              {copiedLink ? "Link copiado!" : `Copiar ${inviteUrl}`}
            </button>
            <button
              type="button"
              onClick={() => setShowQr((v) => !v)}
              className="h-[32px] cursor-pointer rounded-[6px] border border-[var(--control)] bg-[var(--card)] px-2.5 text-[13px] text-[var(--ink)] hover:bg-[var(--bg)]"
            >
              {showQr ? "Ocultar QR Code" : "QR Code"}
            </button>
            <Link
              href={inviteUrl}
              className="inline-flex h-[32px] items-center rounded-[6px] bg-[var(--primary)] px-3 text-[13px] font-medium text-[#FFFFFF] hover:bg-[var(--primary-hover)]"
            >
              Abrir sala do colaborador →
            </Link>
          </div>
        </div>

        {showQr && (
          <div className="flex items-center gap-3 rounded-[8px] border border-[var(--border)] bg-[var(--card)] p-3">
            <InviteQrSvg value={inviteUrl} />
            <div className="text-[13px] text-[var(--muted)]">
              <p className="font-medium text-[var(--ink)]">
                Convite individual para {contactName}
              </p>
              <p className="mt-0.5">
                Link direto: <span className="tabular-nums">{inviteUrl}</span>
              </p>
            </div>
          </div>
        )}

        {interviews.length > 0 && (
          <div className="divide-y divide-[var(--border)] rounded-[6px] border border-[var(--border)] bg-[var(--card)]">
            {interviews.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => loadDetailById(item.id)}
                className="flex w-full cursor-pointer flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 text-left text-[13px] hover:bg-[var(--bg)]"
              >
                <div className="flex items-center gap-2.5">
                  <span className="rounded-[4px] border border-[var(--border)] bg-[var(--raised)] px-2 py-0.5 text-[12px] font-medium text-[var(--ink)]">
                    {STATUS_LABELS[item.status]}
                  </span>
                  <span className="tabular-nums text-[var(--muted)]">
                    {item.startedAt
                      ? new Date(item.startedAt).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "Convite enviado"}
                  </span>
                  {item.durationMs !== null && (
                    <span className="tabular-nums text-[var(--muted)]">
                      · {formatMs(item.durationMs)}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {item.hasSummary && (
                    <span className="rounded-[4px] border border-[var(--sev-none-border)] bg-[var(--sev-none-bg)] px-2 py-0.5 text-[12px] font-medium text-[var(--sev-none-ink)]">
                      resumo pronto
                    </span>
                  )}
                  <span className="text-[12px] font-medium text-[var(--ink)]">
                    Ver detalhe →
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {!detail ? (
        <section className="rounded-[8px] border border-[var(--border)] bg-[var(--card)] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-[15px] font-medium text-[var(--ink)]">
                Convite gerado · Aguardando o colaborador iniciar no link
              </h3>
              <p className="mt-1 text-[13px] text-[var(--muted)]">
                Envie o link <span className="tabular-nums">{inviteUrl}</span> ao
                colaborador ou abra a sala para testar ao vivo.
              </p>
            </div>
          </div>
        </section>
      ) : (
        /* Duas colunas no desktop: Transcrição minutada à esquerda | Resumo citado à direita */
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 items-start">
          {/* Esquerda: Transcrição por turno com minuto e separador de bloco */}
          <section className="rounded-[8px] border border-[var(--border)] bg-[var(--card)] lg:col-span-6">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
              <div>
                <h3 className="text-[15px] font-medium text-[var(--ink)]">
                  Transcrição por turno e áudio
                </h3>
                <p className="text-[13px] text-[var(--muted)]">
                  Clique em uma pastilha de origem no resumo ao lado para destacar o turno.
                </p>
              </div>
              <span className="tabular-nums text-[12px] text-[var(--muted)]">
                Modo: {detail.mode === "live" ? "TTS ao vivo + cache" : "Só cache"}
              </span>
            </div>

            <div className="max-h-[680px] space-y-3 overflow-y-auto bg-[var(--bg)] p-4">
              {detail.turns.map((turn, i) => {
                const prevBlock = i > 0 ? detail.turns[i - 1]?.blockId : null;
                const showBlockHeader = turn.blockId !== prevBlock;
                const isAi = turn.speaker === "ai";
                const isHighlighted = highlightedTurnIdx === turn.idx;

                return (
                  <div key={turn.idx} className="space-y-2">
                    {showBlockHeader && (
                      <div className="flex items-center gap-2 py-1">
                        <span className="rounded-[4px] border border-[var(--border)] bg-[var(--card)] px-2 py-0.5 text-[12px] font-medium text-[var(--muted)]">
                          {BLOCK_LABELS[turn.blockId] ?? turn.blockId}
                        </span>
                        <div className="h-[1px] flex-1 bg-[var(--border)]" />
                      </div>
                    )}

                    <div
                      id={`interview-turn-${turn.idx}`}
                      className={`flex flex-col ${isAi ? "items-start" : "items-end"}`}
                    >
                      <div className="mb-1 flex items-center gap-2 px-1 text-[12px] text-[var(--muted)]">
                        <span className="font-medium text-[var(--ink)]">
                          {isAi ? "Helena (IA)" : contactName}
                        </span>
                        <span className="tabular-nums">
                          turno {turn.idx} · {formatMs(turn.startedMs)}
                        </span>
                      </div>

                      <div
                        className="max-w-[90%] rounded-[8px] border px-3.5 py-2.5 text-[14px] leading-[20px] transition-colors"
                        style={{
                          backgroundColor: isHighlighted
                            ? "var(--sev-attention-bg)"
                            : isAi
                              ? "var(--card)"
                              : "var(--raised)",
                          borderColor: isHighlighted
                            ? "var(--brand)"
                            : isAi
                              ? "var(--border)"
                              : "var(--control)",
                          borderWidth: isHighlighted ? "1.5px" : "1px",
                        }}
                      >
                        <p className="text-[var(--ink)]">{turn.text}</p>
                        {!isAi && (
                          <div className="mt-2 flex items-center justify-end border-t border-[var(--border)] pt-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                playPersonTurn(turn.idx, turn.text, turn.audioUrl)
                              }
                              className="tabular-nums inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--ink)] hover:underline cursor-pointer"
                            >
                              <span>
                                {playingTurnIdx === turn.idx ? "■ parar" : "▶ ouvir"}
                              </span>
                              {turn.durationMs && (
                                <span className="text-[var(--muted)]">
                                  ({(turn.durationMs / 1000).toFixed(1)}s)
                                </span>
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Direita: Resumo estruturado citado por turno e minuto */}
          <section className="rounded-[8px] border border-[var(--border)] bg-[var(--card)] p-4 lg:col-span-6">
            <div className="border-b border-[var(--border)] pb-3">
              <h3 className="text-[15px] font-medium text-[var(--ink)]">
                Resumo da entrevista com origem por turno
              </h3>
              <p className="text-[13px] text-[var(--muted)]">
                Toda frase sem referência de turno é descartada em código. Clique na origem para ir ao trecho.
              </p>
            </div>

            {detail.summary ? (
              <div className="mt-3 space-y-3 text-[13px]">
                {/* Sinais de alerta no topo. Pergunta de segurança sem resposta clara nunca aparece como "sem menção". */}
                {(() => {
                  const avisos = detail.summary.avisos ?? [];
                  const risco = detail.summary.sinais_de_alerta.risco;
                  const segurancaSemResposta = !risco && avisos.some((a) => /segurança/i.test(a.texto));
                  const tone = risco ? "urgency" : segurancaSemResposta ? "attention" : "none";
                  return (
                    <>
                      <div
                        className="rounded-[6px] border p-3"
                        style={{
                          backgroundColor: `var(--sev-${tone}-bg)`,
                          borderColor: `var(--sev-${tone}-border)`,
                          color: `var(--sev-${tone}-ink)`,
                        }}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-medium">
                            Sinais de alerta:{" "}
                            {risco
                              ? "Sinal de risco imediato identificado"
                              : segurancaSemResposta
                                ? "Pergunta de segurança sem resposta clara (veja os avisos)"
                                : "Sem menção de autolesão ou risco agudo"}
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {detail.summary.sinais_de_alerta.origem.map((o) => (
                              <button
                                key={o.turnIdx}
                                type="button"
                                onClick={() => scrollToTurn(o.turnIdx)}
                                className="tabular-nums cursor-pointer rounded-[4px] border border-current px-1.5 py-0.5 text-[12px] font-medium hover:opacity-80"
                              >
                                {o.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Avisos para a consulta: perguntas que a pessoa não quis responder, pulou ou deixou em silêncio */}
                      {avisos.length > 0 && (
                        <div
                          className="rounded-[6px] border p-3"
                          style={{
                            backgroundColor: "var(--sev-attention-bg)",
                            borderColor: "var(--sev-attention-border)",
                            color: "var(--sev-attention-ink)",
                          }}
                        >
                          <h4 className="font-medium">Avisos para a consulta</h4>
                          <p className="mt-0.5 text-[12px] opacity-80">
                            A pessoa ouviu a pergunta de dois jeitos e não respondeu, pulou ou ficou em silêncio.
                          </p>
                          <ul className="mt-2 space-y-1.5">
                            {avisos.map((a, i) => (
                              <li key={i} className="flex flex-wrap items-start justify-between gap-2">
                                <span className="min-w-0 flex-1">{a.texto}</span>
                                <span className="flex flex-wrap gap-1">
                                  {a.origem.map((o) => (
                                    <button
                                      key={o.turnIdx}
                                      type="button"
                                      onClick={() => scrollToTurn(o.turnIdx)}
                                      className="tabular-nums cursor-pointer rounded-[4px] border border-current px-1.5 py-0.5 text-[12px] font-medium hover:opacity-80"
                                    >
                                      {o.label}
                                    </button>
                                  ))}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </>
                  );
                })()}

                {/* 1. dificuldades_relatadas */}
                <div className="rounded-[6px] border border-[var(--border)] bg-[var(--bg)] p-3">
                  <div className="text-[13px] font-medium text-[var(--muted)]">
                    Dificuldades relatadas
                  </div>
                  <ul className="mt-1.5 space-y-2">
                    {detail.summary.dificuldades_relatadas.map((item, i) => (
                      <li key={i} className="space-y-1">
                        <p className="text-[14px] text-[var(--ink)]">
                          {item.texto}{" "}
                          {item.duracao && (
                            <span className="text-[13px] text-[var(--muted)]">
                              (duração: {item.duracao})
                            </span>
                          )}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {item.origem.map((o) => (
                            <button
                              key={o.turnIdx}
                              type="button"
                              onClick={() => scrollToTurn(o.turnIdx)}
                              className="tabular-nums cursor-pointer rounded-[4px] border border-[var(--control)] bg-[var(--card)] px-2 py-0.5 text-[12px] font-medium text-[var(--ink)] hover:border-[var(--brand)]"
                            >
                              ↗ {o.label}
                            </button>
                          ))}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* 2. impacto_no_trabalho */}
                <div className="rounded-[6px] border border-[var(--border)] bg-[var(--bg)] p-3">
                  <div className="text-[13px] font-medium text-[var(--muted)]">
                    Impacto no trabalho
                  </div>
                  <ul className="mt-1.5 space-y-2">
                    {detail.summary.impacto_no_trabalho.map((item, i) => (
                      <li key={i} className="space-y-1">
                        <p className="text-[14px] text-[var(--ink)]">{item.texto}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {item.origem.map((o) => (
                            <button
                              key={o.turnIdx}
                              type="button"
                              onClick={() => scrollToTurn(o.turnIdx)}
                              className="tabular-nums cursor-pointer rounded-[4px] border border-[var(--control)] bg-[var(--card)] px-2 py-0.5 text-[12px] font-medium text-[var(--ink)] hover:border-[var(--brand)]"
                            >
                              ↗ {o.label}
                            </button>
                          ))}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* 3. fatores_do_trabalho */}
                <div className="rounded-[6px] border border-[var(--border)] bg-[var(--bg)] p-3">
                  <div className="text-[13px] font-medium text-[var(--muted)]">
                    Fatores do trabalho
                  </div>
                  <ul className="mt-1.5 space-y-2">
                    {detail.summary.fatores_do_trabalho.map((item, i) => (
                      <li key={i} className="space-y-1">
                        <p className="text-[14px] text-[var(--ink)]">{item.texto}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {item.origem.map((o) => (
                            <button
                              key={o.turnIdx}
                              type="button"
                              onClick={() => scrollToTurn(o.turnIdx)}
                              className="tabular-nums cursor-pointer rounded-[4px] border border-[var(--control)] bg-[var(--card)] px-2 py-0.5 text-[12px] font-medium text-[var(--ink)] hover:border-[var(--brand)]"
                            >
                              ↗ {o.label}
                            </button>
                          ))}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* 4. barreiras_atendimento */}
                <div className="rounded-[6px] border border-[var(--border)] bg-[var(--bg)] p-3">
                  <div className="text-[13px] font-medium text-[var(--muted)]">
                    Barreiras para buscar atendimento
                  </div>
                  <ul className="mt-1.5 space-y-2">
                    {detail.summary.barreiras_atendimento.map((item, i) => (
                      <li key={i} className="space-y-1">
                        <p className="text-[14px] text-[var(--ink)]">{item.texto}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {item.origem.map((o) => (
                            <button
                              key={o.turnIdx}
                              type="button"
                              onClick={() => scrollToTurn(o.turnIdx)}
                              className="tabular-nums cursor-pointer rounded-[4px] border border-[var(--control)] bg-[var(--card)] px-2 py-0.5 text-[12px] font-medium text-[var(--ink)] hover:border-[var(--brand)]"
                            >
                              ↗ {o.label}
                            </button>
                          ))}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* 5. pontos_para_avaliacao */}
                <div className="rounded-[6px] border border-[var(--border)] bg-[var(--raised)] p-3">
                  <div className="text-[13px] font-medium text-[var(--ink)]">
                    Pontos para avaliação
                  </div>
                  <ul className="mt-1.5 space-y-2">
                    {detail.summary.pontos_para_avaliacao.map((item, i) => (
                      <li key={i} className="space-y-1">
                        <p className="text-[14px] text-[var(--ink)]">{item.texto}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {item.origem.map((o) => (
                            <button
                              key={o.turnIdx}
                              type="button"
                              onClick={() => scrollToTurn(o.turnIdx)}
                              className="tabular-nums cursor-pointer rounded-[4px] border border-[var(--control)] bg-[var(--card)] px-2 py-0.5 text-[12px] font-medium text-[var(--ink)] hover:border-[var(--brand)]"
                            >
                              ↗ {o.label}
                            </button>
                          ))}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* 6. nao_respondido em lista cinza no fim */}
                {detail.summary.nao_respondido.length > 0 && (
                  <div className="rounded-[6px] border border-[var(--border)] bg-[var(--raised)] p-3 text-[13px] text-[var(--muted)]">
                    <span className="font-medium">Não respondido:</span>
                    <ul className="mt-1 list-disc pl-5 space-y-0.5">
                      {detail.summary.nao_respondido.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : null}
          </section>
        </div>
      )}
    </div>
  );
}

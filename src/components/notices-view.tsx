"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { markNoticesRead } from "@/app/(app)/avisos/actions";

export type NoticeRow = { id: string; createdAt: string; kind: string; contactName: string; text: string; runId: string | null; unread: boolean };

const KIND: Record<string, { label: string; dot: string }> = {
  done: { label: "Entrevista concluída", dot: "var(--sev-none-ink)" },
  stopped: { label: "Parou antes do fim", dot: "var(--sev-attention-dot)" },
  abandoned: { label: "Conversa caiu", dot: "var(--sev-attention-dot)" },
  declined: { label: "Não quis fazer", dot: "var(--muted)" },
  crisis: { label: "Precisa de atenção hoje", dot: "var(--alert)" },
};

const when = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Recife" });

/** Avisos da médica. Ao abrir, marca todos como lidos. */
export function NoticesView({ notices }: { notices: NoticeRow[] }) {
  const router = useRouter();
  const hasUnread = notices.some((n) => n.unread);
  useEffect(() => {
    if (!hasUnread) return;
    markNoticesRead().then(() => router.refresh()).catch(() => {});
  }, [hasUnread, router]);

  return (
    <div className="max-w-[820px]">
      <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.02em]">Avisos</h1>
      <p className="mt-1 text-[14px] text-[var(--muted)]">Quando uma entrevista termina, o aviso aparece aqui com o link do caso.</p>

      <div className="mt-5 rounded-[14px] bg-[var(--peach-soft)] px-5 py-4 text-[14px] text-[var(--ink-2)]">
        <b className="font-semibold text-[var(--peach-ink)]">Demonstração.</b> Em uso real, a médica recebe este mesmo aviso também no WhatsApp do
        consultório: só o nome e o link do caso, sem nenhum dado de saúde. Mostrar os avisos aqui no painel foi uma escolha para a demo, para quem
        avalia ver o fluxo completo sem precisar de outro celular.
      </div>

      {notices.length === 0 ? (
        <p className="mt-8 border-t border-[var(--rule)] pt-8 text-[14px] text-[var(--muted)]">Nenhum aviso ainda. Eles chegam quando alguém termina a entrevista com a Helena.</p>
      ) : (
        <ul className="mt-6 border-t border-[var(--rule)]">
          {notices.map((n) => {
            const k = KIND[n.kind] ?? { label: n.kind, dot: "var(--muted)" };
            return (
              <li key={n.id} className={`flex flex-wrap items-start justify-between gap-3 border-b border-[var(--rule)] px-2 py-4 ${n.unread ? "bg-[var(--brand-tint)]" : ""}`}>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-[13px] text-[var(--muted)]">
                    <span className="inline-block h-2 w-2 rounded-full" style={{ background: k.dot }} aria-hidden="true" />
                    <span className="font-medium text-[var(--ink)]">{k.label}</span>
                    <span className="tabular-nums">{when(n.createdAt)}</span>
                    {n.unread && <span className="rounded-full bg-[var(--brand-soft)] px-2 py-px text-[12px] font-medium text-[var(--brand-deep)]">novo</span>}
                  </p>
                  <p className="mt-1 text-[15px] text-[var(--ink)]">{n.text}</p>
                </div>
                {n.runId && (
                  <Link
                    href={`/caso/${n.runId}`}
                    className="inline-flex h-[32px] items-center rounded-full bg-[var(--brand-soft)] px-4 text-[13px] font-medium text-[var(--brand-deep)] no-underline hover:bg-[var(--brand)] hover:text-[#FFFFFF]"
                  >
                    Abrir caso
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

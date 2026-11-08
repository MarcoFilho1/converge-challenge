"use client";

import { useEffect, useRef, useState } from "react";
import { primaryChannel, type PublicChannels } from "@/lib/channels/public";

/**
 * Página de entrada dos participantes. O WhatsApp é o principal; o Telegram é a reserva.
 * Escolher o Telegram com o WhatsApp no ar pede confirmação. Se o WhatsApp cair, a página
 * troca sozinha e o Telegram vira o botão principal, sem pergunta.
 */
export function ChannelEntry({ initial }: { initial: PublicChannels }) {
  const [channels, setChannels] = useState(initial);
  const dialog = useRef<HTMLDialogElement>(null);
  const primary = primaryChannel(channels);

  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      try {
        const res = await fetch("/api/canais", { cache: "no-store" });
        if (res.ok && alive) setChannels(await res.json());
      } catch {
        /* mantém o último estado */
      }
    };
    const id = setInterval(refresh, 8_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  // Se o WhatsApp cair com a janela aberta, ela fecha: o Telegram já virou o principal.
  useEffect(() => {
    if (primary !== "whatsapp" && dialog.current?.open) dialog.current.close();
  }, [primary]);

  const button =
    "flex h-[52px] w-full items-center justify-center rounded-[10px] px-5 text-[16px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]";
  const solid = `${button} bg-[var(--brand)] text-[#FFFFFF] hover:bg-[var(--brand-deep)]`;
  const quiet = `${button} border border-[var(--border)] bg-[var(--card)] text-[var(--ink)] hover:bg-[var(--brand-tint)]`;

  return (
    <div className="space-y-6">
      {primary === "whatsapp" && (
        <>
          <a href={channels.whatsapp.link!} className={solid}>
            Começar pelo WhatsApp
          </a>
          {channels.telegram.online && channels.telegram.link && (
            <p className="text-center">
              <button
                type="button"
                onClick={() => dialog.current?.showModal()}
                className="cursor-pointer text-[14px] text-[var(--muted)] underline decoration-[var(--border)] underline-offset-4 hover:text-[var(--ink)]"
              >
                Prefiro usar o Telegram
              </button>
            </p>
          )}
        </>
      )}

      {primary === "telegram" && (
        <>
          <div role="status" className="rounded-[10px] bg-[var(--peach-soft)] px-4 py-3 text-[15px] leading-relaxed text-[var(--ink)]">
            <strong className="font-semibold">O WhatsApp está fora do ar agora.</strong> O atendimento continua pelo Telegram.
          </div>
          <a href={channels.telegram.link!} className={solid}>
            Continuar pelo Telegram
          </a>
          <p className="text-[14px] leading-relaxed text-[var(--muted)]">
            Já começou pelo WhatsApp? No Telegram, toque em “Já comecei pelo WhatsApp” para continuar de onde parou.
          </p>
        </>
      )}

      {primary === "none" && (
        <div role="status" className="rounded-[10px] border border-[var(--border)] bg-[var(--bg)] px-4 py-3 text-[15px] leading-relaxed">
          Os canais de atendimento estão fora do ar neste momento. Esta página se atualiza sozinha; tente de novo em instantes.
        </div>
      )}

      <dialog
        ref={dialog}
        aria-labelledby="telegram-aviso-titulo"
        className="m-auto w-[min(440px,calc(100vw-32px))] rounded-[14px] border border-[var(--frame-line)] bg-[var(--card)] p-0 text-[var(--ink)] shadow-[var(--sheet-shadow)] backdrop:bg-[rgba(36,54,59,0.45)]"
      >
        <div className="space-y-4 p-6">
          <h2 id="telegram-aviso-titulo" className="text-[19px] font-semibold tracking-tight">
            O WhatsApp é o canal principal
          </h2>
          <p className="text-[15px] leading-relaxed text-[var(--ink-2)]">
            O Telegram é a reserva, para quando o WhatsApp estiver fora do ar. Recomendamos começar pelo WhatsApp.
          </p>
          <p className="text-[15px] leading-relaxed text-[var(--ink-2)]">Quer continuar pelo Telegram mesmo assim?</p>
          <div className="flex flex-col gap-2 pt-2">
            <button type="button" autoFocus onClick={() => dialog.current?.close()} className={solid}>
              Voltar para o WhatsApp
            </button>
            {channels.telegram.link && (
              <a href={channels.telegram.link} className={quiet}>
                Continuar no Telegram
              </a>
            )}
          </div>
        </div>
      </dialog>
    </div>
  );
}

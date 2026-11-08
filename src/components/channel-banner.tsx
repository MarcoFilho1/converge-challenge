"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { PublicChannels } from "@/lib/channels/public";

/** Faixa no topo do painel quando o WhatsApp cai: diz o que fazer e leva ao QR. */
export function ChannelBanner() {
  const [channels, setChannels] = useState<PublicChannels | null>(null);

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
    void refresh();
    const id = setInterval(refresh, 10_000);
    window.addEventListener("canais:mudou", refresh);
    return () => {
      alive = false;
      clearInterval(id);
      window.removeEventListener("canais:mudou", refresh);
    };
  }, []);

  if (!channels || channels.whatsapp.online) return null;
  const tg = channels.telegram;

  return (
    <div role="status" className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-[12px] border border-[var(--frame-line)] bg-[var(--peach-soft)] px-4 py-3 text-[14px] text-[var(--ink)] sm:mb-3">
      <span className="flex-1">
        <strong className="font-semibold">WhatsApp fora do ar{channels.whatsapp.simulatedDown ? " (ensaio de queda)" : ""}.</strong>{" "}
        {tg.online
          ? `O atendimento continua pelo Telegram${tg.username ? ` (@${tg.username})` : ""}. Peça para as pessoas lerem o QR code de novo.`
          : "O Telegram também está fora. Confira a conexão na tela Canais."}
      </span>
      <span className="flex gap-4 font-medium">
        <Link href="/entrar/cartaz" className="text-[var(--brand-deep)] underline underline-offset-4">
          Mostrar QR
        </Link>
        <Link href="/conexao" className="text-[var(--brand-deep)] underline underline-offset-4">
          Canais
        </Link>
      </span>
    </div>
  );
}

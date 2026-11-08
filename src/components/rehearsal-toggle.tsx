"use client";

import { useState, useTransition } from "react";
import { setWhatsappRehearsal } from "@/app/(app)/conexao/actions";

/** Liga e desliga o ensaio da queda do WhatsApp, para testar a reserva sem desconectar o celular. */
export function RehearsalToggle({ initial }: { initial: boolean }) {
  const [down, setDown] = useState(initial);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={pending}
        aria-pressed={down}
        onClick={() =>
          start(async () => {
            setDown((await setWhatsappRehearsal(!down)).down);
            // A faixa do painel confere os canais na hora, sem esperar a próxima consulta.
            window.dispatchEvent(new Event("canais:mudou"));
          })
        }
        className={`h-[36px] cursor-pointer rounded-[8px] px-4 text-[14px] font-medium transition-colors disabled:opacity-60 ${
          down
            ? "bg-[var(--brand)] text-[#FFFFFF] hover:bg-[var(--brand-deep)]"
            : "border border-[var(--border)] bg-[var(--card)] text-[var(--ink)] hover:bg-[var(--brand-tint)]"
        }`}
      >
        {down ? "Encerrar ensaio e voltar ao WhatsApp" : "Ensaiar queda do WhatsApp"}
      </button>
      <span className="text-[13px] text-[var(--muted)]">
        {down ? "Ensaio ligado: o sistema age como se o WhatsApp tivesse caído." : "O celular continua conectado; só o sistema passa a usar a reserva."}
      </span>
    </div>
  );
}

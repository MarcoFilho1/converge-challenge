import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { ChannelEntry } from "@/components/channel-entry";
import { getPublicChannels } from "@/lib/channels/status";

export const metadata = { title: "Testar o atendimento · Praevenius", description: "Comece o questionário de saúde ocupacional pelo WhatsApp (ou pelo Telegram, a reserva)." };

async function Chooser() {
  await connection();
  return <ChannelEntry initial={await getPublicChannels()} />;
}

export default function EntrarPage() {
  return (
    <div className="min-h-svh bg-[var(--frame)] px-4 py-8 text-[var(--ink)] sm:py-14">
      <main className="mx-auto w-full max-w-[460px] rounded-[18px] border border-[var(--frame-line)] bg-[var(--card)] px-6 py-8 shadow-[var(--sheet-shadow)] sm:px-9 sm:py-10">
        <Link href="/" className="inline-flex items-center gap-2" aria-label="Praevenius, início">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/praevenius-mark.png" alt="" width={28} height={28} />
          <span className="text-[19px] font-semibold tracking-tight">praevenius</span>
        </Link>
        <h1 className="mt-8 text-[26px] font-semibold leading-tight tracking-tight">Teste o atendimento pelo seu celular</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-[var(--ink-2)]">
          Você vai responder, como um colaborador, um questionário curto de saúde ocupacional. No fim, pode conversar com a Helena, a assistente da médica.
        </p>
        <p className="mt-2 text-[14px] leading-relaxed text-[var(--muted)]">É uma demonstração. Para parar a qualquer momento, escreva PARAR.</p>
        <div className="mt-8">
          <Suspense fallback={<div className="h-[52px] animate-pulse rounded-[10px] bg-[var(--raised)]" aria-label="Verificando os canais" />}>
            <Chooser />
          </Suspense>
        </div>
      </main>
    </div>
  );
}

import { Suspense } from "react";
import { connection } from "next/server";
import { DemoGuide } from "@/components/demo-guide";
import { getPublicChannels } from "@/lib/channels/status";
import { entryQrSvg } from "@/lib/channels/qr";

export const metadata = {
  title: "Iniciar a demo · Praevenius",
  description: "Roteiro da demonstração: responda como colaborador, converse com a Helena, entre como a médica e veja o que o sistema fez.",
};

async function Guide() {
  await connection();
  // O QR sai pronto do servidor: não depende de nada carregar no navegador de quem avalia.
  const [channels, qr] = await Promise.all([getPublicChannels(), entryQrSvg()]);
  return <DemoGuide channels={channels} qr={qr} />;
}

export default function DemoPage() {
  return (
    <Suspense fallback={<div className="min-h-svh bg-[var(--frame)] p-8 text-[14px] text-[var(--muted)]">Preparando o roteiro...</div>}>
      <Guide />
    </Suspense>
  );
}

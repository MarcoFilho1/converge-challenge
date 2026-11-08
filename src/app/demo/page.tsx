import { Suspense } from "react";
import { connection } from "next/server";
import { DemoGuide } from "@/components/demo-guide";
import { getPublicChannels } from "@/lib/channels/status";

export const metadata = {
  title: "Iniciar a demo · Praevenius",
  description: "Roteiro da demonstração: responda como colaborador, converse com a Helena, entre como a médica e veja o que o sistema fez.",
};

async function Guide() {
  await connection();
  return <DemoGuide channels={await getPublicChannels()} />;
}

export default function DemoPage() {
  return (
    <Suspense fallback={<div className="min-h-svh bg-[var(--frame)] p-8 text-[14px] text-[var(--muted)]">Preparando o roteiro...</div>}>
      <Guide />
    </Suspense>
  );
}

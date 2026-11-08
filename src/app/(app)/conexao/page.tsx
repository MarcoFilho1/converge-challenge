import { Suspense } from "react";
import { connection } from "next/server";
import { fetchConnection } from "./actions";
import { QrPanel } from "@/components/qr-panel";
import { TelegramPanel } from "@/components/telegram-panel";

async function ConexaoContent() {
  // Estado ao vivo do WhatsApp (com horário): sempre na hora do pedido, nunca pré-renderizado.
  await connection();
  const initial = await fetchConnection();
  return <QrPanel initial={initial} />;
}

export default function ConexaoPage() {
  return (
    <>
      <Suspense
        fallback={
          <div className="p-6 text-[14px] text-[var(--muted)]">
            Verificando conexão WhatsApp...
          </div>
        }
      >
        <ConexaoContent />
      </Suspense>
      <Suspense fallback={null}>
        <TelegramPanel />
      </Suspense>
    </>
  );
}

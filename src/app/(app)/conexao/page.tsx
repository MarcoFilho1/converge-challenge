import { Suspense } from "react";
import { fetchConnection } from "./actions";
import { QrPanel } from "@/components/qr-panel";

async function ConexaoContent() {
  const initial = await fetchConnection();
  return <QrPanel initial={initial} />;
}

export default function ConexaoPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 text-[14px] text-[var(--muted)]">
          Verificando conexão WhatsApp...
        </div>
      }
    >
      <ConexaoContent />
    </Suspense>
  );
}

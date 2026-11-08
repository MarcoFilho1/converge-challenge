import { Suspense } from "react";
import { QueueView } from "@/components/queue-view";
import { listQueue } from "@/lib/queue/query";

async function FilaContent() {
  const { rows, isSyntheticFallback } = await listQueue();
  return <QueueView rows={rows} isSyntheticFallback={isSyntheticFallback} />;
}

export default function FilaPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 text-[14px] text-[var(--muted)]">
          Carregando fila de triagem NR-7...
        </div>
      }
    >
      <FilaContent />
    </Suspense>
  );
}

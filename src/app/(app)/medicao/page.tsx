import { Suspense } from "react";
import { MetricsView } from "@/components/metrics-view";
import { loadMetrics } from "@/lib/obs/query";

async function MedicaoContent() {
  const { metrics, since, events } = await loadMetrics();
  return <MetricsView metrics={metrics} since={since} events={events} />;
}

export default function MedicaoPage() {
  return (
    <Suspense fallback={<div className="p-6 text-[14px] text-[var(--muted)]">Calculando custos e tempos...</div>}>
      <MedicaoContent />
    </Suspense>
  );
}

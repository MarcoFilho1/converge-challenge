import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { listQueue } from "@/lib/queue/query";

async function AppShellWithCounts({
  children,
}: {
  children: React.ReactNode;
}) {
  const { rows } = await listQueue();
  const urgentCount = rows.filter((r) => r.severity === "urgency").length;
  // Conta todos os casos abertos (prioridade e atenção), como o título da Fila.
  const priorityCount = rows.filter((r) => r.severity === "priority" || r.severity === "attention").length;

  return (
    <AppShell urgentCount={urgentCount} priorityCount={priorityCount}>
      {children}
    </AppShell>
  );
}

export default function AuthenticatedAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--bg)]" />}>
      <AppShellWithCounts>{children}</AppShellWithCounts>
    </Suspense>
  );
}

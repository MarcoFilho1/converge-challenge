import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { listQueue } from "@/lib/queue/query";
import { countUnread } from "@/lib/notices/store";

async function AppShellWithCounts({
  children,
}: {
  children: React.ReactNode;
}) {
  const [{ rows }, noticeCount] = await Promise.all([listQueue(), countUnread()]);
  const urgentCount = rows.filter((r) => r.severity === "urgency").length;
  // Conta todos os casos abertos (prioridade e atenção), como o título da Fila.
  const priorityCount = rows.filter((r) => r.severity === "priority" || r.severity === "attention").length;

  return (
    <AppShell urgentCount={urgentCount} priorityCount={priorityCount} noticeCount={noticeCount}>
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

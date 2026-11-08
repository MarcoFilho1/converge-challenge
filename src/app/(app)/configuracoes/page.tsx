import { Suspense } from "react";
import { connection } from "next/server";
import { desc, eq } from "drizzle-orm";
import { SettingsForm } from "@/components/settings-form";
import { envDefaults, getSettings } from "@/lib/settings";

async function recentChanges(): Promise<{ at: string; detail: string }[]> {
  try {
    const { db } = await import("@/db/client");
    const { agentEvents } = await import("@/db/schema");
    const rows = await db
      .select({ at: agentEvents.createdAt, detail: agentEvents.detail })
      .from(agentEvents)
      .where(eq(agentEvents.kind, "configuração"))
      .orderBy(desc(agentEvents.createdAt))
      .limit(6);
    return rows.map((r) => ({ at: r.at.toISOString(), detail: r.detail ?? "" }));
  } catch {
    return [];
  }
}

async function ConfigContent() {
  // Sempre lida na hora: a médica acabou de salvar e precisa ver o valor novo.
  await connection();
  const [settings, changes] = await Promise.all([getSettings(), recentChanges()]);
  return <SettingsForm settings={settings} defaults={envDefaults()} changes={changes} />;
}

export default function ConfiguracoesPage() {
  return (
    <Suspense fallback={<div className="p-6 text-[14px] text-[var(--muted)]">Carregando configurações...</div>}>
      <ConfigContent />
    </Suspense>
  );
}

import { Suspense } from "react";
import { NoticesView } from "@/components/notices-view";
import { listNotices } from "@/lib/notices/store";

async function AvisosContent() {
  let rows: Awaited<ReturnType<typeof listNotices>> = [];
  try {
    rows = await listNotices();
  } catch {
    rows = [];
  }
  return (
    <NoticesView
      notices={rows.map((n) => ({
        id: n.id,
        createdAt: n.createdAt.toISOString(),
        kind: n.kind,
        contactName: n.contactName,
        text: n.text,
        runId: n.runId,
        unread: n.readAt === null,
      }))}
    />
  );
}

export default function AvisosPage() {
  return (
    <Suspense fallback={<div className="p-6 text-[14px] text-[var(--muted)]">Carregando avisos...</div>}>
      <AvisosContent />
    </Suspense>
  );
}

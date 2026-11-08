import { Suspense } from "react";
import { ContactsTable } from "@/components/contacts-table";
import { listContactsWithRuns } from "@/lib/contacts/query";

async function ContatosContent() {
  const { rows, isSyntheticFallback } = await listContactsWithRuns();
  return (
    <ContactsTable initialRows={rows} isSyntheticFallback={isSyntheticFallback} />
  );
}

export default function ContatosPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 text-[14px] text-[var(--muted)]">
          Carregando colaboradores...
        </div>
      }
    >
      <ContatosContent />
    </Suspense>
  );
}

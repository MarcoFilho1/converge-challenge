import { Suspense } from "react";
import { CaseView } from "@/components/case-view";
import { getCase } from "@/lib/case/query";

async function CasoContent({
  params,
  searchParams,
}: {
  params: Promise<{ runId: string }>;
  searchParams: Promise<{ aba?: string; tab?: string }>;
}) {
  const { runId } = await params;
  const sp = await searchParams;
  const initialTab =
    sp.aba === "entrevista" || sp.tab === "entrevista"
      ? "entrevista"
      : "questionario";
  const data = await getCase(runId);
  return <CaseView initialData={data} initialTab={initialTab} />;
}

export default function CasoPage({
  params,
  searchParams,
}: {
  params: Promise<{ runId: string }>;
  searchParams: Promise<{ aba?: string; tab?: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="p-6 text-[14px] text-[var(--muted)]">
          Carregando prontuário do caso...
        </div>
      }
    >
      <CasoContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

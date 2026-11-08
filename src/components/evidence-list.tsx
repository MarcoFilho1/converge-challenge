"use client";

import { useState } from "react";
import type { CaseEvidenceItem } from "@/lib/demo/fixtures";

const PREVIEW = 240;

/** Remove sobras de formulário em PDF (caixinhas de marcar) e junta espaços. */
const clean = (t: string) => t.replace(/[□☐▢]/g, " ").replace(/\s+/g, " ").trim();

function Quote({ ev }: { ev: CaseEvidenceItem }) {
  const [full, setFull] = useState(false);
  const text = clean(ev.chunk.text);
  const long = text.length > PREVIEW;
  return (
    <figure className="mt-2 rounded-[10px] bg-[var(--bg)] px-3.5 py-3">
      <blockquote className="text-[13px] leading-[1.55] text-[var(--ink-2)]">
        “{long && !full ? `${text.slice(0, PREVIEW).trimEnd()}…` : text}”
      </blockquote>
      <figcaption className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[12px] text-[var(--muted)]">
        <span>
          {ev.chunk.documentTitle}
          {ev.chunk.page !== null && <span className="tabular-nums">, pág. {ev.chunk.page}</span>}
        </span>
        {long && (
          <button type="button" onClick={() => setFull((v) => !v)} className="cursor-pointer text-[var(--brand)] underline underline-offset-2">
            {full ? "mostrar menos" : "ver trecho completo"}
          </button>
        )}
      </figcaption>
    </figure>
  );
}

/** Indícios agrupados pela resposta que os gerou: a explicação uma vez, depois os trechos de origem. */
export function EvidenceList({ evidence }: { evidence: CaseEvidenceItem[] }) {
  if (evidence.length === 0) {
    return <p className="text-[14px] text-[var(--muted)]">Nenhum trecho citado neste questionário.</p>;
  }
  const groups = new Map<string, CaseEvidenceItem[]>();
  for (const ev of evidence) groups.set(ev.itemCode, [...(groups.get(ev.itemCode) ?? []), ev]);

  return (
    <div className="space-y-6">
      {[...groups.entries()].map(([itemCode, items]) => (
        <section key={itemCode} aria-label={`Indício da resposta ${itemCode}`}>
          <p className="text-[14px] text-[var(--ink)]">{items[0].explanation}</p>
          {items.map((ev) => (
            <Quote key={ev.id} ev={ev} />
          ))}
        </section>
      ))}
    </div>
  );
}

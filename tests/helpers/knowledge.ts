import manifest from "../../knowledge/manifest.json";
import type { ManifestEntry } from "@/lib/rag/ingest";

const all = manifest as ManifestEntry[];
const pick = (...files: string[]) => all.filter((m) => files.includes(m.file));

/** Base pequena para testes: as fichas dos instrumentos + o protocolo de crise + a NR-1. */
export const TEST_MANIFEST: ManifestEntry[] = pick(
  "instrumentos/tronco-presenteismo-wpai.md",
  "instrumentos/phq-9.md",
  "instrumentos/gad-7.md",
  "instrumentos/bat-12.md",
  "instrumentos/copsoq-ii-br.md",
  "crise/cvv-como-ajudar.md",
  "normas/nr-01-atualizada-2025.pdf",
);

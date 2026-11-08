import type { Turn } from "./types";

export function formatOrigin(turn: Pick<Turn, "idx" | "startedMs">): string {
  const total = Math.max(0, Math.floor(turn.startedMs / 1000));
  const mm = String(Math.floor(total / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");
  return `turno ${turn.idx} · ${mm}:${ss}`;
}

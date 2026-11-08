import { BLOCKS } from "./protocol";
import type { Agenda, AgendaBlock } from "./agenda";
import type { BlockId, Finding, Probe, ProbeCondition, Turn } from "./types";

export type Selection = { kind: "probe"; blockId: BlockId; probe: Probe } | { kind: "block"; blockId: BlockId; blockIndex: number };

export function conditionActive(when: ProbeCondition, blockFindings: Finding[]): boolean {
  switch (when) {
    case "sempre": return true;
    case "semDuracao": return !blockFindings.some((f) => f.duracao);
    case "semFrequencia": return !blockFindings.some((f) => f.tema === "frequencia");
    case "naoProcurou": return !blockFindings.some((f) => f.tema === "procurou");
    case "mencionouTrabalho": return blockFindings.some((f) => f.mencionaTrabalho);
    case "mencionouChefia": return blockFindings.some((f) => f.tema === "chefia");
  }
}

/** Todas as sondas que ainda cabem no bloco agora (vazio quando o bloco saturou). */
export function candidateProbes(block: AgendaBlock, probesAsked: string[], turns: Turn[], findings: Finding[]): Probe[] {
  const def = BLOCKS[block.id];
  const askedHere = def.probes.filter((p) => probesAsked.includes(p.id)).length;
  const personTurnsHere = turns.filter((t) => t.speaker === "person" && t.blockId === block.id).length;
  if (askedHere >= block.maxProbes || personTurnsHere >= def.maxTurns) return [];
  const blockFindings = findings.filter((f) => f.blockId === block.id);
  // Assunto que a pessoa já trouxe neste bloco sai das opções (barreiras e necessidades têm várias perguntas no mesmo tema).
  const said = new Set<string>(blockFindings.map((f) => f.tema).filter((t) => t !== "barreira" && t !== "necessidade" && t !== "outro"));
  return def.probes.filter((p) => !probesAsked.includes(p.id) && conditionActive(p.when, blockFindings) && !said.has(p.covers));
}

/** Próxima sonda dentro do bloco atual, ou null quando o bloco saturou. */
export function nextProbe(block: AgendaBlock, probesAsked: string[], turns: Turn[], findings: Finding[]): Probe | null {
  const def = BLOCKS[block.id];
  const askedHere = def.probes.filter((p) => probesAsked.includes(p.id)).length;
  const personTurnsHere = turns.filter((t) => t.speaker === "person" && t.blockId === block.id).length;
  if (askedHere >= block.maxProbes || personTurnsHere >= def.maxTurns) return null;
  const blockFindings = findings.filter((f) => f.blockId === block.id);
  return def.probes.find((p) => !probesAsked.includes(p.id) && conditionActive(p.when, blockFindings)) ?? null;
}

/** Decide o que vem depois: uma sonda no bloco atual ou a pergunta-base do próximo bloco. */
export function selectNext(agenda: Agenda, blockIndex: number, probesAsked: string[], turns: Turn[], findings: Finding[]): Selection {
  const current = agenda.blocks[blockIndex];
  if (current && current.maxProbes > 0) {
    const probe = nextProbe(current, probesAsked, turns, findings);
    if (probe) return { kind: "probe", blockId: current.id, probe };
  }
  const nextIndex = Math.min(blockIndex + 1, agenda.blocks.length - 1);
  return { kind: "block", blockId: agenda.blocks[nextIndex].id, blockIndex: nextIndex };
}

export function fechamentoIndex(agenda: Agenda): number {
  return agenda.blocks.findIndex((b) => b.id === "fechamento");
}

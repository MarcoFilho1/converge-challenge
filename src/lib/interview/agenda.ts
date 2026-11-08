import type { BlockId, InterviewInput } from "./types";

export type AgendaBlock = { id: BlockId; required: boolean; maxProbes: number };
export type Agenda = { blocks: AgendaBlock[]; skipInterview: boolean };

const REQUIRED_PROBES = 3;
const CONFIRM_PROBES = 1;

/**
 * Pauta determinística (spec §5.2): domínios com item em atenção vêm primeiro e são obrigatórios;
 * os demais viram confirmação. Segurança e fechamento sempre.
 */
export function buildAgenda(input: InterviewInput): Agenda {
  const f = input.flags;
  const saude = f.exaustao || f.humor || f.ansiedade || f.trabalhouDoente;
  const trabalho = f.ritmoAlto || f.assedio || (f.prejuizoTrabalho ?? 0) >= 3;
  const barreiras = saude;

  const domains: { id: BlockId; required: boolean }[] = [
    { id: "saude", required: saude },
    { id: "trabalho", required: trabalho },
    { id: "barreiras", required: barreiras },
  ];
  const ordered = [...domains.filter((d) => d.required), ...domains.filter((d) => !d.required)];

  return {
    skipInterview: input.severity === "urgency",
    blocks: [
      { id: "abertura", required: true, maxProbes: 0 },
      ...ordered.map((d) => ({ id: d.id, required: d.required, maxProbes: d.required ? REQUIRED_PROBES : CONFIRM_PROBES })),
      { id: "seguranca", required: true, maxProbes: 0 },
      { id: "fechamento", required: true, maxProbes: 0 },
    ],
  };
}

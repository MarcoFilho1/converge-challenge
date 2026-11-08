import type { BlockId, InterviewStatus } from "./contract";

export type { BlockId, InterviewStatus };

export type ProbeCondition = "semDuracao" | "semFrequencia" | "naoProcurou" | "mencionouTrabalho" | "mencionouChefia" | "sempre";

export type FindingTheme =
  | "sintoma" | "duracao" | "frequencia" | "gatilho" | "alivio" | "procurou" | "tratamento"
  | "carga" | "chefia" | "pausa" | "mudanca" | "necessidade" | "barreira" | "seguranca" | "outro";

export const FINDING_THEMES: FindingTheme[] = [
  "sintoma", "duracao", "frequencia", "gatilho", "alivio", "procurou", "tratamento",
  "carga", "chefia", "pausa", "mudanca", "necessidade", "barreira", "seguranca", "outro",
];

export type Probe = { id: string; text: string; when: ProbeCondition; covers: FindingTheme };

export type Block = { id: BlockId; label: string; base: string; probes: Probe[]; maxTurns: number; required: boolean };

export type Finding = {
  tema: FindingTheme;
  texto: string;
  duracao: string | null;
  intensidade: "leve" | "moderada" | "forte" | null;
  mencionaTrabalho: boolean;
  pediuParar: boolean;
  turnIdx: number;
  blockId: BlockId;
};

export type Turn = {
  idx: number;
  speaker: "ai" | "person";
  text: string;
  blockId: BlockId;
  probeId: string | null;
  startedMs: number;
  durationMs: number | null;
};

export type InterviewInput = {
  runId: string | null;
  severity: "none" | "attention" | "priority" | "urgency";
  flags: {
    trabalhouDoente: boolean;
    prejuizoTrabalho: number | null;
    exaustao: boolean;
    humor: boolean;
    ansiedade: boolean;
    assedio: boolean;
    ritmoAlto: boolean;
  };
  abertas: { OPEN_1?: string; OPEN_2?: string };
  doctorName: string;
};

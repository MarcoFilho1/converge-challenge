import type { InterviewInput } from "./types";

const base = (over: Partial<InterviewInput["flags"]>, severity: InterviewInput["severity"]): InterviewInput => ({
  runId: null,
  severity,
  flags: {
    trabalhouDoente: false, prejuizoTrabalho: null, exaustao: false, humor: false, ansiedade: false, assedio: false, ritmoAlto: false,
    ...over,
  },
  abertas: {},
  doctorName: "Dra. Ana Lima",
});

/** Entradas sintéticas para desenvolvimento e demo. Nenhuma pessoa real. */
export const FIXTURES = {
  semIndicio: base({}, "none"),
  atencao: base({ trabalhouDoente: true, prejuizoTrabalho: 4 }, "attention"),
  prioridade: {
    ...base({ trabalhouDoente: true, prejuizoTrabalho: 7, exaustao: true, humor: true, ritmoAlto: true }, "priority"),
    abertas: { OPEN_1: "o fechamento do mês e as metas", OPEN_2: "mais gente na equipe" },
  },
} satisfies Record<"semIndicio" | "atencao" | "prioridade", InterviewInput>;

export type FixtureName = keyof typeof FIXTURES;

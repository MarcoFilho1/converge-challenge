import { BAT12_NUMBERS } from "./items";
import type { Answers, Score } from "./types";

/**
 * Cortes adotados (docs/questionario-whatsapp.md, seção 0.2):
 * PHQ-9 >= 10 (Osório 2009; manual Pfizer), grave >= 15; item 9 >= 1 = urgência (manual Pfizer p.2).
 * GAD-7 >= 10 (manual Pfizer; sem corte brasileiro), grave >= 15.
 * BAT-12 média >= 2,54 risco, >= 2,96 grave (Schaufeli 2023, Tabela 3).
 * WPAI Q5 >= 3: operacional, sem validação.
 * COPSOQ 23: qualquer "sim" = assédio (Sato 2026).
 */
export const CUTOFFS = {
  PHQ9: 10,
  PHQ9_SEVERE: 15,
  PHQ9_ITEM9: 1,
  PHQ2_GATE: 2,
  PHQ2_DEMO: 3,
  GAD7: 10,
  GAD7_SEVERE: 15,
  GAD2_GATE: 2,
  BAT12: 2.54,
  BAT12_SEVERE: 2.96,
  BAT_ITEM_DEMO: 4,
  WPAI_Q5: 3,
} as const;

const has = (a: Answers, code: string) => a[code] !== undefined && a[code] !== null;
/** O item foi perguntado (tem linha de resposta, mesmo que nula). */
const asked = (a: Answers, codes: string[]) => codes.some((c) => c in a);
const val = (a: Answers, code: string) => a[code] as number;

function total(a: Answers, codes: string[]) {
  const present = codes.filter((c) => has(a, c));
  return { complete: present.length === codes.length, any: present.length > 0, sum: present.reduce((s, c) => s + val(a, c), 0), n: present.length };
}

export function scoreRun(answers: Answers, demoShort: boolean): Score[] {
  const out: Score[] = [];
  const push = (instrument: string, dimension: string, value: number, cutoff: number, flagged: boolean, complete = true) =>
    out.push({ instrument, dimension, value: Math.round(value * 100) / 100, cutoff, flagged, complete });

  if (has(answers, "WPAI_Q5")) {
    const v = val(answers, "WPAI_Q5");
    push("WPAI", "work_impairment", v, CUTOFFS.WPAI_Q5, v >= CUTOFFS.WPAI_Q5);
  }

  const phq2 = total(answers, ["PHQ9_1", "PHQ9_2"]);
  if (phq2.complete) {
    const cutoff = demoShort ? CUTOFFS.PHQ2_DEMO : CUTOFFS.PHQ2_GATE;
    push("PHQ2", "total", phq2.sum, cutoff, phq2.sum >= cutoff);
  }
  // Total do PHQ-9 sempre que a porta abriu (algum item 3–8 foi perguntado). Com item nulo, a soma
  // dos presentes é limite inferior do total: se já passa do corte, o sinal é certo.
  const phq9 = total(answers, Array.from({ length: 9 }, (_, i) => `PHQ9_${i + 1}`));
  if (phq9.complete || asked(answers, [3, 4, 5, 6, 7, 8].map((i) => `PHQ9_${i}`))) {
    push("PHQ9", "total", phq9.sum, CUTOFFS.PHQ9, phq9.sum >= CUTOFFS.PHQ9, phq9.complete);
  }
  if (has(answers, "PHQ9_9")) {
    const v = val(answers, "PHQ9_9");
    push("PHQ9", "item9", v, CUTOFFS.PHQ9_ITEM9, v >= CUTOFFS.PHQ9_ITEM9);
  }

  const gad2 = total(answers, ["GAD7_1", "GAD7_2"]);
  if (gad2.complete) push("GAD2", "total", gad2.sum, CUTOFFS.GAD2_GATE, gad2.sum >= CUTOFFS.GAD2_GATE);
  const gad7 = total(answers, Array.from({ length: 7 }, (_, i) => `GAD7_${i + 1}`));
  if (gad7.complete || asked(answers, [3, 4, 5, 6, 7].map((i) => `GAD7_${i}`))) {
    push("GAD7", "total", gad7.sum, CUTOFFS.GAD7, gad7.sum >= CUTOFFS.GAD7, gad7.complete);
  }

  if (demoShort) {
    if (has(answers, "BAT_1")) {
      const v = val(answers, "BAT_1");
      push("BAT", "item1", v, CUTOFFS.BAT_ITEM_DEMO, v >= CUTOFFS.BAT_ITEM_DEMO);
    }
  } else {
    const bat = total(answers, BAT12_NUMBERS.map((n) => `BAT_${n}`));
    if (bat.any) {
      const mean = bat.sum / bat.n;
      // Média dos presentes; só sinaliza com pelo menos metade dos 12 itens respondidos.
      push("BAT12", "total", mean, CUTOFFS.BAT12, bat.n >= 6 && mean >= CUTOFFS.BAT12, bat.complete);
    }
  }

  // COPSOQ com 1 item por fator: descritivo, sem corte validado (pesquisa 1.5).
  if (has(answers, "COPSOQ_2A")) push("COPSOQ", "ritmo", val(answers, "COPSOQ_2A"), 3, val(answers, "COPSOQ_2A") >= 3);
  if (has(answers, "COPSOQ_4A")) push("COPSOQ", "influencia", val(answers, "COPSOQ_4A"), 1, val(answers, "COPSOQ_4A") <= 1);
  if (has(answers, "COPSOQ_12B")) push("COPSOQ", "apoio_superior", val(answers, "COPSOQ_12B"), 1, val(answers, "COPSOQ_12B") <= 1);
  if (has(answers, "COPSOQ_23")) push("COPSOQ", "assedio", val(answers, "COPSOQ_23"), 5, val(answers, "COPSOQ_23") < 5);

  return out;
}

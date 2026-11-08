/**
 * Resumo para o médico: o LLM propõe, o código valida. Toda frase precisa apontar para um turno
 * da pessoa que existe; texto com termo proibido cai. Totais são recalculados dos turnos.
 */
import { z } from "zod";
import type { InterviewAi } from "@/lib/ai/interview";
import { assertNoForbidden } from "@/lib/ai/forbidden-terms";
import { InterviewSummary as SummarySchema, type InterviewSummary } from "./contract";
import type { InterviewState } from "./engine";
import { formatOrigin } from "./origin";
import type { Turn } from "./types";

const LooseOrigin = z.object({ turnIdx: z.number().int(), label: z.string().optional() });
const LooseCited = z.object({ texto: z.string(), origem: z.array(LooseOrigin) });
const LooseSummary = z.object({
  dificuldades_relatadas: z.array(LooseCited.extend({ duracao: z.string().nullable().optional() })),
  impacto_no_trabalho: z.array(LooseCited),
  fatores_do_trabalho: z.array(LooseCited),
  barreiras_atendimento: z.array(LooseCited),
  sinais_de_alerta: z.object({ risco: z.boolean(), origem: z.array(LooseOrigin) }),
  pontos_para_avaliacao: z.array(LooseCited),
  nao_respondido: z.array(z.string()),
});

export function validateSummary(raw: unknown, turns: Turn[]): InterviewSummary {
  const loose = LooseSummary.parse(raw);
  const person = new Map(turns.filter((t) => t.speaker === "person").map((t) => [t.idx, t]));

  const origins = (list: { turnIdx: number }[]) =>
    list
      .filter((o) => person.has(o.turnIdx))
      .map((o) => ({ turnIdx: o.turnIdx, label: formatOrigin(person.get(o.turnIdx)!) }));
  const clean = <T extends { texto: string; origem: { turnIdx: number }[] }>(list: T[]) =>
    list
      .filter((e) => assertNoForbidden(e.texto).length === 0)
      .map((e) => ({ ...e, origem: origins(e.origem) }))
      .filter((e) => e.origem.length > 0);

  const last = turns.at(-1);
  const durationMs = last ? last.startedMs + (last.durationMs ?? 0) : 0;

  return SummarySchema.parse({
    dificuldades_relatadas: clean(loose.dificuldades_relatadas).map((d) => ({ texto: d.texto, duracao: d.duracao ?? null, origem: d.origem })),
    impacto_no_trabalho: clean(loose.impacto_no_trabalho),
    fatores_do_trabalho: clean(loose.fatores_do_trabalho),
    barreiras_atendimento: clean(loose.barreiras_atendimento),
    sinais_de_alerta: { risco: loose.sinais_de_alerta.risco, origem: origins(loose.sinais_de_alerta.origem) },
    pontos_para_avaliacao: clean(loose.pontos_para_avaliacao),
    nao_respondido: loose.nao_respondido.filter((t) => assertNoForbidden(t).length === 0),
    duracao_min: Math.round((durationMs / 60_000) * 10) / 10,
    turnos: person.size,
  });
}

export async function buildSummary(state: InterviewState, ai: InterviewAi): Promise<InterviewSummary> {
  const raw = await ai.summarize({ turns: state.turns, findings: state.findings, agenda: state.agenda, skipped: state.skipped });
  const summary = validateSummary(raw, state.turns);
  if (state.status === "crisis") {
    const lastPerson = [...state.turns].reverse().find((t) => t.speaker === "person");
    summary.sinais_de_alerta = { risco: true, origem: lastPerson ? [{ turnIdx: lastPerson.idx, label: formatOrigin(lastPerson) }] : [] };
  }
  return summary;
}

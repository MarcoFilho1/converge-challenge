/**
 * Resumo da pessoa para o topo do Caso: se a entrevista foi necessária e por quê, como foi,
 * o que pede atenção e o que levar para a consulta. Tudo montado em código a partir do que já está gravado.
 */
import type { RunSummary } from "@/lib/ai/types";
import type { InterviewDetail, InterviewListItem } from "@/lib/interview/contract";
import { ABANDON_AVISO_PREFIX } from "@/lib/interview/protocol";
import { shouldInviteToInterview, type SeverityLevel } from "@/lib/instruments";

export type InterviewState =
  | "nao_necessaria"
  | "nao_indicada"
  | "sem_convite"
  | "convidada"
  | "em_andamento"
  | "interrompida"
  | "crise_na_entrevista"
  | "concluida";

export type PatientSummary = {
  interview: { state: InterviewState; headline: string; detail?: string };
  howItWent: string[];
  attention: string[];
  forConsult: string[];
};

export type PatientSummaryInput = {
  run: { severity: SeverityLevel; status: string; wellbeingIndex?: number | null; partial: boolean };
  interviews: InterviewListItem[];
  interviewDetail: Pick<InterviewDetail, "summary"> | null;
  summary: RunSummary | null;
  threshold: number;
};

const minutes = (ms: number | null | undefined) => (ms ? Math.max(1, Math.round(ms / 60000)) : null);

/** Encerrada pelo servidor porque a pessoa sumiu: o resumo traz o aviso montado em código. */
function abandoned(input: PatientSummaryInput): boolean {
  return (input.interviewDetail?.summary?.avisos ?? []).some((a) => a.texto.startsWith(ABANDON_AVISO_PREFIX));
}

function interviewLine(input: PatientSummaryInput): PatientSummary["interview"] {
  const { run, interviews, threshold } = input;
  const index = run.wellbeingIndex ?? null;
  const latest = interviews.find((i) => i.hasSummary) ?? interviews[0];

  if (!latest) {
    if (run.severity === "urgency" || run.status === "crisis") {
      return { state: "nao_indicada", headline: "Entrevista não indicada: é urgência e precisa de contato humano." };
    }
    if (shouldInviteToInterview({ severity: run.severity, index, threshold })) {
      return { state: "sem_convite", headline: "Entrevista indicada, mas o convite não foi enviado.", detail: "Use Convidar para entrevista." };
    }
    return {
      state: "nao_necessaria",
      headline: "Entrevista não foi necessária.",
      detail: index === null ? "Sem respostas suficientes para o índice e nenhum critério da regra." : `Índice ${index}, acima do limite de ${threshold}, e nenhum critério da regra.`,
    };
  }

  const min = minutes(latest.durationMs);
  switch (latest.status) {
    case "consent":
      return { state: "convidada", headline: "Convidada para a entrevista; ainda não começou." };
    case "running":
      return { state: "em_andamento", headline: "Entrevista em andamento." };
    case "stopped":
      if (abandoned(input)) return { state: "interrompida", headline: `A conversa caiu no meio (página fechada ou conexão perdida)${min ? `, depois de ${min} min` : ""}.` };
      return { state: "interrompida", headline: `A pessoa parou a entrevista no meio${min ? `, depois de ${min} min` : ""}.` };
    case "crisis":
      return { state: "crise_na_entrevista", headline: "A entrevista foi interrompida por frase de risco." };
    default: {
      const s = input.interviewDetail?.summary;
      const dur = s?.duracao_min ?? min;
      return { state: "concluida", headline: `Entrevista concluída${dur ? ` em ${dur} min` : ""}${s ? `, ${s.turnos} falas` : ""}.` };
    }
  }
}

export function patientSummary(input: PatientSummaryInput): PatientSummary {
  const interview = interviewLine(input);
  const s = input.interviewDetail?.summary ?? null;

  const howItWent = s
    ? [
        ...s.dificuldades_relatadas.slice(0, 1).map((d) => (d.duracao ? `${d.texto} (${d.duracao})` : d.texto)),
        ...s.impacto_no_trabalho.slice(0, 1).map((d) => d.texto),
        ...s.fatores_do_trabalho.slice(0, 1).map((d) => d.texto),
        ...s.barreiras_atendimento.slice(0, 1).map((d) => d.texto),
      ]
    : [];

  const attention: string[] = [];
  if (s?.sinais_de_alerta.risco || interview.state === "crise_na_entrevista") attention.push("Sinal de risco na entrevista: a Helena parou e orientou CVV 188 e SAMU 192.");
  if (input.run.severity === "urgency" || input.run.status === "crisis") attention.push("Urgência no questionário: a pessoa recebeu CVV 188 e SAMU 192. Fazer contato hoje.");
  for (const a of s?.avisos ?? []) attention.push(a.texto);
  if (s?.nao_respondido.length) attention.push(`Não respondeu na entrevista: ${s.nao_respondido.join(", ")}.`);
  if (interview.state === "interrompida" && !abandoned(input)) attention.push("A pessoa parou a entrevista antes do fim.");
  if (input.run.partial && input.run.status !== "crisis") attention.push("Questionário incompleto: parte das perguntas ficou sem resposta.");

  const forConsult = [...(input.summary?.pontos_para_avaliar ?? []).map((p) => p.texto), ...(s?.pontos_para_avaliacao ?? []).map((p) => p.texto)]
    .filter((t, i, all) => t.trim() !== "" && all.indexOf(t) === i)
    .slice(0, 6);

  return { interview, howItWent, attention: [...new Set(attention)], forConsult };
}

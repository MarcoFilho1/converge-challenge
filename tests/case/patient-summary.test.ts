import { describe, expect, it } from "vitest";
import { patientSummary, type PatientSummaryInput } from "@/lib/case/patient-summary";
import type { InterviewListItem } from "@/lib/interview/contract";

const o = (turnIdx: number) => [{ turnIdx, label: `turno ${turnIdx}` }];

const base: PatientSummaryInput = {
  run: { severity: "priority", status: "done", wellbeingIndex: 18, partial: false },
  interviews: [],
  interviewDetail: null,
  summary: null,
  threshold: 70,
};

const interviewSummary = {
  dificuldades_relatadas: [{ texto: "Cansaço grande no fim do dia", duracao: "há 3 meses", origem: o(2) }],
  impacto_no_trabalho: [{ texto: "Erra mais nos chamados", origem: o(4) }],
  fatores_do_trabalho: [{ texto: "Metas dobraram sem reforço na equipe", origem: o(6) }],
  barreiras_atendimento: [{ texto: "Medo de a empresa saber", origem: o(8) }],
  sinais_de_alerta: { risco: false, origem: [] },
  pontos_para_avaliacao: [{ texto: "Avaliar sono e carga de trabalho", origem: o(6) }],
  nao_respondido: ["tratamento atual"],
  avisos: [{ texto: "Pergunta de segurança sem resposta clara", origem: o(10) }],
  duracao_min: 9,
  turnos: 12,
};

const item = (status: InterviewListItem["status"], extra: Partial<InterviewListItem> = {}): InterviewListItem => ({ id: "00000000-0000-4000-8000-000000000001", status, startedAt: null, durationMs: null, hasSummary: false, inviteUrl: "x", ...extra });

describe("resumo da pessoa no caso", () => {
  it("sem indício e índice alto: entrevista não foi necessária, com o motivo", () => {
    const s = patientSummary({ ...base, run: { severity: "none", status: "done", wellbeingIndex: 95, partial: false } });
    expect(s.interview.state).toBe("nao_necessaria");
    expect(s.interview.headline).toMatch(/não foi necessária/i);
    expect(s.interview.detail).toMatch(/95/);
    expect(s.interview.detail).toMatch(/70/);
  });

  it("urgência: entrevista não indicada, precisa de contato humano, e isso pede atenção", () => {
    const s = patientSummary({ ...base, run: { severity: "urgency", status: "crisis", wellbeingIndex: null, partial: true } });
    expect(s.interview.state).toBe("nao_indicada");
    expect(s.interview.headline).toMatch(/contato humano/i);
    expect(s.attention.join(" ")).toMatch(/CVV/);
  });

  it("indicada mas sem convite: avisa que o convite não foi enviado", () => {
    const s = patientSummary(base);
    expect(s.interview.state).toBe("sem_convite");
  });

  it("convidada e ainda não começou", () => {
    const s = patientSummary({ ...base, interviews: [item("consent")] });
    expect(s.interview.state).toBe("convidada");
    expect(s.interview.headline).toMatch(/convidad/i);
  });

  it("parou no meio: aparece como interrompida e pede atenção", () => {
    const s = patientSummary({ ...base, interviews: [item("stopped", { durationMs: 180000 })] });
    expect(s.interview.state).toBe("interrompida");
    expect(s.attention.join(" ")).toMatch(/parou a entrevista/i);
  });

  it("conversa caiu (página fechada): diz isso, sem culpar a pessoa, e não repete o aviso", () => {
    const aviso = "A conversa terminou sem despedida (página fechada ou conexão perdida) depois de 3 min. O resumo usa só o que foi dito até ali.";
    const s = patientSummary({
      ...base,
      interviews: [item("stopped", { hasSummary: true, durationMs: 180000 })],
      interviewDetail: { summary: { ...interviewSummary, avisos: [{ texto: aviso, origem: [] }] } } as PatientSummaryInput["interviewDetail"],
    });
    expect(s.interview.state).toBe("interrompida");
    expect(s.interview.headline).toMatch(/conversa caiu/i);
    expect(s.interview.headline).toMatch(/3 min/);
    expect(s.attention.join(" ")).not.toMatch(/parou a entrevista/i);
    expect(s.attention.filter((a) => a.includes("sem despedida"))).toHaveLength(1);
  });

  it("concluída: diz duração e como foi, junta avisos e pontos para a consulta", () => {
    const s = patientSummary({
      ...base,
      interviews: [item("done", { hasSummary: true, durationMs: 540000 })],
      interviewDetail: { summary: interviewSummary } as PatientSummaryInput["interviewDetail"],
      summary: {
        dificuldades_relatadas: [],
        impacto_funcional: { texto: "", origem: [] },
        fatores_do_trabalho: [],
        pontos_para_avaliar: [{ texto: "Presenteísmo com prejuízo 7/10", origem: ["WPAI_Q5"] }],
        nao_respondido: [],
      },
    });
    expect(s.interview.state).toBe("concluida");
    expect(s.interview.headline).toMatch(/9 min/);
    expect(s.howItWent).toEqual([
      "Cansaço grande no fim do dia (há 3 meses)",
      "Erra mais nos chamados",
      "Metas dobraram sem reforço na equipe",
      "Medo de a empresa saber",
    ]);
    expect(s.attention).toContain("Pergunta de segurança sem resposta clara");
    expect(s.attention.join(" ")).toMatch(/tratamento atual/);
    expect(s.forConsult).toEqual(["Presenteísmo com prejuízo 7/10", "Avaliar sono e carga de trabalho"]);
  });

  it("frase de risco durante a entrevista: estado próprio e atenção no topo", () => {
    const s = patientSummary({
      ...base,
      interviews: [item("crisis", { hasSummary: true })],
      interviewDetail: { summary: { ...interviewSummary, sinais_de_alerta: { risco: true, origem: o(5) } } } as PatientSummaryInput["interviewDetail"],
    });
    expect(s.interview.state).toBe("crise_na_entrevista");
    expect(s.attention[0]).toMatch(/risco/i);
  });

  it("questionário incompleto entra nos pontos de atenção", () => {
    const s = patientSummary({ ...base, run: { ...base.run, partial: true }, interviews: [item("consent")] });
    expect(s.attention.join(" ")).toMatch(/incompleto/i);
  });

  it("entrevista feita só por ser demonstração: diz que em uso real não seria necessária", () => {
    const s = patientSummary({ ...base, run: { severity: "none", status: "done", wellbeingIndex: 95, partial: false }, interviews: [item("consent")] });
    expect(s.interview.state).toBe("convidada");
    expect(s.interview.detail).toMatch(/demonstração/i);
    expect(s.interview.detail).toMatch(/95/);
    expect(s.interview.detail).toMatch(/70/);
  });

  it("entrevista necessária não leva a nota de demonstração", () => {
    const s = patientSummary({ ...base, interviews: [item("consent")] });
    expect(s.interview.detail ?? "").not.toMatch(/demonstração/i);
  });
});

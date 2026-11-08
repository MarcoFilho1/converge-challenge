import type { CaseState, RunStatus, Severity } from "@/db/schema";
import type { RunSummary } from "@/lib/ai/types";
import type { InterviewDetail, InterviewListItem, InterviewView } from "@/lib/interview/contract";

export interface QueueScoreChip {
  instrument: string;
  dimension: string;
  label: string;
  value: number;
  maxLabel: string;
  cutoff: number;
  flagged: boolean;
  complete: boolean;
}

export interface QueueRow {
  runId: string;
  contactId: string;
  contactName: string;
  phoneE164: string;
  sector: string;
  role: string;
  severity: Severity;
  clinicalOnly: boolean;
  partial: boolean;
  status: RunStatus;
  caseState: CaseState;
  startedAt: string;
  finishedAt: string | null;
  ruleTrace: {
    hasPresenteeismTrunk: boolean;
    hasWorkImpairment: boolean;
    hasClinicalSignal: boolean;
    hasCrisis: boolean;
  };
  scores: QueueScoreChip[];
  hasVoiceInterview: boolean;
  voiceInterviewToken?: string;
}

export interface CaseMessageItem {
  id: string;
  direction: "in" | "out";
  text: string;
  createdAt: string;
}

export interface CaseEvidenceItem {
  id: string;
  itemCode: string;
  theme: string;
  explanation: string;
  source: "rule" | "rag";
  chunk: {
    id: string;
    documentTitle: string;
    page: number | null;
    text: string;
  };
}

export interface CaseDetailData {
  run: QueueRow;
  messages: CaseMessageItem[];
  evidence: CaseEvidenceItem[];
  summary: RunSummary | null;
  interviews: InterviewListItem[];
  interviewDetail: InterviewDetail | null;
}

export const SYNTHETIC_QUEUE_ROWS: QueueRow[] = [
  {
    runId: "11111111-1111-4111-8111-111111111101",
    contactId: "c1111111-1111-4111-8111-111111111101",
    contactName: "Lucas Mendonça",
    phoneE164: "5581990000001",
    sector: "Atendimento",
    role: "Analista de Suporte N2",
    severity: "urgency",
    clinicalOnly: false,
    partial: true,
    status: "crisis",
    caseState: "aberto",
    startedAt: "2026-11-07T18:10:00-03:00",
    finishedAt: "2026-11-07T18:16:00-03:00",
    ruleTrace: {
      hasPresenteeismTrunk: true,
      hasWorkImpairment: true,
      hasClinicalSignal: true,
      hasCrisis: true,
    },
    scores: [
      { instrument: "WPAI", dimension: "work_impairment", label: "WPAI", value: 8, maxLabel: "/10", cutoff: 3, flagged: true, complete: true },
      { instrument: "BAT12", dimension: "total", label: "BAT-12", value: 3.67, maxLabel: "/5", cutoff: 2.54, flagged: true, complete: true },
      { instrument: "PHQ9", dimension: "total", label: "PHQ-9", value: 16, maxLabel: "/27", cutoff: 10, flagged: true, complete: true },
      { instrument: "PHQ9", dimension: "item9", label: "PHQ #9", value: 2, maxLabel: "/3", cutoff: 1, flagged: true, complete: true },
    ],
    hasVoiceInterview: false,
  },
  {
    runId: "11111111-1111-4111-8111-111111111102",
    contactId: "c1111111-1111-4111-8111-111111111102",
    contactName: "Mariana Cavalcanti",
    phoneE164: "5581990000002",
    sector: "Atendimento",
    role: "Analista de Relacionamento",
    severity: "priority",
    clinicalOnly: false,
    partial: false,
    status: "done",
    caseState: "aberto",
    startedAt: "2026-11-07T18:22:00-03:00",
    finishedAt: "2026-11-07T18:29:00-03:00",
    ruleTrace: {
      hasPresenteeismTrunk: true,
      hasWorkImpairment: true,
      hasClinicalSignal: true,
      hasCrisis: false,
    },
    scores: [
      { instrument: "WPAI", dimension: "work_impairment", label: "WPAI", value: 7, maxLabel: "/10", cutoff: 3, flagged: true, complete: true },
      { instrument: "BAT12", dimension: "total", label: "BAT-12", value: 3.42, maxLabel: "/5", cutoff: 2.54, flagged: true, complete: true },
      { instrument: "PHQ9", dimension: "total", label: "PHQ-9", value: 13, maxLabel: "/27", cutoff: 10, flagged: true, complete: true },
      { instrument: "GAD7", dimension: "total", label: "GAD-7", value: 11, maxLabel: "/21", cutoff: 10, flagged: true, complete: true },
    ],
    hasVoiceInterview: true,
    voiceInterviewToken: "demo-mariana-nr7",
  },
  {
    runId: "11111111-1111-4111-8111-111111111103",
    contactId: "c1111111-1111-4111-8111-111111111103",
    contactName: "Rafael Albuquerque",
    phoneE164: "5581990000003",
    sector: "Administrativo",
    role: "Analista Financeiro",
    severity: "priority",
    clinicalOnly: false,
    partial: false,
    status: "done",
    caseState: "encaminhado",
    startedAt: "2026-11-07T17:40:00-03:00",
    finishedAt: "2026-11-07T17:48:00-03:00",
    ruleTrace: {
      hasPresenteeismTrunk: true,
      hasWorkImpairment: true,
      hasClinicalSignal: true,
      hasCrisis: false,
    },
    scores: [
      { instrument: "WPAI", dimension: "work_impairment", label: "WPAI", value: 6, maxLabel: "/10", cutoff: 3, flagged: true, complete: true },
      { instrument: "BAT12", dimension: "total", label: "BAT-12", value: 3.08, maxLabel: "/5", cutoff: 2.54, flagged: true, complete: true },
      { instrument: "PHQ9", dimension: "total", label: "PHQ-9", value: 11, maxLabel: "/27", cutoff: 10, flagged: true, complete: true },
      { instrument: "GAD7", dimension: "total", label: "GAD-7", value: 8, maxLabel: "/21", cutoff: 10, flagged: false, complete: true },
    ],
    hasVoiceInterview: true,
    voiceInterviewToken: "demo-rafael-nr7",
  },
  {
    runId: "11111111-1111-4111-8111-111111111104",
    contactId: "c1111111-1111-4111-8111-111111111104",
    contactName: "Beatriz Nogueira",
    phoneE164: "5581990000004",
    sector: "Operações",
    role: "Supervisora de Turno",
    severity: "attention",
    clinicalOnly: true,
    partial: false,
    status: "done",
    caseState: "aberto",
    startedAt: "2026-11-07T17:05:00-03:00",
    finishedAt: "2026-11-07T17:12:00-03:00",
    ruleTrace: {
      hasPresenteeismTrunk: false,
      hasWorkImpairment: false,
      hasClinicalSignal: true,
      hasCrisis: false,
    },
    scores: [
      { instrument: "WPAI", dimension: "work_impairment", label: "WPAI", value: 1, maxLabel: "/10", cutoff: 3, flagged: false, complete: true },
      { instrument: "BAT12", dimension: "total", label: "BAT-12", value: 2.75, maxLabel: "/5", cutoff: 2.54, flagged: true, complete: true },
      { instrument: "PHQ9", dimension: "total", label: "PHQ-9", value: 12, maxLabel: "/27", cutoff: 10, flagged: true, complete: true },
      { instrument: "GAD7", dimension: "total", label: "GAD-7", value: 7, maxLabel: "/21", cutoff: 10, flagged: false, complete: true },
    ],
    hasVoiceInterview: false,
  },
  {
    runId: "11111111-1111-4111-8111-111111111105",
    contactId: "c1111111-1111-4111-8111-111111111105",
    contactName: "Diego Tavares",
    phoneE164: "5581990000005",
    sector: "Operações",
    role: "Técnico de Logística",
    severity: "attention",
    clinicalOnly: false,
    partial: false,
    status: "done",
    caseState: "acompanhando",
    startedAt: "2026-11-07T16:30:00-03:00",
    finishedAt: "2026-11-07T16:37:00-03:00",
    ruleTrace: {
      hasPresenteeismTrunk: true,
      hasWorkImpairment: true,
      hasClinicalSignal: false,
      hasCrisis: false,
    },
    scores: [
      { instrument: "WPAI", dimension: "work_impairment", label: "WPAI", value: 5, maxLabel: "/10", cutoff: 3, flagged: true, complete: true },
      { instrument: "BAT12", dimension: "total", label: "BAT-12", value: 2.25, maxLabel: "/5", cutoff: 2.54, flagged: false, complete: true },
      { instrument: "PHQ9", dimension: "total", label: "PHQ-9", value: 6, maxLabel: "/27", cutoff: 10, flagged: false, complete: true },
      { instrument: "GAD7", dimension: "total", label: "GAD-7", value: 5, maxLabel: "/21", cutoff: 10, flagged: false, complete: true },
    ],
    hasVoiceInterview: false,
  },
  {
    runId: "11111111-1111-4111-8111-111111111106",
    contactId: "c1111111-1111-4111-8111-111111111106",
    contactName: "Camila Rocha",
    phoneE164: "5581990000006",
    sector: "Atendimento",
    role: "Operadora de Triagem",
    severity: "attention",
    clinicalOnly: false,
    partial: true,
    status: "stopped",
    caseState: "aberto",
    startedAt: "2026-11-07T16:00:00-03:00",
    finishedAt: "2026-11-07T16:04:00-03:00",
    ruleTrace: {
      hasPresenteeismTrunk: true,
      hasWorkImpairment: true,
      hasClinicalSignal: false,
      hasCrisis: false,
    },
    scores: [
      { instrument: "WPAI", dimension: "work_impairment", label: "WPAI", value: 4, maxLabel: "/10", cutoff: 3, flagged: true, complete: true },
      { instrument: "BAT12", dimension: "total", label: "BAT-12", value: 2.1, maxLabel: "/5", cutoff: 2.54, flagged: false, complete: false },
    ],
    hasVoiceInterview: false,
  },
  {
    runId: "11111111-1111-4111-8111-111111111107",
    contactId: "c1111111-1111-4111-8111-111111111107",
    contactName: "Fernanda Peixoto",
    phoneE164: "5581990000007",
    sector: "Administrativo",
    role: "Assistente Contábil",
    severity: "none",
    clinicalOnly: false,
    partial: false,
    status: "done",
    caseState: "encerrado",
    startedAt: "2026-11-07T15:20:00-03:00",
    finishedAt: "2026-11-07T15:26:00-03:00",
    ruleTrace: {
      hasPresenteeismTrunk: false,
      hasWorkImpairment: false,
      hasClinicalSignal: false,
      hasCrisis: false,
    },
    scores: [
      { instrument: "WPAI", dimension: "work_impairment", label: "WPAI", value: 0, maxLabel: "/10", cutoff: 3, flagged: false, complete: true },
      { instrument: "BAT12", dimension: "total", label: "BAT-12", value: 1.58, maxLabel: "/5", cutoff: 2.54, flagged: false, complete: true },
      { instrument: "PHQ9", dimension: "total", label: "PHQ-9", value: 3, maxLabel: "/27", cutoff: 10, flagged: false, complete: true },
      { instrument: "GAD7", dimension: "total", label: "GAD-7", value: 2, maxLabel: "/21", cutoff: 10, flagged: false, complete: true },
    ],
    hasVoiceInterview: false,
  },
  {
    runId: "11111111-1111-4111-8111-111111111108",
    contactId: "c1111111-1111-4111-8111-111111111108",
    contactName: "Gustavo Barros",
    phoneE164: "5581990000008",
    sector: "Operações",
    role: "Conferente",
    severity: "none",
    clinicalOnly: false,
    partial: false,
    status: "done",
    caseState: "encerrado",
    startedAt: "2026-11-07T14:50:00-03:00",
    finishedAt: "2026-11-07T14:56:00-03:00",
    ruleTrace: {
      hasPresenteeismTrunk: false,
      hasWorkImpairment: false,
      hasClinicalSignal: false,
      hasCrisis: false,
    },
    scores: [
      { instrument: "WPAI", dimension: "work_impairment", label: "WPAI", value: 1, maxLabel: "/10", cutoff: 3, flagged: false, complete: true },
      { instrument: "BAT12", dimension: "total", label: "BAT-12", value: 1.75, maxLabel: "/5", cutoff: 2.54, flagged: false, complete: true },
      { instrument: "PHQ9", dimension: "total", label: "PHQ-9", value: 4, maxLabel: "/27", cutoff: 10, flagged: false, complete: true },
      { instrument: "GAD7", dimension: "total", label: "GAD-7", value: 3, maxLabel: "/21", cutoff: 10, flagged: false, complete: true },
    ],
    hasVoiceInterview: false,
  },
  {
    runId: "11111111-1111-4111-8111-111111111109",
    contactId: "c1111111-1111-4111-8111-111111111109",
    contactName: "Helena Monteiro",
    phoneE164: "5581990000009",
    sector: "Administrativo",
    role: "Analista de Compras",
    severity: "none",
    clinicalOnly: false,
    partial: false,
    status: "done",
    caseState: "aberto",
    startedAt: "2026-11-07T14:15:00-03:00",
    finishedAt: "2026-11-07T14:21:00-03:00",
    ruleTrace: {
      hasPresenteeismTrunk: false,
      hasWorkImpairment: false,
      hasClinicalSignal: false,
      hasCrisis: false,
    },
    scores: [
      { instrument: "WPAI", dimension: "work_impairment", label: "WPAI", value: 0, maxLabel: "/10", cutoff: 3, flagged: false, complete: true },
      { instrument: "BAT12", dimension: "total", label: "BAT-12", value: 1.42, maxLabel: "/5", cutoff: 2.54, flagged: false, complete: true },
      { instrument: "PHQ9", dimension: "total", label: "PHQ-9", value: 2, maxLabel: "/27", cutoff: 10, flagged: false, complete: true },
      { instrument: "GAD7", dimension: "total", label: "GAD-7", value: 2, maxLabel: "/21", cutoff: 10, flagged: false, complete: true },
    ],
    hasVoiceInterview: false,
  },
  {
    runId: "11111111-1111-4111-8111-111111111110",
    contactId: "c1111111-1111-4111-8111-111111111110",
    contactName: "Igor Santana",
    phoneE164: "5581990000010",
    sector: "Operações",
    role: "Auxiliar de Expedição",
    severity: "none",
    clinicalOnly: false,
    partial: false,
    status: "done",
    caseState: "aberto",
    startedAt: "2026-11-07T13:50:00-03:00",
    finishedAt: "2026-11-07T13:56:00-03:00",
    ruleTrace: {
      hasPresenteeismTrunk: false,
      hasWorkImpairment: false,
      hasClinicalSignal: false,
      hasCrisis: false,
    },
    scores: [
      { instrument: "WPAI", dimension: "work_impairment", label: "WPAI", value: 0, maxLabel: "/10", cutoff: 3, flagged: false, complete: true },
      { instrument: "BAT12", dimension: "total", label: "BAT-12", value: 1.5, maxLabel: "/5", cutoff: 2.54, flagged: false, complete: true },
      { instrument: "PHQ9", dimension: "total", label: "PHQ-9", value: 1, maxLabel: "/27", cutoff: 10, flagged: false, complete: true },
      { instrument: "GAD7", dimension: "total", label: "GAD-7", value: 1, maxLabel: "/21", cutoff: 10, flagged: false, complete: true },
    ],
    hasVoiceInterview: false,
  },
  {
    runId: "11111111-1111-4111-8111-111111111111",
    contactId: "c1111111-1111-4111-8111-111111111111",
    contactName: "Juliana Azevedo",
    phoneE164: "5581990000011",
    sector: "Atendimento",
    role: "Analista de Ouvidoria",
    severity: "none",
    clinicalOnly: false,
    partial: true,
    status: "in_progress",
    caseState: "aberto",
    startedAt: "2026-11-07T19:50:00-03:00",
    finishedAt: null,
    ruleTrace: {
      hasPresenteeismTrunk: true,
      hasWorkImpairment: false,
      hasClinicalSignal: false,
      hasCrisis: false,
    },
    scores: [],
    hasVoiceInterview: false,
  },
];

export const SYNTHETIC_INTERVIEW_DETAIL: InterviewDetail = {
  id: "99999999-2222-4222-8222-222222222202",
  runId: "11111111-1111-4111-8111-111111111102",
  contact: {
    name: "Mariana Cavalcanti",
    sector: "Atendimento",
  },
  severity: "priority",
  status: "done",
  mode: "live",
  startedAt: "2026-11-07T18:35:00.000Z",
  endedAt: "2026-11-07T18:43:20.000Z",
  durationMs: 500000,
  blocks: [
    { id: "abertura", label: "Começando", required: true },
    { id: "saude", label: "Sobre o que você sente", required: true },
    { id: "trabalho", label: "Sobre o trabalho", required: true },
    { id: "barreiras", label: "Sobre buscar ajuda", required: true },
    { id: "seguranca", label: "Uma pergunta importante", required: true },
    { id: "fechamento", label: "Encerrando", required: true },
  ],
  turns: [
    {
      idx: 0,
      speaker: "ai",
      text: "Oi, eu sou a Helena. Eu trabalho com a Dra. Ana Lima. Essa conversa leva uns dez minutos, e só ela vai ouvir o que você disser. Você pode pular qualquer pergunta ou parar quando quiser. O que você tem sentido nas últimas semanas?",
      blockId: "saude",
      startedMs: 0,
      durationMs: 11200,
      audioUrl: null,
    },
    {
      idx: 1,
      speaker: "person",
      text: "Tenho sentido um cansaço mental muito forte logo no meio da tarde, e nas últimas semanas comecei a acordar de madrugada pensando nas pendências da fila.",
      blockId: "saude",
      startedMs: 14000,
      durationMs: 12400,
      audioUrl: "/api/medico/entrevista/99999999-2222-4222-8222-222222222202/audio/1",
    },
    {
      idx: 2,
      speaker: "ai",
      text: "Entendi, você relatou cansaço à tarde e despertar de madrugada. Desde quando é assim?",
      blockId: "saude",
      startedMs: 29000,
      durationMs: 6800,
      audioUrl: null,
    },
    {
      idx: 3,
      speaker: "person",
      text: "Faz cerca de dois meses e meio, desde que duas pessoas saíram do turno da tarde e a fila de chamados críticos dobrou.",
      blockId: "saude",
      startedMs: 38000,
      durationMs: 9800,
      audioUrl: "/api/medico/entrevista/99999999-2222-4222-8222-222222222202/audio/3",
    },
    {
      idx: 4,
      speaker: "ai",
      text: "Obrigada por contar. E no trabalho, o que está mais difícil agora? Você consegue parar e descansar durante o dia?",
      blockId: "trabalho",
      startedMs: 51000,
      durationMs: 8100,
      audioUrl: null,
    },
    {
      idx: 5,
      speaker: "person",
      text: "O tempo médio de atendimento fica piscando na tela e quase não consigo tirar os 15 minutos de pausa porque sempre tem cliente esperando na linha.",
      blockId: "trabalho",
      startedMs: 61000,
      durationMs: 11500,
      audioUrl: "/api/medico/entrevista/99999999-2222-4222-8222-222222222202/audio/5",
    },
    {
      idx: 6,
      speaker: "ai",
      text: "Você comentou sobre a dificuldade de fazer as pausas. O que impediu você de buscar ajuda até agora?",
      blockId: "barreiras",
      startedMs: 75000,
      durationMs: 7200,
      audioUrl: null,
    },
    {
      idx: 7,
      speaker: "person",
      text: "Principalmente falta de horário fora do expediente e receio de pedir saída e parecer que não estou dando conta da meta.",
      blockId: "barreiras",
      startedMs: 84000,
      durationMs: 9400,
      audioUrl: "/api/medico/entrevista/99999999-2222-4222-8222-222222222202/audio/7",
    },
    {
      idx: 8,
      speaker: "ai",
      text: "Nessas semanas, você teve pensamentos de se machucar, ou de que não vale a pena continuar?",
      blockId: "seguranca",
      startedMs: 96000,
      durationMs: 6500,
      audioUrl: null,
    },
    {
      idx: 9,
      speaker: "person",
      text: "Não, isso não. Só quero conseguir descansar a cabeça e voltar a dormir direito.",
      blockId: "seguranca",
      startedMs: 104000,
      durationMs: 6200,
      audioUrl: "/api/medico/entrevista/99999999-2222-4222-8222-222222222202/audio/9",
    },
  ],
  summary: {
    dificuldades_relatadas: [
      {
        texto: "Relatou cansaço mental acentuado no meio da tarde e despertar noturno pensando na fila de chamados.",
        duracao: "cerca de 2 meses e meio",
        origem: [
          { turnIdx: 1, label: "turno 1 · 00:14" },
          { turnIdx: 3, label: "turno 3 · 00:38" },
        ],
      },
    ],
    impacto_no_trabalho: [
      {
        texto: "Relatou dificuldade para manter concentração contínua e supressão das pausas de 15 minutos devido à fila.",
        origem: [{ turnIdx: 5, label: "turno 5 · 01:01" }],
      },
    ],
    fatores_do_trabalho: [
      {
        texto: "Saída de duas pessoas do turno da tarde com duplicação dos chamados críticos e pressão de tempo médio na tela.",
        origem: [
          { turnIdx: 3, label: "turno 3 · 00:38" },
          { turnIdx: 5, label: "turno 5 · 01:01" },
        ],
      },
    ],
    barreiras_atendimento: [
      {
        texto: "Falta de horário fora do expediente e receio de solicitar liberação durante a meta do setor.",
        origem: [{ turnIdx: 7, label: "turno 7 · 01:24" }],
      },
    ],
    sinais_de_alerta: {
      risco: false,
      origem: [{ turnIdx: 9, label: "turno 9 · 01:44" }],
    },
    pontos_para_avaliacao: [
      {
        texto: "Avaliar padrão de sono (despertar precoce há 10 semanas) e impacto da supressão de pausas intrajornada.",
        origem: [
          { turnIdx: 1, label: "turno 1 · 00:14" },
          { turnIdx: 5, label: "turno 5 · 01:01" },
        ],
      },
    ],
    nao_respondido: ["Histórico de acompanhamento clínico prévio"],
    duracao_min: 8.3,
    turnos: 10,
  },
};

export function getSyntheticCaseDetail(runId: string): CaseDetailData {
  const row = SYNTHETIC_QUEUE_ROWS.find((r) => r.runId === runId) ?? SYNTHETIC_QUEUE_ROWS[1]!;

  if (row.severity === "urgency") {
    return {
      run: row,
      messages: [
        {
          id: "m-1",
          direction: "out",
          text: "Olá, Lucas. Aqui é o canal do Consultório NR-7 (Dra. Ana Lima). Suas respostas são confidenciais e vistas apenas pela médica do trabalho. Responda 1 (Sim, aceito) para iniciar ou PARAR a qualquer momento.",
          createdAt: "18:10",
        },
        {
          id: "m-2",
          direction: "in",
          text: "1",
          createdAt: "18:11",
        },
        {
          id: "m-3",
          direction: "out",
          text: "Pergunta 1 de 8 · Nos últimos 30 dias, você trabalhou mesmo sentindo algum problema físico ou emocional? (1 Sim · 0 Não)",
          createdAt: "18:11",
        },
        {
          id: "m-4",
          direction: "in",
          text: "1, trabalhei todos os dias assim",
          createdAt: "18:12",
        },
        {
          id: "m-5",
          direction: "out",
          text: "Pergunta 6 de 8 · Nas últimas 2 semanas, com que frequência você teve pensamentos de se machucar ou de que seria melhor não acordar? (0 Nenhuma vez · 1 Vários dias · 2 Mais da metade dos dias · 3 Quase todos os dias)",
          createdAt: "18:15",
        },
        {
          id: "m-6",
          direction: "in",
          text: "2, às vezes penso que não aguento mais viver nessa pressão",
          createdAt: "18:16",
        },
        {
          id: "m-7",
          direction: "out",
          text: "Lucas, obrigado por falar sobre isso. Vamos pausar o questionário agora para priorizar seu cuidado. Se precisar conversar imediatamente, ligue 188 (CVV, gratuito 24h) ou 192 (SAMU). A Dra. Ana Lima já foi acionada com prioridade imediata.",
          createdAt: "18:16",
        },
      ],
      evidence: [
        {
          id: "ev-u1",
          itemCode: "PHQ9_9",
          theme: "Corte de segurança · Protocolo imediato",
          explanation:
            "Resposta positiva ao item 9 do PHQ-9 (escore 2) combinada à expressão de risco na mensagem aciona interrupção determinística e notificação imediata ao médico do trabalho.",
          source: "rule",
          chunk: {
            id: "chk-phq9-9",
            documentTitle: "PHQ-9 · Validação Brasileira (Santos et al., 2013) & Protocolo CVV",
            page: 2,
            text: "Qualquer pontuação acima de zero no item 9 do PHQ-9 ou menção direta a autolesão requer avaliação clínica presencial imediata pelo profissional responsável e oferta imediata dos canais de apoio à vida (CVV 188 / SAMU 192).",
          },
        },
        {
          id: "ev-u2",
          itemCode: "BAT12_1",
          theme: "Exaustão ocupacional acentuada",
          explanation:
            "Pontuação média de 3,67 no BAT-12 supera o ponto de corte estatístico brasileiro (2,54 para atenção e 2,96 para sinal acentuado).",
          source: "rag",
          chunk: {
            id: "chk-bat12",
            documentTitle: "Manual BAT-12 Brasil · Burnout Assessment Tool (Schaufeli & Vazquez)",
            page: 14,
            text: "Escores médios iguais ou superiores a 2,96 na dimensão de exaustão indicam fadiga severa relacionada às demandas de trabalho, exigindo revisão imediata de carga e acompanhamento no PCMSO (NR-7).",
          },
        },
      ],
      summary: {
        dificuldades_relatadas: [
          {
            relato: "Relatou trabalhar continuamente com queixa de saúde nos últimos 30 dias e expressou frase de risco durante o item 9.",
            origem: ["TRUNK", "PHQ9_9"],
          },
        ],
        impacto_funcional: {
          texto: "Prejuízo funcional relatado de 8 em 10 nas atividades de trabalho na última semana.",
          origem: ["WPAI_Q5"],
        },
        fatores_do_trabalho: [
          {
            texto: "Relatou pressão intensa na fila de suporte técnico N2.",
            origem: ["PHQ9_9"],
          },
        ],
        pontos_para_avaliar: [
          {
            texto: "Contato médico ativo imediato (protocolo de urgência acionado em código às 18:16).",
            origem: ["PHQ9_9"],
          },
        ],
        nao_respondido: ["COPSOQ II-Br (interrompido pelo corte de crise)", "Perguntas abertas 1 e 2"],
      },
      interviews: [],
      interviewDetail: null,
    };
  }

  return {
    run: row,
    messages: [
      {
        id: "m-101",
        direction: "out",
        text: `Olá, ${row.contactName.split(" ")[0]}. Aqui é o canal do Consultório NR-7 (Dra. Ana Lima). Leva cerca de 6 minutos e apenas a médica do trabalho tem acesso individual. Responda 1 (Sim, aceito) para começar.`,
        createdAt: "18:22",
      },
      {
        id: "m-102",
        direction: "in",
        text: "1",
        createdAt: "18:22",
      },
      {
        id: "m-103",
        direction: "out",
        text: "Parte 1 de 5 · Presenteísmo. Nos últimos 30 dias, você trabalhou mesmo sentindo algum problema de saúde físico ou emocional? (1 Sim · 0 Não)",
        createdAt: "18:23",
      },
      {
        id: "m-104",
        direction: "in",
        text: "1",
        createdAt: "18:23",
      },
      {
        id: "m-105",
        direction: "out",
        text: "Nos últimos 7 dias, quanto esse problema afetou sua produtividade enquanto estava trabalhando? Escolha um número de 0 (não afetou) a 10 (impediu totalmente).",
        createdAt: "18:24",
      },
      {
        id: "m-106",
        direction: "in",
        text: "7",
        createdAt: "18:24",
      },
      {
        id: "m-107",
        direction: "out",
        text: "Parte 3 de 5 · Energia no trabalho (BAT-12). No trabalho, sinto-me mentalmente exausto(a). (1 Nunca · 2 Raramente · 3 Às vezes · 4 Frequentemente · 5 Sempre)",
        createdAt: "18:25",
      },
      {
        id: "m-108",
        direction: "in",
        text: "4",
        createdAt: "18:26",
      },
      {
        id: "m-109",
        direction: "out",
        text: "Pergunta aberta · O que no trabalho está mais difícil para você agora?",
        createdAt: "18:28",
      },
      {
        id: "m-110",
        direction: "in",
        text: "O fechamento do mês acumulou com duas vagas abertas no turno da tarde e quase não conseguimos fazer pausa.",
        createdAt: "18:29",
      },
    ],
    evidence: [
      {
        id: "ev-1",
        itemCode: "WPAI_Q5",
        theme: "Presenteísmo com redução funcional (WPAI-GH)",
        explanation:
          "Relatou nota 7/10 de impacto nas entregas durante a jornada nos últimos 7 dias (ponto de corte operacional ≥ 3/10).",
        source: "rule",
        chunk: {
          id: "chk-wpai-1",
          documentTitle: "WPAI-GH · Adaptação para o Português no Brasil (Ciconelli et al., 2006)",
          page: 4,
          text: "O item Q5 mensura a redução da efetividade no trabalho decorrente de problemas de saúde nos últimos sete dias em escala de 0 a 10; valores iguais ou superiores a 3 indicam perda funcional relevante por presenteísmo.",
        },
      },
      {
        id: "ev-2",
        itemCode: "BAT12_1",
        theme: "Sinal de esgotamento e fadiga cognitiva (BAT-12)",
        explanation:
          "Média global de 3,42 no BAT-12 situa-se acima do limiar de referência brasileiro (2,54) e do percentil elevado (2,96).",
        source: "rag",
        chunk: {
          id: "chk-bat-2",
          documentTitle: "Manual BAT-12 Brasil · Avaliação de Esgotamento Ocupacional",
          page: 11,
          text: "Respostas 'frequentemente' (4) ou 'sempre' (5) nos itens nucleares de exaustão mental e dificuldade de recuperação após o turno sinalizam desgaste ocupacional que requer investigação clínica das condições de trabalho.",
        },
      },
      {
        id: "ev-3",
        itemCode: "OPEN_1",
        theme: "Sobrecarga de ritmo e supressão de pausas (NR-1 / Guia MTE)",
        explanation:
          "Relato livre aponta acúmulo por duas vagas em aberto no turno da tarde e restrição de pausas regulares.",
        source: "rag",
        chunk: {
          id: "chk-nr1-1",
          documentTitle: "Guia MTE · Fatores de Risco Psicossociais Relacionados ao Trabalho (2025) & NR-1",
          page: 19,
          text: "Cap. 1.5 da NR-1: A organização deve identificar exigências de ritmo excessivo, subdimensionamento de equipe e insuficiência de pausas de recuperação, integrando os sinais coletados ao controle médico do PCMSO (NR-7).",
        },
      },
    ],
    summary: {
      dificuldades_relatadas: [
        {
          relato: "Relatou exaustão mental frequente ao final do turno e dificuldade de concentração nas últimas duas semanas.",
          origem: ["BAT12_1", "PHQ9_1"],
        },
      ],
      impacto_funcional: {
        texto: "Trabalhou com queixa de saúde nos últimos 30 dias com prejuízo relatado de 7/10 nas tarefas habituais.",
        origem: ["TRUNK", "WPAI_Q5"],
      },
      fatores_do_trabalho: [
        {
          texto: "Relatou sobrecarga no fechamento mensal associada a duas vagas abertas no turno da tarde e dificuldade para realizar pausas.",
          origem: ["OPEN_1", "COPSOQ_2A"],
        },
      ],
      pontos_para_avaliar: [
        {
          texto: "Investigar duração da fadiga, padrão de sono e viabilidade de recomposição das pausas intrajornada no setor de Atendimento.",
          origem: ["BAT12_1", "OPEN_1"],
        },
      ],
      nao_respondido: [],
    },
    interviews: row.hasVoiceInterview
      ? [
          {
            id: SYNTHETIC_INTERVIEW_DETAIL.id,
            status: "done",
            startedAt: SYNTHETIC_INTERVIEW_DETAIL.startedAt,
            durationMs: SYNTHETIC_INTERVIEW_DETAIL.durationMs,
            hasSummary: true,
            inviteUrl: `/entrevista/${row.voiceInterviewToken ?? "demo-mariana-nr7"}`,
          },
        ]
      : [],
    interviewDetail: row.hasVoiceInterview
      ? {
          ...SYNTHETIC_INTERVIEW_DETAIL,
          runId: row.runId,
          contact: { name: row.contactName, sector: row.sector },
          severity: row.severity,
        }
      : null,
  };
}

export function getSyntheticInterviewView(token: string): InterviewView {
  const isUrgencyDemo = token.includes("crise");
  return {
    id: "99999999-2222-4222-8222-222222222202",
    status: isUrgencyDemo ? "crisis" : "consent",
    interviewer: {
      name: "Helena",
      avatarUrl: "/entrevistadora.svg",
    },
    doctorName: "Dra. Ana Lima",
    estimatedMinutes: 10,
    block: null,
    currentUtterance: null,
    turnsCount: 0,
    elapsedMs: 0,
  };
}

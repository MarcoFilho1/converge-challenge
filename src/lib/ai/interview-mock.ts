import { normalizeText } from "@/lib/crisis/detect";
import { BLOCK_LABELS, type InterviewSummary } from "@/lib/interview/contract";
import { formatOrigin } from "@/lib/interview/origin";
import { SAFETY_UNANSWERED } from "@/lib/interview/engine";
import { ACK_PHRASES } from "@/lib/interview/protocol";
import type { BlockId, Finding, FindingTheme } from "@/lib/interview/types";
import type { InterviewAi } from "./interview";

const DURATION = /\b(ha|faz|desde|tem) (uns |umas |mais de |quase |cerca de )?(\d+|um|uma|dois|duas|tres|alguns|algumas|varios|varias|muito|pouco)?\s?(dia|dias|semana|semanas|mes|meses|ano|anos|tempo|[a-z]+)\b/;
/** Só intenção clara de encerrar; "não consigo parar" ou "quando chega o fechamento" NÃO contam. */
const STOP: RegExp[] = [
  /^(eu )?(quero|prefiro|vamos|pode|podemos|preciso|gostaria de) (parar|encerrar)\b/,
  /\b(quero|prefiro) (parar|encerrar)\b/,
  /\bnao quero (mais )?(falar|continuar)\b/,
  /\bchega por hoje\b/,
  /^(parar|encerrar|chega|para)[.!]?$/,
];
const THEMES: [FindingTheme, RegExp][] = [
  ["chefia", /\b(chefe|chefia|gerente|supervisor|supervisora|coordenador|coordenadora|colegas?)\b/],
  ["carga", /\b(hora extra|horas extras|ate tarde|meta|metas|prazo|prazos|fechamento|sobrecarga|muita coisa|demanda)\b/],
  ["pausa", /\b(pausa|descansar|almoco|intervalo|parar um pouco)\b/],
  ["procurou", /\b(procurei|fui ao|fui na|consultei|psicolog|medico|medica|terapia)\b/],
  ["tratamento", /\b(remedio|medicacao|tratamento|acompanhamento)\b/],
  ["barreira", /\b(nao tenho tempo|caro|dinheiro|nao sei onde|medo|vergonha|empresa saber|achei que passava)\b/],
];
const WORK = /\b(trabalho|servico|empresa|chefe|meta|prazo|turno|escala|fechamento|hora extra|horas extras|equipe|cliente)\b/;
const ACKS = ACK_PHRASES;
const DEFAULT_THEME: Partial<Record<BlockId, FindingTheme>> = { saude: "sintoma", trabalho: "carga", barreiras: "barreira" };

function durationOf(normalized: string, original: string): string | null {
  const m = DURATION.exec(normalized);
  if (!m) return null;
  // devolve o trecho original equivalente (mesma posição, texto normalizado tem o mesmo comprimento)
  return original.slice(m.index, m.index + m[0].length).trim();
}

export function createInterviewMock(): InterviewAi {
  return {
    async extractFindings({ blockId, text }) {
      const original = text.trim();
      const n = normalizeText(original);
      if (!n) return [];
      const themed = THEMES.find(([, re]) => re.test(n))?.[0];
      const tema: FindingTheme = themed ?? DEFAULT_THEME[blockId] ?? "outro";
      return [
        {
          tema,
          texto: original.slice(0, 160),
          duracao: durationOf(n, original),
          intensidade: /\b(muito|demais|forte|insuportavel)\b/.test(n) ? "forte" : null,
          mencionaTrabalho: WORK.test(n),
          pediuParar: STOP.some((re) => re.test(n)),
        },
      ];
    },

    async phraseAck({ lastText, findings }) {
      if (findings.length === 0) return "Certo.";
      // varia como numa conversa; escolha determinística pelo texto para os testes serem estáveis
      const sum = [...lastText].reduce((a, c) => a + c.charCodeAt(0), 0);
      return ACKS[sum % ACKS.length];
    },

    async summarize({ turns, findings, skipped }) {
      const byIdx = new Map(turns.map((t) => [t.idx, t]));
      const origem = (f: Finding) => {
        const t = byIdx.get(f.turnIdx);
        return t ? [{ turnIdx: f.turnIdx, label: formatOrigin(t) }] : [];
      };
      const cited = (f: Finding) => ({ texto: f.texto, origem: origem(f) });
      const is = (...temas: FindingTheme[]) => findings.filter((f) => temas.includes(f.tema));

      const personTurns = turns.filter((t) => t.speaker === "person");
      const last = turns.at(-1);
      const summary: InterviewSummary = {
        dificuldades_relatadas: is("sintoma", "duracao", "frequencia", "gatilho", "alivio").map((f) => ({ ...cited(f), duracao: f.duracao })),
        impacto_no_trabalho: findings.filter((f) => f.blockId === "saude" && f.mencionaTrabalho).map(cited),
        fatores_do_trabalho: is("carga", "pausa", "chefia", "mudanca", "necessidade").map(cited),
        barreiras_atendimento: is("barreira").map(cited),
        sinais_de_alerta: { risco: false, origem: [] },
        pontos_para_avaliacao: is("procurou", "tratamento").map(cited),
        nao_respondido: skipped.map((b) => (b === "seguranca" ? SAFETY_UNANSWERED : BLOCK_LABELS[b])),
        avisos: [],
        duracao_min: last ? Math.round(((last.startedMs + (last.durationMs ?? 0)) / 60000) * 10) / 10 : 0,
        turnos: personTurns.length,
      };
      return summary;
    },
  };
}

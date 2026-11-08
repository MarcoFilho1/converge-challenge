/**
 * Protocolo da entrevista, versão 0. Texto fixo; o LLM nunca altera estas frases.
 * Fonte: fluxo do colaborador (converge-ideias/fluxo-colaborador-agente-nr1-2026-11-07.html, seção 3.1)
 * e docs/ROADMAP.md (MVP2). NÃO assinado por médico do trabalho e psicólogo: não vai a piloto assim.
 */
import { BLOCK_LABELS } from "./contract";
import type { Block, BlockId } from "./types";

export const PROTOCOL_VERSION = "v0-nao-assinado";
export const DEFAULT_PRAZO = "uma semana";
export const REPEAT_PREFIX = "Não consegui ouvir bem. ";

const block = (id: BlockId, base: string, probes: Block["probes"], maxTurns: number, required: boolean): Block => ({
  id, label: BLOCK_LABELS[id], base, probes, maxTurns, required,
});

export const BLOCKS: Record<BlockId, Block> = {
  abertura: block(
    "abertura",
    "Oi, eu sou a Helena. Eu trabalho com {medico}. Essa conversa leva uns dez minutos, e só ela vai ouvir o que você disser. Você pode pular qualquer pergunta ou parar quando quiser. Posso começar?",
    [], 1, true,
  ),
  saude: block(
    "saude",
    "O que você anda sentindo nas últimas semanas?",
    [
      { id: "desdeQuando", text: "Desde quando é assim?", when: "semDuracao", covers: "duracao" },
      { id: "frequencia", text: "Isso acontece todo dia ou em períodos?", when: "semFrequencia", covers: "frequencia" },
      { id: "piora", text: "O que você percebe que piora?", when: "sempre", covers: "gatilho" },
      { id: "alivia", text: "E o que alivia?", when: "sempre", covers: "alivio" },
      { id: "procurou", text: "Você já procurou alguém por isso?", when: "naoProcurou", covers: "procurou" },
      { id: "tratamento", text: "Faz algum acompanhamento ou tratamento hoje?", when: "sempre", covers: "tratamento" },
    ],
    4, false,
  ),
  trabalho: block(
    "trabalho",
    "E no trabalho, o que está mais difícil agora?",
    [
      { id: "quandoMudou", text: "Quando isso começou a mudar?", when: "semDuracao", covers: "mudanca" },
      { id: "carga", text: "Quantas horas a mais você anda fazendo, mais ou menos?", when: "mencionouTrabalho", covers: "carga" },
      { id: "pausa", text: "Você consegue parar e descansar durante o dia?", when: "sempre", covers: "pausa" },
      { id: "chefia", text: "Como está com a chefia e com os colegas?", when: "sempre", covers: "chefia" },
      { id: "oQueFaltaria", text: "O que você precisaria ter para dar conta?", when: "sempre", covers: "necessidade" },
    ],
    4, false,
  ),
  barreiras: block(
    "barreiras",
    "O que impediu você de buscar ajuda até agora?",
    [
      { id: "horarioGarantido", text: "Se tivesse um horário garantido, você iria?", when: "sempre", covers: "barreira" },
      { id: "pertoOuOnline", text: "Prefere algo perto de casa ou online?", when: "sempre", covers: "barreira" },
      { id: "medoEmpresa", text: "Você tem receio de a empresa saber?", when: "sempre", covers: "barreira" },
    ],
    3, false,
  ),
  seguranca: block(
    "seguranca",
    "Nessas semanas, você teve pensamentos de se machucar, ou de que não vale a pena continuar?",
    [], 1, true,
  ),
  fechamento: block(
    "fechamento",
    "Obrigada por conversar comigo. O que você contou vai só para {medico}, e nada vai para a empresa. Ela entra em contato com você em até {prazo}. Se precisar de alguém agora, o CVV atende no 188, de graça, o dia todo.",
    [], 1, true,
  ),
};

export function renderText(text: string, vars: { medico: string; prazo: string }): string {
  return text.replaceAll("{medico}", vars.medico).replaceAll("{prazo}", vars.prazo);
}

/** Versão falada do roteiro de crise (src/lib/crisis/messages.ts é a versão de texto do WhatsApp). */
export function CRISIS_SPEECH(medico: string): string {
  return [
    "Obrigada por me contar isso. O que você sente importa, e você não precisa passar por isso sozinho.",
    "Se puder, fale agora com alguém: o CVV atende no 188, de graça, o dia todo. Se estiver em perigo agora, ligue para o SAMU, 192.",
    `Vou parar a nossa conversa aqui e avisar ${medico} agora, para ela entrar em contato com você.`,
  ].join(" ");
}

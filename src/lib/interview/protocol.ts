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

const REPHRASE: Partial<Record<BlockId, string>> = {
  saude: "Vou perguntar de outro jeito: como anda o seu dia a dia, no corpo ou na cabeça?",
  trabalho: "Pensando no seu trabalho, o que mais pesa para você hoje?",
  barreiras: "Tem alguma coisa que dificulta você procurar atendimento?",
  seguranca: "Vou perguntar de outro jeito, porque é importante: nas últimas semanas, passou pela sua cabeça a ideia de se ferir, ou de que seria melhor não estar aqui? Pode responder só com sim ou não.",
};

const block = (id: BlockId, base: string, probes: Block["probes"], maxTurns: number, required: boolean): Block => ({
  id, label: BLOCK_LABELS[id], base, rephrase: REPHRASE[id], probes, maxTurns, required,
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
      { id: "desdeQuando", text: "Desde quando é assim?", rephrase: "Mais ou menos quando você começou a perceber isso? Faz semanas, meses?", when: "semDuracao", covers: "duracao" },
      { id: "frequencia", text: "Isso acontece todo dia ou em períodos?", rephrase: "Isso aparece quase todo dia, ou só em alguns momentos?", when: "semFrequencia", covers: "frequencia" },
      { id: "piora", text: "O que você percebe que piora?", rephrase: "Tem alguma situação em que isso fica mais forte?", when: "sempre", covers: "gatilho" },
      { id: "alivia", text: "E o que alivia?", rephrase: "E tem alguma coisa que faz isso melhorar um pouco?", when: "sempre", covers: "alivio" },
      { id: "procurou", text: "Você já procurou alguém por isso?", rephrase: "Você chegou a conversar com algum médico ou outro profissional sobre isso?", when: "naoProcurou", covers: "procurou" },
      { id: "tratamento", text: "Faz algum acompanhamento ou tratamento hoje?", rephrase: "Hoje você toma algum remédio ou tem algum acompanhamento?", when: "sempre", covers: "tratamento" },
    ],
    4, false,
  ),
  trabalho: block(
    "trabalho",
    "E no trabalho, o que está mais difícil agora?",
    [
      { id: "quandoMudou", text: "Quando isso começou a mudar?", rephrase: "Teve algum momento em que o trabalho ficou mais pesado? Quando foi?", when: "semDuracao", covers: "mudanca" },
      { id: "carga", text: "Quantas horas a mais você anda fazendo, mais ou menos?", rephrase: "Numa semana normal, você fica quantas horas além do seu horário?", when: "mencionouTrabalho", covers: "carga" },
      { id: "pausa", text: "Você consegue parar e descansar durante o dia?", rephrase: "Durante o expediente, dá para fazer intervalos?", when: "sempre", covers: "pausa" },
      { id: "chefia", text: "Como está com a chefia e com os colegas?", rephrase: "E a relação com a sua chefia e com a equipe, como anda?", when: "sempre", covers: "chefia" },
      { id: "oQueFaltaria", text: "O que você precisaria ter para dar conta?", rephrase: "O que deixaria o seu trabalho mais leve hoje?", when: "sempre", covers: "necessidade" },
    ],
    4, false,
  ),
  barreiras: block(
    "barreiras",
    "O que impediu você de buscar ajuda até agora?",
    [
      { id: "horarioGarantido", text: "Se tivesse um horário garantido, você iria?", rephrase: "Se a empresa liberasse um horário para isso, você iria?", when: "sempre", covers: "barreira" },
      { id: "pertoOuOnline", text: "Prefere algo perto de casa ou online?", rephrase: "Seria melhor um atendimento perto de casa ou pela internet?", when: "sempre", covers: "barreira" },
      { id: "medoEmpresa", text: "Você fica com receio de a empresa saber?", rephrase: "Você se preocupa com a empresa ficar sabendo?", when: "sempre", covers: "barreira" },
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

/** Questionário já em urgência: não entrevista, encaminha direto. */
export function URGENCY_SPEECH(medico: string): string {
  return `Obrigada por responder. Pelo que você contou no questionário, ${medico} vai entrar em contato com você hoje. Se precisar de alguém agora, o CVV atende no 188, de graça, o dia todo. Se estiver em perigo, ligue para o SAMU, 192.`;
}

/** Consentimento negado. */
export const DECLINE_SPEECH = "Tudo bem, obrigada. Nada foi registrado. Se mudar de ideia, é só abrir o link de novo.";

/** Resposta fixa quando a pessoa pergunta "você entendeu?" no fim da fala. */
export const ASKED_ACK = "Entendi sim, não se preocupa.";
/** Prefixo quando a pessoa pede para repetir e a segunda forma já foi usada. */
export const REPEAT_ASK_PREFIX = "Claro. ";

/** Sinais de escuta falados (fixos, guardados em áudio); nenhum avalia nem aconselha. */
export const ACK_PHRASES = ["Hmm, entendi.", "Certo.", "Sei.", "Entendi, obrigada por me contar.", "Hum, faz sentido."];

/** Início do aviso que o médico recebe quando a conversa cai (página fechada ou conexão perdida). */
export const ABANDON_AVISO_PREFIX = "A conversa terminou sem despedida (página fechada ou conexão perdida)";

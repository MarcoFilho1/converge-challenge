import type { Item } from "@/lib/instruments/types";

const doctor = () => process.env.DOCTOR_NAME ?? "o(a) médico(a) do trabalho";
const company = () => process.env.COMPANY_NAME ?? "sua empresa";

/** Opções por extenso, sem número. Pergunta-tronco na ordem do consentimento (sim primeiro). */
export function optionsLine(item: Item): string {
  const s = item.scale;
  if (!s) return "";
  if (!s.labels) return item.scaleLine ?? `de ${s.min} a ${s.max}`;
  const n = s.labels.map((l) => l.toLowerCase());
  if (n.length === 2 && n[0] === "não" && n[1] === "sim") return "sim · não";
  return s.labels.join(" · ");
}

/** Como a resposta foi entendida, para confirmar: rótulo da escala ou "n de 10". */
export function valueLabel(item: Item, value: number): string {
  const s = item.scale!;
  return s.labels ? s.labels[value - s.min] : `${value} de ${s.max}`;
}

/** Explicação fixa quando a pessoa tem dúvida (nunca gerada pela IA). */
const DOUBT_BY_INSTRUMENT: Record<string, string> = {
  PHQ9: "É sobre as últimas 2 semanas: com que frequência isso incomodou você. Pode responder com suas palavras.",
  GAD7: "É sobre as últimas 2 semanas: com que frequência isso incomodou você. Pode responder com suas palavras.",
  BAT12: "É sobre o seu trabalho: com que frequência você se sente assim. Pode responder com suas palavras.",
  COPSOQ: "É sobre como é o seu trabalho no dia a dia. Pode responder com suas palavras.",
  TRUNK: "É sobre o último mês: se você foi trabalhar mesmo com algum problema de saúde.",
  WPAI: "É uma nota de 0 a 10 para o quanto a sua saúde atrapalhou o trabalho nos últimos 7 dias.",
};

/** Mensagens do bot. Base: docs/questionario-whatsapp.md, seção 5. A pessoa responde do jeito dela: texto ou áudio. */
export const copy = {
  consent: (name: string, demoShort: boolean) =>
    [
      `Olá, ${name.split(" ")[0]}! Aqui é o canal de saúde ocupacional de ${doctor()}, responsável pelo PCMSO da ${company()}.`,
      `São perguntas curtas sobre sua saúde e seu trabalho, ${demoShort ? "cerca de 1 minuto" : "de 5 a 8 minutos"}.`,
      "",
      "*Responda do seu jeito:* escrevendo ou mandando áudio.",
      `*Sigilo:* só ${doctor()} vê suas respostas. A empresa não recebe nada individual. É uma triagem, não um laudo.`,
      "*Você decide:* pode parar quando quiser, é só dizer \"parar\".",
      "",
      "Este número não é atendido o tempo todo. Emergência: 192 (SAMU). Para conversar agora: 188 (CVV, 24 h).",
      "Vamos começar?",
    ].join("\n"),
  consentRepeat: "Quer começar? Pode responder sim ou não, do seu jeito.",
  consentDoubt: `São perguntas curtas sobre como sua saúde e seu trabalho estão se afetando. Só ${doctor()} vê suas respostas, sob sigilo médico, e você pode parar quando quiser. Quer começar?`,
  declined: `Tudo bem, obrigado. Se mudar de ideia, é só escrever COMEÇAR.`,
  opening: "Obrigado! Pode responder com suas palavras, por texto ou áudio. Não há resposta certa ou errada.",
  repeat: (item: Item) => `Não consegui entender. Qual dessas combina mais com você?\n${optionsLine(item)}`,
  confirm: (item: Item, value: number) => `Só para confirmar: *${valueLabel(item, value)}*? Pode responder sim ou não.`,
  corrected: "Certo, corrigi.",
  doubt: (item: Item) => item.help ?? DOUBT_BY_INSTRUMENT[item.instrument] ?? "Pode responder com suas palavras.",
  bridge: "Você já comentou um pouco sobre isso. Só para registrar do jeito do questionário:",
  stopped: `Tudo bem, paramos por aqui. O que você já respondeu vai para ${doctor()}. Se quiser retomar, escreva CONTINUAR.\nEm emergência, 192. Para conversar a qualquer hora, 188 (CVV).`,
  resumed: "Obrigado por voltar. Vamos continuar de onde paramos.",
  alreadyRunning: "Você já está no meio do questionário. Esta é a pergunta atual:",
  channelLinked: "Pronto, encontrei seu atendimento. Vamos continuar de onde você parou.",
  closing: () =>
    [
      "Pronto, terminamos. Muito obrigado pelo seu tempo.",
      `Suas respostas foram para ${doctor()}, só para ele(a). Se for o caso, ele(a) vai chamar você para conversar.`,
      "Lembrete: em emergência, 192. Para conversar a qualquer hora, 188 (CVV).",
    ].join("\n"),
  crisisConfirm: "Só para eu ter certeza e cuidar de você: você tem pensado em se machucar ou em não estar mais aqui? Responda SIM ou NÃO.",
  crisisDenied: "Obrigado por responder. Vamos continuar.",
  mediaUnsupported: "Por enquanto eu leio mensagens de texto e ouço áudios. Figurinhas, fotos, vídeos e arquivos eu não consigo entender.",
  audioFailed: "Não consegui ouvir seu áudio agora. Pode escrever a resposta?",
  interviewInvite: (url: string, demoThreshold?: number) =>
    [
      ...(demoThreshold !== undefined
        ? [`_Demonstração: aqui todo mundo é convidado. Em uso real, o questionário dá uma nota de 0 a 100 e só quem fica abaixo de ${demoThreshold} recebe este convite._`, ""]
        : []),
      `Para entender melhor como você está, a Helena, assistente de ${doctor()}, pode conversar com você por uns 10 minutos, por voz ou por texto.`,
      "É sigiloso, só vai para o(a) médico(a), e você pode pular perguntas ou parar quando quiser.",
      `Quando puder, abra este link: ${url}`,
    ].join("\n"),
  unknownNumber: "Olá! Este número é usado pela saúde ocupacional da empresa e não encontrou seu cadastro. Fale com o RH se achar que deveria estar aqui.",
  noActiveRun: `Olá! No momento não há questionário em andamento para você. Se precisar falar com ${doctor()}, escreva aqui que repassamos. Em emergência, 192. CVV: 188.`,
};

/** Uma mensagem por item: bloco, instrução (com período de lembrança), item em negrito e a escala. */
export function formatItem(item: Item): string {
  const lines: string[] = [];
  if (item.part) lines.push(`_${item.part}_`);
  if (item.instruction) lines.push(item.instruction);
  lines.push(`*${item.text}*`);
  if (item.help) lines.push(`(${item.help})`);
  if (item.scale) lines.push(optionsLine(item));
  return lines.join("\n");
}

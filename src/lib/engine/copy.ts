import type { Item } from "@/lib/instruments/types";

const doctor = () => process.env.DOCTOR_NAME ?? "o(a) médico(a) do trabalho";
const company = () => process.env.COMPANY_NAME ?? "sua empresa";

/** Mensagens do bot. Base: docs/questionario-whatsapp.md, seção 5. */
export const copy = {
  consent: (name: string, demoShort: boolean) =>
    [
      `Olá, ${name.split(" ")[0]}. Aqui é o canal de saúde ocupacional de ${doctor()}, responsável pelo PCMSO da ${company()}.`,
      "",
      `Queremos saber como sua saúde e seu trabalho estão se afetando. São perguntas curtas, uma por vez, e levam ${demoShort ? "cerca de 1 minuto" : "de 5 a 8 minutos"}.`,
      "",
      `• *Quem vê suas respostas:* só ${doctor()}, sob sigilo médico. A empresa não recebe suas respostas individuais.`,
      "• *Para que serve:* ajudar o médico a decidir com quem conversar primeiro. Não é diagnóstico e não é usado para contratar, promover ou demitir ninguém.",
      "• *É voluntário.* Você pode parar quando quiser escrevendo PARAR.",
      "• Este WhatsApp não é atendido o tempo todo. Em emergência, ligue 192 (SAMU). Para conversar com alguém agora: 188 (CVV, 24 h, gratuito).",
      "",
      "Você aceita participar?",
      "1 Sim, aceito · 2 Não quero participar",
    ].join("\n"),
  consentRepeat: "Para começar, responda 1 (Sim, aceito) ou 2 (Não quero participar).",
  declined: `Tudo bem, obrigado. Se mudar de ideia, é só escrever COMEÇAR.`,
  opening: [
    "Obrigado. Vou mandar uma pergunta por vez. Responda com o *número* da opção.",
    "Não há resposta certa ou errada; responda pensando em como você realmente está.",
  ].join("\n"),
  repeat: "Não entendi sua resposta. Pode responder com o número de uma das opções?",
  stopped: `Tudo bem, paramos por aqui. O que você já respondeu vai para ${doctor()}. Se quiser retomar, escreva CONTINUAR.\nEm emergência, 192. Para conversar a qualquer hora, 188 (CVV).`,
  resumed: "Obrigado por voltar. Vamos continuar de onde paramos.",
  alreadyRunning: "Você já está no meio do questionário. Esta é a pergunta atual:",
  closing: () =>
    [
      "Pronto, terminamos. Muito obrigado pelo seu tempo.",
      `Suas respostas foram para ${doctor()}, só para ele(a). Se for o caso, ele(a) vai chamar você para conversar.`,
      "Lembrete: em emergência, 192. Para conversar a qualquer hora, 188 (CVV).",
    ].join("\n"),
  interviewInvite: (url: string) =>
    [
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
  if (item.scaleLine) lines.push(item.scaleLine);
  return lines.join("\n");
}

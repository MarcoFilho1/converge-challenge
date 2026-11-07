/**
 * Itens do questionário, com o texto das versões validadas em pt-BR.
 * Fonte de cada texto, escala e corte: docs/questionario-whatsapp.md (seções 3 e 4).
 * Não reescrever itens: PHQ/GAD (Pfizer), BAT (Schaufeli et al.) e WPAI (Reilly) pedem texto inalterado.
 */
import type { Answers, Item, Scale } from "./types";

const PHQ_LABELS = ["nenhuma vez", "vários dias", "mais da metade dos dias", "quase todos os dias"];
const PHQ_SCALE: Scale = { min: 0, max: 3, higherIsWorse: true, labels: PHQ_LABELS };
const PHQ_LINE = "0 nenhuma vez · 1 vários dias · 2 mais da metade dos dias · 3 quase todos os dias";

const BAT_SCALE: Scale = {
  min: 1,
  max: 5,
  higherIsWorse: true,
  labels: ["nunca", "raramente", "algumas vezes", "com frequência", "sempre"],
};
const BAT_LINE = "1 nunca · 2 raramente · 3 algumas vezes · 4 com frequência · 5 sempre";

const COPSOQ_FREQ_LABELS = ["nunca", "raramente", "às vezes", "frequentemente", "sempre"];
const COPSOQ_LINE = "0 nunca · 1 raramente · 2 às vezes · 3 frequentemente · 4 sempre";

const PHQ_INSTRUCTION =
  "Durante as últimas 2 semanas, com que freqüência você foi incomodado/a por qualquer um dos problemas abaixo?";
const GAD_INSTRUCTION = "Durante as últimas 2 semanas, com que freqüência você foi incomodado/a pelos problemas abaixo?";
const BAT_INSTRUCTION =
  "Leia atentamente a frase e responda com a frequência com que você se sente desse modo no seu trabalho.";
const COPSOQ_INSTRUCTION = "Sobre o seu trabalho:";

const sum = (a: Answers, codes: string[]) => codes.reduce((s, c) => s + (a[c] ?? 0), 0);
/** Porta de entrada falha aberta: resposta nula ou ausente não conta como negativa. */
const unknown = (a: Answers, codes: string[]) => codes.some((c) => a[c] === null || a[c] === undefined);
export const phq2 = (a: Answers) => sum(a, ["PHQ9_1", "PHQ9_2"]);
export const gad2 = (a: Answers) => sum(a, ["GAD7_1", "GAD7_2"]);
export const TRUNK_YES = 2;

const trunk: Item = {
  code: "TRUNK",
  instrument: "TRUNK",
  part: "Parte 1 de 5 · Trabalho e saúde",
  instruction: "Pensando no último mês:",
  text: "NOS ÚLTIMOS 30 DIAS, você esteve presente no trabalho apesar de apresentar algum problema de saúde ou algum sinal ou sintoma de adoecimento?",
  scale: { min: 1, max: 2, higherIsWorse: true, labels: ["não", "sim"] },
  scaleLine: "1 não · 2 sim",
};

const wpaiQ5: Item = {
  code: "WPAI_Q5",
  instrument: "WPAI",
  part: "Parte 1 de 5 · Trabalho e saúde",
  instruction:
    "As perguntas a seguir referem-se ao efeito dos seus problemas de saúde na sua capacidade de trabalhar. Por problemas de saúde estamos nos referindo a qualquer problema ou sintoma físico ou emocional.",
  text: "Durante os últimos sete dias, até que ponto seus problemas de saúde afetaram sua produtividade enquanto estava trabalhando? Considere os dias em que você ficou limitado em relação à quantidade ou ao tipo de trabalho que você pôde realizar, os dias em que você realizou muito menos do que gostaria ou os dias em que você não conseguiu trabalhar de forma tão cuidadosa como o normal. Se seus problemas de saúde apenas afetaram um pouco seu trabalho, escolha um número baixo. Escolha um número alto se seus problemas de saúde afetaram muito seu trabalho.",
  scale: { min: 0, max: 10, higherIsWorse: true },
  scaleLine: "Responda de 0 a 10 · 0 = não tiveram nenhum efeito sobre meu trabalho · 10 = me impediram completamente de realizar meu trabalho",
  when: (a) => a.TRUNK === TRUNK_YES || a.TRUNK === null || a.TRUNK === undefined,
};

const PHQ_TEXTS = [
  "Pouco interesse ou pouco prazer em fazer as coisas",
  'Se sentir "para baixo", deprimido/a ou sem perspectiva',
  "Dificuldade para pegar no sono ou permanecer dormindo, ou dormir mais do que de costume",
  "Se sentir cansado/a ou com pouca energia",
  "Falta de apetite ou comendo demais",
  "Se sentir mal consigo mesmo/a — ou achar que você é um fracasso ou que decepcionou sua família ou você mesmo/a",
  "Dificuldade para se concentrar nas coisas, como ler o jornal ou ver televisão",
  "Lentidão para se movimentar ou falar, a ponto das outras pessoas perceberem? Ou o oposto – estar tão agitado/a ou irrequieto/a que você fica andando de um lado para o outro muito mais do que de costume",
  "Pensar em se ferir de alguma maneira ou que seria melhor estar morto/a",
];

const phq = PHQ_TEXTS.map<Item>((text, i) => ({
  code: `PHQ9_${i + 1}`,
  instrument: "PHQ9",
  part: "Parte 2 de 5 · Humor",
  instruction: PHQ_INSTRUCTION,
  text,
  scale: PHQ_SCALE,
  scaleLine: PHQ_LINE,
  // Itens 3–8 só se PHQ-2 >= 2 (Levis 2020). Item 9 sempre.
  when: i >= 2 && i <= 7 ? (a) => unknown(a, ["PHQ9_1", "PHQ9_2"]) || phq2(a) >= 2 : undefined,
}));

const GAD_TEXTS = [
  "Sentir-se nervoso/a, ansioso/a ou muito tenso/a",
  "Não ser capaz de impedir ou de controlar as preocupações",
  "Preocupar-se muito com diversas coisas",
  "Dificuldade para relaxar",
  "Ficar tão agitado/a que se torna difícil permanecer sentado/a",
  "Ficar facilmente aborrecido/a ou irritado/a",
  "Sentir medo como se algo horrível fosse acontecer",
];

const gad = GAD_TEXTS.map<Item>((text, i) => ({
  code: `GAD7_${i + 1}`,
  instrument: "GAD7",
  part: "Parte 3 de 5 · Ansiedade",
  instruction: GAD_INSTRUCTION,
  text,
  scale: PHQ_SCALE,
  scaleLine: PHQ_LINE,
  // Itens 3–7 só se GAD-2 >= 2 (escolha de produto, ver pesquisa 1.2).
  when: i >= 2 ? (a) => unknown(a, ["GAD7_1", "GAD7_2"]) || gad2(a) >= 2 : undefined,
}));

/** BAT-12: números do formulário brasileiro de 23 itens (versão reduzida). */
export const BAT12_NUMBERS = [1, 3, 4, 9, 11, 13, 14, 17, 18, 19, 20, 23] as const;
const BAT_TEXTS: Record<number, string> = {
  1: "No trabalho, sinto-me mentalmente exausto",
  3: "Acho difícil recuperar minha energia depois de um dia de trabalho",
  4: "No trabalho, sinto-me fisicamente exausto",
  9: "Eu luto para encontrar algum entusiasmo pelo meu trabalho",
  11: "Sinto forte aversão pelo meu trabalho",
  13: "Sou pessimista sobre o que meu trabalho significa para os outros",
  14: "Em meu trabalho, tenho dificuldade em manter o foco",
  17: "Tenho dificuldade em me concentrar quando estou trabalhando",
  18: "Cometo erros no trabalho porque minha mente está em outras coisas",
  19: "No trabalho, sinto-me incapaz de controlar as minhas emoções",
  20: "Eu não me reconheço na maneira como reajo emocionalmente no trabalho",
  23: "No trabalho, eu posso ter reações exageradas sem querer",
};

const bat = BAT12_NUMBERS.map<Item>((n) => ({
  code: `BAT_${n}`,
  instrument: "BAT12",
  part: "Parte 4 de 5 · Cansaço no trabalho",
  instruction: BAT_INSTRUCTION,
  text: BAT_TEXTS[n],
  scale: BAT_SCALE,
  scaleLine: BAT_LINE,
}));

const copsoqFreq = (code: string, text: string, higherIsWorse: boolean): Item => ({
  code,
  instrument: "COPSOQ",
  part: "Parte 5 de 5 · Seu ambiente de trabalho",
  instruction: COPSOQ_INSTRUCTION,
  text,
  scale: { min: 0, max: 4, higherIsWorse, labels: COPSOQ_FREQ_LABELS },
  scaleLine: COPSOQ_LINE,
});

const copsoq2A = copsoqFreq("COPSOQ_2A", "É necessário manter um ritmo acelerado no trabalho?", true);
const copsoq4A = copsoqFreq("COPSOQ_4A", "Você tem um alto grau de influência nas decisões sobre o seu trabalho?", false);
const copsoq12B = copsoqFreq("COPSOQ_12B", "Com que frequência você recebe ajuda e suporte do seu superior imediato?", false);
const copsoq23: Item = {
  code: "COPSOQ_23",
  instrument: "COPSOQ",
  part: "Parte 5 de 5 · Seu ambiente de trabalho",
  instruction: COPSOQ_INSTRUCTION,
  text: "Você foi exposto a bullying no seu local de trabalho nos últimos 12 meses?",
  scale: {
    min: 1,
    max: 5,
    higherIsWorse: false,
    labels: ["sim, diariamente", "sim, semanalmente", "sim, mensalmente", "sim, poucas vezes", "não"],
  },
  scaleLine: "1 sim, diariamente · 2 sim, semanalmente · 3 sim, mensalmente · 4 sim, poucas vezes · 5 não",
};

const open1: Item = {
  code: "OPEN_1",
  instrument: "OPEN",
  part: "Para terminar",
  text: "O que no trabalho está mais difícil agora? (pode responder com suas palavras, ou escrever PULAR)",
  scale: null,
};
const open2: Item = {
  code: "OPEN_2",
  instrument: "OPEN",
  part: "Para terminar",
  text: "O que ajudaria? (pode responder com suas palavras, ou escrever PULAR)",
  scale: null,
};

const byCode = (items: Item[], code: string) => items.find((i) => i.code === code)!;

/** Roteiro completo (pesquisa, seção 6.1), sem o módulo opcional SPS-6. */
export const FULL_ITEMS: Item[] = [
  trunk,
  wpaiQ5,
  byCode(phq, "PHQ9_1"),
  byCode(phq, "PHQ9_2"),
  ...phq.slice(2, 8),
  byCode(phq, "PHQ9_9"),
  ...gad,
  ...bat,
  copsoq2A,
  copsoq4A,
  copsoq12B,
  copsoq23,
  open1,
  open2,
];

/** Roteiro da demo de palco (pesquisa, seção 6.2). Não gera escore validado. */
export const DEMO_ITEMS: Item[] = [
  trunk,
  { ...wpaiQ5, when: undefined },
  { ...byCode(bat, "BAT_1"), part: "Parte 2 de 3 · Como você está" },
  { ...byCode(phq, "PHQ9_1"), part: "Parte 2 de 3 · Como você está" },
  { ...byCode(phq, "PHQ9_2"), part: "Parte 2 de 3 · Como você está" },
  { ...byCode(phq, "PHQ9_9"), part: "Parte 2 de 3 · Como você está" },
  { ...copsoq2A, part: "Parte 3 de 3 · Seu trabalho" },
  open1,
];

export function getItems(demoShort: boolean): Item[] {
  return demoShort ? DEMO_ITEMS : FULL_ITEMS;
}

/** Próximo índice cujo item se aplica (respeitando as portas de entrada), ou -1 no fim. */
export function nextItemIndex(items: Item[], answers: Answers, fromIndex: number): number {
  for (let i = fromIndex; i < items.length; i++) {
    const when = items[i].when;
    if (!when || when(answers)) return i;
  }
  return -1;
}

/**
 * Respostas reais em linguagem natural para o questionário do WhatsApp, com o que o sistema deve fazer.
 * `want` lista os desfechos aceitáveis:
 *   número N        → gravado direto com valor N
 *   "confirm:a-b"   → pergunta "Só para confirmar" com valor entre a e b
 *   "reject"        → não grava, pede de novo com as opções
 *   intenção        → "yes" | "no" | "doubt" | "stop" | "skip" | "correction:N"
 */
import type { ReplyStage } from "@/lib/ai/types";

export type Case = { stage?: ReplyStage; code: string | null; previous?: string; upcoming?: string[]; text: string; want: (number | string)[]; nota?: string };

export const CASES: Case[] = [
  // Pergunta-tronco (1 = não, 2 = sim)
  { code: "TRUNK", text: "sim, trabalhei mesmo com enxaqueca", want: [2] },
  { code: "TRUNK", text: "fui sim, gripado e tudo", want: [2] },
  { code: "TRUNK", text: "não, graças a Deus", want: [1] },
  { code: "TRUNK", text: "trabalhei com dor nas costas a semana toda", want: [2, "confirm:2-2"] },
  { code: "TRUNK", text: "acho que não", want: [1, "confirm:1-1"] },
  { code: "TRUNK", text: "2", want: ["reject"], nota: "número não é atalho" },

  // WPAI 0 a 10 (o número é a resposta)
  { code: "WPAI_Q5", text: "uns 7", want: [7] },
  { code: "WPAI_Q5", text: "nota 3", want: [3] },
  { code: "WPAI_Q5", text: "zero, não atrapalhou nada", want: ["confirm:0-0", 0] },
  { code: "WPAI_Q5", text: "atrapalhou muito, quase não consegui trabalhar", want: ["confirm:7-10"] },
  { code: "WPAI_Q5", text: "faz 2 semanas que tô mal, mas no trabalho foi uns 5", want: [5], nota: "não pegar o 2" },
  { code: "WPAI_Q5", text: "o que conta como produtividade?", want: ["doubt"] },
  { code: "WPAI_Q5", text: "não sei dizer", want: ["reject"] },

  // PHQ-9 (0 nenhuma vez · 1 vários dias · 2 mais da metade · 3 quase todos)
  { code: "PHQ9_1", text: "quase todo dia", want: [3] },
  { code: "PHQ9_1", text: "de vez em quando", want: [1] },
  { code: "PHQ9_1", text: "a maior parte dos dias", want: [2, "confirm:2-3"] },
  { code: "PHQ9_1", text: "nunca, tô bem animado", want: [0] },
  { code: "PHQ9_1", text: "faz 3 meses que perdi o interesse em tudo", want: ["confirm:2-3", 3, "reject"], nota: "o 3 é de meses" },
  { code: "PHQ9_1", text: "2", want: ["reject"], nota: "número não é atalho" },
  { code: "PHQ9_1", text: "vários", want: [1, "confirm:1-1"] },
  { code: "PHQ9_2", text: "ando muito pra baixo, quase todos os dias", want: [3] },
  { code: "PHQ9_2", text: "uns dias sim, outros não", want: [1, 2, "confirm:1-2"] },
  { code: "PHQ9_2", text: "não, tô de boa", want: [0, "confirm:0-0"] },
  { code: "PHQ9_2", text: "mais da metade das vezes", want: [2] },
  { code: "PHQ9_3", text: "durmo mal toda noite", want: [3] },
  { code: "PHQ9_3", text: "só no domingo à noite que não durmo", want: [1, "confirm:1-1"] },
  { code: "PHQ9_3", text: "tenho dormido demais quase todo dia", want: [3] },
  { code: "PHQ9_4", text: "cansado direto", want: [3, "confirm:3-3"] },
  { code: "PHQ9_4", text: "um pouco cansado alguns dias", want: [1] },

  // Item 9 (segurança): "nenhuma vez" só com negação explícita
  { code: "PHQ9_9", text: "nunca", want: [0] },
  { code: "PHQ9_9", text: "não, nunca pensei nisso", want: [0] },
  { code: "PHQ9_9", text: "acho que não", want: ["confirm:0-0"] },
  { code: "PHQ9_9", text: "tá tudo bem", want: ["confirm:0-0", "reject"] },
  { code: "PHQ9_9", text: "às vezes", want: [1] },
  { code: "PHQ9_9", text: "quase todo dia penso que seria melhor não acordar", want: [3, 2] },
  { code: "PHQ9_9", text: "não sei", want: ["reject"] },
  { code: "PHQ9_9", text: "prefiro não responder", want: ["skip"] },

  // GAD-7
  { code: "GAD7_1", text: "fico nervoso no trabalho quase todo dia", want: [3] },
  { code: "GAD7_1", text: "raramente", want: [0, 1, "confirm:0-1"] },
  { code: "GAD7_1", text: "mais ou menos metade do mês", want: [2, "confirm:1-2"] },
  { code: "GAD7_2", text: "não consigo parar de me preocupar, direto", want: [3, "confirm:3-3"] },

  // BAT-12 (1 nunca · 2 raramente · 3 algumas vezes · 4 com frequência · 5 sempre)
  { code: "BAT_1", text: "com frequência", want: [4] },
  { code: "BAT_1", text: "quase nunca", want: [2] },
  { code: "BAT_1", text: "o tempo todo, chego em casa destruído", want: [5] },
  { code: "BAT_1", text: "algumas vezes por semana", want: [3, 4, "confirm:3-4"] },
  { code: "BAT_1", text: "5", want: ["reject"], nota: "número não é atalho" },
  { code: "BAT_3", text: "nunca consigo recuperar a energia", want: [5, "confirm:4-5"], nota: "nunca = sempre difícil" },
  { code: "BAT_14", text: "raramente perco o foco", want: [2] },

  // COPSOQ
  { code: "COPSOQ_2A", text: "sempre, é correria total", want: [4] },
  { code: "COPSOQ_2A", text: "às vezes", want: [2] },
  { code: "COPSOQ_4A", text: "nunca, ninguém me pergunta nada", want: [0] },
  { code: "COPSOQ_12B", text: "meu chefe quase nunca ajuda", want: [1, "confirm:1-1"] },
  { code: "COPSOQ_23", text: "não", want: [5] },
  { code: "COPSOQ_23", text: "sim, toda semana", want: [2] },
  { code: "COPSOQ_23", text: "aconteceu umas duas vezes", want: [4, "confirm:3-4"] },

  // Consentimento
  { stage: "consent", code: null, text: "bora", want: ["yes"] },
  { stage: "consent", code: null, text: "pode mandar as perguntas", want: ["yes"] },
  { stage: "consent", code: null, text: "agora não, tô dirigindo", want: ["no"] },
  { stage: "consent", code: null, text: "quem vai ver isso?", want: ["doubt"] },
  { stage: "consent", code: null, text: "sim aceito", want: ["yes"] },
  { stage: "consent", code: null, text: "não quero participar", want: ["no"] },

  // Confirmação ("Só para confirmar: …?")
  { stage: "confirm", code: "WPAI_Q5", text: "isso", want: ["yes"] },
  { stage: "confirm", code: "WPAI_Q5", text: "exatamente", want: ["yes"] },
  { stage: "confirm", code: "WPAI_Q5", text: "não, era mais", want: ["no"] },

  // Correção do item anterior
  { code: "PHQ9_2", previous: "PHQ9_1", text: "na verdade é quase todo dia", want: ["correction:3"] },
  { code: "PHQ9_2", previous: "PHQ9_1", text: "errei, quis dizer nunca", want: ["correction:0"] },

  // Dúvida e parar
  { code: "PHQ9_1", text: "o que quer dizer pouco prazer?", want: ["doubt"] },
  { code: "BAT_1", text: "como assim mentalmente exausto?", want: ["doubt"] },
  { code: "PHQ9_1", text: "quero parar por aqui", want: ["stop"] },

  // Fala que já toca no próximo item (só muda a frase de ligação)
  { code: "PHQ9_3", upcoming: ["PHQ9_4", "PHQ9_5"], text: "durmo mal quase todo dia e acordo sem energia nenhuma", want: [3], nota: "mentions deve ter PHQ9_4" },
  { code: "BAT_1", upcoming: ["PHQ9_1", "PHQ9_2"], text: "com frequência, chego em casa sem conseguir pensar", want: [4], nota: "mentions deve ficar vazio" },
];

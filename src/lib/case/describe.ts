import type { QueueRow, QueueScoreChip } from "@/lib/demo/fixtures";

type CaseLike = Pick<QueueRow, "severity" | "status" | "clinicalOnly" | "partial" | "ruleTrace" | "scores">;

/** Número no formato brasileiro (vírgula decimal). */
export const fmt = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

const find = (scores: QueueScoreChip[], instrument: string, dimension: string) =>
  scores.find((s) => s.instrument === instrument && s.dimension === dimension);

const joinPt = (parts: string[]) =>
  parts.length <= 1 ? (parts[0] ?? "") : `${parts.slice(0, -1).join(", ")} e ${parts[parts.length - 1]}`;

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Sinais clínicos (critério C) e assédio, em português, a partir dos escores sinalizados. */
function clinicalParts(scores: QueueScoreChip[]): string[] {
  const parts: string[] = [];
  const bat1 = find(scores, "BAT", "item1");
  const bat12 = find(scores, "BAT12", "total");
  const phq9 = find(scores, "PHQ9", "total");
  const phq2 = find(scores, "PHQ2", "total");
  const gad7 = find(scores, "GAD7", "total");
  if (bat1?.flagged) parts.push("esgotamento frequente");
  else if (bat12?.flagged) parts.push(`esgotamento (BAT-12 ${fmt(bat12.value)}/5)`);
  if (phq9?.flagged) parts.push(`humor baixo (PHQ-9 ${phq9.value}/27)`);
  else if (phq2?.flagged && phq2.value >= 3) parts.push(`humor baixo (PHQ-2 ${phq2.value}/6)`);
  if (gad7?.flagged) parts.push(`ansiedade (GAD-7 ${gad7.value}/21)`);
  return parts;
}

/** Uma frase que diz ao médico o que apareceu no caso, calculada da regra e dos escores (sem IA). */
export function describeCase(c: CaseLike): string {
  const item9 = find(c.scores, "PHQ9", "item9");
  if (c.status === "crisis" && !(item9?.flagged)) return "Escreveu uma frase de risco. Recebeu CVV 188 e SAMU 192.";
  if (item9?.flagged) return "Marcou pensamentos de risco no item 9 do PHQ-9. Recebeu CVV 188 e SAMU 192.";

  const parts: string[] = [];
  if (c.ruleTrace.hasPresenteeismTrunk) parts.push("trabalhou doente");
  const wpai = find(c.scores, "WPAI", "work_impairment");
  if (c.ruleTrace.hasWorkImpairment && wpai) parts.push(`prejuízo ${wpai.value}/10`);
  parts.push(...clinicalParts(c.scores));
  if (find(c.scores, "COPSOQ", "assedio")?.flagged) parts.push("relatou assédio no trabalho nos últimos 12 meses");

  if (parts.length === 0) return c.partial ? "Parou antes do fim, sem sinal acima do corte até ali." : "Nenhum sinal acima do corte.";
  let text = `${capital(joinPt(parts))}.`;
  if (c.clinicalOnly) text += " Não relatou presenteísmo.";
  if (c.partial) text += " Parou antes do fim.";
  return text;
}

export type Reason = { text: string; source: string };

/** O porquê da gravidade, um critério por linha, cada um com a origem. */
export function reasonsFor(c: CaseLike): Reason[] {
  const out: Reason[] = [];
  const item9 = find(c.scores, "PHQ9", "item9");
  if (c.status === "crisis" && !(item9?.flagged)) out.push({ text: "Escreveu uma frase de risco.", source: "mensagem no WhatsApp" });
  if (item9?.flagged) out.push({ text: `Marcou o item 9 do PHQ-9 (${item9.value}/3).`, source: "PHQ-9 item 9" });
  if (c.ruleTrace.hasPresenteeismTrunk) out.push({ text: "Trabalhou com problema de saúde no último mês.", source: "pergunta-tronco" });
  const wpai = find(c.scores, "WPAI", "work_impairment");
  if (c.ruleTrace.hasWorkImpairment && wpai) out.push({ text: `Prejuízo no trabalho de ${wpai.value}/10, acima do corte 3.`, source: "WPAI Q5" });
  const bat1 = find(c.scores, "BAT", "item1");
  const bat12 = find(c.scores, "BAT12", "total");
  const phq9 = find(c.scores, "PHQ9", "total");
  const phq2 = find(c.scores, "PHQ2", "total");
  const gad7 = find(c.scores, "GAD7", "total");
  if (bat1?.flagged) out.push({ text: "Esgotamento acima do corte.", source: "BAT item 1" });
  if (bat12?.flagged) out.push({ text: `Esgotamento médio ${fmt(bat12.value)}/5, acima do corte 2,54.`, source: "BAT-12" });
  if (phq9?.flagged) out.push({ text: `Humor: PHQ-9 ${phq9.value}/27, acima do corte 10.`, source: "PHQ-9" });
  else if (phq2?.flagged && phq2.value >= 3) out.push({ text: `Humor: PHQ-2 ${phq2.value}/6.`, source: "PHQ-2" });
  if (gad7?.flagged) out.push({ text: `Ansiedade: GAD-7 ${gad7.value}/21, acima do corte 10.`, source: "GAD-7" });
  if (find(c.scores, "COPSOQ", "assedio")?.flagged) out.push({ text: "Relatou assédio no trabalho.", source: "COPSOQ 23" });
  if (c.clinicalOnly) out.push({ text: "Sinal clínico sem presenteísmo relatado.", source: "regra de gravidade" });
  return out;
}

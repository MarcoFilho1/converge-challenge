export type InstrumentCode = "TRUNK" | "WPAI" | "BAT12" | "PHQ9" | "GAD7" | "COPSOQ" | "OPEN";

export type Scale = {
  min: number;
  max: number;
  /** true quando valor maior significa pior (padrão). */
  higherIsWorse: boolean;
  /** labels[i] corresponde ao valor min + i. */
  labels?: string[];
};

export type Item = {
  code: string;
  instrument: InstrumentCode;
  text: string;
  /** null = resposta aberta, sem escala. */
  scale: Scale | null;
  /** Instrução e período de lembrança repetidos no topo de cada mensagem. */
  instruction?: string;
  /** Rótulo do bloco, ex.: "Parte 2 de 5 · Humor". */
  part?: string;
  /** Linha da escala como aparece no WhatsApp. */
  scaleLine?: string;
  /**
   * Número que a pessoa digita → valor gravado, quando a ordem na tela difere da escala original.
   * Ex.: pergunta-tronco mostra "1 sim · 2 não" (igual ao consentimento), mas grava 2 = sim como no instrumento.
   */
  choices?: Record<string, number>;
  /** Porta de entrada: o item só é perguntado se devolver true. */
  when?: (answers: Answers) => boolean;
};

export type Answers = Record<string, number | null | undefined>;

export type Score = {
  instrument: string;
  dimension: string;
  value: number;
  cutoff: number;
  flagged: boolean;
  complete: boolean;
};

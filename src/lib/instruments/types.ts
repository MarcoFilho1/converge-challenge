export type InstrumentCode = "SPS6" | "WPAI" | "BAT12" | "PHQ9" | "GAD7" | "OPEN";

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
};

export type Score = {
  instrument: string;
  dimension: string;
  value: number;
  cutoff: number;
  flagged: boolean;
  complete: boolean;
};

export interface VoiceProvider {
  /** null = sem voz disponível (a tela usa speechSynthesis). */
  tts(text: string): Promise<{ audio: Buffer; mime: "audio/wav" } | null>;
  stt(audio: Buffer, mime: string): Promise<{ text: string; ms: number }>;
  health(): Promise<boolean>;
}

export class VoiceUnavailable extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VoiceUnavailable";
  }
}

import { VoiceUnavailable, type VoiceProvider } from "./types";

/** VOICE_PROVIDER=none: sem TTS (tela fala com speechSynthesis) e sem STT (só modo texto). */
export function createNoVoice(): VoiceProvider {
  return {
    async tts() { return null; },
    async stt() { throw new VoiceUnavailable("sem provedor de voz (VOICE_PROVIDER=none)"); },
    async health() { return false; },
  };
}

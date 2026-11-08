import { createNoVoice } from "./none";
import type { VoiceProvider } from "./types";
import { createVoicebox } from "./voicebox";
import { createElevenLabs } from "./elevenlabs";

export * from "./types";
export { toWav16k } from "./convert";
export { audioCachePath, getOrGenerate, DEFAULT_VOICE_CACHE_ROOT } from "./cache";

let cached: { key: string; provider: VoiceProvider } | null = null;

/**
 * VOICE_PROVIDER=voicebox → fala e escuta no Voicebox local.
 * VOICE_PROVIDER=elevenlabs → fala na ElevenLabs (ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID), escuta no Whisper do Voicebox.
 * Qualquer outro valor = sem voz (a tela usa a voz do navegador).
 */
export function getVoice(): VoiceProvider {
  const mode = process.env.VOICE_PROVIDER ?? "none";
  const key = `${mode}|${process.env.VOICEBOX_URL}|${process.env.VOICEBOX_PROFILE_ID}|${process.env.ELEVENLABS_VOICE_ID}|${process.env.ELEVENLABS_MODEL}`;
  if (cached?.key !== key) {
    const voicebox = () => createVoicebox({ url: process.env.VOICEBOX_URL ?? "http://127.0.0.1:17493", profileId: process.env.VOICEBOX_PROFILE_ID ?? "", language: process.env.VOICEBOX_LANGUAGE ?? "pt" });
    cached = {
      key,
      provider: mode === "voicebox"
        ? voicebox()
        : mode === "elevenlabs"
          ? createElevenLabs({ apiKey: process.env.ELEVENLABS_API_KEY ?? "", voiceId: process.env.ELEVENLABS_VOICE_ID ?? "", model: process.env.ELEVENLABS_MODEL, stt: voicebox() })
          : createNoVoice(),
    };
  }
  return cached.provider;
}

/** Nome da pasta de cache: muda com a voz, para não misturar áudios de vozes diferentes. */
export function voiceProfileName(): string {
  if (process.env.VOICE_PROVIDER === "elevenlabs") return `el-${process.env.ELEVENLABS_VOICE_ID || "sem-voz"}`;
  return process.env.VOICEBOX_PROFILE_ID || "sem-voz";
}

import { createNoVoice } from "./none";
import type { VoiceProvider } from "./types";
import { createVoicebox } from "./voicebox";

export * from "./types";
export { toWav16k } from "./convert";
export { audioCachePath, getOrGenerate, DEFAULT_VOICE_CACHE_ROOT } from "./cache";

let cached: { key: string; provider: VoiceProvider } | null = null;

/** VOICE_PROVIDER=voicebox usa o Voicebox local; qualquer outro valor = sem voz. */
export function getVoice(): VoiceProvider {
  const mode = process.env.VOICE_PROVIDER === "voicebox" ? "voicebox" : "none";
  const key = `${mode}|${process.env.VOICEBOX_URL}|${process.env.VOICEBOX_PROFILE_ID}`;
  if (cached?.key !== key) {
    cached = {
      key,
      provider: mode === "voicebox"
        ? createVoicebox({ url: process.env.VOICEBOX_URL ?? "http://127.0.0.1:17493", profileId: process.env.VOICEBOX_PROFILE_ID ?? "", language: process.env.VOICEBOX_LANGUAGE ?? "pt" })
        : createNoVoice(),
    };
  }
  return cached.provider;
}

export function voiceProfileName(): string {
  return process.env.VOICEBOX_PROFILE_ID || "sem-voz";
}

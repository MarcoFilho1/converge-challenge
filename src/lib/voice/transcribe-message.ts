/**
 * Transcreve o áudio que a pessoa mandou no WhatsApp com o mesmo Whisper da entrevista (Voicebox local).
 * Converte para WAV 16 kHz com o ffmpeg e descarta transcrição vazia ou alucinada.
 */
import { cleanTranscript, looksHallucinated, toWav16k } from "./index";
import { getVoice } from "./index";
import { createVoicebox } from "./voicebox";

function listener() {
  // Com VOICE_PROVIDER=none ainda dá para ouvir: a escuta é sempre o Whisper do Voicebox.
  if ((process.env.VOICE_PROVIDER ?? "none") === "none") {
    return createVoicebox({ url: process.env.VOICEBOX_URL ?? "http://127.0.0.1:17493", profileId: process.env.VOICEBOX_PROFILE_ID ?? "", language: process.env.VOICEBOX_LANGUAGE ?? "pt" });
  }
  return getVoice();
}

export async function transcribeAudio(audio: Buffer, mime: string): Promise<{ text: string; ms: number }> {
  const started = Date.now();
  const wav = await toWav16k(audio, mime);
  const raw = (await listener().stt(wav, "audio/wav")).text;
  const text = cleanTranscript(raw);
  if (!text || looksHallucinated(text)) throw new Error("transcrição vazia ou sem sentido");
  return { text, ms: Date.now() - started };
}

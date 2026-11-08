/**
 * ElevenLabs só para FALAR (TTS). A escuta continua no Whisper local do Voicebox (provedor `stt`).
 * POST /v1/text-to-speech/{voice_id}?output_format=pcm_24000 → PCM 16-bit mono 24 kHz, embrulhado em WAV aqui.
 * eleven_flash_v2_5: ~75 ms, aceita language_code "pt". eleven_multilingual_v2: mais natural, mais lento.
 */
import { createNoVoice } from "./none";
import { VoiceUnavailable, type VoiceProvider } from "./types";

export type ElevenLabsOptions = {
  apiKey: string;
  voiceId: string;
  model?: string;
  stt?: VoiceProvider;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

export function pcmToWav(pcm: Buffer, sampleRate: number): Buffer {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVE", 8);
  h.write("fmt ", 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(sampleRate, 24); h.writeUInt32LE(sampleRate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write("data", 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

export function createElevenLabs(opts: ElevenLabsOptions): VoiceProvider {
  const f = opts.fetchImpl ?? fetch;
  const stt = opts.stt ?? createNoVoice();
  const model = opts.model ?? "eleven_flash_v2_5";
  return {
    async tts(text) {
      let res: Response;
      try {
        res = await f(`https://api.elevenlabs.io/v1/text-to-speech/${opts.voiceId}?output_format=pcm_24000`, {
          method: "POST",
          headers: { "xi-api-key": opts.apiKey, "content-type": "application/json", accept: "audio/pcm" },
          body: JSON.stringify({ text, model_id: model, language_code: "pt", voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.2 } }),
          signal: AbortSignal.timeout(opts.timeoutMs ?? 15_000),
        });
      } catch (err) {
        throw new VoiceUnavailable(`ElevenLabs falhou: ${err instanceof Error ? err.message : String(err)}`);
      }
      if (!res.ok) throw new VoiceUnavailable(`ElevenLabs respondeu ${res.status}: ${(await res.text()).slice(0, 200)}`);
      return { audio: pcmToWav(Buffer.from(await res.arrayBuffer()), 24000), mime: "audio/wav" };
    },
    stt: (audio, mime) => stt.stt(audio, mime),
    async health() {
      try {
        const r = await f("https://api.elevenlabs.io/v1/user", { headers: { "xi-api-key": opts.apiKey }, signal: AbortSignal.timeout(5000) });
        return r.ok;
      } catch {
        return false;
      }
    },
  };
}

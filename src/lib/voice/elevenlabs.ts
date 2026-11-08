/**
 * ElevenLabs só para FALAR (TTS). A escuta continua no Whisper local do Voicebox (provedor `stt`).
 * POST /v1/text-to-speech/{voice_id}?output_format=pcm_24000 → PCM 16-bit mono 24 kHz, embrulhado em WAV aqui.
 * eleven_flash_v2_5: ~75 ms, aceita language_code "pt". eleven_multilingual_v2: mais natural, mais lento.
 */
import { createNoVoice } from "./none";
import { VoiceUnavailable, type VoiceProvider } from "./types";

export type ElevenLabsOptions = {
  /** Uma chave só (forma antiga) ou várias, em ordem: quando a cota de uma acaba, passa para a próxima. */
  apiKey?: string;
  apiKeys?: string[];
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
  const keys = [...(opts.apiKeys ?? []), ...(opts.apiKey ? [opts.apiKey] : [])].filter((k, i, all) => !!k && all.indexOf(k) === i);
  const spent = new Set<string>();
  return {
    async tts(text) {
      let lastError = "nenhuma chave configurada";
      for (const key of keys) {
        if (spent.has(key)) continue;
        let res: Response;
        try {
          res = await f(`https://api.elevenlabs.io/v1/text-to-speech/${opts.voiceId}?output_format=pcm_24000`, {
            method: "POST",
            headers: { "xi-api-key": key, "content-type": "application/json", accept: "audio/pcm" },
            body: JSON.stringify({ text, model_id: model, language_code: "pt", voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.2 } }),
            signal: AbortSignal.timeout(opts.timeoutMs ?? 15_000),
          });
        } catch (err) {
          throw new VoiceUnavailable(`ElevenLabs falhou: ${err instanceof Error ? err.message : String(err)}`);
        }
        if (res.ok) return { audio: pcmToWav(Buffer.from(await res.arrayBuffer()), 24000), mime: "audio/wav" };
        lastError = `ElevenLabs respondeu ${res.status}: ${(await res.text()).slice(0, 200)}`;
        // Cota acabou, chave recusada ou plano sem crédito: aposenta esta chave e tenta a próxima.
        if (res.status === 401 || res.status === 402 || res.status === 429) {
          spent.add(key);
          console.warn(`[voz] chave ElevenLabs ${keys.indexOf(key) + 1} sem cota ou recusada; trocando`);
          continue;
        }
        break;
      }
      throw new VoiceUnavailable(lastError);
    },
    stt: (audio, mime) => stt.stt(audio, mime),
    async health() {
      try {
        const key = keys.find((k) => !spent.has(k));
        if (!key) return false;
        const r = await f("https://api.elevenlabs.io/v1/user", { headers: { "xi-api-key": key }, signal: AbortSignal.timeout(5000) });
        return r.ok;
      } catch {
        return false;
      }
    },
  };
}

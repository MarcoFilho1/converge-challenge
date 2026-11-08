/**
 * Cliente do Voicebox (jamiepine/voicebox, REST local em 127.0.0.1:17493).
 * Conferido no código-fonte em 2026-11-07 (backend/routes/openai_compat.py e transcription.py):
 *  - TTS síncrono: POST /v1/audio/speech {model:"tts-1", input, voice:<profile id|nome>, response_format:"wav", speed} → bytes wav.
 *    (POST /generate é assíncrono: devolve uma "generation" para acompanhar por SSE; não serve para conversa.)
 *  - STT: POST /transcribe multipart {file, language?, model?} → {text, duration}.
 *  - A língua do TTS vem do perfil da voz; `language` aqui só vai para o Whisper.
 */
import { VoiceUnavailable, type VoiceProvider } from "./types";

export type VoiceboxOptions = { url: string; profileId: string; language: string; fetchImpl?: typeof fetch; ttsTimeoutMs?: number; sttTimeoutMs?: number };

export function createVoicebox(opts: VoiceboxOptions): VoiceProvider {
  const f = opts.fetchImpl ?? fetch;
  const base = opts.url.replace(/\/$/, "");
  const ttsTimeout = opts.ttsTimeoutMs ?? 20_000;
  const sttTimeout = opts.sttTimeoutMs ?? 15_000;

  async function call(path: string, init: RequestInit, timeoutMs: number): Promise<Response> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await f(`${base}${path}`, { ...init, signal: ctrl.signal });
      if (!res.ok) throw new VoiceUnavailable(`Voicebox ${path} respondeu ${res.status}: ${(await res.text()).slice(0, 200)}`);
      return res;
    } catch (err) {
      if (err instanceof VoiceUnavailable) throw err;
      throw new VoiceUnavailable(`Voicebox ${path} falhou: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    async tts(text) {
      const res = await call("/v1/audio/speech", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model: "tts-1", input: text, voice: opts.profileId, response_format: "wav", speed: 1.0 }),
      }, ttsTimeout);
      return { audio: Buffer.from(await res.arrayBuffer()), mime: "audio/wav" };
    },

    async stt(audio, mime) {
      const form = new FormData();
      form.append("file", new Blob([new Uint8Array(audio)], { type: mime }), mime.includes("wav") ? "fala.wav" : "fala.bin");
      form.append("language", opts.language);
      const started = Date.now();
      const res = await call("/transcribe", { method: "POST", body: form }, sttTimeout);
      const json = (await res.json()) as { text?: string };
      return { text: (json.text ?? "").trim(), ms: Date.now() - started };
    },

    async health() {
      try {
        const res = await f(`${base}/profiles`, { signal: AbortSignal.timeout(3000) });
        return res.ok;
      } catch {
        return false;
      }
    },
  };
}

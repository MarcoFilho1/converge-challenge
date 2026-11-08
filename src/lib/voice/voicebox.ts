/**
 * Cliente do Voicebox (jamiepine/voicebox, REST local em 127.0.0.1:17493), conferido na versão instalada 0.5.0 (OpenAPI em /openapi.json):
 *  - TTS é ASSÍNCRONO: POST /generate {profile_id, text, language, engine?} → GenerationResponse {id, status: generating|completed|failed};
 *    acompanhamos por GET /history/{id} até completed e baixamos os bytes em GET /audio/{id}.
 *    (A rota síncrona /v1/audio/speech existe só no código mais novo do repositório, não nesta versão.)
 *  - STT: POST /transcribe multipart {file, language?, model?} → {text, duration}.
 *  - Língua do perfil define a voz; `language` vai para o /generate e para o Whisper.
 */
import { VoiceUnavailable, type VoiceProvider } from "./types";

export type VoiceboxOptions = {
  url: string;
  profileId: string;
  language: string;
  /** engine do perfil (kokoro, qwen, qwen_custom_voice...). Omitido = padrão do perfil. */
  engine?: string;
  fetchImpl?: typeof fetch;
  ttsTimeoutMs?: number;
  sttTimeoutMs?: number;
  pollMs?: number;
};

type Generation = { id: string; status?: string; error?: string | null };

export function createVoicebox(opts: VoiceboxOptions): VoiceProvider {
  const f = opts.fetchImpl ?? fetch;
  const base = opts.url.replace(/\/$/, "");
  const ttsTimeout = opts.ttsTimeoutMs ?? 20_000;
  const sttTimeout = opts.sttTimeoutMs ?? 15_000;
  const pollMs = opts.pollMs ?? 200;
  const engine = opts.engine ?? process.env.VOICEBOX_ENGINE;

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

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  return {
    async tts(text) {
      const deadline = Date.now() + ttsTimeout;
      const body: Record<string, unknown> = { profile_id: opts.profileId, text, language: opts.language };
      if (engine) body.engine = engine;
      const created = (await (await call("/generate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }, ttsTimeout)).json()) as Generation;
      let status = created.status ?? "completed";
      while (status !== "completed") {
        if (status === "failed") throw new VoiceUnavailable(`Voicebox geração falhou: ${created.error ?? ""}`);
        if (Date.now() > deadline) throw new VoiceUnavailable("Voicebox: tempo esgotado gerando a fala");
        await sleep(pollMs);
        const g = (await (await call(`/history/${created.id}`, {}, 5000)).json()) as Generation;
        status = g.status ?? "completed";
        if (status === "failed") throw new VoiceUnavailable(`Voicebox geração falhou: ${g.error ?? ""}`);
      }
      const audio = await call(`/audio/${created.id}`, {}, Math.max(2000, deadline - Date.now()));
      return { audio: Buffer.from(await audio.arrayBuffer()), mime: "audio/wav" };
    },

    async stt(audio, mime) {
      const form = new FormData();
      form.append("file", new Blob([new Uint8Array(audio)], { type: mime }), mime.includes("wav") ? "fala.wav" : "fala.bin");
      form.append("language", opts.language);
      form.append("model", process.env.VOICEBOX_STT_MODEL ?? "turbo");
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

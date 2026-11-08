import { describe, expect, it } from "vitest";
import { createElevenLabs, pcmToWav } from "@/lib/voice/elevenlabs";
import { VoiceUnavailable } from "@/lib/voice/types";

const fake = (h: (url: string, init: RequestInit) => Response) => (async (u: RequestInfo | URL, i?: RequestInit) => h(String(u), i ?? {})) as typeof fetch;

describe("ElevenLabs (só a fala; a escuta continua no Whisper)", () => {
  it("chama text-to-speech com voz, modelo, pt e PCM 24 kHz, e devolve wav", async () => {
    let seen: { url: string; headers: Record<string, string>; body: Record<string, unknown> } | null = null;
    const pcm = Buffer.alloc(4800); // 0,1 s
    const el = createElevenLabs({ apiKey: "k", voiceId: "voz1", model: "eleven_flash_v2_5", fetchImpl: fake((url, init) => {
      seen = { url, headers: init.headers as Record<string, string>, body: JSON.parse(String(init.body)) };
      return new Response(pcm, { status: 200 });
    }) });
    const out = await el.tts("Desde quando é assim?");
    expect(seen!.url).toBe("https://api.elevenlabs.io/v1/text-to-speech/voz1?output_format=pcm_24000");
    expect(seen!.headers["xi-api-key"]).toBe("k");
    expect(seen!.body).toMatchObject({ text: "Desde quando é assim?", model_id: "eleven_flash_v2_5", language_code: "pt" });
    expect(out!.audio.subarray(0, 4).toString()).toBe("RIFF");
    expect(out!.audio.readUInt32LE(24)).toBe(24000);
    expect(out!.audio.length).toBe(44 + 4800);
  });

  it("erro da API (cota, chave) vira VoiceUnavailable", async () => {
    const el = createElevenLabs({ apiKey: "k", voiceId: "v", fetchImpl: fake(() => new Response('{"detail":{"status":"quota_exceeded"}}', { status: 401 })) });
    await expect(el.tts("oi")).rejects.toBeInstanceOf(VoiceUnavailable);
  });

  it("quando a cota da primeira chave acaba, fala com a segunda e não volta mais na primeira", async () => {
    const used: string[] = [];
    const el = createElevenLabs({ apiKeys: ["k1", "k2"], voiceId: "v", fetchImpl: fake((_url, init) => {
      const key = (init.headers as Record<string, string>)["xi-api-key"];
      used.push(key);
      return key === "k1"
        ? new Response('{"detail":{"status":"quota_exceeded"}}', { status: 401 })
        : new Response(Buffer.alloc(480), { status: 200 });
    }) });
    expect((await el.tts("oi"))!.audio.subarray(0, 4).toString()).toBe("RIFF");
    expect(used).toEqual(["k1", "k2"]);
    used.length = 0;
    await el.tts("de novo");
    expect(used).toEqual(["k2"]);
  });

  it("todas as chaves sem cota: VoiceUnavailable", async () => {
    const el = createElevenLabs({ apiKeys: ["k1", "k2"], voiceId: "v", fetchImpl: fake(() => new Response('{"detail":{"status":"quota_exceeded"}}', { status: 401 })) });
    await expect(el.tts("oi")).rejects.toBeInstanceOf(VoiceUnavailable);
  });

  it("delega a transcrição para o provedor de escuta", async () => {
    const el = createElevenLabs({ apiKey: "k", voiceId: "v", stt: { async tts() { return null; }, async stt() { return { text: "ouvi", ms: 1 }; }, async health() { return true; } } });
    expect((await el.stt(Buffer.alloc(10), "audio/wav")).text).toBe("ouvi");
  });

  it("pcmToWav monta cabeçalho mono 16-bit", () => {
    const w = pcmToWav(Buffer.alloc(100), 24000);
    expect(w.subarray(8, 12).toString()).toBe("WAVE");
    expect(w.readUInt16LE(22)).toBe(1);
    expect(w.readUInt16LE(34)).toBe(16);
    expect(w.readUInt32LE(40)).toBe(100);
  });
});

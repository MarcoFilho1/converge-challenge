import { describe, expect, it } from "vitest";
import { createVoicebox } from "@/lib/voice/voicebox";
import { VoiceUnavailable } from "@/lib/voice/types";

const wav = Buffer.from("RIFF....WAVEfmt ");

function fakeFetch(handler: (url: string, init: RequestInit) => Response): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => handler(String(input), init ?? {})) as typeof fetch;
}

describe("cliente Voicebox", () => {
  it("tts chama /v1/audio/speech com voz, formato wav e devolve o áudio", async () => {
    let seen: { url: string; body: unknown } | null = null;
    const vb = createVoicebox({
      url: "http://vb:1", profileId: "helena-id", language: "pt",
      fetchImpl: fakeFetch((url, init) => {
        seen = { url, body: JSON.parse(String(init.body)) };
        return new Response(wav, { status: 200, headers: { "content-type": "audio/wav" } });
      }),
    });
    const out = await vb.tts("Oi, eu sou a Helena.");
    expect(out?.mime).toBe("audio/wav");
    expect(Buffer.from(out!.audio).subarray(0, 4).toString()).toBe("RIFF");
    expect(seen!.url).toBe("http://vb:1/v1/audio/speech");
    expect(seen!.body).toMatchObject({ input: "Oi, eu sou a Helena.", voice: "helena-id", response_format: "wav" });
  });

  it("tts com erro 500 lança VoiceUnavailable", async () => {
    const vb = createVoicebox({ url: "http://vb:1", profileId: "x", language: "pt", fetchImpl: fakeFetch(() => new Response("erro", { status: 500 })) });
    await expect(vb.tts("oi")).rejects.toBeInstanceOf(VoiceUnavailable);
  });

  it("stt envia multipart com file e language e lê text", async () => {
    let form: FormData | null = null;
    const vb = createVoicebox({
      url: "http://vb:1", profileId: "x", language: "pt",
      fetchImpl: fakeFetch((url, init) => {
        expect(url).toBe("http://vb:1/transcribe");
        form = init.body as FormData;
        return new Response(JSON.stringify({ text: "cansaço há três meses", duration: 2.1 }), { status: 200, headers: { "content-type": "application/json" } });
      }),
    });
    const res = await vb.stt(wav, "audio/wav");
    expect(res.text).toBe("cansaço há três meses");
    expect(form!.get("language")).toBe("pt");
    expect(form!.get("file")).toBeInstanceOf(Blob);
  });

  it("health devolve false quando o servidor não responde", async () => {
    const vb = createVoicebox({ url: "http://vb:1", profileId: "x", language: "pt", fetchImpl: fakeFetch(() => { throw new Error("ECONNREFUSED"); }) });
    expect(await vb.health()).toBe(false);
  });
});

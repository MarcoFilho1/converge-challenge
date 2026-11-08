import { describe, expect, it } from "vitest";
import { createVoicebox } from "@/lib/voice/voicebox";
import { VoiceUnavailable } from "@/lib/voice/types";

const wav = Buffer.from("RIFF....WAVEfmt ");

function fakeFetch(handler: (url: string, init: RequestInit) => Response): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => handler(String(input), init ?? {})) as typeof fetch;
}

describe("cliente Voicebox", () => {
  it("tts cria a geração, espera completar e baixa o áudio", async () => {
    const calls: { url: string; body: unknown }[] = [];
    let polls = 0;
    const vb = createVoicebox({
      url: "http://vb:1", profileId: "helena-id", language: "pt", engine: "kokoro", pollMs: 1,
      fetchImpl: fakeFetch((url, init) => {
        calls.push({ url, body: init.body ? JSON.parse(String(init.body)) : null });
        if (url.endsWith("/generate")) return new Response(JSON.stringify({ id: "g1", status: "generating" }), { status: 200, headers: { "content-type": "application/json" } });
        if (url.endsWith("/history/g1")) return new Response(JSON.stringify({ id: "g1", status: ++polls < 2 ? "generating" : "completed" }), { status: 200, headers: { "content-type": "application/json" } });
        if (url.endsWith("/audio/g1")) return new Response(wav, { status: 200, headers: { "content-type": "audio/wav" } });
        return new Response("?", { status: 404 });
      }),
    });
    const out = await vb.tts("Oi, eu sou a Helena.");
    expect(out?.mime).toBe("audio/wav");
    expect(Buffer.from(out!.audio).subarray(0, 4).toString()).toBe("RIFF");
    expect(calls[0].url).toBe("http://vb:1/generate");
    expect(calls[0].body).toMatchObject({ profile_id: "helena-id", text: "Oi, eu sou a Helena.", language: "pt", engine: "kokoro" });
    expect(polls).toBe(2);
    expect(calls.at(-1)!.url).toBe("http://vb:1/audio/g1");
  });

  it("geração que falha lança VoiceUnavailable", async () => {
    const vb = createVoicebox({ url: "http://vb:1", profileId: "x", language: "pt", pollMs: 1, fetchImpl: fakeFetch((url) =>
      url.endsWith("/generate")
        ? new Response(JSON.stringify({ id: "g2", status: "generating" }), { status: 200 })
        : new Response(JSON.stringify({ id: "g2", status: "failed", error: "sem modelo" }), { status: 200 })) });
    await expect(vb.tts("oi")).rejects.toBeInstanceOf(VoiceUnavailable);
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

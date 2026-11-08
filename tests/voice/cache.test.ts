import { mkdtempSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { audioCachePath, getOrGenerate } from "@/lib/voice/cache";
import type { VoiceProvider } from "@/lib/voice/types";

const fake = (calls: { n: number }, audio: Buffer | null): VoiceProvider => ({
  async tts() { calls.n++; return audio ? { audio, mime: "audio/wav" } : null; },
  async stt() { return { text: "", ms: 0 }; },
  async health() { return true; },
});

describe("cache de falas", () => {
  it("caminho determinístico por chave e texto", () => {
    const root = mkdtempSync(join(tmpdir(), "voz-"));
    const a = audioCachePath("helena", "saude:base", "O que você anda sentindo?", root);
    const b = audioCachePath("helena", "saude:base", "O que você anda sentindo?", root);
    const c = audioCachePath("helena", "saude:base", "Outro texto", root);
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a.startsWith(join(root, "helena"))).toBe(true);
    expect(a.endsWith(".wav")).toBe(true);
  });

  it("segunda chamada não gera de novo", async () => {
    const root = mkdtempSync(join(tmpdir(), "voz-"));
    const calls = { n: 0 };
    const p = fake(calls, Buffer.from("RIFFxxxxWAVE"));
    const first = await getOrGenerate(p, "helena", "k", "texto", root);
    const second = await getOrGenerate(p, "helena", "k", "texto", root);
    expect(first).toBe(second);
    expect(existsSync(first!)).toBe(true);
    expect(calls.n).toBe(1);
  });

  it("provider sem voz devolve null e não grava nada", async () => {
    const root = mkdtempSync(join(tmpdir(), "voz-"));
    expect(await getOrGenerate(fake({ n: 0 }, null), "helena", "k", "texto", root)).toBeNull();
  });
});

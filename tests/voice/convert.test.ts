import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { toWav16k } from "@/lib/voice/convert";

function hasFfmpeg() {
  try { execFileSync("ffmpeg", ["-version"], { stdio: "pipe" }); return true; } catch { return false; }
}
const ok = hasFfmpeg();
const tone = (args: string[]) => execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "sine=frequency=440:duration=1", ...args, "pipe:1"], { maxBuffer: 10_000_000 });

const sampleRate = (buf: Buffer) => buf.readUInt32LE(24);

describe("conversão para wav 16 kHz", () => {
  it.skipIf(!ok)("webm/opus → wav 16k mono", async () => {
    const out = await toWav16k(tone(["-c:a", "libopus", "-f", "webm"]), "audio/webm");
    expect(out.subarray(0, 4).toString()).toBe("RIFF");
    expect(sampleRate(out)).toBe(16000);
    expect(out.readUInt16LE(22)).toBe(1);
  });
  it.skipIf(!ok)("mp4/aac → wav 16k", async () => {
    const out = await toWav16k(tone(["-c:a", "aac", "-movflags", "frag_keyframe+empty_moov", "-f", "mp4"]), "audio/mp4");
    expect(sampleRate(out)).toBe(16000);
  });
  it.skipIf(!ok)("wav já em 16k passa direto", async () => {
    const src = tone(["-ac", "1", "-ar", "16000", "-f", "wav"]);
    const out = await toWav16k(src, "audio/wav");
    expect(out.equals(src)).toBe(true);
  });
  it.skipIf(!ok)("lixo → erro", async () => {
    await expect(toWav16k(Buffer.from("isto não é áudio"), "audio/webm")).rejects.toThrow();
  });
});

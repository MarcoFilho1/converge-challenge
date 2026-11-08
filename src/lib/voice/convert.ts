import { spawn } from "node:child_process";

function isWav16kMono(buf: Buffer): boolean {
  return buf.length > 44 && buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WAVE" && buf.readUInt16LE(22) === 1 && buf.readUInt32LE(24) === 16000;
}

/** Converte qualquer áudio do navegador (webm/opus, mp4/aac, wav) para wav 16 kHz mono com ffmpeg. */
export function toWav16k(input: Buffer, mime: string, timeoutMs = 10_000): Promise<Buffer> {
  if (mime.includes("wav") && isWav16kMono(input)) return Promise.resolve(input);
  return new Promise((resolve, reject) => {
    const ff = spawn("ffmpeg", ["-hide_banner", "-loglevel", "error", "-i", "pipe:0", "-ac", "1", "-ar", "16000", "-f", "wav", "pipe:1"]);
    const out: Buffer[] = [];
    let err = "";
    const timer = setTimeout(() => { ff.kill("SIGKILL"); reject(new Error("ffmpeg: tempo esgotado")); }, timeoutMs);
    ff.stdout.on("data", (d: Buffer) => out.push(d));
    ff.stderr.on("data", (d: Buffer) => { err += d.toString(); });
    ff.on("error", (e) => { clearTimeout(timer); reject(new Error(`ffmpeg indisponível: ${e.message}`)); });
    ff.on("close", (code) => {
      clearTimeout(timer);
      const buf = Buffer.concat(out);
      if (code !== 0 || buf.length < 44) return reject(new Error(`ffmpeg falhou (${code}): ${err.slice(0, 300)}`));
      resolve(buf);
    });
    ff.stdin.on("error", () => {});
    ff.stdin.end(input);
  });
}

import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { cleanTranscript } from "@/lib/voice/transcript";
import { trimSilence } from "@/lib/voice/convert";

describe("limpeza da transcrição (Whisper em loop)", () => {
  it("corta a repetição e mantém o que veio antes", () => {
    expect(cleanTranscript("O que eu faço? " + "eu ".repeat(80))).toBe("O que eu faço?");
  });
  it("loop sem nada antes vira vazio", () => {
    expect(cleanTranscript("eu sou " + "eu ".repeat(40))).toBe("eu sou");
    expect(cleanTranscript("eu ".repeat(50))).toBe("");
  });
  it("repetição de frase também conta", () => {
    expect(cleanTranscript("Obrigado. Obrigado. Obrigado. Obrigado. Obrigado.")).toBe("");
  });
  it("fala normal fica igual, mesmo com uma palavra repetida duas vezes", () => {
    expect(cleanTranscript("É muito, muito cansativo, há uns três meses.")).toBe("É muito, muito cansativo, há uns três meses.");
  });
  it("legendas inventadas comuns do Whisper viram vazio", () => {
    expect(cleanTranscript("Legendas pela comunidade Amara.org")).toBe("");
    expect(cleanTranscript("Obrigado por assistir!")).toBe("");
  });
});

function hasFfmpeg() { try { execFileSync("ffmpeg", ["-version"], { stdio: "pipe" }); return true; } catch { return false; } }

describe("corte de silêncio antes de transcrever", () => {
  it.skipIf(!hasFfmpeg())("tira os silêncios longos", async () => {
    // 1 s de tom + 5 s de silêncio + 1 s de tom
    const wav = execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "sine=frequency=300:duration=1", "-f", "lavfi", "-i", "anullsrc=r=16000:cl=mono:d=5", "-f", "lavfi", "-i", "sine=frequency=300:duration=1",
      "-filter_complex", "[0][1][2]concat=n=3:v=0:a=1", "-ac", "1", "-ar", "16000", "-f", "wav", "pipe:1"]);
    const out = await trimSilence(wav);
    const seconds = (out.length - 44) / 32000;
    expect(seconds).toBeGreaterThan(1.5);
    expect(seconds).toBeLessThan(3.5);
  });
});

describe("looksHallucinated", () => {
  it("marca loop e legenda inventada, não fala normal", async () => {
    const { looksHallucinated } = await import("@/lib/voice/transcript");
    expect(looksHallucinated("O que eu faço? " + "eu ".repeat(30))).toBe(true);
    expect(looksHallucinated("Legendas pela comunidade Amara.org")).toBe(true);
    expect(looksHallucinated("Tô com bastante pressa aqui.")).toBe(false);
  });
});

/** Mede latência de TTS e STT do Voicebox e recomenda INTERVIEW_MODE. Uso: pnpm voz:medir */
import "./_env";
import { writeFileSync } from "node:fs";
import { getVoice } from "@/lib/voice";

const FRASES = [
  "Entendi, você falou que o cansaço é maior no fim do dia.",
  "Certo, as metas apertaram bastante no fechamento do mês.",
  "Obrigada por contar. Desde quando é assim com você?",
  "Entendi, então falta tempo e também dá receio de a empresa saber.",
  "Certo, você disse que ainda não procurou ninguém por isso.",
];
const pct = (xs: number[], p: number) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]; };

async function main() {
  const voice = getVoice();
  if (!(await voice.health())) { console.error("Voicebox não responde"); process.exit(1); }
  const tts: number[] = [], stt: number[] = [];
  for (const f of FRASES) {
    const t0 = Date.now();
    const out = await voice.tts(f);
    tts.push(Date.now() - t0);
    if (!out) continue;
    const t1 = Date.now();
    const r = await voice.stt(out.audio, "audio/wav");
    stt.push(Date.now() - t1);
    console.log(`TTS ${tts.at(-1)} ms · STT ${stt.at(-1)} ms · "${r.text}"`);
  }
  const p50t = pct(tts, 50), p95t = pct(tts, 95), p50s = pct(stt, 50), p95s = pct(stt, 95);
  const mode = p95t <= 2500 ? "live" : "cache_only";
  const md = `# Medições de voz (Voicebox)\n\nData: ${new Date().toISOString()} · perfil: ${process.env.VOICEBOX_PROFILE_ID}\n\n| Medida | p50 | p95 |\n|---|---|---|\n| TTS (frase de 8 a 15 palavras) | ${p50t} ms | ${p95t} ms |\n| STT (mesmo áudio) | ${p50s} ms | ${p95s} ms |\n\nRecomendação: INTERVIEW_MODE=${mode} (regra: live se p95 do TTS ≤ 2500 ms).\n`;
  writeFileSync("docs/medicoes-voz.md", md);
  console.log(md);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });

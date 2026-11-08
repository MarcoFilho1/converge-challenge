/** Pré-gera o áudio de todas as falas fixas do protocolo com a voz configurada. Uso: pnpm voz:pregerar */
import "./_env";
import { getVoice, getOrGenerate, voiceProfileName } from "@/lib/voice";
import { BLOCKS, CRISIS_SPEECH, DECLINE_SPEECH, DEFAULT_PRAZO, REPEAT_PREFIX, URGENCY_SPEECH, renderText } from "@/lib/interview/protocol";
import type { BlockId } from "@/lib/interview/types";

async function main() {
  const voice = getVoice();
  if (!(await voice.health())) { console.error("Voicebox não responde; confira VOICE_PROVIDER, VOICEBOX_URL e VOICEBOX_PROFILE_ID"); process.exit(1); }
  const profile = voiceProfileName();
  const vars = { medico: process.env.DOCTOR_NAME ?? "Dra. Ana Lima", prazo: DEFAULT_PRAZO };
  const items: { key: string; text: string }[] = [];
  for (const b of Object.values(BLOCKS)) {
    const id = b.id as BlockId;
    items.push({ key: `${id}:base`, text: renderText(b.base, vars) });
    for (const p of b.probes) {
      items.push({ key: `${id}:${p.id}`, text: p.text });
      items.push({ key: `${id}:repeat:${p.id}`, text: REPEAT_PREFIX + p.text });
    }
    items.push({ key: `${id}:repeat:base`, text: REPEAT_PREFIX + renderText(b.base, vars) });
  }
  items.push({ key: "crise:base", text: CRISIS_SPEECH(vars.medico) });
  items.push({ key: "abertura:urgencia", text: URGENCY_SPEECH(vars.medico) });
  items.push({ key: "abertura:recusa", text: DECLINE_SPEECH });

  let generated = 0, cached = 0;
  const { existsSync } = await import("node:fs");
  const { audioCachePath } = await import("@/lib/voice");
  for (const it of items) {
    const path = audioCachePath(profile, it.key, it.text);
    const had = existsSync(path);
    const t0 = Date.now();
    const out = await getOrGenerate(voice, profile, it.key, it.text);
    if (!out) { console.error(`sem áudio para ${it.key}`); continue; }
    if (had) cached++; else { generated++; console.log(`${it.key} · ${Date.now() - t0} ms`); }
  }
  console.log(`\n${generated} geradas, ${cached} já em cache, ${items.length} falas no total (perfil ${profile})`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });

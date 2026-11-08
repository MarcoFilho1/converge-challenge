/** Mostra a cota da ElevenLabs agora. Uso: pnpm voz:cota */
import "./_env";

(async () => {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) { console.error("ELEVENLABS_API_KEY não está no .env"); process.exit(1); }
  const r = await fetch("https://api.elevenlabs.io/v1/user/subscription", { headers: { "xi-api-key": key } });
  if (!r.ok) { console.error("ElevenLabs respondeu", r.status); process.exit(1); }
  const d = (await r.json()) as { character_count: number; character_limit: number; next_character_count_reset_unix: number };
  const left = d.character_limit - d.character_count;
  const reset = new Date(d.next_character_count_reset_unix * 1000).toLocaleDateString("pt-BR");
  console.log(`Usados ${d.character_count} de ${d.character_limit} créditos. Restam ${left}.`);
  console.log(`Dá para uns ${Math.floor(left / 22)} reações geradas na hora (~22 créditos cada). Renova em ${reset}.`);
})();

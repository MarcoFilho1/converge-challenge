/** Mostra a cota de cada chave da ElevenLabs agora. Uso: pnpm voz:cota */
import "./_env";
import { elevenLabsKeys } from "../src/lib/voice";

(async () => {
  const keys = elevenLabsKeys();
  if (keys.length === 0) { console.error("Nenhuma ELEVENLABS_API_KEY no .env"); process.exit(1); }
  let total = 0;
  for (const [i, key] of keys.entries()) {
    const r = await fetch("https://api.elevenlabs.io/v1/user/subscription", { headers: { "xi-api-key": key } });
    if (!r.ok) { console.log(`Chave ${i + 1}: ${r.status === 401 ? "não deixa ler a cota (chave com permissão restrita; a fala pode funcionar)" : `ElevenLabs respondeu ${r.status}`}`); continue; }
    const d = (await r.json()) as { character_count: number; character_limit: number; next_character_count_reset_unix: number };
    const left = d.character_limit - d.character_count;
    total += left;
    const reset = new Date(d.next_character_count_reset_unix * 1000).toLocaleDateString("pt-BR");
    console.log(`Chave ${i + 1}: usados ${d.character_count} de ${d.character_limit} créditos. Restam ${left}. Renova em ${reset}.`);
  }
  console.log(`Somando as chaves: ${total} créditos, uns ${Math.floor(total / 22)} reações geradas na hora (~22 créditos cada).`);
})();

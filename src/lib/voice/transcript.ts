/**
 * Limpeza da transcrição do Whisper. Em silêncio ou ruído ele entra em loop ("eu eu eu eu…")
 * ou inventa legendas de vídeo. Corta o loop inteiro (não é fala da pessoa) e devolve o que veio antes.
 */
const norm = (w: string) => w.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

const KNOWN_HALLUCINATIONS = [
  /legendas? (pela|por) (a )?comunidade/i,
  /amara\.org/i,
  /obrigad[oa] por assistir/i,
  /inscreva-se no canal/i,
  /legenda(s)? adriana zanotto/i,
];

/** Primeira posição onde um n-grama (1 a 4 palavras) se repete em sequência; -1 se não houver loop. */
function loopStart(words: string[]): number {
  const keys = words.map(norm);
  for (let i = 0; i < keys.length; i++) {
    for (let n = 1; n <= 4; n++) {
      const min = 3;
      if (i + n * min > keys.length) continue;
      const gram = keys.slice(i, i + n).join(" ");
      if (!gram.trim()) continue;
      let reps = 1;
      while (keys.slice(i + reps * n, i + (reps + 1) * n).join(" ") === gram) reps++;
      if (reps >= min) return i;
    }
  }
  return -1;
}

/** Respostas curtas que a pessoa costuma repetir ("Não. Não. Não."): não é loop do Whisper. */
const SHORT_ANSWERS = new Set(["nao", "sim", "nunca", "nada", "talvez", "tive", "tenho"]);

/** A transcrição inteira é a mesma resposta curta dita de 2 a 6 vezes? Devolve a primeira, senão null. */
function repeatedShortAnswer(words: string[]): string | null {
  if (words.length < 2 || words.length > 6) return null;
  const keys = words.map(norm);
  return SHORT_ANSWERS.has(keys[0]) && keys.every((k) => k === keys[0]) ? words[0] : null;
}

export function cleanTranscript(text: string): string {
  const t = text.trim();
  if (KNOWN_HALLUCINATIONS.some((re) => re.test(t))) return "";
  const words = t.split(/\s+/).filter(Boolean);
  const short = repeatedShortAnswer(words);
  if (short) return short;
  const at = loopStart(words);
  const kept = (at >= 0 ? words.slice(0, at) : words).join(" ").trim();
  return kept.replace(/\p{L}/gu, "").length === kept.length ? "" : kept;
}

/** true quando o Whisper entrou em loop ou inventou legenda (vale tentar de novo sem os silêncios). */
export function looksHallucinated(text: string): boolean {
  const t = text.trim();
  if (repeatedShortAnswer(t.split(/\s+/).filter(Boolean))) return false;
  return KNOWN_HALLUCINATIONS.some((re) => re.test(t)) || loopStart(t.split(/\s+/).filter(Boolean)) >= 0;
}

/** Divide texto em trechos de até `size` caracteres, com sobreposição, cortando em fim de frase quando possível. */
export function chunkText(raw: string, opts: { size?: number; overlap?: number } = {}): string[] {
  const size = opts.size ?? 1800;
  const overlap = opts.overlap ?? 200;
  const text = raw.replace(/\s+/g, " ").trim();
  if (!text) return [];
  if (text.length <= size) return [text];

  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + size, text.length);
    if (end < text.length) {
      const window = text.slice(start, end);
      const lastStop = Math.max(window.lastIndexOf(". "), window.lastIndexOf("? "), window.lastIndexOf("! "));
      if (lastStop > size * 0.5) end = start + lastStop + 1;
    }
    chunks.push(text.slice(start, end).trim());
    if (end >= text.length) break;
    let next = end - overlap;
    while (next > start && text[next - 1] !== " ") next--;
    start = next > start ? next : end;
  }
  return chunks;
}

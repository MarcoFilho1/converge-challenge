import { readFile } from "node:fs/promises";
import { PDFParse } from "pdf-parse";

export type ExtractedPage = { page: number; text: string };

const collapse = (t: string) => t.replace(/\s+/g, " ").trim();

/** Ficha em Markdown: uma "página" por seção de nível 2, começando pelo título da seção (cita a parte exata). */
export function splitMarkdownSections(md: string): ExtractedPage[] {
  const [intro, ...sections] = md.split(/^## /m);
  const pages: ExtractedPage[] = [];
  const introText = collapse(intro.replace(/^# /m, ""));
  if (introText) pages.push({ page: 1, text: introText });
  for (const section of sections) {
    const [heading, ...rest] = section.split("\n");
    const body = collapse(rest.join("\n"));
    pages.push({ page: pages.length + 1, text: body ? `${collapse(heading)}: ${body}` : collapse(heading) });
  }
  return pages;
}

/** Texto por página. PDF via pdf-parse; Markdown por seção; texto puro numa página só. */
export async function extractText(path: string): Promise<{ pages: ExtractedPage[] }> {
  const data = await readFile(path);
  const lower = path.toLowerCase();
  if (lower.endsWith(".md")) return { pages: splitMarkdownSections(data.toString("utf8")) };
  if (!lower.endsWith(".pdf")) return { pages: [{ page: 1, text: data.toString("utf8") }] };
  const parser = new PDFParse({ data });
  try {
    const result = await parser.getText();
    return { pages: result.pages.map((p) => ({ page: p.num, text: p.text })) };
  } finally {
    await parser.destroy();
  }
}

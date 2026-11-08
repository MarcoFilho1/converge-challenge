import { toE164 } from "@/lib/whatsapp/phone";

export interface ParsedContactRow {
  name: string;
  phone: string;
  sector: string;
  role: string;
}

export interface CsvParseError {
  line: number;
  reason: string;
}

export function parseContactsCsv(text: string): {
  ok: ParsedContactRow[];
  errors: CsvParseError[];
} {
  const rawLines = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n");

  const ok: ParsedContactRow[] = [];
  const errors: CsvParseError[] = [];

  for (let i = 0; i < rawLines.length; i++) {
    const lineNum = i + 1;
    const raw = rawLines[i]?.trim() ?? "";
    if (!raw) continue;

    const sep = raw.includes(";") && !raw.includes(",") ? ";" : raw.split(";").length >= 3 ? ";" : ",";
    const cols = raw.split(sep).map((c) => c.trim().replace(/^"|"$/g, ""));

    if (
      i === 0 &&
      (cols[0]?.toLowerCase() === "nome" ||
        cols[0]?.toLowerCase() === "name" ||
        cols[1]?.toLowerCase().includes("telefone"))
    ) {
      continue;
    }

    const [name = "", rawPhone = "", sector = "Geral", role = "Colaborador"] = cols;
    if (!name) {
      errors.push({ line: lineNum, reason: "Nome ausente" });
      continue;
    }

    const phone = toE164(rawPhone);
    if (!phone) {
      errors.push({ line: lineNum, reason: `Telefone inválido: "${rawPhone}"` });
      continue;
    }

    ok.push({
      name,
      phone,
      sector: sector || "Geral",
      role: role || "Colaborador",
    });
  }

  return { ok, errors };
}

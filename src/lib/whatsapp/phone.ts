/** Normaliza telefone brasileiro para E.164 sem "+" (ex.: 5581999990000). Devolve null se inválido. */
export function toE164(raw: string): string | null {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) return digits;
  digits = digits.replace(/^0+/, "");
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return null;
}

/** "5581999990000:12@s.whatsapp.net" → "5581999990000". */
export function jidToPhone(jid: string): string {
  return jid.split("@")[0].split(":")[0];
}

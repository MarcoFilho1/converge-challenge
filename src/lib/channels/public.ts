/** Formato público do estado dos canais (rota /api/canais, página /entrar e faixa do painel). */
export type PublicChannels = {
  whatsapp: { online: boolean; link: string | null; simulatedDown: boolean };
  telegram: { online: boolean; link: string | null; username: string | null };
  checkedAt: string;
};

/** Qual canal a página de entrada oferece como principal. */
export function primaryChannel(c: PublicChannels): "whatsapp" | "telegram" | "none" {
  if (c.whatsapp.online && c.whatsapp.link) return "whatsapp";
  if (c.telegram.online && c.telegram.link) return "telegram";
  return "none";
}

/** Endereço público do site (o mesmo dos links da entrevista), para os QR codes. */
export function publicBaseUrl(): string {
  return (process.env.PUBLIC_APP_URL || process.env.INTERVIEW_PUBLIC_URL || "http://localhost:3100").replace(/\/$/, "");
}

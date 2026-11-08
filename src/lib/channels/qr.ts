import QRCode from "qrcode";

/** QR code em SVG (gerado no servidor), na cor do texto do produto. */
export async function qrSvg(url: string): Promise<string> {
  return QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#24363B", light: "#FFFFFF" } });
}

export const telegramDirectUrl = () => {
  const username = process.env.TELEGRAM_BOT_USERNAME?.replace(/^@/, "") || "PraeveniusBot";
  return `https://t.me/${username}?start=entrar`;
};

/** QR da página de entrada (/entrar) no endereço público, para o roteiro da demo. */
export async function entryQrSvg(): Promise<string> {
  const { publicBaseUrl } = await import("./public");
  return qrSvg(`${publicBaseUrl()}/entrar`);
}

import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Consultório NR-7 · PCMSO & Triagem Ocupacional",
  description:
    "Acompanhamento médico ocupacional (NR-7 / PCMSO) por questionários validados no WhatsApp e entrevista estruturada por voz, com rastreabilidade documental.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${plexSans.variable} ${plexMono.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-[var(--bg)] text-[var(--ink)]">{children}</body>
    </html>
  );
}

import type { Metadata } from 'next';
import { IBM_Plex_Sans } from 'next/font/google';

const font = IBM_Plex_Sans({ variable: '--font-plex-sans', subsets: ['latin'], weight: ['400', '500', '600'], display: 'swap' });

export const metadata: Metadata = {
  title: 'Praevenius · Bem-estar no trabalho',
  description: 'Escuta individual e acompanhamento preventivo do bem-estar no trabalho.',
  icons: { icon: [{ url: '/brand/praevenius-mark.png', type: 'image/png' }] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR" className={font.variable}><body>{children}</body></html>;
}

import type { Metadata, Viewport } from 'next';
import './globals.css';

const site = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: 'Seja um Franqueado | Jolô Gelato',
  description:
    'Conheça a franquia Jolô Gelato, a trajetória da marca, o modelo de negócio e fale diretamente com o dono.',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    url: site,
    siteName: 'Jolô Gelato Franquias',
    title: 'Seja um Franqueado | Jolô Gelato',
    description:
      'Conheça a franquia Jolô Gelato, a trajetória da marca, o modelo de negócio e fale diretamente com o dono.',
    images: [{ url: '/assets/hero-fachada.jpg', width: 1088, height: 1445, alt: 'Loja Jolô Gelato' }],
  },
  robots: { index: true, follow: true },
  icons: { icon: '/assets/logo-jolo.png' },
};

export const viewport: Viewport = {
  themeColor: '#304A2A',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}

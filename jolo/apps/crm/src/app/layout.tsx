import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CRM Jolô',
  description: 'CRM de expansão de franquias da Jolô Gelato.',
  robots: { index: false, follow: false },
  icons: {
    icon: '/icones/favicon-32.png',
    apple: '/icones/apple-touch-icon.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}

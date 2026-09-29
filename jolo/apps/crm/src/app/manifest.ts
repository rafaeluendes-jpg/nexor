import type { MetadataRoute } from 'next';

/** O que o celular/computador usa ao instalar o CRM como aplicativo. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'CRM Jolô',
    short_name: 'CRM Jolô',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#334828',
    theme_color: '#334828',
    icons: [
      { src: '/icones/icone-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icones/icone-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icones/icone-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}

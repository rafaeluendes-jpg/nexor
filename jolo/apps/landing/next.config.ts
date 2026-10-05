import type { NextConfig } from 'next';

const api = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333';
// Na politica de seguranca vai a ORIGEM da API: endereco com caminho sem
// barra no fim (".../api") so libera aquele caminho exato, e o registro do
// clique em ".../api/attribution/click" era barrado no navegador.
const apiOrigem = new URL(api).origin;

// Enderecos dos pixels: so entram na politica de seguranca se o pixel existir.
const meta = Boolean(process.env.NEXT_PUBLIC_META_PIXEL_ID);
const google = Boolean(process.env.NEXT_PUBLIC_GA4_ID || process.env.NEXT_PUBLIC_GOOGLE_ADS_ID);
const fora = (lista: Array<[boolean, string]>) => lista.filter(([ligado]) => ligado).map(([, h]) => ` ${h}`).join('');
const scriptsFora = fora([
  [meta, 'https://connect.facebook.net'],
  [google, 'https://www.googletagmanager.com'],
]);
const conexoesFora = fora([
  [meta, 'https://www.facebook.com https://connect.facebook.net'],
  [google, 'https://www.googletagmanager.com https://*.google-analytics.com https://*.analytics.google.com https://*.g.doubleclick.net https://www.google.com https://googleads.g.doubleclick.net'],
]);
const imagensFora = fora([
  [meta, 'https://www.facebook.com'],
  [google, 'https://www.googletagmanager.com https://*.google-analytics.com https://*.g.doubleclick.net https://www.google.com https://www.google.com.br https://googleads.g.doubleclick.net'],
]);
const quadrosFora = fora([[google, 'https://td.doubleclick.net https://www.googletagmanager.com']]);

/**
 * A landing e publica e precisa ser rapida. Sem CRM, sem SDK pesado,
 * so HTML, CSS e um script pequeno.
 */
const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Nao gerar AGENTS.md/CLAUDE.md dentro da app.
  agentRules: false,
  // Permite uma segunda compilacao (a dos testes, com numero ficticio)
  // conviver com a de producao sem sobrescreve-la.
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  // Pacotes internos do monorepo sao compilados junto com a app.
  transpilePackages: ['@jolo/config', '@jolo/attribution', '@jolo/shared'],
  reactStrictMode: true,
  compress: true,
  async headers() {
    const csp = [
      "default-src 'self'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "form-action 'self'",
      `img-src 'self' data: blob:${imagensFora}`,
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self' data:",
      `script-src 'self' 'unsafe-inline'${scriptsFora}`,
      `connect-src 'self' ${apiOrigem}${conexoesFora}`,
      ...(quadrosFora ? [`frame-src${quadrosFora}`] : []),
    ].join('; ');
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'geolocation=(), microphone=(), camera=(), payment=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
        ],
      },
      {
        source: '/assets/(.*)',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ];
  },
};

export default nextConfig;

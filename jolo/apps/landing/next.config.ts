import type { NextConfig } from 'next';

const api = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333';

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
      "img-src 'self' data: blob:",
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self' data:",
      "script-src 'self' 'unsafe-inline'",
      `connect-src 'self' ${api}`,
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

/** Cabecalhos de seguranca aplicados na API e nos frontends (item 41). */
export function securityHeaders(opts: { connectSrc: string[]; imgSrc?: string[] }): Record<string, string> {
  const connect = ["'self'", ...opts.connectSrc].join(' ');
  const img = ["'self'", 'data:', 'blob:', ...(opts.imgSrc ?? [])].join(' ');
  const csp = [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "form-action 'self'",
    `img-src ${img}`,
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    "script-src 'self'",
    `connect-src ${connect}`,
  ].join('; ');

  return {
    'Content-Security-Policy': csp,
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=(), payment=()',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Cross-Origin-Opener-Policy': 'same-origin',
  };
}

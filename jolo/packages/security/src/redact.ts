const SENSIVEIS = [
  'password',
  'senha',
  'token',
  'access_token',
  'authorization',
  'secret',
  'app_secret',
  'service_role',
  'apikey',
  'api_key',
  'jwt',
  'cookie',
];

/** Remove segredo de log e de resposta. Nada de token em arquivo de log. */
export function redact<T>(value: T): T {
  if (Array.isArray(value)) return value.map((v) => redact(v)) as unknown as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSIVEIS.some((s) => k.toLowerCase().includes(s)) ? '[REDACTED]' : redact(v);
    }
    return out as unknown as T;
  }
  return value;
}

/** Hash de IP para analitica sem guardar o IP em claro. */
export async function hashIp(ip: string, salt: string): Promise<string> {
  const { createHash } = await import('node:crypto');
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 32);
}

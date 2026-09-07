import { z } from 'zod';

/**
 * Chave de assinatura usada so em desenvolvimento. Ela esta no
 * repositorio de proposito, para o ambiente local subir sem configuracao —
 * e por isso mesmo e recusada em producao (ver loadServerEnv).
 */
export const JWT_SECRET_DE_DESENVOLVIMENTO = 'dev-only-secret-nao-usar-em-producao-0123456789';

const bool = z
  .union([z.boolean(), z.string()])
  .transform((v) => (typeof v === 'boolean' ? v : ['1', 'true', 'yes'].includes(v.toLowerCase())));

/**
 * Contrato de ambiente do backend. Falha rapido no arranque:
 * e melhor a API nao subir do que subir sem saber falar com a Meta.
 */
export const serverEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(3333),
  API_PUBLIC_URL: z.string().url().default('http://localhost:3333'),
  LANDING_PUBLIC_URL: z.string().url().default('http://localhost:3000'),
  CRM_PUBLIC_URL: z.string().url().default('http://localhost:3001'),
  CORS_ALLOWED_ORIGINS: z.string().default('http://localhost:3000,http://localhost:3001'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL e obrigatoria'),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  AUTH_PROVIDER: z.enum(['local', 'supabase']).default('local'),
  JWT_SECRET: z.string().min(16).default(JWT_SECRET_DE_DESENVOLVIMENTO),
  JWT_EXPIRES_IN: z.string().default('8h'),
  SUPABASE_URL: z.string().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_JWT_SECRET: z.string().optional(),

  META_APP_ID: z.string().optional(),
  META_APP_SECRET: z.string().optional(),
  META_WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  META_WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  META_WHATSAPP_BUSINESS_ACCOUNT_ID: z.string().optional(),
  META_WEBHOOK_VERIFY_TOKEN: z.string().optional(),
  META_GRAPH_VERSION: z.string().default('v21.0'),

  AI_PROVIDER: z.enum(['disabled', 'openai']).default('disabled'),
  AI_MODEL: z.string().default('gpt-4.1-mini'),
  OPENAI_API_KEY: z.string().optional(),
  AI_MAX_TOKENS: z.coerce.number().int().positive().default(800),

  STORAGE_PROVIDER: z.enum(['local', 'supabase']).default('local'),
  STORAGE_LOCAL_DIR: z.string().default('./var/storage'),
  EXCEL_EXPORT_PATH: z.string().default('./var/storage/exports'),
  SUPABASE_STORAGE_BUCKET: z.string().default('jolo-crm'),

  LOG_LEVEL: z.string().default('info'),
  SENTRY_DSN: z.string().optional(),
  TRUST_PROXY: bool.default(false),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | null = null;

export function loadServerEnv(source: NodeJS.ProcessEnv = process.env): ServerEnv {
  if (cached) return cached;
  const parsed = serverEnvSchema.safeParse(source);
  if (!parsed.success) {
    const detalhe = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Ambiente invalido. ${detalhe}. Consulte .env.example.`);
  }
  const env = parsed.data;

  // Em producao, nada de atalho de desenvolvimento.
  if (env.NODE_ENV === 'production') {
    const faltando: string[] = [];
    if (env.AUTH_PROVIDER !== 'supabase') faltando.push('AUTH_PROVIDER deve ser "supabase"');
    // a chave de desenvolvimento e publica: quem a conhece assina qualquer sessao
    if (env.JWT_SECRET === JWT_SECRET_DE_DESENVOLVIMENTO)
      faltando.push('JWT_SECRET proprio (o valor de desenvolvimento e publico)');
    if (!env.SUPABASE_URL) faltando.push('SUPABASE_URL');
    if (!env.SUPABASE_SERVICE_ROLE_KEY) faltando.push('SUPABASE_SERVICE_ROLE_KEY');
    if (!env.META_APP_SECRET) faltando.push('META_APP_SECRET');
    if (!env.META_WHATSAPP_ACCESS_TOKEN) faltando.push('META_WHATSAPP_ACCESS_TOKEN');
    if (!env.META_WHATSAPP_PHONE_NUMBER_ID) faltando.push('META_WHATSAPP_PHONE_NUMBER_ID');
    if (!env.META_WEBHOOK_VERIFY_TOKEN) faltando.push('META_WEBHOOK_VERIFY_TOKEN');
    if (faltando.length) {
      throw new Error(`Producao exige: ${faltando.join(', ')}. Veja docs/DEPLOYMENT.md.`);
    }
  }
  cached = env;
  return env;
}

export function resetServerEnvCache(): void {
  cached = null;
}

/** Diz se a integracao ja tem credencial. Usado para nao quebrar o dev sem Meta. */
export function whatsappConfigured(env: ServerEnv): boolean {
  return Boolean(env.META_APP_SECRET && env.META_WHATSAPP_ACCESS_TOKEN && env.META_WHATSAPP_PHONE_NUMBER_ID);
}

export function aiConfigured(env: ServerEnv): boolean {
  return env.AI_PROVIDER === 'openai' && Boolean(env.OPENAI_API_KEY);
}

export function corsOrigins(env: ServerEnv): string[] {
  return env.CORS_ALLOWED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean);
}

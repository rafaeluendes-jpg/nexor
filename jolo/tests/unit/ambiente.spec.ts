import { describe, expect, it } from 'vitest';
import { JWT_SECRET_DE_DESENVOLVIMENTO, loadServerEnv, resetServerEnvCache } from '@jolo/config/server';

const BASE = {
  DATABASE_URL: 'postgresql://u:s@localhost:5432/base',
};

const PRODUCAO_COMPLETA = {
  ...BASE,
  NODE_ENV: 'production',
  AUTH_PROVIDER: 'supabase',
  SUPABASE_URL: 'https://projeto.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'chave-de-servico',
  META_APP_SECRET: 'segredo-do-app',
  META_WHATSAPP_ACCESS_TOKEN: 'token',
  META_WHATSAPP_PHONE_NUMBER_ID: '999',
  META_WEBHOOK_VERIFY_TOKEN: 'token-de-verificacao',
  JWT_SECRET: 'chave-propria-longa-o-suficiente',
};

function carregar(env: Record<string, string>) {
  resetServerEnvCache();
  return loadServerEnv(env as NodeJS.ProcessEnv);
}

describe('contrato de ambiente', () => {
  it('desenvolvimento sobe sem credencial nenhuma', () => {
    const env = carregar(BASE);
    expect(env.NODE_ENV).toBe('development');
    expect(env.AI_PROVIDER, 'IA desligada por padrao').toBe('disabled');
  });

  it('nao sobe sem banco', () => {
    expect(() => carregar({})).toThrow(/DATABASE_URL/);
  });

  it('producao exige as credenciais da Meta e do Supabase', () => {
    expect(() => carregar({ ...BASE, NODE_ENV: 'production' })).toThrow(/Producao exige/);
  });

  it('producao recusa a chave de assinatura de desenvolvimento', () => {
    expect(() =>
      carregar({ ...PRODUCAO_COMPLETA, JWT_SECRET: JWT_SECRET_DE_DESENVOLVIMENTO }),
    ).toThrow(/JWT_SECRET/);
  });

  it('producao completa sobe', () => {
    const env = carregar(PRODUCAO_COMPLETA);
    expect(env.NODE_ENV).toBe('production');
    expect(env.JWT_SECRET).not.toBe(JWT_SECRET_DE_DESENVOLVIMENTO);
  });

  it('so as origens listadas podem chamar a API', () => {
    const env = carregar({ ...BASE, CORS_ALLOWED_ORIGINS: 'https://a.com, https://b.com' });
    expect(env.CORS_ALLOWED_ORIGINS.split(',').map((s) => s.trim())).toEqual(['https://a.com', 'https://b.com']);
  });
});

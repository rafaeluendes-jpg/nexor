import { request } from '@playwright/test';
import { URLS } from '../../playwright.config';
import { limparLimite } from './redis';

/**
 * Antes da bateria: o administrador de teste aceita o termo de uso vigente
 * (LGPD). Sem isso a API recusa tudo com TERMO_PENDENTE - que e justamente
 * o comportamento certo, provado a parte em termo.spec.ts.
 */
export default async function preparar(): Promise<void> {
  const api = await request.newContext();
  try {
    await limparLimite('login');
    const login = await api.post(`${URLS.api}/auth/login`, {
      data: {
        email: process.env.SEED_ADMIN_EMAIL ?? 'admin@jologelato.com.br',
        password: process.env.SEED_ADMIN_PASSWORD ?? 'Jolo@Gelato#2026',
      },
    });
    if (!login.ok()) throw new Error(`login do administrador de teste falhou: ${login.status()}`);
    const auth = { Authorization: `Bearer ${(await login.json()).accessToken as string}` };
    const termo = (await (await api.get(`${URLS.api}/termos/atual`, { headers: auth })).json()) as { versao: string };
    const aceite = await api.post(`${URLS.api}/termos/aceitar`, { headers: auth, data: { versao: termo.versao } });
    if (!aceite.ok()) throw new Error(`aceite do termo falhou: ${aceite.status()}`);
  } finally {
    await api.dispose();
    await limparLimite('login');
  }
}

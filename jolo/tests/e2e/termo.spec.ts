import { randomUUID } from 'node:crypto';
import { expect, test, type APIRequestContext } from '@playwright/test';
import { URLS } from '../playwright.config';
import { limparLimite } from './apoio/redis';

/**
 * LGPD: quem ainda nao aceitou o termo de uso vigente nao ve dado nenhum.
 * A API recusa (nao so a tela esconde), o aceite fica registrado, e a tela
 * leva a pessoa direto para o termo depois do login.
 */

const ADMIN = {
  email: process.env.SEED_ADMIN_EMAIL ?? 'admin@jologelato.com.br',
  senha: process.env.SEED_ADMIN_PASSWORD ?? 'Jolo@Gelato#2026',
};

function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

async function entrar(api: APIRequestContext, email: string, password: string): Promise<string> {
  const r = await api.post(`${URLS.api}/auth/login`, { data: { email, password } });
  expect(r.status()).toBe(200);
  return (await r.json()).accessToken as string;
}

async function contaNova(api: APIRequestContext): Promise<{ email: string; senha: string }> {
  const admin = await entrar(api, ADMIN.email, ADMIN.senha);
  const email = `termo-${randomUUID().slice(0, 8)}@jolo.teste`;
  const senha = `Teste@${randomUUID().slice(0, 10)}`;
  const r = await api.post(`${URLS.api}/users`, {
    headers: auth(admin),
    data: { nome: 'Pessoa Nova', email, papel: 'VISUALIZACAO', senhaProvisoria: senha },
  });
  expect(r.status()).toBeLessThan(400);
  return { email, senha };
}

test.beforeEach(async () => {
  await limparLimite('login');
});

test('sem aceitar o termo, a API nao entrega dado nenhum', async ({ request }) => {
  const { email, senha } = await contaNova(request);
  const token = await entrar(request, email, senha);

  // login funciona e diz que falta o termo
  const eu = await request.get(`${URLS.api}/auth/me`, { headers: auth(token) });
  expect(eu.status()).toBe(200);
  expect((await eu.json()).termoPendente).toBe(true);

  // qualquer dado: recusado, com o motivo certo e sem vazar nada
  for (const rota of ['/leads', '/conversations', '/contacts', '/dashboard']) {
    const r = await request.get(`${URLS.api}${rota}`, { headers: auth(token), failOnStatusCode: false });
    expect(r.status(), `${rota} sem termo`).toBe(428);
    const corpo = await r.json();
    expect(corpo.error).toBe('TERMO_PENDENTE');
    expect(JSON.stringify(corpo)).not.toMatch(/leads|phone|telefone/i);
  }

  // o termo em si pode ser lido
  const termo = await request.get(`${URLS.api}/termos/atual`, { headers: auth(token) });
  expect(termo.status()).toBe(200);
  const t = (await termo.json()) as { versao: string; paragrafos: string[]; aceitoEm: string | null };
  expect(t.paragrafos.length).toBeGreaterThan(3);
  expect(t.aceitoEm).toBeNull();

  // aceitar uma versao que nao e a vigente nao vale
  const velho = await request.post(`${URLS.api}/termos/aceitar`, {
    headers: auth(token),
    data: { versao: '2000-01-01' },
    failOnStatusCode: false,
  });
  expect(velho.status()).toBe(409);
  expect((await request.get(`${URLS.api}/leads`, { headers: auth(token), failOnStatusCode: false })).status()).toBe(428);

  // aceitou a vigente: libera na hora
  const aceite = await request.post(`${URLS.api}/termos/aceitar`, { headers: auth(token), data: { versao: t.versao } });
  expect(aceite.status()).toBe(200);
  expect((await request.get(`${URLS.api}/leads`, { headers: auth(token) })).status()).toBe(200);
  expect((await (await request.get(`${URLS.api}/auth/me`, { headers: auth(token) })).json()).termoPendente).toBe(false);

  // aceitar de novo nao muda a data do primeiro aceite: ela e a prova
  const primeira = (await aceite.json()).aceitoEm;
  const segunda = await request.post(`${URLS.api}/termos/aceitar`, { headers: auth(token), data: { versao: t.versao } });
  expect((await segunda.json()).aceitoEm).toBe(primeira);
});

test('pela tela: depois do login, o termo vem antes de tudo', async ({ page, request }) => {
  const { email, senha } = await contaNova(request);
  await limparLimite('login');

  const erros: string[] = [];
  page.on('pageerror', (e) => erros.push(e.message));

  await page.goto(`${URLS.crm}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(senha);
  await page.getByRole('button', { name: /entrar/i }).click();

  await page.waitForURL(/\/termo/, { timeout: 15_000 });
  await expect(page.getByRole('heading', { name: /termo de uso/i })).toBeVisible();
  await expect(page.getByText(/Lei Geral de Proteção de Dados/)).toBeVisible();

  const botao = page.getByRole('button', { name: /aceitar e entrar/i });
  await expect(botao, 'so libera depois de marcar que leu').toBeDisabled();

  // tentar pular direto para o painel volta para o termo
  await page.goto(`${URLS.crm}/leads`, { waitUntil: 'domcontentloaded' });
  await page.waitForURL(/\/termo/, { timeout: 15_000 });

  await page.getByLabel(/li e aceito/i).check();
  await expect(botao).toBeEnabled();
  await page.screenshot({ path: 'var/provas/termo-de-uso.png', fullPage: true });
  await botao.click();

  await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
  expect(erros, 'sem erro na pagina').toHaveLength(0);
});

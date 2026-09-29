import { randomUUID } from 'node:crypto';
import { expect, test, type APIRequestContext } from '@playwright/test';
import { URLS } from '../playwright.config';
import { limparLimite } from './apoio/redis';

/**
 * Link de acesso de uso unico: o gestor gera, a pessoa cria a propria
 * senha, o link morre. A senha nunca passa por conversa nenhuma.
 */

const ADMIN = {
  email: process.env.SEED_ADMIN_EMAIL ?? 'admin@jologelato.com.br',
  senha: process.env.SEED_ADMIN_PASSWORD ?? 'Jolo@Gelato#2026',
};

function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

async function entrar(api: APIRequestContext, email: string, password: string) {
  const r = await api.post(`${URLS.api}/auth/login`, { data: { email, password }, failOnStatusCode: false });
  return { status: r.status(), token: r.ok() ? ((await r.json()).accessToken as string) : null };
}

async function contaComLink(api: APIRequestContext): Promise<{ email: string; id: string; link: string; admin: string }> {
  const admin = (await entrar(api, ADMIN.email, ADMIN.senha)).token!;
  const email = `acesso-${randomUUID().slice(0, 8)}@jolo.teste`;
  const criado = await api.post(`${URLS.api}/users`, {
    headers: auth(admin),
    data: { nome: 'Socio Teste', email, papel: 'VISUALIZACAO', senhaProvisoria: `Arranque#${randomUUID()}` },
  });
  expect(criado.status()).toBeLessThan(400);
  const { id } = (await criado.json()) as { id: string };
  const r = await api.post(`${URLS.api}/users/${id}/link-de-acesso`, { headers: auth(admin), data: {} });
  expect(r.status()).toBe(200);
  const { link } = (await r.json()) as { link: string };
  return { email, id, link, admin };
}

const tokenDo = (link: string) => new URLSearchParams(new URL(link).hash.slice(1)).get('t') ?? '';

test.beforeEach(async () => {
  await limparLimite('login');
});

test('link de acesso: cria a senha uma vez, depois morre', async ({ request }) => {
  const { email, link } = await contaComLink(request);
  expect(link).toContain('/definir-senha#t=');
  const token = tokenDo(link);
  expect(token.length).toBeGreaterThan(30);

  // senha fraca e recusada e NAO gasta o link
  const fraca = await request.post(`${URLS.api}/auth/definir-senha`, {
    data: { token, senha: 'jologelato12' },
    failOnStatusCode: false,
  });
  expect(fraca.status()).toBe(422);

  const senha = `Socio#${randomUUID().slice(0, 8)}Forte9`;
  const ok = await request.post(`${URLS.api}/auth/definir-senha`, { data: { token, senha } });
  expect(ok.status()).toBe(200);

  // segunda vez: morto, com a mesma resposta de um link inventado
  const denovo = await request.post(`${URLS.api}/auth/definir-senha`, {
    data: { token, senha: `Outra#${randomUUID().slice(0, 8)}Senha9` },
    failOnStatusCode: false,
  });
  expect(denovo.status()).toBe(400);
  const inventado = await request.post(`${URLS.api}/auth/definir-senha`, {
    data: { token: 'x'.repeat(43), senha },
    failOnStatusCode: false,
  });
  expect(inventado.status()).toBe(400);
  expect((await denovo.json()).error).toBe((await inventado.json()).error);

  // e a senha criada entra
  await limparLimite('login');
  expect((await entrar(request, email, senha)).status).toBe(200);
});

test('gerar um link novo mata o anterior', async ({ request }) => {
  const { id, link, admin } = await contaComLink(request);
  const novo = await request.post(`${URLS.api}/users/${id}/link-de-acesso`, { headers: auth(admin), data: {} });
  expect(novo.status()).toBe(200);
  const velho = await request.post(`${URLS.api}/auth/definir-senha`, {
    data: { token: tokenDo(link), senha: `Velho#${randomUUID().slice(0, 8)}Link9` },
    failOnStatusCode: false,
  });
  expect(velho.status(), 'o link antigo nao vale mais').toBe(400);
});

test('quem nao administra usuarios nao gera link', async ({ request }) => {
  const { email, link } = await contaComLink(request);
  const senha = `Socio#${randomUUID().slice(0, 8)}Forte9`;
  await request.post(`${URLS.api}/auth/definir-senha`, { data: { token: tokenDo(link), senha } });
  await limparLimite('login');
  const socio = (await entrar(request, email, senha)).token!;
  const termo = (await (await request.get(`${URLS.api}/termos/atual`, { headers: auth(socio) })).json()) as { versao: string };
  await request.post(`${URLS.api}/termos/aceitar`, { headers: auth(socio), data: { versao: termo.versao } });
  const users = (await (await request.get(`${URLS.api}/users`, { headers: auth((await entrar(request, ADMIN.email, ADMIN.senha)).token!) })).json()) as { id: string }[];
  const r = await request.post(`${URLS.api}/users/${users[0]!.id}/link-de-acesso`, {
    headers: auth(socio),
    data: {},
    failOnStatusCode: false,
  });
  expect(r.status()).toBe(403);
});

test('pela tela: abre o link, cria a senha e entra', async ({ page, request }) => {
  const { email, link } = await contaComLink(request);
  const erros: string[] = [];
  page.on('pageerror', (e) => erros.push(e.message));

  // o link aponta para o endereco publico; no teste, a mesma tela no CRM local
  const local = `${URLS.crm}/definir-senha${new URL(link).hash}`;
  await page.goto(local, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: /crie a sua senha/i })).toBeVisible();
  // o codigo sai da barra de endereco assim que a tela le
  await expect.poll(() => new URL(page.url()).hash).toBe('');

  const senha = `Tela#${randomUUID().slice(0, 8)}Forte9`;
  await page.getByLabel('Senha nova').fill(senha);
  await page.getByLabel('Repita a senha').fill(senha);
  await page.getByRole('button', { name: /criar senha/i }).click();
  await expect(page.getByRole('heading', { name: /senha criada/i })).toBeVisible();
  await page.screenshot({ path: 'var/provas/definir-senha.png', fullPage: true });

  await limparLimite('login');
  expect((await entrar(request, email, senha)).status).toBe(200);
  expect(erros).toHaveLength(0);
});

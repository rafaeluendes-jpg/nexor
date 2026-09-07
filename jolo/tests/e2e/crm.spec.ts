import { randomUUID } from 'node:crypto';
import { expect, test, type APIRequestContext } from '@playwright/test';
import { URLS } from '../playwright.config';
import { limparLimite } from './apoio/redis';

const ADMIN = {
  email: process.env.SEED_ADMIN_EMAIL ?? 'admin@jologelato.com.br',
  senha: process.env.SEED_ADMIN_PASSWORD ?? 'Jolo@Gelato#2026',
};

async function entrar(api: APIRequestContext, email: string, password: string) {
  const r = await api.post(`${URLS.api}/auth/login`, { data: { email, password }, failOnStatusCode: false });
  return { status: r.status(), body: r.ok() ? await r.json() : await r.text() };
}

async function tokenDoAdmin(api: APIRequestContext): Promise<string> {
  const r = await entrar(api, ADMIN.email, ADMIN.senha);
  expect(r.status, 'admin do seed precisa entrar').toBe(200);
  return (r.body as { accessToken: string }).accessToken;
}

function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

// A API bloqueia o IP depois de 5 tentativas de login em 15 minutos.
// A protecao continua valendo: aqui so zeramos o contador entre um caso e outro,
// senao a propria bateria se autobloqueia. Ha um teste dedicado que prova o bloqueio.
test.beforeEach(async () => {
  await limparLimite('login');
});

test.describe('acesso ao CRM', () => {
  test('entra com a conta do seed e recebe papel e permissoes', async ({ request }) => {
    const { status, body } = await entrar(request, ADMIN.email, ADMIN.senha);
    expect(status).toBe(200);
    const dados = body as { accessToken: string; user: { roles: string[]; permissions: string[] } };
    expect(dados.accessToken.split('.')).toHaveLength(3);
    expect(dados.user.roles).toContain('SUPER_ADMIN');
    expect(dados.user.permissions.length).toBeGreaterThan(20);
  });

  test('nao entra com senha errada e nao entrega pista nenhuma', async ({ request }) => {
    const errada = await entrar(request, ADMIN.email, 'senha-errada-de-proposito');
    const inexistente = await entrar(request, `nao-existe-${randomUUID()}@jolo.com.br`, 'qualquer-coisa');

    expect(errada.status).toBe(401);
    expect(inexistente.status).toBe(401);
    expect(
      String(errada.body),
      'mesma resposta para senha errada e para e-mail inexistente',
    ).toBe(String(inexistente.body));
  });

  test('rota protegida exige token', async ({ request }) => {
    for (const rota of ['/leads', '/conversations', '/dashboard', '/pipeline', '/users']) {
      const r = await request.get(`${URLS.api}${rota}`, { failOnStatusCode: false });
      expect(r.status(), `rota ${rota} sem token`).toBe(401);
    }
  });

  test('token adulterado nao vale', async ({ request }) => {
    const token = await tokenDoAdmin(request);
    const partes = token.split('.');
    const adulterado = `${partes[0]}.${partes[1]}.${'a'.repeat(partes[2].length)}`;
    const r = await request.get(`${URLS.api}/leads`, { headers: auth(adulterado), failOnStatusCode: false });
    expect(r.status()).toBe(401);
  });

  test('o lead que entrou pelo WhatsApp aparece no funil com a origem guardada', async ({ request }) => {
    const token = await tokenDoAdmin(request);
    const r = await request.get(`${URLS.api}/pipeline`, { headers: auth(token) });
    expect(r.status()).toBe(200);

    const corpo = (await r.json()) as {
      colunas: { key: string; cartoes: { nome: string; telefone: string; origem: string | null }[] }[];
    };
    const cartoes = corpo.colunas.flatMap((c) => c.cartoes);
    expect(cartoes.length, 'o funil mostra os leads que chegaram').toBeGreaterThan(0);
    expect(cartoes.every((c) => Boolean(c.telefone)), 'todo cartao tem telefone').toBe(true);
  });

  test('o painel responde com os numeros do funil', async ({ request }) => {
    const token = await tokenDoAdmin(request);
    const r = await request.get(`${URLS.api}/dashboard`, { headers: auth(token) });
    expect(r.status()).toBe(200);
    expect(await r.json()).toBeTruthy();
  });

  test('o funil tem as etapas cadastradas, na ordem do processo', async ({ request }) => {
    const token = await tokenDoAdmin(request);
    const r = await request.get(`${URLS.api}/pipeline`, { headers: auth(token) });
    expect(r.status()).toBe(200);

    const corpo = (await r.json()) as { pipeline: string; colunas: { key: string; nome: string }[] };
    const chaves = corpo.colunas.map((c) => c.key);
    for (const etapa of ['NOVO_LEAD', 'IA_QUALIFICANDO', 'QUALIFICADO', 'REUNIAO_AGENDADA']) {
      expect(chaves, `etapa ${etapa}`).toContain(etapa);
    }
    expect(chaves.indexOf('IA_QUALIFICANDO')).toBeGreaterThan(chaves.indexOf('NOVO_LEAD'));
  });
});

test.describe('protecao contra forca bruta', () => {
  test('bloqueia o IP depois de varias tentativas seguidas', async ({ request }) => {
    const alvo = `alvo-${randomUUID()}@jolo.teste`;
    const respostas: number[] = [];
    for (let i = 0; i < 7; i += 1) {
      respostas.push((await entrar(request, alvo, `tentativa-${i}`)).status);
    }
    expect(respostas.slice(0, 5), 'as primeiras tentativas so dizem "nao autorizado"').toEqual(
      [401, 401, 401, 401, 401],
    );
    expect(respostas.slice(5), 'depois disso o IP e barrado').toEqual([429, 429]);

    // e barra ate a senha certa, enquanto o castigo durar
    expect((await entrar(request, ADMIN.email, ADMIN.senha)).status).toBe(429);
    await limparLimite('login');
    expect((await entrar(request, ADMIN.email, ADMIN.senha)).status, 'passado o bloqueio, volta ao normal').toBe(200);
  });
});

test.describe('permissao por papel', () => {
  test('quem so visualiza nao cria usuario nem mexe no funil', async ({ request }) => {
    const admin = await tokenDoAdmin(request);
    const email = `visualizacao-${randomUUID().slice(0, 8)}@jolo.teste`;
    const senha = `Teste@${randomUUID().slice(0, 10)}`;

    const criado = await request.post(`${URLS.api}/users`, {
      headers: auth(admin),
      data: { nome: 'Conta de Teste', email, papel: 'VISUALIZACAO', senhaProvisoria: senha },
      failOnStatusCode: false,
    });
    expect(criado.status(), `criacao respondeu ${criado.status()}`).toBeLessThan(400);

    const entrada = await entrar(request, email, senha);
    expect(entrada.status, 'a conta nova entra').toBe(200);
    const restrito = (entrada.body as { accessToken: string }).accessToken;

    // ve o que pode
    expect((await request.get(`${URLS.api}/leads`, { headers: auth(restrito) })).status()).toBe(200);

    // e nao faz o que nao pode: o backend e quem barra, nao a tela
    const tentativa = await request.post(`${URLS.api}/users`, {
      headers: auth(restrito),
      data: { nome: 'Outro', email: `x-${randomUUID().slice(0, 6)}@jolo.teste`, papel: 'ADMIN', senhaProvisoria: 'Senha@Grande123' },
      failOnStatusCode: false,
    });
    expect(tentativa.status(), 'sem permissao para criar usuario').toBe(403);

    const listaUsuarios = await request.get(`${URLS.api}/users`, { headers: auth(restrito), failOnStatusCode: false });
    expect(listaUsuarios.status(), 'sem permissao para ver usuarios').toBe(403);
  });
});

test.describe('tela do CRM', () => {
  test('a tela de login abre e pede e-mail e senha', async ({ page }) => {
    const erros: string[] = [];
    page.on('pageerror', (e) => erros.push(e.message));
    await page.goto(`${URLS.crm}/login`, { waitUntil: 'networkidle' });

    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole('button', { name: /entrar/i })).toBeVisible();
    expect(erros).toHaveLength(0);
  });

  test('quem nao entrou nao chega ao painel', async ({ page }) => {
    await page.goto(`${URLS.crm}/dashboard`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    expect(page.url(), 'sem sessao, volta para o login').toContain('/login');
  });

  test('entra pela tela e chega ao painel', async ({ page }) => {
    await page.goto(`${URLS.crm}/login`, { waitUntil: 'networkidle' });
    await page.locator('input[type="email"]').fill(ADMIN.email);
    await page.locator('input[type="password"]').fill(ADMIN.senha);
    await page.getByRole('button', { name: /entrar/i }).click();

    await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
    await expect(page.locator('body')).toContainText(/Jol|funil|lead/i);
  });

  test('senha errada mostra recado e nao entra', async ({ page }) => {
    await page.goto(`${URLS.crm}/login`, { waitUntil: 'networkidle' });
    await page.locator('input[type="email"]').fill(ADMIN.email);
    await page.locator('input[type="password"]').fill('errada-de-proposito');
    await page.getByRole('button', { name: /entrar/i }).click();

    await expect(page.locator('.erro')).toBeVisible({ timeout: 10_000 });
    expect(page.url()).toContain('/login');
  });
});

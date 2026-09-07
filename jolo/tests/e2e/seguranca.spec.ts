import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { URLS } from '../playwright.config';
import { limparLimite } from './apoio/redis';

/** Segredos que NUNCA podem sair do servidor (itens 62-66 do prompt mestre). */
const SEGREDOS: [string, string | undefined][] = [
  ['META_APP_SECRET', process.env.META_APP_SECRET],
  ['META_WHATSAPP_ACCESS_TOKEN', process.env.META_WHATSAPP_ACCESS_TOKEN],
  ['SUPABASE_SERVICE_ROLE_KEY', process.env.SUPABASE_SERVICE_ROLE_KEY],
  ['OPENAI_API_KEY', process.env.OPENAI_API_KEY],
  ['JWT_SECRET', process.env.JWT_SECRET],
  ['DATABASE_URL', process.env.DATABASE_URL],
  ['SEED_ADMIN_PASSWORD', process.env.SEED_ADMIN_PASSWORD],
];

// A API bloqueia o IP depois de 5 logins seguidos. A protecao segue ligada
// (ha teste dedicado no crm.spec.ts); aqui so zeramos o contador entre casos.
test.beforeEach(async () => {
  await limparLimite('login');
});

function arquivos(dir: string, extensoes: string[]): string[] {
  let encontrados: string[] = [];
  let entradas: string[];
  try {
    entradas = readdirSync(dir);
  } catch {
    return [];
  }
  for (const nome of entradas) {
    const caminho = join(dir, nome);
    const info = statSync(caminho);
    if (info.isDirectory()) encontrados = encontrados.concat(arquivos(caminho, extensoes));
    else if (extensoes.some((e) => nome.endsWith(e))) encontrados.push(caminho);
  }
  return encontrados;
}

test.describe('segredos nao vazam para o navegador', () => {
  test('nenhum segredo aparece no pacote publicado da landing nem do CRM', () => {
    const pacotes = [
      ...arquivos('apps/landing/.next/static', ['.js']),
      ...arquivos('apps/crm/.next/static', ['.js']),
    ];
    expect(pacotes.length, 'os pacotes precisam estar compilados para esta prova valer').toBeGreaterThan(0);

    const vazamentos: string[] = [];
    for (const arquivo of pacotes) {
      const conteudo = readFileSync(arquivo, 'utf8');
      for (const [nome, valor] of SEGREDOS) {
        if (!valor || valor.length < 8) continue;
        if (conteudo.includes(valor)) vazamentos.push(`${nome} em ${arquivo}`);
      }
      for (const nome of ['META_APP_SECRET', 'SERVICE_ROLE', 'OPENAI_API_KEY', 'DATABASE_URL']) {
        if (conteudo.includes(nome)) vazamentos.push(`nome ${nome} citado em ${arquivo}`);
      }
    }
    expect(vazamentos, `vazou: ${vazamentos.join('; ')}`).toHaveLength(0);
  });

  test('a pagina servida nao carrega segredo nenhum', async ({ page }) => {
    await page.goto(`${URLS.landing}/`, { waitUntil: 'networkidle' });
    const tudo = await page.content();
    for (const [nome, valor] of SEGREDOS) {
      if (valor && valor.length >= 8) expect(tudo, `${nome} na pagina`).not.toContain(valor);
    }
  });

  test('a API nao devolve senha, hash nem token de terceiros', async ({ request }) => {
    const login = await request.post(`${URLS.api}/auth/login`, {
      data: {
        email: process.env.SEED_ADMIN_EMAIL ?? 'admin@jologelato.com.br',
        password: process.env.SEED_ADMIN_PASSWORD ?? 'Jolo@Gelato#2026',
      },
    });
    expect(login.status()).toBe(200);
    const corpo = await login.text();
    for (const proibido of ['devPasswordHash', 'password_hash', 'passwordHash', '$2a$', '$2b$']) {
      expect(corpo, `resposta do login traz ${proibido}`).not.toContain(proibido);
    }

    const token = (JSON.parse(corpo) as { accessToken: string }).accessToken;
    const eu = await request.get(`${URLS.api}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
    const meuCorpo = await eu.text();
    for (const proibido of ['$2a$', '$2b$', 'devPasswordHash', 'SERVICE_ROLE']) {
      expect(meuCorpo, `/auth/me traz ${proibido}`).not.toContain(proibido);
    }
  });
});

test.describe('cabecalhos e origem', () => {
  test('a landing vai com os cabecalhos de seguranca', async ({ request }) => {
    const r = await request.get(`${URLS.landing}/`);
    const h = r.headers();
    expect(h['content-security-policy'], 'sem CSP').toBeTruthy();
    expect(h['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(h['x-content-type-options']).toBe('nosniff');
    expect(h['x-frame-options']).toBe('DENY');
    expect(h['referrer-policy']).toBeTruthy();
    expect(h['strict-transport-security']).toBeTruthy();
    expect(h['x-powered-by'], 'nao anunciar a tecnologia').toBeUndefined();
  });

  test('a API so aceita chamada das origens autorizadas', async ({ request }) => {
    const permitida = await request.fetch(`${URLS.api}/health`, {
      method: 'GET',
      headers: { Origin: URLS.landing },
    });
    expect(permitida.headers()['access-control-allow-origin']).toBe(URLS.landing);

    const invasora = await request.fetch(`${URLS.api}/health`, {
      method: 'GET',
      headers: { Origin: 'https://site-invasor.example.com' },
      failOnStatusCode: false,
    });
    expect(
      invasora.headers()['access-control-allow-origin'],
      'site de fora nao pode ler a resposta',
    ).toBeUndefined();
  });
});

test.describe('dados de entrada', () => {
  test('recusa cadastro de usuario com dados invalidos', async ({ request }) => {
    const login = await request.post(`${URLS.api}/auth/login`, {
      data: {
        email: process.env.SEED_ADMIN_EMAIL ?? 'admin@jologelato.com.br',
        password: process.env.SEED_ADMIN_PASSWORD ?? 'Jolo@Gelato#2026',
      },
    });
    const token = (await login.json()).accessToken as string;

    const casos = [
      { nome: 'A', email: 'nao-e-email', papel: 'ADMIN', senhaProvisoria: 'Senha@Grande123' },
      { nome: 'Fulano', email: 'f@jolo.teste', papel: 'PAPEL_INVENTADO', senhaProvisoria: 'Senha@Grande123' },
      { nome: 'Fulano', email: 'f@jolo.teste', papel: 'ADMIN', senhaProvisoria: 'curta' },
    ];
    for (const dados of casos) {
      const r = await request.post(`${URLS.api}/users`, {
        headers: { Authorization: `Bearer ${token}` },
        data: dados,
        failOnStatusCode: false,
      });
      // 422: a API recusa por validacao, com codigo proprio e sem detalhe interno
      expect([400, 422], `dados: ${JSON.stringify(dados)} respondeu ${r.status()}`).toContain(r.status());
      expect(await r.text(), 'sem pilha de erro').not.toMatch(/at .*\.(ts|js):\d+/);
    }
  });

  test('tentativa de injecao de SQL nao derruba nem vaza', async ({ request }) => {
    const login = await request.post(`${URLS.api}/auth/login`, {
      data: { email: "admin@jologelato.com.br' OR '1'='1", password: "qualquer' OR '1'='1" },
      failOnStatusCode: false,
    });
    expect([400, 401, 422], `respondeu ${login.status()}`).toContain(login.status());
    expect(await login.text()).not.toContain('accessToken');
  });
});

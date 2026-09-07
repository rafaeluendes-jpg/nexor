import { expect, test, type Page } from '@playwright/test';
import { URLS } from '../playwright.config';
import { limparLimite } from './apoio/redis';

/**
 * Abre TODAS as telas do CRM no navegador de verdade. Tela que nao monta,
 * erro de console e rolagem horizontal reprovam aqui — e nao na frente do
 * time de expansao.
 */
const ADMIN = {
  email: process.env.SEED_ADMIN_EMAIL ?? 'admin@jologelato.com.br',
  senha: process.env.SEED_ADMIN_PASSWORD ?? 'Jolo@Gelato#2026',
};

const TELAS: { caminho: string; titulo: RegExp }[] = [
  { caminho: '/dashboard', titulo: /Painel/i },
  { caminho: '/inbox', titulo: /Conversas/i },
  { caminho: '/pipeline', titulo: /Funil/i },
  { caminho: '/leads', titulo: /Leads/i },
  { caminho: '/contatos', titulo: /Contatos/i },
  { caminho: '/agenda', titulo: /Agenda/i },
  { caminho: '/tarefas', titulo: /Tarefas/i },
  { caminho: '/cof', titulo: /COF/i },
  { caminho: '/documentos', titulo: /Documentos/i },
  { caminho: '/pracas', titulo: /Praças/i },
  { caminho: '/relatorios', titulo: /Relatórios/i },
  { caminho: '/origem', titulo: /Origem/i },
  { caminho: '/exportacoes', titulo: /Exportações/i },
  { caminho: '/usuarios', titulo: /Usuários/i },
  { caminho: '/modelos', titulo: /Modelos/i },
  { caminho: '/ia', titulo: /IA de atendimento/i },
  { caminho: '/integracao', titulo: /Integração/i },
  { caminho: '/configuracoes', titulo: /Configurações/i },
  { caminho: '/auditoria', titulo: /Auditoria/i },
];

/**
 * As telas de conversa e funil mantem um canal aberto para atualizar sozinhas,
 * entao a pagina nunca fica "sem rede". Esperar por networkidle nelas trava:
 * esperamos o conteudo aparecer.
 */
async function abrir(page: Page, endereco: string): Promise<void> {
  await page.goto(endereco, { waitUntil: 'domcontentloaded' });
  await page.locator('h1').first().waitFor({ state: 'visible', timeout: 20_000 });
  // tempo curto para a primeira carga de dados desenhar
  await page.waitForTimeout(700);
}

async function entrar(page: Page): Promise<void> {
  await limparLimite('login');
  await page.goto(`${URLS.crm}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('input[type="email"]').fill(ADMIN.email);
  await page.locator('input[type="password"]').fill(ADMIN.senha);
  await page.getByRole('button', { name: /entrar/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
}

test.describe('telas do CRM', () => {
  test('todas abrem, sem erro de console e sem vazar para o lado', async ({ page }) => {
    const erros: string[] = [];
    page.on('pageerror', (e) => erros.push(`${page.url()}: ${e.message}`));
    page.on('console', (m) => {
      // erro de rede de dado ainda nao existente nao e defeito de tela
      if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) {
        erros.push(`${page.url()}: ${m.text()}`);
      }
    });

    await entrar(page);

    for (const tela of TELAS) {
      await abrir(page, `${URLS.crm}${tela.caminho}`);

      await expect(page.locator('h1'), `titulo de ${tela.caminho}`).toHaveText(tela.titulo);
      await expect(page.locator('.lateral'), `menu em ${tela.caminho}`).toHaveCount(1);

      // nenhuma tela pode ficar so no "Carregando"
      await expect(page.locator('body'), `${tela.caminho} nao terminou de carregar`).not.toHaveText(/^Carregando/);

      const { scroll, cliente } = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        cliente: document.documentElement.clientWidth,
      }));
      expect(scroll, `${tela.caminho} vaza para o lado`).toBeLessThanOrEqual(cliente + 1);
    }

    expect(erros, `erros: ${erros.join(' | ')}`).toHaveLength(0);
  });

  test('o menu leva a todas as areas', async ({ page }) => {
    await entrar(page);
    const links = await page.locator('.lateral a').evaluateAll((els) =>
      els.map((e) => (e as HTMLAnchorElement).getAttribute('href') ?? ''),
    );
    for (const tela of TELAS) {
      expect(links, `falta o link para ${tela.caminho}`).toContain(tela.caminho);
    }
  });

  test('no celular o menu abre pelo botao e fecha ao escolher', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await entrar(page);
    await abrir(page, `${URLS.crm}/leads`);

    // fechado por padrao: no celular o conteudo vem primeiro, nao vinte itens de menu
    const menu = page.locator('.lateral');
    await expect(menu).not.toBeInViewport();

    const botao = page.getByRole('button', { name: /menu/i });
    await expect(botao).toBeVisible();
    await botao.click();
    await expect(menu, 'o menu tem de aparecer ao apertar o botao').toBeInViewport();

    // escolher uma area fecha o menu sozinho
    await menu.getByRole('link', { name: 'Tarefas' }).click();
    await page.waitForURL(/\/tarefas/, { timeout: 15_000 });
    await page.locator('h1').first().waitFor({ state: 'visible' });
    await expect(menu).not.toBeInViewport();

    const { scroll, cliente } = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      cliente: document.documentElement.clientWidth,
    }));
    expect(scroll, 'a tela vaza no celular').toBeLessThanOrEqual(cliente + 1);
  });

  test('a tela de um lead mostra ficha, origem e historico', async ({ page }) => {
    await entrar(page);
    await abrir(page, `${URLS.crm}/leads`);

    const primeiro = page.locator('tbody tr td a').first();
    const quantos = await primeiro.count();
    test.skip(quantos === 0, 'ainda nao ha lead para abrir');

    await primeiro.click();
    await page.waitForURL(/\/leads\/[0-9a-f-]{36}/, { timeout: 15_000 });

    await expect(page.getByRole('heading', { name: 'Qualificação' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Origem' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Linha do tempo' })).toBeVisible();
  });
});

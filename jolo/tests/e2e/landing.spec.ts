import { expect, test } from '@playwright/test';

/** Ordem exata das secoes da pagina aprovada (legacy/landing-approved.html). */
const SECOES = ['top', 'modelo', 'rede', 'trajetoria', 'proposito', 'jornada', 'investimento', 'socios', 'faq', 'contato'];

/** Os 6 botoes "Fale com o dono" da pagina aprovada, no texto e na ordem originais. */
const CTAS = [
  'Fale com o dono',
  'Fale com o dono no WhatsApp',
  'Fale com o dono',
  'Quero entender o investimento',
  'Fale com o dono no WhatsApp',
  'W',
];

test.describe('landing aprovada', () => {
  test('abre sem erro de console e com as secoes aprovadas na ordem', async ({ page }) => {
    const erros: string[] = [];
    page.on('console', (m) => m.type() === 'error' && erros.push(m.text()));
    page.on('pageerror', (e) => erros.push(e.message));

    await page.goto('/', { waitUntil: 'networkidle' });

    for (const id of SECOES) {
      await expect(page.locator(`#${id}`), `secao #${id}`).toHaveCount(1);
    }

    const ordem = await page.evaluate((ids) => {
      const tops = ids.map((id) => document.getElementById(id)?.getBoundingClientRect().top ?? -1);
      return tops;
    }, SECOES);
    for (let i = 1; i < ordem.length; i += 1) {
      expect(ordem[i], `#${SECOES[i]} depois de #${SECOES[i - 1]}`).toBeGreaterThan(ordem[i - 1]);
    }

    expect(erros, `erros de console: ${erros.join(' | ')}`).toHaveLength(0);
  });

  test('nao tem rolagem horizontal', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    const { scroll, cliente } = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      cliente: document.documentElement.clientWidth,
    }));
    expect(scroll, 'a pagina vaza para o lado').toBeLessThanOrEqual(cliente + 1);
  });

  test('todas as fotos carregam de verdade', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    const quebradas = await page.evaluate(() =>
      Array.from(document.images)
        .filter((img) => !img.complete || img.naturalWidth === 0)
        .map((img) => img.currentSrc || img.src),
    );
    expect(quebradas, `fotos que nao carregaram: ${quebradas.join(', ')}`).toHaveLength(0);
    expect(await page.evaluate(() => document.images.length)).toBeGreaterThan(0);
  });

  test('tem o basico de SEO e compartilhamento', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Franqueado.*Jol/i);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /.{50,}/);
    await expect(page.locator('meta[property="og:title"]')).toHaveCount(1);
    await expect(page.locator('html')).toHaveAttribute('lang', /pt/i);
    expect(await page.locator('h1').count(), 'exatamente um H1').toBe(1);
  });

  test('os seis botoes de falar com o dono estao no lugar e dao para clicar com o dedo', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    const botoes = page.locator('.js-whatsapp');
    await expect(botoes, 'a pagina aprovada tem 6 chamadas para o WhatsApp').toHaveCount(CTAS.length);

    const textos = await botoes.evaluateAll((els) =>
      els.map((e) => (e.textContent ?? '').replace('\u2197', '').trim()),
    );
    expect(textos, 'texto dos botoes igual ao aprovado').toEqual(CTAS);

    for (let i = 0; i < CTAS.length; i += 1) {
      const alvo = botoes.nth(i);
      await expect(alvo, `botao ${i + 1} visivel`).toBeVisible();
      const caixa = await alvo.boundingBox();
      expect(caixa, `botao ${i + 1} sem area clicavel`).not.toBeNull();
      expect(caixa!.height, `botao ${i + 1}: alvo de toque menor que o dedo`).toBeGreaterThanOrEqual(36);
      expect(caixa!.width, `botao ${i + 1}: alvo de toque estreito demais`).toBeGreaterThanOrEqual(36);
    }
  });

  test('o botao flutuante tem nome acessivel', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    // e o unico CTA sem texto legivel: sem rotulo, leitor de tela le so "W"
    await expect(page.getByLabel('Fale com o dono no WhatsApp')).toHaveCount(1);
  });
});

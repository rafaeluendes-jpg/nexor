import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { NUMERO_DE_TESTE, URLS } from '../playwright.config';

/**
 * O wa.me nao e chamado de dentro do teste: interceptamos a abertura e
 * conferimos a URL que o sistema montou. O teste nao depende de internet
 * nem incomoda o servidor da Meta.
 */
async function interceptarWhatsApp(context: BrowserContext): Promise<void> {
  await context.route('https://wa.me/**', (rota) =>
    rota.fulfill({ status: 200, contentType: 'text/html', body: '<p>wa.me</p>' }),
  );
}

/** Clica o botao e devolve a aba que o sistema abriu, ja carregada. */
async function clicarEAbrir(page: Page, context: BrowserContext, indice = 0): Promise<Page> {
  const [nova] = await Promise.all([
    context.waitForEvent('page'),
    page.locator('.js-whatsapp').nth(indice).click(),
  ]);
  await nova.waitForLoadState('domcontentloaded');
  return nova;
}

/**
 * Prova do caminho LANDING -> BOTAO -> WHATSAPP.
 * Roda contra uma instancia da landing com numero ficticio (porta 3010),
 * porque o numero oficial e credencial do operador e nao vive no repositorio.
 */
test.describe('botao "Fale com o dono"', () => {
  test.use({ baseURL: URLS.landingComNumero });

  test('abre o WhatsApp oficial no numero configurado, com a mensagem pronta', async ({ page, context }) => {
    await interceptarWhatsApp(context);
    await page.goto('/?utm_source=instagram&utm_medium=cpc&utm_campaign=franquias-setembro', {
      waitUntil: 'networkidle',
    });

    const nova = await clicarEAbrir(page, context);
    const url = new URL(nova.url());

    expect(url.host, 'tem de ser o wa.me oficial').toBe('wa.me');
    expect(url.pathname, 'numero configurado pelo operador').toBe(`/${NUMERO_DE_TESTE}`);

    const texto = url.searchParams.get('text') ?? '';
    expect(texto.length, 'mensagem pronta para o lead so apertar enviar').toBeGreaterThan(20);
    expect(texto, 'codigo de rastreio junto da mensagem').toMatch(/\[ref:\s*jl_[a-z0-9]+\s*\]/i);
    await nova.close();
  });

  test('registra a origem do clique na API antes de abrir o WhatsApp', async ({ page, context }) => {
    await interceptarWhatsApp(context);
    const registros: Record<string, unknown>[] = [];
    await page.route('**/attribution/click', async (rota) => {
      registros.push(rota.request().postDataJSON());
      await rota.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    });

    await page.goto('/?utm_source=instagram&utm_medium=cpc&utm_campaign=franquias-setembro', {
      waitUntil: 'networkidle',
    });
    const nova = await clicarEAbrir(page, context);

    expect(registros, 'o clique foi registrado').toHaveLength(1);
    const r = registros[0];
    expect(r.utmSource).toBe('instagram');
    expect(r.utmMedium).toBe('cpc');
    expect(r.utmCampaign).toBe('franquias-setembro');
    expect(String(r.trackingId)).toMatch(/^jl_[a-z0-9]+$/);
    expect(String(r.origem), 'diz qual botao da pagina foi apertado').toBeTruthy();

    // o mesmo codigo que foi para a API vai dentro da mensagem
    expect(new URL(nova.url()).searchParams.get('text')).toContain(String(r.trackingId));
    await nova.close();
  });

  test('cada botao diz de onde o lead veio', async ({ page, context }) => {
    await interceptarWhatsApp(context);
    const origens: string[] = [];
    await page.route('**/attribution/click', async (rota) => {
      origens.push(String(rota.request().postDataJSON().origem));
      await rota.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    });
    await page.goto('/', { waitUntil: 'networkidle' });

    for (const i of [0, 3]) {
      await (await clicarEAbrir(page, context, i)).close();
    }
    expect(origens).toHaveLength(2);
    expect(new Set(origens).size, 'botoes diferentes gravam origens diferentes').toBe(2);
  });

  test('a primeira origem nao e trocada quando o visitante volta por outro caminho', async ({ page, context }) => {
    await interceptarWhatsApp(context);
    const registros: Record<string, unknown>[] = [];
    await page.route('**/attribution/click', async (rota) => {
      registros.push(rota.request().postDataJSON());
      await rota.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    });

    await page.goto('/?utm_source=instagram&utm_campaign=franquias-setembro', { waitUntil: 'networkidle' });
    await (await clicarEAbrir(page, context)).close();

    await page.goto('/?utm_source=google&utm_campaign=busca', { waitUntil: 'networkidle' });
    await (await clicarEAbrir(page, context)).close();

    expect(registros[1].utmSource, 'quem trouxe o lead continua sendo o Instagram').toBe('instagram');
    expect(registros[1].trackingId, 'mesmo visitante, mesmo codigo').toBe(registros[0].trackingId);
  });

  test('o WhatsApp abre mesmo se a API estiver fora do ar', async ({ page, context }) => {
    await interceptarWhatsApp(context);
    await page.route('**/attribution/click', (rota) => rota.abort('failed'));
    await page.goto('/', { waitUntil: 'networkidle' });

    const nova = await clicarEAbrir(page, context);
    expect(new URL(nova.url()).host, 'perder analitica e melhor que perder o lead').toBe('wa.me');
    await nova.close();
  });
});

test.describe('sem numero oficial configurado', () => {
  test('nao manda o lead para lugar nenhum', async ({ page, context }) => {
    // instancia de producao da landing: o operador ainda nao informou o numero
    await page.goto(`${URLS.landing}/`, { waitUntil: 'networkidle' });

    const abertas: string[] = [];
    context.on('page', (p) => abertas.push(p.url()));
    await page.locator('.js-whatsapp').first().click();
    await page.waitForTimeout(1000);

    expect(abertas, 'melhor nao abrir nada do que abrir numero errado').toHaveLength(0);
    expect(page.url()).toContain(URLS.landing);
  });
});

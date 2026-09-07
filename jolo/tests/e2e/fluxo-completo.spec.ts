import { createHmac, randomUUID } from 'node:crypto';
import { expect, test, type APIRequestContext, type BrowserContext, type Page } from '@playwright/test';
import { NUMERO_DE_TESTE, URLS } from '../playwright.config';
import { limparLimite } from './apoio/redis';

/**
 * O caminho inteiro da Fase 1, numa corrida so:
 * LANDING -> BOTAO -> WHATSAPP -> WEBHOOK DA META -> CRM.
 */

const ADMIN = {
  email: process.env.SEED_ADMIN_EMAIL ?? 'admin@jologelato.com.br',
  senha: process.env.SEED_ADMIN_PASSWORD ?? 'Jolo@Gelato#2026',
};
const APP_SECRET = process.env.META_APP_SECRET ?? 'dev-app-secret';

function assinar(corpo: string): string {
  return `sha256=${createHmac('sha256', APP_SECRET).update(corpo).digest('hex')}`;
}

async function abrirWhatsApp(page: Page, context: BrowserContext): Promise<URL> {
  await context.route('https://wa.me/**', (r) =>
    r.fulfill({ status: 200, contentType: 'text/html', body: '<p>wa.me</p>' }),
  );
  const [nova] = await Promise.all([
    context.waitForEvent('page'),
    page.locator('.js-whatsapp').first().click(),
  ]);
  await nova.waitForLoadState('domcontentloaded');
  const url = new URL(nova.url());
  await nova.close();
  return url;
}

async function token(api: APIRequestContext): Promise<string> {
  await limparLimite('login');
  const r = await api.post(`${URLS.api}/auth/login`, { data: { email: ADMIN.email, password: ADMIN.senha } });
  expect(r.status()).toBe(200);
  return (await r.json()).accessToken as string;
}

test('do clique na landing ate o lead no funil do CRM', async ({ page, context, request }) => {
  // 1. o interessado chega por um anuncio do Instagram
  const campanha = `franquias-${randomUUID().slice(0, 6)}`;
  await page.goto(`${URLS.landingComNumero}/?utm_source=instagram&utm_medium=cpc&utm_campaign=${campanha}`, {
    waitUntil: 'networkidle',
  });

  // 2. aperta "Fale com o dono" e o WhatsApp abre com a mensagem pronta
  const url = await abrirWhatsApp(page, context);
  expect(url.host).toBe('wa.me');
  expect(url.pathname).toBe(`/${NUMERO_DE_TESTE}`);
  const texto = url.searchParams.get('text') ?? '';
  const rastreio = /\[ref:\s*(jl_[a-z0-9]+)\s*\]/i.exec(texto)?.[1];
  expect(rastreio, 'a mensagem leva o codigo de rastreio').toBeTruthy();

  // 3. ele envia a mensagem; a Meta avisa o sistema pelo webhook oficial
  const telefone = `5517${Math.floor(900000000 + Math.random() * 99999999)}`;
  const nome = `Interessado ${randomUUID().slice(0, 5)}`;
  const corpo = JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [
      {
        id: '123',
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: { display_phone_number: '551730000000', phone_number_id: '999' },
              contacts: [{ profile: { name: nome }, wa_id: telefone }],
              messages: [
                {
                  from: telefone,
                  id: `wamid.${randomUUID()}`,
                  timestamp: `${Math.floor(Date.now() / 1000)}`,
                  type: 'text',
                  text: { body: `Ola! Vim pela pagina de franquias.\n\n[ref: ${rastreio}]` },
                },
              ],
            },
          },
        ],
      },
    ],
  });
  const entrada = await request.post(`${URLS.api}/webhooks/meta/whatsapp`, {
    headers: { 'content-type': 'application/json', 'x-hub-signature-256': assinar(corpo) },
    data: Buffer.from(corpo, 'utf8'),
  });
  expect(entrada.status(), 'a Meta precisa de resposta rapida').toBe(200);

  // 4. o time de expansao ve o lead no funil, com a origem da campanha
  const t = await token(request);
  let cartao: { nome: string; origem: string | null } | undefined;
  for (let tentativa = 0; tentativa < 20 && !cartao; tentativa += 1) {
    const r = await request.get(`${URLS.api}/pipeline`, { headers: { Authorization: `Bearer ${t}` } });
    const corpoFunil = (await r.json()) as {
      colunas: { key: string; cartoes: { nome: string; origem: string | null; telefone: string }[] }[];
    };
    cartao = corpoFunil.colunas.flatMap((c) => c.cartoes).find((c) => c.nome === nome);
    if (!cartao) await page.waitForTimeout(500);
  }

  expect(cartao, 'o lead precisa aparecer no funil sozinho').toBeTruthy();
  expect(cartao!.origem, 'a campanha que trouxe o lead fica registrada').toBe('instagram');
});

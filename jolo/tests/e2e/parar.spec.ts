import { createHmac, randomUUID } from 'node:crypto';
import { expect, test, type APIRequestContext } from '@playwright/test';
import { URLS } from '../playwright.config';
import { limparLimite } from './apoio/redis';

/**
 * LGPD: quem responde PARAR sai do robo e de todo acompanhamento
 * automatico na hora, recebe uma unica confirmacao, e a marca fica no
 * contato para sempre.
 */

const ADMIN = {
  email: process.env.SEED_ADMIN_EMAIL ?? 'admin@jologelato.com.br',
  senha: process.env.SEED_ADMIN_PASSWORD ?? 'Jolo@Gelato#2026',
};
const APP_SECRET = process.env.META_APP_SECRET ?? 'dev-app-secret';

function doCliente(telefone: string, texto: string): string {
  return JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [{ id: '123', changes: [{ field: 'messages', value: {
      messaging_product: 'whatsapp',
      metadata: { phone_number_id: '999' },
      contacts: [{ profile: { name: 'Cliente Parar' }, wa_id: telefone }],
      messages: [{ from: telefone, id: `wamid.${randomUUID()}`, timestamp: `${Math.floor(Date.now() / 1000)}`, type: 'text', text: { body: texto } }],
    } }] }],
  });
}

async function enviar(api: APIRequestContext, corpo: string): Promise<void> {
  const r = await api.post(`${URLS.api}/webhooks/meta/whatsapp`, {
    headers: { 'content-type': 'application/json', 'x-hub-signature-256': `sha256=${createHmac('sha256', APP_SECRET).update(corpo).digest('hex')}` },
    data: Buffer.from(corpo, 'utf8'),
  });
  expect(r.status()).toBe(200);
}

type Conversa = { id: string; mode: string; messages: { author: string; body: string | null }[] };

async function conversaDo(api: APIRequestContext, auth: Record<string, string>, telefone: string): Promise<Conversa | null> {
  const itens = (await (await api.get(`${URLS.api}/conversations?search=${telefone}`, { headers: auth })).json()) as { id: string }[];
  if (!itens[0]) return null;
  return (await (await api.get(`${URLS.api}/conversations/${itens[0].id}`, { headers: auth })).json()) as Conversa;
}

test('PARAR: o robo sai, vai uma confirmacao so, e a marca fica', async ({ request }) => {
  await limparLimite('login');
  const login = await request.post(`${URLS.api}/auth/login`, { data: { email: ADMIN.email, password: ADMIN.senha } });
  const auth = { Authorization: `Bearer ${(await login.json()).accessToken as string}` };
  const telefone = `5517${Math.floor(900000000 + Math.random() * 99999999)}`;

  await enviar(request, doCliente(telefone, 'Oi, quero saber da franquia'));
  await expect.poll(async () => (await conversaDo(request, auth, telefone))?.mode, { timeout: 20_000 }).toBe('AI');

  await enviar(request, doCliente(telefone, 'PARAR'));
  await expect
    .poll(async () => (await conversaDo(request, auth, telefone))?.mode, { timeout: 20_000, message: 'o robo sai da conversa' })
    .toBe('HUMAN');
  await expect
    .poll(async () => (await conversaDo(request, auth, telefone))?.messages.filter((m) => m.author === 'SYSTEM').length, { timeout: 20_000 })
    .toBe(1);
  const c = (await conversaDo(request, auth, telefone))!;
  expect(c.messages.find((m) => m.author === 'SYSTEM')?.body).toMatch(/não vamos mais enviar/);

  // pediu de novo: nenhuma confirmacao repetida
  await enviar(request, doCliente(telefone, 'parar'));
  await new Promise((r) => setTimeout(r, 3_000));
  const depois = (await conversaDo(request, auth, telefone))!;
  expect(depois.messages.filter((m) => m.author === 'SYSTEM'), 'confirmacao uma vez so').toHaveLength(1);
  expect(depois.messages.filter((m) => m.author === 'AI'), 'o robo nao falou').toHaveLength(0);

  // a marca aparece para quem atende
  const contatos = (await (await request.get(`${URLS.api}/contacts?busca=${telefone}`, { headers: auth })).json()) as {
    itens: { naoContatarDesde: string | null }[];
  };
  expect(contatos.itens[0]?.naoContatarDesde, 'marcado como nao contatar').toBeTruthy();
});

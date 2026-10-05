import { createHmac, randomUUID } from 'node:crypto';
import { expect, test, type APIRequestContext } from '@playwright/test';
import { URLS } from '../playwright.config';
import { limparLimite } from './apoio/redis';

/**
 * Socio acompanha pelo celular: aviso de mensagem nova (Web Push), aviso que
 * abre direto na conversa, e responder pelo CRM faz o robo parar.
 */

const ADMIN = {
  email: process.env.SEED_ADMIN_EMAIL ?? 'admin@jologelato.com.br',
  senha: process.env.SEED_ADMIN_PASSWORD ?? 'Jolo@Gelato#2026',
};
const APP_SECRET = process.env.META_APP_SECRET ?? 'dev-app-secret';

async function token(api: APIRequestContext): Promise<string> {
  await limparLimite('login');
  const r = await api.post(`${URLS.api}/auth/login`, { data: { email: ADMIN.email, password: ADMIN.senha } });
  expect(r.status()).toBe(200);
  return (await r.json()).accessToken as string;
}

async function mensagemDoCliente(api: APIRequestContext, telefone: string, nome: string, texto: string): Promise<void> {
  const corpo = JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [{ id: '123', changes: [{ field: 'messages', value: {
      messaging_product: 'whatsapp',
      metadata: { phone_number_id: '999' },
      contacts: [{ profile: { name: nome }, wa_id: telefone }],
      messages: [{ from: telefone, id: `wamid.${randomUUID()}`, timestamp: `${Math.floor(Date.now() / 1000)}`, type: 'text', text: { body: texto } }],
    } }] }],
  });
  const r = await api.post(`${URLS.api}/webhooks/meta/whatsapp`, {
    headers: { 'content-type': 'application/json', 'x-hub-signature-256': `sha256=${createHmac('sha256', APP_SECRET).update(corpo).digest('hex')}` },
    data: Buffer.from(corpo, 'utf8'),
  });
  expect(r.status()).toBe(200);
}

async function conversaDo(api: APIRequestContext, auth: string, telefone: string): Promise<{ id: string; mode: string } | null> {
  const r = await api.get(`${URLS.api}/conversations?search=${telefone}`, { headers: { authorization: `Bearer ${auth}` } });
  const itens = (await r.json()) as { id: string; mode: string }[];
  return itens[0] ?? null;
}

test('ligar e desligar o aviso no aparelho; endereco estranho e recusado', async ({ request }) => {
  const auth = await token(request);
  const h = { authorization: `Bearer ${auth}` };

  const chave = await request.get(`${URLS.api}/avisos-no-celular/chave`, { headers: h });
  expect(chave.status()).toBe(200);
  expect((await chave.json()).chave, 'chave publica configurada').toMatch(/^[A-Za-z0-9_-]{80,}$/);

  const keys = { p256dh: 'B'.repeat(87), auth: 'a'.repeat(22) };
  // o servidor manda o aviso para este endereco: so servico de aviso de navegador
  for (const endpoint of ['http://127.0.0.1:6379/x', 'https://exemplo.com/push', 'https://fcm.googleapis.com:8443/x', 'nao-e-endereco']) {
    const r = await request.post(`${URLS.api}/avisos-no-celular`, { headers: h, data: { endpoint, keys } });
    expect(r.status(), endpoint).toBe(422);
  }

  const endpoint = `https://fcm.googleapis.com/fcm/send/teste-${randomUUID()}`;
  const ok = await request.post(`${URLS.api}/avisos-no-celular`, { headers: h, data: { endpoint, keys } });
  expect(ok.status()).toBe(200);
  // ligar de novo no mesmo aparelho nao duplica nem da erro
  expect((await request.post(`${URLS.api}/avisos-no-celular`, { headers: h, data: { endpoint, keys } })).status()).toBe(200);

  const fora = await request.post(`${URLS.api}/avisos-no-celular/desligar`, { headers: h, data: { endpoint } });
  expect(fora.status()).toBe(200);

  // sem login, nada
  expect((await request.get(`${URLS.api}/avisos-no-celular/chave`)).status()).toBe(401);
});

test('responder pelo CRM tira o robo da conversa', async ({ request }) => {
  const auth = await token(request);
  const telefone = `5517${Math.floor(900000000 + Math.random() * 99999999)}`;
  await mensagemDoCliente(request, telefone, 'Cliente Responde CRM', 'Quero saber da franquia');
  await expect.poll(async () => (await conversaDo(request, auth, telefone))?.mode, { timeout: 20_000 }).toBe('AI');
  const conversa = (await conversaDo(request, auth, telefone))!;

  const r = await request.post(`${URLS.api}/conversations/${conversa.id}/reply`, {
    headers: { authorization: `Bearer ${auth}` },
    data: { body: 'Oi, aqui é o sócio!' },
  });
  expect(r.status()).toBe(201);
  expect((await conversaDo(request, auth, telefone))?.mode, 'o robo para na hora').toBe('HUMAN');
});

test('o aviso abre direto na conversa e a tela oferece ligar os avisos', async ({ page, request }) => {
  const auth = await token(request);
  const telefone = `5517${Math.floor(900000000 + Math.random() * 99999999)}`;
  const nome = `Cliente Aviso ${telefone.slice(-4)}`;
  await mensagemDoCliente(request, telefone, nome, 'Oi!');
  await expect.poll(async () => (await conversaDo(request, auth, telefone))?.id, { timeout: 20_000 }).toBeTruthy();
  const conversa = (await conversaDo(request, auth, telefone))!;
  // outra conversa mais nova: sem o endereco, a tela abriria nela
  await mensagemDoCliente(request, `5517${Math.floor(900000000 + Math.random() * 99999999)}`, 'Outro Cliente', 'Oi');

  await limparLimite('login');
  await page.goto(`${URLS.crm}/login`, { waitUntil: 'networkidle' });
  await page.locator('input[type="email"]').fill(ADMIN.email);
  await page.locator('input[type="password"]').fill(ADMIN.senha);
  await page.getByRole('button', { name: /entrar/i }).click();
  await page.waitForURL(/dashboard|termo/);

  // a tela de conversas fica ligada em tempo real: a rede nunca "assenta"
  await page.goto(`${URLS.crm}/inbox?c=${conversa.id}`);
  await expect(page.locator('h2', { hasText: nome })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ligar avisos' })).toBeVisible();
});

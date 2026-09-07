import { randomUUID } from 'node:crypto';
import { expect, test, type APIRequestContext } from '@playwright/test';
import { URLS } from '../playwright.config';
import { limparLimite } from './apoio/redis';

/**
 * A regra que protege a rede: o contrato so pode ser liberado depois do
 * prazo legal contado a partir do RECEBIMENTO da COF pelo candidato.
 */
const ADMIN = {
  email: process.env.SEED_ADMIN_EMAIL ?? 'admin@jologelato.com.br',
  senha: process.env.SEED_ADMIN_PASSWORD ?? 'Jolo@Gelato#2026',
};

async function token(api: APIRequestContext): Promise<string> {
  await limparLimite('login');
  const r = await api.post(`${URLS.api}/auth/login`, { data: { email: ADMIN.email, password: ADMIN.senha } });
  expect(r.status()).toBe(200);
  return (await r.json()).accessToken as string;
}

function auth(t: string) {
  return { Authorization: `Bearer ${t}` };
}

/** Cria um lead novo pelo webhook, para nao mexer nos leads existentes. */
async function leadNovo(api: APIRequestContext, t: string, nome: string): Promise<string> {
  const { createHmac } = await import('node:crypto');
  const telefone = `5517${Math.floor(900000000 + Math.random() * 99999999)}`;
  const corpo = JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [{ id: '1', changes: [{ field: 'messages', value: {
      messaging_product: 'whatsapp',
      metadata: { phone_number_id: '999' },
      contacts: [{ profile: { name: nome }, wa_id: telefone }],
      messages: [{ from: telefone, id: `wamid.${randomUUID()}`, timestamp: `${Math.floor(Date.now() / 1000)}`, type: 'text', text: { body: 'Tenho interesse' } }],
    } }] }],
  });
  const assinatura = `sha256=${createHmac('sha256', process.env.META_APP_SECRET ?? 'dev-app-secret').update(corpo).digest('hex')}`;
  await api.post(`${URLS.api}/webhooks/meta/whatsapp`, {
    headers: { 'content-type': 'application/json', 'x-hub-signature-256': assinatura },
    data: Buffer.from(corpo, 'utf8'),
  });

  for (let i = 0; i < 20; i += 1) {
    const r = await api.get(`${URLS.api}/leads?search=${encodeURIComponent(nome)}`, { headers: auth(t) });
    const lista = (await r.json()) as { leads: { id: string; nome: string }[] };
    const achado = lista.leads.find((l) => l.nome === nome);
    if (achado) return achado.id;
    await new Promise((r2) => setTimeout(r2, 500));
  }
  throw new Error(`o lead "${nome}" nao apareceu no funil`);
}

test.describe('processo de COF', () => {
  test('o contrato so libera depois do prazo legal', async ({ request }) => {
    const t = await token(request);
    const leadId = await leadNovo(request, t, `COF ${randomUUID().slice(0, 6)}`);

    const criada = await request.post(`${URLS.api}/cof`, { headers: auth(t), data: { leadId } });
    expect(criada.status(), 'abrir processo de COF').toBe(201);
    const cofId = (await criada.json()).id as string;

    // 1. sem recebimento nao ha prazo a cumprir
    const semRecebimento = await request.post(`${URLS.api}/cof/${cofId}/liberar-contrato`, {
      headers: auth(t),
      failOnStatusCode: false,
    });
    expect(semRecebimento.status()).toBe(422);

    // 2. recebimento antes do envio nao existe
    const foraDeOrdem = await request.post(`${URLS.api}/cof/${cofId}/recebimento`, {
      headers: auth(t),
      data: {},
      failOnStatusCode: false,
    });
    expect(foraDeOrdem.status(), 'recebimento antes do envio').toBe(422);

    // 3. envio e recebimento, na ordem
    expect((await request.post(`${URLS.api}/cof/${cofId}/envio`, { headers: auth(t), data: {} })).status()).toBe(200);
    expect((await request.post(`${URLS.api}/cof/${cofId}/recebimento`, { headers: auth(t), data: {} })).status()).toBe(200);

    // 4. dentro do prazo, o contrato NAO libera
    const dentroDoPrazo = await request.post(`${URLS.api}/cof/${cofId}/liberar-contrato`, {
      headers: auth(t),
      failOnStatusCode: false,
    });
    expect(dentroDoPrazo.status(), 'liberar contrato antes do prazo').toBe(422);
    const erro = (await dentroDoPrazo.json()) as { error: string; message: string };
    expect(erro.error).toBe('COF_PRAZO_NAO_CUMPRIDO');
    expect(erro.message, 'o recado diz quantos dias faltam').toMatch(/\d+ dia/);

    // 5. o processo aparece na lista com o prazo calculado
    const lista = await request.get(`${URLS.api}/cof`, { headers: auth(t) });
    const processo = ((await lista.json()) as { itens: { id: string; diasRestantes: number; contratoLiberado: boolean }[] })
      .itens.find((c) => c.id === cofId);
    expect(processo?.contratoLiberado).toBe(false);
    expect(processo?.diasRestantes).toBeGreaterThan(0);
  });

  test('recebimento com data anterior ao envio e recusado', async ({ request }) => {
    const t = await token(request);
    const leadId = await leadNovo(request, t, `Data ${randomUUID().slice(0, 6)}`);
    const cofId = (await (await request.post(`${URLS.api}/cof`, { headers: auth(t), data: { leadId } })).json()).id as string;

    await request.post(`${URLS.api}/cof/${cofId}/envio`, { headers: auth(t), data: {} });
    const ontem = new Date(Date.now() - 86_400_000).toISOString();
    const r = await request.post(`${URLS.api}/cof/${cofId}/recebimento`, {
      headers: auth(t),
      data: { quando: ontem },
      failOnStatusCode: false,
    });
    expect(r.status(), 'recebida antes de enviada nao pode').toBe(422);
  });

  test('um lead nao abre dois processos de COF ao mesmo tempo', async ({ request }) => {
    const t = await token(request);
    const leadId = await leadNovo(request, t, `Dupla ${randomUUID().slice(0, 6)}`);

    expect((await request.post(`${URLS.api}/cof`, { headers: auth(t), data: { leadId } })).status()).toBe(201);
    const segunda = await request.post(`${URLS.api}/cof`, { headers: auth(t), data: { leadId }, failOnStatusCode: false });
    expect(segunda.status()).toBe(422);
  });
});

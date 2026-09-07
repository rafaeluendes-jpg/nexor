import { createHmac, randomUUID } from 'node:crypto';
import { expect, test, type APIRequestContext } from '@playwright/test';
import { URLS } from '../playwright.config';

const APP_SECRET = process.env.META_APP_SECRET ?? 'dev-app-secret';
const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN ?? 'dev-verify-token';

function assinar(corpo: string): string {
  return `sha256=${createHmac('sha256', APP_SECRET).update(corpo).digest('hex')}`;
}

function mensagemDeEntrada(wamid: string, telefone = '5517988887777', texto = 'Ola, quero saber da franquia'): string {
  return JSON.stringify({
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
              contacts: [{ profile: { name: 'Teste Automatizado' }, wa_id: telefone }],
              messages: [
                { from: telefone, id: wamid, timestamp: `${Math.floor(Date.now() / 1000)}`, type: 'text', text: { body: texto } },
              ],
            },
          },
        ],
      },
    ],
  });
}

async function enviar(api: APIRequestContext, corpo: string, assinatura?: string) {
  return api.post(`${URLS.api}/webhooks/meta/whatsapp`, {
    headers: {
      'content-type': 'application/json',
      ...(assinatura ? { 'x-hub-signature-256': assinatura } : {}),
    },
    // Buffer: o corpo vai byte a byte, igual ao que foi assinado.
    data: Buffer.from(corpo, 'utf8'),
    failOnStatusCode: false,
  });
}

test.describe('webhook oficial da Meta', () => {
  test('responde ao challenge de verificacao com o token certo', async ({ request }) => {
    const desafio = `desafio-${randomUUID().slice(0, 8)}`;
    const ok = await request.get(
      `${URLS.api}/webhooks/meta/whatsapp?hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=${desafio}`,
    );
    expect(ok.status()).toBe(200);
    expect(await ok.text()).toBe(desafio);
  });

  test('recusa o challenge com token errado', async ({ request }) => {
    const r = await request.get(
      `${URLS.api}/webhooks/meta/whatsapp?hub.mode=subscribe&hub.verify_token=errado&hub.challenge=x`,
      { failOnStatusCode: false },
    );
    expect(r.status()).toBe(403);
  });

  test('recusa evento sem assinatura', async ({ request }) => {
    const r = await enviar(request, mensagemDeEntrada(`wamid.${randomUUID()}`));
    expect(r.status(), 'sem assinatura nao entra').toBe(403);
  });

  test('recusa evento assinado com outro segredo', async ({ request }) => {
    const corpo = mensagemDeEntrada(`wamid.${randomUUID()}`);
    const falsa = `sha256=${createHmac('sha256', 'segredo-do-atacante').update(corpo).digest('hex')}`;
    const r = await enviar(request, corpo, falsa);
    expect(r.status()).toBe(403);
    expect(await r.text(), 'nao contamos ao atacante onde ele errou').not.toContain('assinatura');
  });

  test('recusa corpo alterado depois de assinado', async ({ request }) => {
    const corpo = mensagemDeEntrada(`wamid.${randomUUID()}`);
    const assinatura = assinar(corpo);
    const adulterado = corpo.replace('Ola, quero saber da franquia', 'Ola, quero saber da franquia!!');
    expect(await (await enviar(request, adulterado, assinatura)).status()).toBe(403);
  });

  test('aceita evento assinado e ignora o reenvio do mesmo evento', async ({ request }) => {
    const wamid = `wamid.${randomUUID()}`;
    const corpo = mensagemDeEntrada(wamid);
    const assinatura = assinar(corpo);

    const primeira = await enviar(request, corpo, assinatura);
    expect(primeira.status()).toBe(200);
    expect(await primeira.json()).toEqual({ received: true });

    // a Meta reenvia quando nao tem certeza da entrega: nao pode virar lead duplicado
    const segunda = await enviar(request, corpo, assinatura);
    expect(segunda.status()).toBe(200);
    expect(await segunda.json()).toEqual({ received: true });
  });

  test('nao quebra com payload estranho vindo assinado', async ({ request }) => {
    // formatos que a Meta pode mandar quando nada aconteceu, ou que um dia mudem
    for (const corpo of ['{}', '{"entry":[]}', '{"entry":"nao e lista"}', '{"entry":[{"changes":null}]}']) {
      const r = await enviar(request, corpo, assinar(corpo));
      expect(r.status(), `payload: ${corpo}`).toBe(200);
    }
  });

  test('corpo que nao e JSON e recusado sem derrubar a API', async ({ request }) => {
    const corpo = 'isso nao e json';
    const r = await enviar(request, corpo, assinar(corpo));
    expect([400, 403], `status devolvido: ${r.status()}`).toContain(r.status());
    expect(r.status(), 'nunca erro interno').not.toBe(500);
    const texto = await r.text();
    expect(texto, 'sem pilha de erro na resposta').not.toMatch(/at .*\.(ts|js):\d+/);

    // a API continua atendendo depois disso
    expect((await request.get(`${URLS.api}/health`)).status()).toBe(200);
  });

  test('aceita confirmacao de entrega e leitura', async ({ request }) => {
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
                metadata: { phone_number_id: '999' },
                statuses: [
                  {
                    id: `wamid.${randomUUID()}`,
                    status: 'read',
                    timestamp: `${Math.floor(Date.now() / 1000)}`,
                    recipient_id: '5517988887777',
                  },
                ],
              },
            },
          ],
        },
      ],
    });
    expect((await enviar(request, corpo, assinar(corpo))).status()).toBe(200);
  });
});

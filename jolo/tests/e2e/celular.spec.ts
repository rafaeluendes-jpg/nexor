import { createHmac, randomUUID } from 'node:crypto';
import { expect, test, type APIRequestContext } from '@playwright/test';
import { URLS } from '../playwright.config';
import { limparLimite } from './apoio/redis';

/**
 * Coexistencia: o numero fica no WhatsApp Business do celular do socio E no
 * CRM. O robo atende; se o socio responde pelo celular, o robo para naquela
 * conversa. Aqui o caminho inteiro, pelo webhook assinado de verdade.
 */

const ADMIN = {
  email: process.env.SEED_ADMIN_EMAIL ?? 'admin@jologelato.com.br',
  senha: process.env.SEED_ADMIN_PASSWORD ?? 'Jolo@Gelato#2026',
};
const APP_SECRET = process.env.META_APP_SECRET ?? 'dev-app-secret';
const NUMERO_DA_EMPRESA = '5517999990000';

function assinar(corpo: string): string {
  return `sha256=${createHmac('sha256', APP_SECRET).update(corpo).digest('hex')}`;
}

function evento(field: string, value: Record<string, unknown>): string {
  return JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [{ id: '123', changes: [{ field, value: { messaging_product: 'whatsapp', metadata: { phone_number_id: '999' }, ...value } }] }],
  });
}

function doCliente(telefone: string, texto: string): string {
  return evento('messages', {
    contacts: [{ profile: { name: 'Cliente Coexistencia' }, wa_id: telefone }],
    messages: [{ from: telefone, id: `wamid.${randomUUID()}`, timestamp: `${Math.floor(Date.now() / 1000)}`, type: 'text', text: { body: texto } }],
  });
}

function doCelular(telefone: string, texto: string, wamid = `wamid.${randomUUID()}`): string {
  return evento('smb_message_echoes', {
    message_echoes: [{ from: NUMERO_DA_EMPRESA, to: telefone, id: wamid, timestamp: `${Math.floor(Date.now() / 1000)}`, type: 'text', text: { body: texto } }],
  });
}

async function enviar(api: APIRequestContext, corpo: string): Promise<void> {
  const r = await api.post(`${URLS.api}/webhooks/meta/whatsapp`, {
    headers: { 'content-type': 'application/json', 'x-hub-signature-256': assinar(corpo) },
    data: Buffer.from(corpo, 'utf8'),
  });
  expect(r.status()).toBe(200);
}

async function token(api: APIRequestContext): Promise<string> {
  await limparLimite('login');
  const r = await api.post(`${URLS.api}/auth/login`, { data: { email: ADMIN.email, password: ADMIN.senha } });
  expect(r.status()).toBe(200);
  return (await r.json()).accessToken as string;
}

type Conversa = {
  id: string;
  mode: 'AI' | 'HUMAN';
  lead: { id: string } | null;
  messages: { author: string; direction: string; body: string | null }[];
};

async function conversaDo(api: APIRequestContext, auth: string, telefone: string): Promise<Conversa | null> {
  const lista = await api.get(`${URLS.api}/conversations?search=${telefone}`, { headers: { authorization: `Bearer ${auth}` } });
  const itens = (await lista.json()) as { id: string }[];
  if (!itens[0]) return null;
  const r = await api.get(`${URLS.api}/conversations/${itens[0].id}`, { headers: { authorization: `Bearer ${auth}` } });
  return (await r.json()) as Conversa;
}

async function tarefasDoLead(api: APIRequestContext, auth: string, leadId: string): Promise<number> {
  const r = await api.get(`${URLS.api}/tasks?lead=${leadId}`, { headers: { authorization: `Bearer ${auth}` } });
  return ((await r.json()) as { itens: unknown[] }).itens.length;
}

test('socio responde pelo celular: a mensagem entra no CRM e o robo para', async ({ request }) => {
  const auth = await token(request);
  const telefone = `5517${Math.floor(900000000 + Math.random() * 99999999)}`;

  // 1. o interessado escreve; a conversa nasce com o robo atendendo
  await enviar(request, doCliente(telefone, 'Oi, quero saber da franquia'));
  await expect.poll(async () => (await conversaDo(request, auth, telefone))?.mode, { timeout: 20_000 }).toBe('AI');
  const inicio = (await conversaDo(request, auth, telefone))!;
  expect(inicio.lead, 'virou lead').toBeTruthy();
  const leadId = inicio.lead!.id;
  // robo desligado neste ambiente: a primeira mensagem vira tarefa para alguem
  await expect.poll(() => tarefasDoLead(request, auth, leadId), { timeout: 20_000 }).toBeGreaterThan(0);
  const tarefasAntes = await tarefasDoLead(request, auth, leadId);

  // 2. o socio responde pelo WhatsApp Business do celular
  const wamidEco = `wamid.${randomUUID()}`;
  await enviar(request, doCelular(telefone, 'Oi! Aqui e o socio, vou te atender', wamidEco));
  await expect
    .poll(async () => (await conversaDo(request, auth, telefone))?.mode, { timeout: 20_000, message: 'o robo sai de cena' })
    .toBe('HUMAN');
  const depois = (await conversaDo(request, auth, telefone))!;
  const doSocio = depois.messages.filter((m) => m.author === 'HUMAN');
  expect(doSocio, 'a resposta do celular aparece no CRM').toHaveLength(1);
  expect(doSocio[0]).toMatchObject({ direction: 'OUTBOUND', body: 'Oi! Aqui e o socio, vou te atender' });

  // a Meta reenvia o mesmo eco: nao duplica
  await enviar(request, doCelular(telefone, 'Oi! Aqui e o socio, vou te atender', wamidEco));

  // 3. o interessado responde de novo: o robo continua calado
  await enviar(request, doCliente(telefone, 'Otimo, obrigado!'));
  await expect
    .poll(async () => (await conversaDo(request, auth, telefone))?.messages.filter((m) => m.direction === 'INBOUND').length, { timeout: 20_000 })
    .toBe(2);
  // tempo para o robo "tentar" responder, se fosse responder
  await new Promise((r) => setTimeout(r, 3_000));
  const fim = (await conversaDo(request, auth, telefone))!;
  expect(fim.mode).toBe('HUMAN');
  expect(fim.messages.filter((m) => m.author === 'HUMAN'), 'eco repetido nao duplicou').toHaveLength(1);
  expect(fim.messages.filter((m) => m.author === 'AI'), 'o robo nao falou').toHaveLength(0);
  expect(await tarefasDoLead(request, auth, leadId), 'nenhuma tarefa nova de "responder": a conversa ja tem gente').toBe(tarefasAntes);
});

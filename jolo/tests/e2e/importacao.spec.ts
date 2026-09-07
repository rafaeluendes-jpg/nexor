import { randomUUID } from 'node:crypto';
import { expect, test, type APIRequestContext } from '@playwright/test';
import { URLS } from '../playwright.config';
import { limparLimite } from './apoio/redis';

/**
 * Trazer os leads antigos de planilha. O que precisa ser verdade:
 * ninguem entra duas vezes, e nada e gravado antes da conferencia.
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

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

/** Telefone de teste que ainda nao existe no banco. */
function telefoneNovo(): string {
  const n = Math.floor(900000000 + Math.random() * 99999999);
  return `(17) ${String(n).slice(0, 5)}-${String(n).slice(5)}`;
}

function planilha(linhas: string[][]): Buffer {
  return Buffer.from(linhas.map((l) => l.join(';')).join('\n'), 'utf8');
}

test.beforeEach(async () => {
  await limparLimite('login');
});

test.describe('trazer leads de planilha', () => {
  test('a conferência não grava nada', async ({ request }) => {
    const t = await token(request);
    const antes = ((await (await request.get(`${URLS.api}/leads?take=1`, { headers: auth(t) })).json()) as { total: number }).total;

    const arquivo = planilha([
      ['Nome do lead', 'Celular', 'Cidade'],
      [`Conferencia ${randomUUID().slice(0, 6)}`, telefoneNovo(), 'Jales'],
    ]);

    const r = await request.post(`${URLS.api}/import/conferir`, {
      headers: auth(t),
      multipart: { file: { name: 'base.csv', mimeType: 'text/csv', buffer: arquivo } },
    });
    expect(r.status()).toBe(200);
    expect((await r.json()).resumo.novo).toBe(1);

    const depois = ((await (await request.get(`${URLS.api}/leads?take=1`, { headers: auth(t) })).json()) as { total: number }).total;
    expect(depois, 'conferir não pode criar lead').toBe(antes);
  });

  test('importa e não deixa entrar duas vezes', async ({ request }) => {
    const t = await token(request);
    const nome = `Antigo ${randomUUID().slice(0, 6)}`;
    const tel = telefoneNovo();
    const arquivo = planilha([
      ['Nome do lead', 'Celular', 'Cidade de interesse', 'UF'],
      [nome, tel, 'Jales', 'SP'],
    ]);

    const primeira = await request.post(`${URLS.api}/import/confirmar`, {
      headers: auth(t),
      multipart: {
        file: { name: 'base.csv', mimeType: 'text/csv', buffer: arquivo },
        rotulo: `Lote ${randomUUID().slice(0, 5)}`,
      },
    });
    expect(primeira.status()).toBe(200);
    expect((await primeira.json()).importados).toBe(1);

    // o lead entrou, na etapa de nutrição e com a origem separada
    const lista = (await (await request.get(`${URLS.api}/leads?search=${encodeURIComponent(nome)}`, {
      headers: auth(t),
    })).json()) as { leads: { nome: string; etapa: { key: string }; origem: string }[] };
    const lead = lista.leads.find((l) => l.nome === nome);
    expect(lead?.etapa.key, 'lead antigo entra em nutrição, não como lead novo').toBe('NUTRICAO');
    expect(lead?.origem).toBe('base_antiga');

    // a mesma planilha de novo não pode duplicar ninguém
    const segunda = await request.post(`${URLS.api}/import/confirmar`, {
      headers: auth(t),
      multipart: {
        file: { name: 'base.csv', mimeType: 'text/csv', buffer: arquivo },
        rotulo: 'Lote repetido',
      },
      failOnStatusCode: false,
    });
    expect(segunda.status(), 'planilha repetida não importa nada').toBe(422);
  });

  test('separa repetido, sem telefone e telefone inválido', async ({ request }) => {
    const t = await token(request);
    const tel = telefoneNovo();
    const arquivo = planilha([
      ['Nome', 'Whatsapp', 'Cidade'],
      ['Um', tel, 'Jales'],
      ['Dois (mesmo número)', tel.replace(/\D/g, ''), 'Jales'],
      ['Sem telefone', '', 'Jales'],
      ['Quebrado', '123', 'Jales'],
      ['', '', ''],
    ]);

    const r = await request.post(`${URLS.api}/import/conferir`, {
      headers: auth(t),
      multipart: { file: { name: 'base.csv', mimeType: 'text/csv', buffer: arquivo } },
    });
    const leitura = (await r.json()) as { resumo: Record<string, number>; linhas: unknown[] };
    expect(leitura.resumo.novo).toBe(1);
    expect(leitura.resumo.repetido_no_arquivo).toBe(1);
    expect(leitura.resumo.sem_telefone).toBe(1);
    expect(leitura.resumo.telefone_invalido).toBe(1);
    expect(leitura.linhas, 'linha vazia não vira erro').toHaveLength(4);
  });

  test('recusa planilha sem coluna de telefone', async ({ request }) => {
    const t = await token(request);
    const r = await request.post(`${URLS.api}/import/conferir`, {
      headers: auth(t),
      multipart: {
        file: { name: 'base.csv', mimeType: 'text/csv', buffer: planilha([['Nome', 'Cidade'], ['Carlos', 'Jales']]) },
      },
      failOnStatusCode: false,
    });
    expect(r.status()).toBe(422);
    expect((await r.json()).message).toContain('telefone');
  });

  test('exige um nome para o lote', async ({ request }) => {
    const t = await token(request);
    const r = await request.post(`${URLS.api}/import/confirmar`, {
      headers: auth(t),
      multipart: {
        file: {
          name: 'base.csv',
          mimeType: 'text/csv',
          buffer: planilha([['Nome', 'Telefone'], ['Carlos', telefoneNovo()]]),
        },
      },
      failOnStatusCode: false,
    });
    expect(r.status()).toBe(422);
  });

  test('o histórico mostra o lote importado', async ({ request }) => {
    const t = await token(request);
    const r = await request.get(`${URLS.api}/import`, { headers: auth(t) });
    expect(r.status()).toBe(200);
    const lista = (await r.json()) as { itens: { rotulo: string; importados: number; quem: string }[] };
    expect(lista.itens.length).toBeGreaterThan(0);
    expect(lista.itens[0]?.quem, 'o histórico diz quem importou').toBeTruthy();
  });
});

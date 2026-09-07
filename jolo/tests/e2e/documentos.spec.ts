import { randomUUID } from 'node:crypto';
import { expect, test, type APIRequestContext } from '@playwright/test';
import { URLS } from '../playwright.config';
import { limparLimite } from './apoio/redis';

const ADMIN = {
  email: process.env.SEED_ADMIN_EMAIL ?? 'admin@jologelato.com.br',
  senha: process.env.SEED_ADMIN_PASSWORD ?? 'Jolo@Gelato#2026',
};

/** PDF minusculo, valido o bastante para o teste. */
const PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n', 'utf8');

async function token(api: APIRequestContext): Promise<string> {
  await limparLimite('login');
  const r = await api.post(`${URLS.api}/auth/login`, { data: { email: ADMIN.email, password: ADMIN.senha } });
  return (await r.json()).accessToken as string;
}

test.describe('documentos', () => {
  test('guarda o arquivo e devolve so para quem tem permissao', async ({ request }) => {
    const t = await token(request);
    const nome = `cof-${randomUUID().slice(0, 6)}.pdf`;

    const enviado = await request.post(`${URLS.api}/documents`, {
      headers: { Authorization: `Bearer ${t}` },
      multipart: {
        file: { name: nome, mimeType: 'application/pdf', buffer: PDF },
        categoria: 'COF',
      },
    });
    expect(enviado.status()).toBe(201);
    const doc = (await enviado.json()) as { id: string; nome: string; tamanhoBytes: number };
    expect(doc.nome).toBe(nome);
    expect(doc.tamanhoBytes).toBe(PDF.length);

    // com token: baixa e o conteudo e o mesmo
    const comToken = await request.get(`${URLS.api}/documents/${doc.id}/arquivo`, {
      headers: { Authorization: `Bearer ${t}` },
    });
    expect(comToken.status()).toBe(200);
    expect(Buffer.from(await comToken.body()).equals(PDF)).toBe(true);
    expect(comToken.headers()['cache-control'], 'documento privado nao fica em cache').toContain('no-store');

    // sem token: nao baixa
    const semToken = await request.get(`${URLS.api}/documents/${doc.id}/arquivo`, { failOnStatusCode: false });
    expect(semToken.status()).toBe(401);
  });

  test('recusa tipo de arquivo que nao esta na lista', async ({ request }) => {
    const t = await token(request);
    const r = await request.post(`${URLS.api}/documents`, {
      headers: { Authorization: `Bearer ${t}` },
      multipart: {
        file: { name: 'script.sh', mimeType: 'application/x-sh', buffer: Buffer.from('rm -rf /', 'utf8') },
        categoria: 'OUTRO',
      },
      failOnStatusCode: false,
    });
    expect(r.status()).toBe(422);
    expect((await r.json()).message).toContain('nao aceito');
  });

  test('recusa categoria inventada', async ({ request }) => {
    const t = await token(request);
    const r = await request.post(`${URLS.api}/documents`, {
      headers: { Authorization: `Bearer ${t}` },
      multipart: {
        file: { name: 'a.pdf', mimeType: 'application/pdf', buffer: PDF },
        categoria: 'CATEGORIA_QUE_NAO_EXISTE',
      },
      failOnStatusCode: false,
    });
    expect(r.status()).toBe(422);
  });

  test('nome de arquivo com caminho nao escapa da pasta', async ({ request }) => {
    const t = await token(request);
    const enviado = await request.post(`${URLS.api}/documents`, {
      headers: { Authorization: `Bearer ${t}` },
      multipart: {
        // nome malicioso: se fosse usado como caminho, escreveria fora da pasta
        file: { name: '../../../etc/passwd.pdf', mimeType: 'application/pdf', buffer: PDF },
        categoria: 'OUTRO',
      },
    });
    expect(enviado.status(), 'o arquivo entra, mas com nome escolhido por nos').toBe(201);

    // o download continua funcionando: prova que o arquivo foi para o lugar certo
    const doc = (await enviado.json()) as { id: string };
    const baixado = await request.get(`${URLS.api}/documents/${doc.id}/arquivo`, {
      headers: { Authorization: `Bearer ${t}` },
    });
    expect(baixado.status()).toBe(200);
  });

  test('a lista mostra o que foi guardado', async ({ request }) => {
    const t = await token(request);
    const r = await request.get(`${URLS.api}/documents?categoria=COF`, { headers: { Authorization: `Bearer ${t}` } });
    expect(r.status()).toBe(200);
    const lista = (await r.json()) as { itens: { categoria: string }[] };
    expect(lista.itens.every((d) => d.categoria === 'COF')).toBe(true);
  });
});

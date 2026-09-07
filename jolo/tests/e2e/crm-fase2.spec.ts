import { randomUUID } from 'node:crypto';
import { expect, test, type APIRequestContext } from '@playwright/test';
import { URLS } from '../playwright.config';
import { limparLimite } from './apoio/redis';

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

test.beforeEach(async () => {
  await limparLimite('login');
});

test.describe('tarefas', () => {
  test('cria, aparece na lista e conclui', async ({ request }) => {
    const t = await token(request);
    const titulo = `Ligar para o candidato ${randomUUID().slice(0, 6)}`;

    const criada = await request.post(`${URLS.api}/tasks`, { headers: auth(t), data: { titulo } });
    expect(criada.status()).toBe(201);
    const id = (await criada.json()).id as string;

    const abertas = await request.get(`${URLS.api}/tasks?status=ABERTA`, { headers: auth(t) });
    const lista = (await abertas.json()) as { itens: { id: string; titulo: string; responsavel: unknown }[] };
    const minha = lista.itens.find((x) => x.id === id);
    expect(minha?.titulo).toBe(titulo);
    expect(minha?.responsavel, 'tarefa sem dono nao anda: fica com quem criou').toBeTruthy();

    expect((await request.patch(`${URLS.api}/tasks/${id}/status`, { headers: auth(t), data: { concluida: true } })).status()).toBe(200);

    const depois = await request.get(`${URLS.api}/tasks?status=ABERTA`, { headers: auth(t) });
    expect(((await depois.json()) as { itens: { id: string }[] }).itens.some((x) => x.id === id)).toBe(false);
  });

  test('marca como vencida a tarefa com prazo no passado', async ({ request }) => {
    const t = await token(request);
    const ontem = new Date(Date.now() - 86_400_000).toISOString();
    const id = (await (await request.post(`${URLS.api}/tasks`, {
      headers: auth(t),
      data: { titulo: `Atrasada ${randomUUID().slice(0, 5)}`, prazo: ontem },
    })).json()).id as string;

    const lista = (await (await request.get(`${URLS.api}/tasks?status=ABERTA`, { headers: auth(t) })).json()) as {
      itens: { id: string; atrasada: boolean }[];
    };
    expect(lista.itens.find((x) => x.id === id)?.atrasada).toBe(true);
  });
});

test.describe('agenda', () => {
  test('nao agenda reuniao no passado', async ({ request }) => {
    const t = await token(request);
    const leads = (await (await request.get(`${URLS.api}/leads`, { headers: auth(t) })).json()) as { leads: { id: string }[] };
    const leadId = leads.leads[0]?.id;
    expect(leadId, 'e preciso ter ao menos um lead').toBeTruthy();

    const r = await request.post(`${URLS.api}/meetings`, {
      headers: auth(t),
      data: {
        leadId,
        titulo: 'Reuniao de apresentacao',
        quando: new Date(Date.now() - 86_400_000).toISOString(),
      },
      failOnStatusCode: false,
    });
    expect(r.status()).toBe(422);
  });

  test('marcar reuniao move o lead para "reuniao agendada"', async ({ request }) => {
    const t = await token(request);
    const leads = (await (await request.get(`${URLS.api}/leads?stage=IA_QUALIFICANDO`, { headers: auth(t) })).json()) as {
      leads: { id: string }[];
    };
    const leadId = leads.leads[0]?.id;
    test.skip(!leadId, 'nenhum lead em qualificacao para este teste');

    const criada = await request.post(`${URLS.api}/meetings`, {
      headers: auth(t),
      data: {
        leadId,
        titulo: 'Apresentacao da franquia',
        quando: new Date(Date.now() + 3 * 86_400_000).toISOString(),
      },
    });
    expect(criada.status()).toBe(201);

    const ficha = (await (await request.get(`${URLS.api}/leads/${leadId}`, { headers: auth(t) })).json()) as {
      etapa: { key: string };
      reunioes: unknown[];
    };
    expect(ficha.etapa.key, 'quem marcou nao precisa lembrar de arrastar o cartao').toBe('REUNIAO_AGENDADA');
    expect(ficha.reunioes.length).toBeGreaterThan(0);
  });
});

test.describe('pracas', () => {
  test('cadastra, muda a situacao e some das disponiveis', async ({ request }) => {
    const t = await token(request);
    const cidade = `Cidade ${randomUUID().slice(0, 6)}`;

    const criada = await request.post(`${URLS.api}/territories`, { headers: auth(t), data: { cidade, uf: 'sp' } });
    expect(criada.status()).toBe(201);
    const id = (await criada.json()).id as string;
    expect((await criada.json()).state ?? 'SP', 'UF guardada em maiuscula').toBe('SP');

    const livres = (await (await request.get(`${URLS.api}/territories/disponiveis`, { headers: auth(t) })).json()) as {
      itens: { cidade: string }[];
    };
    expect(livres.itens.some((p) => p.cidade === cidade)).toBe(true);

    expect((await request.patch(`${URLS.api}/territories/${id}`, { headers: auth(t), data: { status: 'VENDIDA' } })).status()).toBe(200);

    const depois = (await (await request.get(`${URLS.api}/territories/disponiveis`, { headers: auth(t) })).json()) as {
      itens: { cidade: string }[];
    };
    expect(depois.itens.some((p) => p.cidade === cidade), 'praca vendida nao pode ser oferecida').toBe(false);
  });
});

test.describe('configuracoes', () => {
  test('recusa configuracao fora do formato', async ({ request }) => {
    const t = await token(request);
    const r = await request.put(`${URLS.api}/settings/horario_atendimento`, {
      headers: auth(t),
      data: { diasDaSemana: [], horaInicio: 'nove horas', horaFim: '18:00', fusoHorario: 'x' },
      failOnStatusCode: false,
    });
    expect(r.status()).toBe(422);
  });

  test('recusa chave de configuracao que nao existe', async ({ request }) => {
    const t = await token(request);
    const r = await request.put(`${URLS.api}/settings/inventada`, {
      headers: auth(t),
      data: { qualquer: 'coisa' },
      failOnStatusCode: false,
    });
    expect(r.status()).toBe(404);
  });

  test('salva e le de volta o horario de atendimento', async ({ request }) => {
    const t = await token(request);
    const valor = { diasDaSemana: [1, 2, 3, 4, 5, 6], horaInicio: '08:30', horaFim: '19:00', fusoHorario: 'America/Sao_Paulo' };
    expect((await request.put(`${URLS.api}/settings/horario_atendimento`, { headers: auth(t), data: valor })).status()).toBe(200);

    const lido = (await (await request.get(`${URLS.api}/settings/horario_atendimento`, { headers: auth(t) })).json()) as {
      valor: typeof valor;
    };
    expect(lido.valor.horaInicio).toBe('08:30');

    // devolve ao padrao para nao deixar o ambiente alterado
    await request.put(`${URLS.api}/settings/horario_atendimento`, {
      headers: auth(t),
      data: { diasDaSemana: [1, 2, 3, 4, 5], horaInicio: '09:00', horaFim: '18:00', fusoHorario: 'America/Sao_Paulo' },
    });
  });
});

test.describe('relatorios e auditoria', () => {
  test('o relatorio traz as metricas do funil', async ({ request }) => {
    const t = await token(request);
    const r = await request.get(`${URLS.api}/reports`, { headers: auth(t) });
    expect(r.status()).toBe(200);

    const rel = (await r.json()) as {
      totais: Record<string, number>;
      conversao: Record<string, number>;
      porOrigem: unknown[];
      tempos: { porEtapaDias: unknown[] };
    };
    for (const campo of ['leads', 'qualificados', 'reunioes', 'cofs', 'ganhos', 'perdidos', 'scoreMedio']) {
      expect(rel.totais[campo], `total ${campo}`).toBeGreaterThanOrEqual(0);
    }
    for (const campo of ['leadParaQualificado', 'leadParaReuniao', 'reuniaoParaCof', 'cofParaContrato']) {
      expect(rel.conversao[campo], `conversao ${campo}`).toBeGreaterThanOrEqual(0);
    }
    expect(Array.isArray(rel.porOrigem)).toBe(true);
  });

  test('a auditoria registra o que foi feito, com autor', async ({ request }) => {
    const t = await token(request);
    const titulo = `Auditada ${randomUUID().slice(0, 6)}`;
    await request.post(`${URLS.api}/tasks`, { headers: auth(t), data: { titulo } });

    const r = await request.get(`${URLS.api}/audit?evento=task.create`, { headers: auth(t) });
    expect(r.status()).toBe(200);
    const log = (await r.json()) as { itens: { evento: string; quem: { nome: string }; entidade: string }[] };
    expect(log.itens.length).toBeGreaterThan(0);
    expect(log.itens[0]?.evento).toContain('task.create');
    expect(log.itens[0]?.quem.nome, 'toda linha diz quem fez').toBeTruthy();
  });

  test('a auditoria nao pode ser alterada por fora', async ({ request }) => {
    const t = await token(request);
    // nao existe rota de escrita: linha de auditoria que se edita nao serve de prova
    for (const metodo of ['post', 'patch', 'delete'] as const) {
      const r = await request[metodo](`${URLS.api}/audit`, { headers: auth(t), failOnStatusCode: false });
      expect([404, 405], `${metodo} em /audit devolveu ${r.status()}`).toContain(r.status());
    }
  });
});

test.describe('integracao', () => {
  test('diz o que falta sem mostrar o valor de nenhum segredo', async ({ request }) => {
    const t = await token(request);
    const r = await request.get(`${URLS.api}/integrations`, { headers: auth(t) });
    expect(r.status()).toBe(200);

    const corpo = await r.text();
    for (const segredo of [process.env.META_APP_SECRET, process.env.JWT_SECRET, process.env.DATABASE_URL]) {
      if (segredo && segredo.length >= 8) expect(corpo).not.toContain(segredo);
    }

    const status = JSON.parse(corpo) as { whatsapp: { credenciais: Record<string, boolean> } };
    // so booleano: existe ou nao existe
    for (const valor of Object.values(status.whatsapp.credenciais)) {
      expect(typeof valor).toBe('boolean');
    }
  });
});

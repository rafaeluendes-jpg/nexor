/**
 * Dados de DEMONSTRACAO, para olhar as telas com conteudo realista.
 *
 * NAO e semente de producao: apaga leads, contatos, conversas, reunioes,
 * tarefas, COFs e documentos existentes e cria um conjunto de exemplo.
 * Roda so em desenvolvimento; recusa NODE_ENV=production.
 *
 * Uso: npx tsx scripts/dados-demo.ts
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

if (process.env.NODE_ENV === 'production') {
  console.error('Este script apaga dados. Nao roda em producao.');
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? '' }),
});

const dias = (n: number): Date => new Date(Date.now() - n * 86_400_000);
/** Quantos dias atras este candidato chegou. Os mais avancados no funil chegaram antes. */
const chegouHa = (i: number): number => [19, 18, 16, 15, 13, 12, 10, 9, 7, 6, 5, 4, 3, 2, 2, 1, 0][i] ?? 0;
const daquiA = (n: number): Date => new Date(Date.now() + n * 86_400_000);

const CANDIDATOS = [
  { nome: 'Marina Albuquerque', tel: '5519998812340', cidade: 'Campinas', uf: 'SP', etapa: 'GANHO', score: 92, temp: 'QUENTE', capital: 'R$ 350.000 a R$ 450.000', prazo: 'Imediato', origem: 'instagram', campanha: 'franquias-setembro', exp: 'Já teve loja de roupas por 8 anos' },
  { nome: 'Ricardo Sampaio', tel: '5511997745120', cidade: 'São Bernardo do Campo', uf: 'SP', etapa: 'CONTRATO', score: 88, temp: 'QUENTE', capital: 'R$ 400.000', prazo: 'Ate 3 meses', origem: 'google', campanha: 'busca-franquia-gelato', exp: 'Sócio em rede de pet shop' },
  { nome: 'Juliana Prado', tel: '5517998823410', cidade: 'Ribeirão Preto', uf: 'SP', etapa: 'PRAZO_COF', score: 85, temp: 'QUENTE', capital: 'R$ 350.000', prazo: 'Ate 3 meses', origem: 'instagram', campanha: 'franquias-setembro', exp: 'Gerente comercial há 12 anos' },
  { nome: 'Eduardo Nakamura', tel: '5541998734560', cidade: 'Curitiba', uf: 'PR', etapa: 'COF_ENVIADA', score: 81, temp: 'QUENTE', capital: 'R$ 380.000', prazo: 'Ate 6 meses', origem: 'indicacao', campanha: null, exp: 'Empresário do setor de alimentos' },
  { nome: 'Camila Ferraz', tel: '5521998812277', cidade: 'Niterói', uf: 'RJ', etapa: 'VISITA_UNIDADE', score: 78, temp: 'QUENTE', capital: 'R$ 350.000', prazo: 'Ate 6 meses', origem: 'facebook', campanha: 'expansao-rj', exp: 'Primeira experiência como dona' },
  { nome: 'Bruno Tavares', tel: '5531998845611', cidade: 'Belo Horizonte', uf: 'MG', etapa: 'APRESENTACAO_REALIZADA', score: 74, temp: 'QUENTE', capital: 'R$ 300.000 a R$ 400.000', prazo: 'Ate 6 meses', origem: 'instagram', campanha: 'franquias-setembro', exp: 'Trabalha com food service' },
  { nome: 'Patricia Coelho', tel: '5548998823390', cidade: 'Florianópolis', uf: 'SC', etapa: 'REUNIAO_AGENDADA', score: 71, temp: 'QUENTE', capital: 'R$ 350.000', prazo: 'Ate 3 meses', origem: 'google', campanha: 'busca-franquia-gelato', exp: 'Investidora, não vai operar' },
  { nome: 'Anderson Lima', tel: '5562998812044', cidade: 'Goiânia', uf: 'GO', etapa: 'QUALIFICADO', score: 66, temp: 'MORNO', capital: 'R$ 250.000 a R$ 350.000', prazo: 'Ate 12 meses', origem: 'instagram', campanha: 'franquias-setembro', exp: 'Vendedor autônomo' },
  { nome: 'Larissa Monteiro', tel: '5551998877123', cidade: 'Porto Alegre', uf: 'RS', etapa: 'QUALIFICADO', score: 62, temp: 'MORNO', capital: 'R$ 300.000', prazo: 'Ate 12 meses', origem: 'organico', campanha: null, exp: 'Administradora' },
  { nome: 'Fernando Bastos', tel: '5585998834501', cidade: 'Fortaleza', uf: 'CE', etapa: 'IA_QUALIFICANDO', score: 48, temp: 'MORNO', capital: 'Ainda avaliando', prazo: 'Sem prazo definido', origem: 'facebook', campanha: 'expansao-nordeste', exp: null },
  { nome: 'Tatiane Rocha', tel: '5511998845672', cidade: 'Sao Paulo', uf: 'SP', etapa: 'IA_QUALIFICANDO', score: 44, temp: 'MORNO', capital: 'R$ 200.000', prazo: 'Ate 12 meses', origem: 'instagram', campanha: 'franquias-setembro', exp: null },
  { nome: 'Marcelo Dias', tel: '5527998812905', cidade: 'Vitória', uf: 'ES', etapa: 'NOVO_LEAD', score: 20, temp: 'FRIO', capital: null, prazo: null, origem: 'whatsapp', campanha: null, exp: null },
  { nome: 'Simone Vasques', tel: '5571998867234', cidade: 'Salvador', uf: 'BA', etapa: 'NOVO_LEAD', score: 15, temp: 'FRIO', capital: null, prazo: null, origem: 'landing', campanha: null, exp: null },
  { nome: 'Gustavo Peixoto', tel: '5511998812390', cidade: 'Santos', uf: 'SP', etapa: 'NEGOCIACAO', score: 83, temp: 'QUENTE', capital: 'R$ 450.000', prazo: 'Imediato', origem: 'indicacao', campanha: null, exp: 'Franqueado de outra rede' },
  { nome: 'Renata Guimarães', tel: '5519998834788', cidade: 'Piracicaba', uf: 'SP', etapa: 'NUTRICAO', score: 39, temp: 'FRIO', capital: 'R$ 150.000', prazo: 'Sem prazo definido', origem: 'instagram', campanha: 'franquias-setembro', exp: null },
  { nome: 'Paulo Menezes', tel: '5511998823001', cidade: 'Guarulhos', uf: 'SP', etapa: 'PERDIDO', score: 28, temp: 'FRIO', capital: 'R$ 100.000', prazo: null, origem: 'facebook', campanha: 'expansao-sp', exp: null, perda: 'Capital abaixo do investimento necessário' },
  { nome: 'Aline Camargo', tel: '5511998845990', cidade: 'Osasco', uf: 'SP', etapa: 'SEM_RESPOSTA', score: 31, temp: 'FRIO', capital: null, prazo: null, origem: 'google', campanha: 'busca-franquia-gelato', exp: null },
];

const CONVERSAS = [
  { de: 'cliente', texto: 'Boa tarde! Vi o anúncio de vocês sobre franquia. Como funciona?' },
  { de: 'ia', texto: 'Olá! Que bom falar com você sobre a franquia Jolô. Sou do time de expansão. Para te explicar direitinho, me conta: em qual cidade você pensa em abrir?' },
  { de: 'cliente', texto: 'Estou pensando em Campinas mesmo, moro aqui há 15 anos.' },
  { de: 'ia', texto: 'Campinas é uma praça muito boa e está disponível. Sobre o investimento: o valor total fica em torno de R$ 350.000. Você já tem esse capital disponível ou está avaliando financiamento?' },
  { de: 'cliente', texto: 'Tenho sim, entre 350 e 450 mil. Já tive loja antes, de roupas, por 8 anos.' },
  { de: 'ia', texto: 'Ótimo, experiência com loja própria ajuda bastante. E qual é o seu prazo para abrir?' },
  { de: 'cliente', texto: 'Quero começar o quanto antes, já estou decidida.' },
  { de: 'humano', texto: 'Marina, aqui é o Rafael, sou um dos sócios. Vi seu interesse e adorei seu perfil. Podemos conversar por vídeo amanhã às 15h?' },
  { de: 'cliente', texto: 'Podemos sim! Vou adorar conhecer melhor.' },
];

async function main(): Promise<void> {
  const org = await prisma.organization.findFirstOrThrow({ orderBy: { createdAt: 'asc' } });
  // O responsavel dos leads e o administrador, nunca uma conta que sobrou de teste.
  const admin =
    (await prisma.user.findFirst({
      where: { organizationId: org.id, roles: { some: { role: { name: 'SUPER_ADMIN' } } } },
      orderBy: { createdAt: 'asc' },
    })) ?? (await prisma.user.findFirstOrThrow({ where: { organizationId: org.id } }));
  const pipeline = await prisma.pipeline.findFirstOrThrow({ where: { organizationId: org.id } });
  const etapas = await prisma.pipelineStage.findMany({ where: { pipelineId: pipeline.id } });
  const porChave = new Map(etapas.map((e) => [e.key, e]));

  console.log('Limpando dados anteriores…');
  await prisma.$transaction([
    prisma.messageStatusEvent.deleteMany(),
    prisma.message.deleteMany(),
    prisma.whatsappReferral.deleteMany(),
    prisma.aiMessage.deleteMany(),
    prisma.aiHandoff.deleteMany(),
    prisma.aiSession.deleteMany(),
    prisma.conversation.deleteMany(),
    prisma.document.deleteMany(),
    prisma.cofProcess.deleteMany(),
    prisma.meeting.deleteMany(),
    prisma.task.deleteMany(),
    prisma.note.deleteMany(),
    prisma.activity.deleteMany(),
    prisma.qualificationAnswer.deleteMany(),
    prisma.leadScore.deleteMany(),
    prisma.pipelineStageHistory.deleteMany(),
    prisma.lead.deleteMany(),
    prisma.contact.deleteMany(),
    prisma.attributionSession.deleteMany(),
    prisma.webhookEvent.deleteMany(),
  ]);

  const perguntas = await prisma.qualificationQuestion.findMany({ orderBy: { position: 'asc' } });

  for (const [i, c] of CANDIDATOS.entries()) {
    const etapa = porChave.get(c.etapa);
    if (!etapa) continue;

    const atribuicao = await prisma.attributionSession.create({
      data: {
        organizationId: org.id,
        trackingId: `jl_demo${i.toString().padStart(4, '0')}${Date.now().toString(36)}`,
        firstTouchSource: c.origem,
        firstTouchMedium: c.campanha ? 'cpc' : 'organic',
        firstTouchCampaign: c.campanha,
        landingPage: 'https://franquias.jologelato.com.br/',
        createdAt: dias(chegouHa(i)),
      },
    });

    const contato = await prisma.contact.create({
      data: {
        organizationId: org.id,
        name: c.nome,
        phoneE164: c.tel,
        whatsappId: c.tel,
        city: c.cidade,
        state: c.uf,
        createdAt: dias(chegouHa(i)),
      },
    });

    const lead = await prisma.lead.create({
      data: {
        organizationId: org.id,
        contactId: contato.id,
        pipelineId: pipeline.id,
        stageId: etapa.id,
        attributionId: atribuicao.id,
        ownerId: admin.id,
        status: c.etapa === 'GANHO' ? 'GANHO' : c.etapa === 'PERDIDO' ? 'PERDIDO' : 'ABERTO',
        score: c.score,
        temperature: c.temp as never,
        desiredCity: c.cidade,
        desiredState: c.uf,
        capitalRange: c.capital,
        investmentHorizon: c.prazo,
        businessExperience: c.exp,
        availability: c.score > 60 ? 'Dedicação integral' : null,
        bestContactTime: c.score > 60 ? 'Tarde' : null,
        lostReason: 'perda' in c ? (c as { perda: string }).perda : null,
        firstContactAt: dias(chegouHa(i)),
        lastContactAt: dias(Math.max(0, chegouHa(i) - 1)),
        createdAt: dias(chegouHa(i)),
      },
    });

    // respostas de qualificacao
    for (const [j, p] of perguntas.slice(0, c.score > 60 ? 8 : 3).entries()) {
      const valores: Record<string, string> = {
        nome: c.nome,
        cidade_atual: `${c.cidade}/${c.uf}`,
        cidade_desejada: c.cidade,
        capital: c.capital ?? 'não informado',
        prazo: c.prazo ?? 'não informado',
        experiencia: c.exp ?? 'não informado',
        socio: j % 2 === 0 ? 'Não, sozinho(a)' : 'Sim, com meu cônjuge',
        disponibilidade: 'Dedicação integral',
      };
      await prisma.qualificationAnswer.create({
        data: { leadId: lead.id, questionId: p.id, value: valores[p.key] ?? 'Sim', source: 'AI' },
      });
    }

    // historico do funil
    const caminho = ['NOVO_LEAD', 'IA_QUALIFICANDO', 'QUALIFICADO', 'REUNIAO_AGENDADA', 'APRESENTACAO_REALIZADA', 'VISITA_UNIDADE', 'COF_ENVIADA', 'PRAZO_COF', 'NEGOCIACAO', 'CONTRATO', 'GANHO'];
    const ate = caminho.indexOf(c.etapa);
    let anterior: string | null = null;
    for (let k = 0; k <= (ate >= 0 ? ate : 1); k += 1) {
      const chave = caminho[k];
      const st = porChave.get(chave ?? '');
      if (!st) continue;
      await prisma.pipelineStageHistory.create({
        data: {
          leadId: lead.id,
          fromStageId: anterior ? porChave.get(anterior)?.id : null,
          toStageId: st.id,
          source: k <= 1 ? 'AUTOMATION' : 'MANUAL',
          changedById: k <= 1 ? null : admin.id,
          // cada etapa acontece DEPOIS da anterior; com o sinal trocado o
          // relatorio mostrava tempo negativo ate qualificar
          createdAt: dias(Math.max(0, chegouHa(i) - k)),
        },
      });
      anterior = chave ?? null;
    }
    if (['PERDIDO', 'NUTRICAO', 'SEM_RESPOSTA'].includes(c.etapa)) {
      await prisma.pipelineStageHistory.create({
        data: { leadId: lead.id, toStageId: etapa.id, source: 'MANUAL', changedById: admin.id, createdAt: dias(3) },
      });
    }

    // conversa: a primeira candidata ganha o dialogo completo
    const conversa = await prisma.conversation.create({
      data: {
        organizationId: org.id,
        contactId: contato.id,
        leadId: lead.id,
        mode: i === 0 ? 'HUMAN' : 'AI',
        ownerId: i === 0 ? admin.id : null,
        humanTakeoverAt: i === 0 ? dias(2) : null,
        lastMessageAt: dias(Math.max(0, chegouHa(i) - 1)),
        createdAt: dias(chegouHa(i)),
      },
    });

    const roteiro = i === 0 ? CONVERSAS : CONVERSAS.slice(0, Math.min(4, 2 + (i % 4)));
    for (const [j, m] of roteiro.entries()) {
      const quando = new Date(dias(Math.max(0, chegouHa(i) - 1)).getTime() + j * 240_000);
      await prisma.message.create({
        data: {
          organizationId: org.id,
          conversationId: conversa.id,
          direction: m.de === 'cliente' ? 'INBOUND' : 'OUTBOUND',
          author: m.de === 'cliente' ? 'CONTACT' : m.de === 'ia' ? 'AI' : 'HUMAN',
          senderUserId: m.de === 'humano' ? admin.id : null,
          wamid: `wamid.demo.${lead.id.slice(0, 8)}.${j}`,
          type: 'text',
          body: m.texto,
          status: m.de === 'cliente' ? 'DELIVERED' : j === roteiro.length - 1 ? 'DELIVERED' : 'READ',
          deliveredAt: quando,
          readAt: m.de === 'cliente' ? null : quando,
          createdAt: quando,
        },
      });
    }

    await prisma.activity.create({
      data: {
        organizationId: org.id,
        leadId: lead.id,
        type: 'message_received',
        title: 'Primeira mensagem no WhatsApp',
        description: roteiro[0]?.texto.slice(0, 120),
        occurredAt: dias(chegouHa(i)),
      },
    });
  }

  // ---------- reunioes ----------
  const leads = await prisma.lead.findMany({ include: { contact: true }, orderBy: { score: 'desc' } });
  const agendaveis = leads.slice(0, 5);
  for (const [i, l] of agendaveis.entries()) {
    await prisma.meeting.create({
      data: {
        organizationId: org.id,
        leadId: l.id,
        ownerId: admin.id,
        title: i % 2 === 0 ? 'Apresentação da franquia' : 'Visita à loja de Jales',
        scheduledAt: daquiA(i + 1),
        durationMin: i % 2 === 0 ? 60 : 120,
        location: i % 2 === 0 ? 'Videochamada' : 'Loja Jales/SP',
        status: 'AGENDADA',
        notes: i === 0 ? 'Candidata muito interessada, já tem ponto em vista.' : null,
      },
    });
  }
  await prisma.meeting.create({
    data: {
      organizationId: org.id,
      leadId: leads[1]?.id ?? agendaveis[0]!.id,
      ownerId: admin.id,
      title: 'Apresentação da franquia',
      scheduledAt: dias(6),
      durationMin: 60,
      location: 'Videochamada',
      status: 'REALIZADA',
      notes: 'Correu bem. Pediu a COF.',
    },
  });

  // ---------- tarefas ----------
  const tarefas = [
    { titulo: 'Ligar para confirmar a reunião de amanhã', prazo: daquiA(0), lead: 0 },
    { titulo: 'Enviar apresentacao institucional', prazo: daquiA(1), lead: 2 },
    { titulo: 'Retomar contato: 24h sem resposta', prazo: dias(1), lead: 9 },
    { titulo: 'Conferir documentação da COF', prazo: daquiA(3), lead: 3 },
    { titulo: 'Agendar visita à loja de Jales', prazo: daquiA(5), lead: 4 },
  ];
  for (const t of tarefas) {
    await prisma.task.create({
      data: {
        organizationId: org.id,
        leadId: leads[t.lead]?.id,
        ownerId: admin.id,
        title: t.titulo,
        dueAt: t.prazo,
        status: 'ABERTA',
      },
    });
  }
  await prisma.task.create({
    data: {
      organizationId: org.id,
      leadId: leads[0]?.id,
      ownerId: admin.id,
      title: 'Enviar contrato para assinatura',
      dueAt: dias(2),
      status: 'CONCLUIDA',
      completedAt: dias(1),
    },
  });

  // ---------- COF ----------
  const cofs = [
    { lead: 0, status: 'CONTRATO_LIBERADO', enviada: dias(25), recebida: dias(24), liberado: dias(13) },
    { lead: 1, status: 'EM_PRAZO', enviada: dias(9), recebida: dias(8), liberado: null },
    { lead: 2, status: 'EM_PRAZO', enviada: dias(3), recebida: dias(2), liberado: null },
    { lead: 3, status: 'ENVIADA', enviada: dias(1), recebida: null, liberado: null },
  ];
  for (const c of cofs) {
    const l = leads[c.lead];
    if (!l) continue;
    await prisma.cofProcess.create({
      data: {
        organizationId: org.id,
        leadId: l.id,
        responsibleId: admin.id,
        status: c.status as never,
        sentAt: c.enviada,
        receivedAt: c.recebida,
        contractReleaseAt: c.liberado,
        documentVersion: 'COF 2026.1',
        waitingDays: 10,
      },
    });
  }

  console.log('Dados de demonstracao criados.');
  console.log(`  candidatos: ${CANDIDATOS.length}`);
  console.log(`  reunioes: ${await prisma.meeting.count()}`);
  console.log(`  tarefas: ${await prisma.task.count()}`);
  console.log(`  processos de COF: ${await prisma.cofProcess.count()}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

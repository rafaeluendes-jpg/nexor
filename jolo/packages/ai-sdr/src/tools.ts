import type { PrismaClient } from '@jolo/database';
import { moveStage, refreshScore, takeOver } from '@jolo/crm-core';

export interface ToolContext {
  prisma: PrismaClient;
  organizationId: string;
  leadId: string;
  conversationId: string;
  correlationId: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  run(ctx: ToolContext, args: Record<string, unknown>): Promise<unknown>;
}

const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

/**
 * A IA nunca toca no banco direto (item 23). Ela so consegue agir
 * atraves destas ferramentas, com validacao e auditoria de cada passo.
 */
export const AI_TOOLS: ToolDefinition[] = [
  {
    name: 'getLead',
    description: 'Le os dados atuais do lead em atendimento.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    async run(ctx) {
      const lead = await ctx.prisma.lead.findUniqueOrThrow({
        where: { id: ctx.leadId },
        include: { contact: true, stage: true },
      });
      return {
        nome: lead.contact.name,
        cidadeDesejada: lead.desiredCity,
        capital: lead.capitalRange,
        prazo: lead.investmentHorizon,
        etapa: lead.stage.name,
        score: lead.score,
      };
    },
  },
  {
    name: 'updateLead',
    description: 'Atualiza dados de qualificacao do lead.',
    parameters: {
      type: 'object',
      properties: {
        nome: { type: 'string' },
        cidadeAtual: { type: 'string' },
        estadoAtual: { type: 'string' },
        cidadeDesejada: { type: 'string' },
        estadoDesejado: { type: 'string' },
        capitalFaixa: { type: 'string' },
        prazo: { type: 'string' },
        experiencia: { type: 'string' },
        possuiSocio: { type: 'boolean' },
        disponibilidade: { type: 'string' },
        melhorHorario: { type: 'string' },
      },
      additionalProperties: false,
    },
    async run(ctx, args) {
      const lead = await ctx.prisma.lead.update({
        where: { id: ctx.leadId },
        data: {
          desiredCity: str(args.cidadeDesejada),
          desiredState: str(args.estadoDesejado),
          capitalRange: str(args.capitalFaixa),
          investmentHorizon: str(args.prazo),
          businessExperience: str(args.experiencia),
          hasPartner: typeof args.possuiSocio === 'boolean' ? args.possuiSocio : undefined,
          availability: str(args.disponibilidade),
          bestContactTime: str(args.melhorHorario),
          lastContactAt: new Date(),
        },
      });
      const nome = str(args.nome);
      const cidade = str(args.cidadeAtual);
      if (nome || cidade) {
        await ctx.prisma.contact.update({
          where: { id: lead.contactId },
          data: { name: nome, city: cidade, state: str(args.estadoAtual) },
        });
      }
      const score = await refreshScore(ctx.prisma, ctx.leadId);
      return { ok: true, score: score.total };
    },
  },
  {
    name: 'setQualificationAnswer',
    description: 'Registra a resposta de uma pergunta de qualificacao.',
    parameters: {
      type: 'object',
      properties: { chave: { type: 'string' }, valor: { type: 'string' } },
      required: ['chave', 'valor'],
      additionalProperties: false,
    },
    async run(ctx, args) {
      const chave = str(args.chave);
      const valor = str(args.valor);
      if (!chave || !valor) return { ok: false, motivo: 'chave e valor sao obrigatorios' };
      const pergunta = await ctx.prisma.qualificationQuestion.findUnique({ where: { key: chave } });
      if (!pergunta) return { ok: false, motivo: 'pergunta desconhecida' };
      await ctx.prisma.qualificationAnswer.upsert({
        where: { leadId_questionId: { leadId: ctx.leadId, questionId: pergunta.id } },
        create: { leadId: ctx.leadId, questionId: pergunta.id, value: valor, source: 'AI' },
        update: { value: valor, source: 'AI' },
      });
      return { ok: true };
    },
  },
  {
    name: 'changeStage',
    description: 'Move o lead de etapa do funil.',
    parameters: {
      type: 'object',
      properties: {
        etapa: {
          type: 'string',
          enum: ['IA_QUALIFICANDO', 'QUALIFICADO', 'REUNIAO_AGENDADA', 'NUTRICAO', 'SEM_RESPOSTA'],
        },
        motivo: { type: 'string' },
      },
      required: ['etapa'],
      additionalProperties: false,
    },
    async run(ctx, args) {
      await moveStage(ctx.prisma, {
        leadId: ctx.leadId,
        toStageKey: args.etapa as never,
        source: 'AI',
        reason: str(args.motivo),
        correlationId: ctx.correlationId,
      });
      return { ok: true };
    },
  },
  {
    name: 'createTask',
    description: 'Cria tarefa de acompanhamento para o time.',
    parameters: {
      type: 'object',
      properties: { titulo: { type: 'string' }, quando: { type: 'string' }, descricao: { type: 'string' } },
      required: ['titulo'],
      additionalProperties: false,
    },
    async run(ctx, args) {
      const lead = await ctx.prisma.lead.findUniqueOrThrow({ where: { id: ctx.leadId } });
      const task = await ctx.prisma.task.create({
        data: {
          organizationId: ctx.organizationId,
          leadId: ctx.leadId,
          ownerId: lead.ownerId,
          title: String(args.titulo),
          description: str(args.descricao),
          dueAt: args.quando ? new Date(String(args.quando)) : null,
        },
      });
      return { ok: true, taskId: task.id };
    },
  },
  {
    name: 'createNote',
    description: 'Guarda uma observacao no historico do lead.',
    parameters: {
      type: 'object',
      properties: { texto: { type: 'string' } },
      required: ['texto'],
      additionalProperties: false,
    },
    async run(ctx, args) {
      await ctx.prisma.note.create({
        data: { organizationId: ctx.organizationId, leadId: ctx.leadId, body: String(args.texto) },
      });
      return { ok: true };
    },
  },
  {
    name: 'scheduleMeeting',
    description: 'Registra o interesse em reuniao com o time de expansao.',
    parameters: {
      type: 'object',
      properties: { quando: { type: 'string' }, observacao: { type: 'string' } },
      required: ['quando'],
      additionalProperties: false,
    },
    async run(ctx, args) {
      const quando = new Date(String(args.quando));
      if (Number.isNaN(quando.getTime())) return { ok: false, motivo: 'data invalida' };
      const meeting = await ctx.prisma.meeting.create({
        data: {
          organizationId: ctx.organizationId,
          leadId: ctx.leadId,
          title: 'Reuniao com o time de expansao',
          scheduledAt: quando,
          notes: str(args.observacao),
        },
      });
      await moveStage(ctx.prisma, {
        leadId: ctx.leadId,
        toStageKey: 'REUNIAO_AGENDADA',
        source: 'AI',
        reason: 'Reuniao sugerida pela IA',
      });
      return { ok: true, meetingId: meeting.id };
    },
  },
  {
    name: 'handoffToHuman',
    description: 'Passa a conversa para uma pessoa do time.',
    parameters: {
      type: 'object',
      properties: { motivo: { type: 'string' } },
      required: ['motivo'],
      additionalProperties: false,
    },
    async run(ctx, args) {
      await ctx.prisma.conversation.update({
        where: { id: ctx.conversationId },
        data: { mode: 'HUMAN' },
      });
      await ctx.prisma.aiHandoff.create({
        data: {
          conversationId: ctx.conversationId,
          direction: 'AI_TO_HUMAN',
          reason: String(args.motivo),
        },
      });
      await ctx.prisma.aiSession.updateMany({
        where: { conversationId: ctx.conversationId, status: 'ATIVA' },
        data: { status: 'ENCERRADA', endedAt: new Date() },
      });
      await ctx.prisma.task.create({
        data: {
          organizationId: ctx.organizationId,
          leadId: ctx.leadId,
          title: 'Assumir conversa no WhatsApp',
          description: String(args.motivo),
          dueAt: new Date(Date.now() + 30 * 60_000),
        },
      });
      return { ok: true };
    },
  },
  {
    name: 'getFranchiseFAQ',
    description: 'Consulta as respostas oficiais aprovadas sobre a franquia.',
    parameters: {
      type: 'object',
      properties: { assunto: { type: 'string' } },
      additionalProperties: false,
    },
    async run(_ctx, args) {
      const assunto = (str(args.assunto) ?? '').toLowerCase();
      const faq: Record<string, string> = {
        investimento:
          'O investimento total estimado e de R$ 350.000. A composicao varia conforme ponto, projeto, formato da unidade, equipamentos, obra, frente de loja, estoque e capital de giro.',
        cidades: 'A rede tem unidades em Sao Paulo e no Rio de Janeiro. Sao Paulo capital esta em implantacao.',
        jornada:
          'Sao seis passos: apresentacao, ficha de qualificacao, reuniao estrategica, visita a uma unidade, COF e contrato, plano de inauguracao.',
        treinamento:
          'Tres semanas: imersao na sede da franqueadora, treinamento na unidade franqueada e acompanhamento pos-inauguracao.',
        ponto: 'A jornada de implantacao preve apoio na identificacao do imovel e adequacao ao padrao da marca.',
      };
      const chave = Object.keys(faq).find((k) => assunto.includes(k));
      return chave ? { resposta: faq[chave] } : { faq };
    },
  },
  {
    name: 'getAvailableCities',
    description: 'Lista as pracas com disponibilidade registrada.',
    parameters: {
      type: 'object',
      properties: { estado: { type: 'string' } },
      additionalProperties: false,
    },
    async run(ctx, args) {
      const estado = str(args.estado);
      const lista = await ctx.prisma.territory.findMany({
        where: {
          organizationId: ctx.organizationId,
          status: 'DISPONIVEL',
          ...(estado ? { state: estado.toUpperCase() } : {}),
        },
        select: { city: true, state: true },
        take: 50,
      });
      return { cidades: lista };
    },
  },
];

export const AI_TOOL_MAP = new Map(AI_TOOLS.map((t) => [t.name, t]));

/** Usado pelo handoff automatico quando a IA pede humano. */
export async function forceHumanTakeover(
  prisma: PrismaClient,
  params: { conversationId: string; userId: string; reason: string },
) {
  return takeOver(prisma, params);
}

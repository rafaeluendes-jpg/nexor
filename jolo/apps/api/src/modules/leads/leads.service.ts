import { Injectable } from '@nestjs/common';
import { moveStage, refreshScore } from '@jolo/crm-core';
import { TIPOS_DE_AVISO } from '@jolo/shared';
import { NotFoundError, formatPhoneBR, type StageKey } from '@jolo/shared';
import type { Lead } from '@jolo/database';
import { PrismaService } from '../../common/prisma.service.js';
import { AvisosService } from '../../common/avisos.service.js';
import type { AuthenticatedUser } from '../../common/decorators/index.js';

/** Ficha do lead como a tela recebe. Anotada porque o tipo do Prisma nao atravessa o workspace. */
export interface LeadDetalhado {
  id: string;
  nome: string;
  telefone: string;
  email: string | null;
  etapa: { key: string; name: string };
  status: string;
  score: number;
  temperatura: string;
  responsavel: { id: string; name: string } | null;
  qualificacao: Record<string, string | boolean | null>;
  respostas: { pergunta: string; resposta: string; em: Date }[];
  origem: { origem: string; campanha: string | null; anuncio: string | null; primeiraVisita: Date | null };
  tarefas: { id: string; titulo: string; prazo: Date | null; status: string }[];
  reunioes: { id: string; titulo: string; quando: Date; status: string }[];
  documentos: { id: string; nome: string; categoria: string; em: Date }[];
  cof: { id: string; status: string; enviadaEm: Date | null; recebidaEm: Date | null; prazoDias: number }[];
  conversas: { id: string; modo: string; ultimaMensagem: Date | null }[];
  motivoDaPerda: string | null;
  criadoEm: Date;
  ultimoContato: Date | null;
}

export interface LeadFilters {
  search?: string;
  stageKey?: string;
  ownerId?: string;
  city?: string;
  campaign?: string;
  temperature?: string;
  from?: string;
  to?: string;
  take?: number;
  skip?: number;
}

@Injectable()
export class LeadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly avisos: AvisosService,
  ) {}

  private where(user: AuthenticatedUser, f: LeadFilters) {
    return {
      organizationId: user.organizationId,
      ...(f.stageKey ? { stage: { key: f.stageKey } } : {}),
      ...(f.ownerId ? { ownerId: f.ownerId } : {}),
      ...(f.temperature ? { temperature: f.temperature as never } : {}),
      ...(f.city ? { desiredCity: { contains: f.city, mode: 'insensitive' as const } } : {}),
      ...(f.campaign ? { attribution: { firstTouchCampaign: f.campaign } } : {}),
      ...(f.from || f.to
        ? {
            createdAt: {
              ...(f.from ? { gte: new Date(f.from) } : {}),
              ...(f.to ? { lte: new Date(f.to) } : {}),
            },
          }
        : {}),
      ...(f.search
        ? {
            OR: [
              { contact: { name: { contains: f.search, mode: 'insensitive' as const } } },
              { contact: { phoneE164: { contains: f.search.replace(/\D+/g, '') } } },
              { desiredCity: { contains: f.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
  }

  async list(user: AuthenticatedUser, filters: LeadFilters) {
    const where = this.where(user, filters);
    const [total, leads] = await Promise.all([
      this.prisma.client.lead.count({ where }),
      this.prisma.client.lead.findMany({
        where,
        include: {
          contact: true,
          stage: true,
          owner: { select: { id: true, name: true } },
          attribution: true,
        },
        orderBy: { createdAt: 'desc' },
        take: Math.min(filters.take ?? 50, 200),
        skip: filters.skip ?? 0,
      }),
    ]);

    return {
      total,
      leads: leads.map((l) => ({
        id: l.id,
        nome: l.contact.name ?? 'Sem nome',
        telefone: formatPhoneBR(l.contact.phoneE164),
        cidadeInteresse: l.desiredCity,
        etapa: { key: l.stage.key, name: l.stage.name },
        score: l.score,
        temperatura: l.temperature,
        responsavel: l.owner,
        origem: l.attribution?.firstTouchSource ?? 'direto',
        campanha: l.attribution?.firstTouchCampaign ?? null,
        criadoEm: l.createdAt,
        ultimoContato: l.lastContactAt,
        proximaAcao: l.nextActionAt,
        status: l.status,
      })),
    };
  }

  /** Ficha completa do lead: o que a tela de detalhe mostra na lateral (item 14). */
  async detalhe(user: AuthenticatedUser, leadId: string): Promise<LeadDetalhado> {
    const lead = await this.prisma.client.lead.findFirst({
      where: { id: leadId, organizationId: user.organizationId },
      include: {
        contact: true,
        stage: true,
        owner: { select: { id: true, name: true } },
        attribution: true,
        answers: { include: { question: true }, orderBy: { question: { position: 'asc' } } },
        tasks: { orderBy: { dueAt: 'asc' }, take: 20 },
        meetings: { orderBy: { scheduledAt: 'desc' }, take: 10 },
        documents: { orderBy: { createdAt: 'desc' }, take: 20 },
        cofProcesses: { orderBy: { createdAt: 'desc' }, take: 5 },
        conversations: { select: { id: true, mode: true, lastMessageAt: true } },
        scores: { orderBy: { calculatedAt: 'desc' }, take: 1 },
      },
    });
    if (!lead) throw new NotFoundError('Lead nao encontrado.');

    return {
      id: lead.id,
      nome: lead.contact.name ?? 'Sem nome',
      telefone: formatPhoneBR(lead.contact.phoneE164),
      email: lead.contact.email,
      etapa: { key: lead.stage.key, name: lead.stage.name },
      status: lead.status,
      score: lead.score,
      temperatura: lead.temperature,
      responsavel: lead.owner,
      qualificacao: {
        cidadeInteresse: lead.desiredCity,
        estadoInteresse: lead.desiredState,
        faixaDeCapital: lead.capitalRange,
        prazoParaInvestir: lead.investmentHorizon,
        experiencia: lead.businessExperience,
        temSocio: lead.hasPartner,
        disponibilidade: lead.availability,
        melhorHorario: lead.bestContactTime,
      },
      respostas: lead.answers.map((a) => ({
        pergunta: a.question.label,
        resposta: a.value,
        em: a.createdAt,
      })),
      origem: {
        origem: lead.attribution?.firstTouchSource ?? 'direto',
        campanha: lead.attribution?.firstTouchCampaign ?? null,
        anuncio: lead.attribution?.firstTouchContent ?? null,
        primeiraVisita: lead.attribution?.createdAt ?? null,
      },
      tarefas: lead.tasks.map((t) => ({ id: t.id, titulo: t.title, prazo: t.dueAt, status: t.status })),
      reunioes: lead.meetings.map((m) => ({ id: m.id, titulo: m.title, quando: m.scheduledAt, status: m.status })),
      documentos: lead.documents.map((d) => ({ id: d.id, nome: d.fileName, categoria: d.kind, em: d.createdAt })),
      cof: lead.cofProcesses.map((c) => ({
        id: c.id,
        status: c.status,
        enviadaEm: c.sentAt,
        recebidaEm: c.receivedAt,
        prazoDias: c.waitingDays,
      })),
      conversas: lead.conversations.map((c) => ({ id: c.id, modo: c.mode, ultimaMensagem: c.lastMessageAt })),
      motivoDaPerda: lead.lostReason,
      criadoEm: lead.createdAt,
      ultimoContato: lead.lastContactAt,
    };
  }

  /** Timeline completa do lead (item 21), em ordem cronologica. */
  async timeline(user: AuthenticatedUser, leadId: string) {
    const lead = await this.prisma.client.lead.findFirst({
      where: { id: leadId, organizationId: user.organizationId },
      include: {
        activities: { orderBy: { occurredAt: 'asc' } },
        stageHistory: {
          orderBy: { createdAt: 'asc' },
          include: { fromStage: true, toStage: true, changedBy: { select: { name: true } } },
        },
        conversations: { include: { messages: { orderBy: { createdAt: 'asc' } } } },
      },
    });
    if (!lead) throw new NotFoundError('Lead nao encontrado.');

    const eventos = [
      ...lead.activities.map((a) => ({
        at: a.occurredAt,
        tipo: a.type,
        titulo: a.title,
        detalhe: a.description ?? undefined,
      })),
      ...lead.stageHistory.map((h) => ({
        at: h.createdAt,
        tipo: 'stage_changed',
        titulo: `${h.fromStage?.name ?? 'Entrada'} → ${h.toStage.name}`,
        detalhe: h.changedBy?.name ? `por ${h.changedBy.name}` : `origem ${h.source}`,
      })),
      ...lead.conversations.flatMap((c) =>
        c.messages.map((m) => ({
          at: m.createdAt,
          tipo: m.direction === 'INBOUND' ? 'message_received' : 'message_sent',
          titulo:
            m.direction === 'INBOUND'
              ? 'Mensagem do cliente'
              : m.author === 'AI'
                ? 'Resposta da IA'
                : 'Resposta do time',
          detalhe: m.body?.slice(0, 200) ?? undefined,
        })),
      ),
    ].sort((a, b) => a.at.getTime() - b.at.getTime());

    return { leadId, eventos };
  }

  async move(user: AuthenticatedUser, leadId: string, stageKey: StageKey, reason?: string): Promise<Lead> {
    const lead = await this.prisma.client.lead.findFirst({
      where: { id: leadId, organizationId: user.organizationId },
    });
    if (!lead) throw new NotFoundError('Lead nao encontrado.');
    const movido = await moveStage(this.prisma.client, {
      leadId,
      toStageKey: stageKey,
      source: 'MANUAL',
      userId: user.id,
      reason,
    });
    // "quando lead mudar etapa, usuarios autorizados atualizam" (item 44)
    await this.avisos.publicar({
      tipo: TIPOS_DE_AVISO.LEAD_MUDOU_ETAPA,
      organizationId: user.organizationId,
      leadId,
      dados: { etapa: stageKey, por: user.name },
    });
    return movido;
  }

  async recalcScore(user: AuthenticatedUser, leadId: string) {
    const lead = await this.prisma.client.lead.findFirst({
      where: { id: leadId, organizationId: user.organizationId },
    });
    if (!lead) throw new NotFoundError('Lead nao encontrado.');
    return refreshScore(this.prisma.client, leadId);
  }
}

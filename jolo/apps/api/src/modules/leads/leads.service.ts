import { Injectable } from '@nestjs/common';
import { moveStage, refreshScore } from '@jolo/crm-core';
import { NotFoundError, formatPhoneBR, type StageKey } from '@jolo/shared';
import type { Lead } from '@jolo/database';
import { PrismaService } from '../../common/prisma.service.js';
import type { AuthenticatedUser } from '../../common/decorators/index.js';

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
  constructor(private readonly prisma: PrismaService) {}

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
    return moveStage(this.prisma.client, {
      leadId,
      toStageKey: stageKey,
      source: 'MANUAL',
      userId: user.id,
      reason,
    });
  }

  async recalcScore(user: AuthenticatedUser, leadId: string) {
    const lead = await this.prisma.client.lead.findFirst({
      where: { id: leadId, organizationId: user.organizationId },
    });
    if (!lead) throw new NotFoundError('Lead nao encontrado.');
    return refreshScore(this.prisma.client, leadId);
  }
}

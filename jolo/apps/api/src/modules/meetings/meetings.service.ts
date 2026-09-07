import { Injectable } from '@nestjs/common';
import { DomainError, NotFoundError } from '@jolo/shared';
import { moveStage, writeActivity, writeAudit } from '@jolo/crm-core';
import { PrismaService } from '../../common/prisma.service.js';
import type { AuthenticatedUser } from '../../common/decorators/index.js';

@Injectable()
export class MeetingsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: AuthenticatedUser, f: { de?: string; ate?: string; status?: string; leadId?: string }) {
    const reunioes = await this.prisma.client.meeting.findMany({
      where: {
        organizationId: user.organizationId,
        ...(f.status ? { status: f.status as never } : {}),
        ...(f.leadId ? { leadId: f.leadId } : {}),
        ...(f.de || f.ate
          ? {
              scheduledAt: {
                ...(f.de ? { gte: new Date(f.de) } : {}),
                ...(f.ate ? { lte: new Date(f.ate) } : {}),
              },
            }
          : {}),
      },
      include: {
        owner: { select: { id: true, name: true } },
        lead: { select: { id: true, desiredCity: true, contact: { select: { name: true, phoneE164: true } } } },
      },
      orderBy: { scheduledAt: 'asc' },
      take: 300,
    });

    return {
      itens: reunioes.map((r) => ({
        id: r.id,
        titulo: r.title,
        quando: r.scheduledAt,
        duracaoMin: r.durationMin,
        local: r.location,
        status: r.status,
        observacoes: r.notes,
        responsavel: r.owner ? { id: r.owner.id, nome: r.owner.name } : null,
        lead: {
          id: r.lead.id,
          nome: r.lead.contact?.name ?? 'sem nome',
          telefone: r.lead.contact?.phoneE164 ?? null,
          cidade: r.lead.desiredCity,
        },
      })),
    };
  }

  async create(
    user: AuthenticatedUser,
    dados: {
      leadId: string;
      titulo: string;
      quando: string;
      duracaoMin?: number;
      local?: string;
      observacoes?: string;
      responsavelId?: string;
    },
  ) {
    const lead = await this.prisma.client.lead.findFirst({
      where: { id: dados.leadId, organizationId: user.organizationId },
      include: { stage: { select: { key: true } } },
    });
    if (!lead) throw new NotFoundError('Lead nao encontrado.');

    const quando = new Date(dados.quando);
    if (quando.getTime() < Date.now()) {
      throw new DomainError('Reuniao no passado nao se agenda.', 'VALIDATION_ERROR', 422);
    }

    const reuniao = await this.prisma.client.meeting.create({
      data: {
        organizationId: user.organizationId,
        leadId: dados.leadId,
        ownerId: dados.responsavelId ?? user.id,
        title: dados.titulo,
        scheduledAt: quando,
        durationMin: dados.duracaoMin ?? 60,
        location: dados.local,
        notes: dados.observacoes,
      },
    });

    // Marcar reuniao move o lead sozinho: quem marcou nao precisa lembrar de arrastar o cartao.
    const adiante = ['REUNIAO_AGENDADA', 'APRESENTACAO_REALIZADA', 'VISITA_UNIDADE', 'COF_ENVIADA', 'PRAZO_COF', 'NEGOCIACAO', 'CONTRATO', 'GANHO'];
    if (!adiante.includes(lead.stage.key)) {
      await moveStage(this.prisma.client, {
        leadId: lead.id,
        toStageKey: 'REUNIAO_AGENDADA',
        userId: user.id,
        source: 'MANUAL',
        reason: 'Reuniao agendada',
      }).catch(() => undefined);
    }

    await writeAudit(this.prisma.client, {
      organizationId: user.organizationId,
      actorUserId: user.id,
      actorType: 'USER',
      event: 'meeting.create',
      entity: 'Meeting',
      entityId: reuniao.id,
      after: { title: reuniao.title, scheduledAt: reuniao.scheduledAt },
    });
    await writeActivity(this.prisma.client, {
      organizationId: user.organizationId,
      leadId: lead.id,
      userId: user.id,
      type: 'REUNIAO',
      title: `Reuniao agendada: ${reuniao.title}`,
      description: quando.toISOString(),
    });
    return reuniao;
  }

  async setStatus(user: AuthenticatedUser, id: string, status: string, observacoes?: string) {
    const atual = await this.prisma.client.meeting.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!atual) throw new NotFoundError('Reuniao nao encontrada.');

    const reuniao = await this.prisma.client.meeting.update({
      where: { id },
      data: { status: status as never, notes: observacoes ?? atual.notes },
    });

    if (status === 'REALIZADA') {
      await moveStage(this.prisma.client, {
        leadId: atual.leadId,
        toStageKey: 'APRESENTACAO_REALIZADA',
        userId: user.id,
        source: 'MANUAL',
        reason: 'Reuniao realizada',
      }).catch(() => undefined);
    }

    await writeAudit(this.prisma.client, {
      organizationId: user.organizationId,
      actorUserId: user.id,
      actorType: 'USER',
      event: 'meeting.status',
      entity: 'Meeting',
      entityId: id,
      before: { status: atual.status },
      after: { status: reuniao.status },
    });
    return reuniao;
  }
}

import { Injectable } from '@nestjs/common';
import { NotFoundError } from '@jolo/shared';
import { writeAudit } from '@jolo/crm-core';
import { PrismaService } from '../../common/prisma.service.js';
import type { AuthenticatedUser } from '../../common/decorators/index.js';

export const STATUS_PRACA = ['DISPONIVEL', 'EM_ANALISE', 'NEGOCIACAO', 'RESERVADA', 'VENDIDA'] as const;

@Injectable()
export class TerritoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: AuthenticatedUser, f: { status?: string; uf?: string; busca?: string }) {
    const pracas = await this.prisma.client.territory.findMany({
      where: {
        organizationId: user.organizationId,
        ...(f.status ? { status: f.status as never } : {}),
        ...(f.uf ? { state: f.uf.toUpperCase() } : {}),
        ...(f.busca ? { city: { contains: f.busca, mode: 'insensitive' as const } } : {}),
      },
      include: {
        owner: { select: { id: true, name: true } },
        lead: { select: { id: true, contact: { select: { name: true } } } },
      },
      orderBy: [{ state: 'asc' }, { priority: 'desc' }, { city: 'asc' }],
    });

    const porStatus: Record<string, number> = {};
    for (const s of STATUS_PRACA) porStatus[s] = 0;
    for (const p of pracas) porStatus[p.status] = (porStatus[p.status] ?? 0) + 1;

    return {
      resumo: porStatus,
      itens: pracas.map((p) => ({
        id: p.id,
        cidade: p.city,
        uf: p.state,
        status: p.status,
        disponivel: p.status === 'DISPONIVEL',
        prioridade: p.priority,
        observacoes: p.notes,
        responsavel: p.owner ? { id: p.owner.id, nome: p.owner.name } : null,
        lead: p.lead ? { id: p.lead.id, nome: p.lead.contact?.name ?? 'sem nome' } : null,
      })),
    };
  }

  /** Cidades ainda livres. E o que a IA responde quando perguntam onde da para abrir. */
  async disponiveis(user: AuthenticatedUser) {
    const pracas = await this.prisma.client.territory.findMany({
      where: { organizationId: user.organizationId, status: 'DISPONIVEL' },
      orderBy: [{ priority: 'desc' }, { city: 'asc' }],
      select: { city: true, state: true, priority: true },
    });
    return { itens: pracas.map((p) => ({ cidade: p.city, uf: p.state, prioridade: p.priority })) };
  }

  async criar(
    user: AuthenticatedUser,
    dados: { cidade: string; uf: string; status?: string; prioridade?: number; observacoes?: string },
  ) {
    const praca = await this.prisma.client.territory.upsert({
      where: {
        organizationId_city_state: {
          organizationId: user.organizationId,
          city: dados.cidade,
          state: dados.uf.toUpperCase(),
        },
      },
      create: {
        organizationId: user.organizationId,
        city: dados.cidade,
        state: dados.uf.toUpperCase(),
        status: (dados.status ?? 'DISPONIVEL') as never,
        priority: dados.prioridade ?? 0,
        notes: dados.observacoes,
      },
      update: {
        status: (dados.status ?? 'DISPONIVEL') as never,
        priority: dados.prioridade ?? 0,
        notes: dados.observacoes,
      },
    });
    await writeAudit(this.prisma.client, {
      organizationId: user.organizationId,
      actorUserId: user.id,
      actorType: 'USER',
      event: 'territory.upsert',
      entity: 'Territory',
      entityId: praca.id,
      after: { city: praca.city, state: praca.state, status: praca.status },
    });
    return praca;
  }

  async atualizar(
    user: AuthenticatedUser,
    id: string,
    dados: {
      status?: string;
      prioridade?: number;
      observacoes?: string;
      responsavelId?: string | null;
      leadId?: string | null;
    },
  ) {
    const atual = await this.prisma.client.territory.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!atual) throw new NotFoundError('Praca nao encontrada.');

    const praca = await this.prisma.client.territory.update({
      where: { id },
      data: {
        ...(dados.status ? { status: dados.status as never } : {}),
        ...(dados.prioridade !== undefined ? { priority: dados.prioridade } : {}),
        ...(dados.observacoes !== undefined ? { notes: dados.observacoes } : {}),
        ...(dados.responsavelId !== undefined ? { ownerId: dados.responsavelId } : {}),
        ...(dados.leadId !== undefined ? { leadId: dados.leadId } : {}),
      },
    });
    await writeAudit(this.prisma.client, {
      organizationId: user.organizationId,
      actorUserId: user.id,
      actorType: 'USER',
      event: 'territory.update',
      entity: 'Territory',
      entityId: id,
      before: { status: atual.status, priority: atual.priority },
      after: { status: praca.status, priority: praca.priority },
    });
    return praca;
  }
}

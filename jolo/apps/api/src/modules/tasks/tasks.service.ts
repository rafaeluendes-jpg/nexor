import { Injectable } from '@nestjs/common';
import { NotFoundError } from '@jolo/shared';
import { writeActivity, writeAudit } from '@jolo/crm-core';
import { PrismaService } from '../../common/prisma.service.js';
import type { AuthenticatedUser } from '../../common/decorators/index.js';

export interface FiltroTarefa {
  status?: string;
  ownerId?: string;
  leadId?: string;
  ateData?: string;
  take?: number;
}

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: AuthenticatedUser, f: FiltroTarefa) {
    const tarefas = await this.prisma.client.task.findMany({
      where: {
        organizationId: user.organizationId,
        ...(f.status ? { status: f.status as never } : {}),
        ...(f.ownerId ? { ownerId: f.ownerId } : {}),
        ...(f.leadId ? { leadId: f.leadId } : {}),
        ...(f.ateData ? { dueAt: { lte: new Date(f.ateData) } } : {}),
      },
      include: {
        owner: { select: { id: true, name: true } },
        lead: { select: { id: true, contact: { select: { name: true, phoneE164: true } } } },
      },
      orderBy: [{ status: 'asc' }, { dueAt: 'asc' }],
      take: f.take ?? 200,
    });

    const agora = Date.now();
    return {
      itens: tarefas.map((t) => ({
        id: t.id,
        titulo: t.title,
        descricao: t.description,
        status: t.status,
        prazo: t.dueAt,
        // atrasada e informacao de tela: quem olha precisa ver o que ja passou
        atrasada: Boolean(t.dueAt && t.status === 'ABERTA' && t.dueAt.getTime() < agora),
        responsavel: t.owner ? { id: t.owner.id, nome: t.owner.name } : null,
        lead: t.lead ? { id: t.lead.id, nome: t.lead.contact?.name ?? 'sem nome' } : null,
        concluidaEm: t.completedAt,
      })),
    };
  }

  async create(
    user: AuthenticatedUser,
    dados: { titulo: string; descricao?: string; prazo?: string; leadId?: string; responsavelId?: string },
  ) {
    const tarefa = await this.prisma.client.task.create({
      data: {
        organizationId: user.organizationId,
        title: dados.titulo,
        description: dados.descricao,
        dueAt: dados.prazo ? new Date(dados.prazo) : null,
        leadId: dados.leadId,
        // sem responsavel indicado, a tarefa fica com quem a criou: tarefa sem dono nao anda
        ownerId: dados.responsavelId ?? user.id,
      },
    });
    await writeAudit(this.prisma.client, {
      organizationId: user.organizationId,
      actorUserId: user.id,
      actorType: 'USER',
      event: 'task.create',
      entity: 'Task',
      entityId: tarefa.id,
      after: { title: tarefa.title },
    });
    if (tarefa.leadId) {
      await writeActivity(this.prisma.client, {
        organizationId: user.organizationId,
        leadId: tarefa.leadId,
        userId: user.id,
        type: 'TAREFA',
        title: `Tarefa criada: ${tarefa.title}`,
      });
    }
    return tarefa;
  }

  async complete(user: AuthenticatedUser, id: string, concluir: boolean) {
    const atual = await this.prisma.client.task.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!atual) throw new NotFoundError('Tarefa nao encontrada.');

    const tarefa = await this.prisma.client.task.update({
      where: { id },
      data: {
        status: concluir ? 'CONCLUIDA' : 'ABERTA',
        completedAt: concluir ? new Date() : null,
      },
    });
    await writeAudit(this.prisma.client, {
      organizationId: user.organizationId,
      actorUserId: user.id,
      actorType: 'USER',
      event: concluir ? 'task.complete' : 'task.reopen',
      entity: 'Task',
      entityId: id,
      before: { status: atual.status },
      after: { status: tarefa.status },
    });
    return tarefa;
  }
}

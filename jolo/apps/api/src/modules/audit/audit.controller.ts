import { Controller, Get, Query } from '@nestjs/common';
import { CurrentUser, RequirePermission, type AuthenticatedUser } from '../../common/decorators/index.js';
import { PrismaService } from '../../common/prisma.service.js';

/** Uma linha do registro, como ela vai para a tela. */
interface LinhaDeAuditoria {
  id: string;
  quando: Date;
  evento: string;
  entidade: string;
  entidadeId: string | null;
  quem: { id: string | null; nome: string };
  origem: string;
  antes: unknown;
  depois: unknown;
  ip: string | null;
}

@Controller('audit')
export class AuditController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Registro de auditoria (item 43). So leitura: linha de auditoria nao se
   * edita nem se apaga, senao nao serve de prova.
   */
  @RequirePermission('crm.audit.view')
  @Get()
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() q: Record<string, string | undefined>,
  ): Promise<{ total: number; itens: LinhaDeAuditoria[] }> {
    const take = Math.min(Number(q.take ?? 100), 500);
    const where = {
      organizationId: user.organizationId,
      ...(q.evento ? { event: { contains: q.evento } } : {}),
      ...(q.entidade ? { entity: q.entidade } : {}),
      ...(q.usuario ? { actorUserId: q.usuario } : {}),
      ...(q.de || q.ate
        ? {
            createdAt: {
              ...(q.de ? { gte: new Date(q.de) } : {}),
              ...(q.ate ? { lte: new Date(q.ate) } : {}),
            },
          }
        : {}),
    };

    const [total, linhas] = await Promise.all([
      this.prisma.client.auditLog.count({ where }),
      this.prisma.client.auditLog.findMany({
        where,
        include: { actor: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        take,
        skip: Number(q.skip ?? 0),
      }),
    ]);

    return {
      total,
      itens: linhas.map((l) => ({
        id: l.id,
        quando: l.createdAt,
        evento: l.event,
        entidade: l.entity,
        entidadeId: l.entityId,
        quem: l.actor ? { id: l.actor.id, nome: l.actor.name } : { id: null, nome: l.actorType },
        origem: l.actorType,
        antes: l.before,
        depois: l.after,
        ip: l.ip,
      })),
    };
  }
}

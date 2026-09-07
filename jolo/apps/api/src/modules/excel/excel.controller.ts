import { Body, Controller, Get, Post } from '@nestjs/common';
import { z } from 'zod';
import { AUDIT_EVENTS } from '@jolo/shared';
import { writeAudit } from '@jolo/crm-core';
import { CurrentUser, RequirePermission, type AuthenticatedUser } from '../../common/decorators/index.js';
import { ZodValidationPipe } from '../../common/pipes/zod.pipe.js';
import { PrismaService } from '../../common/prisma.service.js';
import { QueueService } from '../queue/queue.service.js';

const exportSchema = z.object({
  periodoDe: z.string().optional(),
  periodoAte: z.string().optional(),
  etapa: z.string().optional(),
  cidade: z.string().optional(),
  campanha: z.string().optional(),
  responsavel: z.string().optional(),
  status: z.enum(['todos', 'ganhos', 'perdidos', 'abertos']).default('todos'),
});

@Controller('excel')
export class ExcelController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
  ) {}

  /** Pedido de exportacao: entra na fila e nao trava a tela. */
  @RequirePermission('crm.reports.export')
  @Post('export')
  async request(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(exportSchema)) filtros: z.infer<typeof exportSchema>,
  ) {
    const registro = await this.prisma.client.excelExport.create({
      data: {
        organizationId: user.organizationId,
        requestedById: user.id,
        kind: 'leads_master',
        filters: filtros as object,
        status: 'queued',
      },
    });
    await this.queue.excelSync(user.organizationId, 'export_manual', registro.id);
    await writeAudit(this.prisma.client, {
      organizationId: user.organizationId,
      event: AUDIT_EVENTS.EXPORT_REQUESTED,
      entity: 'excel_export',
      entityId: registro.id,
      actorUserId: user.id,
      actorType: 'USER',
      after: filtros,
    });
    return { id: registro.id, status: registro.status };
  }

  @RequirePermission('crm.reports.view')
  @Get('exports')
  async list(@CurrentUser() user: AuthenticatedUser) {
    const itens = await this.prisma.client.excelExport.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { createdAt: 'desc' },
      take: 30,
      include: { requestedBy: { select: { name: true } } },
    });
    return itens.map((e) => ({
      id: e.id,
      status: e.status,
      linhas: e.rowCount,
      arquivo: e.storageKey,
      versao: e.version,
      pedidoPor: e.requestedBy?.name,
      criadoEm: e.createdAt,
      concluidoEm: e.finishedAt,
    }));
  }
}

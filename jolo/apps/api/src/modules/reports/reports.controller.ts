import { Controller, Get, Query } from '@nestjs/common';
import { gerarRelatorio } from '@jolo/analytics';
import { CurrentUser, RequirePermission, type AuthenticatedUser } from '../../common/decorators/index.js';
import { PrismaService } from '../../common/prisma.service.js';

@Controller('reports')
export class ReportsController {
  constructor(private readonly prisma: PrismaService) {}

  /** Todas as metricas do item 29, num relatorio so. */
  @RequirePermission('crm.reports.view')
  @Get()
  relatorio(@CurrentUser() user: AuthenticatedUser, @Query() q: Record<string, string | undefined>) {
    return gerarRelatorio(this.prisma.client, user.organizationId, { de: q.de, ate: q.ate });
  }
}

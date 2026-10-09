import { Controller, Get, Query } from '@nestjs/common';
import { gerarRelatorio } from '@jolo/analytics';
import { nomeDaCampanha, nomeDaOrigem } from '@jolo/shared';
import { CurrentUser, RequirePermission, type AuthenticatedUser } from '../../common/decorators/index.js';
import { PrismaService } from '../../common/prisma.service.js';

@Controller('reports')
export class ReportsController {
  constructor(private readonly prisma: PrismaService) {}

  /** Todas as metricas do item 29, num relatorio so. */
  @RequirePermission('crm.reports.view')
  @Get()
  async relatorio(@CurrentUser() user: AuthenticatedUser, @Query() q: Record<string, string | undefined>) {
    const r = await gerarRelatorio(this.prisma.client, user.organizationId, { de: q.de, ate: q.ate });
    // QR Code de cada loja aparece com o nome da cidade
    return {
      ...r,
      porCampanha: r.porCampanha.map((x) => ({ ...x, campanha: nomeDaCampanha(x.campanha) ?? x.campanha })),
      porOrigem: r.porOrigem.map((x) => ({ ...x, origem: nomeDaOrigem(x.origem) })),
    };
  }
}

import { Controller, Get } from '@nestjs/common';
import { CurrentUser, RequirePermission, type AuthenticatedUser } from '../../common/decorators/index.js';
import { PrismaService } from '../../common/prisma.service.js';

function inicioDoDia(d = new Date()): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly prisma: PrismaService) {}

  /** Numeros do item 28 e origem dos leads do item 30. */
  @RequirePermission('crm.dashboard.view')
  @Get()
  async metrics(@CurrentUser() user: AuthenticatedUser) {
    const org = user.organizationId;
    const hoje = inicioDoDia();
    const semana = new Date(hoje.getTime() - 6 * 86_400_000);
    const mes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

    const conta = (where: object) => this.prisma.client.lead.count({ where: { organizationId: org, ...where } });

    const [hojeQtd, semanaQtd, mesQtd, abertos, qualificados, ganhos, perdidos, reunioes, cofs] =
      await Promise.all([
        conta({ createdAt: { gte: hoje } }),
        conta({ createdAt: { gte: semana } }),
        conta({ createdAt: { gte: mes } }),
        conta({ status: 'ABERTO' }),
        conta({ stage: { key: { in: ['QUALIFICADO', 'REUNIAO_AGENDADA', 'APRESENTACAO_REALIZADA'] } } }),
        conta({ status: 'GANHO' }),
        conta({ status: 'PERDIDO' }),
        this.prisma.client.meeting.count({ where: { organizationId: org } }),
        this.prisma.client.cofProcess.count({ where: { organizationId: org, status: { not: 'NAO_ENVIADA' } } }),
      ]);

    const porOrigem = await this.prisma.client.attributionSession.groupBy({
      by: ['firstTouchSource'],
      where: { organizationId: org, leads: { some: {} } },
      _count: { _all: true },
    });

    const total = await conta({});
    const conversao = total ? Number(((ganhos / total) * 100).toFixed(1)) : 0;

    return {
      leads: { hoje: hojeQtd, semana: semanaQtd, mes: mesQtd, abertos, total },
      funil: { qualificados, reunioes, cofs, ganhos, perdidos },
      taxaConversao: conversao,
      origens: porOrigem.map((o) => ({
        origem: o.firstTouchSource ?? 'direto',
        leads: o._count._all,
      })),
    };
  }
}

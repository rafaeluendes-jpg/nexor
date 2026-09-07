import { Controller, Get } from '@nestjs/common';
import { formatPhoneBR } from '@jolo/shared';
import { CurrentUser, RequirePermission, type AuthenticatedUser } from '../../common/decorators/index.js';
import { PrismaService } from '../../common/prisma.service.js';

@Controller('pipeline')
export class PipelineController {
  constructor(private readonly prisma: PrismaService) {}

  /** Kanban: uma coluna por etapa, com os cartoes do item 49. */
  @RequirePermission('crm.pipeline.view')
  @Get()
  async board(@CurrentUser() user: AuthenticatedUser) {
    const pipeline = await this.prisma.client.pipeline.findFirst({
      where: { organizationId: user.organizationId, isDefault: true },
      include: {
        stages: {
          orderBy: { position: 'asc' },
          include: {
            leads: {
              include: {
                contact: true,
                owner: { select: { id: true, name: true } },
                attribution: true,
                stageHistory: { orderBy: { createdAt: 'desc' }, take: 1 },
              },
              orderBy: { updatedAt: 'desc' },
              take: 50,
            },
          },
        },
      },
    });
    if (!pipeline) return { colunas: [] };

    const agora = Date.now();
    return {
      pipeline: pipeline.name,
      colunas: pipeline.stages.map((s) => ({
        key: s.key,
        nome: s.name,
        cor: s.color,
        total: s.leads.length,
        cartoes: s.leads.map((l) => {
          const desde = l.stageHistory[0]?.createdAt ?? l.createdAt;
          return {
            leadId: l.id,
            nome: l.contact.name ?? 'Sem nome',
            telefone: formatPhoneBR(l.contact.phoneE164),
            cidade: l.desiredCity,
            score: l.score,
            temperatura: l.temperature,
            origem: l.attribution?.firstTouchSource ?? 'direto',
            responsavel: l.owner?.name ?? null,
            diasNaEtapa: Math.floor((agora - desde.getTime()) / 86_400_000),
            proximaAcao: l.nextActionAt,
          };
        }),
      })),
    };
  }
}

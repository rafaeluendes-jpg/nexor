import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { z } from 'zod';
import { NotFoundError } from '@jolo/shared';
import { writeAudit } from '@jolo/crm-core';
import { CurrentUser, RequirePermission, type AuthenticatedUser } from '../../common/decorators/index.js';
import { ZodValidationPipe } from '../../common/pipes/zod.pipe.js';
import { PrismaService } from '../../common/prisma.service.js';

const ajusteSchema = z.object({
  pontos: z.number().int().min(0).max(100).optional(),
  ativa: z.boolean().optional(),
  rotulo: z.string().min(3).max(200).optional(),
});

/**
 * Pesos da pontuacao e perguntas de qualificacao (itens 24, 25 e 52).
 * Sao dados, nao codigo: a loja muda o peso sem publicar versao nova.
 */
@Controller('score-rules')
export class ScoreRulesController {
  constructor(private readonly prisma: PrismaService) {}

  @RequirePermission('crm.settings.view')
  @Get()
  async list() {
    const [regras, perguntas] = await Promise.all([
      this.prisma.client.scoreRule.findMany({ orderBy: { points: 'desc' } }),
      this.prisma.client.qualificationQuestion.findMany({ orderBy: { position: 'asc' } }),
    ]);
    const total = regras.filter((r) => r.active).reduce((soma, r) => soma + r.points, 0);
    return {
      // o time precisa ver se os pesos ainda somam 100: senao "score 100" perde o sentido
      somaDosPesos: total,
      regras: regras.map((r) => ({ id: r.id, chave: r.key, rotulo: r.label, pontos: r.points, ativa: r.active })),
      perguntas: perguntas.map((p) => ({
        id: p.id,
        chave: p.key,
        rotulo: p.label,
        ajuda: p.helpText,
        posicao: p.position,
        ativa: p.active,
      })),
    };
  }

  @RequirePermission('crm.settings.edit')
  @Patch(':id')
  async ajustar(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ajusteSchema)) body: z.infer<typeof ajusteSchema>,
  ): Promise<{ id: string; key: string; label: string; points: number; active: boolean }> {
    const atual = await this.prisma.client.scoreRule.findUnique({ where: { id } });
    if (!atual) throw new NotFoundError('Regra de pontuacao nao encontrada.');

    const regra = await this.prisma.client.scoreRule.update({
      where: { id },
      data: {
        ...(body.pontos !== undefined ? { points: body.pontos } : {}),
        ...(body.ativa !== undefined ? { active: body.ativa } : {}),
        ...(body.rotulo ? { label: body.rotulo } : {}),
      },
    });
    await writeAudit(this.prisma.client, {
      organizationId: user.organizationId,
      actorUserId: user.id,
      actorType: 'USER',
      event: 'score_rule.update',
      entity: 'ScoreRule',
      entityId: id,
      before: { points: atual.points, active: atual.active },
      after: { points: regra.points, active: regra.active },
    });
    return regra;
  }
}

import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { z } from 'zod';
import { DomainError } from '@jolo/shared';
import { CHAVES_DE_CONFIGURACAO, PADROES, gravarConfiguracao, lerConfiguracao, writeAudit } from '@jolo/crm-core';
import { CurrentUser, RequirePermission, type AuthenticatedUser } from '../../common/decorators/index.js';
import { PrismaService } from '../../common/prisma.service.js';

const horario = z.object({
  diasDaSemana: z.array(z.number().int().min(0).max(6)).min(1),
  horaInicio: z.string().regex(/^\d{2}:\d{2}$/),
  horaFim: z.string().regex(/^\d{2}:\d{2}$/),
  fusoHorario: z.string().min(3),
});

const roteamento = z.object({
  modo: z.enum(['RESPONSAVEL_FIXO', 'RODIZIO', 'POR_CIDADE', 'POR_ESTADO', 'POR_CAMPANHA', 'MANUAL']),
  responsavelPadraoId: z.string().uuid().nullable(),
  rodizio: z.array(z.string().uuid()),
  porChave: z.record(z.string(), z.string().uuid()),
});

const ia = z.object({
  ligada: z.boolean(),
  respondeForaDoHorario: z.boolean(),
  maxPerguntasAntesDeHumano: z.number().int().min(1).max(50),
  assinatura: z.string().max(120),
});

const mensagens = z.object({
  saudacao: z.string().min(5).max(1000),
  foraDoHorario: z.string().min(5).max(1000),
  transferencia: z.string().min(5).max(1000),
});

/** Cada chave tem o seu formato. Configuracao invalida nao entra. */
const FORMATOS: Record<string, z.ZodType> = {
  [CHAVES_DE_CONFIGURACAO.HORARIO_ATENDIMENTO]: horario,
  [CHAVES_DE_CONFIGURACAO.ROTEAMENTO]: roteamento,
  [CHAVES_DE_CONFIGURACAO.IA]: ia,
  [CHAVES_DE_CONFIGURACAO.MENSAGENS]: mensagens,
};

@Controller('settings')
export class SettingsController {
  constructor(private readonly prisma: PrismaService) {}

  @RequirePermission('crm.settings.view')
  @Get()
  async todas(@CurrentUser() user: AuthenticatedUser) {
    const chaves = Object.keys(PADROES);
    const valores: Record<string, unknown> = {};
    for (const chave of chaves) {
      valores[chave] = await lerConfiguracao(this.prisma.client, user.organizationId, chave);
    }
    return { configuracoes: valores };
  }

  @RequirePermission('crm.settings.view')
  @Get(':chave')
  async uma(@CurrentUser() user: AuthenticatedUser, @Param('chave') chave: string) {
    if (!FORMATOS[chave]) throw new DomainError('Configuracao desconhecida.', 'NOT_FOUND', 404);
    return { chave, valor: await lerConfiguracao(this.prisma.client, user.organizationId, chave) };
  }

  @RequirePermission('crm.settings.edit')
  @Put(':chave')
  async gravar(
    @CurrentUser() user: AuthenticatedUser,
    @Param('chave') chave: string,
    @Body() body: unknown,
  ) {
    const formato = FORMATOS[chave];
    if (!formato) throw new DomainError('Configuracao desconhecida.', 'NOT_FOUND', 404);

    const conferido = formato.safeParse(body);
    if (!conferido.success) {
      const detalhe = conferido.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
      throw new DomainError(`Configuracao invalida. ${detalhe}`, 'VALIDATION_ERROR', 422);
    }

    const antes = await lerConfiguracao(this.prisma.client, user.organizationId, chave);
    await gravarConfiguracao(this.prisma.client, user.organizationId, chave, conferido.data as object);
    await writeAudit(this.prisma.client, {
      organizationId: user.organizationId,
      actorUserId: user.id,
      actorType: 'USER',
      event: 'settings.update',
      entity: 'Setting',
      entityId: chave,
      before: antes,
      after: conferido.data,
    });
    return { chave, valor: conferido.data };
  }
}

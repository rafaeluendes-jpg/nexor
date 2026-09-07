import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { CurrentUser, RequirePermission, type AuthenticatedUser } from '../../common/decorators/index.js';
import { ZodValidationPipe } from '../../common/pipes/zod.pipe.js';
import { STATUS_PRACA, TerritoriesService } from './territories.service.js';

const status = z.enum(STATUS_PRACA);

const criarSchema = z.object({
  cidade: z.string().min(2).max(120),
  uf: z.string().length(2),
  status: status.optional(),
  prioridade: z.number().int().min(0).max(10).optional(),
  observacoes: z.string().max(1000).optional(),
});

const atualizarSchema = z.object({
  status: status.optional(),
  prioridade: z.number().int().min(0).max(10).optional(),
  observacoes: z.string().max(1000).optional(),
  responsavelId: z.string().uuid().nullable().optional(),
  leadId: z.string().uuid().nullable().optional(),
});

@Controller('territories')
export class TerritoriesController {
  constructor(private readonly service: TerritoriesService) {}

  @RequirePermission('crm.leads.view')
  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query() q: Record<string, string | undefined>) {
    return this.service.list(user, { status: q.status, uf: q.uf, busca: q.busca });
  }

  @RequirePermission('crm.leads.view')
  @Get('disponiveis')
  disponiveis(@CurrentUser() user: AuthenticatedUser) {
    return this.service.disponiveis(user);
  }

  @RequirePermission('crm.settings.edit')
  @Post()
  criar(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(criarSchema)) body: z.infer<typeof criarSchema>,
  ) {
    return this.service.criar(user, body);
  }

  @RequirePermission('crm.settings.edit')
  @Patch(':id')
  atualizar(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(atualizarSchema)) body: z.infer<typeof atualizarSchema>,
  ) {
    return this.service.atualizar(user, id, body);
  }
}

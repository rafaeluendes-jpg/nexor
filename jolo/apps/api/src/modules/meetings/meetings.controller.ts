import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { CurrentUser, RequirePermission, type AuthenticatedUser } from '../../common/decorators/index.js';
import { ZodValidationPipe } from '../../common/pipes/zod.pipe.js';
import { MeetingsService } from './meetings.service.js';

const criarSchema = z.object({
  leadId: z.string().uuid(),
  titulo: z.string().min(3).max(200),
  quando: z.string().datetime(),
  duracaoMin: z.number().int().min(15).max(480).optional(),
  local: z.string().max(300).optional(),
  observacoes: z.string().max(2000).optional(),
  responsavelId: z.string().uuid().optional(),
});

const statusSchema = z.object({
  status: z.enum(['AGENDADA', 'REALIZADA', 'CANCELADA', 'NAO_COMPARECEU']),
  observacoes: z.string().max(2000).optional(),
});

@Controller('meetings')
export class MeetingsController {
  constructor(private readonly service: MeetingsService) {}

  @RequirePermission('crm.leads.view')
  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query() q: Record<string, string | undefined>) {
    return this.service.list(user, { de: q.de, ate: q.ate, status: q.status, leadId: q.lead });
  }

  @RequirePermission('crm.leads.edit')
  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(criarSchema)) body: z.infer<typeof criarSchema>,
  ) {
    return this.service.create(user, body);
  }

  @RequirePermission('crm.leads.edit')
  @Patch(':id/status')
  status(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(statusSchema)) body: z.infer<typeof statusSchema>,
  ) {
    return this.service.setStatus(user, id, body.status, body.observacoes);
  }
}

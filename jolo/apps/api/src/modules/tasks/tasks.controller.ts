import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { CurrentUser, RequirePermission, type AuthenticatedUser } from '../../common/decorators/index.js';
import { ZodValidationPipe } from '../../common/pipes/zod.pipe.js';
import { TasksService } from './tasks.service.js';

const criarSchema = z.object({
  titulo: z.string().min(3).max(200),
  descricao: z.string().max(2000).optional(),
  prazo: z.string().datetime().optional(),
  leadId: z.string().uuid().optional(),
  responsavelId: z.string().uuid().optional(),
});

@Controller('tasks')
export class TasksController {
  constructor(private readonly service: TasksService) {}

  @RequirePermission('crm.leads.view')
  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query() q: Record<string, string | undefined>) {
    return this.service.list(user, {
      status: q.status,
      ownerId: q.responsavel,
      leadId: q.lead,
      ateData: q.ate,
      take: q.take ? Number(q.take) : undefined,
    });
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
  complete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(z.object({ concluida: z.boolean() }))) body: { concluida: boolean },
  ) {
    return this.service.complete(user, id, body.concluida);
  }
}

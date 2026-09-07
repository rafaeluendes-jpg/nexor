import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { PIPELINE_STAGES } from '@jolo/shared';
import type { Lead } from '@jolo/database';
import { CurrentUser, RequirePermission, type AuthenticatedUser } from '../../common/decorators/index.js';
import { ZodValidationPipe } from '../../common/pipes/zod.pipe.js';
import { LeadsService } from './leads.service.js';

const moveSchema = z.object({
  stageKey: z.enum(PIPELINE_STAGES.map((s) => s.key) as [string, ...string[]]),
  reason: z.string().max(300).optional(),
});

@Controller('leads')
export class LeadsController {
  constructor(private readonly service: LeadsService) {}

  @RequirePermission('crm.leads.view')
  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: Record<string, string | undefined>,
  ) {
    return this.service.list(user, {
      search: query.search,
      stageKey: query.stage,
      ownerId: query.owner,
      city: query.city,
      campaign: query.campaign,
      temperature: query.temperature,
      from: query.from,
      to: query.to,
      take: query.take ? Number(query.take) : undefined,
      skip: query.skip ? Number(query.skip) : undefined,
    });
  }

  @RequirePermission('crm.leads.view')
  @Get(':id/timeline')
  timeline(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.timeline(user, id);
  }

  @RequirePermission('crm.pipeline.move')
  @Post(':id/stage')
  move(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(moveSchema)) body: z.infer<typeof moveSchema>,
  ): Promise<Lead> {
    return this.service.move(user, id, body.stageKey as never, body.reason);
  }

  @RequirePermission('crm.leads.edit')
  @Post(':id/score')
  score(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.recalcScore(user, id);
  }
}

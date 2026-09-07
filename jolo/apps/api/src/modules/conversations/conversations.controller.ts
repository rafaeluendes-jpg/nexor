import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { CurrentUser, RequirePermission, type AuthenticatedUser } from '../../common/decorators/index.js';
import { ZodValidationPipe } from '../../common/pipes/zod.pipe.js';
import { ConversationsService } from './conversations.service.js';

const replySchema = z.object({ body: z.string().min(1).max(4000) });
const reasonSchema = z.object({ reason: z.string().max(300).optional() });

@Controller('conversations')
export class ConversationsController {
  constructor(private readonly service: ConversationsService) {}

  @RequirePermission('crm.conversations.view')
  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query('search') search?: string) {
    return this.service.list(user, { search });
  }

  @RequirePermission('crm.conversations.view')
  @Get(':id')
  detail(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.detail(user, id);
  }

  @RequirePermission('crm.conversations.reply')
  @Post(':id/reply')
  reply(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(replySchema)) body: z.infer<typeof replySchema>,
  ) {
    return this.service.reply(user, id, body.body);
  }

  @RequirePermission('crm.conversations.takeover')
  @HttpCode(200)
  @Post(':id/takeover')
  takeOver(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(reasonSchema)) body: z.infer<typeof reasonSchema>,
  ) {
    return this.service.takeOver(user, id, body.reason);
  }

  @RequirePermission('crm.conversations.takeover')
  @HttpCode(200)
  @Post(':id/release')
  release(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(reasonSchema)) body: z.infer<typeof reasonSchema>,
  ) {
    return this.service.release(user, id, body.reason);
  }
}

import { Body, Controller, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { z } from 'zod';
import { CurrentUser, RequirePermission, type AuthenticatedUser } from '../../common/decorators/index.js';
import { ZodValidationPipe } from '../../common/pipes/zod.pipe.js';
import { UsersService } from './users.service.js';

const papel = z.enum(['SUPER_ADMIN', 'ADMIN', 'EXPANSAO', 'ATENDENTE', 'MARKETING', 'VISUALIZACAO']);

const createSchema = z.object({
  nome: z.string().min(2).max(120),
  email: z.string().email().max(200),
  papel,
  senhaProvisoria: z.string().min(12).max(200),
});

@Controller('users')
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @RequirePermission('crm.users.view')
  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.service.list(user);
  }

  @RequirePermission('crm.users.create')
  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createSchema)) body: z.infer<typeof createSchema>,
  ) {
    return this.service.create(user, body);
  }

  @RequirePermission('crm.users.edit')
  @Patch(':id/role')
  setRole(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(z.object({ papel }))) body: { papel: z.infer<typeof papel> },
  ) {
    return this.service.setRole(user, id, body.papel);
  }

  @RequirePermission('crm.users.disable')
  @Patch(':id/status')
  setStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(z.object({ ativo: z.boolean() }))) body: { ativo: boolean },
  ) {
    return this.service.setStatus(user, id, body.ativo);
  }

  @RequirePermission('crm.users.edit')
  @HttpCode(200)
  @Post(':id/revoke-sessions')
  revoke(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.revokeSessions(user, id);
  }

  @RequirePermission('crm.users.edit')
  @HttpCode(200)
  @Post(':id/password-reset')
  reset(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.requestPasswordReset(user, id);
  }
}

import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { CurrentUser, RequirePermission, type AuthenticatedUser } from '../../common/decorators/index.js';
import { ZodValidationPipe } from '../../common/pipes/zod.pipe.js';
import { CofService } from './cof.service.js';

const abrirSchema = z.object({
  leadId: z.string().uuid(),
  versao: z.string().max(60).optional(),
  prazoDias: z.number().int().min(1).max(90).optional(),
});
const dataSchema = z.object({ quando: z.string().datetime().optional() });

@Controller('cof')
export class CofController {
  constructor(private readonly service: CofService) {}

  @RequirePermission('crm.documents.view')
  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query('status') status?: string) {
    return this.service.list(user, status);
  }

  @RequirePermission('crm.documents.upload')
  @Post()
  abrir(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(abrirSchema)) body: z.infer<typeof abrirSchema>,
  ) {
    return this.service.abrir(user, body);
  }

  @RequirePermission('crm.documents.upload')
  @HttpCode(200)
  @Post(':id/envio')
  envio(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(dataSchema)) body: z.infer<typeof dataSchema>,
  ) {
    return this.service.registrarEnvio(user, id, body.quando);
  }

  @RequirePermission('crm.documents.upload')
  @HttpCode(200)
  @Post(':id/recebimento')
  recebimento(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(dataSchema)) body: z.infer<typeof dataSchema>,
  ) {
    return this.service.registrarRecebimento(user, id, body.quando);
  }

  @RequirePermission('crm.documents.upload')
  @HttpCode(200)
  @Post(':id/liberar-contrato')
  liberar(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.liberarContrato(user, id);
  }

  @RequirePermission('crm.documents.upload')
  @HttpCode(200)
  @Post(':id/cancelar')
  cancelar(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(z.object({ motivo: z.string().min(3).max(300) }))) body: { motivo: string },
  ) {
    return this.service.cancelar(user, id, body.motivo);
  }
}

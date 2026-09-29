import { Body, Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import { z } from 'zod';
import { DomainError } from '@jolo/shared';
import { CurrentUser, SemTermo, type AuthenticatedUser } from '../../common/decorators/index.js';
import { ZodValidationPipe } from '../../common/pipes/zod.pipe.js';
import { TermoService } from './termo.service.js';

const aceiteSchema = z.object({ versao: z.string().min(1).max(40) });

@Controller('termos')
export class TermoController {
  constructor(private readonly termo: TermoService) {}

  @SemTermo()
  @Get('atual')
  atual(@CurrentUser() user: AuthenticatedUser) {
    return this.termo.atual(user);
  }

  @SemTermo()
  @HttpCode(200)
  @Post('aceitar')
  async aceitar(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(aceiteSchema)) body: z.infer<typeof aceiteSchema>,
    @Req() req: { ip?: string; headers: Record<string, string> },
  ) {
    const r = await this.termo.aceitar(user, body.versao, { ip: req.ip, userAgent: req.headers['user-agent'] });
    if (!r.ok) throw new DomainError(r.motivo, 'TERMO_DESATUALIZADO', 409);
    return r;
  }
}

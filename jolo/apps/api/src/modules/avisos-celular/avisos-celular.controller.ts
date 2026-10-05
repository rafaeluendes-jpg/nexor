import { Body, Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import { z } from 'zod';
import { loadServerEnv } from '@jolo/config/server';
import { CurrentUser, RequirePermission, type AuthenticatedUser } from '../../common/decorators/index.js';
import { ZodValidationPipe } from '../../common/pipes/zod.pipe.js';
import { PrismaService } from '../../common/prisma.service.js';

/**
 * So os servicos de aviso dos proprios navegadores (Google, Apple, Mozilla,
 * Microsoft). O servidor manda o aviso para este endereco: aceitar qualquer
 * um deixaria alguem usar o CRM para chamar endereco interno.
 */
const SERVICOS_DE_AVISO = [
  /^fcm\.googleapis\.com$/,
  /^android\.googleapis\.com$/,
  /^updates\.push\.services\.mozilla\.com$/,
  /^[a-z0-9.-]+\.push\.apple\.com$/,
  /^[a-z0-9.-]+\.notify\.windows\.com$/,
];

export function enderecoDeAvisoValido(endereco: string): boolean {
  try {
    const u = new URL(endereco);
    return u.protocol === 'https:' && !u.port && SERVICOS_DE_AVISO.some((r) => r.test(u.hostname));
  } catch {
    return false;
  }
}

const inscricaoSchema = z.object({
  endpoint: z.string().max(1000).refine(enderecoDeAvisoValido, 'Endereco de aviso nao reconhecido.'),
  keys: z.object({
    p256dh: z.string().min(20).max(200),
    auth: z.string().min(8).max(100),
  }),
});
const desligarSchema = z.object({ endpoint: z.string().max(1000) });

@Controller('avisos-no-celular')
export class AvisosCelularController {
  private readonly env = loadServerEnv();

  constructor(private readonly prisma: PrismaService) {}

  /** Chave publica: o navegador precisa dela para pedir a inscricao. Nao e segredo. */
  @RequirePermission('crm.conversations.view')
  @Get('chave')
  chave() {
    return { chave: this.env.VAPID_PUBLIC_KEY ?? null };
  }

  @RequirePermission('crm.conversations.view')
  @HttpCode(200)
  @Post()
  async ligar(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(inscricaoSchema)) body: z.infer<typeof inscricaoSchema>,
    @Req() req: { headers: Record<string, string | undefined> },
  ) {
    const dados = {
      organizationId: user.organizationId,
      userId: user.id,
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
      userAgent: req.headers['user-agent']?.slice(0, 300) ?? null,
    };
    // Mesmo aparelho, outra pessoa entrou: o aviso passa a ser dela.
    await this.prisma.client.pushSubscription.upsert({
      where: { endpoint: body.endpoint },
      create: { endpoint: body.endpoint, ...dados },
      update: dados,
    });
    return { ligado: true };
  }

  /** Sem permissao especial: qualquer um desliga os avisos do proprio aparelho. */
  @HttpCode(200)
  @Post('desligar')
  async desligar(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(desligarSchema)) body: z.infer<typeof desligarSchema>,
  ) {
    await this.prisma.client.pushSubscription.deleteMany({ where: { endpoint: body.endpoint, userId: user.id } });
    return { ligado: false };
  }
}

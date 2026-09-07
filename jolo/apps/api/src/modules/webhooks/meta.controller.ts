import { Controller, Get, HttpCode, Post, Query, Req, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { loadServerEnv } from '@jolo/config/server';
import { DomainError } from '@jolo/shared';
import { verifyMetaSignature, verifyWebhookChallenge } from '@jolo/security';
import { webhookEventKey } from '@jolo/whatsapp';
import { Public, RateLimit } from '../../common/decorators/index.js';
import { PrismaService } from '../../common/prisma.service.js';
import { QueueService } from '../queue/queue.service.js';
import { logger } from '../../common/logger.js';

type RawRequest = {
  rawBody?: Buffer;
  headers: Record<string, string | undefined>;
  correlationId?: string;
  requestId?: string;
  ip?: string;
};

@Controller('webhooks/meta')
export class MetaWebhookController {
  private readonly env = loadServerEnv();

  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
  ) {}

  /** Verificacao/challenge exigida pela Meta ao cadastrar o webhook. */
  @Public()
  @Get('whatsapp')
  verify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: FastifyReply,
  ): void {
    const resultado = verifyWebhookChallenge({
      mode,
      token,
      challenge,
      verifyToken: this.env.META_WEBHOOK_VERIFY_TOKEN,
    });
    if (!resultado.ok) {
      res.status(403).send('forbidden');
      return;
    }
    res.header('content-type', 'text/plain').status(200).send(resultado.challenge);
  }

  /**
   * Recebimento de eventos. Ordem obrigatoria:
   * 1. valida assinatura;  2. grava o evento cru;  3. enfileira;  4. responde 200.
   * Nada de processamento pesado aqui: a Meta espera resposta rapida.
   */
  @Public()
  @RateLimit('webhook')
  @HttpCode(200)
  @Post('whatsapp')
  async receive(@Req() req: RawRequest): Promise<{ received: boolean }> {
    const raw = req.rawBody ?? Buffer.alloc(0);
    const assinatura = req.headers['x-hub-signature-256'];
    const correlationId = req.correlationId ?? req.requestId ?? 'sem-correlacao';

    const check = verifyMetaSignature({
      rawBody: raw,
      signatureHeader: assinatura,
      appSecret: this.env.META_APP_SECRET ?? '',
    });

    if (!check.valid) {
      // Guardamos a tentativa recusada para auditoria, sem processar nada.
      await this.prisma.client.webhookEvent
        .create({
          data: {
            payload: { motivo: check.reason, ip: req.ip ?? null } as object,
            signature: assinatura ?? null,
            status: 'rejected',
            error: check.reason,
          },
        })
        .catch(() => undefined);
      logger.warn({ motivo: check.reason, correlationId }, 'webhook recusado por assinatura');
      // 403 sem detalhe: nao ensinamos o atacante onde errou.
      throw new DomainError('forbidden', 'FORBIDDEN', 403);
    }

    let payload: unknown;
    try {
      payload = JSON.parse(raw.toString('utf8'));
    } catch {
      return { received: true };
    }

    const externalId = webhookEventKey(payload);
    const existente = externalId
      ? await this.prisma.client.webhookEvent.findFirst({
          where: { provider: 'meta_whatsapp', externalId },
        })
      : null;

    // Idempotencia: o mesmo evento reenviado pela Meta nao vira mensagem duplicada.
    if (existente) {
      logger.info({ externalId, correlationId }, 'webhook duplicado ignorado');
      return { received: true };
    }

    const evento = await this.prisma.client.webhookEvent.create({
      data: {
        provider: 'meta_whatsapp',
        externalId,
        signature: assinatura ?? null,
        payload: payload as object,
        status: 'received',
      },
    });

    await this.queue.inboundWebhook(evento.id, correlationId);
    return { received: true };
  }
}

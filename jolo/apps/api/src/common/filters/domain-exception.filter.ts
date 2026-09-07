import { Catch, HttpException, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import { DomainError } from '@jolo/shared';
import type { FastifyReply } from 'fastify';
import { logger } from '../logger.js';

/** Resposta de erro padronizada e sem vazar detalhe interno. */
@Catch()
export class DomainExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<FastifyReply>();
    const req = ctx.getRequest<{ requestId?: string; url?: string }>();

    if (exception instanceof DomainError) {
      res.status(exception.httpStatus).send({
        error: exception.code,
        message: exception.message,
        requestId: req.requestId,
      });
      return;
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      res.status(status).send({
        error: 'HTTP_ERROR',
        message: typeof body === 'string' ? body : ((body as Record<string, unknown>).message ?? 'erro'),
        requestId: req.requestId,
      });
      return;
    }

    logger.error(
      { err: exception instanceof Error ? exception.message : String(exception), url: req.url, requestId: req.requestId },
      'erro nao tratado',
    );
    res.status(500).send({
      error: 'INTERNAL_ERROR',
      message: 'Erro interno. A equipe foi notificada.',
      requestId: req.requestId,
    });
  }
}

import { Injectable, type NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    requestId?: string;
    correlationId?: string;
  }
}

/** Todo pedido ganha request_id e correlation_id, do webhook ate o worker. */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: FastifyRequest['raw'] & Record<string, any>, res: FastifyReply['raw'], next: () => void): void {
    const requestId = (req.headers?.['x-request-id'] as string) ?? randomUUID();
    const correlationId = (req.headers?.['x-correlation-id'] as string) ?? requestId;
    req.requestId = requestId;
    req.correlationId = correlationId;
    res.setHeader('x-request-id', requestId);
    next();
  }
}

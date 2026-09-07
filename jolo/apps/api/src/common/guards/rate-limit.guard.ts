import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DomainError } from '@jolo/shared';
import { MemoryRateLimitStore, RATE_LIMITS, checkRateLimit } from '@jolo/security';
import { RATE_LIMIT_RULE } from '../decorators/index.js';
import { RedisService } from '../redis.service.js';

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly fallback = new MemoryRateLimitStore();

  constructor(
    private readonly reflector: Reflector,
    private readonly redis: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const nome = this.reflector.getAllAndOverride<keyof typeof RATE_LIMITS>(RATE_LIMIT_RULE, [
      context.getHandler(),
      context.getClass(),
    ]);
    const regra = RATE_LIMITS[nome ?? 'api'];
    const req = context.switchToHttp().getRequest<{ ip?: string; url?: string; user?: { id: string } }>();
    const identidade = req.user?.id ?? req.ip ?? 'desconhecido';
    const chave = `${nome ?? 'api'}:${identidade}`;

    let resultado: Awaited<ReturnType<typeof checkRateLimit>>;
    try {
      resultado = await checkRateLimit(this.redis, chave, regra);
    } catch {
      resultado = await checkRateLimit(this.fallback, chave, regra);
    }
    if (!resultado.allowed) {
      throw new DomainError('Muitas tentativas. Aguarde alguns minutos.', 'RATE_LIMITED', 429);
    }
    return true;
  }
}

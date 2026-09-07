import { Controller, Get } from '@nestjs/common';
import { loadServerEnv, aiConfigured, whatsappConfigured } from '@jolo/config/server';
import { Public } from '../../common/decorators/index.js';
import { PrismaService } from '../../common/prisma.service.js';
import { RedisService } from '../../common/redis.service.js';

@Controller()
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /** Vivo? Responde sem tocar em dependencia externa. */
  @Public()
  @Get('health')
  health() {
    return { status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() };
  }

  /** Pronto para receber trafego? Confere banco, fila e integracoes. */
  @Public()
  @Get('readiness')
  async readiness() {
    const env = loadServerEnv();
    const banco = await this.prisma.client
      .$queryRaw`select 1`
      .then(() => true)
      .catch(() => false);
    const fila = await this.redis.healthy();
    const pronto = banco && fila;
    return {
      status: pronto ? 'ready' : 'degraded',
      checks: {
        database: banco,
        redis: fila,
        whatsapp: whatsappConfigured(env),
        ai: aiConfigured(env),
        authProvider: env.AUTH_PROVIDER,
      },
    };
  }
}

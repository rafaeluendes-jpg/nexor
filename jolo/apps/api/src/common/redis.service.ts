import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';
import { loadServerEnv } from '@jolo/config/server';
import type { RateLimitStore } from '@jolo/security';

@Injectable()
export class RedisService implements OnModuleDestroy, RateLimitStore {
  readonly connection: Redis;

  constructor() {
    const env = loadServerEnv();
    this.connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null, lazyConnect: false });
    this.connection.on('error', () => {
      /* erro tratado por quem usa; nao derruba a API */
    });
  }

  /** Janela fixa no Redis: contagem por chave com expiracao. */
  async incr(key: string, windowMs: number): Promise<number> {
    const chave = `rl:${key}`;
    const atual = await this.connection.incr(chave);
    if (atual === 1) await this.connection.pexpire(chave, windowMs);
    return atual;
  }

  async healthy(): Promise<boolean> {
    try {
      return (await this.connection.ping()) === 'PONG';
    } catch {
      return false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.connection.quit().catch(() => undefined);
  }
}

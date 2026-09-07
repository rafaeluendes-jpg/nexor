import { Worker } from 'bullmq';
import { QUEUES } from '@jolo/shared';
import type { WorkerContext } from './context.js';

/**
 * Avisos internos. Na Fase 1 grava no log e numa lista do Redis que o CRM le.
 * E-mail, push e Slack entram na Fase 2 sem mexer em quem publica o evento.
 */
export function startNotificationWorker(ctx: WorkerContext): Worker {
  return new Worker(
    QUEUES.NOTIFICATIONS,
    async (job) => {
      const evento = { ...job.data, at: new Date().toISOString() };
      await ctx.redis.lpush('jolo:notifications', JSON.stringify(evento));
      await ctx.redis.ltrim('jolo:notifications', 0, 199);
      ctx.logger.info({ notificacao: evento }, 'notificacao registrada');
    },
    { connection: ctx.redis, concurrency: 2 },
  );
}

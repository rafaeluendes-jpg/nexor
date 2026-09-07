import { Queue } from 'bullmq';
import { QUEUES } from '@jolo/shared';
import type { WorkerContext } from './context.js';

const cache = new Map<string, Queue>();

function queue(ctx: WorkerContext, name: string): Queue {
  let q = cache.get(name);
  if (!q) {
    q = new Queue(name, {
      connection: ctx.redis,
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 2_000 },
        removeOnComplete: 1_000,
        removeOnFail: 5_000,
      },
    });
    cache.set(name, q);
  }
  return q;
}

/** Ponte entre workers: um worker pode enfileirar trabalho para outro. */
export const QueueBridge = {
  async aiTurn(ctx: WorkerContext, conversationId: string, correlationId: string): Promise<void> {
    await queue(ctx, QUEUES.AI).add('turn', { conversationId, correlationId });
  },
  async outbound(ctx: WorkerContext, messageId: string, correlationId: string): Promise<void> {
    await queue(ctx, QUEUES.WHATSAPP_OUTBOUND).add('send', { messageId, correlationId }, { jobId: messageId });
  },
  async excelSync(ctx: WorkerContext, organizationId: string, reason: string, exportId?: string): Promise<void> {
    await queue(ctx, QUEUES.EXCEL).add('sync', { organizationId, reason, exportId });
  },
  async notify(ctx: WorkerContext, payload: object): Promise<void> {
    await queue(ctx, QUEUES.NOTIFICATIONS).add('notify', payload);
  },
  async closeAll(): Promise<void> {
    for (const q of cache.values()) await q.close().catch(() => undefined);
    cache.clear();
  },
};

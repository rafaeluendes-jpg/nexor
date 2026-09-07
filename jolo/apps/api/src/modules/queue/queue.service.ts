import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import { QUEUES, type QueueName } from '@jolo/shared';
import { RedisService } from '../../common/redis.service.js';

/**
 * Produtor de jobs. O webhook responde rapido e o trabalho pesado
 * vai para a fila (itens 11, 45 e 46).
 */
@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly queues = new Map<QueueName, Queue>();

  constructor(private readonly redis: RedisService) {}

  queue(name: QueueName): Queue {
    let q = this.queues.get(name);
    if (!q) {
      q = new Queue(name, {
        connection: this.redis.connection,
        defaultJobOptions: {
          attempts: 5,
          backoff: { type: 'exponential', delay: 2_000 },
          removeOnComplete: 1_000,
          removeOnFail: 5_000,
        },
      });
      this.queues.set(name, q);
    }
    return q;
  }

  /** jobId estavel garante idempotencia: o mesmo evento nao entra duas vezes. */
  async add(name: QueueName, jobName: string, data: object, jobId?: string): Promise<void> {
    await this.queue(name).add(jobName, data, jobId ? { jobId } : undefined);
  }

  async inboundWebhook(webhookEventId: string, correlationId: string): Promise<void> {
    await this.add(QUEUES.WHATSAPP_INBOUND, 'process', { webhookEventId, correlationId }, webhookEventId);
  }

  async outboundMessage(messageId: string, correlationId: string): Promise<void> {
    await this.add(QUEUES.WHATSAPP_OUTBOUND, 'send', { messageId, correlationId }, messageId);
  }

  async aiTurn(conversationId: string, correlationId: string): Promise<void> {
    await this.add(QUEUES.AI, 'turn', { conversationId, correlationId });
  }

  async excelSync(organizationId: string, reason: string, exportId?: string): Promise<void> {
    await this.add(QUEUES.EXCEL, 'sync', { organizationId, reason, exportId });
  }

  async onModuleDestroy(): Promise<void> {
    for (const q of this.queues.values()) await q.close().catch(() => undefined);
  }
}

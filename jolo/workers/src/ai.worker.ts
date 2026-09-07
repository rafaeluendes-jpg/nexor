import { Worker } from 'bullmq';
import { AUDIT_EVENTS, QUEUES, type AiJob } from '@jolo/shared';
import { aiMayAnswer, writeActivity, writeAudit } from '@jolo/crm-core';
import { runSdrTurn } from '@jolo/ai-sdr';
import type { WorkerContext } from './context.js';
import { QueueBridge } from './bridge.js';

/** Roda um turno do SDR e enfileira a resposta. Nao envia direto. */
export function startAiWorker(ctx: WorkerContext): Worker {
  const { prisma, logger } = ctx;

  return new Worker<AiJob>(
    QUEUES.AI,
    async (job) => {
      const conversa = await prisma.conversation.findUnique({ where: { id: job.data.conversationId } });
      if (!conversa) return;

      // Trava de posse: se um humano assumiu, a IA nao fala.
      if (!aiMayAnswer(conversa)) {
        logger.info({ conversationId: conversa.id }, 'IA em silencio: conversa com humano');
        return;
      }

      const resultado = await runSdrTurn({
        prisma,
        provider: ctx.ai,
        conversationId: conversa.id,
        correlationId: job.data.correlationId,
        maxTokens: ctx.env.AI_MAX_TOKENS,
      });

      if (resultado.status === 'skipped_disabled') {
        // Sem IA configurada: vira tarefa para uma pessoa atender.
        await prisma.task.create({
          data: {
            organizationId: conversa.organizationId,
            leadId: conversa.leadId,
            title: 'Responder lead no WhatsApp',
            description: 'IA nao configurada. Atendimento humano necessario.',
            dueAt: new Date(Date.now() + 15 * 60_000),
          },
        });
        await QueueBridge.notify(ctx, { tipo: 'lead_sem_ia', conversationId: conversa.id });
        return;
      }

      if (resultado.status === 'handoff') {
        await writeAudit(prisma, {
          organizationId: conversa.organizationId,
          event: AUDIT_EVENTS.AI_PAUSED,
          entity: 'conversation',
          entityId: conversa.id,
          actorType: 'AI',
          after: { motivo: 'handoff pedido pela IA' },
          correlationId: job.data.correlationId,
        });
        await QueueBridge.notify(ctx, { tipo: 'handoff', conversationId: conversa.id });
        return;
      }

      if (resultado.status === 'answered' && resultado.reply) {
        const mensagem = await prisma.message.create({
          data: {
            organizationId: conversa.organizationId,
            conversationId: conversa.id,
            direction: 'OUTBOUND',
            author: 'AI',
            type: 'text',
            body: resultado.reply,
            status: 'QUEUED',
          },
        });
        await writeActivity(prisma, {
          organizationId: conversa.organizationId,
          leadId: conversa.leadId,
          type: 'ai_reply',
          title: 'IA respondeu o lead',
          description: resultado.reply.slice(0, 200),
        });
        await QueueBridge.outbound(ctx, mensagem.id, job.data.correlationId);
        return;
      }

      if (resultado.status === 'error') {
        logger.error({ conversationId: conversa.id, erro: resultado.error }, 'falha no turno da IA');
        throw new Error(resultado.error ?? 'falha na IA');
      }
    },
    { connection: ctx.redis, concurrency: 2 },
  );
}

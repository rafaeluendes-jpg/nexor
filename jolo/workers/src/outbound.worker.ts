import { Worker } from 'bullmq';
import { AUDIT_EVENTS, QUEUES, type OutboundJob } from '@jolo/shared';
import { writeAudit } from '@jolo/crm-core';
import type { WorkerContext } from './context.js';

/** Envia pela Cloud API oficial e guarda o wamid para casar os status depois. */
export function startOutboundWorker(ctx: WorkerContext): Worker {
  const { prisma, logger } = ctx;

  return new Worker<OutboundJob>(
    QUEUES.WHATSAPP_OUTBOUND,
    async (job) => {
      const mensagem = await prisma.message.findUnique({
        where: { id: job.data.messageId },
        include: { conversation: { include: { contact: true } } },
      });
      if (!mensagem || mensagem.direction !== 'OUTBOUND') return;
      if (mensagem.status !== 'QUEUED') return; // ja enviada: nao duplica

      if (!ctx.whatsapp) {
        // Sem credencial: a mensagem fica na fila do banco, marcada, sem sumir.
        await prisma.message.update({
          where: { id: mensagem.id },
          data: {
            status: 'FAILED',
            failedAt: new Date(),
            errorCode: 'SEM_CREDENCIAL',
            errorMessage: 'WhatsApp Cloud API nao configurado. Preencha META_WHATSAPP_ACCESS_TOKEN.',
          },
        });
        logger.warn({ messageId: mensagem.id }, 'envio ignorado: WhatsApp nao configurado');
        return;
      }

      const destino = mensagem.conversation.contact.whatsappId ?? mensagem.conversation.contact.phoneE164;
      const inicio = Date.now();
      const resultado = await ctx.whatsapp.sendText(destino, mensagem.body ?? '');

      await prisma.integrationLog.create({
        data: {
          organizationId: mensagem.organizationId,
          integration: 'meta_whatsapp',
          direction: 'outbound',
          endpoint: 'messages',
          statusCode: resultado.statusCode,
          responseBody: resultado.raw as object,
          error: resultado.error?.message,
          durationMs: Date.now() - inicio,
          correlationId: job.data.correlationId,
        },
      });

      if (!resultado.ok) {
        await prisma.message.update({
          where: { id: mensagem.id },
          data: {
            status: 'FAILED',
            failedAt: new Date(),
            errorCode: resultado.error?.code,
            errorMessage: resultado.error?.message,
          },
        });
        await writeAudit(prisma, {
          organizationId: mensagem.organizationId,
          event: AUDIT_EVENTS.MESSAGE_FAILED,
          entity: 'message',
          entityId: mensagem.id,
          actorType: 'SYSTEM',
          after: { erro: resultado.error },
          correlationId: job.data.correlationId,
        });
        throw new Error(`Envio recusado pela Meta: ${resultado.error?.message ?? resultado.statusCode}`);
      }

      await prisma.message.update({
        where: { id: mensagem.id },
        data: { status: 'SENT', sentAt: new Date(), wamid: resultado.wamid },
      });
      await prisma.conversation.update({
        where: { id: mensagem.conversationId },
        data: { lastMessageAt: new Date() },
      });
      await writeAudit(prisma, {
        organizationId: mensagem.organizationId,
        event: AUDIT_EVENTS.MESSAGE_SENT,
        entity: 'message',
        entityId: mensagem.id,
        actorType: mensagem.author === 'AI' ? 'AI' : 'USER',
        actorUserId: mensagem.senderUserId,
        after: { wamid: resultado.wamid },
        correlationId: job.data.correlationId,
      });
    },
    { connection: ctx.redis, concurrency: 6 },
  );
}

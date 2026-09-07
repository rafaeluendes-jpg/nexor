import { Queue, Worker } from 'bullmq';
import { QUEUES } from '@jolo/shared';
import { createContext } from './context.js';
import { startInboundWorker } from './inbound.worker.js';
import { startOutboundWorker } from './outbound.worker.js';
import { startAiWorker } from './ai.worker.js';
import { startExcelWorker } from './excel.worker.js';
import { startFollowupWorker } from './followup.worker.js';
import { startNotificationWorker } from './notification.worker.js';
import { QueueBridge } from './bridge.js';

async function main(): Promise<void> {
  const ctx = createContext();
  const workers: Worker[] = [
    startInboundWorker(ctx),
    startOutboundWorker(ctx),
    startAiWorker(ctx),
    startExcelWorker(ctx),
    startFollowupWorker(ctx),
    startNotificationWorker(ctx),
  ];

  for (const w of workers) {
    w.on('failed', (job, err) => {
      ctx.logger.error({ fila: w.name, jobId: job?.id, tentativa: job?.attemptsMade, erro: err.message }, 'job falhou');
    });
    // Job que estourou todas as tentativas fica registrado, nunca sumindo em silencio.
    w.on('error', (err) => ctx.logger.error({ fila: w.name, erro: err.message }, 'erro no worker'));
  }

  // Rotina de follow-up a cada 15 minutos.
  const agenda = new Queue(QUEUES.FOLLOWUPS, { connection: ctx.redis });
  await agenda.upsertJobScheduler(
    'followup-rotina',
    { every: 15 * 60_000 },
    { name: 'rotina', data: {}, opts: { removeOnComplete: 50 } },
  );

  ctx.logger.info({ filas: workers.map((w) => w.name) }, 'workers Jolo no ar');

  const encerrar = async (): Promise<void> => {
    ctx.logger.info('encerrando workers');
    await Promise.all(workers.map((w) => w.close()));
    await agenda.close();
    await QueueBridge.closeAll();
    await ctx.redis.quit().catch(() => undefined);
    await ctx.prisma.$disconnect();
    process.exit(0);
  };
  process.on('SIGTERM', encerrar);
  process.on('SIGINT', encerrar);
}

main().catch((err) => {
  console.error('falha ao subir os workers', err);
  process.exitCode = 1;
});

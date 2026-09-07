import { Worker } from 'bullmq';
import { QUEUES } from '@jolo/shared';
import { moveStage } from '@jolo/crm-core';
import type { WorkerContext } from './context.js';
import { QueueBridge } from './bridge.js';

/**
 * Automacoes de acompanhamento (item 35). Sao regras, nao mensagens automaticas:
 * o worker cria tarefa e alerta, quem fala com o lead e uma pessoa.
 */
export function startFollowupWorker(ctx: WorkerContext): Worker {
  const { prisma, logger } = ctx;

  return new Worker(
    QUEUES.FOLLOWUPS,
    async () => {
      const agora = Date.now();
      const org = await prisma.organization.findFirstOrThrow({ orderBy: { createdAt: 'asc' } });

      // 1. Lead sem resposta ha mais de 24 horas.
      const semResposta = await prisma.lead.findMany({
        where: {
          organizationId: org.id,
          status: 'ABERTO',
          lastContactAt: { lt: new Date(agora - 24 * 3_600_000) },
          stage: { key: { in: ['NOVO_LEAD', 'IA_QUALIFICANDO', 'QUALIFICADO'] } },
        },
        take: 100,
      });
      for (const lead of semResposta) {
        const jaTem = await prisma.task.findFirst({
          where: { leadId: lead.id, status: 'ABERTA', title: { startsWith: 'Retomar contato' } },
        });
        if (jaTem) continue;
        await prisma.task.create({
          data: {
            organizationId: org.id,
            leadId: lead.id,
            ownerId: lead.ownerId,
            title: 'Retomar contato: 24h sem resposta',
            dueAt: new Date(agora + 3_600_000),
          },
        });
      }

      // 2. Lead parado ha 3 dias: avisa o responsavel.
      const parados = await prisma.lead.findMany({
        where: {
          organizationId: org.id,
          status: 'ABERTO',
          updatedAt: { lt: new Date(agora - 3 * 86_400_000) },
        },
        take: 100,
      });
      for (const lead of parados) {
        await QueueBridge.notify(ctx, { tipo: 'lead_parado', leadId: lead.id, dias: 3 });
      }

      // 3. Reuniao amanha: lembrete.
      const amanha = new Date(agora + 86_400_000);
      const reunioes = await prisma.meeting.findMany({
        where: {
          organizationId: org.id,
          status: 'AGENDADA',
          scheduledAt: { gte: new Date(agora), lte: amanha },
        },
      });
      for (const r of reunioes) {
        await QueueBridge.notify(ctx, { tipo: 'reuniao_amanha', meetingId: r.id, quando: r.scheduledAt });
      }

      // 4. COF perto do prazo: alerta a expansao.
      const cofs = await prisma.cofProcess.findMany({
        where: { organizationId: org.id, status: { in: ['ENVIADA', 'EM_PRAZO'] }, sentAt: { not: null } },
      });
      for (const cof of cofs) {
        const limite = new Date(cof.sentAt!.getTime() + cof.waitingDays * 86_400_000);
        if (limite.getTime() - agora < 2 * 86_400_000) {
          await QueueBridge.notify(ctx, { tipo: 'cof_prazo', cofId: cof.id, limite });
        }
      }

      // 5. Lead sem resposta ha 7 dias sai do funil ativo, sem sumir do historico.
      const abandonados = await prisma.lead.findMany({
        where: {
          organizationId: org.id,
          status: 'ABERTO',
          lastContactAt: { lt: new Date(agora - 7 * 86_400_000) },
          stage: { key: { in: ['NOVO_LEAD', 'IA_QUALIFICANDO'] } },
        },
        take: 50,
      });
      for (const lead of abandonados) {
        await moveStage(prisma, {
          leadId: lead.id,
          toStageKey: 'SEM_RESPOSTA',
          source: 'AUTOMATION',
          reason: '7 dias sem resposta',
        });
      }

      logger.info(
        {
          semResposta: semResposta.length,
          parados: parados.length,
          reunioes: reunioes.length,
          abandonados: abandonados.length,
        },
        'rotina de follow-up executada',
      );
    },
    { connection: ctx.redis, concurrency: 1 },
  );
}

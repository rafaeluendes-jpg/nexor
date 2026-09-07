import { Worker } from 'bullmq';
import { AUDIT_EVENTS, QUEUES, type InboundJob } from '@jolo/shared';
import {
  CHAVES_DE_CONFIGURACAO,
  ensureConversation,
  ensureLead,
  escolherResponsavel,
  lerConfiguracao,
  moveStage,
  upsertContact,
  writeActivity,
  writeAudit,
  type Roteamento,
} from '@jolo/crm-core';
import { parseMetaWebhook } from '@jolo/whatsapp';
import { TIPOS_DE_AVISO } from '@jolo/shared';
import { publicarAviso } from './avisos.js';
import type { WorkerContext } from './context.js';

const TRACKING_RE = /\[ref:\s*(jl_[a-z0-9]+)\s*\]/i;

/**
 * Trata o evento cru do webhook: cria contato, lead, conversa e mensagem,
 * liga a atribuicao e chama a IA. Idempotente por wamid.
 */
export function startInboundWorker(ctx: WorkerContext): Worker {
  const { prisma, logger } = ctx;

  return new Worker<InboundJob>(
    QUEUES.WHATSAPP_INBOUND,
    async (job) => {
      const evento = await prisma.webhookEvent.findUnique({ where: { id: job.data.webhookEventId } });
      if (!evento || evento.processedAt) return;

      await prisma.webhookEvent.update({
        where: { id: evento.id },
        data: { status: 'processing', attempts: { increment: 1 } },
      });

      const org = await prisma.organization.findFirstOrThrow({ orderBy: { createdAt: 'asc' } });
      const normalizado = parseMetaWebhook(evento.payload);

      // ---------- mensagens recebidas ----------
      for (const msg of normalizado.messages) {
        const jaExiste = await prisma.message.findUnique({ where: { wamid: msg.wamid } });
        if (jaExiste) {
          logger.info({ wamid: msg.wamid }, 'mensagem duplicada ignorada');
          continue;
        }

        const { contact } = await upsertContact(prisma, {
          organizationId: org.id,
          phone: msg.from,
          whatsappId: msg.waId,
          name: msg.profileName,
        });

        // Atribuicao: primeiro pelo click-to-WhatsApp, depois pela marca no texto.
        let attributionId: string | null = null;
        if (msg.referral?.ctwa_clid) {
          const porClid = await prisma.attributionSession.findFirst({
            where: { ctwaClid: msg.referral.ctwa_clid },
          });
          attributionId = porClid?.id ?? null;
        }
        if (!attributionId && msg.text) {
          const marca = TRACKING_RE.exec(msg.text);
          if (marca?.[1]) {
            const sessao = await prisma.attributionSession.findUnique({ where: { trackingId: marca[1] } });
            attributionId = sessao?.id ?? null;
          }
        }

        const { lead, created } = await ensureLead(prisma, {
          organizationId: org.id,
          contactId: contact.id,
          attributionId,
          correlationId: job.data.correlationId,
        });
        const { conversation } = await ensureConversation(prisma, {
          organizationId: org.id,
          contactId: contact.id,
          leadId: lead.id,
        });

        // Anuncio de origem (click-to-WhatsApp) guardado por inteiro.
        if (msg.referral && !(await prisma.whatsappReferral.findUnique({ where: { conversationId: conversation.id } }))) {
          await prisma.whatsappReferral.create({
            data: {
              conversationId: conversation.id,
              sourceId: msg.referral.source_id,
              sourceUrl: msg.referral.source_url,
              sourceType: msg.referral.source_type,
              headline: msg.referral.headline,
              body: msg.referral.body,
              mediaType: msg.referral.media_type,
              imageUrl: msg.referral.image_url,
              videoUrl: msg.referral.video_url,
              thumbnailUrl: msg.referral.thumbnail_url,
              ctwaClid: msg.referral.ctwa_clid,
              raw: msg.referral as object,
            },
          });
          if (msg.referral.ctwa_clid && attributionId) {
            await prisma.attributionSession.update({
              where: { id: attributionId },
              data: { ctwaClid: msg.referral.ctwa_clid },
            });
          }
        }

        await prisma.message.create({
          data: {
            organizationId: org.id,
            conversationId: conversation.id,
            direction: 'INBOUND',
            author: 'CONTACT',
            wamid: msg.wamid,
            type: msg.type,
            body: msg.text,
            payload: msg.raw as object,
            status: 'DELIVERED',
            deliveredAt: msg.timestamp,
          },
        });

        await prisma.conversation.update({
          where: { id: conversation.id },
          data: { lastMessageAt: msg.timestamp, unreadCount: { increment: 1 } },
        });
        await prisma.lead.update({
          where: { id: lead.id },
          data: { lastContactAt: msg.timestamp },
        });

        await writeAudit(prisma, {
          organizationId: org.id,
          event: AUDIT_EVENTS.MESSAGE_RECEIVED,
          entity: 'message',
          entityId: msg.wamid,
          actorType: 'WEBHOOK',
          after: { conversationId: conversation.id, tipo: msg.type },
          correlationId: job.data.correlationId,
        });
        await writeActivity(prisma, {
          organizationId: org.id,
          leadId: lead.id,
          type: 'message_received',
          title: 'Mensagem recebida no WhatsApp',
          description: msg.text?.slice(0, 200),
          occurredAt: msg.timestamp,
        });

        // Lead novo ganha dono pela regra configurada (item 53).
        // Sem regra, fica sem dono e aparece na fila geral: lead sem dono nunca some.
        if (created && !lead.ownerId) {
          const regra = await lerConfiguracao<Roteamento>(
            prisma,
            org.id,
            CHAVES_DE_CONFIGURACAO.ROTEAMENTO,
          );
          const sequencia = await prisma.lead.count({ where: { organizationId: org.id } });
          const responsavelId = escolherResponsavel(regra, {
            cidade: lead.desiredCity ?? contact.city,
            estado: lead.desiredState ?? contact.state,
            campanha: attributionId
              ? (await prisma.attributionSession.findUnique({ where: { id: attributionId } }))?.firstTouchCampaign
              : null,
            sequencia,
          });
          if (responsavelId) {
            // so atribui a quem existe e esta ativo: regra velha nao pode mandar lead para conta desligada
            const dono = await prisma.user.findFirst({
              where: { id: responsavelId, organizationId: org.id, status: 'ACTIVE' },
            });
            if (dono) {
              await prisma.lead.update({ where: { id: lead.id }, data: { ownerId: dono.id } });
              await writeActivity(prisma, {
                organizationId: org.id,
                leadId: lead.id,
                type: 'roteamento',
                title: `Lead direcionado para ${dono.name}`,
                description: `Regra: ${regra.modo}`,
              });
            }
          }
        }

        // Primeira mensagem: o lead entra na etapa de qualificacao pela IA.
        if (created) {
          await moveStage(prisma, {
            leadId: lead.id,
            toStageKey: 'IA_QUALIFICANDO',
            source: 'AUTOMATION',
            reason: 'Primeira mensagem recebida',
            correlationId: job.data.correlationId,
          });
        }

        // As telas abertas atualizam sozinhas: sem F5.
        await publicarAviso(ctx.redis, {
          tipo: TIPOS_DE_AVISO.MENSAGEM_NOVA,
          organizationId: org.id,
          conversaId: conversation.id,
          leadId: lead.id,
          dados: { de: contact.name ?? 'sem nome' },
        });
        if (created) {
          await publicarAviso(ctx.redis, {
            tipo: TIPOS_DE_AVISO.LEAD_NOVO,
            organizationId: org.id,
            leadId: lead.id,
            conversaId: conversation.id,
          });
        }

        const { QueueBridge } = await import('./bridge.js');
        await QueueBridge.aiTurn(ctx, conversation.id, job.data.correlationId);
        await QueueBridge.excelSync(ctx, org.id, 'lead_atualizado');
      }

      // ---------- confirmacoes de entrega ----------
      for (const st of normalizado.statuses) {
        const mensagem = await prisma.message.findUnique({ where: { wamid: st.wamid } });
        if (!mensagem) continue;

        const mapa = { sent: 'SENT', delivered: 'DELIVERED', read: 'READ', failed: 'FAILED' } as const;
        const novo = mapa[st.status];

        await prisma.messageStatusEvent.upsert({
          where: { messageId_status: { messageId: mensagem.id, status: novo } },
          create: { messageId: mensagem.id, status: novo, occurredAt: st.timestamp, raw: st.raw as object },
          update: {},
        });

        const ordem = ['QUEUED', 'SENT', 'DELIVERED', 'READ'];
        const avancou = novo === 'FAILED' || ordem.indexOf(novo) > ordem.indexOf(mensagem.status);
        if (avancou) {
          await publicarAviso(ctx.redis, {
            tipo: TIPOS_DE_AVISO.MENSAGEM_STATUS,
            organizationId: mensagem.organizationId,
            conversaId: mensagem.conversationId,
            alvoId: mensagem.id,
            dados: { status: novo },
          });
          await prisma.message.update({
            where: { id: mensagem.id },
            data: {
              status: novo,
              sentAt: novo === 'SENT' ? st.timestamp : mensagem.sentAt,
              deliveredAt: novo === 'DELIVERED' ? st.timestamp : mensagem.deliveredAt,
              readAt: novo === 'READ' ? st.timestamp : mensagem.readAt,
              failedAt: novo === 'FAILED' ? st.timestamp : mensagem.failedAt,
              errorCode: st.errorCode,
              errorMessage: st.errorMessage,
            },
          });
        }
      }

      await prisma.webhookEvent.update({
        where: { id: evento.id },
        data: { status: 'processed', processedAt: new Date() },
      });
    },
    { connection: ctx.redis, concurrency: 4 },
  );
}

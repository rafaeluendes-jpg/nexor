import { Injectable } from '@nestjs/common';
import { releaseToAi, takeOver } from '@jolo/crm-core';
import { DomainError, NotFoundError } from '@jolo/shared';
import { formatPhoneBR } from '@jolo/shared';
import { PrismaService } from '../../common/prisma.service.js';
import { QueueService } from '../queue/queue.service.js';
import type { AuthenticatedUser } from '../../common/decorators/index.js';

@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
  ) {}

  /** Coluna esquerda do inbox: lista de conversas com previa da ultima mensagem. */
  async list(user: AuthenticatedUser, params: { search?: string; take?: number }) {
    const conversas = await this.prisma.client.conversation.findMany({
      where: {
        organizationId: user.organizationId,
        ...(params.search
          ? {
              OR: [
                { contact: { name: { contains: params.search, mode: 'insensitive' } } },
                { contact: { phoneE164: { contains: params.search.replace(/\D+/g, '') } } },
              ],
            }
          : {}),
      },
      include: {
        contact: true,
        owner: { select: { id: true, name: true } },
        lead: { include: { stage: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { lastMessageAt: 'desc' },
      take: Math.min(params.take ?? 50, 100),
    });

    return conversas.map((c) => ({
      id: c.id,
      mode: c.mode,
      owner: c.owner,
      unreadCount: c.unreadCount,
      lastMessageAt: c.lastMessageAt,
      contact: {
        id: c.contact.id,
        name: c.contact.name ?? 'Sem nome',
        phone: formatPhoneBR(c.contact.phoneE164),
        city: c.contact.city,
      },
      lead: c.lead ? { id: c.lead.id, stage: c.lead.stage.name, score: c.lead.score, temperature: c.lead.temperature } : null,
      preview: c.messages[0]?.body?.slice(0, 120) ?? null,
    }));
  }

  /** Centro do inbox: a conversa. Direita: o perfil do lead. */
  async detail(user: AuthenticatedUser, conversationId: string) {
    const c = await this.prisma.client.conversation.findFirst({
      where: { id: conversationId, organizationId: user.organizationId },
      include: {
        contact: true,
        owner: { select: { id: true, name: true } },
        referral: true,
        lead: {
          include: {
            stage: true,
            owner: { select: { id: true, name: true } },
            attribution: true,
            answers: { include: { question: true } },
          },
        },
        messages: { orderBy: { createdAt: 'asc' }, take: 200, include: { statusEvents: true } },
      },
    });
    if (!c) throw new NotFoundError('Conversa nao encontrada.');

    return {
      id: c.id,
      mode: c.mode,
      owner: c.owner,
      humanTakeoverAt: c.humanTakeoverAt,
      contact: {
        id: c.contact.id,
        name: c.contact.name,
        phone: formatPhoneBR(c.contact.phoneE164),
        whatsappId: c.contact.whatsappId,
        city: c.contact.city,
        state: c.contact.state,
      },
      lead: c.lead
        ? {
            id: c.lead.id,
            stage: { key: c.lead.stage.key, name: c.lead.stage.name },
            score: c.lead.score,
            temperature: c.lead.temperature,
            desiredCity: c.lead.desiredCity,
            desiredState: c.lead.desiredState,
            capitalRange: c.lead.capitalRange,
            investmentHorizon: c.lead.investmentHorizon,
            businessExperience: c.lead.businessExperience,
            hasPartner: c.lead.hasPartner,
            availability: c.lead.availability,
            owner: c.lead.owner,
            createdAt: c.lead.createdAt,
            lastContactAt: c.lead.lastContactAt,
            nextActionAt: c.lead.nextActionAt,
            origem: c.lead.attribution
              ? {
                  source: c.lead.attribution.firstTouchSource,
                  medium: c.lead.attribution.firstTouchMedium,
                  campaign: c.lead.attribution.firstTouchCampaign,
                  content: c.lead.attribution.firstTouchContent,
                }
              : null,
            respostas: c.lead.answers.map((a) => ({ pergunta: a.question.label, valor: a.value })),
          }
        : null,
      anuncio: c.referral
        ? {
            headline: c.referral.headline,
            body: c.referral.body,
            sourceType: c.referral.sourceType,
            sourceUrl: c.referral.sourceUrl,
            ctwaClid: c.referral.ctwaClid,
          }
        : null,
      messages: c.messages.map((m) => ({
        id: m.id,
        direction: m.direction,
        author: m.author,
        body: m.body,
        status: m.status,
        createdAt: m.createdAt,
        sentAt: m.sentAt,
        deliveredAt: m.deliveredAt,
        readAt: m.readAt,
        errorMessage: m.errorMessage,
      })),
    };
  }

  /** Resposta humana: grava e enfileira o envio pela Cloud API. */
  async reply(user: AuthenticatedUser, conversationId: string, body: string) {
    const conversa = await this.prisma.client.conversation.findFirst({
      where: { id: conversationId, organizationId: user.organizationId },
    });
    if (!conversa) throw new NotFoundError('Conversa nao encontrada.');
    if (conversa.ownerId && conversa.ownerId !== user.id) {
      throw new DomainError('Outro atendente esta com esta conversa.', 'CONVERSATION_LOCKED', 409);
    }

    const mensagem = await this.prisma.client.message.create({
      data: {
        organizationId: user.organizationId,
        conversationId,
        direction: 'OUTBOUND',
        author: 'HUMAN',
        senderUserId: user.id,
        type: 'text',
        body,
        status: 'QUEUED',
      },
    });
    await this.queue.outboundMessage(mensagem.id, `crm:${user.id}`);
    return { id: mensagem.id, status: mensagem.status };
  }

  takeOver(user: AuthenticatedUser, conversationId: string, reason?: string) {
    return takeOver(this.prisma.client, { conversationId, userId: user.id, reason });
  }

  release(user: AuthenticatedUser, conversationId: string, reason?: string) {
    return releaseToAi(this.prisma.client, { conversationId, userId: user.id, reason });
  }
}

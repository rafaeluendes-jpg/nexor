import type { Conversation, PrismaClient } from '@jolo/database';
import { AUDIT_EVENTS } from '@jolo/shared';
import { writeActivity, writeAudit } from './audit';

export async function ensureConversation(
  prisma: PrismaClient,
  params: { organizationId: string; contactId: string; leadId?: string | null },
): Promise<{ conversation: Conversation; created: boolean }> {
  const existente = await prisma.conversation.findFirst({
    where: { organizationId: params.organizationId, contactId: params.contactId, channel: 'WHATSAPP' },
    orderBy: { createdAt: 'desc' },
  });
  if (existente) {
    if (!existente.leadId && params.leadId) {
      const atualizada = await prisma.conversation.update({
        where: { id: existente.id },
        data: { leadId: params.leadId },
      });
      return { conversation: atualizada, created: false };
    }
    return { conversation: existente, created: false };
  }
  const conversation = await prisma.conversation.create({
    data: {
      organizationId: params.organizationId,
      contactId: params.contactId,
      leadId: params.leadId ?? null,
    },
  });
  return { conversation, created: true };
}

/**
 * Humano assume a conversa (item 26): a IA para na hora e a posse fica travada.
 * Enquanto houver dono humano, nenhum job de IA responde nessa conversa.
 */
export async function takeOver(
  prisma: PrismaClient,
  params: { conversationId: string; userId: string; reason?: string },
): Promise<Conversation> {
  const conversa = await prisma.conversation.findUniqueOrThrow({ where: { id: params.conversationId } });
  if (conversa.ownerId && conversa.ownerId !== params.userId) {
    throw new Error('Conversa ja assumida por outro atendente.');
  }

  const atualizada = await prisma.conversation.update({
    where: { id: params.conversationId },
    data: { mode: 'HUMAN', ownerId: params.userId, humanTakeoverAt: new Date(), aiPausedUntil: null },
  });

  await prisma.aiSession.updateMany({
    where: { conversationId: params.conversationId, status: 'ATIVA' },
    data: { status: 'PAUSADA' },
  });
  await prisma.aiHandoff.create({
    data: {
      conversationId: params.conversationId,
      toUserId: params.userId,
      direction: 'AI_TO_HUMAN',
      reason: params.reason ?? 'Atendente assumiu a conversa',
    },
  });
  await writeAudit(prisma, {
    organizationId: conversa.organizationId,
    event: AUDIT_EVENTS.HUMAN_TAKEOVER,
    entity: 'conversation',
    entityId: conversa.id,
    actorUserId: params.userId,
    actorType: 'USER',
    after: { mode: 'HUMAN', reason: params.reason },
  });
  await writeActivity(prisma, {
    organizationId: conversa.organizationId,
    leadId: conversa.leadId,
    userId: params.userId,
    type: 'human_takeover',
    title: 'Atendente assumiu a conversa',
    description: params.reason,
  });
  return atualizada;
}

/** Devolve a conversa para a IA, quando autorizado. */
export async function releaseToAi(
  prisma: PrismaClient,
  params: { conversationId: string; userId: string; reason?: string },
): Promise<Conversation> {
  const conversa = await prisma.conversation.findUniqueOrThrow({ where: { id: params.conversationId } });
  const atualizada = await prisma.conversation.update({
    where: { id: params.conversationId },
    data: { mode: 'AI', ownerId: null, humanTakeoverAt: null },
  });
  await prisma.aiHandoff.create({
    data: {
      conversationId: params.conversationId,
      toUserId: params.userId,
      direction: 'HUMAN_TO_AI',
      reason: params.reason ?? 'Devolvida para a IA',
    },
  });
  await writeAudit(prisma, {
    organizationId: conversa.organizationId,
    event: AUDIT_EVENTS.HUMAN_RELEASED,
    entity: 'conversation',
    entityId: conversa.id,
    actorUserId: params.userId,
    actorType: 'USER',
    after: { mode: 'AI' },
  });
  return atualizada;
}

/** A IA so pode responder se ninguem assumiu e se nao estiver pausada. */
export function aiMayAnswer(conversation: Conversation): boolean {
  if (conversation.mode !== 'AI') return false;
  if (conversation.ownerId) return false;
  if (conversation.aiPausedUntil && conversation.aiPausedUntil > new Date()) return false;
  return true;
}

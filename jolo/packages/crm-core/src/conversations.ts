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

/**
 * Alguem da empresa respondeu pelo WhatsApp Business do celular
 * (coexistencia). E o mesmo efeito do "assumir" do CRM: a IA para na hora
 * naquela conversa. So nao ha usuario do CRM por tras - quem respondeu foi
 * o celular da empresa -, entao o dono da conversa continua o mesmo.
 */
export async function assumidaPeloCelular(
  prisma: PrismaClient,
  params: { conversationId: string; correlationId?: string },
): Promise<Conversation> {
  const conversa = await prisma.conversation.findUniqueOrThrow({ where: { id: params.conversationId } });
  if (conversa.mode === 'HUMAN') return conversa; // ja estava com gente

  const atualizada = await prisma.conversation.update({
    where: { id: params.conversationId },
    data: { mode: 'HUMAN', humanTakeoverAt: new Date(), aiPausedUntil: null },
  });
  await prisma.aiSession.updateMany({
    where: { conversationId: params.conversationId, status: 'ATIVA' },
    data: { status: 'PAUSADA' },
  });
  await prisma.aiHandoff.create({
    data: {
      conversationId: params.conversationId,
      toUserId: conversa.ownerId,
      direction: 'AI_TO_HUMAN',
      reason: 'Respondido pelo WhatsApp do celular',
    },
  });
  await writeAudit(prisma, {
    organizationId: conversa.organizationId,
    event: AUDIT_EVENTS.HUMAN_TAKEOVER,
    entity: 'conversation',
    entityId: conversa.id,
    actorType: 'WEBHOOK',
    after: { mode: 'HUMAN', origem: 'celular' },
    correlationId: params.correlationId,
  });
  await writeActivity(prisma, {
    organizationId: conversa.organizationId,
    leadId: conversa.leadId,
    type: 'human_takeover',
    title: 'Respondido pelo celular: a IA parou nesta conversa',
  });
  return atualizada;
}

/**
 * LGPD: a pessoa pediu para nao receber mais mensagens. O contato fica
 * marcado para sempre (robo e acompanhamento automatico nunca mais falam
 * com ele) e a conversa sai do robo. Se ela voltar a escrever, uma pessoa
 * pode responder - quem decide voltar a conversar e ela.
 */
export async function registrarPedidoParaParar(
  prisma: PrismaClient,
  params: { conversationId: string; motivo: string; correlationId?: string },
): Promise<{ jaEstavaMarcado: boolean }> {
  const conversa = await prisma.conversation.findUniqueOrThrow({
    where: { id: params.conversationId },
    include: { contact: true },
  });
  const jaEstavaMarcado = Boolean(conversa.contact.optOutAt);
  if (!jaEstavaMarcado) {
    await prisma.contact.update({
      where: { id: conversa.contactId },
      data: { optOutAt: new Date(), optOutReason: params.motivo.slice(0, 200) },
    });
  }
  if (conversa.mode === 'AI') {
    await prisma.conversation.update({
      where: { id: conversa.id },
      data: { mode: 'HUMAN', humanTakeoverAt: new Date(), aiPausedUntil: null },
    });
    await prisma.aiSession.updateMany({
      where: { conversationId: conversa.id, status: 'ATIVA' },
      data: { status: 'PAUSADA' },
    });
  }
  await writeAudit(prisma, {
    organizationId: conversa.organizationId,
    event: AUDIT_EVENTS.LEAD_UPDATED,
    entity: 'contact',
    entityId: conversa.contactId,
    actorType: 'WEBHOOK',
    after: { optOut: true, motivo: params.motivo.slice(0, 200) },
    correlationId: params.correlationId,
  });
  await writeActivity(prisma, {
    organizationId: conversa.organizationId,
    leadId: conversa.leadId,
    type: 'opt_out',
    title: 'Pediu para não receber mais mensagens',
    description: params.motivo.slice(0, 200),
  });
  return { jaEstavaMarcado };
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

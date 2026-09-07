import type { Lead, PrismaClient, StageChangeSource } from '@jolo/database';
import { AUDIT_EVENTS, type StageKey } from '@jolo/shared';
import { writeActivity, writeAudit } from './audit';
import { computeScore, type ScoreInput } from './scoring';

export async function defaultPipeline(prisma: PrismaClient, organizationId: string) {
  const pipeline = await prisma.pipeline.findFirst({
    where: { organizationId, isDefault: true },
    include: { stages: { orderBy: { position: 'asc' } } },
  });
  if (!pipeline) throw new Error('Pipeline padrao nao encontrado. Rode o seed do banco.');
  return pipeline;
}

export async function stageByKey(prisma: PrismaClient, pipelineId: string, key: StageKey) {
  const stage = await prisma.pipelineStage.findFirst({ where: { pipelineId, key } });
  if (!stage) throw new Error(`Etapa ${key} nao existe no pipeline.`);
  return stage;
}

/** Garante um lead aberto para o contato, sem criar duplicado a cada mensagem. */
export async function ensureLead(
  prisma: PrismaClient,
  params: {
    organizationId: string;
    contactId: string;
    attributionId?: string | null;
    correlationId?: string;
  },
): Promise<{ lead: Lead; created: boolean }> {
  const aberto = await prisma.lead.findFirst({
    where: { organizationId: params.organizationId, contactId: params.contactId, status: 'ABERTO' },
    orderBy: { createdAt: 'desc' },
  });
  if (aberto) {
    if (!aberto.attributionId && params.attributionId) {
      const atualizado = await prisma.lead.update({
        where: { id: aberto.id },
        data: { attributionId: params.attributionId },
      });
      return { lead: atualizado, created: false };
    }
    return { lead: aberto, created: false };
  }

  const pipeline = await defaultPipeline(prisma, params.organizationId);
  const primeira = pipeline.stages[0];
  if (!primeira) throw new Error('Pipeline padrao sem etapas.');

  const lead = await prisma.lead.create({
    data: {
      organizationId: params.organizationId,
      contactId: params.contactId,
      pipelineId: pipeline.id,
      stageId: primeira.id,
      attributionId: params.attributionId ?? null,
      firstContactAt: new Date(),
      lastContactAt: new Date(),
    },
  });

  await prisma.pipelineStageHistory.create({
    data: { leadId: lead.id, toStageId: primeira.id, source: 'API', reason: 'Primeiro contato' },
  });
  await writeAudit(prisma, {
    organizationId: params.organizationId,
    event: AUDIT_EVENTS.LEAD_CREATED,
    entity: 'lead',
    entityId: lead.id,
    actorType: 'SYSTEM',
    after: { contactId: params.contactId },
    correlationId: params.correlationId,
  });
  await writeActivity(prisma, {
    organizationId: params.organizationId,
    leadId: lead.id,
    type: 'lead_created',
    title: 'Lead criado',
    description: 'Entrou pelo WhatsApp a partir da pagina de franquias.',
  });

  return { lead, created: true };
}

/** Move de etapa registrando historico e auditoria. Nada muda em silencio (item 20). */
export async function moveStage(
  prisma: PrismaClient,
  params: {
    leadId: string;
    toStageKey: StageKey;
    source: StageChangeSource;
    userId?: string | null;
    reason?: string;
    correlationId?: string;
  },
): Promise<Lead> {
  const lead = await prisma.lead.findUniqueOrThrow({ where: { id: params.leadId } });
  const destino = await stageByKey(prisma, lead.pipelineId, params.toStageKey);
  if (destino.id === lead.stageId) return lead;

  const anterior = await prisma.pipelineStage.findUnique({ where: { id: lead.stageId } });

  const atualizado = await prisma.lead.update({
    where: { id: lead.id },
    data: {
      stageId: destino.id,
      status: destino.isWon ? 'GANHO' : destino.isLost ? 'PERDIDO' : lead.status,
      wonAt: destino.isWon ? new Date() : lead.wonAt,
      lostAt: destino.isLost ? new Date() : lead.lostAt,
      lostReason: destino.isLost ? (params.reason ?? lead.lostReason) : lead.lostReason,
    },
  });

  await prisma.pipelineStageHistory.create({
    data: {
      leadId: lead.id,
      fromStageId: lead.stageId,
      toStageId: destino.id,
      changedById: params.userId ?? null,
      source: params.source,
      reason: params.reason,
    },
  });
  await writeAudit(prisma, {
    organizationId: lead.organizationId,
    event: destino.isWon
      ? AUDIT_EVENTS.LEAD_WON
      : destino.isLost
        ? AUDIT_EVENTS.LEAD_LOST
        : AUDIT_EVENTS.STAGE_CHANGED,
    entity: 'lead',
    entityId: lead.id,
    actorUserId: params.userId ?? null,
    actorType: params.source === 'AI' ? 'AI' : params.userId ? 'USER' : 'SYSTEM',
    before: { stage: anterior?.key },
    after: { stage: destino.key, reason: params.reason },
    correlationId: params.correlationId,
  });
  await writeActivity(prisma, {
    organizationId: lead.organizationId,
    leadId: lead.id,
    userId: params.userId ?? null,
    type: 'stage_changed',
    title: `Etapa: ${anterior?.name ?? '—'} → ${destino.name}`,
    description: params.reason,
  });

  return atualizado;
}

/** Recalcula e grava o score do lead, guardando o historico do calculo. */
export async function refreshScore(prisma: PrismaClient, leadId: string): Promise<{ total: number }> {
  const lead = await prisma.lead.findUniqueOrThrow({
    where: { id: leadId },
    include: { conversations: { include: { _count: { select: { messages: true } } } } },
  });

  const inbound = await prisma.message.count({
    where: { conversation: { leadId }, direction: 'INBOUND' },
  });

  const input: ScoreInput = {
    capitalAvailable: lead.capitalAvailable ? Number(lead.capitalAvailable) : null,
    capitalRange: lead.capitalRange,
    investmentHorizon: lead.investmentHorizon,
    desiredCity: lead.desiredCity,
    businessExperience: lead.businessExperience,
    availability: lead.availability,
    inboundMessages: inbound,
  };

  if (lead.desiredCity) {
    const territorio = await prisma.territory.findFirst({
      where: { organizationId: lead.organizationId, city: { equals: lead.desiredCity, mode: 'insensitive' } },
    });
    input.cityAvailable = territorio ? territorio.status === 'DISPONIVEL' : true;
  }

  const resultado = computeScore(input);
  await prisma.lead.update({
    where: { id: leadId },
    data: { score: resultado.total, temperature: resultado.temperature },
  });
  await prisma.leadScore.create({
    data: { leadId, total: resultado.total, breakdown: resultado.breakdown },
  });
  return { total: resultado.total };
}

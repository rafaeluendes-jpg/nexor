import type { PrismaClient } from '@jolo/database';
import { redact } from '@jolo/security';

export interface AuditInput {
  organizationId: string;
  event: string;
  entity: string;
  entityId?: string | null;
  actorUserId?: string | null;
  actorType?: 'USER' | 'AI' | 'SYSTEM' | 'WEBHOOK';
  before?: unknown;
  after?: unknown;
  ip?: string | null;
  requestId?: string | null;
  correlationId?: string | null;
}

/** Toda acao relevante vira registro imutavel de auditoria (item 43). */
export async function writeAudit(prisma: PrismaClient, input: AuditInput): Promise<void> {
  await prisma.auditLog.create({
    data: {
      organizationId: input.organizationId,
      event: input.event,
      entity: input.entity,
      entityId: input.entityId ?? null,
      actorUserId: input.actorUserId ?? null,
      actorType: input.actorType ?? 'SYSTEM',
      before: input.before ? (redact(input.before) as object) : undefined,
      after: input.after ? (redact(input.after) as object) : undefined,
      ip: input.ip ?? null,
      requestId: input.requestId ?? null,
      correlationId: input.correlationId ?? null,
    },
  });
}

export async function writeActivity(
  prisma: PrismaClient,
  input: {
    organizationId: string;
    leadId?: string | null;
    userId?: string | null;
    type: string;
    title: string;
    description?: string;
    metadata?: unknown;
    occurredAt?: Date;
  },
): Promise<void> {
  await prisma.activity.create({
    data: {
      organizationId: input.organizationId,
      leadId: input.leadId ?? null,
      userId: input.userId ?? null,
      type: input.type,
      title: input.title,
      description: input.description,
      metadata: input.metadata ? (input.metadata as object) : undefined,
      occurredAt: input.occurredAt ?? new Date(),
    },
  });
}

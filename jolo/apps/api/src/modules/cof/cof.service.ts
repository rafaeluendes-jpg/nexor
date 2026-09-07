import { Injectable } from '@nestjs/common';
import { DomainError, NotFoundError } from '@jolo/shared';
import { moveStage, writeActivity, writeAudit } from '@jolo/crm-core';
import { PrismaService } from '../../common/prisma.service.js';
import type { AuthenticatedUser } from '../../common/decorators/index.js';

/** Prazo legal entre a entrega da COF e a assinatura do contrato (Lei de Franquias). */
export const PRAZO_LEGAL_DIAS = 10;

function diasEntre(de: Date, ate: Date): number {
  return Math.floor((ate.getTime() - de.getTime()) / 86_400_000);
}

@Injectable()
export class CofService {
  constructor(private readonly prisma: PrismaService) {}

  /** Calcula prazo e alerta a partir das datas gravadas. Nada disso fica congelado no banco. */
  private situacao(cof: {
    status: string;
    receivedAt: Date | null;
    waitingDays: number;
    contractReleaseAt: Date | null;
  }) {
    if (!cof.receivedAt) {
      return { prazoTermina: null, diasRestantes: null, contratoLiberado: false, alerta: null as string | null };
    }
    const termina = new Date(cof.receivedAt.getTime() + cof.waitingDays * 86_400_000);
    const restantes = diasEntre(new Date(), termina);
    const liberado = restantes < 0 || Boolean(cof.contractReleaseAt);
    let alerta: string | null = null;
    if (!liberado && restantes <= 2) alerta = `Faltam ${Math.max(restantes, 0)} dia(s) para o prazo terminar.`;
    if (liberado && !cof.contractReleaseAt) alerta = 'Prazo cumprido: o contrato ja pode ser liberado.';
    return { prazoTermina: termina, diasRestantes: restantes, contratoLiberado: liberado, alerta };
  }

  async list(user: AuthenticatedUser, status?: string) {
    const processos = await this.prisma.client.cofProcess.findMany({
      where: { organizationId: user.organizationId, ...(status ? { status: status as never } : {}) },
      include: {
        lead: { select: { id: true, desiredCity: true, contact: { select: { name: true } } } },
        documents: { select: { id: true, fileName: true, createdAt: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    return {
      itens: processos.map((c) => ({
        id: c.id,
        status: c.status,
        enviadaEm: c.sentAt,
        recebidaEm: c.receivedAt,
        prazoDias: c.waitingDays,
        versao: c.documentVersion,
        observacoes: c.notes,
        lead: { id: c.lead.id, nome: c.lead.contact?.name ?? 'sem nome', cidade: c.lead.desiredCity },
        documentos: c.documents.map((d) => ({ id: d.id, nome: d.fileName, em: d.createdAt })),
        ...this.situacao(c),
      })),
    };
  }

  async abrir(user: AuthenticatedUser, dados: { leadId: string; versao?: string; prazoDias?: number }) {
    const lead = await this.prisma.client.lead.findFirst({
      where: { id: dados.leadId, organizationId: user.organizationId },
    });
    if (!lead) throw new NotFoundError('Lead nao encontrado.');

    const existente = await this.prisma.client.cofProcess.findFirst({
      where: { leadId: dados.leadId, status: { notIn: ['CANCELADA'] } },
    });
    if (existente) throw new DomainError('Este lead ja tem processo de COF aberto.', 'VALIDATION_ERROR', 422);

    const cof = await this.prisma.client.cofProcess.create({
      data: {
        organizationId: user.organizationId,
        leadId: dados.leadId,
        responsibleId: user.id,
        documentVersion: dados.versao,
        waitingDays: dados.prazoDias ?? PRAZO_LEGAL_DIAS,
      },
    });
    await writeAudit(this.prisma.client, {
      organizationId: user.organizationId,
      actorUserId: user.id,
      actorType: 'USER',
      event: 'cof.open',
      entity: 'CofProcess',
      entityId: cof.id,
      after: { leadId: dados.leadId },
    });
    return cof;
  }

  /** Marca a entrega. E a data de RECEBIMENTO que faz o prazo legal comecar a correr. */
  async registrarEnvio(user: AuthenticatedUser, id: string, quando?: string) {
    const cof = await this.buscar(user, id);
    const atualizado = await this.prisma.client.cofProcess.update({
      where: { id },
      data: { sentAt: quando ? new Date(quando) : new Date(), status: 'ENVIADA' },
    });
    await moveStage(this.prisma.client, {
      leadId: cof.leadId,
      toStageKey: 'COF_ENVIADA',
      userId: user.id,
      source: 'MANUAL',
      reason: 'COF enviada',
    }).catch(() => undefined);
    await this.registrar(user, cof.leadId, id, 'cof.sent', 'COF enviada ao candidato');
    return atualizado;
  }

  async registrarRecebimento(user: AuthenticatedUser, id: string, quando?: string) {
    const cof = await this.buscar(user, id);
    if (!cof.sentAt) throw new DomainError('Registre o envio da COF antes do recebimento.', 'VALIDATION_ERROR', 422);

    const recebida = quando ? new Date(quando) : new Date();
    if (recebida.getTime() < cof.sentAt.getTime()) {
      throw new DomainError('A COF nao pode ser recebida antes de ter sido enviada.', 'VALIDATION_ERROR', 422);
    }

    const atualizado = await this.prisma.client.cofProcess.update({
      where: { id },
      data: { receivedAt: recebida, status: 'EM_PRAZO' },
    });
    await moveStage(this.prisma.client, {
      leadId: cof.leadId,
      toStageKey: 'PRAZO_COF',
      userId: user.id,
      source: 'MANUAL',
      reason: 'COF recebida: prazo legal correndo',
    }).catch(() => undefined);
    await this.registrar(
      user,
      cof.leadId,
      id,
      'cof.received',
      `COF recebida. Prazo de ${cof.waitingDays} dias comecou a correr.`,
    );
    return atualizado;
  }

  /**
   * Libera o contrato. Aqui esta a regra que o item 32 pede:
   * NAO deixa avancar antes do prazo legal terminar.
   */
  async liberarContrato(user: AuthenticatedUser, id: string) {
    const cof = await this.buscar(user, id);
    const s = this.situacao(cof);

    if (!cof.receivedAt) {
      throw new DomainError('Sem data de recebimento da COF nao ha prazo a cumprir.', 'VALIDATION_ERROR', 422);
    }
    if (!s.contratoLiberado) {
      throw new DomainError(
        `O prazo legal de ${cof.waitingDays} dias ainda nao terminou. Faltam ${s.diasRestantes} dia(s).`,
        'COF_PRAZO_NAO_CUMPRIDO',
        422,
      );
    }

    const atualizado = await this.prisma.client.cofProcess.update({
      where: { id },
      data: { status: 'CONTRATO_LIBERADO', contractReleaseAt: new Date() },
    });
    await moveStage(this.prisma.client, {
      leadId: cof.leadId,
      toStageKey: 'CONTRATO',
      userId: user.id,
      source: 'MANUAL',
      reason: 'Prazo da COF cumprido: contrato liberado',
    }).catch(() => undefined);
    await this.registrar(user, cof.leadId, id, 'cof.contract_released', 'Prazo cumprido: contrato liberado');
    return atualizado;
  }

  async cancelar(user: AuthenticatedUser, id: string, motivo: string) {
    const cof = await this.buscar(user, id);
    const atualizado = await this.prisma.client.cofProcess.update({
      where: { id },
      data: { status: 'CANCELADA', notes: motivo },
    });
    await this.registrar(user, cof.leadId, id, 'cof.cancel', `COF cancelada: ${motivo}`);
    return atualizado;
  }

  private async buscar(user: AuthenticatedUser, id: string) {
    const cof = await this.prisma.client.cofProcess.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!cof) throw new NotFoundError('Processo de COF nao encontrado.');
    return cof;
  }

  private async registrar(
    user: AuthenticatedUser,
    leadId: string,
    cofId: string,
    evento: string,
    texto: string,
  ): Promise<void> {
    await writeAudit(this.prisma.client, {
      organizationId: user.organizationId,
      actorUserId: user.id,
      actorType: 'USER',
      event: evento,
      entity: 'CofProcess',
      entityId: cofId,
      after: { texto },
    });
    await writeActivity(this.prisma.client, {
      organizationId: user.organizationId,
      leadId,
      userId: user.id,
      type: 'COF',
      title: texto,
    });
  }
}

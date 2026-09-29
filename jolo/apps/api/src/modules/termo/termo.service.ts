import { Injectable } from '@nestjs/common';
import { writeAudit } from '@jolo/crm-core';
import { AUDIT_EVENTS, TERMO_DE_USO } from '@jolo/shared';
import { PrismaService } from '../../common/prisma.service.js';
import type { AuthenticatedUser } from '../../common/decorators/index.js';

/** Quanto tempo a resposta "ja aceitou" fica guardada na memoria. */
const VALIDADE_DO_CACHE_MS = 5 * 60_000;

@Injectable()
export class TermoService {
  // So guarda quem JA aceitou: o "ainda nao" e conferido no banco toda vez,
  // para o aceite valer no mesmo instante em que acontece.
  private readonly aceitos = new Map<string, number>();

  constructor(private readonly prisma: PrismaService) {}

  private chave(userId: string): string {
    return `${userId}:${TERMO_DE_USO.versao}`;
  }

  async aceitou(userId: string): Promise<boolean> {
    const chave = this.chave(userId);
    const ate = this.aceitos.get(chave);
    if (ate && ate > Date.now()) return true;

    const registro = await this.prisma.client.termAcceptance.findUnique({
      where: { userId_version: { userId, version: TERMO_DE_USO.versao } },
      select: { id: true },
    });
    if (registro) this.aceitos.set(chave, Date.now() + VALIDADE_DO_CACHE_MS);
    return Boolean(registro);
  }

  async atual(user: AuthenticatedUser) {
    const registro = await this.prisma.client.termAcceptance.findUnique({
      where: { userId_version: { userId: user.id, version: TERMO_DE_USO.versao } },
      select: { acceptedAt: true },
    });
    return {
      versao: TERMO_DE_USO.versao,
      titulo: TERMO_DE_USO.titulo,
      paragrafos: TERMO_DE_USO.paragrafos,
      aceitoEm: registro?.acceptedAt ?? null,
    };
  }

  async aceitar(user: AuthenticatedUser, versao: string, origem: { ip?: string; userAgent?: string }) {
    // Aceite de versao velha nao vale: a pessoa aceitaria um texto que nao e o vigente.
    if (versao !== TERMO_DE_USO.versao) {
      return { ok: false as const, motivo: 'Este termo mudou. Leia a versão atual.' };
    }
    const registro = await this.prisma.client.termAcceptance.upsert({
      where: { userId_version: { userId: user.id, version: versao } },
      // aceitar de novo nao muda a data do primeiro aceite: ela e a prova
      update: {},
      create: {
        organizationId: user.organizationId,
        userId: user.id,
        version: versao,
        ip: origem.ip?.slice(0, 64),
        userAgent: origem.userAgent?.slice(0, 300),
      },
    });
    await writeAudit(this.prisma.client, {
      organizationId: user.organizationId,
      event: AUDIT_EVENTS.TERMO_ACEITO,
      entity: 'user',
      entityId: user.id,
      actorUserId: user.id,
      actorType: 'USER',
      after: { versao, aceitoEm: registro.acceptedAt },
    });
    this.aceitos.set(this.chave(user.id), Date.now() + VALIDADE_DO_CACHE_MS);
    return { ok: true as const, aceitoEm: registro.acceptedAt };
  }
}

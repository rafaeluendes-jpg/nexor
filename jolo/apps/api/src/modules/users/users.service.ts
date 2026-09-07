import { Injectable } from '@nestjs/common';
import { AUDIT_EVENTS, DomainError, NotFoundError, permissionsForRoles, type RoleKey } from '@jolo/shared';
import { writeAudit } from '@jolo/crm-core';
import { PrismaService } from '../../common/prisma.service.js';
import { AuthService } from '../auth/auth.service.js';
import type { AuthenticatedUser } from '../../common/decorators/index.js';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  async list(user: AuthenticatedUser) {
    const usuarios = await this.prisma.client.user.findMany({
      where: { organizationId: user.organizationId },
      include: {
        roles: { include: { role: true } },
        sessions: { where: { revokedAt: null, expiresAt: { gt: new Date() } }, select: { id: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    // Nunca devolvemos hash de senha, token ou segredo.
    return usuarios.map((u) => ({
      id: u.id,
      nome: u.name,
      email: u.email,
      status: u.status,
      papeis: u.roles.map((r) => r.role.name),
      mfaObrigatorio: u.mfaRequired,
      mfaAtivo: u.mfaEnabled,
      ultimoAcesso: u.lastLoginAt,
      sessoesAtivas: u.sessions.length,
      criadoEm: u.createdAt,
    }));
  }

  async create(
    actor: AuthenticatedUser,
    input: { nome: string; email: string; papel: RoleKey; senhaProvisoria: string },
  ) {
    const email = input.email.trim().toLowerCase();
    const jaExiste = await this.prisma.client.user.findUnique({ where: { email } });
    if (jaExiste) throw new DomainError('Ja existe usuario com este e-mail.', 'USER_EXISTS', 409);

    const role = await this.prisma.client.role.findUnique({ where: { name: input.papel } });
    if (!role) throw new NotFoundError('Papel inexistente.');

    const criado = await this.prisma.client.user.create({
      data: {
        organizationId: actor.organizationId,
        email,
        name: input.nome,
        status: 'ACTIVE',
        roles: { create: { roleId: role.id } },
      },
    });

    const identidade = await this.auth.provider.createUser(email, input.senhaProvisoria);
    await this.prisma.client.user.update({
      where: { id: criado.id },
      data: { authProviderId: this.auth.provider.name === 'local' ? null : identidade.providerId },
    });

    await writeAudit(this.prisma.client, {
      organizationId: actor.organizationId,
      event: AUDIT_EVENTS.USER_CREATED,
      entity: 'user',
      entityId: criado.id,
      actorUserId: actor.id,
      actorType: 'USER',
      after: { email, papel: input.papel },
    });

    return { id: criado.id, email: criado.email, papel: input.papel };
  }

  async setRole(actor: AuthenticatedUser, userId: string, papel: RoleKey) {
    const alvo = await this.prisma.client.user.findFirst({
      where: { id: userId, organizationId: actor.organizationId },
      include: { roles: { include: { role: true } } },
    });
    if (!alvo) throw new NotFoundError('Usuario nao encontrado.');
    const role = await this.prisma.client.role.findUnique({ where: { name: papel } });
    if (!role) throw new NotFoundError('Papel inexistente.');

    const antes = alvo.roles.map((r) => r.role.name);
    await this.prisma.client.userRole.deleteMany({ where: { userId } });
    await this.prisma.client.userRole.create({ data: { userId, roleId: role.id } });
    // Trocar papel derruba as sessoes: a permissao nova vale imediatamente.
    await this.prisma.client.userSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date(), revokedBy: actor.id },
    });

    await writeAudit(this.prisma.client, {
      organizationId: actor.organizationId,
      event: AUDIT_EVENTS.PERMISSION_CHANGED,
      entity: 'user',
      entityId: userId,
      actorUserId: actor.id,
      actorType: 'USER',
      before: { papeis: antes },
      after: { papeis: [papel] },
    });
    return { ok: true, papel, permissoes: permissionsForRoles([papel]) };
  }

  async setStatus(actor: AuthenticatedUser, userId: string, ativo: boolean) {
    const alvo = await this.prisma.client.user.findFirst({
      where: { id: userId, organizationId: actor.organizationId },
    });
    if (!alvo) throw new NotFoundError('Usuario nao encontrado.');
    if (alvo.id === actor.id) throw new DomainError('Voce nao pode desativar a si mesmo.', 'SELF_DISABLE', 400);

    await this.prisma.client.user.update({
      where: { id: userId },
      data: {
        status: ativo ? 'ACTIVE' : 'DISABLED',
        disabledAt: ativo ? null : new Date(),
        failedLogins: 0,
        lockedUntil: null,
      },
    });
    if (!ativo) {
      await this.prisma.client.userSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date(), revokedBy: actor.id },
      });
    }
    await writeAudit(this.prisma.client, {
      organizationId: actor.organizationId,
      event: ativo ? AUDIT_EVENTS.USER_UPDATED : AUDIT_EVENTS.USER_DISABLED,
      entity: 'user',
      entityId: userId,
      actorUserId: actor.id,
      actorType: 'USER',
      after: { status: ativo ? 'ACTIVE' : 'DISABLED' },
    });
    return { ok: true };
  }

  /** Encerra todas as sessoes de um usuario (item 71). */
  async revokeSessions(actor: AuthenticatedUser, userId: string) {
    const res = await this.prisma.client.userSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date(), revokedBy: actor.id },
    });
    return { ok: true, sessoesEncerradas: res.count };
  }

  async requestPasswordReset(actor: AuthenticatedUser, userId: string) {
    const alvo = await this.prisma.client.user.findFirst({
      where: { id: userId, organizationId: actor.organizationId },
    });
    if (!alvo) throw new NotFoundError('Usuario nao encontrado.');
    await this.auth.provider.requestPasswordReset(alvo.email);
    await writeAudit(this.prisma.client, {
      organizationId: actor.organizationId,
      event: AUDIT_EVENTS.USER_UPDATED,
      entity: 'user',
      entityId: userId,
      actorUserId: actor.id,
      actorType: 'USER',
      after: { acao: 'reset_senha_solicitado' },
    });
    return { ok: true };
  }
}

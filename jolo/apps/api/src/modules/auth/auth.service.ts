import { Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import { loadServerEnv } from '@jolo/config/server';
import { lockoutFor } from '@jolo/security';
import { AUDIT_EVENTS, UnauthorizedError, permissionsForRoles, type RoleKey } from '@jolo/shared';
import { writeAudit } from '@jolo/crm-core';
import { PrismaService } from '../../common/prisma.service.js';
import type { AuthenticatedUser } from '../../common/decorators/index.js';
import { LocalAuthProvider } from './providers/local.provider.js';
import { SupabaseAuthProvider } from './providers/supabase.provider.js';
import type { AuthProvider } from './providers/types.js';

export interface LoginResult {
  accessToken: string;
  expiresIn: string;
  user: Omit<AuthenticatedUser, 'sessionId'>;
}

@Injectable()
export class AuthService {
  private readonly env = loadServerEnv();
  private readonly secret = new TextEncoder().encode(this.env.JWT_SECRET);
  readonly provider: AuthProvider;

  constructor(private readonly prisma: PrismaService) {
    this.provider =
      this.env.AUTH_PROVIDER === 'supabase'
        ? new SupabaseAuthProvider(
            this.env.SUPABASE_URL ?? '',
            this.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
            this.env.SUPABASE_ANON_KEY ?? '',
          )
        : new LocalAuthProvider(this.prisma.client, this.env.NODE_ENV);
  }

  async login(params: { email: string; password: string; ip?: string; userAgent?: string }): Promise<LoginResult> {
    const email = params.email.trim().toLowerCase();
    const user = await this.prisma.client.user.findUnique({
      where: { email },
      include: { roles: { include: { role: true } } },
    });

    // Usuario bloqueado ou desativado nao entra, mesmo com a senha certa.
    if (user?.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedError('Acesso temporariamente bloqueado por tentativas seguidas.');
    }
    if (user && user.status !== 'ACTIVE') {
      throw new UnauthorizedError('Usuario sem acesso liberado.');
    }

    const resultado = await this.provider.signIn(email, params.password);
    if (!resultado.ok || !user) {
      if (user) {
        const tentativas = user.failedLogins + 1;
        const bloqueio = lockoutFor(tentativas);
        await this.prisma.client.user.update({
          where: { id: user.id },
          data: {
            failedLogins: tentativas,
            lockedUntil: bloqueio.until ?? null,
            status: bloqueio.locked ? 'LOCKED' : user.status,
          },
        });
        await writeAudit(this.prisma.client, {
          organizationId: user.organizationId,
          event: AUDIT_EVENTS.USER_LOGIN_FAILED,
          entity: 'user',
          entityId: user.id,
          actorType: 'SYSTEM',
          ip: params.ip,
          after: { tentativas },
        });
      }
      // Mensagem unica: nao dizemos se o e-mail existe (anti-enumeracao).
      throw new UnauthorizedError('E-mail ou senha invalidos.');
    }

    const roles = user.roles.map((r) => r.role.name as RoleKey);
    const permissions = permissionsForRoles(roles);
    const sessionId = randomUUID();

    const accessToken = await new SignJWT({
      sub: user.id,
      org: user.organizationId,
      email: user.email,
      name: user.name,
      roles,
      sid: sessionId,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setIssuer('jolo-api')
      .setAudience('jolo-crm')
      .setExpirationTime(this.env.JWT_EXPIRES_IN)
      .sign(this.secret);

    await this.prisma.client.userSession.create({
      data: {
        id: sessionId,
        userId: user.id,
        tokenHash: createHash('sha256').update(accessToken).digest('hex'),
        ip: params.ip ?? null,
        userAgent: params.userAgent?.slice(0, 300) ?? null,
        expiresAt: new Date(Date.now() + 8 * 60 * 60_000),
      },
    });
    await this.prisma.client.user.update({
      where: { id: user.id },
      data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() },
    });
    await writeAudit(this.prisma.client, {
      organizationId: user.organizationId,
      event: AUDIT_EVENTS.USER_LOGIN,
      entity: 'user',
      entityId: user.id,
      actorUserId: user.id,
      actorType: 'USER',
      ip: params.ip,
    });

    return {
      accessToken,
      expiresIn: this.env.JWT_EXPIRES_IN,
      user: {
        id: user.id,
        organizationId: user.organizationId,
        email: user.email,
        name: user.name,
        roles,
        permissions,
      },
    };
  }

  async verifyAccessToken(token: string): Promise<AuthenticatedUser> {
    try {
      const { payload } = await jwtVerify(token, this.secret, {
        issuer: 'jolo-api',
        audience: 'jolo-crm',
      });
      const sessionId = String(payload.sid ?? '');
      const sessao = await this.prisma.client.userSession.findUnique({ where: { id: sessionId } });
      // Sessao revogada ou vencida nao vale, mesmo com token assinado.
      if (!sessao || sessao.revokedAt || sessao.expiresAt < new Date()) throw new UnauthorizedError();

      const user = await this.prisma.client.user.findUnique({
        where: { id: String(payload.sub) },
        include: { roles: { include: { role: true } } },
      });
      if (!user || user.status !== 'ACTIVE') throw new UnauthorizedError('Usuario sem acesso liberado.');

      const roles = user.roles.map((r) => r.role.name as RoleKey);
      return {
        id: user.id,
        organizationId: user.organizationId,
        email: user.email,
        name: user.name,
        roles,
        permissions: permissionsForRoles(roles),
        sessionId,
      };
    } catch (err) {
      if (err instanceof UnauthorizedError) throw err;
      throw new UnauthorizedError('Sessao invalida ou expirada.');
    }
  }

  async logout(user: AuthenticatedUser): Promise<void> {
    if (user.sessionId) {
      await this.prisma.client.userSession.updateMany({
        where: { id: user.sessionId, revokedAt: null },
        data: { revokedAt: new Date(), revokedBy: user.id },
      });
    }
    await writeAudit(this.prisma.client, {
      organizationId: user.organizationId,
      event: AUDIT_EVENTS.USER_LOGOUT,
      entity: 'user',
      entityId: user.id,
      actorUserId: user.id,
      actorType: 'USER',
    });
  }

  async logoutAll(user: AuthenticatedUser): Promise<number> {
    const res = await this.prisma.client.userSession.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date(), revokedBy: user.id },
    });
    return res.count;
  }

  async changeOwnPassword(user: AuthenticatedUser, current: string, next: string): Promise<void> {
    const confere = await this.provider.signIn(user.email, current);
    if (!confere.ok) throw new UnauthorizedError('Senha atual incorreta.');
    const alvo = await this.prisma.client.user.findUniqueOrThrow({ where: { id: user.id } });
    await this.provider.changePassword(alvo.authProviderId ?? alvo.id, next);
    await this.logoutAll(user);
  }
}

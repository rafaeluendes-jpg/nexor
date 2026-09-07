import { compare, hash } from 'bcryptjs';
import type { PrismaClient } from '@jolo/database';
import { checkPasswordStrength } from '@jolo/security';
import { DomainError } from '@jolo/shared';
import type { AuthIdentity, AuthProvider, SignInResult } from './types.js';

/**
 * Provider APENAS de desenvolvimento e teste, para o projeto nao ficar parado
 * enquanto as credenciais do Supabase nao existem (itens 64 e 65).
 * Se alguem tentar usar isto em producao, o construtor derruba o processo.
 */
export class LocalAuthProvider implements AuthProvider {
  readonly name = 'local';

  constructor(
    private readonly prisma: PrismaClient,
    nodeEnv: string,
  ) {
    if (nodeEnv === 'production') {
      throw new Error(
        'AUTH_PROVIDER=local e proibido em producao. Configure o Supabase Auth (docs/SECURITY_BASELINE.md).',
      );
    }
  }

  async signIn(email: string, password: string): Promise<SignInResult> {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    // Mesma resposta para usuario inexistente e senha errada: nao revelamos quem existe.
    if (!user?.devPasswordHash) return { ok: false, reason: 'invalid_credentials' };
    const confere = await compare(password, user.devPasswordHash);
    if (!confere) return { ok: false, reason: 'invalid_credentials' };
    return { ok: true, identity: { providerId: user.id, email: user.email } };
  }

  async createUser(email: string, password: string): Promise<AuthIdentity> {
    const forca = checkPasswordStrength(password);
    if (!forca.ok) {
      throw new DomainError(`Senha fraca. Falta: ${forca.problems.join(', ')}.`, 'WEAK_PASSWORD', 422);
    }
    const devPasswordHash = await hash(password, 12);
    const user = await this.prisma.user.update({
      where: { email: email.toLowerCase() },
      data: { devPasswordHash },
    });
    return { providerId: user.id, email: user.email };
  }

  async requestPasswordReset(): Promise<void> {
    // Em desenvolvimento nao existe e-mail: o admin redefine pelo painel.
  }

  async changePassword(providerId: string, newPassword: string): Promise<void> {
    const forca = checkPasswordStrength(newPassword);
    if (!forca.ok) {
      throw new DomainError(`Senha fraca. Falta: ${forca.problems.join(', ')}.`, 'WEAK_PASSWORD', 422);
    }
    await this.prisma.user.update({
      where: { id: providerId },
      data: { devPasswordHash: await hash(newPassword, 12) },
    });
  }
}

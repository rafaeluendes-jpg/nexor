import { SetMetadata, createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Permission } from '@jolo/shared';

export const IS_PUBLIC = 'jolo:is_public';
export const REQUIRED_PERMISSION = 'jolo:permission';
export const RATE_LIMIT_RULE = 'jolo:rate_limit';
export const SEM_TERMO = 'jolo:sem_termo';

/** Rota aberta (sem login). Usada so por health, webhook e atribuicao. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/**
 * Rota que o usuario logado usa ANTES de aceitar o termo de uso: ler o
 * termo, aceitar, saber quem e, sair. Todo o resto exige o aceite.
 */
export const SemTermo = () => SetMetadata(SEM_TERMO, true);

/** Permissao exigida no BACKEND. Esconder botao no frontend nao e seguranca. */
export const RequirePermission = (permission: Permission) => SetMetadata(REQUIRED_PERMISSION, permission);

export const RateLimit = (rule: 'login' | 'api' | 'webhook' | 'attribution') =>
  SetMetadata(RATE_LIMIT_RULE, rule);

export interface AuthenticatedUser {
  id: string;
  organizationId: string;
  email: string;
  name: string;
  roles: string[];
  permissions: Permission[];
  sessionId?: string;
}

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
  const req = ctx.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
  if (!req.user) throw new Error('Rota autenticada sem usuario no contexto.');
  return req.user;
});

import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ForbiddenError, type Permission } from '@jolo/shared';
import { REQUIRED_PERMISSION, type AuthenticatedUser } from '../decorators/index.js';

/** RBAC real: a permissao e conferida aqui, mesmo que a chamada venha "na mao". */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const exigida = this.reflector.getAllAndOverride<Permission>(REQUIRED_PERMISSION, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!exigida) return true;

    const req = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const user = req.user;
    if (!user) throw new ForbiddenError();
    if (!user.permissions.includes(exigida)) {
      throw new ForbiddenError(`Seu perfil nao tem a permissao ${exigida}.`);
    }
    return true;
  }
}

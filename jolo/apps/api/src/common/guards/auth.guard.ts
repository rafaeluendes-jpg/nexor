import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UnauthorizedError } from '@jolo/shared';
import { IS_PUBLIC } from '../decorators/index.js';
import { AuthService } from '../../modules/auth/auth.service.js';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const publico = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (publico) return true;

    const req = context.switchToHttp().getRequest<{ headers: Record<string, string>; user?: unknown }>();
    const header = req.headers?.authorization ?? '';
    if (!header.startsWith('Bearer ')) throw new UnauthorizedError();

    const user = await this.auth.verifyAccessToken(header.slice(7).trim());
    req.user = user;
    return true;
  }
}

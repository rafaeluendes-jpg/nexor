import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DomainError } from '@jolo/shared';
import { IS_PUBLIC, SEM_TERMO, type AuthenticatedUser } from '../decorators/index.js';
import { TermoService } from '../../modules/termo/termo.service.js';

/**
 * LGPD: quem ainda nao aceitou o termo de uso vigente nao ve dado nenhum.
 * Vem depois da autenticacao e antes da permissao. Esconder a tela no
 * navegador nao bastaria: a API recusa, qualquer que seja o caminho.
 */
@Injectable()
export class TermoGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly termo: TermoService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const alvo = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, alvo)) return true;
    if (this.reflector.getAllAndOverride<boolean>(SEM_TERMO, alvo)) return true;

    const user = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>().user;
    if (!user) return true; // sem login quem barra e o AuthGuard

    if (await this.termo.aceitou(user.id)) return true;
    throw new DomainError('Leia e aceite o termo de uso para continuar.', 'TERMO_PENDENTE', 428);
  }
}

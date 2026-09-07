import { Injectable } from '@nestjs/common';
import { canalDaOrganizacao, type AvisoTempoReal } from '@jolo/shared';
import { RedisService } from './redis.service.js';

/**
 * Avisa as telas abertas que algo mudou (item 44).
 * O aviso nao carrega dado sensivel: a tela busca o dado pela API,
 * com a permissao de quem esta olhando.
 */
@Injectable()
export class AvisosService {
  constructor(private readonly redis: RedisService) {}

  async publicar(aviso: Omit<AvisoTempoReal, 'em'>): Promise<void> {
    const completo: AvisoTempoReal = { ...aviso, em: new Date().toISOString() };
    await this.redis.connection
      .publish(canalDaOrganizacao(aviso.organizationId), JSON.stringify(completo))
      .catch(() => undefined);
  }
}

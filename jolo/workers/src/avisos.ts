import type { Redis } from 'ioredis';
import { canalDaOrganizacao, type AvisoTempoReal, type TipoDeAviso } from '@jolo/shared';

/**
 * Manda um aviso para as telas abertas (item 44). E so aviso: a tela recarrega
 * o dado pela API, com a permissao de quem esta olhando. Nada de dado sensivel
 * viaja por aqui.
 */
export async function publicarAviso(
  redis: Redis,
  aviso: Omit<AvisoTempoReal, 'em'> & { em?: string },
): Promise<void> {
  const completo: AvisoTempoReal = { ...aviso, em: aviso.em ?? new Date().toISOString() };
  await redis
    .publish(canalDaOrganizacao(aviso.organizationId), JSON.stringify(completo))
    .catch(() => undefined);
}

export type { TipoDeAviso };

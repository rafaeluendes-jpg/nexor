import { Injectable, type PipeTransform } from '@nestjs/common';
import { DomainError } from '@jolo/shared';
import type { ZodType } from 'zod';

/** Validacao de entrada obrigatoria (item 41). Nada entra sem schema. */
@Injectable()
export class ZodValidationPipe<T> implements PipeTransform {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const resultado = this.schema.safeParse(value);
    if (!resultado.success) {
      const detalhe = resultado.error.issues
        .map((i) => `${i.path.join('.') || 'corpo'}: ${i.message}`)
        .join('; ');
      throw new DomainError(`Dados invalidos. ${detalhe}`, 'VALIDATION_ERROR', 422);
    }
    return resultado.data;
  }
}

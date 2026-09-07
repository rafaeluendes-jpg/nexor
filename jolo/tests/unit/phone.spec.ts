import { describe, expect, it } from 'vitest';
import { formatPhoneBR, normalizePhoneBR, phoneMatchKeys } from '@jolo/shared';

describe('normalizacao de telefone (deduplicacao de contato)', () => {
  it('normaliza formatos diferentes do mesmo numero', () => {
    const esperado = '5517988887777';
    expect(normalizePhoneBR('5517988887777')).toBe(esperado);
    expect(normalizePhoneBR('+55 (17) 98888-7777')).toBe(esperado);
    expect(normalizePhoneBR('17 98888 7777')).toBe(esperado);
    expect(normalizePhoneBR('017988887777')).toBe(esperado);
  });

  it('acrescenta o nono digito de celular quando falta', () => {
    expect(normalizePhoneBR('1788887777')).toBe('5517988887777');
  });

  it('gera as duas chaves para casar cadastro antigo e novo', () => {
    expect(phoneMatchKeys('5517988887777')).toContain('551788887777');
  });

  it('recusa entrada sem DDD', () => {
    expect(normalizePhoneBR('988887777')).toBeNull();
    expect(normalizePhoneBR('123')).toBeNull();
  });

  it('formata para leitura humana', () => {
    expect(formatPhoneBR('5517988887777')).toBe('+55 (17) 98888-7777');
  });
});

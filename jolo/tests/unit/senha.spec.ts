import { describe, expect, it } from 'vitest';
import { checkPasswordStrength } from '@jolo/security';

describe('regra de senha (8 caracteres, letras e numeros)', () => {
  it('aceita senha simples de lembrar, mas nao obvia', () => {
    for (const s of ['casa2026', 'Maria1984', 'praia7verao', 'Trufa2025!']) {
      expect(checkPasswordStrength(s).ok, s).toBe(true);
    }
  });

  it('recusa curta, so numero, so letra e obvia', () => {
    for (const s of ['abc12', '12345678', '98765432', 'abcdefgh', 'senha123', 'jolo2026', 'gelato99', 'aaaaaaaa', 'qwerty12']) {
      expect(checkPasswordStrength(s).ok, s).toBe(false);
    }
  });
});

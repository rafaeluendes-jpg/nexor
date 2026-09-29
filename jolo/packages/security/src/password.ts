/** Politica de senha forte (item 71). Vale para o provider local e para o Supabase. */
export interface PasswordCheck {
  ok: boolean;
  problems: string[];
}

export function checkPasswordStrength(password: string): PasswordCheck {
  // Regra combinada com o Rafael (29/09/2026): 8 caracteres com letras e
  // numeros, sem obrigar maiuscula nem simbolo. O que protege de verdade e
  // o tamanho, o bloqueio depois de 5 erros e barrar as senhas obvias.
  const problems: string[] = [];
  if (password.length < 8) problems.push('minimo de 8 caracteres');
  if (!/[A-Za-z]/.test(password)) problems.push('ao menos uma letra');
  if (!/[0-9]/.test(password)) problems.push('ao menos um numero');
  if (/^(.)\1+$/.test(password)) problems.push('nao pode ser um caractere repetido');
  const minuscula = password.toLowerCase();
  const comuns = ['senha', 'password', '123456', '12345678', 'abc123', 'jolo', 'gelato', 'qwerty', 'franquia'];
  if (comuns.some((c) => minuscula.includes(c))) problems.push('nao pode conter palavra ou sequencia obvia');
  return { ok: problems.length === 0, problems };
}

/** Bloqueio progressivo por tentativas (protecao contra forca bruta). */
export function lockoutFor(failedAttempts: number): { locked: boolean; until?: Date } {
  if (failedAttempts < 5) return { locked: false };
  const minutos = Math.min(60, 2 ** (failedAttempts - 5));
  return { locked: true, until: new Date(Date.now() + minutos * 60_000) };
}

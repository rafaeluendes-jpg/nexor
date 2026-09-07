/** Politica de senha forte (item 71). Vale para o provider local e para o Supabase. */
export interface PasswordCheck {
  ok: boolean;
  problems: string[];
}

export function checkPasswordStrength(password: string): PasswordCheck {
  const problems: string[] = [];
  if (password.length < 12) problems.push('minimo de 12 caracteres');
  if (!/[a-z]/.test(password)) problems.push('uma letra minuscula');
  if (!/[A-Z]/.test(password)) problems.push('uma letra maiuscula');
  if (!/[0-9]/.test(password)) problems.push('um numero');
  if (!/[^A-Za-z0-9]/.test(password)) problems.push('um caractere especial');
  if (/^(.)\1+$/.test(password)) problems.push('nao pode ser um caractere repetido');
  const comuns = ['senha', 'password', '123456', 'jolo', 'gelato', 'qwerty'];
  if (comuns.some((c) => password.toLowerCase().includes(c))) problems.push('nao pode conter palavra obvia');
  return { ok: problems.length === 0, problems };
}

/** Bloqueio progressivo por tentativas (protecao contra forca bruta). */
export function lockoutFor(failedAttempts: number): { locked: boolean; until?: Date } {
  if (failedAttempts < 5) return { locked: false };
  const minutos = Math.min(60, 2 ** (failedAttempts - 5));
  return { locked: true, until: new Date(Date.now() + minutos * 60_000) };
}

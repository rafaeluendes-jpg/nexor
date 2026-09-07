/**
 * Normalizacao de telefone brasileiro para E.164 sem "+".
 * Serve de chave de deduplicacao de contato (item 18 do prompt mestre).
 *
 * Regras cobertas:
 *  - remove tudo que nao e digito;
 *  - descarta o zero de tronco/operadora escrito antes do DDD (017, 0xx17);
 *  - aceita numero com ou sem DDI 55;
 *  - trata o "9" adicional de celular: o WhatsApp devolve numeros antigos
 *    de 8 digitos e numeros novos de 9. Guardamos sempre a forma de 9 digitos
 *    quando o DDD e brasileiro, para os dois formatos casarem no mesmo contato.
 */
export function normalizePhoneBR(input: string): string | null {
  const digits = (input ?? '').replace(/\D+/g, '');
  if (digits.length < 8) return null;

  let rest = digits;
  // "017 98888-7777" e "0 55 17 ..." sao o mesmo telefone: o zero e prefixo de
  // tronco, nao faz parte do numero. Sem isto o mesmo dono viraria dois contatos.
  while (rest.startsWith('0') && rest.length > 10) rest = rest.slice(1);
  if (rest.startsWith('55') && rest.length >= 12) rest = rest.slice(2);
  // numero internacional que nao e do Brasil: devolve como veio, so digitos
  if (rest.length > 11) return digits;

  if (rest.length === 8 || rest.length === 9) return null; // sem DDD nao da para deduplicar

  const ddd = rest.slice(0, 2);
  let number = rest.slice(2);
  if (number.length === 8 && /^[6-9]/.test(number)) number = `9${number}`;
  if (number.length !== 8 && number.length !== 9) return null;

  return `55${ddd}${number}`;
}

/** Formato de exibicao: +55 (17) 99999-9999 */
export function formatPhoneBR(e164: string): string {
  const d = (e164 ?? '').replace(/\D+/g, '');
  if (!d.startsWith('55') || d.length < 12) return e164;
  const ddd = d.slice(2, 4);
  const n = d.slice(4);
  const head = n.length === 9 ? n.slice(0, 5) : n.slice(0, 4);
  const tail = n.length === 9 ? n.slice(5) : n.slice(4);
  return `+55 (${ddd}) ${head}-${tail}`;
}

/** Chaves possiveis do mesmo telefone (com e sem o nono digito). */
export function phoneMatchKeys(e164: string): string[] {
  const keys = new Set<string>([e164]);
  const d = e164.replace(/\D+/g, '');
  if (d.startsWith('55') && d.length === 13) keys.add(`55${d.slice(2, 4)}${d.slice(5)}`);
  if (d.startsWith('55') && d.length === 12) keys.add(`55${d.slice(2, 4)}9${d.slice(4)}`);
  return [...keys];
}

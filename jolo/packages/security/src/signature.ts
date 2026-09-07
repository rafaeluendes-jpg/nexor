import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Valida a assinatura x-hub-signature-256 da Meta (item 11).
 * Nunca confiar em POST recebido: sem assinatura valida, o evento e descartado.
 * Comparacao em tempo constante para nao vazar informacao por tempo de resposta.
 */
export function verifyMetaSignature(params: {
  rawBody: Buffer | string;
  signatureHeader: string | undefined;
  appSecret: string;
}): { valid: boolean; reason?: string } {
  const { rawBody, signatureHeader, appSecret } = params;
  if (!appSecret) return { valid: false, reason: 'app_secret_ausente' };
  if (!signatureHeader) return { valid: false, reason: 'assinatura_ausente' };
  if (!signatureHeader.startsWith('sha256=')) return { valid: false, reason: 'formato_invalido' };

  const enviado = signatureHeader.slice('sha256='.length).trim();
  if (!/^[0-9a-f]{64}$/i.test(enviado)) return { valid: false, reason: 'formato_invalido' };

  const body = typeof rawBody === 'string' ? Buffer.from(rawBody, 'utf8') : rawBody;
  const esperado = createHmac('sha256', appSecret).update(body).digest('hex');

  const a = Buffer.from(esperado, 'hex');
  const b = Buffer.from(enviado.toLowerCase(), 'hex');
  if (a.length !== b.length) return { valid: false, reason: 'tamanho_invalido' };
  return timingSafeEqual(a, b) ? { valid: true } : { valid: false, reason: 'assinatura_incorreta' };
}

/** Desafio GET do webhook da Meta. Devolve o challenge apenas se o token bater. */
export function verifyWebhookChallenge(params: {
  mode: string | undefined;
  token: string | undefined;
  challenge: string | undefined;
  verifyToken: string | undefined;
}): { ok: boolean; challenge?: string } {
  const { mode, token, challenge, verifyToken } = params;
  if (!verifyToken) return { ok: false };
  if (mode !== 'subscribe') return { ok: false };
  if (!token || token !== verifyToken) return { ok: false };
  if (!challenge) return { ok: false };
  return { ok: true, challenge };
}

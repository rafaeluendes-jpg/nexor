import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyMetaSignature, verifyWebhookChallenge } from '@jolo/security';

const SECRET = 'segredo-de-teste';
const body = JSON.stringify({ object: 'whatsapp_business_account', entry: [] });
const assinar = (b: string, s = SECRET) => `sha256=${createHmac('sha256', s).update(b).digest('hex')}`;

describe('assinatura do webhook da Meta', () => {
  it('aceita assinatura correta', () => {
    expect(verifyMetaSignature({ rawBody: body, signatureHeader: assinar(body), appSecret: SECRET }).valid).toBe(true);
  });

  it('recusa assinatura de outro segredo', () => {
    const r = verifyMetaSignature({ rawBody: body, signatureHeader: assinar(body, 'outro'), appSecret: SECRET });
    expect(r.valid).toBe(false);
    expect(r.reason).toBe('assinatura_incorreta');
  });

  it('recusa corpo alterado depois de assinado', () => {
    const sig = assinar(body);
    const adulterado = body.replace('entry', 'entrry');
    expect(verifyMetaSignature({ rawBody: adulterado, signatureHeader: sig, appSecret: SECRET }).valid).toBe(false);
  });

  it('recusa quando nao ha assinatura', () => {
    expect(verifyMetaSignature({ rawBody: body, signatureHeader: undefined, appSecret: SECRET }).reason).toBe(
      'assinatura_ausente',
    );
  });

  it('recusa formato invalido', () => {
    expect(verifyMetaSignature({ rawBody: body, signatureHeader: 'sha1=abc', appSecret: SECRET }).valid).toBe(false);
    expect(verifyMetaSignature({ rawBody: body, signatureHeader: 'sha256=zz', appSecret: SECRET }).valid).toBe(false);
  });

  it('recusa quando o app secret nao esta configurado', () => {
    expect(verifyMetaSignature({ rawBody: body, signatureHeader: assinar(body), appSecret: '' }).reason).toBe(
      'app_secret_ausente',
    );
  });
});

describe('challenge de verificacao', () => {
  const base = { mode: 'subscribe', token: 'tk', challenge: '999', verifyToken: 'tk' };

  it('devolve o challenge quando o token bate', () => {
    expect(verifyWebhookChallenge(base)).toEqual({ ok: true, challenge: '999' });
  });

  it('recusa token diferente', () => {
    expect(verifyWebhookChallenge({ ...base, token: 'outro' }).ok).toBe(false);
  });

  it('recusa modo diferente de subscribe', () => {
    expect(verifyWebhookChallenge({ ...base, mode: 'unsubscribe' }).ok).toBe(false);
  });
});

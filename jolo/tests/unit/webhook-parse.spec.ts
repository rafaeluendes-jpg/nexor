import { describe, expect, it } from 'vitest';
import { parseMetaWebhook, webhookEventKey } from '@jolo/whatsapp';

const mensagem = {
  object: 'whatsapp_business_account',
  entry: [
    {
      id: 'WABA',
      changes: [
        {
          field: 'messages',
          value: {
            metadata: { phone_number_id: 'PNID' },
            contacts: [{ profile: { name: 'Maria' }, wa_id: '5517988887777' }],
            messages: [
              {
                from: '5517988887777',
                id: 'wamid.ABC',
                timestamp: '1788800000',
                type: 'text',
                text: { body: 'Quero saber da franquia' },
                referral: { ctwa_clid: 'clid-1', headline: 'Seja franqueado' },
              },
            ],
          },
        },
      ],
    },
  ],
};

const status = {
  object: 'whatsapp_business_account',
  entry: [
    {
      changes: [
        {
          value: {
            statuses: [
              { id: 'wamid.ABC', status: 'read', timestamp: '1788800100', recipient_id: '5517988887777' },
            ],
          },
        },
      ],
    },
  ],
};

describe('leitura do webhook', () => {
  it('extrai mensagem, contato e anuncio de origem', () => {
    const r = parseMetaWebhook(mensagem);
    expect(r.messages).toHaveLength(1);
    expect(r.messages[0]?.wamid).toBe('wamid.ABC');
    expect(r.messages[0]?.text).toBe('Quero saber da franquia');
    expect(r.messages[0]?.profileName).toBe('Maria');
    expect(r.messages[0]?.referral?.ctwa_clid).toBe('clid-1');
    expect(r.phoneNumberId).toBe('PNID');
  });

  it('extrai confirmacao de leitura', () => {
    const r = parseMetaWebhook(status);
    expect(r.statuses[0]).toMatchObject({ wamid: 'wamid.ABC', status: 'read' });
  });

  it('nao quebra com payload estranho', () => {
    expect(parseMetaWebhook({}).messages).toHaveLength(0);
    expect(parseMetaWebhook(null).statuses).toHaveLength(0);
    expect(parseMetaWebhook({ entry: 'nao e lista' }).messages).toHaveLength(0);
  });

  it('gera a mesma chave para o mesmo evento (idempotencia)', () => {
    expect(webhookEventKey(mensagem)).toBe(webhookEventKey(structuredClone(mensagem)));
    expect(webhookEventKey(mensagem)).not.toBe(webhookEventKey(status));
  });
});

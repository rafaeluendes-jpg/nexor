import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { captureAttribution, toPayload } from '@jolo/attribution';
import { LOJAS_QRCODE, lojaDoQrCode, nomeDaCampanha, nomeDaOrigem } from '@jolo/shared';

const gerador = readFileSync(
  fileURLToPath(new URL('../../scripts/gerar-qrcodes-lojas.py', import.meta.url)),
  'utf8',
);

/** Lojas e o endereco que o gerador grava em cada QR Code impresso. */
const lojasDoGerador = [...gerador.matchAll(/\('([a-z-]+)', '([A-Z]+)', '([^']+)'\)/g)].map((m) => ({
  slug: m[1]!,
  sigla: m[2]!,
  cidade: m[3]!,
}));
const base = /BASE = '([^']+)'/.exec(gerador)![1]!;

function janela(url: string): Window {
  const u = new URL(url);
  const storage = new Map<string, string>();
  return {
    location: { search: u.search, origin: u.origin, pathname: u.pathname },
    document: { referrer: '' },
    localStorage: {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => void storage.set(k, v),
    },
  } as unknown as Window;
}

describe('QR Code de cada loja', () => {
  it('o gerador e o CRM conhecem as mesmas cinco lojas', () => {
    expect(lojasDoGerador.map((l) => l.cidade)).toEqual([
      'Santa Fé do Sul',
      'Jales',
      'Sorocaba',
      'Petrópolis',
      'São Paulo',
    ]);
    for (const l of lojasDoGerador) {
      expect(LOJAS_QRCODE[`qrcode-${l.slug}`]).toBe(l.cidade);
    }
    expect(Object.keys(LOJAS_QRCODE)).toHaveLength(lojasDoGerador.length);
  });

  it('quem le o QR chega na landing com a loja marcada e o CRM mostra a cidade', () => {
    for (const l of lojasDoGerador) {
      const payload = toPayload(captureAttribution(janela(base + l.slug)));
      expect(payload.utmSource).toBe('loja');
      expect(payload.utmMedium).toBe('qrcode');
      expect(payload.utmCampaign).toBe(`qrcode-${l.slug}`);
      expect(nomeDaOrigem(payload.utmSource, payload.utmCampaign)).toBe(`QR Code da loja de ${l.cidade}`);
      expect(nomeDaCampanha(payload.utmCampaign)).toBe(`QR Code ${l.cidade}`);
    }
  });

  it('outras origens continuam com o nome de sempre', () => {
    expect(nomeDaOrigem('instagram', 'franquias-setembro')).toBe('instagram');
    expect(nomeDaOrigem(null)).toBe('direto');
    expect(nomeDaOrigem('loja', 'vitrine')).toBe('QR Code da loja');
    expect(nomeDaCampanha('franquias-setembro')).toBe('franquias-setembro');
    expect(nomeDaCampanha(null)).toBeNull();
    expect(lojaDoQrCode('QRCODE-JALES')).toBe('Jales');
    expect(lojaDoQrCode('qrcode-outra-cidade')).toBeNull();
  });
});

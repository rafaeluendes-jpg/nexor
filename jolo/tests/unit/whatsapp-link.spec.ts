import { describe, expect, it } from 'vitest';
import { readWhatsAppConfig, whatsappUrl } from '@jolo/config';

const NUMERO = '5517999998888';

describe('link do botao "Fale com o dono"', () => {
  it('monta o link oficial do wa.me com o numero configurado', () => {
    const cfg = readWhatsAppConfig({ NEXT_PUBLIC_WHATSAPP_NUMBER: NUMERO });
    expect(whatsappUrl(cfg)).toContain(`https://wa.me/${NUMERO}?text=`);
  });

  it('limpa mascara do numero digitado pelo operador', () => {
    const cfg = readWhatsAppConfig({ NEXT_PUBLIC_WHATSAPP_NUMBER: '+55 (17) 99999-8888' });
    expect(cfg.number).toBe(NUMERO);
    expect(cfg.configured).toBe(true);
  });

  it('fica desligado enquanto o operador nao informar o numero', () => {
    expect(readWhatsAppConfig({}).configured).toBe(false);
    expect(readWhatsAppConfig({ NEXT_PUBLIC_WHATSAPP_NUMBER: '99998888' }).configured).toBe(false);
  });

  it('leva o codigo de rastreio dentro da mensagem', () => {
    const cfg = readWhatsAppConfig({ NEXT_PUBLIC_WHATSAPP_NUMBER: NUMERO });
    const url = new URL(whatsappUrl(cfg, '[ref: jl_abc123]'));
    const texto = url.searchParams.get('text') ?? '';
    expect(texto).toContain(cfg.message);
    expect(texto).toContain('[ref: jl_abc123]');
  });

  it('usa a mensagem do operador quando ele define uma', () => {
    const cfg = readWhatsAppConfig({
      NEXT_PUBLIC_WHATSAPP_NUMBER: NUMERO,
      NEXT_PUBLIC_WHATSAPP_MESSAGE: 'Quero saber da franquia',
    });
    expect(new URL(whatsappUrl(cfg)).searchParams.get('text')).toBe('Quero saber da franquia');
  });
});

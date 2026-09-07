import { describe, expect, it } from 'vitest';
import { captureAttribution, toPayload, trackingSuffix } from '@jolo/attribution';

/** Janela de mentira, so com o que a captura usa. */
function janela(url: string, storage = new Map<string, string>(), referrer = ''): Window {
  const u = new URL(url);
  return {
    location: { search: u.search, origin: u.origin, pathname: u.pathname },
    document: { referrer },
    localStorage: {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => void storage.set(k, v),
    },
  } as unknown as Window;
}

describe('atribuicao de origem', () => {
  it('guarda a primeira origem do visitante', () => {
    const dados = captureAttribution(
      janela('https://jologelato.com.br/?utm_source=instagram&utm_campaign=franquias-setembro'),
    );
    expect(dados.first.source).toBe('instagram');
    expect(dados.first.campaign).toBe('franquias-setembro');
    expect(dados.trackingId).toMatch(/^jl_[0-9a-f]{22}$/);
  });

  it('nunca sobrescreve quem trouxe o lead na primeira visita', () => {
    const storage = new Map<string, string>();
    const primeiro = captureAttribution(janela('https://jologelato.com.br/?utm_source=instagram', storage));
    const segundo = captureAttribution(janela('https://jologelato.com.br/?utm_source=google', storage));

    expect(segundo.first.source).toBe('instagram');
    expect(segundo.last.source).toBe('google');
    expect(segundo.trackingId).toBe(primeiro.trackingId);
    expect(toPayload(segundo).utmSource).toBe('instagram');
  });

  it('visita direta depois da campanha nao apaga o last-touch', () => {
    const storage = new Map<string, string>();
    captureAttribution(janela('https://jologelato.com.br/?utm_source=instagram', storage));
    const direta = captureAttribution(janela('https://jologelato.com.br/', storage));
    expect(direta.last.source).toBe('instagram');
  });

  it('guarda os identificadores de clique de anuncio', () => {
    const dados = captureAttribution(janela('https://jologelato.com.br/?fbclid=ABC123&gclid=XYZ789'));
    expect(dados.fbclid).toBe('ABC123');
    expect(dados.gclid).toBe('XYZ789');
  });

  it('nao quebra quando o navegador bloqueia o armazenamento', () => {
    const bloqueada = {
      location: { search: '?utm_source=instagram', origin: 'https://jologelato.com.br', pathname: '/' },
      document: { referrer: '' },
      localStorage: {
        getItem: () => {
          throw new Error('bloqueado');
        },
        setItem: () => {
          throw new Error('bloqueado');
        },
      },
    } as unknown as Window;
    expect(() => captureAttribution(bloqueada)).not.toThrow();
    expect(captureAttribution(bloqueada).first.source).toBe('instagram');
  });

  it('marca a mensagem do WhatsApp com o codigo de rastreio', () => {
    const dados = captureAttribution(janela('https://jologelato.com.br/?utm_source=instagram'));
    const sufixo = trackingSuffix(dados);
    expect(sufixo).toBe(`[ref: ${dados.trackingId}]`);
    // o worker le exatamente este formato para casar o lead com a campanha
    expect(/\[ref:\s*(jl_[a-z0-9]+)\s*\]/i.exec(sufixo)?.[1]).toBe(dados.trackingId);
  });
});

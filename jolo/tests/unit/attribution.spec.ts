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
  describe('origem sem utm_ (link da bio, busca, anuncio sem etiqueta)', () => {
    const casos: Array<[string, string, string | undefined, string | undefined]> = [
      ['https://jologelato.com.br/?gclid=AB1', '', 'google', 'cpc'],
      ['https://jologelato.com.br/?gbraid=AB1', 'https://www.google.com/', 'google', 'cpc'],
      ['https://jologelato.com.br/', 'https://www.google.com.br/', 'google', 'organic'],
      ['https://jologelato.com.br/?fbclid=X', 'https://l.instagram.com/', 'instagram', 'social'],
      ['https://jologelato.com.br/?fbclid=X', 'https://lm.facebook.com/', 'facebook', 'social'],
      ['https://jologelato.com.br/?fbclid=X', '', 'facebook', 'social'],
      ['https://jologelato.com.br/?ttclid=X', '', 'tiktok', 'cpc'],
      ['https://jologelato.com.br/', 'https://www.portaldofranchising.com.br/lista', 'portaldofranchising.com.br', 'referral'],
      ['https://jologelato.com.br/', '', undefined, undefined],
      ['https://jologelato.com.br/', 'https://jologelato.com.br/termos', undefined, undefined],
    ];
    for (const [url, referrer, fonte, meio] of casos) {
      it(`${url} vindo de "${referrer || 'nenhum site'}" -> ${fonte ?? 'direto'}`, () => {
        const dados = captureAttribution(janela(url, new Map(), referrer));
        expect(dados.first.source).toBe(fonte);
        expect(dados.first.medium).toBe(meio);
      });
    }

    it('utm_ escrito a mao sempre vence a origem deduzida', () => {
      const dados = captureAttribution(
        janela('https://jologelato.com.br/?utm_source=parceiro&gclid=AB1', new Map(), 'https://www.google.com/'),
      );
      expect(dados.first.source).toBe('parceiro');
      expect(dados.first.medium).toBeUndefined();
    });

    it('primeira visita direta nao tira o credito do anuncio que veio depois', () => {
      const storage = new Map<string, string>();
      captureAttribution(janela('https://jologelato.com.br/', storage));
      const depois = captureAttribution(janela('https://jologelato.com.br/', storage, 'https://l.instagram.com/'));
      expect(depois.first.source).toBe('instagram');
      expect(toPayload(depois).utmSource).toBe('instagram');
    });
  });
});

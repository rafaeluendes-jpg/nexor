'use client';

/**
 * Pixels de anuncio (Meta e Google). Cada um so existe se o seu codigo
 * estiver no .env; vazio = nada e carregado e nenhum aviso aparece.
 * E so carregam depois que o visitante aceita (LGPD): sem "sim", a pagina
 * nao fala com Meta nem Google. A origem do lead no CRM nao depende disto:
 * ela e guardada pela propria landing, com ou sem pixel.
 */
export const PIXELS = {
  meta: (process.env.NEXT_PUBLIC_META_PIXEL_ID ?? '').replace(/\D+/g, ''),
  ga4: (process.env.NEXT_PUBLIC_GA4_ID ?? '').trim(),
  googleAds: (process.env.NEXT_PUBLIC_GOOGLE_ADS_ID ?? '').trim(),
  googleAdsRotulo: (process.env.NEXT_PUBLIC_GOOGLE_ADS_LABEL ?? '').trim(),
};

export const TEM_PIXEL = Boolean(PIXELS.meta || PIXELS.ga4 || PIXELS.googleAds);

const CHAVE_CONSENTIMENTO = 'jolo.consentimento.v1';

type Fbq = ((...args: unknown[]) => void) & { callMethod?: (...a: unknown[]) => void; queue?: unknown[] };
type Janela = Window & { fbq?: Fbq; _fbq?: Fbq; dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void };

export function lerConsentimento(): 'sim' | 'nao' | null {
  try {
    const v = window.localStorage.getItem(CHAVE_CONSENTIMENTO);
    return v === 'sim' || v === 'nao' ? v : null;
  } catch {
    return null;
  }
}

export function gravarConsentimento(v: 'sim' | 'nao'): void {
  try {
    window.localStorage.setItem(CHAVE_CONSENTIMENTO, v);
  } catch {
    /* sem storage: vale so nesta visita */
  }
  if (v === 'sim') carregarPixels();
}

function script(src: string): void {
  if (document.querySelector(`script[src="${src}"]`)) return;
  const s = document.createElement('script');
  s.async = true;
  s.src = src;
  document.head.appendChild(s);
}

let carregados = false;

/** Liga os pixels configurados. Seguro chamar mais de uma vez. */
export function carregarPixels(): void {
  if (carregados || !TEM_PIXEL || lerConsentimento() !== 'sim') return;
  carregados = true;
  const w = window as Janela;

  if (PIXELS.meta) {
    if (!w.fbq) {
      const fbq: Fbq = (...args: unknown[]) => {
        if (fbq.callMethod) fbq.callMethod(...args);
        else fbq.queue!.push(args);
      };
      fbq.queue = [];
      Object.assign(fbq, { loaded: true, version: '2.0', push: fbq });
      w.fbq = fbq;
      w._fbq = fbq;
      script('https://connect.facebook.net/en_US/fbevents.js');
    }
    w.fbq('init', PIXELS.meta);
    w.fbq('track', 'PageView');
  }

  const tagGoogle = PIXELS.ga4 || PIXELS.googleAds;
  if (tagGoogle) {
    w.dataLayer = w.dataLayer ?? [];
    w.gtag = function gtag() {
      // gtag exige o objeto "arguments", nao um array
      // eslint-disable-next-line prefer-rest-params
      w.dataLayer!.push(arguments);
    };
    w.gtag('js', new Date());
    if (PIXELS.ga4) w.gtag('config', PIXELS.ga4);
    if (PIXELS.googleAds) w.gtag('config', PIXELS.googleAds);
    script(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(tagGoogle)}`);
  }
}

/**
 * O clique no "Fale com o dono" e a conversao do anuncio. O codigo de
 * rastreio vai junto como id do evento, o mesmo que chega ao CRM.
 */
export function avisarContato(trackingId: string, origem: string): void {
  if (!carregados) return;
  const w = window as Janela;
  w.fbq?.('track', 'Contact', { content_name: 'franquia', content_category: origem }, { eventID: trackingId });
  if (w.gtag) {
    if (PIXELS.ga4) w.gtag('event', 'generate_lead', { method: 'whatsapp', origem });
    if (PIXELS.googleAds && PIXELS.googleAdsRotulo) {
      w.gtag('event', 'conversion', {
        send_to: `${PIXELS.googleAds}/${PIXELS.googleAdsRotulo}`,
        transaction_id: trackingId,
      });
    }
  }
}

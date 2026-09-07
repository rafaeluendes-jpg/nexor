import type { AttributionPayload } from './schema';

const STORAGE_KEY = 'jolo.attribution.v1';
const TRACKING_KEY = 'jolo.tracking_id';

export interface StoredAttribution {
  trackingId: string;
  sessionId: string;
  first: TouchData;
  last: TouchData;
  fbclid?: string;
  gclid?: string;
  referrer?: string;
  landingPage?: string;
  firstSeenAt: string;
}

export interface TouchData {
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
  term?: string;
  at: string;
}

function readParams(search: string): TouchData {
  const p = new URLSearchParams(search);
  return {
    source: p.get('utm_source') ?? undefined,
    medium: p.get('utm_medium') ?? undefined,
    campaign: p.get('utm_campaign') ?? undefined,
    content: p.get('utm_content') ?? undefined,
    term: p.get('utm_term') ?? undefined,
    at: new Date().toISOString(),
  };
}

function hasTouch(t: TouchData): boolean {
  return Boolean(t.source || t.medium || t.campaign || t.content || t.term);
}

function randomId(): string {
  const bytes = new Uint8Array(16);
  (globalThis.crypto ?? ({} as Crypto)).getRandomValues?.(bytes);
  return `jl_${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('').slice(0, 22)}`;
}

/**
 * Guarda a origem do visitante. O first-touch NUNCA e sobrescrito (item 15):
 * quem trouxe o lead pela primeira vez continua levando o credito.
 */
export function captureAttribution(win: Window = window): StoredAttribution {
  const agora = new Date().toISOString();
  const atual = readParams(win.location.search);
  let stored: StoredAttribution | null = null;

  try {
    const raw = win.localStorage.getItem(STORAGE_KEY);
    if (raw) stored = JSON.parse(raw) as StoredAttribution;
  } catch {
    stored = null;
  }

  const params = new URLSearchParams(win.location.search);
  const fbclid = params.get('fbclid') ?? stored?.fbclid ?? undefined;
  const gclid = params.get('gclid') ?? stored?.gclid ?? undefined;

  const dados: StoredAttribution = stored
    ? {
        ...stored,
        // first-touch preservado; last-touch so muda quando ha nova origem
        last: hasTouch(atual) ? atual : stored.last,
        fbclid,
        gclid,
      }
    : {
        trackingId: randomId(),
        sessionId: randomId(),
        first: atual,
        last: atual,
        fbclid,
        gclid,
        referrer: win.document.referrer || undefined,
        landingPage: `${win.location.origin}${win.location.pathname}`,
        firstSeenAt: agora,
      };

  try {
    win.localStorage.setItem(STORAGE_KEY, JSON.stringify(dados));
    win.localStorage.setItem(TRACKING_KEY, dados.trackingId);
  } catch {
    /* navegador sem storage: seguimos so em memoria */
  }
  return dados;
}

/** Converte o que esta guardado no formato que a API recebe. */
export function toPayload(stored: StoredAttribution): AttributionPayload {
  return {
    trackingId: stored.trackingId,
    sessionId: stored.sessionId,
    utmSource: stored.first.source,
    utmMedium: stored.first.medium,
    utmCampaign: stored.first.campaign,
    utmContent: stored.first.content,
    utmTerm: stored.first.term,
    fbclid: stored.fbclid,
    gclid: stored.gclid,
    referrer: stored.referrer,
    landingPage: stored.landingPage,
    clickedAt: new Date().toISOString(),
  };
}

/** Texto curto anexado a mensagem do WhatsApp para casar o lead com a campanha. */
export function trackingSuffix(stored: StoredAttribution): string {
  return `[ref: ${stored.trackingId}]`;
}

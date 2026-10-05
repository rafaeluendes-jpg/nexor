import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@jolo/database';
import type { MetaReferral } from '@jolo/whatsapp';

/** Instagram ou Facebook, pelo link do anuncio/post que a Meta manda junto. */
export function redeDoAnuncio(referral: MetaReferral): 'instagram' | 'facebook' {
  return /instagram\.com/i.test(referral.source_url ?? '') ? 'instagram' : 'facebook';
}

/**
 * Lead que chegou por anuncio "clique para o WhatsApp" nao passou pela
 * landing, entao nao tem codigo de rastreio. Cria a origem dele a partir
 * do que a Meta informa: rede, se foi anuncio pago ou post, e o titulo.
 */
export async function origemDoAnuncio(
  prisma: PrismaClient,
  organizationId: string,
  referral: MetaReferral,
): Promise<string> {
  const fonte = redeDoAnuncio(referral);
  const meio = referral.source_type === 'ad' ? 'cpc' : 'social';
  const anuncio = (referral.headline || (referral.source_id ? `anuncio ${referral.source_id}` : undefined))?.slice(0, 160);

  await prisma.adSource.upsert({
    where: { key: fonte },
    create: { key: fonte, name: fonte },
    update: {},
  });

  const sessao = await prisma.attributionSession.create({
    data: {
      organizationId,
      trackingId: `wa_${randomUUID().replace(/-/g, '').slice(0, 22)}`,
      firstTouchSource: fonte,
      firstTouchMedium: meio,
      firstTouchContent: anuncio,
      firstTouchTerm: referral.source_id?.slice(0, 160),
      lastTouchSource: fonte,
      lastTouchMedium: meio,
      lastTouchContent: anuncio,
      lastTouchTerm: referral.source_id?.slice(0, 160),
      ctwaClid: referral.ctwa_clid,
      landingPage: referral.source_url?.slice(0, 500),
    },
  });
  return sessao.id;
}

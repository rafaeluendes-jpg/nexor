import { Injectable } from '@nestjs/common';
import type { AttributionPayload } from '@jolo/attribution';
import { hashIp } from '@jolo/security';
import { PrismaService } from '../../common/prisma.service.js';

@Injectable()
export class AttributionService {
  constructor(private readonly prisma: PrismaService) {}

  /** Organizacao unica da Fase 1. Multi-org ja esta no banco para o futuro. */
  async defaultOrganizationId(): Promise<string> {
    const org = await this.prisma.client.organization.findFirst({ orderBy: { createdAt: 'asc' } });
    if (!org) throw new Error('Nenhuma organizacao cadastrada. Rode o seed.');
    return org.id;
  }

  /**
   * Guarda o clique antes de abrir o WhatsApp (item 9).
   * First-touch nunca e sobrescrito; last-touch e atualizado a cada visita nova.
   */
  async registerClick(payload: AttributionPayload, meta: { ip?: string; userAgent?: string }) {
    const organizationId = await this.defaultOrganizationId();
    const ipHash = meta.ip ? await hashIp(meta.ip, 'jolo-attribution') : undefined;

    const existente = await this.prisma.client.attributionSession.findUnique({
      where: { trackingId: payload.trackingId },
    });

    // A origem (instagram, google, ...) vira registro proprio para o relatorio do item 30.
    const fonte = payload.utmSource
      ? await this.prisma.client.adSource.upsert({
          where: { key: payload.utmSource.toLowerCase() },
          create: { key: payload.utmSource.toLowerCase(), name: payload.utmSource },
          update: {},
        })
      : null;

    const campanha = payload.utmCampaign
      ? await this.prisma.client.campaign.upsert({
          where: { organizationId_name: { organizationId, name: payload.utmCampaign } },
          create: { organizationId, name: payload.utmCampaign, sourceId: fonte?.id ?? null },
          update: fonte ? { sourceId: fonte.id } : {},
        })
      : null;

    if (existente) {
      return this.prisma.client.attributionSession.update({
        where: { id: existente.id },
        data: {
          lastTouchSource: payload.utmSource ?? existente.lastTouchSource,
          lastTouchMedium: payload.utmMedium ?? existente.lastTouchMedium,
          lastTouchCampaign: payload.utmCampaign ?? existente.lastTouchCampaign,
          lastTouchContent: payload.utmContent ?? existente.lastTouchContent,
          lastTouchTerm: payload.utmTerm ?? existente.lastTouchTerm,
          fbclid: payload.fbclid ?? existente.fbclid,
          gclid: payload.gclid ?? existente.gclid,
          campaignId: campanha?.id ?? existente.campaignId,
        },
      });
    }

    return this.prisma.client.attributionSession.create({
      data: {
        organizationId,
        trackingId: payload.trackingId,
        sessionId: payload.sessionId,
        firstTouchSource: payload.utmSource,
        firstTouchMedium: payload.utmMedium,
        firstTouchCampaign: payload.utmCampaign,
        firstTouchContent: payload.utmContent,
        firstTouchTerm: payload.utmTerm,
        lastTouchSource: payload.utmSource,
        lastTouchMedium: payload.utmMedium,
        lastTouchCampaign: payload.utmCampaign,
        lastTouchContent: payload.utmContent,
        lastTouchTerm: payload.utmTerm,
        fbclid: payload.fbclid,
        gclid: payload.gclid,
        referrer: payload.referrer,
        landingPage: payload.landingPage,
        userAgent: meta.userAgent?.slice(0, 300),
        ipHash,
        campaignId: campanha?.id,
      },
    });
  }

  /** Liga a conversa do WhatsApp ao clique que a originou. */
  async findByTrackingId(trackingId: string) {
    return this.prisma.client.attributionSession.findUnique({ where: { trackingId } });
  }

  async findByCtwaClid(ctwaClid: string) {
    return this.prisma.client.attributionSession.findFirst({ where: { ctwaClid } });
  }
}

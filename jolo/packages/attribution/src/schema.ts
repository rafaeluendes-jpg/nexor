import { z } from 'zod';

/** Dados de origem coletados na landing e enviados a API antes de abrir o WhatsApp. */
export const attributionPayloadSchema = z.object({
  trackingId: z.string().min(8).max(64),
  sessionId: z.string().max(64).optional(),
  utmSource: z.string().max(120).optional(),
  utmMedium: z.string().max(120).optional(),
  utmCampaign: z.string().max(160).optional(),
  utmContent: z.string().max(160).optional(),
  utmTerm: z.string().max(160).optional(),
  fbclid: z.string().max(255).optional(),
  gclid: z.string().max(255).optional(),
  referrer: z.string().max(500).optional(),
  landingPage: z.string().max(500).optional(),
  clickedAt: z.string().datetime().optional(),
});

export type AttributionPayload = z.infer<typeof attributionPayloadSchema>;

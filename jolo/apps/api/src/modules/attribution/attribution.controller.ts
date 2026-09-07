import { Body, Controller, Post, Req } from '@nestjs/common';
import { attributionPayloadSchema, type AttributionPayload } from '@jolo/attribution';
import { Public, RateLimit } from '../../common/decorators/index.js';
import { ZodValidationPipe } from '../../common/pipes/zod.pipe.js';
import { AttributionService } from './attribution.service.js';

@Controller('attribution')
export class AttributionController {
  constructor(private readonly service: AttributionService) {}

  /** Chamado pela landing no clique de "Fale com o dono", antes de abrir o WhatsApp. */
  @Public()
  @RateLimit('attribution')
  @Post('click')
  async click(
    @Body(new ZodValidationPipe(attributionPayloadSchema)) body: AttributionPayload,
    @Req() req: { ip?: string; headers: Record<string, string> },
  ) {
    const sessao = await this.service.registerClick(body, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    return { ok: true, trackingId: sessao.trackingId };
  }
}

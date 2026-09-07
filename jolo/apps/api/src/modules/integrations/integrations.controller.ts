import { Controller, Get } from '@nestjs/common';
import { aiConfigured, loadServerEnv, whatsappConfigured } from '@jolo/config/server';
import { CurrentUser, RequirePermission, type AuthenticatedUser } from '../../common/decorators/index.js';
import { PrismaService } from '../../common/prisma.service.js';

/** Diz o que esta ligado e o que ainda depende do operador. NUNCA mostra o valor do segredo. */
@Controller('integrations')
export class IntegrationsController {
  private readonly env = loadServerEnv();

  constructor(private readonly prisma: PrismaService) {}

  @RequirePermission('crm.integrations.view')
  @Get()
  async status(@CurrentUser() user: AuthenticatedUser) {
    const [ultimoEvento, recusados, mensagens24h] = await Promise.all([
      this.prisma.client.webhookEvent.findFirst({
        where: { provider: 'meta_whatsapp', status: { not: 'rejected' } },
        orderBy: { receivedAt: 'desc' },
        select: { receivedAt: true, status: true },
      }),
      this.prisma.client.webhookEvent.count({
        where: { status: 'rejected', receivedAt: { gte: new Date(Date.now() - 86_400_000) } },
      }),
      this.prisma.client.message.count({
        where: { organizationId: user.organizationId, createdAt: { gte: new Date(Date.now() - 86_400_000) } },
      }),
    ]);

    const meta = whatsappConfigured(this.env);
    return {
      whatsapp: {
        configurado: meta,
        // presenca da credencial, nunca o valor dela
        credenciais: {
          appId: Boolean(this.env.META_APP_ID),
          appSecret: Boolean(this.env.META_APP_SECRET),
          token: Boolean(this.env.META_WHATSAPP_ACCESS_TOKEN),
          numeroId: Boolean(this.env.META_WHATSAPP_PHONE_NUMBER_ID),
          contaComercialId: Boolean(this.env.META_WHATSAPP_BUSINESS_ACCOUNT_ID),
          tokenDoWebhook: Boolean(this.env.META_WEBHOOK_VERIFY_TOKEN),
        },
        versaoDaApi: this.env.META_GRAPH_VERSION,
        ultimoEventoRecebido: ultimoEvento?.receivedAt ?? null,
        eventosRecusados24h: recusados,
        mensagens24h,
        pendencia: meta ? null : 'Falta credencial da Meta. Veja docs/WHATSAPP_SETUP.md.',
      },
      ia: {
        configurada: aiConfigured(this.env),
        provedor: this.env.AI_PROVIDER,
        modelo: this.env.AI_MODEL,
        pendencia: aiConfigured(this.env) ? null : 'Sem chave do provedor: cada mensagem vira tarefa para uma pessoa.',
      },
      autenticacao: {
        provedor: this.env.AUTH_PROVIDER,
        supabaseConfigurado: Boolean(this.env.SUPABASE_URL && this.env.SUPABASE_SERVICE_ROLE_KEY),
        pendencia:
          this.env.AUTH_PROVIDER === 'supabase' ? null : 'Em producao a senha precisa viver no Supabase Auth.',
      },
      armazenamento: { provedor: this.env.STORAGE_PROVIDER },
    };
  }
}

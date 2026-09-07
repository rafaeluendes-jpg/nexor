import { Controller, Get, Param, Query } from '@nestjs/common';
import { NotFoundError, formatPhoneBR } from '@jolo/shared';
import { CurrentUser, RequirePermission, type AuthenticatedUser } from '../../common/decorators/index.js';
import { PrismaService } from '../../common/prisma.service.js';

@Controller('contacts')
export class ContactsController {
  constructor(private readonly prisma: PrismaService) {}

  @RequirePermission('crm.leads.view')
  @Get()
  async list(@CurrentUser() user: AuthenticatedUser, @Query() q: Record<string, string | undefined>) {
    const busca = q.busca?.trim();
    const where = {
      organizationId: user.organizationId,
      ...(busca
        ? {
            OR: [
              { name: { contains: busca, mode: 'insensitive' as const } },
              // busca por telefone ignora mascara: quem digita "(17) 9..." tem de achar
              { phoneE164: { contains: busca.replace(/\D+/g, '') } },
            ],
          }
        : {}),
    };

    const [total, contatos] = await Promise.all([
      this.prisma.client.contact.count({ where }),
      this.prisma.client.contact.findMany({
        where,
        include: {
          leads: {
            select: { id: true, score: true, temperature: true, stage: { select: { name: true } } },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: Math.min(Number(q.take ?? 100), 300),
        skip: Number(q.skip ?? 0),
      }),
    ]);

    return {
      total,
      itens: contatos.map((c) => ({
        id: c.id,
        nome: c.name ?? 'sem nome',
        telefone: formatPhoneBR(c.phoneE164),
        telefoneE164: c.phoneE164,
        email: c.email,
        cidade: c.city,
        criadoEm: c.createdAt,
        lead: c.leads[0]
          ? {
              id: c.leads[0].id,
              etapa: c.leads[0].stage.name,
              score: c.leads[0].score,
              temperatura: c.leads[0].temperature,
            }
          : null,
      })),
    };
  }

  @RequirePermission('crm.leads.view')
  @Get(':id')
  async detalhe(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    const contato = await this.prisma.client.contact.findFirst({
      where: { id, organizationId: user.organizationId },
      include: {
        leads: {
          include: { stage: { select: { key: true, name: true } }, owner: { select: { name: true } } },
          orderBy: { createdAt: 'desc' },
        },
        conversations: { select: { id: true, mode: true, lastMessageAt: true }, orderBy: { lastMessageAt: 'desc' } },
      },
    });
    if (!contato) throw new NotFoundError('Contato nao encontrado.');

    return {
      id: contato.id,
      nome: contato.name ?? 'sem nome',
      telefone: formatPhoneBR(contato.phoneE164),
      email: contato.email,
      cidade: contato.city,
      estado: contato.state,
      whatsappId: contato.whatsappId,
      criadoEm: contato.createdAt,
      leads: contato.leads.map((l) => ({
        id: l.id,
        etapa: l.stage.name,
        status: l.status,
        score: l.score,
        temperatura: l.temperature,
        responsavel: l.owner?.name ?? null,
        criadoEm: l.createdAt,
      })),
      conversas: contato.conversations.map((c) => ({ id: c.id, modo: c.mode, ultimaMensagem: c.lastMessageAt })),
    };
  }
}

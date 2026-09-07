import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { z } from 'zod';
import { NotFoundError } from '@jolo/shared';
import { writeAudit } from '@jolo/crm-core';
import { loadServerEnv, whatsappConfigured } from '@jolo/config/server';
import { CurrentUser, RequirePermission, type AuthenticatedUser } from '../../common/decorators/index.js';
import { ZodValidationPipe } from '../../common/pipes/zod.pipe.js';
import { PrismaService } from '../../common/prisma.service.js';

const criarSchema = z.object({
  nome: z
    .string()
    .min(3)
    .max(60)
    // a Meta so aceita minusculas, numeros e sublinhado
    .regex(/^[a-z0-9_]+$/, 'Use apenas letras minusculas, numeros e sublinhado.'),
  categoria: z.enum(['MARKETING', 'UTILITY', 'AUTHENTICATION']),
  idioma: z.string().min(2).max(10).optional(),
  texto: z.string().min(10).max(1024),
});

/** Linha de modelo como ela sai do banco. Anotada porque o tipo do Prisma nao atravessa o workspace. */
interface ModeloSalvo {
  id: string;
  name: string;
  category: string;
  language: string;
  bodyText: string;
  metaStatus: string;
  active: boolean;
}

/** Conta as variaveis {{1}}, {{2}}... que o modelo usa. */
function variaveisDe(texto: string): number[] {
  const achadas = new Set<number>();
  for (const m of texto.matchAll(/\{\{\s*(\d+)\s*\}\}/g)) achadas.add(Number(m[1]));
  return [...achadas].sort((a, b) => a - b);
}

@Controller('templates')
export class TemplatesController {
  private readonly env = loadServerEnv();

  constructor(private readonly prisma: PrismaService) {}

  @RequirePermission('crm.integrations.view')
  @Get()
  async list() {
    const modelos = await this.prisma.client.whatsappTemplate.findMany({ orderBy: { name: 'asc' } });
    return {
      // sem credencial da Meta nenhum modelo sai do "pendente": e a Meta que aprova
      integracaoConfigurada: whatsappConfigured(this.env),
      itens: modelos.map((m) => ({
        id: m.id,
        nome: m.name,
        categoria: m.category,
        idioma: m.language,
        texto: m.bodyText,
        variaveis: variaveisDe(m.bodyText),
        statusNaMeta: m.metaStatus,
        ativo: m.active,
      })),
    };
  }

  @RequirePermission('crm.integrations.edit')
  @Post()
  async criar(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(criarSchema)) body: z.infer<typeof criarSchema>,
  ): Promise<ModeloSalvo & { aviso: string }> {
    const modelo = await this.prisma.client.whatsappTemplate.create({
      data: {
        name: body.nome,
        category: body.categoria,
        language: body.idioma ?? 'pt_BR',
        bodyText: body.texto,
        variables: variaveisDe(body.texto),
        // Quem aprova e a Meta, no painel dela. Aqui so guardamos o texto.
        metaStatus: 'PENDING',
      },
    });
    await writeAudit(this.prisma.client, {
      organizationId: user.organizationId,
      actorUserId: user.id,
      actorType: 'USER',
      event: 'template.create',
      entity: 'WhatsappTemplate',
      entityId: modelo.id,
      after: { name: modelo.name },
    });
    return {
      ...modelo,
      aviso: 'Cadastre este mesmo modelo, com o mesmo nome, no painel da Meta. So depois de aprovado ele envia.',
    };
  }

  @RequirePermission('crm.integrations.edit')
  @Patch(':id')
  async atualizar(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(z.object({ ativo: z.boolean().optional(), statusNaMeta: z.string().optional() })))
    body: { ativo?: boolean; statusNaMeta?: string },
  ): Promise<ModeloSalvo> {
    const atual = await this.prisma.client.whatsappTemplate.findUnique({ where: { id } });
    if (!atual) throw new NotFoundError('Modelo nao encontrado.');

    const modelo = await this.prisma.client.whatsappTemplate.update({
      where: { id },
      data: {
        ...(body.ativo !== undefined ? { active: body.ativo } : {}),
        ...(body.statusNaMeta ? { metaStatus: body.statusNaMeta } : {}),
      },
    });
    await writeAudit(this.prisma.client, {
      organizationId: user.organizationId,
      actorUserId: user.id,
      actorType: 'USER',
      event: 'template.update',
      entity: 'WhatsappTemplate',
      entityId: id,
      before: { active: atual.active, metaStatus: atual.metaStatus },
      after: { active: modelo.active, metaStatus: modelo.metaStatus },
    });
    return modelo;
  }
}

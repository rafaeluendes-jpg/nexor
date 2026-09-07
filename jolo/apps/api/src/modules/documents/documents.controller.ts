import { Controller, Delete, Get, Param, Post, Query, Req, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { DomainError } from '@jolo/shared';
import { CurrentUser, RequirePermission, type AuthenticatedUser } from '../../common/decorators/index.js';
import { CATEGORIAS, DocumentsService } from './documents.service.js';

/** Requisicao com o multipart do Fastify ja registrado. */
interface RequisicaoComArquivo {
  isMultipart?: () => boolean;
  file?: () => Promise<{
    filename: string;
    mimetype: string;
    toBuffer: () => Promise<Buffer>;
    fields: Record<string, { value?: string } | undefined>;
  } | undefined>;
}

@Controller('documents')
export class DocumentsController {
  constructor(private readonly service: DocumentsService) {}

  @RequirePermission('crm.documents.view')
  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query() q: Record<string, string | undefined>) {
    return this.service.list(user, { leadId: q.lead, cofId: q.cof, categoria: q.categoria });
  }

  @RequirePermission('crm.documents.view')
  @Get('categorias')
  categorias() {
    return { categorias: CATEGORIAS };
  }

  @RequirePermission('crm.documents.upload')
  @Post()
  async upload(@CurrentUser() user: AuthenticatedUser, @Req() req: RequisicaoComArquivo) {
    if (!req.isMultipart?.()) {
      throw new DomainError('Envie o arquivo como multipart/form-data.', 'VALIDATION_ERROR', 422);
    }
    const parte = await req.file?.();
    if (!parte) throw new DomainError('Nenhum arquivo recebido.', 'VALIDATION_ERROR', 422);

    const campo = (nome: string): string | undefined => parte.fields?.[nome]?.value;
    const categoria = campo('categoria') ?? 'OUTRO';
    if (!(CATEGORIAS as readonly string[]).includes(categoria)) {
      throw new DomainError(`Categoria invalida. Use uma de: ${CATEGORIAS.join(', ')}.`, 'VALIDATION_ERROR', 422);
    }

    return this.service.guardar(
      user,
      { nome: parte.filename, tipo: parte.mimetype, conteudo: await parte.toBuffer() },
      { categoria, leadId: campo('leadId'), cofId: campo('cofId') },
    );
  }

  /** O arquivo nunca e servido como estatico: sai por aqui, com permissao conferida. */
  @RequirePermission('crm.documents.view')
  @Get(':id/arquivo')
  async baixar(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Res() res: FastifyReply) {
    const arquivo = await this.service.baixar(user, id);
    res
      .header('content-type', arquivo.tipo)
      .header('content-disposition', `attachment; filename="${encodeURIComponent(arquivo.nome)}"`)
      .header('cache-control', 'private, no-store')
      .send(arquivo.conteudo);
  }

  @RequirePermission('crm.documents.upload')
  @Delete(':id')
  apagar(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.apagar(user, id);
  }
}

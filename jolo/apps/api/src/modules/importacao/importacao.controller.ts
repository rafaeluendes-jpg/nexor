import { Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import { DomainError } from '@jolo/shared';
import { CurrentUser, RequirePermission, type AuthenticatedUser } from '../../common/decorators/index.js';
import { ImportacaoService } from './importacao.service.js';

interface RequisicaoComArquivo {
  isMultipart?: () => boolean;
  file?: () => Promise<{
    filename: string;
    toBuffer: () => Promise<Buffer>;
    fields: Record<string, { value?: string } | undefined>;
  } | undefined>;
}

/** Importacao de leads antigos que estao em planilha. */
@Controller('import')
export class ImportacaoController {
  constructor(private readonly service: ImportacaoService) {}

  @RequirePermission('crm.leads.view')
  @Get()
  listar(@CurrentUser() user: AuthenticatedUser) {
    return this.service.listar(user);
  }

  /** Passo 1: mostra o que vai acontecer. Nao grava nada. */
  @RequirePermission('crm.leads.create')
  @HttpCode(200)
  @Post('conferir')
  async conferir(@CurrentUser() user: AuthenticatedUser, @Req() req: RequisicaoComArquivo) {
    const parte = await this.receber(req);
    return this.service.conferir(user, parte.arquivo);
  }

  /** Passo 2: grava, depois de o operador ver a conferencia. */
  @RequirePermission('crm.leads.create')
  @HttpCode(200)
  @Post('confirmar')
  async confirmar(@CurrentUser() user: AuthenticatedUser, @Req() req: RequisicaoComArquivo) {
    const parte = await this.receber(req);
    const rotulo = (parte.campos.rotulo ?? '').trim();
    if (rotulo.length < 3) {
      throw new DomainError('Dê um nome ao lote (ex.: "Base 2024"). Ele vira a origem dos leads.', 'VALIDATION_ERROR', 422);
    }
    return this.service.importar(user, parte.arquivo, rotulo.slice(0, 80));
  }

  private async receber(req: RequisicaoComArquivo): Promise<{
    arquivo: { nome: string; conteudo: Buffer };
    campos: Record<string, string | undefined>;
  }> {
    if (!req.isMultipart?.()) {
      throw new DomainError('Envie a planilha como arquivo.', 'VALIDATION_ERROR', 422);
    }
    const parte = await req.file?.();
    if (!parte) throw new DomainError('Nenhum arquivo recebido.', 'VALIDATION_ERROR', 422);

    const campos: Record<string, string | undefined> = {};
    for (const [chave, valor] of Object.entries(parte.fields ?? {})) {
      campos[chave] = valor?.value;
    }
    return { arquivo: { nome: parte.filename, conteudo: await parte.toBuffer() }, campos };
  }
}

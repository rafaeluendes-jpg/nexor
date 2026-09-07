import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { DomainError, NotFoundError, phoneMatchKeys } from '@jolo/shared';
import {
  lerCsv,
  lerPlanilha,
  writeActivity,
  writeAudit,
  type LeituraDaPlanilha,
  type LinhaLida,
} from '@jolo/crm-core';
import { PrismaService } from '../../common/prisma.service.js';
import type { AuthenticatedUser } from '../../common/decorators/index.js';

/** Limite de linhas por arquivo. Acima disso, peca para dividir a planilha. */
export const MAXIMO_DE_LINHAS = 5000;

@Injectable()
export class ImportacaoService {
  constructor(private readonly prisma: PrismaService) {}

  /** Le o arquivo e devolve o que ACONTECERIA. Nada e gravado aqui. */
  async conferir(
    user: AuthenticatedUser,
    arquivo: { nome: string; conteudo: Buffer },
  ): Promise<LeituraDaPlanilha & { arquivo: string; totalDeLinhas: number }> {
    const { cabecalho, linhas } = await this.abrir(arquivo);

    if (!linhas.length) throw new DomainError('A planilha nao tem nenhuma linha de dados.', 'VALIDATION_ERROR', 422);
    if (linhas.length > MAXIMO_DE_LINHAS) {
      throw new DomainError(
        `A planilha tem ${linhas.length} linhas. O limite por arquivo e ${MAXIMO_DE_LINHAS}; divida em partes.`,
        'VALIDATION_ERROR',
        422,
      );
    }

    const leitura = lerPlanilha(cabecalho, linhas, await this.telefonesConhecidos(user.organizationId));
    if (!leitura.colunasEncontradas.telefone) {
      throw new DomainError(
        'Nao encontrei a coluna de telefone. Renomeie a coluna para "telefone", "celular" ou "whatsapp".',
        'VALIDATION_ERROR',
        422,
      );
    }

    return { ...leitura, arquivo: arquivo.nome, totalDeLinhas: linhas.length };
  }

  /**
   * Grava de verdade. So entram as linhas marcadas como "novo":
   * repetido, ja existente e telefone invalido ficam de fora, sempre.
   */
  async importar(
    user: AuthenticatedUser,
    arquivo: { nome: string; conteudo: Buffer },
    rotulo: string,
  ): Promise<{ loteId: string; importados: number; ignorados: Record<string, number> }> {
    const leitura = await this.conferir(user, arquivo);
    const aImportar = leitura.linhas.filter((l) => l.situacao === 'novo');

    if (!aImportar.length) {
      throw new DomainError(
        'Nenhuma linha nova para importar: todos os telefones ja estao no sistema ou sao invalidos.',
        'VALIDATION_ERROR',
        422,
      );
    }

    const pipeline = await this.prisma.client.pipeline.findFirstOrThrow({
      where: { organizationId: user.organizationId, isDefault: true },
      include: { stages: { orderBy: { position: 'asc' } } },
    });
    // Lead antigo nao e lead novo: entra em "Nutricao", que e onde mora quem
    // tem perfil mas nao esta em conversa agora.
    const etapa =
      pipeline.stages.find((e) => e.key === 'NUTRICAO') ?? pipeline.stages[0];
    if (!etapa) throw new NotFoundError('Funil sem etapas configuradas.');

    const lote = await this.prisma.client.importBatch.create({
      data: {
        organizationId: user.organizationId,
        importedById: user.id,
        fileName: arquivo.nome.slice(0, 200),
        label: rotulo,
        status: 'processando',
        totalRows: leitura.totalDeLinhas,
        duplicated: leitura.resumo.ja_existe + leitura.resumo.repetido_no_arquivo,
        invalid: leitura.resumo.sem_telefone + leitura.resumo.telefone_invalido,
      },
    });

    // A origem do lote e uma campanha propria, ligada a origem "base antiga":
    // assim o relatorio separa quem veio da planilha de quem chegou pela pagina.
    const origem = await this.prisma.client.adSource.upsert({
      where: { key: 'base_antiga' },
      create: { key: 'base_antiga', name: 'Base antiga (planilha)' },
      update: {},
    });
    const campanha = await this.prisma.client.campaign.upsert({
      where: { organizationId_name: { organizationId: user.organizationId, name: rotulo } },
      create: { organizationId: user.organizationId, name: rotulo, sourceId: origem.id },
      update: { sourceId: origem.id },
    });

    let importados = 0;
    for (const linha of aImportar) {
      if (!linha.telefone) continue;
      await this.criarUm(user, linha, lote.id, pipeline.id, etapa.id, campanha.id, rotulo);
      importados += 1;
    }

    await this.prisma.client.importBatch.update({
      where: { id: lote.id },
      data: { status: 'concluido', imported: importados, finishedAt: new Date() },
    });

    await writeAudit(this.prisma.client, {
      organizationId: user.organizationId,
      actorUserId: user.id,
      actorType: 'USER',
      event: 'import.leads',
      entity: 'ImportBatch',
      entityId: lote.id,
      after: { arquivo: arquivo.nome, rotulo, importados, total: leitura.totalDeLinhas },
    });

    return {
      loteId: lote.id,
      importados,
      ignorados: {
        jaExistiam: leitura.resumo.ja_existe,
        repetidosNoArquivo: leitura.resumo.repetido_no_arquivo,
        semTelefone: leitura.resumo.sem_telefone,
        telefoneInvalido: leitura.resumo.telefone_invalido,
      },
    };
  }

  async listar(user: AuthenticatedUser) {
    const lotes = await this.prisma.client.importBatch.findMany({
      where: { organizationId: user.organizationId },
      include: { importedBy: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return {
      itens: lotes.map((l) => ({
        id: l.id,
        arquivo: l.fileName,
        rotulo: l.label,
        status: l.status,
        total: l.totalRows,
        importados: l.imported,
        repetidos: l.duplicated,
        invalidos: l.invalid,
        quem: l.importedBy?.name ?? null,
        quando: l.createdAt,
      })),
    };
  }

  // ---------- apoio ----------

  /** Todo telefone que o sistema ja conhece, nas duas formas (com e sem o nono digito). */
  private async telefonesConhecidos(organizationId: string): Promise<Set<string>> {
    const contatos = await this.prisma.client.contact.findMany({
      where: { organizationId },
      select: { phoneE164: true },
    });
    const conhecidos = new Set<string>();
    for (const c of contatos) for (const chave of phoneMatchKeys(c.phoneE164)) conhecidos.add(chave);
    return conhecidos;
  }

  private async abrir(arquivo: { nome: string; conteudo: Buffer }): Promise<{ cabecalho: string[]; linhas: unknown[][] }> {
    const nome = arquivo.nome.toLowerCase();

    if (nome.endsWith('.csv') || nome.endsWith('.txt')) {
      const { cabecalho, linhas } = lerCsv(arquivo.conteudo.toString('utf8'));
      return { cabecalho, linhas };
    }

    if (nome.endsWith('.xlsx') || nome.endsWith('.xlsm')) {
      const pasta = new ExcelJS.Workbook();
      await pasta.xlsx.load(arquivo.conteudo as unknown as ArrayBuffer);
      const aba = pasta.worksheets[0];
      if (!aba) throw new DomainError('A planilha esta vazia.', 'VALIDATION_ERROR', 422);

      const linhas: unknown[][] = [];
      aba.eachRow({ includeEmpty: false }, (linha) => {
        const valores: unknown[] = [];
        linha.eachCell({ includeEmpty: true }, (celula, coluna) => {
          const v = celula.value;
          // celula com formula ou link guarda um objeto; queremos o texto
          valores[coluna - 1] =
            v && typeof v === 'object'
              ? ((v as { text?: string; result?: unknown }).text ??
                 (v as { result?: unknown }).result ??
                 String(v))
              : v;
        });
        linhas.push(valores);
      });

      const cabecalho = (linhas.shift() ?? []).map((c) => String(c ?? '').trim());
      return { cabecalho, linhas };
    }

    throw new DomainError('Envie a planilha em .xlsx ou .csv.', 'VALIDATION_ERROR', 422);
  }

  private async criarUm(
    user: AuthenticatedUser,
    linha: LinhaLida,
    loteId: string,
    pipelineId: string,
    stageId: string,
    campaignId: string,
    rotulo: string,
  ): Promise<void> {
    const atribuicao = await this.prisma.client.attributionSession.create({
      data: {
        organizationId: user.organizationId,
        trackingId: `jl_imp_${loteId.slice(0, 8)}_${linha.linha}`,
        firstTouchSource: 'base_antiga',
        firstTouchMedium: 'importacao',
        firstTouchCampaign: rotulo,
        campaignId,
      },
    });

    const contato = await this.prisma.client.contact.create({
      data: {
        organizationId: user.organizationId,
        name: linha.nome,
        phoneE164: linha.telefone!,
        phoneRaw: linha.telefoneOriginal,
        email: linha.email,
        city: linha.cidade,
        state: linha.estado,
      },
    });

    const lead = await this.prisma.client.lead.create({
      data: {
        organizationId: user.organizationId,
        contactId: contato.id,
        pipelineId,
        stageId,
        attributionId: atribuicao.id,
        importBatchId: loteId,
        desiredCity: linha.cidade,
        desiredState: linha.estado,
        status: 'ABERTO',
      },
    });

    await this.prisma.client.pipelineStageHistory.create({
      data: { leadId: lead.id, toStageId: stageId, source: 'API', reason: `Importado de ${rotulo}` },
    });

    await writeActivity(this.prisma.client, {
      organizationId: user.organizationId,
      leadId: lead.id,
      userId: user.id,
      type: 'importacao',
      title: `Trazido da planilha "${rotulo}"`,
      description: linha.observacao ?? undefined,
    });

    if (linha.observacao) {
      await this.prisma.client.note.create({
        data: {
          organizationId: user.organizationId,
          leadId: lead.id,
          authorId: user.id,
          body: `Anotação da planilha: ${linha.observacao}`,
        },
      });
    }
  }
}

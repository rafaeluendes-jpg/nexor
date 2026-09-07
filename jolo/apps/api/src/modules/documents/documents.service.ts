import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { Injectable } from '@nestjs/common';
import { DomainError, NotFoundError } from '@jolo/shared';
import { loadServerEnv } from '@jolo/config/server';
import { writeActivity, writeAudit } from '@jolo/crm-core';
import { PrismaService } from '../../common/prisma.service.js';
import type { AuthenticatedUser } from '../../common/decorators/index.js';

/** Tipos aceitos. Lista fechada: o que nao esta aqui nao entra. */
const TIPOS_ACEITOS: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
};

const TAMANHO_MAXIMO = 20 * 1024 * 1024;

export const CATEGORIAS = [
  'COF',
  'CONTRATO',
  'FICHA_QUALIFICACAO',
  'DOCUMENTO_CANDIDATO',
  'APRESENTACAO',
  'COMPROVANTE',
  'OUTRO',
] as const;

@Injectable()
export class DocumentsService {
  private readonly env = loadServerEnv();

  constructor(private readonly prisma: PrismaService) {}

  /** Pasta privada. Nada aqui e servido como arquivo estatico: so sai pela rota com permissao. */
  private pasta(): string {
    return resolve(this.env.STORAGE_LOCAL_DIR, 'documentos');
  }

  async list(user: AuthenticatedUser, f: { leadId?: string; cofId?: string; categoria?: string }) {
    const docs = await this.prisma.client.document.findMany({
      where: {
        organizationId: user.organizationId,
        ...(f.leadId ? { leadId: f.leadId } : {}),
        ...(f.cofId ? { cofProcessId: f.cofId } : {}),
        ...(f.categoria ? { kind: f.categoria } : {}),
      },
      include: {
        uploadedBy: { select: { id: true, name: true } },
        lead: { select: { id: true, contact: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 300,
    });

    return {
      itens: docs.map((d) => ({
        id: d.id,
        nome: d.fileName,
        categoria: d.kind,
        tamanhoBytes: d.sizeBytes,
        tipo: d.mimeType,
        enviadoEm: d.createdAt,
        enviadoPor: d.uploadedBy ? { id: d.uploadedBy.id, nome: d.uploadedBy.name } : null,
        lead: d.lead ? { id: d.lead.id, nome: d.lead.contact?.name ?? 'sem nome' } : null,
      })),
    };
  }

  async guardar(
    user: AuthenticatedUser,
    arquivo: { nome: string; tipo: string; conteudo: Buffer },
    dados: { categoria: string; leadId?: string; cofId?: string },
  ) {
    if (!TIPOS_ACEITOS[arquivo.tipo]) {
      throw new DomainError(
        `Tipo de arquivo nao aceito. Aceitos: PDF, JPG, PNG, DOCX e XLSX.`,
        'VALIDATION_ERROR',
        422,
      );
    }
    if (arquivo.conteudo.length > TAMANHO_MAXIMO) {
      throw new DomainError('Arquivo maior que 20 MB.', 'VALIDATION_ERROR', 422);
    }
    if (arquivo.conteudo.length === 0) {
      throw new DomainError('Arquivo vazio.', 'VALIDATION_ERROR', 422);
    }

    // Nome de arquivo escolhido por nos, nunca o que veio de fora:
    // nome de fora pode carregar caminho ("../") e escrever onde nao deve.
    const chave = join(
      user.organizationId,
      `${new Date().toISOString().slice(0, 7)}`,
      `${randomUUID()}${TIPOS_ACEITOS[arquivo.tipo]}`,
    );
    const caminho = join(this.pasta(), chave);
    await mkdir(dirname(caminho), { recursive: true });
    await writeFile(caminho, arquivo.conteudo, { mode: 0o600 });

    const doc = await this.prisma.client.document.create({
      data: {
        organizationId: user.organizationId,
        leadId: dados.leadId,
        cofProcessId: dados.cofId,
        uploadedById: user.id,
        kind: dados.categoria,
        fileName: arquivo.nome.slice(0, 200),
        mimeType: arquivo.tipo,
        sizeBytes: arquivo.conteudo.length,
        storageKey: chave,
      },
    });

    await writeAudit(this.prisma.client, {
      organizationId: user.organizationId,
      actorUserId: user.id,
      actorType: 'USER',
      event: 'document.upload',
      entity: 'Document',
      entityId: doc.id,
      after: {
        fileName: doc.fileName,
        kind: doc.kind,
        // impressao digital do conteudo: prova depois que o arquivo nao foi trocado
        sha256: createHash('sha256').update(arquivo.conteudo).digest('hex'),
      },
    });
    if (doc.leadId) {
      await writeActivity(this.prisma.client, {
        organizationId: user.organizationId,
        leadId: doc.leadId,
        userId: user.id,
        type: 'DOCUMENTO',
        title: `Documento enviado: ${doc.fileName}`,
      });
    }
    return { id: doc.id, nome: doc.fileName, categoria: doc.kind, tamanhoBytes: doc.sizeBytes };
  }

  async baixar(user: AuthenticatedUser, id: string) {
    const doc = await this.prisma.client.document.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!doc) throw new NotFoundError('Documento nao encontrado.');

    // storageKey nunca vem do usuario, mas conferimos assim mesmo que o caminho
    // resolvido continua dentro da pasta de documentos.
    const caminho = resolve(this.pasta(), doc.storageKey);
    if (!caminho.startsWith(this.pasta())) throw new NotFoundError('Documento nao encontrado.');

    const conteudo = await readFile(caminho).catch(() => null);
    if (!conteudo) throw new NotFoundError('Arquivo nao esta mais no armazenamento.');

    await writeAudit(this.prisma.client, {
      organizationId: user.organizationId,
      actorUserId: user.id,
      actorType: 'USER',
      event: 'document.download',
      entity: 'Document',
      entityId: id,
    });
    return { conteudo, nome: doc.fileName, tipo: doc.mimeType ?? 'application/octet-stream' };
  }

  async apagar(user: AuthenticatedUser, id: string) {
    const doc = await this.prisma.client.document.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!doc) throw new NotFoundError('Documento nao encontrado.');

    const caminho = resolve(this.pasta(), doc.storageKey);
    if (caminho.startsWith(this.pasta())) await unlink(caminho).catch(() => undefined);
    await this.prisma.client.document.delete({ where: { id } });

    await writeAudit(this.prisma.client, {
      organizationId: user.organizationId,
      actorUserId: user.id,
      actorType: 'USER',
      event: 'document.delete',
      entity: 'Document',
      entityId: id,
      before: { fileName: doc.fileName, kind: doc.kind },
    });
    return { ok: true };
  }
}

/** Extensao a partir do tipo, para quem precisar montar nome de arquivo. */
export function extensaoDe(nome: string): string {
  return extname(nome).toLowerCase();
}

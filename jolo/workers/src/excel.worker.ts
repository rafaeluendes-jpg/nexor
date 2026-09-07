import { Worker } from 'bullmq';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import ExcelJS from 'exceljs';
import { QUEUES, formatPhoneBR, type ExcelJob } from '@jolo/shared';
import type { WorkerContext } from './context.js';

const COLUNAS = [
  { header: 'ID', key: 'id', width: 38 },
  { header: 'Nome', key: 'nome', width: 28 },
  { header: 'Telefone', key: 'telefone', width: 20 },
  { header: 'WhatsApp ID', key: 'whatsappId', width: 18 },
  { header: 'Cidade', key: 'cidade', width: 20 },
  { header: 'UF', key: 'uf', width: 6 },
  { header: 'Cidade interesse', key: 'cidadeInteresse', width: 22 },
  { header: 'Origem', key: 'origem', width: 16 },
  { header: 'Campanha', key: 'campanha', width: 24 },
  { header: 'Anuncio', key: 'anuncio', width: 24 },
  { header: 'Criativo', key: 'criativo', width: 24 },
  { header: 'ctwa_clid', key: 'ctwaClid', width: 24 },
  { header: 'Data entrada', key: 'entrada', width: 20 },
  { header: 'Score', key: 'score', width: 8 },
  { header: 'Temperatura', key: 'temperatura', width: 14 },
  { header: 'Etapa', key: 'etapa', width: 22 },
  { header: 'Responsavel', key: 'responsavel', width: 22 },
  { header: 'Ultimo contato', key: 'ultimoContato', width: 20 },
  { header: 'Proxima acao', key: 'proximaAcao', width: 20 },
  { header: 'Status', key: 'status', width: 12 },
  { header: 'Motivo perda', key: 'motivoPerda', width: 30 },
];

/**
 * Copia operacional em Excel (itens 37 e 38). O banco continua sendo a fonte:
 * este arquivo e gerado a partir dele, com versao e escrita atomica.
 */
export function startExcelWorker(ctx: WorkerContext): Worker {
  const { prisma, logger } = ctx;
  const pasta = resolve(process.cwd(), ctx.env.EXCEL_EXPORT_PATH);

  return new Worker<ExcelJob>(
    QUEUES.EXCEL,
    async (job) => {
      // Trava simples: duas geracoes ao mesmo tempo corromperiam o arquivo.
      const lock = `jolo:excel:lock:${job.data.organizationId}`;
      const obtida = await ctx.redis.set(lock, '1', 'PX', 60_000, 'NX');
      if (!obtida) {
        await new Promise((r) => setTimeout(r, 1_500));
        throw new Error('exportacao em andamento, tentando de novo');
      }

      try {
        const leads = await prisma.lead.findMany({
          where: { organizationId: job.data.organizationId },
          include: {
            contact: true,
            stage: true,
            owner: { select: { name: true } },
            attribution: { include: { campaign: true, creative: true } },
            conversations: { include: { referral: true }, take: 1 },
          },
          orderBy: { createdAt: 'desc' },
        });

        const wb = new ExcelJS.Workbook();
        wb.creator = 'Jolo CRM';
        wb.created = new Date();
        const ws = wb.addWorksheet('Leads');
        ws.columns = COLUNAS;
        ws.getRow(1).font = { bold: true };
        ws.views = [{ state: 'frozen', ySplit: 1 }];

        for (const l of leads) {
          const referral = l.conversations[0]?.referral;
          ws.addRow({
            id: l.id,
            nome: l.contact.name ?? '',
            telefone: formatPhoneBR(l.contact.phoneE164),
            whatsappId: l.contact.whatsappId ?? '',
            cidade: l.contact.city ?? '',
            uf: l.contact.state ?? '',
            cidadeInteresse: l.desiredCity ?? '',
            origem: l.attribution?.firstTouchSource ?? 'direto',
            campanha: l.attribution?.campaign?.name ?? l.attribution?.firstTouchCampaign ?? '',
            anuncio: referral?.headline ?? '',
            criativo: l.attribution?.creative?.name ?? referral?.sourceId ?? '',
            ctwaClid: l.attribution?.ctwaClid ?? referral?.ctwaClid ?? '',
            entrada: l.createdAt,
            score: l.score,
            temperatura: l.temperature,
            etapa: l.stage.name,
            responsavel: l.owner?.name ?? '',
            ultimoContato: l.lastContactAt,
            proximaAcao: l.nextActionAt,
            status: l.status,
            motivoPerda: l.lostReason ?? '',
          });
        }

        await mkdir(pasta, { recursive: true });
        const destino = join(pasta, 'leads_master.xlsx');
        const temporario = `${destino}.tmp`;
        const buffer = await wb.xlsx.writeBuffer();
        await mkdir(dirname(destino), { recursive: true });
        await writeFile(temporario, Buffer.from(buffer));
        await rename(temporario, destino); // troca atomica: ninguem le arquivo pela metade

        if (job.data.exportId) {
          const anterior = await prisma.excelExport.findUnique({ where: { id: job.data.exportId } });
          await prisma.excelExport.update({
            where: { id: job.data.exportId },
            data: {
              status: 'done',
              rowCount: leads.length,
              storageKey: destino,
              finishedAt: new Date(),
              version: (anterior?.version ?? 0) + 1,
            },
          });
        }
        logger.info({ linhas: leads.length, destino }, 'excel atualizado');
      } finally {
        await ctx.redis.del(lock);
      }
    },
    { connection: ctx.redis, concurrency: 1 },
  );
}

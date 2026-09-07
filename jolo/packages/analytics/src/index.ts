import type { PrismaClient } from '@jolo/database';

export interface FunnelMetrics {
  leadParaReuniao: number;
  reuniaoParaCof: number;
  cofParaContrato: number;
  tempoMedioPrimeiraRespostaMin: number | null;
  tempoMedioQualificacaoHoras: number | null;
}

function pct(parte: number, total: number): number {
  return total ? Number(((parte / total) * 100).toFixed(1)) : 0;
}

/** Metricas de conversao do item 29, calculadas direto do banco. */
export async function funnelMetrics(prisma: PrismaClient, organizationId: string): Promise<FunnelMetrics> {
  const [leads, reunioes, cofs, contratos] = await Promise.all([
    prisma.lead.count({ where: { organizationId } }),
    prisma.meeting.count({ where: { organizationId } }),
    prisma.cofProcess.count({ where: { organizationId, status: { not: 'NAO_ENVIADA' } } }),
    prisma.lead.count({ where: { organizationId, status: 'GANHO' } }),
  ]);

  // Tempo entre a primeira mensagem do lead e a primeira resposta enviada.
  const conversas = await prisma.conversation.findMany({
    where: { organizationId },
    select: { messages: { orderBy: { createdAt: 'asc' }, select: { direction: true, createdAt: true } } },
    take: 500,
  });

  const esperas: number[] = [];
  for (const c of conversas) {
    const primeiraEntrada = c.messages.find((m) => m.direction === 'INBOUND');
    if (!primeiraEntrada) continue;
    const primeiraSaida = c.messages.find(
      (m) => m.direction === 'OUTBOUND' && m.createdAt > primeiraEntrada.createdAt,
    );
    if (!primeiraSaida) continue;
    esperas.push((primeiraSaida.createdAt.getTime() - primeiraEntrada.createdAt.getTime()) / 60_000);
  }

  const qualificados = await prisma.pipelineStageHistory.findMany({
    where: { toStage: { key: 'QUALIFICADO' } },
    include: { lead: { select: { createdAt: true } } },
    take: 500,
  });
  const horas = qualificados.map((h) => (h.createdAt.getTime() - h.lead.createdAt.getTime()) / 3_600_000);

  const media = (xs: number[]): number | null =>
    xs.length ? Number((xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1)) : null;

  return {
    leadParaReuniao: pct(reunioes, leads),
    reuniaoParaCof: pct(cofs, reunioes),
    cofParaContrato: pct(contratos, cofs),
    tempoMedioPrimeiraRespostaMin: media(esperas),
    tempoMedioQualificacaoHoras: media(horas),
  };
}

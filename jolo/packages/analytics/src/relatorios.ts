import type { PrismaClient } from '@jolo/database';

/** Todas as metricas do item 29, calculadas direto do banco. */
export interface Relatorio {
  periodo: { de: string; ate: string };
  totais: {
    leads: number;
    qualificados: number;
    reunioes: number;
    cofs: number;
    contratos: number;
    ganhos: number;
    perdidos: number;
    scoreMedio: number;
  };
  conversao: {
    leadParaQualificado: number;
    leadParaReuniao: number;
    reuniaoParaCof: number;
    cofParaContrato: number;
    leadParaGanho: number;
  };
  tempos: {
    primeiraRespostaMin: number | null;
    qualificacaoHoras: number | null;
    porEtapaDias: { etapa: string; mediaDias: number; leads: number }[];
  };
  porCampanha: { campanha: string; leads: number; ganhos: number; conversao: number }[];
  porOrigem: { origem: string; leads: number; ganhos: number; conversao: number }[];
  porCidade: { cidade: string; leads: number; ganhos: number; conversao: number }[];
  porResponsavel: { responsavel: string; leads: number; ganhos: number; conversao: number }[];
  leadsParados: { id: string; nome: string; etapa: string; diasParado: number }[];
  motivosDePerda: { motivo: string; quantidade: number }[];
  iaParaHumano: { total: number; porMotivo: { motivo: string; quantidade: number }[] };
}

function pct(parte: number, total: number): number {
  return total ? Number(((parte / total) * 100).toFixed(1)) : 0;
}

function media(xs: number[]): number | null {
  return xs.length ? Number((xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1)) : null;
}

/** Agrupa leads por uma chave e calcula a conversao de cada grupo. */
function agrupar<T extends { chave: string; ganho: boolean }>(linhas: T[]) {
  const mapa = new Map<string, { leads: number; ganhos: number }>();
  for (const l of linhas) {
    const atual = mapa.get(l.chave) ?? { leads: 0, ganhos: 0 };
    atual.leads += 1;
    if (l.ganho) atual.ganhos += 1;
    mapa.set(l.chave, atual);
  }
  return [...mapa.entries()]
    .map(([chave, v]) => ({ chave, leads: v.leads, ganhos: v.ganhos, conversao: pct(v.ganhos, v.leads) }))
    .sort((a, b) => b.leads - a.leads);
}

export async function gerarRelatorio(
  prisma: PrismaClient,
  organizationId: string,
  periodo: { de?: string; ate?: string } = {},
): Promise<Relatorio> {
  const de = periodo.de ? new Date(periodo.de) : new Date(Date.now() - 90 * 86_400_000);
  const ate = periodo.ate ? new Date(periodo.ate) : new Date();
  const janela = { gte: de, lte: ate };

  const leads = await prisma.lead.findMany({
    where: { organizationId, createdAt: janela },
    include: {
      stage: { select: { key: true, name: true } },
      owner: { select: { name: true } },
      attribution: { select: { firstTouchSource: true, firstTouchCampaign: true } },
    },
  });

  const ganho = (l: { status: string }) => l.status === 'GANHO';
  const totalLeads = leads.length;
  const ganhos = leads.filter(ganho).length;
  const perdidos = leads.filter((l) => l.status === 'PERDIDO').length;

  const etapasQualificadas = ['QUALIFICADO', 'REUNIAO_AGENDADA', 'APRESENTACAO_REALIZADA', 'VISITA_UNIDADE', 'COF_ENVIADA', 'PRAZO_COF', 'NEGOCIACAO', 'CONTRATO', 'GANHO'];
  const qualificados = leads.filter((l) => etapasQualificadas.includes(l.stage.key)).length;

  const [reunioes, cofs, contratos] = await Promise.all([
    prisma.meeting.count({ where: { organizationId, createdAt: janela } }),
    prisma.cofProcess.count({ where: { organizationId, createdAt: janela, status: { not: 'NAO_ENVIADA' } } }),
    prisma.cofProcess.count({ where: { organizationId, createdAt: janela, status: 'CONTRATO_LIBERADO' } }),
  ]);

  // ---------- tempo ate a primeira resposta ----------
  const conversas = await prisma.conversation.findMany({
    where: { organizationId, createdAt: janela },
    select: { messages: { orderBy: { createdAt: 'asc' }, select: { direction: true, createdAt: true } } },
    take: 1000,
  });
  const esperas: number[] = [];
  for (const c of conversas) {
    const entrada = c.messages.find((m) => m.direction === 'INBOUND');
    if (!entrada) continue;
    const saida = c.messages.find((m) => m.direction === 'OUTBOUND' && m.createdAt > entrada.createdAt);
    if (saida) esperas.push((saida.createdAt.getTime() - entrada.createdAt.getTime()) / 60_000);
  }

  // ---------- tempo por etapa ----------
  const historico = await prisma.pipelineStageHistory.findMany({
    where: { lead: { organizationId } },
    include: { toStage: { select: { key: true, name: true } } },
    orderBy: { createdAt: 'asc' },
    take: 5000,
  });
  const porLead = new Map<string, { etapa: string; nome: string; em: Date }[]>();
  for (const h of historico) {
    const lista = porLead.get(h.leadId) ?? [];
    lista.push({ etapa: h.toStage.key, nome: h.toStage.name, em: h.createdAt });
    porLead.set(h.leadId, lista);
  }
  const duracoes = new Map<string, { nome: string; dias: number[] }>();
  for (const passos of porLead.values()) {
    for (let i = 0; i < passos.length - 1; i += 1) {
      const daqui = passos[i];
      const proximo = passos[i + 1];
      if (!daqui || !proximo) continue;
      const dias = (proximo.em.getTime() - daqui.em.getTime()) / 86_400_000;
      const atual = duracoes.get(daqui.etapa) ?? { nome: daqui.nome, dias: [] };
      atual.dias.push(dias);
      duracoes.set(daqui.etapa, atual);
    }
  }

  const qualificacao = historico
    .filter((h) => h.toStage.key === 'QUALIFICADO')
    .map((h) => {
      const lead = leads.find((l) => l.id === h.leadId);
      return lead ? (h.createdAt.getTime() - lead.createdAt.getTime()) / 3_600_000 : null;
    })
    .filter((x): x is number => x !== null);

  // ---------- leads parados ----------
  const agora = Date.now();
  const parados = leads
    .filter((l) => l.status === 'ABERTO')
    .map((l) => ({
      id: l.id,
      nome: l.desiredCity ?? l.id.slice(0, 8),
      etapa: l.stage.name,
      diasParado: Math.floor((agora - l.updatedAt.getTime()) / 86_400_000),
    }))
    .filter((l) => l.diasParado >= 3)
    .sort((a, b) => b.diasParado - a.diasParado)
    .slice(0, 50);

  // ---------- motivos de perda ----------
  const motivos = new Map<string, number>();
  for (const l of leads) {
    if (l.status === 'PERDIDO') {
      const m = l.lostReason?.trim() || 'nao informado';
      motivos.set(m, (motivos.get(m) ?? 0) + 1);
    }
  }

  // ---------- IA para humano ----------
  const handoffs = await prisma.aiHandoff.findMany({
    where: { createdAt: janela },
    select: { reason: true },
    take: 1000,
  });
  const porMotivo = new Map<string, number>();
  for (const h of handoffs) {
    const m = h.reason?.trim() || 'nao informado';
    porMotivo.set(m, (porMotivo.get(m) ?? 0) + 1);
  }

  const renomear = (xs: ReturnType<typeof agrupar>, campo: string) =>
    xs.map((x) => ({ [campo]: x.chave, leads: x.leads, ganhos: x.ganhos, conversao: x.conversao }));

  return {
    periodo: { de: de.toISOString(), ate: ate.toISOString() },
    totais: {
      leads: totalLeads,
      qualificados,
      reunioes,
      cofs,
      contratos,
      ganhos,
      perdidos,
      scoreMedio: totalLeads
        ? Number((leads.reduce((s, l) => s + l.score, 0) / totalLeads).toFixed(1))
        : 0,
    },
    conversao: {
      leadParaQualificado: pct(qualificados, totalLeads),
      leadParaReuniao: pct(reunioes, totalLeads),
      reuniaoParaCof: pct(cofs, reunioes),
      cofParaContrato: pct(contratos, cofs),
      leadParaGanho: pct(ganhos, totalLeads),
    },
    tempos: {
      primeiraRespostaMin: media(esperas),
      qualificacaoHoras: media(qualificacao),
      porEtapaDias: [...duracoes.values()]
        .map((d) => ({ etapa: d.nome, mediaDias: Number((media(d.dias) ?? 0).toFixed(1)), leads: d.dias.length }))
        .sort((a, b) => b.mediaDias - a.mediaDias),
    },
    porCampanha: renomear(
      agrupar(leads.map((l) => ({ chave: l.attribution?.firstTouchCampaign ?? 'sem campanha', ganho: ganho(l) }))),
      'campanha',
    ) as Relatorio['porCampanha'],
    porOrigem: renomear(
      agrupar(leads.map((l) => ({ chave: l.attribution?.firstTouchSource ?? 'direto', ganho: ganho(l) }))),
      'origem',
    ) as Relatorio['porOrigem'],
    porCidade: renomear(
      agrupar(leads.map((l) => ({ chave: l.desiredCity ?? 'nao informada', ganho: ganho(l) }))),
      'cidade',
    ) as Relatorio['porCidade'],
    porResponsavel: renomear(
      agrupar(leads.map((l) => ({ chave: l.owner?.name ?? 'sem responsavel', ganho: ganho(l) }))),
      'responsavel',
    ) as Relatorio['porResponsavel'],
    leadsParados: parados,
    motivosDePerda: [...motivos.entries()]
      .map(([motivo, quantidade]) => ({ motivo, quantidade }))
      .sort((a, b) => b.quantidade - a.quantidade),
    iaParaHumano: {
      total: handoffs.length,
      porMotivo: [...porMotivo.entries()]
        .map(([motivo, quantidade]) => ({ motivo, quantidade }))
        .sort((a, b) => b.quantidade - a.quantidade),
    },
  };
}

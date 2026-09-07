import type { PrismaClient } from '@jolo/database';

/**
 * Regras de negocio ajustaveis (item 52). Nada disso fica preso no codigo:
 * a loja muda o funil, o horario e o roteamento sem pedir programador.
 */
export const CHAVES_DE_CONFIGURACAO = {
  HORARIO_ATENDIMENTO: 'horario_atendimento',
  ROTEAMENTO: 'roteamento_de_leads',
  IA: 'ia_sdr',
  SCORE: 'score',
  MENSAGENS: 'mensagens',
} as const;

export interface HorarioAtendimento {
  /** 0 = domingo. Dias em que ha gente para atender. */
  diasDaSemana: number[];
  horaInicio: string;
  horaFim: string;
  fusoHorario: string;
}

export type ModoDeRoteamento = 'RESPONSAVEL_FIXO' | 'RODIZIO' | 'POR_CIDADE' | 'POR_ESTADO' | 'POR_CAMPANHA' | 'MANUAL';

export interface Roteamento {
  modo: ModoDeRoteamento;
  responsavelPadraoId: string | null;
  /** Fila do rodizio, na ordem. */
  rodizio: string[];
  /** "Campinas" -> id do responsavel. Usado nos modos por cidade/estado/campanha. */
  porChave: Record<string, string>;
}

export interface ConfiguracaoIa {
  ligada: boolean;
  respondeForaDoHorario: boolean;
  maxPerguntasAntesDeHumano: number;
  assinatura: string;
}

export interface ConfiguracaoMensagens {
  saudacao: string;
  foraDoHorario: string;
  transferencia: string;
}

export const PADROES = {
  [CHAVES_DE_CONFIGURACAO.HORARIO_ATENDIMENTO]: {
    diasDaSemana: [1, 2, 3, 4, 5],
    horaInicio: '09:00',
    horaFim: '18:00',
    fusoHorario: 'America/Sao_Paulo',
  } satisfies HorarioAtendimento,
  [CHAVES_DE_CONFIGURACAO.ROTEAMENTO]: {
    modo: 'RESPONSAVEL_FIXO',
    responsavelPadraoId: null,
    rodizio: [],
    porChave: {},
  } satisfies Roteamento,
  [CHAVES_DE_CONFIGURACAO.IA]: {
    ligada: true,
    respondeForaDoHorario: true,
    maxPerguntasAntesDeHumano: 10,
    assinatura: 'Equipe Jolo Franquias',
  } satisfies ConfiguracaoIa,
  [CHAVES_DE_CONFIGURACAO.MENSAGENS]: {
    saudacao: 'Ola! Que bom falar com voce sobre a franquia Jolo.',
    foraDoHorario: 'Recebemos sua mensagem. Nosso time responde no proximo horario de atendimento.',
    transferencia: 'Vou chamar alguem do time para continuar com voce.',
  } satisfies ConfiguracaoMensagens,
} as const;

export type ChaveDeConfiguracao = keyof typeof PADROES;

/** Le uma configuracao, caindo no padrao quando a loja ainda nao mexeu nela. */
export async function lerConfiguracao<T>(
  prisma: PrismaClient,
  organizationId: string,
  chave: string,
): Promise<T> {
  const linha = await prisma.setting.findUnique({
    where: { organizationId_key: { organizationId, key: chave } },
  });
  const padrao = (PADROES as Record<string, unknown>)[chave] ?? {};
  if (!linha) return padrao as T;
  // mistura com o padrao: chave nova no codigo nao quebra loja com configuracao antiga
  return { ...(padrao as object), ...(linha.value as object) } as T;
}

export async function gravarConfiguracao(
  prisma: PrismaClient,
  organizationId: string,
  chave: string,
  valor: object,
): Promise<void> {
  await prisma.setting.upsert({
    where: { organizationId_key: { organizationId, key: chave } },
    create: { organizationId, key: chave, value: valor },
    update: { value: valor },
  });
}

/** Esta dentro do horario de atendimento? Usado para decidir o que responder. */
export function dentroDoHorario(h: HorarioAtendimento, quando = new Date()): boolean {
  const formatador = new Intl.DateTimeFormat('pt-BR', {
    timeZone: h.fusoHorario,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const partes = formatador.formatToParts(quando);
  const hora = partes.find((p) => p.type === 'hour')?.value ?? '00';
  const minuto = partes.find((p) => p.type === 'minute')?.value ?? '00';

  const diaLocal = new Date(quando.toLocaleString('en-US', { timeZone: h.fusoHorario })).getDay();
  if (!h.diasDaSemana.includes(diaLocal)) return false;

  const agora = `${hora}:${minuto}`;
  return agora >= h.horaInicio && agora <= h.horaFim;
}

/**
 * Escolhe quem atende o lead novo (item 53).
 * Devolve null quando a regra for manual ou nao houver ninguem configurado:
 * lead sem dono aparece na fila geral, nunca some.
 */
export function escolherResponsavel(
  r: Roteamento,
  contexto: { cidade?: string | null; estado?: string | null; campanha?: string | null; sequencia: number },
): string | null {
  switch (r.modo) {
    case 'MANUAL':
      return null;
    case 'RODIZIO':
      return r.rodizio[contexto.sequencia % r.rodizio.length] ?? r.responsavelPadraoId;
    case 'POR_CIDADE':
      return chave(r, contexto.cidade) ?? r.responsavelPadraoId;
    case 'POR_ESTADO':
      return chave(r, contexto.estado) ?? r.responsavelPadraoId;
    case 'POR_CAMPANHA':
      return chave(r, contexto.campanha) ?? r.responsavelPadraoId;
    case 'RESPONSAVEL_FIXO':
    default:
      return r.responsavelPadraoId;
  }
}

function chave(r: Roteamento, valor?: string | null): string | null {
  if (!valor) return null;
  const alvo = valor.trim().toLowerCase();
  for (const [k, v] of Object.entries(r.porChave)) {
    if (k.trim().toLowerCase() === alvo) return v;
  }
  return null;
}

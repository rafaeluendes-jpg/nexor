import type { LeadTemperature } from '@jolo/database';

export interface ScoreInput {
  capitalAvailable?: number | null;
  capitalRange?: string | null;
  investmentHorizon?: string | null;
  desiredCity?: string | null;
  cityAvailable?: boolean;
  businessExperience?: string | null;
  availability?: string | null;
  inboundMessages?: number;
}

export interface ScoreRuleConfig {
  key: string;
  label: string;
  points: number;
  active: boolean;
}

/** Regras padrao do item 25. Ficam no banco (tabela score_rules) e sao editaveis. */
export const DEFAULT_SCORE_RULES: ScoreRuleConfig[] = [
  { key: 'capital_compativel', label: 'Capital compativel com o investimento', points: 25, active: true },
  { key: 'prazo_curto', label: 'Prazo curto para investir', points: 20, active: true },
  { key: 'cidade_disponivel', label: 'Cidade disponivel para a rede', points: 20, active: true },
  { key: 'perfil_empreendedor', label: 'Perfil empreendedor', points: 15, active: true },
  { key: 'disponibilidade_operacao', label: 'Disponibilidade para operar', points: 10, active: true },
  { key: 'engajamento', label: 'Engajamento na conversa', points: 10, active: true },
];

/** Investimento total estimado do modelo, usado para julgar o capital informado. */
export const INVESTIMENTO_TOTAL_ESTIMADO = 350_000;

const PRAZO_CURTO = ['imediato', 'agora', '30 dias', '60 dias', '90 dias', '1 mes', '2 meses', '3 meses'];

export interface ScoreResult {
  total: number;
  temperature: LeadTemperature;
  breakdown: Record<string, number>;
}

export function computeScore(input: ScoreInput, rules = DEFAULT_SCORE_RULES): ScoreResult {
  const ativo = new Map(rules.filter((r) => r.active).map((r) => [r.key, r.points]));
  const breakdown: Record<string, number> = {};
  const add = (key: string, condicao: boolean) => {
    const pontos = ativo.get(key);
    if (pontos && condicao) breakdown[key] = pontos;
  };

  const capital = input.capitalAvailable ?? parseCapitalRange(input.capitalRange);
  add('capital_compativel', capital != null && capital >= INVESTIMENTO_TOTAL_ESTIMADO * 0.8);
  add(
    'prazo_curto',
    Boolean(input.investmentHorizon && PRAZO_CURTO.some((p) => input.investmentHorizon!.toLowerCase().includes(p))),
  );
  add('cidade_disponivel', Boolean(input.desiredCity) && input.cityAvailable !== false);
  add('perfil_empreendedor', Boolean(input.businessExperience && input.businessExperience.trim().length > 3));
  add(
    'disponibilidade_operacao',
    Boolean(input.availability && !/^nao|nenhuma|sem tempo/i.test(input.availability.trim())),
  );
  add('engajamento', (input.inboundMessages ?? 0) >= 4);

  const total = Object.values(breakdown).reduce((a, b) => a + b, 0);
  return { total, temperature: temperatureFor(total), breakdown };
}

export function temperatureFor(total: number): LeadTemperature {
  if (total >= 70) return 'QUENTE';
  if (total >= 40) return 'MORNO';
  return 'FRIO';
}

/** Le faixas escritas em texto livre: "ate 200 mil", "R$ 350.000", "300 a 400 mil". */
export function parseCapitalRange(texto?: string | null): number | null {
  if (!texto) return null;
  const t = texto.toLowerCase().replace(/\./g, '').replace(/,/g, '.');
  const numeros = [...t.matchAll(/(\d+(?:\.\d+)?)/g)].map((m) => Number(m[1]));
  if (!numeros.length) return null;
  const mil = /\bmil\b|\bk\b/.test(t);
  const milhao = /milh(a|ã)o|milh(o|õ)es|\bmi\b/.test(t);
  const fator = milhao ? 1_000_000 : mil ? 1_000 : 1;
  const maior = Math.max(...numeros);
  return maior * fator;
}

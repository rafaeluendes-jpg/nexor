/** Etapas iniciais do funil de franquias (item 19). Configuraveis pelo admin. */
export const PIPELINE_STAGES = [
  { key: 'NOVO_LEAD', name: 'Novo lead', color: '#A67B3F' },
  { key: 'IA_QUALIFICANDO', name: 'IA qualificando', color: '#6E7138' },
  { key: 'QUALIFICADO', name: 'Qualificado', color: '#304A2A' },
  { key: 'REUNIAO_AGENDADA', name: 'Reunião agendada', color: '#304A2A' },
  { key: 'APRESENTACAO_REALIZADA', name: 'Apresentação realizada', color: '#304A2A' },
  { key: 'VISITA_UNIDADE', name: 'Visita à unidade', color: '#304A2A' },
  { key: 'COF_ENVIADA', name: 'COF enviada', color: '#A67B3F' },
  { key: 'PRAZO_COF', name: 'Prazo COF', color: '#A67B3F' },
  { key: 'NEGOCIACAO', name: 'Negociação', color: '#A67B3F' },
  { key: 'CONTRATO', name: 'Contrato', color: '#17351F' },
  { key: 'GANHO', name: 'Ganho', color: '#2F8F4E', isWon: true },
  { key: 'PERDIDO', name: 'Perdido', color: '#B23A2E', isLost: true },
  { key: 'NUTRICAO', name: 'Nutrição', color: '#6E7138' },
  { key: 'SEM_RESPOSTA', name: 'Sem resposta', color: '#8A8E86' },
] as const;

export type StageKey = (typeof PIPELINE_STAGES)[number]['key'];
/**
 * ATENCAO: este nome e a CHAVE do funil no banco (organizationId + name).
 * Trocar o texto aqui cria um funil novo em vez de renomear o existente.
 * Para renomear, faca migration; nao edite esta linha.
 */
export const DEFAULT_PIPELINE_NAME = 'Expansao de franquias';

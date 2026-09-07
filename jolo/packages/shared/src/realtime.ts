/**
 * Canal de tempo real (item 44). Um canal por organizacao: quem entra
 * so recebe o que e da sua empresa. O nome do canal e montado num lugar so.
 */
export const TIPOS_DE_AVISO = {
  MENSAGEM_NOVA: 'mensagem_nova',
  MENSAGEM_STATUS: 'mensagem_status',
  LEAD_NOVO: 'lead_novo',
  LEAD_MUDOU_ETAPA: 'lead_mudou_etapa',
  CONVERSA_ASSUMIDA: 'conversa_assumida',
  CONVERSA_LIBERADA: 'conversa_liberada',
  TAREFA_NOVA: 'tarefa_nova',
} as const;

export type TipoDeAviso = (typeof TIPOS_DE_AVISO)[keyof typeof TIPOS_DE_AVISO];

export interface AvisoTempoReal {
  tipo: TipoDeAviso;
  organizationId: string;
  /** Identificador do que mudou, para a tela recarregar so aquilo. */
  alvoId?: string;
  conversaId?: string;
  leadId?: string;
  dados?: Record<string, unknown>;
  em: string;
}

export function canalDaOrganizacao(organizationId: string): string {
  return `jolo:eventos:${organizationId}`;
}

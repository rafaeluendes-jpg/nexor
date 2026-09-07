/**
 * Configuracao central da landing. O numero do WhatsApp e a mensagem
 * existem AQUI e em lugar nenhum mais (item 9 do prompt mestre).
 */
export interface WhatsAppConfig {
  /** DDI + DDD + numero, somente digitos. Vazio = botao desabilitado. */
  number: string;
  message: string;
  configured: boolean;
}

export function readWhatsAppConfig(env: Record<string, string | undefined>): WhatsAppConfig {
  const raw = (env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? '').replace(/\D+/g, '');
  const message =
    env.NEXT_PUBLIC_WHATSAPP_MESSAGE ??
    'Ola! Vim pela pagina de franquias da Jolo e gostaria de falar com o dono.';
  return { number: raw, message, configured: raw.length >= 12 };
}

export function whatsappUrl(cfg: WhatsAppConfig, extra?: string): string {
  const text = extra ? `${cfg.message}\n\n${extra}` : cfg.message;
  return `https://wa.me/${cfg.number}?text=${encodeURIComponent(text)}`;
}

export const SITE = {
  name: 'Jolo Gelato Franquias',
  title: 'Seja um Franqueado | Jolo Gelato',
  description:
    'Conheca a franquia Jolo Gelato, a trajetoria da marca, o modelo de negocio e fale diretamente com o dono.',
  locale: 'pt-BR',
  themeColor: '#304A2A',
} as const;

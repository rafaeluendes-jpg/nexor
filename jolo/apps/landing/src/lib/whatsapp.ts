'use client';

import { captureAttribution, toPayload, trackingSuffix } from '@jolo/attribution';
import { readWhatsAppConfig, whatsappUrl } from '@jolo/config';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333';

export const WHATSAPP = readWhatsAppConfig({
  NEXT_PUBLIC_WHATSAPP_NUMBER: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER,
  NEXT_PUBLIC_WHATSAPP_MESSAGE: process.env.NEXT_PUBLIC_WHATSAPP_MESSAGE,
});

/**
 * UNICA porta de entrada do botao "Fale com o dono".
 * Nenhum componente monta URL de wa.me por conta propria (item 9).
 *
 * Ordem: registra a origem do clique -> abre o WhatsApp.
 * Se a API estiver fora do ar, o WhatsApp abre do mesmo jeito:
 * perder um lead por causa de analitica seria pior que perder a analitica.
 */
export async function openFranchiseWhatsApp(origem: string): Promise<void> {
  if (!WHATSAPP.configured) {
    // Sem numero oficial configurado nada e aberto: melhor nao mandar o lead para lugar nenhum.
    console.warn('WhatsApp oficial nao configurado (NEXT_PUBLIC_WHATSAPP_NUMBER).');
    return;
  }

  const atribuicao = captureAttribution();
  const payload = { ...toPayload(atribuicao), landingPage: `${window.location.origin}${window.location.pathname}` };

  try {
    await fetch(`${API}/attribution/click`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, origem }),
      keepalive: true,
    });
  } catch {
    /* segue o clique mesmo sem registrar */
  }

  const url = whatsappUrl(WHATSAPP, trackingSuffix(atribuicao));
  window.open(url, '_blank', 'noopener,noreferrer');
}

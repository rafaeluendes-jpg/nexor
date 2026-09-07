import type { NormalizedInboundMessage, NormalizedStatus, NormalizedWebhook } from './types';

function toDate(ts: unknown): Date {
  const n = Number(ts);
  return Number.isFinite(n) && n > 0 ? new Date(n * 1000) : new Date();
}

function textOf(msg: Record<string, any>): string | undefined {
  switch (msg.type) {
    case 'text':
      return msg.text?.body;
    case 'button':
      return msg.button?.text;
    case 'interactive':
      return msg.interactive?.button_reply?.title ?? msg.interactive?.list_reply?.title;
    default:
      return undefined;
  }
}

/**
 * Traduz o corpo do webhook da Meta para o formato interno.
 * Tolerante a campo faltando: um payload estranho nao pode derrubar a API.
 */
export function parseMetaWebhook(payload: unknown): NormalizedWebhook {
  const messages: NormalizedInboundMessage[] = [];
  const statuses: NormalizedStatus[] = [];
  let phoneNumberId: string | undefined;

  const body = payload as Record<string, any>;
  const entries: any[] = Array.isArray(body?.entry) ? body.entry : [];

  for (const entry of entries) {
    const changes: any[] = Array.isArray(entry?.changes) ? entry.changes : [];
    for (const change of changes) {
      const value = change?.value ?? {};
      phoneNumberId = value?.metadata?.phone_number_id ?? phoneNumberId;
      const contatos: any[] = Array.isArray(value?.contacts) ? value.contacts : [];

      for (const msg of Array.isArray(value?.messages) ? value.messages : []) {
        if (!msg?.id || !msg?.from) continue;
        const contato = contatos.find((c) => c?.wa_id === msg.from) ?? contatos[0];
        messages.push({
          wamid: String(msg.id),
          from: String(msg.from),
          waId: String(contato?.wa_id ?? msg.from),
          profileName: contato?.profile?.name,
          type: String(msg.type ?? 'unknown'),
          text: textOf(msg),
          timestamp: toDate(msg.timestamp),
          referral: msg.referral,
          raw: msg,
        });
      }

      for (const st of Array.isArray(value?.statuses) ? value.statuses : []) {
        if (!st?.id || !st?.status) continue;
        const erro = Array.isArray(st.errors) ? st.errors[0] : undefined;
        statuses.push({
          wamid: String(st.id),
          status: String(st.status) as NormalizedStatus['status'],
          timestamp: toDate(st.timestamp),
          recipientId: st.recipient_id,
          errorCode: erro?.code ? String(erro.code) : undefined,
          errorMessage: erro?.title ?? erro?.message,
          raw: st,
        });
      }
    }
  }

  return { phoneNumberId, messages, statuses };
}

/** Identificador estavel do evento, para nao processar o mesmo webhook duas vezes. */
export function webhookEventKey(payload: unknown): string | undefined {
  const n = parseMetaWebhook(payload);
  const partes = [
    ...n.messages.map((m) => `m:${m.wamid}`),
    ...n.statuses.map((s) => `s:${s.wamid}:${s.status}`),
  ].sort();
  return partes.length ? partes.join('|').slice(0, 400) : undefined;
}

/** Nomes das filas (item 45). Cada uma tem worker proprio e DLQ. */
export const QUEUES = {
  WHATSAPP_INBOUND: 'whatsapp-inbound',
  WHATSAPP_OUTBOUND: 'whatsapp-outbound',
  AI: 'ai',
  FOLLOWUPS: 'followups',
  EXCEL: 'excel',
  NOTIFICATIONS: 'notifications',
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

export interface InboundJob {
  webhookEventId: string;
  correlationId: string;
}
export interface OutboundJob {
  messageId: string;
  correlationId: string;
}
export interface AiJob {
  conversationId: string;
  correlationId: string;
}
export interface ExcelJob {
  organizationId: string;
  exportId?: string;
  reason: string;
}

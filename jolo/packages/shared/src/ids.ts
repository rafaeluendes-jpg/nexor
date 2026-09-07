import { randomUUID } from 'node:crypto';

export function newId(): string {
  return randomUUID();
}

/** Id de rastreamento usado entre landing, WhatsApp e CRM. */
export function newTrackingId(): string {
  return `jl_${randomUUID().replace(/-/g, '').slice(0, 22)}`;
}

export interface WhatsAppClientOptions {
  accessToken: string;
  phoneNumberId: string;
  graphVersion?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export interface SendTextResult {
  ok: boolean;
  wamid?: string;
  statusCode: number;
  error?: { code?: string; message?: string };
  raw: unknown;
}

/**
 * Cliente da WhatsApp Business Platform (Cloud API oficial da Meta).
 * Nao existe QR Code, sessao nao oficial nem biblioteca alternativa aqui.
 */
export class WhatsAppClient {
  private readonly base: string;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: WhatsAppClientOptions) {
    const version = options.graphVersion ?? 'v21.0';
    this.base = `https://graph.facebook.com/${version}/${options.phoneNumberId}`;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async sendText(to: string, body: string): Promise<SendTextResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.options.timeoutMs ?? 15_000);
    try {
      const res = await this.fetchImpl(`${this.base}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.options.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to,
          type: 'text',
          text: { preview_url: false, body },
        }),
        signal: controller.signal,
      });
      const json = (await res.json().catch(() => ({}))) as Record<string, any>;
      if (!res.ok) {
        return {
          ok: false,
          statusCode: res.status,
          error: { code: String(json?.error?.code ?? res.status), message: json?.error?.message },
          raw: json,
        };
      }
      return { ok: true, statusCode: res.status, wamid: json?.messages?.[0]?.id, raw: json };
    } catch (err) {
      return {
        ok: false,
        statusCode: 0,
        error: { code: 'NETWORK', message: err instanceof Error ? err.message : 'falha de rede' },
        raw: null,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  async markAsRead(wamid: string): Promise<boolean> {
    const res = await this.fetchImpl(`${this.base}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.options.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messaging_product: 'whatsapp', status: 'read', message_id: wamid }),
    });
    return res.ok;
  }
}

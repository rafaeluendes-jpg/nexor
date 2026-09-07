/**
 * Camada desacoplada de provider (item 4): o CRM nunca fica amarrado
 * a um unico modelo. Trocar de fornecedor e trocar esta implementacao.
 */
export interface AiToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface AiTurnInput {
  system: string;
  messages: { role: 'user' | 'assistant' | 'tool'; content: string; toolCallId?: string; name?: string }[];
  tools: { name: string; description: string; parameters: Record<string, unknown> }[];
  maxTokens?: number;
}

export interface AiTurnOutput {
  text?: string;
  toolCalls: AiToolCall[];
  tokensIn?: number;
  tokensOut?: number;
}

export interface AiProvider {
  readonly name: string;
  readonly model: string;
  complete(input: AiTurnInput): Promise<AiTurnOutput>;
}

/** Sem credencial de IA o sistema segue funcionando: a conversa vai para humano. */
export class DisabledAiProvider implements AiProvider {
  readonly name = 'disabled';
  readonly model = 'none';
  async complete(): Promise<AiTurnOutput> {
    return { toolCalls: [], text: undefined };
  }
}

export class OpenAiProvider implements AiProvider {
  readonly name = 'openai';
  constructor(
    readonly model: string,
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async complete(input: AiTurnInput): Promise<AiTurnOutput> {
    const res = await this.fetchImpl('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        max_tokens: input.maxTokens ?? 800,
        messages: [
          { role: 'system', content: input.system },
          ...input.messages.map((m) =>
            m.role === 'tool'
              ? { role: 'tool', content: m.content, tool_call_id: m.toolCallId }
              : { role: m.role, content: m.content },
          ),
        ],
        tools: input.tools.map((t) => ({
          type: 'function',
          function: { name: t.name, description: t.description, parameters: t.parameters },
        })),
      }),
    });
    if (!res.ok) throw new Error(`IA indisponivel: HTTP ${res.status}`);
    const json = (await res.json()) as any;
    const choice = json?.choices?.[0]?.message ?? {};
    return {
      text: choice.content ?? undefined,
      toolCalls: (choice.tool_calls ?? []).map((c: any) => ({
        id: c.id,
        name: c.function?.name,
        arguments: safeJson(c.function?.arguments),
      })),
      tokensIn: json?.usage?.prompt_tokens,
      tokensOut: json?.usage?.completion_tokens,
    };
  }
}

function safeJson(raw: unknown): Record<string, unknown> {
  if (typeof raw !== 'string') return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function createAiProvider(env: {
  AI_PROVIDER: string;
  AI_MODEL: string;
  OPENAI_API_KEY?: string;
}): AiProvider {
  if (env.AI_PROVIDER === 'openai' && env.OPENAI_API_KEY) {
    return new OpenAiProvider(env.AI_MODEL, env.OPENAI_API_KEY);
  }
  return new DisabledAiProvider();
}

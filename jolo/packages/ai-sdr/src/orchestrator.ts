import type { PrismaClient } from '@jolo/database';
import { aiMayAnswer } from '@jolo/crm-core';
import type { AiProvider } from './provider';
import { SDR_SYSTEM_PROMPT } from './prompt';
import { AI_TOOLS, AI_TOOL_MAP, type ToolContext } from './tools';

export interface SdrResult {
  status: 'answered' | 'skipped_human' | 'skipped_disabled' | 'handoff' | 'error';
  reply?: string;
  toolsUsed: string[];
  error?: string;
}

const MAX_TOOL_ROUNDS = 4;

/**
 * Um turno do SDR: le a conversa, decide, usa ferramentas e devolve o texto.
 * Nao envia mensagem: quem envia e o worker de saida, com fila e retry.
 */
export async function runSdrTurn(params: {
  prisma: PrismaClient;
  provider: AiProvider;
  conversationId: string;
  correlationId: string;
  maxTokens?: number;
}): Promise<SdrResult> {
  const { prisma, provider, conversationId, correlationId } = params;

  const conversa = await prisma.conversation.findUniqueOrThrow({
    where: { id: conversationId },
    include: {
      contact: true,
      messages: { orderBy: { createdAt: 'asc' }, take: 40 },
    },
  });

  if (!aiMayAnswer(conversa)) return { status: 'skipped_human', toolsUsed: [] };
  if (provider.name === 'disabled') return { status: 'skipped_disabled', toolsUsed: [] };
  if (!conversa.leadId) return { status: 'error', toolsUsed: [], error: 'conversa sem lead' };

  const sessao = await prisma.aiSession.findFirst({
    where: { conversationId, status: 'ATIVA' },
    orderBy: { startedAt: 'desc' },
  });
  const sessionRow =
    sessao ??
    (await prisma.aiSession.create({
      data: {
        organizationId: conversa.organizationId,
        conversationId,
        leadId: conversa.leadId,
        provider: provider.name,
        model: provider.model,
      },
    }));

  const ctx: ToolContext = {
    prisma,
    organizationId: conversa.organizationId,
    leadId: conversa.leadId,
    conversationId,
    correlationId,
  };

  const historico = conversa.messages
    .filter((m) => m.body)
    .map((m) => ({
      role: (m.direction === 'INBOUND' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: m.body as string,
    }));

  const mensagens: { role: 'user' | 'assistant' | 'tool'; content: string; toolCallId?: string }[] = [
    ...historico,
  ];
  const toolsUsed: string[] = [];

  try {
    for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
      const saida = await provider.complete({
        system: SDR_SYSTEM_PROMPT,
        messages: mensagens,
        tools: AI_TOOLS.map((t) => ({
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        })),
        maxTokens: params.maxTokens,
      });

      if (saida.toolCalls.length === 0) {
        const texto = (saida.text ?? '').trim();
        if (texto) {
          await prisma.aiMessage.create({
            data: {
              sessionId: sessionRow.id,
              role: 'assistant',
              content: texto,
              tokensIn: saida.tokensIn,
              tokensOut: saida.tokensOut,
            },
          });
        }
        return { status: texto ? 'answered' : 'error', reply: texto || undefined, toolsUsed };
      }

      for (const chamada of saida.toolCalls) {
        const tool = AI_TOOL_MAP.get(chamada.name);
        const resultado = tool
          ? await tool.run(ctx, chamada.arguments).catch((e) => ({ erro: String(e) }))
          : { erro: 'ferramenta desconhecida' };
        toolsUsed.push(chamada.name);
        await prisma.aiMessage.create({
          data: {
            sessionId: sessionRow.id,
            role: 'tool',
            content: JSON.stringify(resultado).slice(0, 4000),
            toolName: chamada.name,
            toolPayload: chamada.arguments as object,
          },
        });
        mensagens.push({
          role: 'tool',
          content: JSON.stringify(resultado),
          toolCallId: chamada.id,
        });
        if (chamada.name === 'handoffToHuman') {
          return { status: 'handoff', toolsUsed };
        }
      }
    }
    return { status: 'error', toolsUsed, error: 'limite de rodadas de ferramenta atingido' };
  } catch (err) {
    return { status: 'error', toolsUsed, error: err instanceof Error ? err.message : 'falha na IA' };
  }
}

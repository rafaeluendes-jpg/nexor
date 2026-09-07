import { Controller, Get, Req, Res } from '@nestjs/common';
import { Redis } from 'ioredis';
import type { FastifyReply } from 'fastify';
import { canalDaOrganizacao, type AvisoTempoReal } from '@jolo/shared';
import { corsOrigins, loadServerEnv } from '@jolo/config/server';
import { CurrentUser, RequirePermission, type AuthenticatedUser } from '../../common/decorators/index.js';
import { logger } from '../../common/logger.js';

/**
 * Tempo real por SSE (item 44).
 *
 * Canal privado: a inscricao usa o id da organizacao de quem esta logado,
 * nunca um id que venha do pedido. Assim ninguem escuta o movimento de outra
 * empresa mudando um parametro na URL.
 */
@Controller('realtime')
export class RealtimeController {
  private readonly env = loadServerEnv();

  @RequirePermission('crm.dashboard.view')
  @Get('stream')
  async stream(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: { headers: Record<string, string | undefined> },
    @Res() res: FastifyReply,
  ): Promise<void> {
    const bruto = res.raw;

    // Escrevemos direto na resposta para manter o fluxo aberto, e isso pula os
    // ganchos do framework — inclusive o do CORS. Entao a permissao de origem
    // vai a mao aqui, conferida contra a MESMA lista de origens autorizadas.
    const origem = req.headers.origin;
    const permitidas = corsOrigins(this.env);
    const cabecalhos: Record<string, string> = {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      // proxy que junta pedacinhos atrasa o aviso: aqui nao pode
      'x-accel-buffering': 'no',
      vary: 'Origin',
    };
    if (origem && permitidas.includes(origem)) {
      cabecalhos['access-control-allow-origin'] = origem;
      cabecalhos['access-control-allow-credentials'] = 'true';
    }
    bruto.writeHead(200, cabecalhos);

    const enviar = (evento: string, dados: unknown): void => {
      bruto.write(`event: ${evento}\ndata: ${JSON.stringify(dados)}\n\n`);
    };
    enviar('conectado', { em: new Date().toISOString() });

    // Conexao propria: quem escuta canal no Redis nao pode fazer mais nada nela.
    const inscricao = new Redis(this.env.REDIS_URL, { maxRetriesPerRequest: null });
    const canal = canalDaOrganizacao(user.organizationId);

    inscricao.on('error', (err) => logger.warn({ err: err.message }, 'canal de tempo real caiu'));
    await inscricao.subscribe(canal).catch((err) => {
      logger.warn({ err: err instanceof Error ? err.message : err }, 'nao deu para escutar o canal');
    });

    inscricao.on('message', (_c, mensagem) => {
      try {
        const aviso = JSON.parse(mensagem) as AvisoTempoReal;
        // trava dupla: mesmo que algo publique no canal errado, nada vaza
        if (aviso.organizationId !== user.organizationId) return;
        enviar(aviso.tipo, aviso);
      } catch {
        /* mensagem estranha no canal nao derruba a conexao de ninguem */
      }
    });

    // Sinal de vida: sem isto, proxy e navegador cortam a conexao parada.
    const pulso = setInterval(() => bruto.write(': pulso\n\n'), 25_000);

    const encerrar = (): void => {
      clearInterval(pulso);
      void inscricao.quit().catch(() => undefined);
    };
    res.raw.on('close', encerrar);
    res.raw.on('error', encerrar);
  }
}

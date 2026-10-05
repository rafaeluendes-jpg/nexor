import webpush from 'web-push';
import { ROLE_PERMISSIONS, type RoleKey } from '@jolo/shared';
import type { WorkerContext } from './context.js';

export interface AvisoNoCelular {
  organizationId: string;
  conversaId: string;
  titulo: string;
  corpo: string;
}

/** Quem pode ver conversas recebe o aviso; quem nao pode, nem fica sabendo que chegou. */
const PAPEIS_QUE_VEEM_CONVERSA = (Object.keys(ROLE_PERMISSIONS) as RoleKey[]).filter((r) =>
  ROLE_PERMISSIONS[r].includes('crm.conversations.view'),
);

let configurado: boolean | null = null;

function pronto(ctx: WorkerContext): boolean {
  if (configurado !== null) return configurado;
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = ctx.env;
  configurado = Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
  if (configurado) webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY!, VAPID_PRIVATE_KEY!);
  else ctx.logger.warn('avisos no celular desligados: faltam as chaves VAPID no .env');
  return configurado;
}

/**
 * Avisa no celular (e no computador) de quem ligou os avisos no CRM, como o
 * WhatsApp faz. O conteudo vai cifrado de ponta a ponta ate o aparelho.
 * Falha de aviso nunca derruba o atendimento: so fica no log.
 */
export async function avisarNoCelular(ctx: WorkerContext, aviso: AvisoNoCelular): Promise<void> {
  if (!pronto(ctx)) return;

  const aparelhos = await ctx.prisma.pushSubscription.findMany({
    where: {
      organizationId: aviso.organizationId,
      user: {
        organizationId: aviso.organizationId,
        status: 'ACTIVE',
        roles: { some: { role: { name: { in: PAPEIS_QUE_VEEM_CONVERSA } } } },
      },
    },
  });
  if (!aparelhos.length) return;

  const conteudo = JSON.stringify({
    titulo: aviso.titulo,
    corpo: aviso.corpo.length > 140 ? `${aviso.corpo.slice(0, 137)}…` : aviso.corpo,
    endereco: `/inbox?c=${aviso.conversaId}`,
    // um aviso por conversa: mensagens seguidas atualizam o mesmo, nao empilham
    marca: `conversa-${aviso.conversaId}`,
  });

  await Promise.all(
    aparelhos.map(async (a) => {
      try {
        await webpush.sendNotification(
          { endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } },
          conteudo,
          { TTL: 60 * 60, urgency: 'high' },
        );
        await ctx.prisma.pushSubscription.update({ where: { id: a.id }, data: { lastUsedAt: new Date() } });
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        // 404/410: o aparelho desligou os avisos ou o app foi removido. Sai da lista.
        if (status === 404 || status === 410) {
          await ctx.prisma.pushSubscription.delete({ where: { id: a.id } }).catch(() => undefined);
        } else {
          ctx.logger.warn({ status, aparelho: a.id }, 'aviso no celular nao saiu');
        }
      }
    }),
  );
}

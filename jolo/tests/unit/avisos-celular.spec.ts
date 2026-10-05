import { generateKeyPairSync } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Aviso de mensagem nova no celular: quem recebe, o que vai no aviso e o que
 * acontece quando o aparelho desligou os avisos.
 */

const enviar = vi.fn();
vi.mock('web-push', () => ({
  default: { setVapidDetails: vi.fn(), sendNotification: (...a: unknown[]) => enviar(...a) },
}));

function chaves() {
  const k = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).privateKey.export({ format: 'jwk' });
  const pub = Buffer.concat([Buffer.from([4]), Buffer.from(k.x!, 'base64url'), Buffer.from(k.y!, 'base64url')]);
  return { VAPID_PUBLIC_KEY: pub.toString('base64url'), VAPID_PRIVATE_KEY: k.d!, VAPID_SUBJECT: 'mailto:t@t.com' };
}

function contexto(env: Record<string, string | undefined>, aparelhos: { id: string; endpoint: string }[]) {
  const prisma = {
    pushSubscription: {
      findMany: vi.fn().mockResolvedValue(aparelhos.map((a) => ({ ...a, p256dh: 'p', auth: 'a' }))),
      update: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
    },
  };
  const logger = { warn: vi.fn(), info: vi.fn() };
  return { ctx: { env, prisma, logger } as never, prisma, logger };
}

async function modulo() {
  vi.resetModules();
  return import('../../workers/src/push');
}

describe('aviso no celular', () => {
  beforeEach(() => {
    enviar.mockReset();
  });

  it('sem as chaves no servidor, nao procura aparelho nem envia', async () => {
    const { avisarNoCelular } = await modulo();
    const { ctx, prisma } = contexto({ VAPID_SUBJECT: 'mailto:t@t.com' }, [{ id: '1', endpoint: 'https://fcm.googleapis.com/x' }]);
    await avisarNoCelular(ctx, { organizationId: 'o', conversaId: 'c', titulo: 'Ana', corpo: 'oi' });
    expect(prisma.pushSubscription.findMany).not.toHaveBeenCalled();
    expect(enviar).not.toHaveBeenCalled();
  });

  it('so avisa usuario ativo da mesma empresa com papel que ve conversa', async () => {
    const { avisarNoCelular } = await modulo();
    const { ctx, prisma } = contexto(chaves(), []);
    await avisarNoCelular(ctx, { organizationId: 'org-1', conversaId: 'c', titulo: 'Ana', corpo: 'oi' });
    const filtro = prisma.pushSubscription.findMany.mock.calls[0]![0].where;
    expect(filtro.organizationId).toBe('org-1');
    expect(filtro.user.status).toBe('ACTIVE');
    expect(filtro.user.organizationId).toBe('org-1');
    const papeis = filtro.user.roles.some.role.name.in as string[];
    expect(papeis).toContain('ATENDENTE');
    expect(papeis).toContain('EXPANSAO');
    expect(papeis).not.toContain('MARKETING');
  });

  it('manda nome, texto curto e o caminho da conversa; aparelho que saiu deixa a lista', async () => {
    const { avisarNoCelular } = await modulo();
    const { ctx, prisma } = contexto(chaves(), [
      { id: 'vivo', endpoint: 'https://fcm.googleapis.com/a' },
      { id: 'saiu', endpoint: 'https://web.push.apple.com/b' },
    ]);
    enviar.mockImplementation(async (sub: { endpoint: string }) => {
      if (sub.endpoint.includes('apple')) throw Object.assign(new Error('gone'), { statusCode: 410 });
      return {};
    });

    await avisarNoCelular(ctx, { organizationId: 'o', conversaId: 'conv-9', titulo: 'Ana', corpo: 'x'.repeat(300) });

    expect(enviar).toHaveBeenCalledTimes(2);
    const conteudo = JSON.parse(enviar.mock.calls[0]![1] as string);
    expect(conteudo.titulo).toBe('Ana');
    expect(conteudo.endereco).toBe('/inbox?c=conv-9');
    expect(conteudo.marca).toBe('conversa-conv-9');
    expect(conteudo.corpo.length).toBeLessThanOrEqual(140);
    expect(prisma.pushSubscription.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'vivo' } }));
    expect(prisma.pushSubscription.delete).toHaveBeenCalledWith({ where: { id: 'saiu' } });
  });

  it('erro passageiro do servico de aviso nao apaga o aparelho', async () => {
    const { avisarNoCelular } = await modulo();
    const { ctx, prisma, logger } = contexto(chaves(), [{ id: '1', endpoint: 'https://fcm.googleapis.com/a' }]);
    enviar.mockRejectedValue(Object.assign(new Error('fora'), { statusCode: 503 }));
    await avisarNoCelular(ctx, { organizationId: 'o', conversaId: 'c', titulo: 'Ana', corpo: 'oi' });
    expect(prisma.pushSubscription.delete).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
  });
});

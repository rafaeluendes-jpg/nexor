import { connect } from 'node:net';

/**
 * Cliente minimo de Redis, so para os testes limparem o contador de
 * tentativas de login entre um caso e outro. Sem dependencia nova:
 * a protecao continua ligada, o teste so zera o relogio dela.
 */
function comando(...partes: string[]): string {
  return `*${partes.length}\r\n${partes.map((p) => `$${Buffer.byteLength(p)}\r\n${p}\r\n`).join('')}`;
}

function urlDoRedis(): { host: string; port: number } {
  const bruto = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379';
  const u = new URL(bruto);
  return { host: u.hostname || '127.0.0.1', port: Number(u.port || 6379) };
}

async function falar(comandos: string[]): Promise<string> {
  const { host, port } = urlDoRedis();
  return new Promise((resolve, reject) => {
    const soquete = connect({ host, port }, () => soquete.write(comandos.join('')));
    let resposta = '';
    soquete.setTimeout(3000, () => soquete.destroy(new Error('redis nao respondeu')));
    soquete.on('data', (d) => {
      resposta += d.toString('utf8');
      // uma resposta por comando enviado
      if (resposta.split('\r\n').filter(Boolean).length >= comandos.length) soquete.end();
    });
    soquete.on('close', () => resolve(resposta));
    soquete.on('error', reject);
  });
}

/** Apaga as chaves de limite de tentativa (rl:login:*, rl:api:* ...). */
export async function limparLimite(regra: string): Promise<void> {
  const bruto = await falar([comando('KEYS', `rl:${regra}:*`)]);
  const chaves = bruto
    .split('\r\n')
    .filter((l) => l.startsWith('rl:'))
    .map((l) => l.trim());
  if (chaves.length) await falar([comando('DEL', ...chaves)]);
}

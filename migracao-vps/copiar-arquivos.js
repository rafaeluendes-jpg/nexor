#!/usr/bin/env node
/* Copia os arquivos do armazenamento (fotos, logos) da nuvem para a VPS.
   O banco já levou a lista; aqui vai o conteúdo de cada arquivo.
   Precisa no ambiente: ORIGEM_URL, ORIGEM_SERVICE_KEY, DESTINO_URL, DESTINO_SERVICE_KEY
   (lidos de /opt/joia/migracao.env com:  set -a; source /opt/joia/migracao.env; set +a) */
const O = process.env.ORIGEM_URL, OK = process.env.ORIGEM_SERVICE_KEY;
const D = process.env.DESTINO_URL, DK = process.env.DESTINO_SERVICE_KEY;
if (!O || !OK || !D || !DK) { console.error('faltam variáveis no migracao.env'); process.exit(1); }
const h = (k) => ({ apikey: k, Authorization: 'Bearer ' + k });
(async () => {
  const bks = await (await fetch(O + '/storage/v1/bucket', { headers: h(OK) })).json();
  let n = 0, falhas = 0;
  for (const b of bks) {
    await fetch(D + '/storage/v1/bucket', { method: 'POST', headers: { ...h(DK), 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: b.id, name: b.name, public: b.public }) }).catch(() => {});
    const fila = [''];
    while (fila.length) {
      const pasta = fila.shift();
      const r = await fetch(O + '/storage/v1/object/list/' + b.id, { method: 'POST',
        headers: { ...h(OK), 'Content-Type': 'application/json' }, body: JSON.stringify({ prefix: pasta, limit: 1000 }) });
      for (const it of await r.json()) {
        const caminho = (pasta ? pasta + '/' : '') + it.name;
        if (!it.id) { fila.push(caminho); continue; }               /* é pasta */
        const arq = await fetch(O + '/storage/v1/object/' + b.id + '/' + caminho, { headers: h(OK) });
        if (!arq.ok) { falhas++; console.error('não baixou: ' + b.id + '/' + caminho); continue; }
        const up = await fetch(D + '/storage/v1/object/' + b.id + '/' + caminho, { method: 'POST',
          headers: { ...h(DK), 'Content-Type': arq.headers.get('content-type') || 'application/octet-stream', 'x-upsert': 'true' },
          body: Buffer.from(await arq.arrayBuffer()) });
        if (up.ok) n++; else { falhas++; console.error('não subiu: ' + b.id + '/' + caminho); }
      }
    }
  }
  console.log('ok: ' + n + ' arquivo(s) copiados, ' + falhas + ' falha(s).');
  process.exit(falhas ? 1 : 0);
})();

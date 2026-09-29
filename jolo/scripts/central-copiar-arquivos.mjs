// ============================================================
// Copia os arquivos da Central (fotos do checklist, marketing, reuniões…)
// do Supabase da nuvem para o banco da VPS, um por um, e confere.
//
// A lista sai do banco da VPS (storage.objects, já copiado): cada linha
// é baixada da nuvem e enviada para a VPS com a mesma chave, o mesmo
// caminho e o mesmo tipo. Pode rodar de novo: o que já está igual na
// VPS (mesmo tamanho) é pulado.
//
// Uso (root, no servidor):
//   node central-copiar-arquivos.mjs
// Lê as chaves de /etc/jolo/central.env (a de serviço vale nos dois
// lados, porque o JWT secret é o mesmo).
// ============================================================
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const env = Object.fromEntries(readFileSync('/etc/jolo/central.env', 'utf8')
  .split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const CHAVE = env.SUPABASE_SERVICE_ROLE_KEY;
const NUVEM = 'https://cvarnbkjlvpjehjulsuc.supabase.co/storage/v1';
const VPS = process.env.VPS_STORAGE ?? 'http://127.0.0.1:18000/storage/v1';
const cab = { apikey: CHAVE, Authorization: `Bearer ${CHAVE}` };

const linhas = execFileSync('docker', ['exec', 'central-db', 'psql', '-U', 'supabase_admin', '-d', 'postgres', '-At', '-F', '\t', '-c',
  "select bucket_id, name, coalesce(metadata->>'mimetype','application/octet-stream'), coalesce((metadata->>'size')::bigint,-1) from storage.objects order by bucket_id, name"],
  { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim().split('\n').filter(Boolean)
  .map((l) => { const [b, n, t, s] = l.split('\t'); return { b, n, t, s: Number(s) }; });

const cam = (b, n) => `${encodeURIComponent(b)}/${n.split('/').map(encodeURIComponent).join('/')}`;
let ok = 0, pulou = 0, falhou = 0;
for (const o of linhas) {
  // HEAD nao serve: ele responde pelos dados do banco mesmo sem o arquivo
  // no disco. Pede o arquivo de verdade e compara o tamanho.
  const h = await fetch(`${VPS}/object/authenticated/${cam(o.b, o.n)}`, { headers: cab }).catch(() => null);
  if (h && h.ok && (await h.arrayBuffer()).byteLength === o.s) { pulou++; continue; }
  const r = await fetch(`${NUVEM}/object/authenticated/${cam(o.b, o.n)}`, { headers: cab });
  if (!r.ok) { falhou++; console.error('baixar', r.status, o.b, o.n); continue; }
  const corpo = new Uint8Array(await r.arrayBuffer());
  const u = await fetch(`${VPS}/object/${cam(o.b, o.n)}`, {
    method: 'POST', headers: { ...cab, 'content-type': o.t, 'x-upsert': 'true', 'cache-control': 'max-age=3600' }, body: corpo,
  });
  if (!u.ok) { falhou++; console.error('enviar', u.status, o.b, o.n, (await u.text()).slice(0, 120)); continue; }
  ok++;
}
console.log(`arquivos: ${linhas.length} | copiados ${ok} | ja iguais ${pulou} | falharam ${falhou}`);
process.exit(falhou ? 1 : 0);

/* ==========================================================
   JOIA — A CERCA DO PEDIDO (Missão integridade, fase 5 — 06/10/2026)

   Regra do pedido nº 2: "mexa só no que ele pediu". Até aqui ela era um
   parágrafo; agora é uma etapa do portão.

   Todo pedido declara a sua cerca em `CERCA.json`, na raiz:

     {
       "pedido": "o que o Rafael pediu, em uma linha",
       "arquivos": ["src/js/07-roteador/21-ficha-tecnica.js", "testes/ficha-*.js"],
       "tabelas": ["fichas_tecnicas", "ficha_itens"],
       "mexe_no_motor": false
     }

   O portão compara a cerca com o que mudou de verdade (git, desde a
   `main` publicada) e reprova:
     1. arquivo mudado fora da cerca;
     2. arquivo do MOTOR mudado sem `"mexe_no_motor": true` — o motor é o
        que todo o resto usa: armazenamento e sincronização
        (src/js/03-armazenamento), núcleo (src/js/00-…06-), sw.js,
        migrations, o pages.yml e o próprio portão. Mexer nele não é
        proibido; é declarado, e pede o portão inteiro;
     3. migration que cita tabela fora da cerca.

   Sempre dentro da cerca, sem declarar: o index.html (é gerado do src/),
   os testes e guardiões, a trava (ferramentas/travas.json), a referência
   do banco (ferramentas/esquema-nuvem.json), as fotografias e os
   documentos (*.md). Eles acompanham qualquer mudança.

     node ferramentas/cerca.js           confere (entra no portão)
   ========================================================== */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const RAIZ = path.join(__dirname, '..');
const ARQ = path.join(RAIZ, 'CERCA.json');

const MOTOR = [/^src\/js\/0[0-6][^/]*(\/|$)/, /^src\/js\/03-armazenamento\//, /^sw\.js$/,
  /^supabase\/migrations\//, /^\.github\/workflows\//, /^ferramentas\/portao\.js$/,
  /^ferramentas\/cerca\.js$/, /^package(-lock)?\.json$/];
const SEMPRE = [/^index\.html$/, /^testes\//, /^ferramentas\/travas\.json$/, /^ferramentas\/esquema-nuvem\.json$/,
  /^ferramentas\/fotografias\//, /\.md$/, /^CERCA\.json$/];

function globParaRegex(g) {
  return new RegExp('^' + g.split('*').map(p => p.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*')
    .replace(/\[\^\/\]\*\[\^\/\]\*/g, '.*') + '$');
}
const ehMotor = f => MOTOR.some(r => r.test(f));
const sempre = f => SEMPRE.some(r => r.test(f));

/* o juízo, separado do git para o guardião poder rodá-lo com casos */
function julgar(cerca, mudados, sqlDe) {
  const problemas = [];
  if (!cerca) return { ok: !mudados.length, problemas: mudados.length ? ['sem CERCA.json: declare o pedido antes de mexer'] : [] };
  const globs = (cerca.arquivos || []).map(globParaRegex);
  const dentro = f => sempre(f) || globs.some(r => r.test(f));
  mudados.forEach(f => {
    if (!dentro(f)) problemas.push(f + ' mudou e não está na cerca do pedido');
    if (ehMotor(f) && cerca.mexe_no_motor !== true)
      problemas.push(f + ' é do motor: declare "mexe_no_motor": true (e rode o portão inteiro)');
  });
  const tabs = new Set((cerca.tabelas || []).map(String));
  mudados.filter(f => /^supabase\/migrations\/.*\.sql$/.test(f)).forEach(f => {
    if (tabs.has('*')) return;
    const sql = (sqlDe && sqlDe(f)) || '';
    const citadas = new Set();
    for (const m of sql.matchAll(/\bpublic\.([a-z_][a-z0-9_]*)\b(?!\s*\()/g)) citadas.add(m[1]);
    citadas.forEach(t => { if (!tabs.has(t)) problemas.push(f + ' mexe em ' + t + ', que não está na cerca'); });
  });
  return { ok: !problemas.length, problemas };
}

function mudadosNoGit() {
  let base = null;
  try { base = execSync('git merge-base HEAD origin/main', { cwd: RAIZ, encoding: 'utf8', stdio: 'pipe' }).trim(); }
  catch (e) { base = null; }
  if (!base) return null;
  const out = execSync('git diff --name-only ' + base + ' && git ls-files --others --exclude-standard',
    { cwd: RAIZ, encoding: 'utf8', stdio: 'pipe' });
  return [...new Set(out.split('\n').map(s => s.trim()).filter(Boolean))].sort();
}

if (require.main === module) {
  const mudados = mudadosNoGit();
  if (mudados === null) { console.log('cerca: sem a main publicada para comparar — nada a conferir'); process.exit(0); }
  if (!mudados.length) { console.log('cerca: nada mudou desde a main publicada'); process.exit(0); }
  let cerca = null;
  try { cerca = JSON.parse(fs.readFileSync(ARQ, 'utf8')); } catch (e) { cerca = null; }
  const r = julgar(cerca, mudados, f => { try { return fs.readFileSync(path.join(RAIZ, f), 'utf8'); } catch (e) { return ''; } });
  console.log('Cerca do pedido: ' + (cerca ? '"' + cerca.pedido + '"' : '(sem CERCA.json)'));
  console.log('  ' + mudados.length + ' arquivo(s) mudaram desde a main' + (cerca && cerca.mexe_no_motor ? ' · mexe no motor (declarado)' : ''));
  if (r.ok) { console.log('  ✓ tudo dentro da cerca'); process.exit(0); }
  r.problemas.forEach(p => console.log('  ✗ ' + p));
  process.exit(1);
}

module.exports = { julgar, ehMotor, globParaRegex };

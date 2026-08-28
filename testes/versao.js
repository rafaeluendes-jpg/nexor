/* ==========================================================
   VERSAO — as duas sobem juntas, ou a loja fica na versao velha

   Foi o defeito da V195: `index.html` subiu com a versao nova e o
   `sw.js` ficou com a antiga. O navegador compara o service worker byte
   a byte; igual, ele nao instala nada, o service worker velho continua
   servindo o sistema velho do cache, e a loja fica presa numa versao
   que ninguem mais publica.

   Nao adianta a regra estar escrita no CLAUDE.md: regra que depende de
   alguem lembrar e a que falha. Esta suite reprova a publicacao.
   ========================================================== */
const fs = require('fs');
const path = require('path');

const raiz = path.join(__dirname, '..');
const sistema = fs.readFileSync(path.join(raiz, 'index.html'), 'utf8');
const worker  = fs.readFileSync(path.join(raiz, 'sw.js'), 'utf8');

const vSistema = (sistema.match(/var VERSAO='(V[0-9.]+)'/) || [])[1];
const vWorker  = (worker.match(/VERSAO_SW\s*=\s*'(V[0-9.]+)'/) || [])[1];

if (!vSistema) { console.error('versao: nao achei `var VERSAO=` no index.html'); process.exit(1); }
if (!vWorker)  { console.error('versao: nao achei `VERSAO_SW=` no sw.js');      process.exit(1); }

if (vSistema !== vWorker) {
  console.error('versao: REPROVADO — as duas versoes nao batem');
  console.error('  index.html  VERSAO    = ' + vSistema);
  console.error('  sw.js       VERSAO_SW = ' + vWorker);
  console.error('');
  console.error('  Publicar assim deixa a loja na versao velha: o navegador so');
  console.error('  troca o service worker se o arquivo dele mudar. Foi a V195.');
  process.exit(1);
}

console.log('versao: index.html e sw.js na mesma ' + vSistema);

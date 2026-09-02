/* ==========================================================
   JOIA — A SEMENTE DE FÁBRICA NÃO REPÕE A TAXA DA LOJA

   02/09/2026. A taxa de cartão de Santa Fé voltava sozinha ao valor de
   fábrica (débito 1,99% / crédito 3,49%), mesmo depois de corrigida para
   a taxa real (0,73% / 2,73%). O aparelho enchia a lista de formas com o
   valor de FÁBRICA quando ela ficava vazia por um instante — e o envio
   seguinte levava isso para a nuvem, por cima da taxa real da loja.

   A regra: valor de fábrica só entra quando o registro NÃO EXISTE, e
   "existe" é "a nuvem já conhece" (há uuid guardado no aparelho). Esta
   suíte roda a `baseFormas` REAL, extraída do index.html.

   Rodar:  node testes/semente-nao-repoe-taxa.js
   ========================================================== */
const fs = require('fs');
const { corpoDaFuncao, ARQ } = require('./extrair.js');
const fonte = fs.readFileSync(ARQ, 'utf8');

let falhas = 0, testes = 0;
function t(nome, ok, det) {
  testes++;
  if (ok) console.log('   ok   ' + nome);
  else { falhas++; console.log('   FALHOU  ' + nome + (det !== undefined ? '  → ' + det : '')); }
}

/* monta a baseFormas real, com syncFormas e n() neutralizados */
function montar(DB) {
  return new Function('DB', 'ctx', `
    var FORMAS=[];
    function syncFormas(){ ctx.syncou=true; }
    function n(v){ return Number(v)||0; }
    ${corpoDaFuncao('baseFormas', fonte)}
    baseFormas();
    return DB;
  `)(DB, {});
}

console.log('\n── A loja que a nuvem já conhece não recebe fábrica por cima\n');

/* Santa Fé: taxa real 0,73/2,73 já veio da nuvem; a lista fica vazia por
   um instante (um estado zerado), mas o uuid das formas está guardado */
let DB = { formasPag: [], _uuid: { formasPag: {
  fp_debito: 'uuid-1', fp_credito: 'uuid-2', fp_dinheiro: 'uuid-3',
  fp_pix: 'uuid-4', fp_voucher: 'uuid-5' } } };
montar(DB);
t('lista vazia + nuvem já conhece ⇒ NÃO semeia fábrica',
  DB.formasPag.length === 0, 'semeou ' + DB.formasPag.length + ' formas');
t('e assim o download traz a taxa REAL, sem 1,99 no caminho',
  !DB.formasPag.some(function (f) { return f.taxaPct === 1.99 || f.taxaPct === 3.49; }));

console.log('\n── A loja nova (a nuvem nunca soube) ainda recebe a semente\n');

DB = { formasPag: [], _uuid: {} };
montar(DB);
t('lista vazia + sem uuid ⇒ semeia as 5 formas de fábrica',
  DB.formasPag.length === 5, 'semeou ' + DB.formasPag.length);
t('com o débito e o crédito de fábrica, para a loja começar',
  DB.formasPag.some(function (f) { return f.id === 'fp_debito' && f.taxaPct === 1.99; }) &&
  DB.formasPag.some(function (f) { return f.id === 'fp_credito' && f.taxaPct === 3.49; }));

console.log('\n── Uma lista que já tem formas nunca é tocada\n');

DB = { formasPag: [
  { id: 'fp_debito', nome: 'Cartão débito', tipo: 'debito', taxaPct: 0.73 },
  { id: 'fp_credito', nome: 'Cartão crédito', tipo: 'credito', taxaPct: 2.73 }
], _uuid: { formasPag: { fp_debito: 'uuid-1' } } };
montar(DB);
t('a taxa real de Santa Fé (0,73/2,73) permanece intacta',
  DB.formasPag.length === 2 &&
  DB.formasPag[0].taxaPct === 0.73 && DB.formasPag[1].taxaPct === 2.73);

console.log('\n── A trava está escrita no código, não só no comportamento\n');
const bf = corpoDaFuncao('baseFormas', fonte);
t('baseFormas consulta o uuid antes de semear',
  /_jaNaNuvem[\s\S]*DB\._uuid[\s\S]*formasPag/.test(bf));
t('só grava a semente quando a lista está vazia',
  /if\(!DB\.formasPag\|\|!DB\.formasPag\.length\)/.test(bf));
t('e dentro disso, só quando a nuvem não conhece as formas',
  /if\(!_jaNaNuvem\)\s*DB\.formasPag=/.test(bf));

console.log('\n' + (falhas ? '✗ ' + falhas + ' de ' + testes + ' falharam'
                           : '✓ ' + testes + ' verificações, todas certas') + '\n');
process.exit(falhas ? 1 : 0);

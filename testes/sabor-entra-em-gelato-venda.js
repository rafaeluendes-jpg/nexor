/* ==========================================================
   JOIA — SABOR DE GELATO SÓ ENTRA EM GELATO VENDA

   Rodar:  node testes/sabor-entra-em-gelato-venda.js
   ou:     npm run test:saborgv   (entra no portão)

   POR QUE ESTE ARQUIVO EXISTE (relato do Rafael, 10/09/2026)

   As fichas de sabor DIZIAM destino "GELATO VENDA" (destinoNome), mas o
   destinoId apontava para o item do próprio sabor. Cada produção
   engordava o sabor e o GELATO VENDA — o que o PDV vende — só descia:
   ficou negativo nas duas unidades. Corrigir só na nuvem não segurou:
   o aparelho subiu o valor antigo por cima na sincronização seguinte.

   A regra agora mora em `repararDestinos()`, que roda em todo aparelho:
   quem se declara GELATO VENDA aponta para ele. Base nunca vira gelato
   venda — é intermediária e fica no próprio item. Este guardião trava
   as duas coisas.
   ========================================================== */
const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs');
const path = require('path');
const ARQ = path.join(__dirname, '..', 'index.html');

const R = { total: 0, ok: 0, falhou: 0 };
function grupo(n) { console.log('\n── ' + n); }
function t(nome, cond, det) {
  R.total++;
  if (cond) { R.ok++; console.log('   ok   ' + nome); }
  else { R.falhou++; console.log('   FALHA ' + nome + (det !== undefined ? '  → ' + det : '')); }
}

const erros = [];
async function carregar() {
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => erros.push('jsdomError: ' + (e && e.message)));
  const html = fs.readFileSync(ARQ, 'utf8');
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', pretendToBeVisual: true,
    url: 'https://joiagest.com.br/', virtualConsole: vc,
    beforeParse(win) {
      win.fetch = () => Promise.reject(new Error('offline no teste'));
      win.matchMedia = win.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} }));
      win.scrollTo = () => {}; win.print = () => {}; win.alert = () => {}; win.confirm = () => true;
      win.crypto = win.crypto || {};
      if (!win.crypto.subtle) win.crypto.subtle = { digest: async () => new ArrayBuffer(32) };
      win.addEventListener('error', e => erros.push('window.onerror: ' + (e.error && e.error.message || e.message)));
      win.addEventListener('unhandledrejection', e => erros.push('unhandledrejection: ' + (e.reason && e.reason.message || e.reason)));
    }
  });
  await new Promise(r => setTimeout(r, 900));
  return dom.window;
}

(async function () {
  console.log('\nCarregando o sistema para o guardião do gelato venda…');
  let win;
  try { win = await carregar(); }
  catch (e) { console.log('   FALHA não carregou o index.html: ' + e.message); process.exit(1); }

  grupo('As peças existem');
  ['repararDestinos', 'itemEstoque'].forEach(fn =>
    t('existe ' + fn + '()', typeof win[fn] === 'function', typeof win[fn]));

  win.salvar = () => {};
  win.logNuvem = () => {};
  win.DB = win.DB || {};
  win.DB.fichaCats = [];
  /* o item que o PDV vende + dois "gêmeos" de sabor + o item da base */
  win.DB.insumos = [
    { id: 'gv1', nome: 'GELATO VENDA', gelatoVenda: true, unidade: 'kg', controlaEstoque: true },
    { id: 'tw_belga', nome: 'BELGA GELATO', unidade: 'kg', controlaEstoque: true },
    { id: 'tw_morango', nome: 'MORANGO GELATO', unidade: 'kg', controlaEstoque: true },
    { id: 'tw_base', nome: 'BASE ABACAXI', unidade: 'kg', controlaEstoque: true }
  ];
  win.DB.fichas = [
    /* diz GELATO VENDA mas aponta pro próprio sabor — o bug */
    { id: 'f_belga', nome: 'BELGA GELATO', destinoId: 'tw_belga', destinoNome: 'GELATO VENDA', itens: [], rendimento: 4 },
    { id: 'f_morango', nome: 'MORANGO GELATO', destinoId: 'tw_morango', destinoNome: 'GELATO VENDA', itens: [], rendimento: 4 },
    /* base: também diz GELATO VENDA (dado sujo), mas base NÃO vira gelato venda */
    { id: 'f_base', nome: 'BASE ABACAXI', destinoId: 'tw_base', destinoNome: 'GELATO VENDA', itens: [], rendimento: 1 },
    /* já certo: não pode ser mexido */
    { id: 'f_ok', nome: 'PISTACHE GELATO', destinoId: 'gv1', destinoNome: 'GELATO VENDA', itens: [], rendimento: 4 }
  ];

  grupo('Sabor que se declara GELATO VENDA passa a apontar para ele');
  const n = win.repararDestinos();
  const f = id => win.DB.fichas.find(x => x.id === id);
  t('BELGA GELATO → GELATO VENDA', f('f_belga').destinoId === 'gv1', f('f_belga').destinoId);
  t('MORANGO GELATO → GELATO VENDA', f('f_morango').destinoId === 'gv1', f('f_morango').destinoId);
  t('religou exatamente 2 (os dois errados)', n === 2, n);

  grupo('O que não pode mudar');
  t('BASE ABACAXI continua no próprio item (base não vira gelato venda)',
    f('f_base').destinoId === 'tw_base', f('f_base').destinoId);
  t('ficha já certa fica como está', f('f_ok').destinoId === 'gv1');

  grupo('Rodar de novo não mexe em nada (idempotente)');
  const n2 = win.repararDestinos();
  t('segunda passada religa 0', n2 === 0, n2);

  grupo('Balanço: zero erro de runtime durante o guardião');
  t('nenhum erro de runtime na sessão inteira', erros.length === 0, erros.slice(0, 8).join(' | '));

  console.log('\n' + '═'.repeat(52));
  console.log('Joia · Sabor de gelato só entra em GELATO VENDA');
  console.log(R.ok + ' de ' + R.total + ' testes passaram' + (R.falhou ? ' · ' + R.falhou + ' FALHA(S)' : ''));
  console.log('═'.repeat(52) + '\n');
  try { win.close(); } catch (e) {}
  process.exit(R.falhou ? 1 : 0);
})();

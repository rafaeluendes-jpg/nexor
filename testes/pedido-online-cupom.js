/* ==========================================================
   JOIA — O CUPOM DO PEDIDO ONLINE SAI COMPLETO (05/09/2026)

   Rodar:  node testes/pedido-online-cupom.js
   ou:     npm run test:online-cupom   (entra no portão)

   POR QUE ESTE ARQUIVO EXISTE

   Um pedido de entrega vindo do cardápio online (Santa Fé, pedido 924)
   saiu com dois erros no cupom: o topo virou "Alphaville" (a matriz) e a
   forma de pagamento saiu só "Pagamento", sem o nome. Os dois vinham do
   pedido online nascer "magro" — sem a loja certa e sem o NOME da forma —
   e por isso dependia do cadastro e da lista de unidades já terem descido
   da nuvem: o estado ruim. O PDV não tem esses defeitos porque grava tudo
   na hora da venda.

   Este guardião trava a correção NO ESTADO RUIM (cadastro vazio):
     · a forma de pagamento sempre sai com nome, nunca "Pagamento";
     · a loja da venda é a do CAIXA que aceitou, não a matriz.
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

async function carregar() {
  const vc = new VirtualConsole();
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
    }
  });
  await new Promise(r => setTimeout(r, 900));
  return dom.window;
}

(async function () {
  console.log('\nCarregando o sistema para o guardião do cupom online…');
  let win;
  try { win = await carregar(); }
  catch (e) { console.log('   FALHA não carregou o index.html: ' + e.message); process.exit(1); }

  grupo('As peças existem');
  ['pagamentoOnline', 'sucursalDoPedidoOnline', 'nomeFormaPag']
    .forEach(fn => t('existe ' + fn + '()', typeof win[fn] === 'function', typeof win[fn]));

  /* ESTADO RUIM: cadastro de formas vazio, como quando a nuvem ainda não desceu */
  win.DB.formasPag = []; win.FORMAS = [];

  grupo('A forma de pagamento sempre sai com nome (cadastro vazio)');
  ['Dinheiro', 'Pix', 'Cartão de crédito'].forEach(txt => {
    const pg = win.pagamentoOnline({ forma_pagamento: txt, total: 81 });
    t('carimba um nome de verdade para "' + txt + '" (nunca "Pagamento")',
      !!pg.formaNome && pg.formaNome !== 'Pagamento' && new RegExp(txt.split(' ')[0], 'i').test(pg.formaNome),
      JSON.stringify(pg));
    t('e o cupom (nomeFormaPag) NÃO cai em "Pagamento" para "' + txt + '"',
      win.nomeFormaPag(pg) !== 'Pagamento' && new RegExp(txt.split(' ')[0], 'i').test(win.nomeFormaPag(pg)),
      win.nomeFormaPag(pg));
  });

  grupo('Com o cadastro carregado, usa o nome cadastrado');
  win.DB.formasPag = [{ id: 'fp_pix', nome: 'Pix Joia', tipo: 'pix' }];
  const pgPix = win.pagamentoOnline({ forma_pagamento: 'Pix', total: 50 });
  t('a forma resolve para a do cadastro (id)', pgPix.forma === 'fp_pix', JSON.stringify(pgPix));
  t('o nome sai o do cadastro', pgPix.formaNome === 'Pix Joia', pgPix.formaNome);
  t('e o tipo vem junto', pgPix.tipo === 'pix', pgPix.tipo);

  grupo('A loja da venda é a do CAIXA que aceitou (não a matriz)');
  win.DB.formasPag = [];
  win.lojaAtualId = () => 'suc_matriz';          /* aparelho resolveu matriz no instante do aceite */
  win.caixaAberto = () => ({ id: 'cx_1', sucursalId: 'suc_santafe' });
  t('herda a loja do caixa aberto (Santa Fé), não a matriz',
    win.sucursalDoPedidoOnline({}) === 'suc_santafe', win.sucursalDoPedidoOnline({}));
  t('o cardápio manda a loja? ela vence', win.sucursalDoPedidoOnline({ sucursal_id: 'suc_z' }) === 'suc_z');
  win.caixaAberto = () => null;
  t('sem caixa aberto, cai no lojaAtualId (não estoura)',
    win.sucursalDoPedidoOnline({}) === 'suc_matriz', win.sucursalDoPedidoOnline({}));

  console.log('\n' + '═'.repeat(52));
  console.log('Joia · O cupom do pedido online sai completo');
  console.log(R.ok + ' de ' + R.total + ' testes passaram' + (R.falhou ? ' · ' + R.falhou + ' FALHA(S)' : ''));
  console.log('═'.repeat(52) + '\n');
  try { win.close(); } catch (e) {}
  process.exit(R.falhou ? 1 : 0);
})();

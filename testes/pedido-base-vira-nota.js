/* ==========================================================
   JOIA — O PEDIDO DE BASE DÁ ENTRADA PELA NOTA, JÁ PREENCHIDA

   Rodar:  node testes/pedido-base-vira-nota.js
   ou:     npm run test:pbnota   (entra no portão)

   POR QUE ESTE ARQUIVO EXISTE (Rafael, 16/09/2026)
   Na tela de pedidos de base da unidade, ao lado do olho, um botão abre a
   nota de entrada já cheia: cada base com quantidade e preço do pedido,
   ligada ao item do estoque, fornecedor Franqueador. A pessoa confere
   (o total tem de bater com o pedido), confirma, e o estoque entra na
   hora; o financeiro abre em seguida com a conta a pagar. Se parar ali,
   a nota fica em Compras sem Vínculo.
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
    }
  });
  await new Promise(r => setTimeout(r, 900));
  return dom.window;
}

(async function () {
  console.log('\nCarregando o sistema para o guardião do pedido de base → nota…');
  let win;
  try { win = await carregar(); }
  catch (e) { console.log('   FALHA não carregou o index.html: ' + e.message); process.exit(1); }
  const doc = win.document;
  const toasts = []; win.toast = m => toasts.push(String(m));
  win.salvar = () => {}; win.logNuvem = () => {}; win.pintarSino = () => {};
  win.telaNotas = () => {}; win.telaPedidoBase = () => {};
  let financeiro = null; win.abrirFinanceiroNota = n => { financeiro = n; };

  grupo('As peças existem');
  ['abrirNotaDoPedidoBase', 'fornecedorFranqueador', 'itemEstoquePorNome', 'marcarEntradaDoPedidoBase',
   'confirmarNota', 'materializarNota', 'vincularLancsANota'].forEach(fn =>
    t('existe ' + fn + '()', typeof win[fn] === 'function', typeof win[fn]));

  /* a unidade de Santa Fé, com uma base (ficha estocável) e um insumo */
  win.DB.sucursais = [{ id: 'suc_sf', nome: 'Santa Fé', ativa: true }];
  win.DB.lojaAtual = 'suc_sf'; win.lojaAtualId = () => 'suc_sf';
  win.DB.fornec = []; win.DB.notas = []; win.DB.lancFin = []; win.DB.movEst = []; win.DB.comprasSemVinc = [];
  win.DB.fichaCats = []; win.DB.estoqueUn = [];
  /* como em Santa Fé: a ficha "BASE NINHO" é a receita da matriz (não estocável)
     e o INSUMO "BASE NINHO" é o que a unidade estoca e as receitas consomem */
  win.DB.insumos = [{ id: 'ins_ac', nome: 'Açúcar', unidade: 'kg', controlaEstoque: true, estoqueAtual: 0 },
                    { id: 'ins_bn', nome: 'BASE NINHO', unidade: 'un', controlaEstoque: true, estoqueAtual: 0, sucursais: ['suc_sf'] }];
  win.DB.fichas = [{ id: 'f_bm', nome: 'BASE MORANGO', unidade: 'kg', estocavel: true, itens: [], rendimento: 1, estoqueAtual: 0 },
                   { id: 'f_bn', nome: 'BASE NINHO', unidade: 'un', estocavel: false, itens: [], rendimento: 1 }];
  win.DB.pedidosBase = [{ id: 'pb1', numero: 7, sucursalRef: 'suc_sf', sucursalNome: 'Santa Fé', data: '2026-09-15',
    situacao: 'entregue', total: 470, entradaEstoque: false,
    itens: [{ id: 'i1', baseRef: 'b1', baseNome: 'BASE MORANGO', fichaRef: 'f_bm', qtd: 2, porCaixa: 5, precoUnit: 10, valorUnit: 50, total: 100 },
            { id: 'i2', baseRef: 'b2', baseNome: 'Açúcar', fichaRef: '', qtd: 1, porCaixa: 1, precoUnit: 20, valorUnit: 20, total: 20 },
            { id: 'i3', baseRef: 'b3', baseNome: 'Base Ninho', fichaRef: 'f_bn', qtd: 5, porCaixa: 1, precoUnit: 70, valorUnit: 70, total: 350 }] }];

  grupo('O botão abre a nota já preenchida com as bases do pedido');
  win.abrirNotaDoPedidoBase('pb1');
  const n = win._nota;
  t('a nota nasceu com as 3 bases', !!n && (n.itens || []).length === 3, n && n.itens && n.itens.length);
  t('fornecedor é o Franqueador (criado sozinho)', n.fornecedorNome === 'Franqueador' && win.DB.fornec.some(f => /franqueador/i.test(f.empresa)));
  t('o Franqueador nasce visível em todas as unidades', (win.DB.fornec.find(f => /franqueador/i.test(f.empresa)) || {}).sucursais.indexOf('*') >= 0);
  const i0 = n.itens[0], i1 = n.itens[1];
  t('base ligada à ficha, em unidades (2 caixas × 5 = 10) a R$ 10', i0.insumoId === 'f_bm' && i0.qtd === 10 && i0.valorUn === 10 && i0.total === 100, JSON.stringify(i0));
  t('item sem ficha ligado ao insumo de mesmo nome', i1.insumoId === 'ins_ac' && i1.total === 20, JSON.stringify(i1));
  const i2 = n.itens[2];
  t('BASE NINHO vai para o INSUMO de mesmo nome, não para a ficha da matriz (5 un a R$ 70)',
    i2.insumoId === 'ins_bn' && i2.qtd === 5 && i2.valorUn === 70 && i2.total === 350, JSON.stringify(i2));
  t('a nota lembra o pedido e o total esperado (R$ 470)', n.pedidoBaseRef === 'pb1' && n.valorEsperado === 470);
  t('a tela mostra "Pedido de base #0007" e "confere"', /Pedido de base #0007/.test(doc.body.innerHTML) && /confere/.test(doc.body.innerHTML));

  grupo('Total que não bate: avisa e não dá entrada');
  n.itens[0].total = 90; win.desenhaNota();
  t('a tela avisa "não bate"', /não bate/.test(doc.body.innerHTML));
  toasts.length = 0; win.confirmarNota();
  t('recusou com "não bate com o pedido de base"', toasts.some(x => /não bate com o pedido de base/.test(x)), toasts.join(' | '));
  t('nada entrou: sem nota, sem movimento, pedido não marcado', win.DB.notas.length === 0 && win.DB.movEst.length === 0 && !win.DB.pedidosBase[0].entradaEstoque);

  grupo('Total certo: estoque entra na hora e o financeiro abre');
  win._nota.itens[0].total = 100; win.desenhaNota();
  toasts.length = 0; win.confirmarNota();
  const nota = win.DB.notas[0];
  t('a nota foi gravada', !!nota && nota.valorTotal === 470, nota && nota.valorTotal);
  const mov = win.DB.movEst[0];
  t('o movimento de entrada existe (NF) com as 3 linhas', !!mov && mov.origem === 'nota' && mov.linhas.length === 3, mov && JSON.stringify(mov.linhas));
  t('BASE NINHO entrou no insumo com 5 un', mov && mov.linhas.some(l => l.insumoId === 'ins_bn' && l.qtd === 5 && l.direcao === 'entrada'));
  const saldoNinho = typeof win.saldoUn === 'function' ? win.saldoUn('ins_bn', 'suc_sf') : win.DB.insumos[1].estoqueAtual;
  t('o estoque de BASE NINHO na unidade é 5', Math.abs(saldoNinho - 5) < 0.0001, saldoNinho);
  t('a base (ficha) entrou com 10 kg', mov && mov.linhas.some(l => l.insumoId === 'f_bm' && l.qtd === 10 && l.direcao === 'entrada'));
  t('o insumo entrou com 1 kg', mov && mov.linhas.some(l => l.insumoId === 'ins_ac' && l.qtd === 1));
  const saldoBase = typeof win.saldoUn === 'function' ? win.saldoUn('f_bm', 'suc_sf') : win.DB.fichas[0].estoqueAtual;
  t('o saldo da base na unidade é 10', Math.abs(saldoBase - 10) < 0.0001, saldoBase);
  const p = win.DB.pedidosBase[0];
  t('o pedido ficou "no estoque" e aponta para a nota', p.entradaEstoque === true && p.notaRef === nota.id && p.movEntradaRef === mov.id);
  t('o financeiro abriu com a nota', financeiro && financeiro.id === nota.id);
  t('enquanto o financeiro não é feito, a nota está em Compras sem Vínculo', win.DB.comprasSemVinc.some(c => c.notaId === nota.id && c.tipo === 'pendente'));

  grupo('Financeiro feito: a conta a pagar fica no pedido e a nota sai de "sem vínculo"');
  const lanc = { id: 'lf_1', tipo: 'despesa', valor: 470, pago: false };
  win.DB.lancFin.push(lanc);
  win.vincularLancsANota(nota, [lanc]);
  t('o lançamento é do Franqueador', lanc.fornecedor === 'Franqueador' && lanc.origem === 'nota-entrada');
  t('o pedido de base aponta para a conta a pagar', p.finPagarRef === 'lf_1', p.finPagarRef);
  t('saiu de Compras sem Vínculo', !win.DB.comprasSemVinc.some(c => c.notaId === nota.id));

  grupo('"Recebi as bases" usa a mesma porta: BASE NINHO cai no insumo');
  win.DB.pedidosBase.push({ id: 'pb2', numero: 8, sucursalRef: 'suc_sf', sucursalNome: 'Santa Fé', data: '2026-09-16',
    situacao: 'entregue', total: 140, entradaEstoque: false,
    itens: [{ id: 'j1', baseRef: 'b3', baseNome: 'BASE NINHO', fichaRef: 'f_bn', qtd: 2, porCaixa: 1, precoUnit: 70, valorUnit: 70, total: 140 }] });
  win.confirmar = async () => true;
  await win.receberPedidoBase('pb2');
  const movR = win.DB.movEst[win.DB.movEst.length - 1];
  t('o movimento do recebimento aponta para o insumo BASE NINHO', movR && movR.linhas.some(l => l.insumoId === 'ins_bn' && l.qtd === 2 && l.tipo === 'insumo'), movR && JSON.stringify(movR.linhas));
  const saldoNinho2 = typeof win.saldoUn === 'function' ? win.saldoUn('ins_bn', 'suc_sf') : win.DB.insumos[1].estoqueAtual;
  t('o estoque de BASE NINHO passou a 7', Math.abs(saldoNinho2 - 7) < 0.0001, saldoNinho2);
  t('o pedido #0008 ficou "no estoque"', win.DB.pedidosBase[1].entradaEstoque === true);

  grupo('Não entra duas vezes');
  toasts.length = 0; win.abrirNotaDoPedidoBase('pb1');
  t('avisa que já entrou no estoque', toasts.some(x => /já entrou no estoque/.test(x)), toasts.join(' | '));

  grupo('O botão está na lista da unidade, ao lado do olho');
  const html = fs.readFileSync(ARQ, 'utf8');
  const tela = html.slice(html.indexOf('function telaPedidoBase('), html.indexOf('function telaPedidoBase(') + 12000);
  t('a linha tem o botão abrirNotaDoPedidoBase antes do olho', /abrirNotaDoPedidoBase\([\s\S]{0,400}verPedidoBase\(/.test(tela));
  t('o botão some quando já entrou no estoque', /!p\.entradaEstoque[\s\S]{0,200}abrirNotaDoPedidoBase/.test(tela));
  t('a coluna do olho continua a mesma', /<th style="width:52px"><\/th>/.test(tela));

  grupo('Balanço: zero erro de runtime durante o guardião');
  t('nenhum erro de runtime na sessão inteira', erros.length === 0, erros.slice(0, 8).join(' | '));

  console.log('\n' + '═'.repeat(52));
  console.log('Joia · Pedido de base dá entrada pela nota');
  console.log(R.ok + ' de ' + R.total + ' testes passaram' + (R.falhou ? ' · ' + R.falhou + ' FALHA(S)' : ''));
  console.log('═'.repeat(52) + '\n');
  try { win.close(); } catch (e) {}
  process.exit(R.falhou ? 1 : 0);
})();

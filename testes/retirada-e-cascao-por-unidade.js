/* ==========================================================
   JOIA — RETIRADA DO CARDÁPIO, LOJA CERTA NO CUPOM E CASCÃO POR UNIDADE

   Rodar:  node testes/retirada-e-cascao-por-unidade.js
   ou:     npm run test:retirada   (entra no portão)

   POR QUE ESTE ARQUIVO EXISTE (relato do Rafael, 13/09/2026, Santa Fé)

   1. O pedido 1519 veio do cardápio digital como RETIRADA e o PDV o
      gravou como venda de balcão: saiu "FICHA" no papel e foi direto
      para a coluna de concluído no Kanban, sem ninguém preparar.
   2. A mesma ficha saiu com "Alphaville" em cima, logado em Santa Fé:
      o cardápio manda o uuid da nuvem como loja, o aparelho só conhece
      o id local, e a busca caía na primeira unidade da lista.
   3. Pedido 1521: "2 Cascão 1 Bola / 1x Borda Nutella" — quem monta não
      sabe se a borda é de um cascão ou dos dois. Agora sai um embaixo
      do outro, cada um com a sua borda e o valor de uma unidade.
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

const UUID_SF = 'f0de0748-3532-4f4c-b107-3dc2e90e696e';

(async function () {
  console.log('\nCarregando o sistema para o guardião da retirada…');
  let win;
  try { win = await carregar(); }
  catch (e) { console.log('   FALHA não carregou o index.html: ' + e.message); process.exit(1); }

  grupo('As peças existem');
  ['aceitarPedidoOnline', 'sucLocalDaNuvem', 'repararLojaDosPedidos', 'statusInicial',
   'linhasItens', 'blocosParaModelo', 'dadosImp'].forEach(fn =>
    t('existe ' + fn + '()', typeof win[fn] === 'function', typeof win[fn]));

  /* o aparelho de Santa Fé: Alphaville é a PRIMEIRA da lista, de propósito */
  win.salvar = () => {}; win.toast = () => {}; win.logNuvem = () => {};
  win.DB = win.DB || {};
  win.DB.sucursais = [
    { id: 'suc_alpha', nome: 'Jolo Alphaville', apelido: 'Alphaville', ativa: true },
    { id: 'suc_santafe', nome: 'Jolo Santa Fe do Sul', apelido: 'Santa Fé do Sul', ativa: true }
  ];
  win.DB._uuid = { sucursais: { suc_alpha: '16b892a6-0000-0000-0000-000000000000', suc_santafe: UUID_SF } };
  win.DB.grupos = []; win.DB.produtos = []; win.DB.clientes = []; win.DB.pedidos = [];
  win.DB.statusVenda = []; win.baseStatus();
  win.caixaAberto = () => ({ id: 'cx_1', sucursalId: 'suc_santafe' });
  win.lojaAtualId = () => 'suc_santafe';

  grupo('2. A loja que vem da nuvem é traduzida para a do aparelho');
  t('uuid de Santa Fé vira o id local', win.sucLocalDaNuvem(UUID_SF) === 'suc_santafe', win.sucLocalDaNuvem(UUID_SF));
  t('id local conhecido fica como está', win.sucLocalDaNuvem('suc_alpha') === 'suc_alpha');
  t('id de ninguém devolve vazio (não cai na primeira)', win.sucLocalDaNuvem('xyz') === '');
  win.DB.pedidos = [{ id: 'p_velho', numero: 1519, tipo: 'loja', sucursalId: UUID_SF, itens: [], total: 71 }];
  const n = win.repararLojaDosPedidos();
  t('o pedido 1519 gravado com o uuid é consertado no arranque', n === 1 && win.DB.pedidos[0].sucursalId === 'suc_santafe', n + ' ' + win.DB.pedidos[0].sucursalId);
  t('rodar de novo não mexe em nada', win.repararLojaDosPedidos() === 0);
  const d = win.dadosImp({ tipo: 'loja', sucursalId: UUID_SF, itens: [], total: 0 });
  t('o cupom do pedido com uuid sai com "Santa Fé do Sul", não "Alphaville"', d.loja === 'Santa Fé do Sul', d.loja);

  grupo('1. Retirada do cardápio entra na fila e diz RETIRADA no papel');
  const fin = win.statusDoPapel('finalizado');
  t('retirada NÃO nasce concluída', win.statusInicial('retirada') !== fin && win.statusInicial('retirada') === win.statusInicial('entrega'),
    win.statusInicial('retirada') + ' vs ' + fin);
  t('venda de balcão continua nascendo concluída', win.statusInicial('loja') === fin);
  win.confirmar = async () => true; win.api = async () => ({}); win.sincronizar = () => {};
  win.desenhaPedidosOnline = () => {}; win.enviarResumoPedido = () => {}; win.imprimirVia = () => {};
  win.baixarEstoqueVenda = () => {}; win.NUVEM = win.NUVEM || {}; win.NUVEM.ligada = false;
  win.PON = win.PON || {}; win.PON.lista = [{ id: 'on_1', numero: '699899', tipo: 'retirada', sucursal_id: UUID_SF,
    cliente_nome: 'Vitória', cliente_tel: '(17) 99735-7747', forma_pagamento: 'Cartão de crédito', total: 71,
    itens: [{ nome: 'Gelato 500 Gramas', qtd: 1, unitario: 65, total: 71,
      opcoes: [{ nome: 'Cascão Tradicional', preco: 3 }, { nome: 'Cascão Tradicional', preco: 3 }] }] }];
  await win.aceitarPedidoOnline('on_1');
  const ped = win.DB.pedidos.find(p => p.origemOnline === 'on_1');
  t('o pedido entrou no PDV', !!ped);
  t('como RETIRADA, não como venda de balcão', ped && ped.tipo === 'retirada', ped && ped.tipo);
  t('na primeira coluna da fila, não em concluído', ped && ped.fase === win.statusInicial('entrega'), ped && ped.fase);
  t('com a loja de Santa Fé (id local), não o uuid', ped && ped.sucursalId === 'suc_santafe', ped && ped.sucursalId);
  const dr = win.dadosImp(ped);
  t('o título do cupom é RETIRADA', dr.titulo === 'RETIRADA', dr.titulo);
  t('e o cabeçalho é Santa Fé', dr.loja === 'Santa Fé do Sul', dr.loja);
  const txtPadrao = win.blocosParaModelo([{ t: 'titulo', on: true, texto: 'FICHA' }]);
  t('o bloco de título de fábrica acompanha o pedido ({titulo})', /\{titulo\}/.test(txtPadrao), txtPadrao);
  const txtLoja = win.blocosParaModelo([{ t: 'titulo', on: true, texto: 'COMANDA' }]);
  t('título escrito pela loja continua saindo como ela escreveu', /COMANDA/.test(txtLoja) && !/\{titulo\}/.test(txtLoja), txtLoja);
  t('venda de balcão continua FICHA', win.dadosImp({ tipo: 'loja', itens: [] }).titulo === 'FICHA');
  const html = fs.readFileSync(ARQ, 'utf8');
  t('o cartão do Kanban e a consulta mostram "Retirada"', (html.match(/p\.tipo==='retirada'\?'Retirada'/g) || []).length >= 2);

  grupo('3. Dois cascões com borda saem um embaixo do outro');
  const linhas = pedido => win.linhasItens(pedido, 48, true).map(l => l.txt);
  const L = linhas({ itens: [{ nome: 'Cascão 1 Bola', qtd: 2, total: 86, opcoes: [{ nome: 'Borda Nutella', preco: 5, qtd: 1 }] }] });
  t('duas linhas de "1  Cascão 1 Bola"', L.filter(x => /^1  Cascão 1 Bola/.test(x)).length === 2, JSON.stringify(L));
  t('nenhuma linha "2  Cascão"', !L.some(x => /^2  Cascão/.test(x)));
  t('uma borda embaixo de cada cascão', L.filter(x => /Borda Nutella/.test(x)).length === 2, JSON.stringify(L));
  t('cada unidade com o valor de uma (43,00)', L.filter(x => /43,00$/.test(x)).length === 2, JSON.stringify(L));
  const S = linhas({ itens: [{ nome: 'Casquinha', qtd: 2, total: 24, opcoes: [] }] });
  t('item sem adicional continua "2  Casquinha" numa linha só', S.filter(x => /^2  Casquinha/.test(x)).length === 1 && S.length === 1, JSON.stringify(S));
  const C = linhas({ itens: [{ nome: 'Copo', qtd: 3, total: 10.01, opcoes: [{ nome: 'Granulado', preco: 0 }] }] });
  const vals = C.filter(x => /^1  Copo/.test(x)).map(x => x.slice(-4));
  t('os centavos fecham: 3,34 + 3,34 + 3,33 = 10,01', vals.join(' ') === '3,34 3,34 3,33', vals.join(' '));
  const semPreco = win.linhasItens({ itens: [{ nome: 'Cascão 1 Bola', qtd: 2, total: 86, opcoes: [{ nome: 'Borda Nutella', preco: 5 }] }] }, 48, false).map(l => l.txt);
  t('a via da produção (sem preço) também desdobra', semPreco.filter(x => /^1  Cascão/.test(x)).length === 2 && !semPreco.some(x => /43,00/.test(x)), JSON.stringify(semPreco));

  grupo('Balanço: zero erro de runtime durante o guardião');
  t('nenhum erro de runtime na sessão inteira', erros.length === 0, erros.slice(0, 8).join(' | '));

  console.log('\n' + '═'.repeat(52));
  console.log('Joia · Retirada do cardápio, loja certa e cascão por unidade');
  console.log(R.ok + ' de ' + R.total + ' testes passaram' + (R.falhou ? ' · ' + R.falhou + ' FALHA(S)' : ''));
  console.log('═'.repeat(52) + '\n');
  try { win.close(); } catch (e) {}
  process.exit(R.falhou ? 1 : 0);
})();

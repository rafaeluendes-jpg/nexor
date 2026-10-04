/* ==========================================================
   ESTOQUE: A BUSCA NÃO DESFAZ A ESCOLHA, E A MASSA TEM CUSTO
   (04/10/2026)

   Rodar:  node testes/estoque-busca-e-custo-da-massa.js
   ou:     npm run test:buscamassa   (entra na bateria e no portão)

   Rafael:
     · "Em Item, clico em MASSA CASCAO TRADICIONAL e fica só MASSA. Tem de
       aparecer o nome inteiro." O redesenho tirava o campo da tela e o
       navegador disparava nele "change" com o texto digitado, no meio do
       redesenho, desfazendo a escolha (provado no Chromium).
     · "Na Movimentação de Mercadoria, começo a escrever e ele puxa
       sozinho, não deixa eu escrever." Era um <select>.
     · "A massa tem custo: custo por quilo e custo total pela quantidade."
       As linhas da massa saíam com custo 0.

   Prende:
     1. a escolha na lista dá ao campo o nome inteiro e o desliga antes
        do redesenho;
     2. o ingrediente da Mercadoria é digitável, filtra a lista, e só
        escolhe quem clica (ou o nome inteiro / um único resultado);
     3. a massa custa o que os ingredientes dela custaram naquela ordem,
        por kg; e os indicadores não somam a massa por cima do destino.
   ========================================================== */
const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs');
const path = require('path');
const { corpoDaFuncao } = require('./extrair.js');
const ARQ = path.join(__dirname, '..', 'index.html');
const R = { total: 0, ok: 0, falhou: 0 };
function grupo(n) { console.log('\n── ' + n); }
function t(nome, cond, det) {
  R.total++;
  if (cond) { R.ok++; console.log('   ok   ' + nome); }
  else { R.falhou++; console.log('   FALHA ' + nome + (det !== undefined ? '  → ' + det : '')); }
}
const erros = [];
(async function () {
  const src = fs.readFileSync(ARQ, 'utf8');
  grupo('1. Movimentação de Estoque: a escolha fica');
  const tm = corpoDaFuncao('telaMovimentacao', src);
  t('ao escolher, o campo recebe o nome inteiro e para de ouvir antes do redesenho',
    /mb\.onchange=null; mb\.onblur=null; mb\.oninput=null;\s*if\(_esc\)mb\.value=_esc\.nome\|\|mb\.value;\s*mb\.blur\(\);\s*telaMovimentacao\(\);/.test(tm));
  t('campo que já saiu da tela não decide nada', /mb\.onchange=function\(\)\{ if\(!this\.isConnected\)return;/.test(tm) &&
    /mb\.onblur=function\(\)\{ var v=this\.value;\s*if\(!this\.isConnected\)return;/.test(tm));

  const vc = new VirtualConsole();
  vc.on('jsdomError', e => erros.push('jsdomError: ' + (e && e.message)));
  const dom = new JSDOM(src, {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://joiagest.com.br/', virtualConsole: vc,
    beforeParse(win) {
      win.fetch = () => Promise.reject(new Error('offline no teste'));
      win.matchMedia = win.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} }));
      win.scrollTo = () => {}; win.print = () => {}; win.alert = () => {}; win.confirm = () => true;
      win.crypto = win.crypto || {};
      if (!win.crypto.subtle) win.crypto.subtle = { digest: async () => new ArrayBuffer(32) };
    }
  });
  await new Promise(r => setTimeout(r, 900));
  const w = dom.window, DB = w.DB, doc = w.document;
  const SUC = 'suc_sf';
  w.lojaAtualId = () => SUC;
  let avisos = []; w.toast = m => avisos.push(String(m));
  DB.insumos = [{ id: 'ins_ovo', nome: 'Ovo', unidade: 'un', controlaEstoque: true },
    { id: 'ins_casc', nome: 'CASCAO TRADICIONAL', unidade: 'un', controlaEstoque: true }];
  DB.fichas = [
    { id: 'fi_mct', nome: 'MASSA CASCAO TRADICIONAL', unidade: 'kg', rendimento: 2.46, rendUnidade: 'kg', itens: [],
      destinoId: 'ins_casc', destinoModo: 'receita', destinoFator: 40, estocavel: true },
    { id: 'fi_mcc', nome: 'MASSA CASCAO CHOCOLATE', unidade: 'kg', rendimento: 2.4, rendUnidade: 'kg', itens: [], estocavel: true }];
  DB.movEst = [];

  grupo('2. Movimentação de Mercadoria: o ingrediente se digita');
  w.MM.pronto = false; w.telaMovMercadoria();
  const tx = doc.getElementById('mmItemTxt'), hid = doc.getElementById('mmItem');
  t('o campo é de digitar, não um select', !!tx && tx.tagName === 'INPUT' && !!hid && hid.type === 'hidden');
  t('digitar filtra a lista', w.mmSugestoes('massa cascao tr').map(i => i.nome).join('|') === 'MASSA CASCAO TRADICIONAL' &&
    w.mmSugestoes('massa').length === 2, w.mmSugestoes('cascao tr').map(i => i.nome).join('|') + ' / ' + w.mmSugestoes('massa').map(i => i.nome).join('|'));
  tx.value = 'massa'; tx.oninput();
  t('e não escolhe nada sozinho enquanto digita', hid.value === '');
  w.mmBuscar();
  t('"massa" com dois resultados pede para escolher na lista', w.MM.item === '' && /Escolha o ingrediente na lista/.test(avisos.join('|')));
  doc.getElementById('mmItemTxt').value = 'massa cascao tr'; doc.getElementById('mmItem').value = ''; w.mmBuscar();
  t('com um só resultado, ele vale', w.MM.item === 'fi_mct', w.MM.item);
  t('o campo volta com o nome inteiro', doc.getElementById('mmItemTxt').value === 'MASSA CASCAO TRADICIONAL');
  doc.getElementById('mmItemTxt').value = ''; doc.getElementById('mmItem').value = ''; w.mmBuscar();
  t('apagar o texto volta para todos os ingredientes', w.MM.item === '');

  grupo('3. A massa tem custo');
  const op = { id: 'mv_op', data: '2026-10-03', hora: '18:05', origem: 'producao', sucursalId: SUC, linhas: [
    { insumoId: 'ins_ovo', unidade: 'un', qtd: 8, custo: 0.8, direcao: 'saida', fichaId: 'fi_mct', origem: 'ficha:fi_mct' },
    { insumoId: 'ins_casc', nome: 'CASCAO TRADICIONAL', unidade: 'un', qtd: 80, custo: 0.08, direcao: 'entrada', origem: 'producao:fi_mct' }] };
  const ls = w.linhasComMassa(op);
  const mE = ls.find(l => l.origem === 'massa:fi_mct');
  t('a massa deduzida custa os ingredientes da ordem por kg (6,40 ÷ 4,92 kg)',
    mE && Math.abs(mE.custo - 6.4 / 4.92) < 0.0001 && mE.unidade === 'kg', mE && JSON.stringify(mE));
  const linhas = [{ insumoId: 'ins_ovo', unidade: 'un', qtd: 8, custo: 0.8, direcao: 'saida', fichaId: 'fi_mct' },
    { insumoId: 'ins_casc', direcao: 'entrada', qtd: 80, origem: 'producao:fi_mct' }];
  w.registrarMassaNaOP(linhas, [{ tipo: 'ficha', refId: 'fi_mct', qtd: 4.92, unidade: 'kg' }]);
  const nE = linhas.find(l => l.origem === 'massa:fi_mct');
  t('a ordem nova grava a massa com o mesmo custo', nE && Math.abs(nE.custo - 6.4 / 4.92) < 0.0001, nE && nE.custo);
  t('os indicadores não somam a massa por cima do destino',
    /\(m\.linhas\|\|\[\]\)\.forEach\(function\(l\)\{\s*if\(l\.transito\)return;   \/\* a massa \(ou o sabor\) que virou o destino/.test(src));

  grupo('Balanço');
  t('nenhum erro de runtime', erros.length === 0, erros.slice(0, 5).join(' | '));
  console.log('\n' + R.ok + ' de ' + R.total + ' testes passaram' + (R.falhou ? ' · ' + R.falhou + ' FALHA(S)' : '') + '\n');
  try { w.close(); } catch (e) {}
  process.exit(R.falhou ? 1 : 0);
})();

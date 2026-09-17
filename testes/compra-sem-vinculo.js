/* ==========================================================
   JOIA — COMPRA SEM VÍNCULO: NOTA, ESTOQUE E FINANCEIRO (05/09/2026)

   Rodar:  node testes/compra-sem-vinculo.js
   ou:     npm run test:semvinc   (entra no portão)

   Lógica pedida pelo Rafael:
   · Cenário 1 — ao confirmar a nota, o ESTOQUE entra na hora e a nota é
     gravada; o financeiro é o próximo passo. Se cancelar, a nota fica em
     "Compras sem Vínculo" (pendente). Ao vincular o financeiro, sai da lista.
   · Cenário 2 — apagar o financeiro devolve a nota para "sem vínculo"; ao
     resolver, o sistema pergunta MANTER (faz o financeiro) ou DEVOLVER o
     estoque (desfaz a compra).

   Este guardião testa as funções-núcleo direto (sem os modais), com um
   espião no aplicarMovimento para provar que o estoque entra ao materializar
   e é DESFEITO ao devolver.
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
  console.log('\nCarregando o sistema para o guardião da Compra sem Vínculo…');
  let win;
  try { win = await carregar(); }
  catch (e) { console.log('   FALHA não carregou o index.html: ' + e.message); process.exit(1); }

  /* dublagens: sem modais, sem rede, e um ESPIÃO no estoque */
  win.pergunta = async () => true; win.confirmar = async () => true;
  win.vincularFornecedor = () => {};
  const movs = [];
  win.aplicarMovimento = function (m, desfazer) { movs.push({ id: m && m.id, desfazer: !!desfazer }); };

  win.DB.notas = []; win.DB.movEst = []; win.DB.comprasSemVinc = []; win.DB.lancFin = [];
  win.DB.insumos = [{ id: 'ins1', nome: 'Farinha', unidade: 'kg', controlaEstoque: true, compras: [] }];

  function novaNota(num) {
    return { numero: num, data: '2026-09-05', fornecedorId: 'fo1', fornecedorNome: 'Mercado Local',
      valorTotal: 77.88, itens: [{ insumoId: 'ins1', nome: 'Farinha', unidade: 'kg', qtd: 10, total: 77.88 }] };
  }

  grupo('As peças existem');
  ['materializarNota', 'marcarNotaSemVinculo', 'desmarcarNotaSemVinculo', 'vincularLancsANota',
   'semVincManter', 'semVincDevolver', 'arquivarSemVinculo']
    .forEach(fn => t('existe ' + fn + '()', typeof win[fn] === 'function', typeof win[fn]));

  grupo('Cenário 1 — confirmar a nota abastece o estoque e grava a nota');
  const n1 = novaNota('001');
  win.materializarNota(n1);
  t('a nota entrou em DB.notas', win.DB.notas.some(x => x.id === n1.id));
  t('a nota ganhou um movimento de estoque (movId)', !!n1.movId);
  t('o movimento de nota está em DB.movEst', win.DB.movEst.some(m => m.notaId === n1.id && m.origem === 'nota'));
  t('o estoque foi APLICADO (não desfeito)', movs.some(m => m.id === n1.movId && m.desfazer === false), JSON.stringify(movs));
  t('a compra do insumo foi registrada', (win.DB.insumos[0].compras || []).some(c => c.notaId === n1.id));

  win.marcarNotaSemVinculo(n1);
  t('a nota nasceu em Compras sem Vínculo (pendente)',
    win.DB.comprasSemVinc.some(c => c.notaId === n1.id && c.tipo === 'pendente'));

  grupo('Cancelar o financeiro: a nota fica na lista');
  /* não chamamos vincularLancsANota = cancelou */
  t('continua em Compras sem Vínculo', win.DB.comprasSemVinc.some(c => c.notaId === n1.id));

  grupo('Fazer o financeiro depois: vincula e sai da lista');
  const lanc = { id: 'lf1', valor: 77.88, descricao: 'NF 001' };
  win.DB.lancFin.push(lanc);
  win.vincularLancsANota(n1, [lanc]);
  t('o lançamento virou de nota-entrada, apontando a nota', lanc.origem === 'nota-entrada' && lanc.ref === n1.id);
  t('a nota guardou os lançamentos', (n1.lancIds || []).indexOf('lf1') >= 0);
  t('saiu de Compras sem Vínculo', !win.DB.comprasSemVinc.some(c => c.notaId === n1.id));
  const csv1 = (win.DB._apagados && win.DB._apagados.comprasSemVinc) || {};
  t('e a saída foi DECLARADA para a nuvem apagar (16/09/2026)', Object.keys(csv1).length >= 1, JSON.stringify(csv1));

  grupo('Fantasma: a nuvem trouxe a compra de volta com o boleto já lançado');
  win.DB.comprasSemVinc.push({ id: 'csv_fantasma', tipo: 'pendente', notaId: n1.id, notaNumero: '001', valor: 77.88 });
  const tirou = win.repararComprasSemVinculo();
  t('repararComprasSemVinculo tira 1', tirou === 1, tirou);
  t('a compra fantasma sumiu da lista', !win.DB.comprasSemVinc.some(c => c.id === 'csv_fantasma'));
  t('e a exclusão foi declarada', !!(win.DB._apagados.comprasSemVinc || {})['csv_fantasma']);
  t('rodar de novo não tira nada', win.repararComprasSemVinculo() === 0);
  t('compra pendente de verdade (sem boleto) fica', (function () {
    win.DB.comprasSemVinc.push({ id: 'csv_legit', tipo: 'pendente', notaId: 'nf_sem_boleto', notaNumero: '009', valor: 10 });
    const r = win.repararComprasSemVinculo() === 0 && win.DB.comprasSemVinc.some(c => c.id === 'csv_legit');
    win.DB.comprasSemVinc = win.DB.comprasSemVinc.filter(c => c.id !== 'csv_legit');
    return r; })());
  const html = fs.readFileSync(ARQ, 'utf8');
  t('a limpeza roda no arranque e depois do download', /repararComprasSemVinculo\(\)/.test(html.slice(html.indexOf('function boot('), html.indexOf('function boot(') + 3000)) &&
    /repararComprasSemVinculo\(\)/.test(html.slice(html.indexOf('async function baixarDaNuvem('), html.indexOf('async function baixarDaNuvem(') + 200000)));

  grupo('Cenário 2 — devolver o estoque desfaz a compra');
  const n2 = novaNota('002'); win.materializarNota(n2); win.marcarNotaSemVinculo(n2);
  const csv2 = win.DB.comprasSemVinc.find(c => c.notaId === n2.id);
  movs.length = 0;
  await win.semVincDevolver(csv2.id);
  t('o estoque foi DEVOLVIDO (aplicarMovimento com desfazer)', movs.some(m => m.id === n2.movId && m.desfazer === true), JSON.stringify(movs));
  t('o movimento saiu de DB.movEst', !win.DB.movEst.some(m => m.id === n2.movId));
  t('a nota foi removida', !win.DB.notas.some(x => x.id === n2.id));
  t('a compra do insumo foi limpa', !(win.DB.insumos[0].compras || []).some(c => c.notaId === n2.id));
  t('saiu de Compras sem Vínculo', !win.DB.comprasSemVinc.some(c => c.id === csv2.id));
  t('devolver declara a exclusão da compra e da nota', !!(win.DB._apagados.comprasSemVinc || {})[csv2.id] && !!(win.DB._apagados.notas || {})[n2.id]);

  grupo('Cenário 2 — manter e refazer o boleto (molde do financeiro excluído)');
  const n3 = novaNota('003'); win.materializarNota(n3);
  /* simula o boleto excluído indo para sem-vínculo com molde */
  const lanc3 = { id: 'lf3', tipo: 'despesa', descricao: 'NF 003', documento: 'NF 003', valor: 77.88,
    vencimento: '2026-09-10', origem: 'nota-entrada', ref: n3.id, contaId: 'cc1', metodoId: 'fp_pix', categoriaId: 'cat1' };
  win.arquivarSemVinculo(lanc3, n3);
  const csv3 = win.DB.comprasSemVinc.find(c => c.notaId === n3.id);
  t('o boleto excluído virou compra sem vínculo com molde', !!csv3 && !!csv3.lanc);
  const antesLanc = win.DB.lancFin.length;
  win.semVincManter(csv3.id);
  const recriado = win.DB.lancFin[win.DB.lancFin.length - 1] || {};
  t('manter recriou o boleto no financeiro', win.DB.lancFin.length === antesLanc + 1);
  t('o boleto recriado aponta a nota (origem/ref)', recriado.origem === 'nota-entrada' && recriado.ref === n3.id);
  t('e saiu de Compras sem Vínculo', !win.DB.comprasSemVinc.some(c => c.id === csv3.id));
  t('manter declara a exclusão da compra', !!(win.DB._apagados.comprasSemVinc || {})[csv3.id]);
  t('o estoque NÃO foi mexido ao manter (nenhum desfazer)', !movs.some(m => m.desfazer === true && m.id === n3.movId));

  grupo('A compra sem vínculo NÃO some segundos depois (Rafael, 17/09/2026)');
  /* nota parcelada em 3: apagar UMA parcela deixa duas vivas */
  const n4 = novaNota('004'); n4.valorTotal = 300;
  win.materializarNota(n4);
  win.DB.lancFin.push(
    { id: 'lf4a', tipo: 'despesa', descricao: 'NF 004 (1/3)', valor: 100, origem: 'nota-entrada', ref: n4.id },
    { id: 'lf4b', tipo: 'despesa', descricao: 'NF 004 (2/3)', valor: 100, origem: 'nota-entrada', ref: n4.id },
    { id: 'lf4c', tipo: 'despesa', descricao: 'NF 004 (3/3)', valor: 100, origem: 'nota-entrada', ref: n4.id });
  /* a pessoa apaga a parcela 1 pelo botão da lixeira */
  const apagadosNaNuvem = [];
  win.NUVEM.ligada = true; win.NUVEM.loja = 'loja1';
  win.api = async (rota, metodo) => { apagadosNaNuvem.push(metodo + ' ' + rota); return []; };
  win.telaLancamentos = () => {};
  await win.excluirLanc('lf4a');
  t('a exclusão do boleto vai para a NUVEM (era só local: voltava no download)',
    apagadosNaNuvem.some(x => /^DELETE lancamentos_financeiros\?/.test(x) && /lf4a/.test(x)), apagadosNaNuvem.join(' | '));
  t('a exclusão fica declarada', !!(win.DB._apagados.lancFin || {})['lf4a']);
  t('o boleto saiu do financeiro', !win.DB.lancFin.some(l => l.id === 'lf4a'));
  const csv4 = win.DB.comprasSemVinc.find(c => c.notaId === n4.id);
  t('a parcela apagada virou compra sem vínculo', !!csv4);
  /* a faxina de fantasmas roda — e não pode levar esta embora */
  win.repararComprasSemVinculo();
  t('com 2 de 3 parcelas vivas, a compra CONTINUA na lista', win.DB.comprasSemVinc.some(c => c.id === csv4.id));
  /* nem mesmo depois de passar a carência de 10 minutos */
  csv4.excluidoEm = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  win.repararComprasSemVinculo();
  t('uma hora depois também continua: falta parcela, falta financeiro', win.DB.comprasSemVinc.some(c => c.id === csv4.id));
  /* recém-criado nunca é varrido, mesmo com o financeiro inteiro de volta */
  win.DB.lancFin.push({ id: 'lf4d', tipo: 'despesa', descricao: 'NF 004 (1/3) refeita', valor: 100,
    origem: 'nota-entrada', ref: n4.id });
  csv4.excluidoEm = new Date().toISOString();
  win.repararComprasSemVinculo();
  t('registro recém-criado não é varrido pela faxina', win.DB.comprasSemVinc.some(c => c.id === csv4.id));
  /* com o financeiro cobrindo a nota inteira e o registro velho: aí sim é fantasma */
  csv4.excluidoEm = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const levou = win.repararComprasSemVinculo();
  t('financeiro completo de novo: aí sim a faxina limpa', levou === 1 && !win.DB.comprasSemVinc.some(c => c.id === csv4.id), levou);

  grupo('A nuvem recusando a exclusão não apaga nada aqui');
  win.DB.lancFin.push({ id: 'lf5', tipo: 'despesa', descricao: 'Aluguel', valor: 50 });
  win.api = async () => { throw new Error('rede caiu'); };
  win.painelErro = () => {};
  await win.excluirLanc('lf5');
  t('o lançamento continua aqui quando a nuvem recusa', win.DB.lancFin.some(l => l.id === 'lf5'));

  grupo('Corrigir os itens da nota pela própria tela (Rafael, 17/09/2026)');
  ['verSemVinc', 'salvarNotaSemVinc', 'mudaItemSemVinc', 'remItemSemVinc',
   'lancarEstoqueDaNota', 'desfazerEstoqueDaNota'].forEach(fn =>
    t('existe ' + fn + '()', typeof win[fn] === 'function', typeof win[fn]));
  const n6 = novaNota('006'); win.materializarNota(n6); win.marcarNotaSemVinculo(n6);
  const csv6 = win.DB.comprasSemVinc.find(c => c.notaId === n6.id);
  win.telaSemVinculo = () => {};
  win.verSemVinc(csv6.id);
  const doc6 = win.document;
  t('a janela abre com o item editável', !!doc6.querySelector('#mdOv input.svIn'));
  t('tem o botão de excluir a nota devolvendo o estoque', /semVincDevolver/.test(doc6.getElementById('mdOv').innerHTML));
  t('tem o botão de salvar a nota corrigida', /salvarNotaSemVinc/.test(doc6.getElementById('mdOv').innerHTML));
  t('tem o botão de fazer o financeiro', /semVincManter/.test(doc6.getElementById('mdOv').innerHTML));
  /* a pessoa corrige: 10 kg viram 4 kg, a R$ 5,00 */
  win.mudaItemSemVinc(0, 'qtd', '4');
  win.mudaItemSemVinc(0, 'valorUn', '5');
  t('o total do item recalcula na hora (4 × 5 = 20)',
    doc6.getElementById('svTot0').textContent.indexOf('20,00') >= 0, doc6.getElementById('svTot0').textContent);
  t('o total da nota acompanha', doc6.getElementById('svTotNota').textContent.indexOf('20,00') >= 0);
  const movAntes = n6.movId;
  movs.length = 0;
  win.salvarNotaSemVinc(csv6.id);
  t('o estoque antigo foi DESFEITO', movs.some(m => m.id === movAntes && m.desfazer === true), JSON.stringify(movs));
  t('e o estoque novo foi lançado', movs.some(m => m.desfazer === false && m.id !== movAntes));
  t('a nota ficou com o novo total', Math.abs(n6.valorTotal - 20) < 0.001, n6.valorTotal);
  t('o item ficou com 4 de quantidade', n6.itens[0].qtd === 4 && n6.itens[0].valorUn === 5, JSON.stringify(n6.itens[0]));
  t('a exclusão do movimento antigo ficou declarada', !!(win.DB._apagados.movEst || {})[movAntes]);
  t('a compra continua na lista (o financeiro ainda falta)', win.DB.comprasSemVinc.some(c => c.id === csv6.id));
  t('a compra pendente acompanha o novo valor', Math.abs(csv6.valor - 20) < 0.001, csv6.valor);

  grupo('Nota excluída não volta do túmulo (Rafael, 17/09/2026)');
  const n7 = novaNota('007'); win.materializarNota(n7);
  win.DB.lancFin.push({ id: 'lf7', tipo: 'despesa', descricao: 'NF 007', valor: 77.88,
    origem: 'nota-entrada', ref: n7.id });
  const mov7 = n7.movId;
  win.confirmar = async () => true; win.telaNotas = () => {};
  win._cfAjEst = true;
  await win.excluirNota(n7.id);
  t('a nota saiu daqui', !win.DB.notas.some(x => x.id === n7.id));
  t('a exclusão da NOTA ficou declarada (era só local: voltava no download)',
    !!(win.DB._apagados.notas || {})[n7.id]);
  t('a exclusão do movimento de estoque ficou declarada', !!(win.DB._apagados.movEst || {})[mov7]);
  t('a exclusão do boleto da nota ficou declarada', !!(win.DB._apagados.lancFin || {})['lf7']);

  grupo('A ordem de apagar vale também nas tabelas sem espelho');
  const html2 = fs.readFileSync(ARQ, 'utf8');
  t('a sincronização manda a exclusão declarada em toda tabela',
    /apagarRemovidos\(E2\.tab,E2\.col,lista\.map\(function\(x\)\{return x\.id\}\),!E2\.espelha\)/.test(html2));

  console.log('\n' + '═'.repeat(52));
  console.log('Joia · Compra sem Vínculo (nota, estoque e financeiro)');
  console.log(R.ok + ' de ' + R.total + ' testes passaram' + (R.falhou ? ' · ' + R.falhou + ' FALHA(S)' : ''));
  console.log('═'.repeat(52) + '\n');
  try { win.close(); } catch (e) {}
  process.exit(R.falhou ? 1 : 0);
})();

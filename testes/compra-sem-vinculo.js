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
  t('o estoque NÃO foi mexido ao manter (nenhum desfazer)', !movs.some(m => m.desfazer === true && m.id === n3.movId));

  console.log('\n' + '═'.repeat(52));
  console.log('Joia · Compra sem Vínculo (nota, estoque e financeiro)');
  console.log(R.ok + ' de ' + R.total + ' testes passaram' + (R.falhou ? ' · ' + R.falhou + ' FALHA(S)' : ''));
  console.log('═'.repeat(52) + '\n');
  try { win.close(); } catch (e) {}
  process.exit(R.falhou ? 1 : 0);
})();

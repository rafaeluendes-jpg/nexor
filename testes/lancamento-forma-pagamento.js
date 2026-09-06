/* ==========================================================
   JOIA — "JÁ ESTÁ PAGO" MOSTRA E SALVA A FORMA DE PAGAMENTO (05/09/2026)

   Rodar:  node testes/lancamento-forma-pagamento.js
   ou:     npm run test:lanc-forma   (entra no portão)

   Pedido do Rafael: no lançamento financeiro, ao marcar "Já está pago",
   além da data tem de aparecer a FORMA DE PAGAMENTO (Pix, dinheiro,
   débito...) para identificar como foi pago — e isso tem de ser salvo no
   mesmo campo (`metodoId`) que a baixa grava.

   Este guardião trava:
     · marcar "Já está pago" mostra o seletor de forma (e o banco);
     · salvar guarda `metodoId`/`contaId` e `pago`;
     · sem forma, marcado como pago, NÃO deixa salvar;
     · lançamento PENDENTE continua salvando sem exigir banco/forma.
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
  console.log('\nCarregando o sistema para o guardião do "já está pago"…');
  let win;
  try { win = await carregar(); }
  catch (e) { console.log('   FALHA não carregou o index.html: ' + e.message); process.exit(1); }
  const doc = win.document;

  /* cadastro mínimo para o formulário montar */
  win.DB.contas = [{ id: 'cc_caixa', nome: 'Caixa da loja', fixa: 'caixa' }];
  win.DB.formasPag = [{ id: 'fp_pix', nome: 'Pix', tipo: 'pix' }, { id: 'fp_din', nome: 'Dinheiro', tipo: 'dinheiro' }];
  win.DB.catfin = [{ id: 'g1', nome: 'Custos Diretos', itens: [{ id: 'cat_forn', nome: 'Fornecedores' }] }];
  win.DB.fornec = []; win.DB.lancFin = [];

  function abreNovaDespesa() { try { win.fecharModal(); } catch (e) {} win.modalLanc(null, 'despesa', {}); }

  grupo('As peças novas existem no formulário');
  abreNovaDespesa();
  t('o seletor de forma de pagamento existe (#lnM)', !!doc.getElementById('lnM'));
  t('o banco existe (#lnC)', !!doc.getElementById('lnC'));
  t('o bloco "já pago" começa escondido', doc.getElementById('boxPg').style.display === 'none');
  t('o aviso "na baixa" começa visível', doc.getElementById('avPgBaixa').style.display !== 'none');
  const lnM = doc.getElementById('lnM');
  const nomes = [].slice.call(lnM.options).map(o => o.textContent).join('|');
  t('a forma traz as opções da loja (Pix, Dinheiro)', /Pix/.test(nomes) && /Dinheiro/.test(nomes), nomes);

  grupo('Marcar "Já está pago" mostra a forma e esconde o aviso');
  const lnP = doc.getElementById('lnP');
  lnP.checked = true; lnP.onchange();
  t('o bloco com forma/banco/data aparece', doc.getElementById('boxPg').style.display !== 'none');
  t('o aviso "na baixa" some', doc.getElementById('avPgBaixa').style.display === 'none');

  grupo('Salvar guarda a forma escolhida (metodoId), igual à baixa');
  doc.getElementById('lnD').value = 'NF X260905 — Mercado Local';
  doc.getElementById('lnV').value = '77.88';
  doc.getElementById('lnCat').value = 'cat_forn';
  doc.getElementById('lnC').value = 'cc_caixa';
  doc.getElementById('lnM').value = 'fp_pix';
  const antes = win.DB.lancFin.length;
  await win.document.getElementById('mdOk').onclick();
  const novo = win.DB.lancFin[win.DB.lancFin.length - 1] || {};
  t('o lançamento foi salvo', win.DB.lancFin.length === antes + 1);
  t('salvou como PAGO', novo.pago === true, JSON.stringify(novo).slice(0, 80));
  t('salvou a forma escolhida em metodoId (fp_pix)', novo.metodoId === 'fp_pix', novo.metodoId);
  t('salvou o banco escolhido em contaId', novo.contaId === 'cc_caixa', novo.contaId);

  grupo('Marcado como pago SEM forma: não deixa salvar');
  abreNovaDespesa();
  doc.getElementById('lnD').value = 'Sem forma';
  doc.getElementById('lnV').value = '10';
  doc.getElementById('lnCat').value = 'cat_forn';
  const lnP2 = doc.getElementById('lnP'); lnP2.checked = true; lnP2.onchange();
  doc.getElementById('lnC').value = 'cc_caixa';
  doc.getElementById('lnM').value = '';          /* forma vazia de propósito */
  const antes2 = win.DB.lancFin.length;
  await win.document.getElementById('mdOk').onclick();
  t('não salvou o pago sem forma de pagamento', win.DB.lancFin.length === antes2, 'salvou indevidamente');

  grupo('Lançamento PENDENTE continua salvando sem exigir banco/forma');
  try { win.fecharModal(); } catch (e) {}
  abreNovaDespesa();
  doc.getElementById('lnD').value = 'Conta a vencer';
  doc.getElementById('lnV').value = '50';
  doc.getElementById('lnCat').value = 'cat_forn';
  /* NÃO marca "já pago", NÃO escolhe banco/forma */
  const antes3 = win.DB.lancFin.length;
  await win.document.getElementById('mdOk').onclick();
  const pend = win.DB.lancFin[win.DB.lancFin.length - 1] || {};
  t('o pendente foi salvo mesmo sem banco/forma', win.DB.lancFin.length === antes3 + 1);
  t('e nasceu como NÃO pago, sem forma', pend.pago === false && !pend.metodoId, JSON.stringify(pend).slice(0, 80));

  console.log('\n' + '═'.repeat(52));
  console.log('Joia · "Já está pago" mostra e salva a forma de pagamento');
  console.log(R.ok + ' de ' + R.total + ' testes passaram' + (R.falhou ? ' · ' + R.falhou + ' FALHA(S)' : ''));
  console.log('═'.repeat(52) + '\n');
  try { win.close(); } catch (e) {}
  process.exit(R.falhou ? 1 : 0);
})();

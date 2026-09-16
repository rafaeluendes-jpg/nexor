/* ==========================================================
   JOIA — AS PARCELAS DA NOTA PODEM SER AJUSTADAS, MAS TÊM DE FECHAR

   Rodar:  node testes/parcelas-batem-com-o-total.js
   ou:     npm run test:parcelas   (entra no portão)

   POR QUE ESTE ARQUIVO EXISTE (Rafael, 16/09/2026)
   Ao parcelar uma nota, a data de cada parcela podia ser editada, o
   valor não — e R$ 100 em 3x virava 33,33 × 3 = 99,99. Agora cada
   parcela pode ser ajustada a mão; por padrão a última leva a sobra
   dos centavos; e se a soma não bater com o total, o sistema avisa
   "os valores não estão batendo" e não lança.
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
  console.log('\nCarregando o sistema para o guardião das parcelas…');
  let win;
  try { win = await carregar(); }
  catch (e) { console.log('   FALHA não carregou o index.html: ' + e.message); process.exit(1); }
  const doc = win.document;
  const toasts = []; win.toast = m => toasts.push(String(m));
  win.DB.contas = [{ id: 'cc_caixa', nome: 'Caixa da loja', fixa: 'caixa' }];
  win.DB.formasPag = [{ id: 'fp_pix', nome: 'Pix', tipo: 'pix' }];
  win.DB.catfin = [{ id: 'g1', nome: 'Custos Diretos', itens: [{ id: 'cat_forn', nome: 'Fornecedores' }] }];
  win.DB.fornec = []; win.DB.lancFin = [];

  function abre() { try { win.fecharModal(); } catch (e) {} win.modalLanc(null, 'despesa', {}); }
  function parcela(total, q) {
    doc.getElementById('lnD').value = 'NF 123 — Fornecedor';
    doc.getElementById('lnV').value = String(total);
    doc.getElementById('lnCat').value = 'cat_forn';
    const pc = doc.getElementById('lnParc'); pc.checked = true; pc.onchange();
    doc.getElementById('lnQtd').value = String(q);
    win.previewParc();
  }
  const valores = () => [].slice.call(doc.querySelectorAll('.prevValor')).map(i => i.value);

  grupo('As peças existem');
  ['valoresParcelas', 'diferencaParcelas', 'mudaValorParc', 'previewParc'].forEach(fn =>
    t('existe ' + fn + '()', typeof win[fn] === 'function', typeof win[fn]));

  grupo('R$ 100 em 3x fecha sozinho: a última leva o centavo');
  abre(); parcela(100, 3);
  t('cada parcela tem um campo de valor editável', doc.querySelectorAll('.prevValor').length === 3);
  t('33,33 · 33,33 · 33,34', valores().join(' ') === '33.33 33.33 33.34', valores().join(' '));
  t('a diferença é zero', win.diferencaParcelas() === 0, win.diferencaParcelas());
  t('sem aviso de valores não batendo', !doc.querySelector('.prevAviso'));

  grupo('Ajuste a mão: soma errada avisa e não deixa lançar');
  win.mudaValorParc(0, '40');
  t('a primeira virou 40,00 e as outras ficaram', valores().join(' ') === '40.00 33.33 33.34', valores().join(' '));
  t('aparece o aviso "os valores não estão batendo"', /não estão batendo/.test((doc.querySelector('.prevAviso') || {}).textContent || ''));
  t('e diz quanto sobra (R$ 6,67)', /sobram R\$ 6,67/.test((doc.querySelector('.prevAviso') || {}).textContent || ''), (doc.querySelector('.prevAviso') || {}).textContent);
  const antes = win.DB.lancFin.length; toasts.length = 0;
  await doc.getElementById('mdOk').onclick();
  t('o salvar recusa (nada lançado)', win.DB.lancFin.length === antes, win.DB.lancFin.length - antes);
  t('com a mensagem "Os valores das parcelas não batem com o total"', toasts.some(x => /parcelas não batem com o total/.test(x)), toasts.join(' | '));

  grupo('Ajuste que fecha (40 + 30 + 30) lança as três com os valores da pessoa');
  win.mudaValorParc(1, '30'); win.mudaValorParc(2, '30');
  t('diferença zero de novo', win.diferencaParcelas() === 0);
  t('o aviso some', !doc.querySelector('.prevAviso'));
  await doc.getElementById('mdOk').onclick();
  const novos = win.DB.lancFin.slice(antes);
  t('salvou as três parcelas', novos.length === 3, novos.length);
  t('40,00 · 30,00 · 30,00 nos lançamentos', novos.map(l => l.valor).join(' ') === '40 30 30', novos.map(l => l.valor).join(' '));
  t('descrições numeradas (1/3, 2/3, 3/3)', novos.every((l, i) => new RegExp('\\(' + (i + 1) + '/3\\)').test(l.descricao)));

  grupo('Trocar a quantidade descarta o ajuste (não tranca a pessoa numa soma velha)');
  abre(); parcela(90, 3);
  win.mudaValorParc(0, '50');
  doc.getElementById('lnQtd').value = '2';
  doc.getElementById('lnQtd').dispatchEvent(new win.Event('change'));
  t('2 parcelas de 45,00', valores().join(' ') === '45.00 45.00', valores().join(' '));

  grupo('O ajuste de um lançamento não vaza para o próximo');
  win.mudaValorParc(0, '70');
  abre(); parcela(90, 2);
  t('o novo lançamento nasce 45,00 · 45,00', valores().join(' ') === '45.00 45.00', valores().join(' '));

  grupo('Modo "repetir": cada parcela é o valor cheio, sem aviso');
  abre(); parcela(50, 3);
  doc.getElementById('lnModo').value = 'repetir';
  doc.getElementById('lnModo').dispatchEvent(new win.Event('change'));
  t('50,00 · 50,00 · 50,00', valores().join(' ') === '50.00 50.00 50.00', valores().join(' '));
  t('sem aviso', !doc.querySelector('.prevAviso') && win.diferencaParcelas() === 0);

  grupo('Balanço: zero erro de runtime durante o guardião');
  t('nenhum erro de runtime na sessão inteira', erros.length === 0, erros.slice(0, 8).join(' | '));

  console.log('\n' + '═'.repeat(52));
  console.log('Joia · As parcelas batem com o total');
  console.log(R.ok + ' de ' + R.total + ' testes passaram' + (R.falhou ? ' · ' + R.falhou + ' FALHA(S)' : ''));
  console.log('═'.repeat(52) + '\n');
  try { win.close(); } catch (e) {}
  process.exit(R.falhou ? 1 : 0);
})();

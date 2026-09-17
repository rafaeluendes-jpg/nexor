/* ==========================================================
   JOIA — NOTA DE ENTRADA: NÚMERO VAZIO AO ABRIR, VENCIMENTO SÓ EMBAIXO

   Rodar:  node testes/nota-numero-e-vencimento.js
   ou:     npm run test:notanum   (entra no portão)

   POR QUE ESTE ARQUIVO EXISTE (Rafael, 17/09/2026)
   1. O "Nº da nota" vinha preenchido com um número inventado pelo sistema.
      O número é o da nota do fornecedor: nasce vazio e é obrigatório.
   2. No financeiro da nota havia dois vencimentos: um em cima (com a data
      da nota) e o "1º vencimento" embaixo. Só o de baixo existe agora, no
      bloco "Contas a pagar": 1 parcela = um vencimento só; mais de uma,
      um lançamento por parcela.
   3. O bloco chama-se "Contas a pagar" também na Nova despesa.
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
  console.log('\nCarregando o sistema para o guardião da nota de entrada…');
  let win;
  try { win = await carregar(); }
  catch (e) { console.log('   FALHA não carregou o index.html: ' + e.message); process.exit(1); }
  const doc = win.document;
  const toasts = []; win.toast = m => toasts.push(String(m));
  win.salvar = () => {}; win.telaNotas = () => {}; win.telaLancamentos = () => {};
  win.DB.contas = [{ id: 'cc_caixa', nome: 'Caixa da loja', fixa: 'caixa' }];
  win.DB.formasPag = [{ id: 'fp_pix', nome: 'Pix', tipo: 'pix' }];
  win.DB.catfin = [{ id: 'g1', nome: 'Custos Diretos', itens: [{ id: 'cat_forn', nome: 'Fornecedores' }] }];
  win.DB.fornec = [{ id: 'fo1', empresa: 'Casa de Doce Local' }]; win.DB.lancFin = []; win.DB.notas = [];
  win.DB.insumos = [{ id: 'i1', nome: 'Açúcar', unidade: 'kg', controlaEstoque: true, estoqueAtual: 0 }];

  grupo('1. O número da nota nasce vazio e é obrigatório');
  win.novaNota();
  t('a nota nova não traz número inventado', win._nota.numero === '' && doc.getElementById('ntNum').value === '', win._nota.numero);
  doc.getElementById('ntFor').value = 'fo1';
  win._nota.itens.push({ insumoId: 'i1', nome: 'Açúcar', unidade: 'kg', qtd: 10, valorUn: 18.9, desconto: 0, total: 189 });
  toasts.length = 0; win.confirmarNota();
  t('sem número, avisa "Informe o número da nota" e não lança', toasts.some(x => /Informe o número da nota/.test(x)) && win.DB.notas.length === 0, toasts.join(' | '));

  grupo('2. Financeiro da nota: só o vencimento de baixo, no bloco "Contas a pagar"');
  let modalPre = null;
  const modalLancReal = win.modalLanc;
  win.abrirFinanceiroNota = (n) => { modalPre = n; };
  doc.getElementById('ntNum').value = '887252';
  win.confirmarNota();
  t('com número, a nota lança', win.DB.notas.length === 1 && win.DB.notas[0].numero === '887252');
  /* abre o financeiro de verdade, como o sistema faz */
  const n = win.DB.notas[0];
  try { win.fecharModal(); } catch (e) {}
  modalLancReal(null, 'despesa', { titulo: 'Lançamento da nota ' + n.numero, valor: n.valorTotal, emissao: n.data,
    vencimento: win.hojeISO(), semVencimentoNoTopo: true, documento: 'NF ' + n.numero, soDespesa: true, fornecedorId: n.fornecedorId,
    contaId: 'cc_caixa', apos: (criados) => { win.vincularLancsANota(n, criados); } });
  const vc = doc.getElementById('lnVc');
  t('o vencimento de cima não aparece', !!vc && vc.parentElement.style.display === 'none');
  t('o bloco se chama "Contas a pagar"', /Contas a pagar/.test(doc.getElementById('content') ? doc.body.innerHTML : ''));
  t('o bloco já está aberto com 1 parcela', doc.getElementById('lnParc').checked && doc.getElementById('lnQtd').value === '1' && doc.getElementById('boxParc').style.display !== 'none');
  t('o campo de data embaixo chama-se "Vencimento"', doc.getElementById('lnPriRot').textContent === 'Vencimento');
  doc.getElementById('lnCat').value = 'cat_forn';
  if (!doc.getElementById('lnD').value) doc.getElementById('lnD').value = 'NF 887252 — Casa de Doce Local';
  doc.getElementById('lnPri').value = '2026-10-10'; win.previewParc();
  await doc.getElementById('mdOk').onclick();
  if (!win.DB.lancFin.length) { console.log('   (toasts: ' + toasts.join(' | ') + ')'); win.DB.lancFin.push({ descricao: '?' }); }
  t('1 parcela = um lançamento só, com o vencimento de baixo (10/10/2026)', win.DB.lancFin.length === 1 && win.DB.lancFin[0].vencimento === '2026-10-10', JSON.stringify(win.DB.lancFin[0]));
  t('sem "(1/1)" no nome', !/\(1\/1\)/.test(win.DB.lancFin[0].descricao), win.DB.lancFin[0].descricao);
  t('a nota ficou vinculada ao lançamento', (n.lancIds || [])[0] === win.DB.lancFin[0].id);

  grupo('3. Com 2 parcelas continua gerando um lançamento por parcela');
  try { win.fecharModal(); } catch (e) {}
  win.DB.lancFin = [];
  modalLancReal(null, 'despesa', { valor: 189, semVencimentoNoTopo: true, soDespesa: true, contaId: 'cc_caixa' });
  doc.getElementById('lnD').value = 'NF 1'; doc.getElementById('lnCat').value = 'cat_forn';
  doc.getElementById('lnQtd').value = '2'; win.previewParc();
  t('o rótulo volta a "1º vencimento"', doc.getElementById('lnPriRot').textContent === '1º vencimento');
  await doc.getElementById('mdOk').onclick();
  t('2 lançamentos, 94,50 cada', win.DB.lancFin.length === 2 && win.DB.lancFin.every(l => l.valor === 94.5), JSON.stringify(win.DB.lancFin.map(l => l.valor)));

  grupo('4. Nova despesa comum: um vencimento só, no bloco "Contas a pagar" (17/09/2026)');
  try { win.fecharModal(); } catch (e) {}
  modalLancReal(null, 'despesa', {});
  t('não existe mais o vencimento de cima: dois campos perdiam a data digitada',
    doc.getElementById('lnVc').parentElement.style.display === 'none');
  t('o bloco chama-se "Contas a pagar" e já vem aberto com 1 parcela',
    /Contas a pagar/.test(doc.body.innerHTML) && doc.getElementById('lnParc').checked &&
    doc.getElementById('lnQtd').value === '1', doc.getElementById('lnQtd').value);
  t('e o rótulo é "Vencimento", não "1º vencimento"',
    doc.getElementById('lnPriRot').textContent === 'Vencimento', doc.getElementById('lnPriRot').textContent);
  /* a data digitada no bloco é a que fica gravada */
  doc.getElementById('lnD').value = 'SIMPLES NACIONAL';
  doc.getElementById('lnV').value = '6299.33';
  doc.getElementById('lnCat').value = 'sc1';
  doc.getElementById('lnPri').value = '2026-09-21';
  win.DB.lancFin = [];
  await doc.getElementById('mdOk').onclick();
  t('um lançamento só, sem "(1/1)" no nome', win.DB.lancFin.length === 1 &&
    win.DB.lancFin[0].descricao === 'SIMPLES NACIONAL', JSON.stringify(win.DB.lancFin.map(l => l.descricao)));
  t('guardou o vencimento que foi digitado (21/09), não a data de hoje',
    win.DB.lancFin[0].vencimento === '2026-09-21', win.DB.lancFin[0].vencimento);
  t('e guardou a categoria escolhida', win.DB.lancFin[0].categoriaId === 'sc1', win.DB.lancFin[0].categoriaId);

  grupo('Balanço: zero erro de runtime durante o guardião');
  t('nenhum erro de runtime na sessão inteira', erros.length === 0, erros.slice(0, 8).join(' | '));
  console.log('\n' + '═'.repeat(52));
  console.log('Joia · Nota de entrada: número vazio, vencimento só embaixo');
  console.log(R.ok + ' de ' + R.total + ' testes passaram' + (R.falhou ? ' · ' + R.falhou + ' FALHA(S)' : ''));
  console.log('═'.repeat(52) + '\n');
  try { win.close(); } catch (e) {}
  process.exit(R.falhou ? 1 : 0);
})();

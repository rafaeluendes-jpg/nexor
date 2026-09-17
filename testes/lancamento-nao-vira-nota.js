/* ==========================================================
   JOIA — O LANÇAMENTO DE IMPOSTO NÃO É NOTA DE ENTRADA

   Rodar:  node testes/lancamento-nao-vira-nota.js
   ou:     npm run test:lancnota   (entra no portão)

   POR QUE ESTE ARQUIVO EXISTE (Rafael, 17/09/2026)
   O SIMPLES NACIONAL, documento SIMPLES2609, aparecia na tela de editar
   com os itens da nota "NF PIX2609" — leite, Veja, Bis. O socorro que
   religa um boleto à nota dele comparava só os dígitos do documento e
   aceitava "sem fornecedor" como coringa.

   No mesmo lançamento havia mais duas coisas erradas:
   · o vencimento digitado não era o gravado — existiam DOIS campos de
     vencimento na janela, e o de baixo mandava;
   · a categoria sumia: o download que não sabia traduzir a subcategoria
     gravava "sem categoria" — e o envio seguinte apagava na nuvem.
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
  console.log('\nCarregando o sistema para o guardião do lançamento que virava nota…');
  let win;
  try { win = await carregar(); }
  catch (e) { console.log('   FALHA não carregou o index.html: ' + e.message); process.exit(1); }
  const doc = win.document;
  const toasts = []; win.toast = m => toasts.push(String(m));
  win.salvar = () => {}; win.logNuvem = () => {}; win.telaLancamentos = () => {};
  win.rodape = () => {}; win.pergunta = async () => true;

  grupo('As peças existem');
  ['notaDoLanc', 'ehLancDeNota', 'soltarNotasDeLancErrado'].forEach(fn =>
    t('existe ' + fn + '()', typeof win[fn] === 'function', typeof win[fn]));

  /* a loja de Santa Fé, com a nota do Mercado Local e o imposto */
  win.DB.fornec = [{ id: 'fo_merc', empresa: 'Mercado Local', sucursais: ['*'] }];
  win.DB.notas = [{ id: 'nf_pix', numero: 'PIX2609', data: '2026-09-16',
    fornecedorId: 'fo_merc', fornecedorNome: 'Mercado Local', valorTotal: 233.81,
    itens: [{ insumoId: 'i1', nome: 'Leite', unidade: 'un', qtd: 12, total: 100 },
            { insumoId: 'i2', nome: 'Veja Multiuso', unidade: 'un', qtd: 1, total: 20 },
            { insumoId: 'i3', nome: 'Bis', unidade: 'un', qtd: 192, total: 100 }] }];
  const imposto = { id: 'lf_simples', tipo: 'despesa', descricao: 'SIMPLES NACIONAL',
    documento: 'SIMPLES2609', valor: 6299.33, emissao: '2026-09-16', vencimento: '2026-09-21',
    categoriaId: 'sc_imp', fornecedorId: '', fornecedor: '' };
  const daNota = { id: 'lf_nota', tipo: 'despesa', descricao: 'NF PIX2609 — Mercado Local',
    documento: 'NF PIX2609', valor: 233.81, origem: 'nota-entrada',
    fornecedorId: 'fo_merc', fornecedor: 'Mercado Local' };
  win.DB.lancFin = [imposto, daNota];

  grupo('O imposto não pega a nota pelo número parecido');
  t('SIMPLES2609 NÃO acha a nota PIX2609', win.notaDoLanc(imposto) === null, JSON.stringify(win.notaDoLanc(imposto)));
  t('e o lançamento não fica marcado com a nota', !imposto.ref, imposto.ref);
  t('o boleto que É da nota continua achando a dele', (win.notaDoLanc(daNota) || {}).id === 'nf_pix');
  t('e ele fica religado', daNota.ref === 'nf_pix');

  grupo('"Sem fornecedor" não é coringa');
  const semForn = { id: 'lf_x', tipo: 'despesa', descricao: 'Taxa', documento: '2609',
    origem: 'nota-entrada', fornecedorId: '', fornecedor: '' };
  t('número igual, sem fornecedor: não vincula', win.notaDoLanc(semForn) === null);
  const outroForn = { id: 'lf_y', tipo: 'despesa', descricao: 'Compra', documento: 'NF 2609',
    origem: 'nota-entrada', fornecedorId: 'fo_outro', fornecedor: 'Outro' };
  t('número igual, fornecedor diferente: não vincula', win.notaDoLanc(outroForn) === null);

  grupo('O vínculo errado que já ficou gravado é solto sozinho');
  const velho = { id: 'lf_velho', tipo: 'despesa', descricao: 'IPTU', documento: 'IPTU2609',
    ref: 'nf_pix', fornecedorId: '', fornecedor: '' };
  win.DB.lancFin.push(velho);
  const soltou = win.soltarNotasDeLancErrado();
  t('soltou o lançamento que não é de nota', soltou === 1 && !velho.ref, soltou);
  t('e não mexeu no que é de nota de verdade', daNota.ref === 'nf_pix');

  grupo('A tela de editar não mostra itens de nota alheia');
  win.DB.catfin = [{ id: 'cp1', nome: 'Impostos Diretos', tipo: 'despesa',
    itens: [{ id: 'sc_imp', nome: 'Simples Nacional' }] }];
  win.DB.contas = [{ id: 'cc1', nome: 'Caixa' }];
  win.DB.formasPag = [{ id: 'fp_pix', nome: 'PIX' }];
  win.modalLanc('lf_simples');
  const janela = doc.body.innerHTML;
  t('a janela abriu', !!doc.getElementById('lnD'));
  t('não aparece nenhum item da nota do Mercado Local',
    janela.indexOf('Veja Multiuso') < 0 && janela.indexOf('Pastilha') < 0);
  t('a categoria escolhida aparece, não "Selecione uma opção"',
    /Simples Nacional/.test((doc.getElementById('lnCatB') || {}).textContent || ''),
    (doc.getElementById('lnCatB') || {}).textContent);
  t('o vencimento gravado aparece no campo', doc.getElementById('lnVc').value === '2026-09-21',
    doc.getElementById('lnVc').value);
  t('na edição o vencimento de cima é o que vale (não há bloco de parcelas)',
    doc.getElementById('lnVc').parentElement.style.display !== 'none' && !doc.getElementById('lnParc'));

  grupo('Categoria não some no download que não soube traduzir');
  const html = fs.readFileSync(ARQ, 'utf8');
  t('o download preserva a categoria quando não acha a subcategoria', /_catDoLanc\(x\)/.test(html));
  t('e a função existe', /function _catDoLanc\(x\)\{/.test(html.replace(/\s+/g, '')) ||
    /function _catDoLanc\(x\)\s*\{/.test(html));

  grupo('Sem erro de console');
  t('nenhum erro de página', erros.length === 0, erros.join(' | '));

  console.log('\n' + '═'.repeat(52));
  console.log('Joia · Lançamento de imposto não vira nota de entrada');
  console.log(R.ok + ' de ' + R.total + ' testes passaram' + (R.falhou ? ' · ' + R.falhou + ' FALHA(S)' : ''));
  console.log('═'.repeat(52) + '\n');
  process.exit(R.falhou ? 1 : 0);
})();

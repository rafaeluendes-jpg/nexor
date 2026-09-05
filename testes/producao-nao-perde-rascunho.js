/* ==========================================================
   JOIA — A PRODUÇÃO NÃO PERDE O QUE ESTÁ NA TELA (Fase 1)

   Rodar:  node testes/producao-nao-perde-rascunho.js
   ou:     npm run test:producao-rascunho   (entra no portão)

   POR QUE ESTE ARQUIVO EXISTE (incidente 04/09/2026)

   A loja produzia vários sabores, alguém clicou em "Atualizar agora", a
   página recarregou e a pesagem em andamento sumiu. Tudo que a pessoa
   preenchia na produção morava só no objeto `OP`, em memória — nunca no
   aparelho. Reload = OP volta ao vazio e a produção do dia se perde.

   Este guardião trava a correção: o que está sendo pesado é salvo como
   rascunho no aparelho a cada mudança e volta depois de um recarregamento,
   sem entrar no DB nem subir para a nuvem, e isolado por unidade.
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

(async function () {
  console.log('\nCarregando o sistema para o guardião da produção…');
  let win;
  try { win = await carregar(); }
  catch (e) { console.log('   FALHA não carregou o index.html: ' + e.message); process.exit(1); }

  grupo('As peças do rascunho de produção existem');
  ['guardarRascunhoOP', 'lerRascunhoOP', 'limparRascunhoOP', 'continuarOP',
   'faixaProducaoEmAndamento', '_gravarRascunhoOPAgora']
    .forEach(fn => t('existe ' + fn + '()', typeof win[fn] === 'function', typeof win[fn]));

  /* uma unidade fixa para o teste (o rascunho é de UMA loja) */
  win.lojaAtualId = () => 'suc_teste';
  try { win.localStorage.removeItem('nexor_producao_rascunho'); } catch (e) {}

  grupo('O que está sendo pesado é salvo no aparelho na hora');
  win.OP = { aba: 'nova', de: '', ate: '', itens: [
    { fichaId: 'f1', nome: 'ABACAXI GELATO', previsto: 4.8, unidade: 'kg', cubas: ['2,4', '2,3', ''] }
  ], resp: 'Maria', obs: 'teste', data: '2026-09-04', busca: '', verReceita: null, todos: false };
  win._gravarRascunhoOPAgora();
  let cru = win.localStorage.getItem('nexor_producao_rascunho');
  t('o rascunho foi gravado no localStorage', !!cru, String(cru).slice(0, 40));
  t('o rascunho NÃO entra no DB (não é dado ainda)',
    !((win.DB && win.DB.ordensProd) || []).length, JSON.stringify((win.DB || {}).ordensProd));

  grupo('Depois de um reload, a pesagem volta inteira');
  /* simula o reload: OP volta ao vazio, como no arranque */
  win.OP = { aba: 'hist', de: '', ate: '', itens: [], resp: '', obs: '', data: '', busca: '', verReceita: null, todos: false };
  const r = win.lerRascunhoOP();
  t('lerRascunhoOP recupera o rascunho', !!r && (r.itens || []).length === 1, JSON.stringify(r));
  t('a pesagem das cubas voltou', !!r && r.itens[0].cubas.join('|') === '2,4|2,3|', JSON.stringify(r && r.itens[0].cubas));
  t('o responsável e a data voltaram', !!r && r.resp === 'Maria' && r.data === '2026-09-04');

  grupo('A faixa "produção em andamento" reaparece no histórico');
  const faixa = win.faixaProducaoEmAndamento();
  t('a faixa aparece com o botão de continuar', /Continuar a produção/.test(faixa) && /1 sabor/.test(faixa), faixa.slice(0, 80));
  win.continuarOP();
  t('continuar restaura o OP com a pesagem',
    win.OP.aba === 'nova' && (win.OP.itens || []).length === 1 && win.OP.itens[0].cubas.join('|') === '2,4|2,3|',
    JSON.stringify(win.OP.itens));

  grupo('O rascunho é de UMA unidade só');
  win.lojaAtualId = () => 'outra_loja';
  t('rascunho de outra loja não aparece aqui', win.lerRascunhoOP() === null);
  win.lojaAtualId = () => 'suc_teste';

  grupo('Ao produzir/descartar, o rascunho some');
  win.limparRascunhoOP();
  t('limpar apaga a chave do rascunho', !win.localStorage.getItem('nexor_producao_rascunho'));
  t('sem rascunho, a faixa não aparece', win.faixaProducaoEmAndamento() === '');

  grupo('Balanço: zero erro de runtime durante o guardião');
  t('nenhum erro de runtime na sessão inteira', erros.length === 0, erros.slice(0, 8).join(' | '));

  console.log('\n' + '═'.repeat(52));
  console.log('Joia · A produção não perde o que está na tela');
  console.log(R.ok + ' de ' + R.total + ' testes passaram' + (R.falhou ? ' · ' + R.falhou + ' FALHA(S)' : ''));
  console.log('═'.repeat(52) + '\n');
  try { win.close(); } catch (e) {}
  process.exit(R.falhou ? 1 : 0);
})();

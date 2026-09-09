/* ==========================================================
   JOIA — PRODUÇÃO: Nº DE RECEITAS MULTIPLICA PREVISTO E BAIXA

   Rodar:  node testes/producao-multiplica-receitas.js
   ou:     npm run test:producao-receitas   (entra no portão)

   POR QUE ESTE ARQUIVO EXISTE (pedido do Rafael, 09/09/2026)

   Antes, ao produzir, o sistema assumia SEMPRE uma receita por sabor:
   o previsto era o rendimento de uma fôrma e a baixa de estoque saía de
   uma receita só. Quem fazia duas fôrnadas do mesmo sabor via a metade
   do ingrediente sair do estoque — conta errada silenciosa.

   Agora cada sabor tem um campo "quantas receitas". Escolher 2 num sabor
   de 4 kg faz o previsto virar 8 kg E baixar o DOBRO dos ingredientes.
   Este guardião trava as duas contas: o previsto e a quantidade que vai
   para a baixa de estoque escalam pelo número de receitas.
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
  console.log('\nCarregando o sistema para o guardião de receitas…');
  let win;
  try { win = await carregar(); }
  catch (e) { console.log('   FALHA não carregou o index.html: ' + e.message); process.exit(1); }

  grupo('As peças do nº de receitas existem');
  ['recOP', 'qtdIngredienteOP', 'setReceitasOP', 'addSaborOP']
    .forEach(fn => t('existe ' + fn + '()', typeof win[fn] === 'function', typeof win[fn]));

  win.lojaAtualId = () => 'suc_teste';
  try { win.localStorage.removeItem('nexor_producao_rascunho'); } catch (e) {}

  grupo('recOP: sempre um inteiro >= 1');
  t('sem valor vira 1', win.recOP({}) === 1, win.recOP({}));
  t('2 continua 2', win.recOP({ receitas: 2 }) === 2, win.recOP({ receitas: 2 }));
  t('0 e negativo viram 1', win.recOP({ receitas: 0 }) === 1 && win.recOP({ receitas: -3 }) === 1);
  t('decimal arredonda', win.recOP({ receitas: 2.4 }) === 2 && win.recOP({ receitas: 2.6 }) === 3);

  grupo('setReceitasOP multiplica o previsto pelo peso de UMA receita');
  win.OP = { aba: 'nova', de: '', ate: '', itens: [
    { fichaId: 'f1', nome: 'MORANGO GELATO', receitas: 1, previstoRec: 4, previsto: 4,
      unidade: 'kg', qtdReceita: 4, unReceita: 'kg', cubas: ['', '', '', ''] }
  ], resp: '', obs: '', data: '2026-09-09', busca: '', verReceita: null, todos: false };
  win.setReceitasOP(0, 2);
  t('2 receitas de 4 kg → previsto 8 kg', win.OP.itens[0].previsto === 8, win.OP.itens[0].previsto);
  t('a baixa de ingrediente também dobra (8)', win.qtdIngredienteOP(win.OP.itens[0]) === 8,
    win.qtdIngredienteOP(win.OP.itens[0]));
  win.setReceitasOP(0, 3);
  t('3 receitas → previsto 12 kg', win.OP.itens[0].previsto === 12, win.OP.itens[0].previsto);
  t('3 receitas → baixa 12', win.qtdIngredienteOP(win.OP.itens[0]) === 12);
  win.setReceitasOP(0, 0);
  t('voltar para 0 recai em 1 receita (previsto 4)', win.OP.itens[0].previsto === 4 && win.OP.itens[0].receitas === 1,
    JSON.stringify({ p: win.OP.itens[0].previsto, r: win.OP.itens[0].receitas }));

  grupo('Novo sabor nasce com 1 receita e 4 cubas');
  win.DB = win.DB || {};
  win.DB.fichas = [{ id: 'f9', nome: 'ABACAXI GELATO', rendimento: 4, unidade: 'kg',
    rendUnidade: 'kg', destinoId: '__nenhum', categoriaId: 'c1', itens: [{ insumoId: 'i1', qtd: 4, unidade: 'kg' }] }];
  win.OP = { aba: 'nova', de: '', ate: '', itens: [], resp: '', obs: '', data: '2026-09-09', busca: '', verReceita: null, todos: false };
  const _tp = win.telaProducao; win.telaProducao = () => {};   /* não renderiza no teste */
  win.addSaborOP('f9');
  win.telaProducao = _tp;
  const it = (win.OP.itens || [])[0] || {};
  t('o sabor entrou na ordem', win.OP.itens.length === 1, win.OP.itens.length);
  t('nasce com 1 receita', it.receitas === 1, it.receitas);
  t('guarda o peso de uma receita (previstoRec)', it.previstoRec === 4, it.previstoRec);
  t('tem 4 campos de peso (cubas)', Array.isArray(it.cubas) && it.cubas.length === 4, JSON.stringify(it.cubas));

  grupo('A tela mostra a coluna Receitas e a 4ª cuba');
  const fonte = fs.readFileSync(ARQ, 'utf8');
  t('a coluna Receitas está no cabeçalho', />Receitas</.test(fonte));
  t('a coluna Cuba 4 está no cabeçalho', /Cuba 4/.test(fonte));
  t('a linha monta 4 cubas ([0,1,2,3])', /\[0,1,2,3\]\.map/.test(fonte));

  grupo('Balanço: zero erro de runtime durante o guardião');
  t('nenhum erro de runtime na sessão inteira', erros.length === 0, erros.slice(0, 8).join(' | '));

  console.log('\n' + '═'.repeat(52));
  console.log('Joia · Produção multiplica o nº de receitas');
  console.log(R.ok + ' de ' + R.total + ' testes passaram' + (R.falhou ? ' · ' + R.falhou + ' FALHA(S)' : ''));
  console.log('═'.repeat(52) + '\n');
  try { win.close(); } catch (e) {}
  process.exit(R.falhou ? 1 : 0);
})();

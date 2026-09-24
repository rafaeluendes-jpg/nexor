/* ==========================================================
   JOIA — A CATEGORIA DO LANÇAMENTO CHEGA NA NUVEM

   Rodar:  node testes/categoria-do-lancamento-sobe.js
   ou:     npm run test:catsobe   (entra no portão)

   POR QUE ESTE ARQUIVO EXISTE (auditoria RDS, 24/09/2026)

   A RDS encontrou 74 lançamentos "sem categoria" na nuvem. Boa parte
   estava classificada NA TELA DA LOJA. O envio traduz a subcategoria por
   fkSub(), que procura o identificador da nuvem num mapa (_ids). O
   download só registrava nesse mapa a categoria PAI; as subcategorias,
   que descem aninhadas, nunca entravam. Num aparelho que recebeu o plano
   de contas pelo download — o de toda loja — `subcategoria_id` subia
   nulo, e a API, o DRE da rede e a auditoria viam "sem categoria".

   Este guardião roda o DOWNLOAD DE VERDADE (com a nuvem simulada) e
   confere que, depois dele, o envio do lançamento leva a subcategoria.
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
  const dom = new JSDOM(fs.readFileSync(ARQ, 'utf8'), {
    runScripts: 'dangerously', pretendToBeVisual: true,
    url: 'https://joiagest.com.br/', virtualConsole: vc,
    beforeParse(win) {
      win.fetch = () => Promise.reject(new Error('offline no teste'));
      win.matchMedia = win.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} }));
      win.scrollTo = () => {}; win.print = () => {}; win.alert = () => {}; win.confirm = () => true;
      win.addEventListener('error', e => erros.push('window.onerror: ' + (e.error && e.error.message || e.message)));
    }
  });
  await new Promise(r => setTimeout(r, 900));
  return dom.window;
}

(async function () {
  console.log('\nCarregando o sistema para o guardião da categoria do lançamento…');
  let win;
  try { win = await carregar(); }
  catch (e) { console.log('   FALHA não carregou o index.html: ' + e.message); process.exit(1); }

  /* a nuvem: um plano de contas com uma subcategoria, e o lançamento que
     a loja classificou mas que chegou lá sem subcategoria */
  win.api = async (rota) => {
    if (/^categorias_financeiras/.test(rota)) return [{
      id: 'uuid-cat', ref_local: 'cat_imp', nome: 'Impostos', tipo: 'despesa', ordem: 0,
      subcategorias_financeiras: [{ id: 'uuid-sub', ref_local: 'cat_imp_sc_simples', nome: 'Simples Nacional', ordem: 0 }] }];
    if (/^lancamentos_financeiros/.test(rota)) return [{
      id: 'uuid-lf', ref_local: 'lf_simples', tipo: 'despesa', subcategoria_id: null,
      descricao: 'SIMPLES NACIONAL', valor: 6340.91, emissao: '2026-09-16', vencimento: '2026-09-21' }];
    return [];
  };
  win.tokenAtual = async () => 't';
  win.carregarQuemTemSenha = async () => {};
  win.NUVEM.ligada = true; win.NUVEM.plataforma = false;
  win.NUVEM.loja = '11111111-2222-3333-4444-555555555555';
  /* o aparelho da loja: o lançamento classificado em "Simples Nacional",
     plano de contas recebido pelo download (nunca enviado por aqui) */
  win.DB.lancFin = [{ id: 'lf_simples', tipo: 'despesa', categoriaId: 'sc_simples',
    descricao: 'SIMPLES NACIONAL', valor: 6340.91, emissao: '2026-09-16' }];
  win.DB._uuid = {};

  grupo('O download de verdade');
  let falhou = null;
  try { await win.baixarDaNuvem(true); } catch (e) { falhou = e.message; }
  t('o download termina sem erro', !falhou, falhou);
  const cat = (win.DB.catfin || [])[0] || {};
  t('o plano de contas desceu com a subcategoria', (cat.itens || []).some(s => s.id === 'sc_simples'),
    JSON.stringify(win.DB.catfin));
  const lanc = (win.DB.lancFin || []).find(l => l.id === 'lf_simples') || {};
  t('a tela da loja continua com o lançamento classificado', lanc.categoriaId === 'sc_simples', lanc.categoriaId);

  grupo('O envio seguinte leva a categoria para a nuvem');
  const E = (win.MAPA || []).find(e => e.col === 'lancFin');
  t('existe a regra de envio do lançamento', !!E);
  const campos = E ? E.campos(lanc) : {};
  t('subcategoria_id vai preenchida (não nula)', campos.subcategoria_id === 'uuid-sub', campos.subcategoria_id);

  grupo('E continua depois de o mapa ser remontado');
  /* _ids é zerado e remontado a partir de DB._uuid a cada envio */
  for (const k of Object.keys(win._ids)) delete win._ids[k];
  t('com o mapa vazio a tradução não acha nada (prova do cenário)', win.fkSub('sc_simples') === null);
  await win.montarMapaVinculos(null);
  t('remontado a partir do que o aparelho guardou, a subcategoria volta', win.fkSub('sc_simples') === 'uuid-sub',
    win.fkSub('sc_simples'));
  t('o identificador antigo (com o prefixo da categoria) também traduz',
    win.fkSub('cat_imp_sc_simples') === 'uuid-sub');

  grupo('Sem erro de página');
  t('nenhum erro', erros.length === 0, erros.slice(0, 5).join(' | '));

  console.log('\n' + '═'.repeat(52));
  console.log('Joia · A categoria do lançamento chega na nuvem');
  console.log(R.ok + ' de ' + R.total + ' testes passaram' + (R.falhou ? ' · ' + R.falhou + ' FALHA(S)' : ''));
  console.log('═'.repeat(52) + '\n');
  process.exit(R.falhou ? 1 : 0);
})();

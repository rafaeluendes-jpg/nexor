/* ==========================================================
   JOIA — O DRE ABRE EM CASCATA E O CPV É O CONSUMO DAS VENDAS

   Rodar:  node testes/dre-arvore.js
   ou:     npm run test:drearvore   (entra no portão)

   POR QUE ESTE ARQUIVO EXISTE (pedido do Rafael, 12/09/2026)

   O DRE mostrava só o total de cada rubrica. Agora guarda de onde veio
   cada centavo e a tela abre em cascata pelo "+": venda → grupo do
   cardápio → produto; CPV → grupo → produto → ingrediente; despesa →
   categoria → subcategoria → unidade → lançamento; DFV → forma. A soma
   dos galhos É o total da rubrica. E o CPV é o que foi CONSUMIDO pelas
   vendas — nota de entrada nunca entra, mesmo com a chave antiga gravada.
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
const perto = (a, b) => Math.abs((Number(a) || 0) - (Number(b) || 0)) < 1e-6;

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
  console.log('\nCarregando o sistema para o guardião do DRE…');
  let win;
  try { win = await carregar(); }
  catch (e) { console.log('   FALHA não carregou o index.html: ' + e.message); process.exit(1); }

  grupo('As peças existem');
  ['calcularDRE', 'telaDRE', 'toggleDre', 'cfgDRE'].forEach(fn =>
    t('existe ' + fn + '()', typeof win[fn] === 'function', typeof win[fn]));

  /* ---- cenário: setembro/2026, duas unidades ---- */
  win.ehCancelado = () => false;
  win.sucAtivas = () => [{ id: 'suc_a', nome: 'Santa Fé' }, { id: 'suc_b', nome: 'Jales' }];
  win.sucNome = id => ({ suc_a: 'Santa Fé', suc_b: 'Jales' })[id] || id;
  win.salvar = () => {};
  win.DB = win.DB || {};
  Object.assign(win.DB, {
    categorias: [{ id: 'c1', nome: 'Gelato' }, { id: 'c2', nome: 'Cascão' }],
    produtos: [{ id: 'p1', nome: 'Copo P', categoriaId: 'c1', fichaId: 'f1' },
               { id: 'p2', nome: 'Cascão 1 bola', categoriaId: 'c2', fichaId: 'f2' }],
    fichas: [{ id: 'f1', nome: 'MORANGO GELATO', itens: [] }, { id: 'f2', nome: 'CASCAO 1 BOLA', itens: [] }],
    pedidos: [{ id: 'pe1', data: '2026-09-05', total: 30, sucursalId: 'suc_a',
      itens: [{ produtoId: 'p1', nome: 'Copo P', total: 20 }, { produtoId: 'p2', nome: 'Cascão 1 bola', total: 10 }],
      pagamentos: [{ forma: 'fp1', valor: 30 }] }],
    formasPag: [{ id: 'fp1', nome: 'Pix', taxaPct: 1, taxaFixa: 0, ativa: true }],
    movEst: [{ id: 'mv1', data: '2026-09-05', linhas: [
      { direcao: 'saida', origem: 'venda', fichaNome: 'MORANGO GELATO', nome: 'BASE MORANGO', qtd: 2, custo: 5 },
      { direcao: 'saida', origem: 'venda', nome: 'COPO P (emb)', qtd: 1, custo: 1 },
      { direcao: 'entrada', origem: 'nota', nome: 'AÇÚCAR', qtd: 50, custo: 4 } ] }],
    notas: [{ id: 'n1', data: '2026-09-05', valorTotal: 999 }],
    catfin: [{ id: 'cp', nome: 'Pessoal', itens: [{ id: 'cs', nome: 'Salários' }] }],
    lancFin: [{ id: 'l1', categoriaId: 'cs', valor: 100, emissao: '2026-09-03', descricao: 'Maria', sucursalId: 'suc_a' },
              { id: 'l2', categoriaId: 'cs', valor: 50,  emissao: '2026-09-03', descricao: 'João',  sucursalId: 'suc_b' }],
    cfgDre: { regime: 'competencia', aliqImposto: 0, royaltiesPct: 0, fundoPct: 0,
              mapa: { cs: '09' }, fora: [], cpvPorCompra: true /* chave antiga, gravada */ }
  });

  grupo('CPV é o consumo das vendas — nunca nota de entrada');
  t('a chave antiga "por compra" é ignorada (fica false)', win.cfgDRE().cpvPorCompra === false, win.cfgDRE().cpvPorCompra);
  const m = win.calcularDRE(2026);
  const S = 8; /* setembro */
  t('CPV de setembro = 2×5 + 1×1 = 11 (não os R$ 999 da nota)', perto(m[S]['02'], 11), m[S]['02']);

  grupo('A árvore guarda de onde veio cada valor');
  const det = m.det || {};
  const g = (no, ...cam) => cam.reduce((x, r) => (x && x.ch && x.ch[r]) || null, no);
  t('01.01 Vendas = 30', perto(m[S]['01.01'], 30), m[S]['01.01']);
  t('vendas → Gelato = 20', perto((g(det['01.01'], 'Gelato') || {}).v?.[S], 20), JSON.stringify(g(det['01.01'], 'Gelato')));
  t('vendas → Cascão = 10', perto((g(det['01.01'], 'Cascão') || {}).v?.[S], 10));
  t('vendas → Gelato → Copo P = 20', perto((g(det['01.01'], 'Gelato', 'Copo P') || {}).v?.[S], 20));
  t('CPV → Gelato → MORANGO GELATO → BASE MORANGO = 10',
    perto((g(det['02'], 'Gelato', 'MORANGO GELATO', 'BASE MORANGO') || {}).v?.[S], 10),
    JSON.stringify(Object.keys((det['02'] || {}).ch || {})));
  t('CPV → item sem ficha vai para "Sem grupo" = 1', perto((g(det['02'], 'Sem grupo', 'COPO P (emb)') || {}).v?.[S], 1));
  t('DFV → Pix = 0,30', perto((g(det['05'], 'Pix') || {}).v?.[S], 0.3));
  t('09 Pessoal = 150', perto(m[S]['09'], 150), m[S]['09']);
  t('pessoal → Pessoal → Salários → Santa Fé = 100', perto((g(det['09'], 'Pessoal', 'Salários', 'Santa Fé') || {}).v?.[S], 100),
    JSON.stringify(Object.keys((g(det['09'], 'Pessoal', 'Salários') || { ch: {} }).ch || {})));
  t('pessoal → … → Jales = 50', perto((g(det['09'], 'Pessoal', 'Salários', 'Jales') || {}).v?.[S], 50));
  const folha = g(det['09'], 'Pessoal', 'Salários', 'Santa Fé');
  t('o último nível é o lançamento com o nome da pessoa', !!(folha && folha.ch && Object.keys(folha.ch).some(k => /Maria/.test(k))),
    JSON.stringify(Object.keys((folha || { ch: {} }).ch || {})));
  const somaGalhos = Object.keys(det['01.01'].ch).reduce((a, k) => a + det['01.01'].ch[k].v[S], 0);
  t('a soma dos galhos é o total da rubrica (sem dois números)', perto(somaGalhos, m[S]['01.01']), somaGalhos);

  grupo('A tela abre em cascata pelo "+"');
  if (!win.document.getElementById('content')) { const d = win.document.createElement('div'); d.id = 'content'; win.document.body.appendChild(d); }
  win.DRE.ano = 2026; win.DRE.mes = 9; win.DRE.ab = null;
  let renderOk = true; try { win.telaDRE(); } catch (e) { renderOk = false; erros.push('telaDRE: ' + e.message); }
  t('telaDRE renderiza sem erro', renderOk);
  const html1 = win.document.getElementById('content').innerHTML;
  t('há botões "+" nas rubricas com detalhe', /class="dreTg"/.test(html1));
  t('fechado: o produto ainda não aparece', !/Copo P/.test(html1));
  const bt = win.document.querySelector('.dreTg[data-k="01.01"]');
  t('a rubrica 01.01 tem o seu "+"', !!bt);
  if (bt) { win.toggleDre(bt); }
  const html2 = win.document.getElementById('content').innerHTML;
  t('um clique abre o grupo (Gelato)', /Gelato/.test(html2));
  const bt2 = win.document.querySelector('.dreTg[data-k="01.01|Gelato"]');
  if (bt2) win.toggleDre(bt2);
  const html3 = win.document.getElementById('content').innerHTML;
  t('segundo clique chega ao produto (Copo P)', /Copo P/.test(html3));

  grupo('Configuração: a opção de CPV por nota sumiu');
  const fonte = fs.readFileSync(ARQ, 'utf8');
  t('não existe mais o seletor drCpv', !/id="drCpv"/.test(fonte));

  grupo('Balanço: zero erro de runtime durante o guardião');
  t('nenhum erro de runtime na sessão inteira', erros.length === 0, erros.slice(0, 8).join(' | '));

  console.log('\n' + '═'.repeat(52));
  console.log('Joia · DRE em cascata · CPV pelo consumo');
  console.log(R.ok + ' de ' + R.total + ' testes passaram' + (R.falhou ? ' · ' + R.falhou + ' FALHA(S)' : ''));
  console.log('═'.repeat(52) + '\n');
  try { win.close(); } catch (e) {}
  process.exit(R.falhou ? 1 : 0);
})();

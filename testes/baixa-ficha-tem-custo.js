/* ==========================================================
   JOIA — FICHA NA BAIXA MANUAL TEM O CUSTO DA RECEITA

   Rodar:  node testes/baixa-ficha-tem-custo.js
   ou:     npm run test:bxficha   (entra no portão)

   POR QUE ESTE ARQUIVO EXISTE (Rafael, 24/09/2026)
   CASCAO 2 BOLAS, 2 un, lançado na Baixa Manual com custo R$ 0,00. A
   ficha de venda não tem estoque próprio, e o custo de item sem saldo é
   zero. Para ficha, o custo é a receita. Este guardião confere o custo
   novo e o conserto das baixas de ficha já registradas com zero —
   pendentes e lançadas, com a linha do movimento de estoque.
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
const perto = (a, b) => Math.abs((Number(a) || 0) - (Number(b) || 0)) < 0.005;
const erros = [];
(async function () {
  console.log('\nCarregando o sistema para o guardião do custo de ficha na baixa…');
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => erros.push('jsdomError: ' + (e && e.message)));
  const dom = new JSDOM(fs.readFileSync(ARQ, 'utf8'), {
    runScripts: 'dangerously', pretendToBeVisual: true,
    url: 'https://joiagest.com.br/', virtualConsole: vc,
    beforeParse(win) {
      win.fetch = () => Promise.reject(new Error('offline no teste'));
      win.matchMedia = win.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} }));
      win.scrollTo = () => {}; win.alert = () => {}; win.confirm = () => true;
      win.addEventListener('error', e => erros.push('window.onerror: ' + (e.error && e.error.message || e.message)));
    }
  });
  await new Promise(r => setTimeout(r, 900));
  const win = dom.window, doc = win.document;
  if (!doc.getElementById('content')) { const d = doc.createElement('div'); d.id = 'content'; doc.body.appendChild(d); }
  let salvou = 0; win.salvar = () => { salvou++; };
  win.lojaAtualId = () => 'suc_sf';

  /* CASCAO 2 BOLAS: 1 cascão (R$ 0,70) + 120 g de GELATO VENDA (R$ 23,80/kg) = R$ 3,556 por unidade */
  win.DB.insumos = [
    { id: 'ins_casc', nome: 'CASCAO', unidade: 'un', custo: 0.70, estoqueAtual: 50, controlaEstoque: true },
    { id: 'ins_gv', nome: 'GELATO VENDA', unidade: 'kg', custo: 23.80, estoqueAtual: 10, controlaEstoque: true }];
  win.DB.fichas = [{ id: 'fi_c2', nome: 'CASCAO 2 BOLAS', unidade: 'un', rendUnidade: 'un', rendimento: 1,
    estoqueAtual: 0, itens: [{ insumoId: 'ins_casc', qtd: 1, unidade: 'un' }, { insumoId: 'ins_gv', qtd: 120, unidade: 'g' }] }];

  grupo('O custo da ficha vem da receita');
  const it = win.itensParaBaixa().find(x => x.id === 'fi_c2');
  t('CASCAO 2 BOLAS (sem estoque próprio) custa R$ 3,56 e não zero', it && perto(it.custo, 3.556), it && it.custo);
  t('ficha com custo médio de estoque continua usando ele',
    perto(win.custoFichaNaBaixa({ id: 'b', itens: [], rendimento: 1, unidade: 'kg', estoqueAtual: 5, custoMedio: 40 }), 40));

  grupo('As baixas de ficha já registradas com zero são consertadas');
  win.DB.movEst = [{ id: 'mv1', data: '2026-09-01', motivoId: 'mt_mkt',
    linhas: [{ insumoId: 'fi_c2', nome: 'CASCAO 2 BOLAS', unidade: 'un', qtd: 2, custo: 0, direcao: 'saida' }] }];
  win.DB.baixasPend = [
    { id: 'bx1', sucursalRef: 'suc_sf', itemRef: 'fi_c2', itemNome: 'CASCAO 2 BOLAS', itemTipo: 'ficha', qtd: 2, unidade: 'un', custo: 0, situacao: 'pendente', data: '2026-09-01' },
    { id: 'bx2', sucursalRef: 'suc_sf', itemRef: 'fi_c2', itemNome: 'CASCAO 2 BOLAS', itemTipo: 'ficha', qtd: 2, unidade: 'un', custo: 0, situacao: 'lancada', movRef: 'mv1', data: '2026-09-01' },
    { id: 'bx3', sucursalRef: 'suc_jl', itemRef: 'fi_c2', itemNome: 'CASCAO 2 BOLAS', itemTipo: 'ficha', qtd: 1, unidade: 'un', custo: 0, situacao: 'pendente', data: '2026-09-01' },
    { id: 'bx4', sucursalRef: 'suc_sf', itemRef: 'ins_gv', itemNome: 'GELATO VENDA', itemTipo: 'insumo', qtd: 160, unidade: 'g', custo: 23.80, custoUnidade: 'kg', situacao: 'pendente', data: '2026-09-01' }];
  win.BX.filtro = 'todas';
  win.telaBaixaManual();
  const b = id => win.DB.baixasPend.find(x => x.id === id);
  t('a baixa pendente ganhou o custo da receita', perto(b('bx1').custo, 3.556), b('bx1').custo);
  t('a já lançada também', perto(b('bx2').custo, 3.556), b('bx2').custo);
  t('e a linha do movimento de estoque dela também', perto(win.DB.movEst[0].linhas[0].custo, 3.556), win.DB.movEst[0].linhas[0].custo);
  t('registro de outra unidade não é mexido por esta', b('bx3').custo === 0);
  t('insumo com custo não muda', b('bx4').custo === 23.80);
  t('o conserto foi gravado', salvou > 0);
  const html = doc.getElementById('content').innerHTML;
  t('a tela mostra R$ 7,11 para os 2 cascões', /R\$ 7,11/.test(html));
  const antes = salvou; win.telaBaixaManual();
  t('abrir de novo não regrava nada (só conserta o que está zerado)', salvou === antes);

  grupo('Uma baixa nova de ficha já nasce com custo');
  win.DB.baixasPend = [];
  win.baseMov();
  win.DB.motivosMov.push({ id: 'mt_mkt', nome: 'Markting', tipo: 'saida', ativo: true, sistema: false, sucursais: ['*'] });
  win.BX.item = win.itensParaBaixa().find(x => x.id === 'fi_c2');
  win.BX.qtd = '2'; win.BX.motivo = 'mt_mkt'; win.BX.quem = 'Loja'; win.BX.unidade = 'un'; win.BX.editando = null;
  win.salvarBaixa();
  const nv = win.DB.baixasPend[0] || {};
  t('custo gravado da receita', perto(nv.custo, 3.556), nv.custo);
  t('total R$ 7,11', perto(win.valorBaixa(nv), 7.11), win.valorBaixa(nv));

  grupo('Sem erro de página');
  t('nenhum erro', erros.length === 0, erros.slice(0, 5).join(' | '));

  console.log('\n' + '═'.repeat(52));
  console.log('Joia · Ficha na baixa tem o custo da receita');
  console.log(R.ok + ' de ' + R.total + ' testes passaram' + (R.falhou ? ' · ' + R.falhou + ' FALHA(S)' : ''));
  console.log('═'.repeat(52) + '\n');
  process.exit(R.falhou ? 1 : 0);
})();

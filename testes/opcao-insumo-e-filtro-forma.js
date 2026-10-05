/* ==========================================================
   OPÇÃO LIGADA A INSUMO + VENDAS DO CAIXA POR FORMA (05/10/2026)

   Rodar:  node testes/opcao-insumo-e-filtro-forma.js
   ou:     npm run test:opinsumo   (entra na bateria e no portão)

   Rafael:
     · "No grupo de opções, além de vincular a ficha técnica, ter a opção
       de vincular apenas o insumo, com a quantidade a ser debitada."
     · "Na frente de caixa, filtrar só dinheiro, só Pix, só crédito."

   Prende:
     1. a opção escolhe Ficha técnica ou Insumo; o insumo guarda
        quantidade e unidade, sobe e desce da nuvem;
     2. a venda baixa o insumo na quantidade × unidades vendidas — e o
        pedido do cardápio, que chega só com o nome, acha o cadastro;
     3. a opção com ficha continua como antes;
     4. as vendas do caixa filtram pela forma e somam o valor dela.
   Provado no Chromium: borda 30 g de Nutella, venda de 2 = 60 g.
   ========================================================== */
const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs');
const path = require('path');
const ARQ = path.join(__dirname, '..', 'index.html');
let falhas = 0, testes = 0;
function t(nome, ok, det) {
  testes++;
  if (ok) console.log('   ok   ' + nome);
  else { falhas++; console.log('   FALHOU  ' + nome + (det !== undefined ? '  → ' + det : '')); }
}
(async function () {
  const src = fs.readFileSync(ARQ, 'utf8');
  const erros = [];
  const vc = new VirtualConsole(); vc.on('jsdomError', e => erros.push(e && e.message));
  const dom = new JSDOM(src, {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://joiagest.com.br/', virtualConsole: vc,
    beforeParse(win) {
      win.fetch = () => Promise.reject(new Error('offline'));
      win.matchMedia = win.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} }));
      win.scrollTo = () => {}; win.print = () => {}; win.alert = () => {}; win.confirm = () => true;
      win.crypto = win.crypto || {}; if (!win.crypto.subtle) win.crypto.subtle = { digest: async () => new ArrayBuffer(32) };
    }
  });
  await new Promise(r => setTimeout(r, 900));
  const w = dom.window, DB = w.DB, doc = w.document;
  w.toast = () => {}; w.salvar = () => {};
  console.log('\n── 1. A opção liga ficha ou insumo\n');
  DB.insumos = [{ id: 'ins_nut', nome: 'Nutella', unidade: 'kg', controlaEstoque: true }];
  DB.fichas = [{ id: 'fi_bc', nome: 'BORDA CHOCOLATE', unidade: 'un', rendimento: 1, itens: [{ insumoId: 'ins_nut', qtd: 0.02, unidade: 'kg' }] }];
  DB.grupos = [{ id: 'grp_b', nome: 'Bordas', min: 0, max: 1, canais: [], sucursais: ['*'],
    opcoes: [{ id: 'op_n', nome: 'Borda Nutella', preco: 5, ativo: true, fichaId: '' }] }];
  w.formGrupo('grp_b');
  const tp = doc.querySelector('.goT');
  t('cada opção tem a escolha Ficha técnica / Insumo', !!tp && [...tp.options].map(o => o.value).join(',') === 'ficha,insumo');
  tp.value = 'insumo'; w.trocaTipoOp(tp);
  t('escolher Insumo mostra insumo, quantidade e unidade', doc.querySelector('.goInsBox').style.display === '' && doc.querySelector('.goF').style.display === 'none');
  doc.querySelector('.goI').value = 'Nutella'; doc.querySelector('.goQ').value = '30'; doc.querySelector('.goU').value = 'g';
  w.lerOps();
  const o = w.eval('_gops')[0];
  t('a opção guarda o insumo, 30 e g (e nenhuma ficha)', o.insumoId === 'ins_nut' && o.insumoQtd === 30 && o.insumoUn === 'g' && !o.fichaId, JSON.stringify(o));
  const E2 = w.eval('MAPA').find(e => e.col === 'grupos');
  const up = E2.filhos[0].campos(Object.assign({}, o), 0);
  t('sobe para a nuvem com insumo, quantidade e unidade', 'insumo_id' in up && up.insumo_qtd === 30 && up.insumo_un === 'g');
  t('e desce de volta (insumo traduzido depois que os insumos chegam)',
    /_insumoUid:o\.insumo_id\|\|'',insumoQtd:Number\(o\.insumo_qtd\)\|\|0,insumoUn:o\.insumo_un\|\|''/.test(src) &&
    /op\.insumoId=mapaIns\[uid\]\|\|_opInsAntes\[op\.id\]\|\|op\.insumoId\|\|'';/.test(src));
  t('o caixa leva o insumo junto da escolha', /insumoId:o\.insumoId\|\|'',insumoQtd:Number\(o\.insumoQtd\)\|\|0,insumoUn:o\.insumoUn\|\|''\}\);/.test(src));
  DB.grupos[0].opcoes = [Object.assign({}, o)];
  console.log('\n── 2. A venda baixa o insumo\n');
  DB.movEst = []; DB.produtos = [];
  const linhasDe = ped => { const a = DB.movEst.length; w.baixarEstoqueVenda(ped); return DB.movEst.slice(a).flatMap(m => m.linhas); };
  let l = linhasDe({ id: 'p1', itens: [{ qtd: 2, opcoes: [{ grupo: 'grp_b', nome: 'Borda Nutella', insumoId: 'ins_nut', insumoQtd: 30, insumoUn: 'g' }] }], data: new Date().toISOString(), sucursalId: w.lojaAtualId() });
  const emG = x => x.unidade === 'kg' ? Math.round(x.qtd * 1000 * 1000) / 1000 : x.qtd;   /* o razão guarda na unidade do insumo */
  t('2 vendidos × 30 g = 60 g de Nutella', l.length === 1 && l[0].insumoId === 'ins_nut' && emG(l[0]) === 60, JSON.stringify(l));
  l = linhasDe({ id: 'p2', itens: [{ qtd: 1, opcoes: [{ nome: 'Borda Nutella', preco: 5 }] }], data: new Date().toISOString(), sucursalId: w.lojaAtualId() });
  t('o pedido do cardápio (só o nome) acha o cadastro e baixa 30 g', l.length === 1 && emG(l[0]) === 30, JSON.stringify(l));
  l = linhasDe({ id: 'p3', itens: [{ qtd: 1, opcoes: [{ nome: 'Borda Chocolate', fichaId: 'fi_bc' }] }], data: new Date().toISOString(), sucursalId: w.lojaAtualId() });
  t('a opção com ficha continua abrindo a receita', l.length === 1 && l[0].insumoId === 'ins_nut' && Math.abs(l[0].qtd - 0.02) < 1e-9, JSON.stringify(l));
  console.log('\n── 3. Vendas do caixa por forma\n');
  const d = { ok: [{ id: 'a', pagamentos: [{ forma: 'fp_d', valor: 25 }, { forma: 'fp_c', valor: 40 }], total: 65 },
                   { id: 'b', pagamentos: [{ forma: 'fp_d', valor: 5 }], total: 5 }, { id: 'c', pagamentos: [{ forma: 'fp_c', valor: 36 }], total: 36 }] };
  w.VC.forma = 'fp_d';
  t('filtrar Dinheiro mostra só os pedidos com dinheiro', w.vcPedidosFiltrados(d).map(p => p.id).join(',') === 'a,b');
  t('e o valor é o que foi pago em dinheiro', w.valorNaFormaVC(d.ok[0], 'fp_d') === 25);
  w.VC.forma = '';
  t('sem filtro, todos', w.vcPedidosFiltrados(d).length === 3);
  t('o filtro está na aba Vendas, com total no rodapé', /\(d\.ok\.length\?vcFiltroForma\(d\):''\)/.test(src) && /Total em '\+E\(nomeFormaVC\(VC\.forma\)\)/.test(src));
  t('nenhum erro de runtime', erros.length === 0, erros.slice(0, 3).join(' | '));
  console.log('\n' + (falhas ? '✗ ' + falhas + ' de ' + testes + ' falharam' : '✓ ' + testes + ' testes passaram') + '\n');
  try { w.close(); } catch (e) {}
  process.exit(falhas ? 1 : 0);
})();

/* ==========================================================
   O BRINDE DO CARTÃO É O PRODUTO MARCADO NO CARDÁPIO (05/10/2026)

   Rodar:  node testes/fidelidade-brinde-vinculado.js
   ou:     npm run test:brindevinculo   (entra na bateria e no portão)

   Rafael: "Quero vincular a Experiência Jolô ao programa de fidelidade.
   Quando a pessoa ganhar, no caixa aparece automático para resgatar, dá
   baixa na ficha técnica dela, e vem a pergunta forçada do grupo — mais
   uma bola por R$ 5. E ter a opção de descartar."

   Prende:
     1. o brinde é o produto marcado e liberado nesta unidade; sem marcado,
        continua o "Cascão 1 Bola" pelo nome;
     2. identificado o cliente com o cartão completo, o resgate abre sozinho;
        "Agora não" não tira nada e não pergunta de novo nesta venda;
     3. com grupo, a pergunta vem antes: cancelar não resgata; confirmar
        baixa a ficha do brinde, e a bola a mais é cobrada e baixa na venda;
     4. o resgate com bola a mais não conta como compra do próximo cartão,
        nem depois de voltar da nuvem;
     5. a marcação é salva pela tela, sobe e desce da nuvem, e nulo não apaga.
   ========================================================== */
const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs');
const path = require('path');
const ARQ = path.join(__dirname, '..', 'index.html');
const MIG = path.join(__dirname, '..', 'supabase', 'migrations', '20261005_brinde_do_cartao_fidelidade.sql');
const R = { total: 0, ok: 0, falhou: 0 };
function grupo(n) { console.log('\n── ' + n); }
function t(nome, cond, det) {
  R.total++;
  if (cond) { R.ok++; console.log('   ok   ' + nome); }
  else { R.falhou++; console.log('   FALHA ' + nome + (det !== undefined ? '  → ' + det : '')); }
}
const perto = (a, b) => Math.abs((Number(a) || 0) - (Number(b) || 0)) < 0.005;
const esp = ms => new Promise(r => setTimeout(r, ms));
const erros = [];
(async function () {
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => erros.push('jsdomError: ' + (e && e.message)));
  const src = fs.readFileSync(ARQ, 'utf8');
  const dom = new JSDOM(src, {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://joiagest.com.br/', virtualConsole: vc,
    beforeParse(win) {
      win.fetch = () => Promise.reject(new Error('offline no teste'));
      win.matchMedia = win.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} }));
      win.scrollTo = () => {}; win.alert = () => {}; win.confirm = () => true;
      win.addEventListener('error', e => erros.push('window.onerror: ' + (e.error && e.error.message || e.message)));
    }
  });
  await esp(900);
  const w = dom.window, doc = w.document, $ = id => doc.getElementById(id);
  if (!$('content')) { const d = doc.createElement('div'); d.id = 'content'; doc.body.appendChild(d); }
  w.salvar = () => {}; w.toast = () => {};
  w.lojaAtualId = () => 'suc_sf';
  w.usuarioLogado = () => ({ id: 'u1', nome: 'Bia', login: 'bia@jologelato.com.br', tudo: true });
  w.DB.sucursais = [{ id: 'suc_sf', nome: 'Santa Fé', ativa: true }, { id: 'suc_jl', nome: 'Jales', ativa: true }];
  w.baseCRM(); w.baseMov();
  w.DB.insumos = [
    { id: 'ins_casc', nome: 'CASCAO', unidade: 'un', custo: 0.7, controlaEstoque: true },
    { id: 'ins_gv', nome: 'GELATO VENDA', unidade: 'kg', custo: 23.8, controlaEstoque: true }];
  w.DB.fichas = [{ id: 'fi_c1', nome: 'CASCAO 1 BOLA', unidade: 'un', rendUnidade: 'un', rendimento: 1, unidadesVenda: 1,
    itens: [{ insumoId: 'ins_casc', qtd: 1, unidade: 'un' }, { insumoId: 'ins_gv', qtd: 60, unidade: 'g' }] }];
  w.DB.grupos = [{ id: 'grp_fid', nome: 'PROGRAMA FIDELIDADE', forcado: true, min: 0, max: 1, canais: ['pdv'],
    opcoes: [{ nome: 'ACRESCENTAR MAIS 1 BOLA POR 5 REAIS?', preco: 5, insumoId: 'ins_gv', insumoQtd: 100, insumoUn: 'g', ativo: true }] }];
  const cascao = { id: 'pr_c1', nome: 'Cascão 1 Bola', preco: 19, ativo: true, vinculaEstoque: true, fichaId: 'fi_c1', sucursais: ['suc_sf'] };
  const expJales = { id: 'pr_xj', nome: 'EXPERIENCIA JALES', preco: 0.01, ativo: true, vinculaEstoque: true, fichaId: 'fi_c1',
    sucursais: ['suc_jl'], brindeFidelidade: true };
  const exp = { id: 'pr_exp', nome: 'EXPERIENCIA JOLO', preco: 0.01, ativo: true, vinculaEstoque: true, fichaId: 'fi_c1',
    sucursais: ['suc_sf'], grupos: ['grp_fid'], brindeFidelidade: true };
  w.setSaldoUn('ins_casc', 50, 'suc_sf'); w.setSaldoUn('ins_gv', 10, 'suc_sf');

  grupo('1. Qual é o brinde');
  w.DB.produtos = [cascao, expJales];
  t('o marcado de outra unidade não vale aqui: fica o Cascão 1 Bola', (w.produtoDoBrinde() || {}).id === 'pr_c1');
  w.DB.produtos = [cascao, expJales, exp];
  t('o marcado e liberado nesta unidade é o brinde', (w.produtoDoBrinde() || {}).id === 'pr_exp');

  const ana = { id: 'cli_ana', nome: 'Ana', tel: '(17) 99812-4477', compras: 10, gasto: 200, resgates: [] };
  w.DB.clientes = [ana];
  const venda = (n, total, quando, itens) => ({ id: 'p' + n, numero: n, clienteId: ana.id, sucursalId: 'suc_sf',
    total: total, fase: 'entregue', data: quando, itens: itens || [], pagamentos: [] });
  w.DB.pedidos = [];
  for (let i = 1; i <= 10; i++) w.DB.pedidos.push(venda(i, 20, '2026-09-' + String(10 + i) + 'T12:00:00Z'));
  t('dez compras: tem brinde', w.fidelidadeDoCliente(ana, 'suc_sf').temBrinde === true);

  grupo('2. O caixa fica sabendo sozinho');
  w.DB.categorias = [{ id: 'c1', nome: 'Gelatos', ativo: true }];
  w.DB.caixas = [{ id: 'cx1', sucursalId: 'suc_sf', aberto: '05/10/2026 15:00', inicial: 100, operador: 'Bia', movimentos: [] }];
  w.PDV.aba = 'venda'; w.telaPDV();
  w.PDV.comanda = []; w.PDV.brindeResgate = null; w.PDV.brindeAgoraNao = null;
  let perguntas = [];
  w.confirmar = async op => { perguntas.push(op); return false; };     /* "Agora não" */
  w.usarCliente(ana.id); await esp(60);
  t('identificou o cliente, o resgate abriu sozinho', perguntas.length === 1 && /ganhou o brinde/.test(perguntas[0].titulo));
  t('com o botão "Agora não"', perguntas[0] && perguntas[0].cancelar === 'Agora não');
  t('"Agora não" não tira nada', w.PDV.comanda.length === 0 && (ana.resgates || []).length === 0 &&
    perto(w.saldoUn('ins_casc', 'suc_sf'), 50));
  t('o brinde continua no cartão', w.fidelidadeDoCliente(ana, 'suc_sf').temBrinde === true);
  w.renderVenda(); w.usarCliente(ana.id); await esp(60);
  t('e não pergunta de novo nesta venda', perguntas.length === 1);

  grupo('3. A pergunta do produto vem no resgate');
  w.confirmar = async () => true;
  await w.resgatarBrinde(); await esp(60);
  t('abriu a pergunta forçada do grupo', /PROGRAMA FIDELIDADE/.test(($('mdOv') || {}).innerHTML || '') &&
    /ACRESCENTAR MAIS 1 BOLA/.test(($('mdOv') || {}).innerHTML || ''));
  t('a quantidade não aparece no resgate', !$('qtIt') || $('qtIt').parentNode.style.display === 'none');
  t('antes de confirmar, nada saiu do estoque', perto(w.saldoUn('ins_casc', 'suc_sf'), 50) && (ana.resgates || []).length === 0);
  w.fecharModal(); await esp(30);
  t('fechou sem confirmar: não resgatou', w.PDV.comanda.length === 0 && (ana.resgates || []).length === 0);
  await w.resgatarBrinde(); await esp(60);
  const op = doc.querySelector('.opSel'); op.checked = true;
  const nao = doc.querySelector('.opNao'); if (nao) nao.checked = false;
  $('mdOk').click(); await esp(60);
  const it = w.PDV.comanda[0] || {};
  t('o brinde entrou na comanda com a bola a mais cobrada (R$ 5,00)',
    w.PDV.comanda.length === 1 && it.brindeFidelidade === true && perto(it.total, 5) && (it.opcoes || []).length === 1,
    JSON.stringify(it));
  t('a ficha do brinde saiu do estoque no resgate', perto(w.saldoUn('ins_casc', 'suc_sf'), 49) &&
    perto(w.saldoUn('ins_gv', 'suc_sf'), 9.94), w.saldoUn('ins_gv', 'suc_sf'));
  t('com o motivo Programa de fidelidade', (w.DB.movEst || []).some(m => m.origem === 'fidelidade' && m.motivoId === 'mv_fidelidade'));
  const ped = venda(50, 5, new Date(Date.now() + 3600000).toISOString(), [Object.assign({}, it)]);
  w.baixarEstoqueVenda(ped);
  t('na venda sai só a bola a mais (100 g), o brinde não sai de novo',
    perto(w.saldoUn('ins_casc', 'suc_sf'), 49) && perto(w.saldoUn('ins_gv', 'suc_sf'), 9.84), w.saldoUn('ins_gv', 'suc_sf'));

  grupo('4. O resgate não vira compra do cartão');
  w.DB.pedidos.push(ped);
  t('a venda do brinde com a bola a mais não conta', w.fidelidadeDoCliente(ana, 'suc_sf').compras === 0);
  const daNuvem = Object.assign({}, ped, { id: 'p51', itens: [{ nome: 'EXPERIENCIA JOLO', total: 5, qtd: 1,
    obs: 'Brinde do programa de fidelidade', opcoes: it.opcoes }] });
  w.DB.pedidos = w.DB.pedidos.filter(p => p.id !== 'p50').concat([daNuvem]);
  t('nem depois de voltar da nuvem (sem a marca do aparelho)', w.fidelidadeDoCliente(ana, 'suc_sf').compras === 0);
  w.DB.pedidos.push(venda(52, 25, new Date(Date.now() + 7200000).toISOString()));
  t('a compra normal seguinte conta', w.fidelidadeDoCliente(ana, 'suc_sf').compras === 1);

  grupo('5. A marcação é guardada');
  w.formProduto('pr_c1'); await esp(30);
  t('o cadastro do produto tem a marcação', !!$('pBrinde') && $('pBrinde').checked === false);
  $('pBrinde').checked = true; w.lerFormProduto();
  t('a tela lê a marcação', w.eval('_prod').brindeFidelidade === true);
  const E = w.eval('MAPA').find(e => e.col === 'produtos');
  t('sobe marcada', E.campos(exp, 0).brinde_fidelidade === true);
  t('desmarcada sobe falso', E.campos(Object.assign({}, exp, { brindeFidelidade: false }), 0).brinde_fidelidade === false);
  t('aparelho que não conhece a marcação manda nulo', E.campos(cascao, 0).brinde_fidelidade === null);
  t('desce da nuvem', /brindeFidelidade:x\.brinde_fidelidade===true/.test(src));
  const sql = fs.existsSync(MIG) ? fs.readFileSync(MIG, 'utf8') : '';
  t('no banco, nulo nunca apaga a marcação',
    /add column if not exists brinde_fidelidade boolean/.test(sql) &&
    /if new\.brinde_fidelidade is null then\s*new\.brinde_fidelidade := old\.brinde_fidelidade;/.test(sql) &&
    /create trigger ab_brinde_nulo_nao_apaga before update on public\.produtos/.test(sql));

  grupo('Balanço');
  t('nenhum erro de runtime', erros.length === 0, erros.slice(0, 5).join(' | '));
  console.log('\n' + R.ok + ' de ' + R.total + ' testes passaram' + (R.falhou ? ' · ' + R.falhou + ' FALHA(S)' : '') + '\n');
  try { w.close(); } catch (e) {}
  process.exit(R.falhou ? 1 : 0);
})();

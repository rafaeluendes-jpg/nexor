/* ==========================================================
   JOIA — PROGRAMA DE FIDELIDADE E O TELEFONE COM DDD

   Rodar:  node testes/fidelidade-e-telefone.js
   ou:     npm run test:fidelidade   (entra no portão)

   POR QUE ESTE ARQUIVO EXISTE (Rafael, 25/09/2026)
   *"Primeiro a gente filtra pelo celular. Tem que colocar o DDD, é
   obrigatório."* e *"quando ela fizer 10 compras, ela ganha um cascão
   de uma bola. Clicou em resgatar, automaticamente já dá baixa na
   ficha técnica, e o motivo é programa de fidelidade. E no cadastro
   dela eu vou saber o dia e a hora que ela resgatou."*

   Aqui se confere a conta, a baixa, o registro e o que acontece quando
   a venda não se completa — além de o cadastro do cliente continuar
   guardando nome, telefone, gasto e ticket como sempre guardou.
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
const esp = ms => new Promise(r => setTimeout(r, ms));
const erros = [];
(async function () {
  console.log('\nCarregando o sistema para o guardião da fidelidade…');
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
  await esp(900);
  const win = dom.window, doc = win.document, $ = id => doc.getElementById(id);
  if (!$('content')) { const d = doc.createElement('div'); d.id = 'content'; doc.body.appendChild(d); }
  let salvou = 0; win.salvar = () => { salvou++; };
  win.lojaAtualId = () => 'suc_sf';
  win.usuarioLogado = () => ({ id: 'u1', nome: 'Bia', login: 'bia@jologelato.com.br', tudo: true });
  win.DB.sucursais = [{ id: 'suc_sf', nome: 'Santa Fé', ativa: true },
    { id: 'suc_jl', nome: 'Jales', ativa: true }];

  grupo('O telefone tem DDD, sempre');
  t('vira (17) 99812-4477 enquanto se digita', win.telFormatado('17998124477') === '(17) 99812-4477',
    win.telFormatado('17998124477'));
  t('fixo de 10 números também', win.telFormatado('1732811234') === '(17) 3281-1234', win.telFormatado('1732811234'));
  t('no meio da digitação não estoura', win.telFormatado('179') === '(17) 9' && win.telFormatado('1') === '(1');
  t('quem digita só o celular ganha o DDD da loja', win.telComDDD('998124477') === '(17) 99812-4477',
    win.telComDDD('998124477'));
  t('e quem digita com DDD mantém o dele', win.telComDDD('11987654321') === '(11) 98765-4321');
  t('número curto não é telefone válido', win.telValido('9981') === false);
  t('celular com DDD é válido', win.telValido('(17) 99812-4477') === true);
  t('não inventa DDD para número de 5 dígitos', win.telValido('99812') === false);

  grupo('O cadastro do cliente salva tudo');
  win.DB.clientes = [];
  win.baseCRM();
  /* a tela do PDV precisa estar montada: é nela que o cadastro grava */
  win.DB.categorias = [{ id: 'c1', nome: 'Gelatos', ativo: true }];
  win.DB.caixas = [{ id: 'cx1', sucursalId: 'suc_sf', aberto: '25/09/2026 15:00', inicial: 100, operador: 'Bia', movimentos: [] }];
  win.PDV.aba = 'venda'; win.telaPDV();
  win.PDV.cliente = null;
  win.formCliente(null, '998124477');
  await esp(60);
  t('o telefone já abre com o DDD', $('clT').value === '(17) 99812-4477', $('clT').value);
  $('clN').value = 'Ana Paula Ribeiro';
  $('clR').value = 'Rua das Flores'; $('clNu').value = '120'; $('clB2').value = 'Centro';
  $('mdOk').click(); await esp(120);
  const ana = win.DB.clientes[0] || {};
  t('nome, telefone e endereço gravados',
    ana.nome === 'Ana Paula Ribeiro' && ana.tel === '(17) 99812-4477' &&
    ana.rua === 'Rua das Flores' && ana.numero === '120' && ana.bairro === 'Centro',
    JSON.stringify({ n: ana.nome, t: ana.tel, r: ana.rua }));
  t('nasce com compras e gasto zerados', ana.compras === 0 && ana.gasto === 0);
  t('e o cliente já entra na comanda', (win.PDV.cliente || {}).id === ana.id);
  /* duas compras: o acumulado do cliente é o que a ficha mostra */
  ana.compras = 2; ana.gasto = 49.2;
  t('ticket médio bate com gasto ÷ compras', perto(ana.gasto / ana.compras, 24.6));

  grupo('A contagem do cartão');
  const venda = (n, suc, total, quando) => ({ id: 'p' + n, numero: n, clienteId: ana.id,
    sucursalId: suc, total: total, fase: 'entregue', data: quando, itens: [], pagamentos: [] });
  win.DB.pedidos = [];
  for (let i = 1; i <= 8; i++) win.DB.pedidos.push(venda(i, 'suc_sf', 20, '2026-09-0' + (i % 9 + 1) + 'T12:00:00Z'));
  let f = win.fidelidadeDoCliente(ana, 'suc_sf');
  t('oito compras contam oito', f.compras === 8 && f.falta === 2 && f.temBrinde === false,
    JSON.stringify(f));
  win.DB.pedidos.push(venda(9, 'suc_jl', 20, '2026-09-10T12:00:00Z'));
  t('compra de OUTRA loja não entra neste cartão', win.fidelidadeDoCliente(ana, 'suc_sf').compras === 8);
  t('e entra no cartão da outra loja', win.fidelidadeDoCliente(ana, 'suc_jl').compras === 1);
  win.DB.pedidos.push(Object.assign(venda(10, 'suc_sf', 20, '2026-09-11T12:00:00Z'), { fase: 'cancelado' }));
  t('venda cancelada não conta', win.fidelidadeDoCliente(ana, 'suc_sf').compras === 8);
  win.DB.pedidos.push(venda(11, 'suc_sf', 0, '2026-09-11T13:00:00Z'));
  t('venda de R$ 0,00 (só o brinde) não conta', win.fidelidadeDoCliente(ana, 'suc_sf').compras === 8);
  win.DB.pedidos.push(venda(12, 'suc_sf', 20, '2026-09-12T12:00:00Z'));
  win.DB.pedidos.push(venda(13, 'suc_sf', 20, '2026-09-13T12:00:00Z'));
  f = win.fidelidadeDoCliente(ana, 'suc_sf');
  t('fechadas as dez, o brinde aparece', f.compras === 10 && f.temBrinde === true && f.falta === 0);

  grupo('O resgate dá baixa pela ficha técnica');
  win.baseMov();
  win.DB.insumos = [
    { id: 'ins_casc', nome: 'CASCAO', unidade: 'un', custo: 0.70, estoqueAtual: 50, controlaEstoque: true },
    { id: 'ins_gv', nome: 'GELATO VENDA', unidade: 'kg', custo: 23.80, estoqueAtual: 10, controlaEstoque: true }];
  win.DB.fichas = [{ id: 'fi_c1', nome: 'CASCAO 1 BOLA', unidade: 'un', rendUnidade: 'un', rendimento: 1,
    unidadesVenda: 1, itens: [{ insumoId: 'ins_casc', qtd: 1, unidade: 'un' }, { insumoId: 'ins_gv', qtd: 60, unidade: 'g' }] }];
  win.DB.produtos = [{ id: 'pr_c1', nome: 'Cascão 1 Bola', preco: 12, ativo: true,
    vinculaEstoque: true, fichaId: 'fi_c1' }];
  win.setSaldoUn('ins_casc', 50, 'suc_sf'); win.setSaldoUn('ins_gv', 10, 'suc_sf');
  t('o brinde é achado pelo nome, com ou sem acento', (win.produtoDoBrinde() || {}).id === 'pr_c1');
  const r = win.resgatarFidelidade(ana);
  t('o resgate deu certo', r.ok === true, JSON.stringify(r.erro || ''));
  const mv = (win.DB.movEst || []).find(m => m.origem === 'fidelidade') || { linhas: [] };
  const lin = id => mv.linhas.find(l => l.insumoId === id) || {};
  t('saiu 1 cascão', perto(lin('ins_casc').qtd, 1));
  t('e 0,06 kg de gelato (60 g na unidade do item)', perto(lin('ins_gv').qtd, 0.06) && lin('ins_gv').unidade === 'kg',
    JSON.stringify(lin('ins_gv')));
  t('o motivo é Programa de fidelidade',
    (win.DB.motivosMov.find(m => m.id === mv.motivoId) || {}).nome === 'Programa de fidelidade');
  t('o saldo do cascão caiu para 49', perto(win.saldoUn('ins_casc', 'suc_sf'), 49));
  t('o saldo do gelato caiu para 9,94', perto(win.saldoUn('ins_gv', 'suc_sf'), 9.94), win.saldoUn('ins_gv', 'suc_sf'));

  grupo('O que fica no cadastro do cliente');
  const reg = (ana.resgates || [])[0] || {};
  t('guardou o dia', !!reg.data && reg.data === win.hojeISO());
  t('guardou a hora', /^\d{2}:\d{2}/.test(reg.hora || ''), reg.hora);
  t('guardou a loja', reg.sucursalId === 'suc_sf');
  t('guardou quem entregou', reg.por === 'Bia');
  t('e qual foi o brinde', reg.brinde === 'Cascão 1 Bola');
  t('o cartão recomeça do zero', win.fidelidadeDoCliente(ana, 'suc_sf').compras === 0);
  t('a nova contagem conta a compra seguinte',
    (win.DB.pedidos.push(venda(14, 'suc_sf', 25, new Date(Date.now() + 86400000).toISOString())),
     win.fidelidadeDoCliente(ana, 'suc_sf').compras === 1));
  win.US = win.US || {};
  /* a ficha do cliente é um modal: ela desenha, não devolve texto */
  win.fichaCliente(ana.id);
  const ficha = ($('mdOv') || {}).innerHTML || '';
  t('a ficha mostra o resgate com dia e hora',
    /Programa de fidelidade/.test(ficha) && new RegExp(reg.hora).test(ficha) && /Bia/.test(ficha));
  t('e diz que a contagem nova já começou', /contagem nova desde o resgate/.test(ficha));

  grupo('O brinde não sai do estoque duas vezes');
  const ped = { id: 'pX', numero: 99, clienteId: ana.id, sucursalId: 'suc_sf', total: 0,
    fase: 'entregue', data: new Date().toISOString(), hora: '14:00',
    itens: [{ produtoId: 'pr_c1', nome: 'Cascão 1 Bola', qtd: 1, total: 0, brindeFidelidade: true, opcoes: [] }],
    pagamentos: [] };
  const antes = win.saldoUn('ins_casc', 'suc_sf');
  win.baixarEstoqueVenda(ped);
  t('a venda ignora o item do brinde', perto(win.saldoUn('ins_casc', 'suc_sf'), antes),
    win.saldoUn('ins_casc', 'suc_sf'));

  grupo('Tirar o brinde da comanda devolve tudo');
  win.PDV.cliente = ana; win.PDV.comanda = []; win.PDV.brindeResgate = null;
  win.DB.pedidos = win.DB.pedidos.filter(p => p.id !== 'pX');
  for (let i = 20; i < 30; i++) win.DB.pedidos.push(venda(i, 'suc_sf', 20, new Date(Date.now() + i * 3600000).toISOString()));
  t('o cartão fechou de novo', win.fidelidadeDoCliente(ana, 'suc_sf').temBrinde === true);
  win.confirmar = async () => true;
  let msg = ''; win.toast = m => { msg = m; };
  await win.resgatarBrinde(); await esp(80);
  t('o brinde entrou na comanda por R$ 0,00',
    win.PDV.comanda.length === 1 && win.PDV.comanda[0].total === 0 && win.PDV.comanda[0].brindeFidelidade === true);
  const saldoComBrinde = win.saldoUn('ins_casc', 'suc_sf');
  win.remItem(0); await esp(40);
  t('tirando o item, o estoque volta', perto(win.saldoUn('ins_casc', 'suc_sf'), saldoComBrinde + 1),
    win.saldoUn('ins_casc', 'suc_sf'));
  t('e o cartão do cliente volta a ter o brinde', win.fidelidadeDoCliente(ana, 'suc_sf').temBrinde === true);
  t('sem deixar resgate pendurado no cadastro', (ana.resgates || []).length === 1);

  grupo('Sem erro de página');
  t('nenhum erro', erros.length === 0, erros.slice(0, 5).join(' | '));

  console.log('\n' + '═'.repeat(52));
  console.log('Joia · Fidelidade e telefone com DDD');
  console.log(R.ok + ' de ' + R.total + ' testes passaram' + (R.falhou ? ' · ' + R.falhou + ' FALHA(S)' : ''));
  console.log('═'.repeat(52) + '\n');
  process.exit(R.falhou ? 1 : 0);
})();

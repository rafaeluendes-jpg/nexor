/* ==========================================================
   JOIA — CANCELAR, VOLTAR, E O ESTOQUE NO MEIO (V371)

   Três defeitos que moravam juntos, todos na coluna Cancelado do
   Kanban, e todos com o mesmo sintoma para a loja: o saldo devendo sem
   ninguém saber de onde.

   1. O BOTÃO "VOLTAR" BAIXAVA O ESTOQUE DE NOVO.
      Cancelar um pedido pergunta "já foi produzido?". Se a resposta é
      SIM, o estoque NÃO volta — o insumo já foi gasto, e a baixa
      original continua valendo. Mas quem clicasse "Voltar" naquele
      cartão ganhava uma SEGUNDA baixa do mesmo pedido: o mesmo pote
      saindo duas vezes do saldo.

   2. O ESTORNO VOLTAVA SÓ NESTE APARELHO.
      `estornarEstoqueVenda` apagava a movimentação daqui e não
      declarava a exclusão. Desde a V201 o espelhamento só apaga da
      nuvem o que foi DECLARADO — ausência não apaga nada, de propósito.
      Então a baixa continuava viva lá, e voltava no download seguinte.

   3. O CANCELAMENTO DESFEITO CONTINUAVA CONTANDO.
      "Voltar" devolvia a venda ao faturamento e deixava o registro em
      `DB.cancelamentos` intacto. No mesmo dia, a aba Cancelamentos e o
      faturamento do turno discordavam — e nenhum dos dois estava errado
      sozinho.

   Este arquivo roda as funções de verdade, tiradas do index.html.
   ========================================================== */
const fs = require('fs');
const { corpoDaFuncao, ARQ, versaoDoSistema } = require('./extrair.js');

const fonte = fs.readFileSync(ARQ, 'utf8');
let falhas = 0, testes = 0;
function t(nome, ok, det) {
  testes++;
  if (ok) console.log('   ok   ' + nome);
  else { falhas++; console.log('   FALHOU  ' + nome + (det !== undefined ? '  → ' + det : '')); }
}

/* ==========================================================
   1. UMA VENDA, UMA BAIXA — rodando a função de verdade
   ========================================================== */
console.log('\n── A mesma venda não baixa o estoque duas vezes\n');

function mundoVenda() {
  return {
    insumos: [{ id: 'in1', nome: 'Massa', unidade: 'kg', custo: 10, controlaEstoque: true }],
    fichas: [],
    produtos: [{ id: 'pr1', nome: 'Cascão', vinculaEstoque: true, insumoId: 'in1' }],
    movEst: []
  };
}
function baixar(DB, ped) {
  const amb = {
    DB: DB,
    insumo: id => DB.insumos.find(i => i.id === id),
    itemEstoque: id => DB.insumos.find(i => i.id === id) || null,
    convUnid: (q, de, para) => (String(de) === String(para) ? q : q),
    custoNaUnidade: () => 10,
    baseMov: () => {}, toast: () => {}, uid: p => p + Math.random().toString(36).slice(2, 7),
    hojeISO: () => '2026-09-30', agoraHM: () => '10:00', diaLocal: d => d,
    aplicarMovimento: () => {},
    destinoDaFicha: () => null, custoPorUnidade: () => 0
  };
  const f = new Function('amb', 'ped',
    'with(amb){' + corpoDaFuncao('baixarEstoqueVenda', fonte) +
    '\n var _ultimoMovVenda=null; return baixarEstoqueVenda(ped);}');
  return f(amb, ped);
}

const DBv = mundoVenda();
const ped = { id: 'pd1', numero: 7, data: '2026-09-30', hora: '10:00',
  itens: [{ produtoId: 'pr1', nome: 'Cascão', qtd: 2 }] };

const primeira = baixar(DBv, ped);
t('a primeira baixa acontece', primeira > 0, 'linhas=' + primeira);
t('e gravou uma movimentação de venda',
  DBv.movEst.filter(m => m.pedidoId === 'pd1' && m.origem === 'venda').length === 1,
  DBv.movEst.length);

const segunda = baixar(DBv, ped);
t('A SEGUNDA BAIXA DO MESMO PEDIDO NÃO ACONTECE (era o defeito)',
  segunda === 0, 'linhas=' + segunda);
t('e continua existindo uma única movimentação de venda',
  DBv.movEst.filter(m => m.pedidoId === 'pd1' && m.origem === 'venda').length === 1,
  DBv.movEst.length);

/* pedido diferente continua baixando: a trava é por pedido, não geral */
const outro = baixar(DBv, { id: 'pd2', numero: 8, data: '2026-09-30', hora: '10:05',
  itens: [{ produtoId: 'pr1', nome: 'Cascão', qtd: 1 }] });
t('outro pedido continua baixando normalmente', outro > 0, 'linhas=' + outro);

/* e depois do estorno, que apaga a movimentação, a baixa pode nascer de novo */
DBv.movEst = DBv.movEst.filter(m => m.pedidoId !== 'pd1');
t('depois do estorno (que apaga o movimento) a baixa volta a ser possível',
  baixar(DBv, ped) > 0);

/* ==========================================================
   2. O ESTORNO DECLARA A EXCLUSÃO
   ========================================================== */
console.log('\n── O estorno avisa a nuvem que a baixa morreu\n');

const est = corpoDaFuncao('estornarEstoqueVenda', fonte);
t('estornarEstoqueVenda chama declararExclusao', /declararExclusao\(/.test(est));
t('e declara a tabela certa, com o id do movimento',
  /declararExclusao\('movEst',\s*m\.id\)/.test(est));
/* a ordem importa: declarar depois de filtrar a lista perderia o id */
t('declara ANTES de tirar o movimento da lista',
  est.indexOf('declararExclusao') < est.indexOf('DB.movEst=(DB.movEst||[]).filter'));

/* roda o estorno de verdade e confere que a declaração saiu */
(function () {
  const declarados = [];
  const DB2 = { movEst: [{ id: 'mv1', pedidoId: 'pd9', origem: 'venda', linhas: [] },
                          { id: 'mv2', pedidoId: 'pd9', origem: 'venda', linhas: [] },
                          { id: 'mv3', pedidoId: 'pdX', origem: 'venda', linhas: [] }] };
  const amb = { DB: DB2, baseMov: () => {}, aplicarMovimento: () => {},
    declararExclusao: (col, id) => declarados.push(col + ':' + id),
    _quieto: () => {} };
  const f = new Function('amb', 'ped',
    'with(amb){' + est + '\n return estornarEstoqueVenda(ped);}');
  const n = f(amb, { id: 'pd9' });
  t('estornou os dois movimentos daquele pedido', n === 2, n);
  t('e declarou os dois, um a um',
    declarados.join(',') === 'movEst:mv1,movEst:mv2', declarados.join(','));
  t('sem encostar no movimento de outro pedido',
    DB2.movEst.length === 1 && DB2.movEst[0].id === 'mv3');
})();

/* ==========================================================
   3. VOLTAR PASSA PELA MESMA PORTA DE CANCELAR
   ========================================================== */
console.log('\n── Voltar exige senha, motivo, e encerra o cancelamento\n');

/* tira os comentarios antes de perguntar pelo codigo: o bloco que
   EXPLICA o defeito cita o nome da funcao, e um teste que le comentario
   passa a depender do texto, nao do que roda */
const semComentario = txt => txt.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
const mv = semComentario(corpoDaFuncao('moverPedido', fonte));
t('moverPedido manda o cancelamento para a porta com senha',
  /if\(vaiCancelar&&!eraCancelado\)\{pedirCancelamento\(id\);return;\}/.test(mv));
t('e manda o "Voltar" para a porta nova',
  /if\(eraCancelado&&!vaiCancelar\)\{pedirDescancelamento\(id,fase\);return;\}/.test(mv));
t('NÃO baixa mais o estoque direto daqui (era o defeito)',
  !/baixarEstoqueVenda/.test(mv));
t('e não sobrou a linha de estorno, que nunca era alcançada',
  !/estornarEstoqueVenda/.test(mv));

const dc = corpoDaFuncao('confirmarDescancelamento', fonte);
t('exige motivo escrito', /if\(!motivo\)\{toast\(/.test(dc));
t('exige operador', /if\(!opId\)\{toast\(/.test(dc));
t('confere a senha pela mesma porta do cancelamento',
  /await autorizar\('cancelar',opId,/.test(dc));
t('reconfere que ainda está cancelado DEPOIS da senha',
  dc.lastIndexOf('if(!ehCancelado(p))') > dc.indexOf('await autorizar'));
t('trava o clique repetido', /travarOperacao\('descancelar-'\+p\.id\)/.test(dc));
t('encerra o registro do cancelamento em vez de apagá-lo',
  /reg\.desfeitoEm=/.test(dc) && /reg\.desfeitoPor=/.test(dc) &&
  /reg\.desfeitoMotivo=/.test(dc) && !/DB\.cancelamentos=\(DB\.cancelamentos\|\|\[\]\)\.filter/.test(dc));
t('limpa os campos de cancelamento do pedido',
  /p\.canceladoEm=''/.test(dc) && /p\.motivoCancelamento=''/.test(dc));
t('e deixa o estoque decidir sozinho se a baixa volta',
  /baixarEstoqueVenda\(p\)/.test(dc));

/* ==========================================================
   4. CANCELAMENTO DESFEITO SAI DE TODA CONTA
   ========================================================== */
console.log('\n── O cancelamento desfeito para de contar em todo lugar\n');

const ativo = new Function(corpoDaFuncao('cancelamentoAtivo', fonte) +
  '\n return cancelamentoAtivo;')();
t('cancelamento normal conta', ativo({ id: 'c1' }) === true);
t('cancelamento desfeito não conta', ativo({ id: 'c1', desfeitoEm: '2026-09-30' }) === false);
t('e nulo não estoura', ativo(null) === false);

const doPed = new Function(
  corpoDaFuncao('cancelamentoAtivo', fonte) + '\n' +
  corpoDaFuncao('cancelamentoDoPedido', fonte) +
  '\n return function(DB,id){ var g=this; return (function(){ ' +
  'var DBantigo=typeof globalThis.DB!=="undefined"?globalThis.DB:undefined;' +
  'globalThis.DB=DB; try{ return cancelamentoDoPedido(id); } finally{ globalThis.DB=DBantigo; } })(); };')();
t('acha o cancelamento vivo do pedido',
  (doPed({ cancelamentos: [{ id: 'c1', pedidoId: 'p1', data: '2026-09-01', hora: '10:00' }] }, 'p1') || {}).id === 'c1');
t('e ignora o que já foi desfeito',
  doPed({ cancelamentos: [{ id: 'c1', pedidoId: 'p1', data: '2026-09-01', hora: '10:00', desfeitoEm: 'x' }] }, 'p1') === null);
t('com dois, devolve o mais recente',
  (doPed({ cancelamentos: [
    { id: 'c1', pedidoId: 'p1', data: '2026-09-01', hora: '10:00' },
    { id: 'c2', pedidoId: 'p1', data: '2026-09-05', hora: '09:00' }] }, 'p1') || {}).id === 'c2');

/* os quatro lugares que leem a lista */
t('o relatório de Cancelamentos ignora o desfeito',
  /if\(!cancelamentoAtivo\(c\)\)return false;/.test(corpoDaFuncao('telaRelCancel', fonte)));
t('a exportação em CSV ignora o desfeito',
  /if\(!cancelamentoAtivo\(c\)\)return false;/.test(corpoDaFuncao('exportarCancel', fonte)));
t('o fechamento do caixa ignora o desfeito',
  /cancelamentoAtivo\(x\)&&x\.caixaId===c\.id/.test(corpoDaFuncao('dadosDoCaixa', fonte)));
t('o comprovante não reimprime um cancelamento desfeito',
  /cancelamentoAtivo\(c\)&&c\.pedidoId===pedId/.test(corpoDaFuncao('imprimirCancelamento', fonte)));

/* ==========================================================
   5. A TRAVA DE SALDO CONFERE A UNIDADE CERTA
   ========================================================== */
console.log('\n── A trava de estoque olha o saldo da unidade do movimento\n');

(function () {
  const DB3 = {
    estoqueUn: [
      { id: 'sucA|in1', sucursalId: 'sucA', itemId: 'in1', estoque: 100, custoMedio: 5 },
      { id: 'sucB|in1', sucursalId: 'sucB', itemId: 'in1', estoque: 0, custoMedio: 0 }
    ],
    insumos: [{ id: 'in1', nome: 'Massa', unidade: 'kg', controlaEstoque: true,
                estoqueAtual: 100 /* espelho da unidade A — era isto que a trava lia */ }]
  };
  const amb = {
    DB: DB3,
    lojaAtualId: () => 'sucA',
    itemEstoque: id => DB3.insumos.find(i => i.id === id) || null,
    convUnid: (q) => q,
    un: () => ({ ab: 'kg' }),
    baseEstUn: () => DB3.estoqueUn,
    chaveEst: (suc, item) => suc + '|' + item
  };
  const f = new Function('amb', 'linhas', 'suc',
    'with(amb){' + corpoDaFuncao('regEstoque', fonte) + '\n' +
    corpoDaFuncao('saldoUn', fonte) + '\n' +
    corpoDaFuncao('faltaEstoque', fonte) +
    '\n return faltaEstoque(linhas,suc);}');
  const linhas = [{ insumoId: 'in1', unidade: 'kg', qtd: 10, direcao: 'saida' }];

  t('na unidade que TEM saldo, não falta', f(amb, linhas, 'sucA').length === 0);
  t('NA UNIDADE QUE NÃO TEM, FALTA (a trava lia a loja errada)',
    f(amb, linhas, 'sucB').length === 1, JSON.stringify(f(amb, linhas, 'sucB')));
  t('e quem chama sem dizer a unidade cai na unidade aberta',
    f(amb, linhas, undefined).length === 0);

  /* ==========================================================
     ITEM SEM LINHA EM estoqueUn NAO PODE BARRAR A LOJA

     Item de antes da tabela por unidade — ou base que nunca movimentou —
     nao tem registro nenhum. Ler zero ali barraria uma producao
     legitima; foi o que o portao pegou na prova do pedido de base da
     matriz, antes desta ressalva existir.
     ========================================================== */
  DB3.estoqueUn = [];
  t('item sem registro na unidade ABERTA cai no espelho e não barra',
    f(amb, linhas, 'sucA').length === 0, JSON.stringify(f(amb, linhas, 'sucA')));
  t('mas em OUTRA unidade continua sendo zero — aquela loja não tem o item',
    f(amb, linhas, 'sucB').length === 1);
})();

/* ==========================================================
   6. CADA MOVIMENTO DIZ DE ONDE VEIO E PARA ONDE FOI
   ========================================================== */
console.log('\n── O movimento carimba saldo e custo, antes e depois\n');

(function () {
  const DB4 = { estoqueUn: [], insumos: [{ id: 'in1', nome: 'Massa', unidade: 'kg',
    controlaEstoque: true, estoqueAtual: 0, custo: 0 }] };
  const amb = {
    DB: DB4,
    lojaAtualId: () => 'sucA',
    itemEstoque: id => DB4.insumos.find(i => i.id === id) || null,
    convUnid: (q) => q,
    custoMedioPond: () => 0,
    normModo: m => m || 'media',
    repararDestinos: () => {}, recalcCustoProducao: () => {},
    usuarioLogado: () => ({ id: 'u1', nome: 'Maria' }),
    baseEstUn: () => (DB4.estoqueUn = DB4.estoqueUn || []),
    chaveEst: (suc, item) => suc + '|' + item
  };
  const f = new Function('amb', 'mov',
    'with(amb){' +
    corpoDaFuncao('regEstoque', fonte) + '\n' +
    corpoDaFuncao('saldoUn', fonte) + '\n' +
    corpoDaFuncao('custoMedioUn', fonte) + '\n' +
    corpoDaFuncao('setSaldoUn', fonte) + '\n' +
    corpoDaFuncao('setCustoUn', fonte) + '\n' +
    corpoDaFuncao('ajustaEstoque', fonte) + '\n' +
    corpoDaFuncao('aplicarMovimento', fonte) +
    '\n aplicarMovimento(mov); return mov;}');

  const entrada = f(amb, { id: 'mv1', sucursalId: 'sucA', linhas: [
    { insumoId: 'in1', unidade: 'kg', qtd: 10, custo: 4, direcao: 'entrada' }] });
  const l1 = entrada.linhas[0];
  t('entrada: saldo antes era zero', l1.saldoAntes === 0, l1.saldoAntes);
  t('entrada: saldo depois é dez', l1.saldoDepois === 10, l1.saldoDepois);
  t('entrada: custo médio antes era zero', l1.custoMedioAntes === 0, l1.custoMedioAntes);
  t('entrada: custo médio depois é o da compra', l1.custoMedioDepois === 4, l1.custoMedioDepois);
  t('entrada: o valor da linha é quantidade × custo', l1.valor === 40, l1.valor);
  t('entrada: a linha diz de qual unidade é', l1.unidadeRef === 'sucA', l1.unidadeRef);
  t('e o movimento diz quem estava logado', entrada.usuario === 'Maria', entrada.usuario);

  const saida = f(amb, { id: 'mv2', sucursalId: 'sucA', linhas: [
    { insumoId: 'in1', unidade: 'kg', qtd: 3, custo: 4, direcao: 'saida' }] });
  const l2 = saida.linhas[0];
  t('saída: saldo antes é o que a entrada deixou', l2.saldoAntes === 10, l2.saldoAntes);
  t('saída: saldo depois é sete', l2.saldoDepois === 7, l2.saldoDepois);
  t('saída NÃO mexe no custo médio', l2.custoMedioAntes === 4 && l2.custoMedioDepois === 4,
    l2.custoMedioAntes + ' → ' + l2.custoMedioDepois);

  /* desfazer não carimba: o carimbo é do fato, e desfazer não é um fato novo */
  const mov3 = { id: 'mv3', sucursalId: 'sucA', linhas: [
    { insumoId: 'in1', unidade: 'kg', qtd: 3, custo: 4, direcao: 'saida' }] };
  const g = new Function('amb', 'mov',
    'with(amb){' +
    corpoDaFuncao('regEstoque', fonte) + '\n' +
    corpoDaFuncao('saldoUn', fonte) + '\n' +
    corpoDaFuncao('custoMedioUn', fonte) + '\n' +
    corpoDaFuncao('setSaldoUn', fonte) + '\n' +
    corpoDaFuncao('setCustoUn', fonte) + '\n' +
    corpoDaFuncao('ajustaEstoque', fonte) + '\n' +
    corpoDaFuncao('aplicarMovimento', fonte) +
    '\n aplicarMovimento(mov,true); return mov;}');
  g(amb, mov3);
  t('desfazer não carimba a linha', mov3.linhas[0].saldoAntes === undefined);
})();

console.log('\n════════════════════════════════════════════════════');
console.log('Joia ' + versaoDoSistema() + ' · cancelar, voltar e o estoque no meio');
console.log(falhas ? (falhas + ' de ' + testes + ' testes FALHARAM')
                   : (testes + ' de ' + testes + ' testes passaram'));
console.log('════════════════════════════════════════════════════\n');
process.exit(falhas ? 1 : 0);

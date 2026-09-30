/* ==========================================================
   JOIA — CANCELAR A VENDA FECHA O CICLO INTEIRO (V373)

   A venda cria seis coisas: movimento de estoque, pagamento, cupom
   fiscal, dívida de fiado, contador do cartão fidelidade e uso do cupom
   de desconto. O cancelamento desfazia UMA — o estoque.

   O que sobrava, em ordem de quem reclama primeiro:

   · O CLIENTE CONTINUAVA DEVENDO. O fiado entrou como débito e o
     crédito nunca saiu. Venda cancelada, dívida viva.
   · O CARTÃO FIDELIDADE avançava com uma compra que não houve, e o
     `gasto` do cliente também.
   · O CUPOM DE DESCONTO queimava o limite por cliente à toa.
   · A NFC-e FICAVA AUTORIZADA NA SEFAZ — documento fiscal valendo, com
     o valor de uma venda que não existe mais. A única pista era um
     rótulo na tela de Cupons.
   · O CANCELAMENTO CARIMBAVA O CAIXA DE HOJE. Cancelar hoje uma venda
     de ontem punha o cancelamento no turno de hoje, enquanto o valor
     saía do faturamento do turno de ontem.
   · E O CUSTO DO QUE FOI PRODUZIDO E JOGADO FORA continuava no CPV, ao
     lado de uma receita que o cancelamento tirou do faturamento.

   Tudo aqui roda as funções de verdade, tiradas do index.html.
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
const semComentario = txt => txt.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

/* ==========================================================
   1. O FIADO VOLTA, A FIDELIDADE VOLTA, O CUPOM VOLTA
   ========================================================== */
console.log('\n── O que a venda criou fora do estoque volta atrás\n');

function mundoCliente() {
  return {
    clientes: [{ id: 'cl1', nome: 'Ana', saldoFiado: 50, compras: 3, gasto: 180 }],
    fiadoMov: [{ id: 'fm1', clienteId: 'cl1', tipo: 'debito', valor: 50,
                 pedidoId: 'pd1', data: '2026-09-20' }],
    cupomUsos: [{ id: 'cu1', cupomId: 'cp1', clienteId: 'cl1', pedidoId: 'pd1' },
                { id: 'cu2', cupomId: 'cp1', clienteId: 'cl1', pedidoId: 'pd9' }],
    movEst: []
  };
}
function reverter(DB, p, reg) {
  const f = new Function('amb', 'p', 'reg',
    'with(amb){' + corpoDaFuncao('reverterEfeitosDaVenda', fonte) +
    '\n return reverterEfeitosDaVenda(p,reg);}');
  return f({ DB: DB, uid: pre => pre + '_novo', hojeISO: () => '2026-09-30' }, p, reg);
}

(function () {
  const DB = mundoCliente();
  const p = { id: 'pd1', numero: 41, clienteId: 'cl1', total: 50 };
  const reg = { id: 'cn1' };
  reverter(DB, p, reg);
  const cli = DB.clientes[0];

  t('o fiado do cliente volta a zero', cli.saldoFiado === 0, cli.saldoFiado);
  t('e nasce o crédito no extrato, ligado ao cancelamento',
    DB.fiadoMov.some(m => m.tipo === 'credito' && m.valor === 50 && m.cancelamentoId === 'cn1'),
    JSON.stringify(DB.fiadoMov.map(m => m.tipo)));
  t('o cartão fidelidade recua uma compra', cli.compras === 2, cli.compras);
  t('o gasto do cliente também recua', cli.gasto === 130, cli.gasto);
  t('o uso do cupom daquele pedido é liberado',
    DB.cupomUsos.length === 1 && DB.cupomUsos[0].pedidoId === 'pd9',
    JSON.stringify(DB.cupomUsos.map(u => u.pedidoId)));
  t('e o registro guarda o que foi devolvido',
    reg.revertido && reg.revertido.fiado === 50 && reg.revertido.compras === 1);

  /* idempotência: cancelar de novo não pode devolver duas vezes */
  reverter(DB, p, reg);
  t('CHAMAR DE NOVO NÃO DEVOLVE O FIADO DUAS VEZES',
    cli.saldoFiado === 0 && DB.fiadoMov.filter(m => m.tipo === 'credito').length === 1,
    cli.saldoFiado + ' / ' + DB.fiadoMov.filter(m => m.tipo === 'credito').length);
  t('nem recua o fidelidade duas vezes', cli.compras === 2, cli.compras);
})();

/* cliente sem fiado, sem cupom: não pode estourar nem inventar crédito */
(function () {
  const DB = { clientes: [{ id: 'cl2', nome: 'Beto', compras: 1, gasto: 20 }],
               fiadoMov: [], cupomUsos: [], movEst: [] };
  const reg = { id: 'cn2' };
  reverter(DB, { id: 'pdX', numero: 9, clienteId: 'cl2', total: 20 }, reg);
  t('venda sem fiado não cria crédito nenhum', DB.fiadoMov.length === 0);
  t('e o gasto não fica negativo', DB.clientes[0].gasto === 0, DB.clientes[0].gasto);
})();

/* consumidor sem cadastro: não pode estourar */
(function () {
  const DB = { clientes: [], fiadoMov: [], cupomUsos: [], movEst: [] };
  let erro = null;
  try { reverter(DB, { id: 'pdY', numero: 10, total: 15 }, { id: 'cn3' }); }
  catch (e) { erro = String(e && e.message); }
  t('venda de consumidor, sem cadastro, não estoura', erro === null, erro);
})();

/* ==========================================================
   2. O QUE FOI PRODUZIDO E JOGADO FORA É PERDA, NÃO CPV
   ========================================================== */
console.log('\n── Custo sem venda sai do CPV e vira perda identificada\n');

(function () {
  const DB = { movEst: [
    { id: 'mv1', pedidoId: 'pd1', origem: 'venda', linhas: [] },
    { id: 'mv2', pedidoId: 'pd2', origem: 'venda', linhas: [] },
    { id: 'mv3', pedidoId: 'pd1', origem: 'nota', linhas: [] }] };
  const marcar = new Function('amb', 'p', 'reg',
    'with(amb){' + corpoDaFuncao('marcarPerdaDoCancelamento', fonte) +
    '\n return marcarPerdaDoCancelamento(p,reg);}');
  const n = marcar({ DB: DB }, { id: 'pd1' }, { id: 'cn1', motivo: 'Cliente desistiu' });
  t('marca a baixa daquele pedido', n === 1, n);
  t('com o vínculo do cancelamento e o motivo',
    DB.movEst[0].perdaCancelamento === 'cn1' && DB.movEst[0].perdaMotivo === 'Cliente desistiu');
  t('sem encostar em outro pedido', DB.movEst[1].perdaCancelamento === undefined);
  t('nem em movimento que não é venda', DB.movEst[2].perdaCancelamento === undefined);
  t('e NÃO mexe no saldo: o insumo foi consumido de verdade',
    DB.movEst[0].origem === 'venda' && DB.movEst[0].linhas.length === 0);

  const desmarcar = new Function('amb', 'p',
    'with(amb){' + corpoDaFuncao('desmarcarPerdaDoCancelamento', fonte) +
    '\n return desmarcarPerdaDoCancelamento(p);}');
  desmarcar({ DB: DB }, { id: 'pd1' });
  t('e ao voltar a venda a marca sai', DB.movEst[0].perdaCancelamento === undefined);
})();

/* os três relatórios de custo tiram essa perda do CMV */
console.log('\n── E os relatórios de custo param de contar isso como CMV\n');
t('o DRE leva a perda para Despesas Gerais Variáveis (06), não para o CPV (02)',
  /if\(mv\.perdaCancelamento\)\{/.test(semComentario(corpoDaFuncao('calcularDRE', fonte))) &&
  /add\('06',\['Perdas por cancelamento'/.test(corpoDaFuncao('calcularDRE', fonte)));
t('o CMV por Mercadoria classifica como baixa, não como venda',
  /if\(m\.perdaCancelamento\)org='perda-cancelamento';/
    .test(semComentario(corpoDaFuncao('cmvCalcular', fonte))));
for (const fn of ['dadosAno', 'dadosMes']) {
  t(fn + ' (Comparativo) tira a perda do CMV',
    /if\(mv\.perdaCancelamento\)return;/.test(semComentario(corpoDaFuncao(fn, fonte))));
}
t('os Indicadores do Mês contam como perda, não como CMV',
  /if\(m\.perdaCancelamento\)\{ if\(!ent\)r\.perdaCanc\+=v; return; \}/
    .test(semComentario(corpoDaFuncao('imEstoque', fonte))));
t('e o "estorno" que nunca existia saiu do cálculo',
  !/r\.estorno/.test(semComentario(corpoDaFuncao('imEstoque', fonte))));

/* ==========================================================
   3. O CUPOM FISCAL É CANCELADO NA SEFAZ
   ========================================================== */
console.log('\n── A NFC-e não fica autorizada depois da venda cancelada\n');

const cc = semComentario(corpoDaFuncao('confirmarCancelamento', fonte));
t('o cancelamento da venda chama o cancelamento do cupom',
  /cancelarCupomDaVenda\(p,p\.motivoCancelamento\)/.test(cc));
t('e chama DEPOIS de gravar — o fiscal nunca segura o caixa',
  cc.indexOf('cancelarCupomDaVenda') > cc.indexOf('salvar()'));
t('o cancelamento agora trava o clique repetido',
  /travarOperacao\('cancelar-'\+p\.id\)/.test(cc));
t('e reconfere que a venda não foi cancelada no meio do caminho',
  /if\(ehCancelado\(p\)\)\{toast\('Esta venda já foi cancelada/.test(cc));
t('o caixa do cancelamento é o caixa DA VENDA, não o de hoje',
  /caixaId:p\.caixaId\|\|\(cx\?cx\.id:''\)/.test(cc));
t('e grava quem autorizou e de qual conta o aparelho estava logado',
  /registradoPorId:/.test(cc) && /operadorId:op\.id/.test(cc));

/* o motivo que vai para a SEFAZ tem de ter 15 letras, por lei */
const mot = new Function('amb', 'ped', 'motivo',
  'with(amb){' + corpoDaFuncao('motivoFiscalDoCancelamento', fonte) +
  '\n return motivoFiscalDoCancelamento(ped,motivo);}')({}, { numero: 77 }, 'Erro');
t('o motivo curto é completado até o mínimo legal de 15 letras',
  mot.length >= 15, '"' + mot + '" (' + mot.length + ')');
t('e leva o número do pedido, que é por onde se acha a venda',
  /#77/.test(mot), mot);
const motVazio = new Function('amb', 'ped', 'motivo',
  'with(amb){' + corpoDaFuncao('motivoFiscalDoCancelamento', fonte) +
  '\n return motivoFiscalDoCancelamento(ped,motivo);}')({}, { numero: 3 }, '');
t('sem motivo nenhum, continua válido para a SEFAZ', motVazio.length >= 15, motVazio);
const motLongo = new Function('amb', 'ped', 'motivo',
  'with(amb){' + corpoDaFuncao('motivoFiscalDoCancelamento', fonte) +
  '\n return motivoFiscalDoCancelamento(ped,motivo);}')({}, { numero: 3 }, 'x'.repeat(400));
t('e motivo gigante é cortado no limite do campo', motLongo.length === 255, motLongo.length);

const cv = semComentario(corpoDaFuncao('cancelarCupomDaVenda', fonte));
t('cupom que ainda não virou documento não vai à SEFAZ — é marcado para não emitir',
  /c\.naoEmitir=true/.test(cv));
t('e a emissão respeita essa marca',
  /if\(c\.naoEmitir\)\{c\.status='sem_cupom'/.test(semComentario(corpoDaFuncao('emitirCupom', fonte))));
t('cupom autorizado nasce com pendência ligada, antes de qualquer tentativa',
  cv.indexOf('c.precisaCancelar=true') < cv.indexOf('fiscalChamar'));
t('fora do prazo vira pendência escrita, não erro escondido',
  /nota de \\n?\s*'\+\s*\n?\s*'devolução|devolução/.test(cv) && /prazo\|tempo\|expirad/.test(cv));
t('e quando a SEFAZ confirma, a pendência morre',
  /c2\.precisaCancelar=false/.test(cv));

/* ==========================================================
   4. VOLTAR A VENDA DESFAZ TUDO O QUE O CANCELAMENTO FEZ
   ========================================================== */
console.log('\n── E voltar a venda repõe o que o cancelamento tirou\n');

(function () {
  const DB = { clientes: [{ id: 'cl1', nome: 'Ana', saldoFiado: 0, compras: 2, gasto: 130 }],
               fiadoMov: [{ id: 'fm_novo', clienteId: 'cl1', tipo: 'credito', valor: 50,
                            cancelamentoId: 'cn1' }],
               cupomUsos: [], movEst: [] };
  const reg = { id: 'cn1', revertido: { fiado: 50, compras: 1, gasto: 50, cupons: 1 } };
  const f = new Function('amb', 'p', 'reg',
    'with(amb){' + corpoDaFuncao('reporEfeitosDaVenda', fonte) +
    '\n return reporEfeitosDaVenda(p,reg);}');
  f({ DB: DB }, { id: 'pd1', clienteId: 'cl1' }, reg);
  const cli = DB.clientes[0];
  t('o fiado volta a ser devido', cli.saldoFiado === 50, cli.saldoFiado);
  t('e o crédito de estorno some do extrato', DB.fiadoMov.length === 0);
  t('o fidelidade volta a contar a compra', cli.compras === 3, cli.compras);
  t('o gasto também volta', cli.gasto === 180, cli.gasto);
  t('e o registro diz que foi reposto', !!reg.reposto && reg.revertido === undefined);
})();

t('desfazer o cancelamento repõe e desmarca a perda',
  /reporEfeitosDaVenda\(p,reg\)/.test(semComentario(corpoDaFuncao('confirmarDescancelamento', fonte))) &&
  /desmarcarPerdaDoCancelamento\(p\)/.test(semComentario(corpoDaFuncao('confirmarDescancelamento', fonte))));

console.log('\n════════════════════════════════════════════════════');
console.log('Joia ' + versaoDoSistema() + ' · o cancelamento fecha o ciclo');
console.log(falhas ? (falhas + ' de ' + testes + ' testes FALHARAM')
                   : (testes + ' de ' + testes + ' testes passaram'));
console.log('════════════════════════════════════════════════════\n');
process.exit(falhas ? 1 : 0);

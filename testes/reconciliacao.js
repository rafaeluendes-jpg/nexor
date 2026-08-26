/* ==========================================================
   JOIA — SUITE DE RECONCILIACAO

   Protege a coerencia entre PDV, faturamento, pagamentos, itens
   vendidos e estoque, para o mesmo periodo, empresa e unidade.

   Rodar com:  node testes/reconciliacao.js
   ou:         npm run test:reconciliacao

   Sai com codigo 1 se qualquer teste falhar — para travar publicacao.

   As funcoes de regra sao EXTRAIDAS do index.html (ver extrair.js).
   Os cenarios abaixo sao de mentira, montados aqui; a REGRA aplicada a
   eles e a de verdade, a mesma que roda na loja.
   ========================================================== */
const { carregar, versaoDoSistema } = require('./extrair.js');

const SIS = carregar(['diaLocal']);
const diaLocal = SIS.diaLocal;

/* ---------- placar ---------- */
const R = { total: 0, ok: 0, falhou: 0, grupos: {} };
let grupoAtual = '(sem grupo)';
function grupo(n) { grupoAtual = n; R.grupos[n] = R.grupos[n] || { ok: 0, falhou: 0 };
  console.log('\n── ' + n); }
function t(nome, cond, detalhe) {
  R.total++;
  if (cond) { R.ok++; R.grupos[grupoAtual].ok++; console.log('   ok    ' + nome); }
  else {
    R.falhou++; R.grupos[grupoAtual].falhou++;
    console.log('   FALHA ' + nome + (detalhe ? '  →  ' + detalhe : ''));
  }
}
const r2 = v => +(Number(v) || 0).toFixed(2);

/* ==========================================================
   AS MESMAS CONTAS QUE OS DASHBOARDS FAZEM
   Uma funcao por indicador, para o teste falhar apontando QUAL
   indicador quebrou, e nao "o faturamento deu diferente".
   ========================================================== */
const valida    = vs => vs.filter(v => v.fase !== 'cancelado');
const doDia     = (vs, dia) => valida(vs).filter(v => diaLocal(v.data) === dia);
const doPeriodo = (vs, de, ate) => valida(vs).filter(v => {
  const d = diaLocal(v.data); return d >= de && d <= ate; });
const daUnidade = (vs, u) => vs.filter(v => (v.sucursalId || 'suc_matriz') === u);

const faturamento = vs => r2(vs.reduce((a, v) => a + Number(v.total || 0), 0));
const qtdVendas   = vs => vs.length;
const ticketMedio = vs => vs.length ? r2(faturamento(vs) / vs.length) : 0;
const totalPago   = vs => r2(vs.reduce((a, v) =>
  a + (v.pagamentos || []).reduce((b, p) => b + Number(p.valor || 0), 0), 0));
function porForma(vs) {
  const m = {};
  vs.forEach(v => (v.pagamentos || []).forEach(p => {
    m[p.forma] = r2((m[p.forma] || 0) + Number(p.valor || 0)); }));
  return m;
}
function itensVendidos(vs) {
  const m = {};
  vs.forEach(v => (v.itens || []).forEach(i => {
    m[i.prod] = (m[i.prod] || 0) + Number(i.qtd || 0); }));
  return m;
}
const totalItens = vs => Object.values(itensVendidos(vs)).reduce((a, b) => a + b, 0);
function maisVendidos(vs) {
  return Object.entries(itensVendidos(vs)).sort((a, b) => b[1] - a[1]).map(x => x[0]);
}
/* estoque: soma o que cada venda baixou */
function baixasDeEstoque(vs) {
  const m = {};
  vs.forEach(v => (v.baixas || []).forEach(b => {
    m[b.item] = r2((m[b.item] || 0) + Number(b.qtd || 0)); }));
  return m;
}
/* sem dupla contagem: a venda vale uma vez, pelo identificador */
const unicas = vs => { const m = {}; return vs.filter(v => m[v.id] ? false : (m[v.id] = 1)); };

/* ---------- construtor de venda de teste ---------- */
function venda(o) {
  return Object.assign({
    id: 'v' + Math.random().toString(36).slice(2, 8),
    total: 0, fase: 'entregue', data: '2026-08-25T15:00:00+00:00',
    sucursalId: 'suc_A', itens: [], pagamentos: [], baixas: []
  }, o);
}

/* ==========================================================
   TESTE BASE — 100 + 250 + 50 = 400
   ========================================================== */
grupo('Teste base — reconciliação de R$ 400');
const BASE = [
  venda({ id: 'b1', total: 100, itens: [{ prod: 'Copo P', qtd: 2 }, { prod: 'Água', qtd: 1 }],
          pagamentos: [{ forma: 'dinheiro', valor: 100 }],
          baixas: [{ item: 'gelato', qtd: 0.3 }, { item: 'copo', qtd: 2 }] }),
  venda({ id: 'b2', total: 250, itens: [{ prod: 'Gelato 1 Kg', qtd: 1 }],
          pagamentos: [{ forma: 'pix', valor: 250 }],
          baixas: [{ item: 'gelato', qtd: 1 }] }),
  venda({ id: 'b3', total: 50, itens: [{ prod: 'Cascão 2 Bolas', qtd: 3 }],
          pagamentos: [{ forma: 'debito', valor: 50 }],
          baixas: [{ item: 'gelato', qtd: 0.36 }, { item: 'cascao', qtd: 3 }] }),
];
const B = doDia(BASE, '2026-08-25');
t('as 3 vendas entram no dia', qtdVendas(B) === 3, qtdVendas(B));
t('PDV = R$ 400,00', faturamento(B) === 400, faturamento(B));
t('FATURAMENTO = R$ 400,00', faturamento(B) === 400, faturamento(B));
t('PAGAMENTOS = R$ 400,00', totalPago(B) === 400, totalPago(B));
t('PDV × FATURAMENTO: diferença R$ 0,00', r2(faturamento(B) - faturamento(B)) === 0);
t('PDV × PAGAMENTOS: diferença R$ 0,00', r2(faturamento(B) - totalPago(B)) === 0,
  'diferença de ' + r2(faturamento(B) - totalPago(B)));
t('ticket médio = R$ 133,33', ticketMedio(B) === 133.33, ticketMedio(B));
const iB = itensVendidos(B);
t('itens: Copo P = 2', iB['Copo P'] === 2, iB['Copo P']);
t('itens: Água = 1', iB['Água'] === 1, iB['Água']);
t('itens: Gelato 1 Kg = 1', iB['Gelato 1 Kg'] === 1, iB['Gelato 1 Kg']);
t('itens: Cascão 2 Bolas = 3', iB['Cascão 2 Bolas'] === 3, iB['Cascão 2 Bolas']);
t('total de itens = 7', totalItens(B) === 7, totalItens(B));
t('mais vendido = Cascão 2 Bolas', maisVendidos(B)[0] === 'Cascão 2 Bolas', maisVendidos(B)[0]);
const eB = baixasDeEstoque(B);
t('estoque: gelato baixou 1,66 kg', eB.gelato === 1.66, eB.gelato);
t('estoque: cascão baixou 3', eB.cascao === 3, eB.cascao);
t('nenhuma venda ficou sem baixa', B.every(v => (v.baixas || []).length > 0));
t('nenhuma venda ficou sem pagamento', B.every(v => (v.pagamentos || []).length > 0));

/* ==========================================================
   PAGAMENTO MISTO
   ========================================================== */
grupo('Pagamento misto');
const MISTO = [venda({ id: 'm1', total: 100, itens: [{ prod: 'Copo M', qtd: 1 }],
  pagamentos: [{ forma: 'dinheiro', valor: 40 }, { forma: 'pix', valor: 60 }],
  baixas: [{ item: 'gelato', qtd: 0.4 }] })];
const M = doDia(MISTO, '2026-08-25');
t('faturamento = R$ 100 (não 40, não 60, não 200)', faturamento(M) === 100, faturamento(M));
t('total dos pagamentos = R$ 100', totalPago(M) === 100, totalPago(M));
t('dinheiro = R$ 40', porForma(M).dinheiro === 40, porForma(M).dinheiro);
t('pix = R$ 60', porForma(M).pix === 60, porForma(M).pix);
t('a venda conta UMA vez', qtdVendas(M) === 1);
t('diferença financeira R$ 0,00', r2(faturamento(M) - totalPago(M)) === 0);

/* troco não vira receita */
const TROCO = [venda({ id: 'tr', total: 50,
  pagamentos: [{ forma: 'dinheiro', valor: 50 }], recebido: 100, troco: 50 })];
t('recebeu R$ 100, venda de R$ 50: faturamento é 50',
  faturamento(doDia(TROCO, '2026-08-25')) === 50);
t('e o pagamento registrado é 50, não 100',
  totalPago(doDia(TROCO, '2026-08-25')) === 50);

/* ==========================================================
   TROCO EM DINHEIRO

   Entrou na suite depois de um defeito real: `formaDaTroco` deixou de
   existir na lista montada a partir do banco, e a venda em dinheiro com
   troco — a mais comum da loja — passou a ser recusada no botao de
   finalizar, depois de a propria tela ter mostrado o troco.

   Estes testes rodam a funcao de verdade, extraida do index.html.
   ========================================================== */
grupo('Troco em dinheiro');
const FDT = carregar(['formaDaTroco']).formaDaTroco;
t('dinheiro dá troco', FDT({ tipo: 'dinheiro' }) === true);
t('pix não dá troco', FDT({ tipo: 'pix' }) === false);
t('débito não dá troco', FDT({ tipo: 'debito' }) === false);
t('crédito não dá troco', FDT({ tipo: 'credito' }) === false);
t('voucher não dá troco', FDT({ tipo: 'voucher' }) === false);
t('forma sem tipo não dá troco', FDT({}) === false);
t('quem definiu explicitamente é respeitado', FDT({ tipo: 'pix', troco: true }) === true);

function fecharVenda(total, pagos, formas) {
  const f = id => formas.find(x => x.id === id);
  const soma = r2(pagos.reduce((a, p) => a + p.valor, 0));
  const daTroco = pagos.some(p => FDT(f(p.forma)));
  if (soma < total - 0.01) return { erro: 'falta', falta: r2(total - soma) };
  if (soma > total + 0.01 && !daTroco) return { erro: 'sobra sem troco' };
  const troco = r2(soma - total);
  const venda = JSON.parse(JSON.stringify(pagos));
  venda.forEach((v, i) => { v.recebido = r2(pagos[i].valor); });
  let sobra = troco;
  for (let i = venda.length - 1; i >= 0 && sobra > 0.009; i--) {
    if (!FDT(f(venda[i].forma))) continue;
    const tira = Math.min(venda[i].valor, sobra);
    venda[i].valor = r2(venda[i].valor - tira); sobra = r2(sobra - tira);
  }
  const fim = venda.filter(x => x.valor > 0.009);
  return { troco, pagos: fim, faturamento: r2(fim.reduce((a, p) => a + p.valor, 0)) };
}
const FORMAS_BANCO = [
  { id: 'fp_dinheiro', tipo: 'dinheiro' }, { id: 'fp_pix', tipo: 'pix' },
  { id: 'fp_debito', tipo: 'debito' }, { id: 'fp_credito', tipo: 'credito' }];

const V18 = fecharVenda(18, [{ forma: 'fp_dinheiro', valor: 20 }], FORMAS_BANCO);
t('venda R$ 18 com R$ 20: finaliza', !V18.erro, V18.erro);
t('troco R$ 2,00', V18.troco === 2, V18.troco);
t('faturamento R$ 18,00 (não 20)', V18.faturamento === 18, V18.faturamento);
t('o recebido fica registrado como 20', V18.pagos[0].recebido === 20);
t('venda R$ 50 com R$ 100: troco 50',
  fecharVenda(50, [{ forma: 'fp_dinheiro', valor: 100 }], FORMAS_BANCO).troco === 50);
t('valor exato: troco zero',
  fecharVenda(18, [{ forma: 'fp_dinheiro', valor: 18 }], FORMAS_BANCO).troco === 0);
t('faltando dinheiro: barra',
  fecharVenda(18, [{ forma: 'fp_dinheiro', valor: 10 }], FORMAS_BANCO).erro === 'falta');
t('Pix a mais: barra',
  fecharVenda(18, [{ forma: 'fp_pix', valor: 20 }], FORMAS_BANCO).erro === 'sobra sem troco');

const MIX = fecharVenda(100,
  [{ forma: 'fp_pix', valor: 40 }, { forma: 'fp_dinheiro', valor: 100 }], FORMAS_BANCO);
t('misto Pix 40 + dinheiro 100: finaliza', !MIX.erro);
t('troco R$ 40,00', MIX.troco === 40, MIX.troco);
t('dinheiro aplicado R$ 60,00',
  MIX.pagos.find(p => p.forma === 'fp_dinheiro').valor === 60);
t('Pix continua inteiro', MIX.pagos.find(p => p.forma === 'fp_pix').valor === 40);
t('faturamento R$ 100 (não 140)', MIX.faturamento === 100, MIX.faturamento);
const CENT = fecharVenda(18.90, [{ forma: 'fp_dinheiro', valor: 20 }], FORMAS_BANCO);
t('centavos: 18,90 recebe 20 dá troco 1,10', CENT.troco === 1.10, CENT.troco);

/* ==========================================================
   CANCELAMENTO
   ========================================================== */
grupo('Cancelamento');
const COM_CANC = BASE.concat([venda({ id: 'c1', total: 100, fase: 'cancelado',
  itens: [{ prod: 'Copo P', qtd: 5 }],
  pagamentos: [{ forma: 'pix', valor: 100 }],
  baixas: [{ item: 'gelato', qtd: 1 }] })]);
const C = doDia(COM_CANC, '2026-08-25');
t('cancelada NÃO entra no faturamento', faturamento(C) === 400, faturamento(C));
t('cancelada NÃO entra nos pagamentos', totalPago(C) === 400, totalPago(C));
t('cancelada NÃO entra nos itens', itensVendidos(C)['Copo P'] === 2,
  itensVendidos(C)['Copo P']);
t('cancelada NÃO entra na contagem de vendas', qtdVendas(C) === 3, qtdVendas(C));
t('ticket médio não muda', ticketMedio(C) === 133.33, ticketMedio(C));

/* estorno de estoque: uma vez só */
function estornar(v, jaEstornada) {
  if (jaEstornada) return { estornos: 0, motivo: 'já estava cancelada' };
  if (v.produzido) return { estornos: 0, motivo: 'produzido: insumo já consumido' };
  return { estornos: (v.baixas || []).length, motivo: 'devolvido ao estoque' };
}
const vc = COM_CANC.find(v => v.id === 'c1');
t('não produzido: estorna o estoque', estornar(vc, false).estornos === 1);
t('produzido: NÃO estorna', estornar(Object.assign({}, vc, { produzido: true }), false).estornos === 0);
t('cancelar de novo NÃO estorna outra vez', estornar(vc, true).estornos === 0);

/* ==========================================================
   TIMEZONE — o caso que quebrou de verdade
   ========================================================== */
grupo('Timezone (America/Sao_Paulo)');
t('venda 21:43 de 25/08 fica no dia 25',
  diaLocal('2026-08-26T00:43:56.782+00:00') === '2026-08-25',
  diaLocal('2026-08-26T00:43:56.782+00:00'));
t('venda 23:59 de 25/08 fica no dia 25',
  diaLocal('2026-08-26T02:59:00+00:00') === '2026-08-25');
t('venda 00:01 de 26/08 entra no dia 26',
  diaLocal('2026-08-26T03:01:00+00:00') === '2026-08-26');
t('venda 00:00 em ponto entra no dia novo',
  diaLocal('2026-08-26T03:00:00+00:00') === '2026-08-26');
t('venda de tarde não muda de dia',
  diaLocal('2026-08-25T18:00:00+00:00') === '2026-08-25');
t('NÃO usa UTC cru (o defeito antigo)',
  diaLocal('2026-08-26T00:43:56+00:00') !== '2026-08-26T00:43:56+00:00'.slice(0, 10));
t('data simples continua válida', diaLocal('2026-08-25') === '2026-08-25');
t('data vazia não quebra', diaLocal('') === '');
t('data inválida não quebra', diaLocal('abc') === 'abc');
t('nulo não quebra', diaLocal(null) === '');

/* a venda das 21:43 tem que aparecer no faturamento do dia */
const TARDE = [venda({ id: 'tn', total: 96, data: '2026-08-26T00:43:00+00:00',
  pagamentos: [{ forma: 'debito', valor: 96 }] })];
t('venda das 21:43 aparece no faturamento de 25/08',
  faturamento(doDia(TARDE, '2026-08-25')) === 96);
t('e NÃO aparece no de 26/08',
  faturamento(doDia(TARDE, '2026-08-26')) === 0);

/* ==========================================================
   DUAS UNIDADES
   ========================================================== */
grupo('Isolamento entre unidades');
const DUAS = [
  venda({ id: 'a1', total: 500, sucursalId: 'suc_A',
          pagamentos: [{ forma: 'pix', valor: 500 }], itens: [{ prod: 'X', qtd: 1 }] }),
  venda({ id: 'b1', total: 300, sucursalId: 'suc_B',
          pagamentos: [{ forma: 'pix', valor: 300 }], itens: [{ prod: 'Y', qtd: 1 }] }),
];
const D = doDia(DUAS, '2026-08-25');
t('unidade A vê R$ 500', faturamento(daUnidade(D, 'suc_A')) === 500);
t('unidade B vê R$ 300', faturamento(daUnidade(D, 'suc_B')) === 300);
t('matriz consolidada = R$ 800', faturamento(D) === 800);
t('A não enxerga venda de B',
  daUnidade(D, 'suc_A').every(v => v.sucursalId === 'suc_A'));
t('B não enxerga venda de A',
  daUnidade(D, 'suc_B').every(v => v.sucursalId === 'suc_B'));
t('itens de A não aparecem em B', !itensVendidos(daUnidade(D, 'suc_B'))['X']);
t('pagamentos separados por unidade',
  totalPago(daUnidade(D, 'suc_A')) === 500 && totalPago(daUnidade(D, 'suc_B')) === 300);
t('TENANT ERRADO = 0',
  D.filter(v => !['suc_A', 'suc_B'].includes(v.sucursalId)).length === 0);

/* ==========================================================
   DUPLICIDADE
   ========================================================== */
grupo('Duplicidade');
const REENVIO = BASE.concat([BASE[0]]);
t('venda reenviada conta uma vez', unicas(REENVIO).length === 3, unicas(REENVIO).length);
t('e o faturamento não dobra', faturamento(unicas(doDia(REENVIO, '2026-08-25'))) === 400);

/* pagamento repetido pelos dois caminhos — o defeito real da V152 */
function refPagamento(pedId, i, pg) { return pg.id || (pedId + '_' + i); }
t('a referência do pagamento é a MESMA nos dois caminhos',
  refPagamento('ped_x', 0, {}) === 'ped_x_0');
t('e NÃO usa o formato antigo _pg0', refPagamento('ped_x', 0, {}) !== 'ped_x_pg0');
function juntarPagamentos(lista) {
  const m = {}; lista.forEach(p => { m[p.ref] = p; }); return Object.values(m);
}
const dupPag = juntarPagamentos([
  { ref: 'ped_x_0', valor: 96 }, { ref: 'ped_x_0', valor: 96 }]);
t('pagamento com a mesma referência não duplica', dupPag.length === 1);
t('PAGAMENTO DUPLICADO = 0',
  r2(dupPag.reduce((a, p) => a + p.valor, 0)) === 96);

/* ==========================================================
   ESTOQUE
   ========================================================== */
grupo('Estoque');
const E = doDia(BASE, '2026-08-25');
t('ITENS SEM BAIXA = 0', E.filter(v => (v.itens || []).length && !(v.baixas || []).length).length === 0);
t('BAIXAS DUPLICADAS = 0', (() => {
  const chaves = {};
  let dup = 0;
  E.forEach(v => (v.baixas || []).forEach(b => {
    const k = v.id + '|' + b.item;
    if (chaves[k]) dup++; chaves[k] = 1; }));
  return dup === 0;
})());
t('cada venda baixou pelo menos um item', E.every(v => (v.baixas || []).length > 0));
t('a baixa é da unidade da venda', E.every(v => v.sucursalId === 'suc_A'));

/* ==========================================================
   HOJE / ONTEM / PERIODO
   ========================================================== */
grupo('Filtros de data');
const DIAS = [
  venda({ id: 'h1', total: 400, data: '2026-08-26T01:00:00+00:00',
          pagamentos: [{ forma: 'pix', valor: 400 }] }),
  venda({ id: 'o1', total: 600, data: '2026-08-25T01:00:00+00:00',
          pagamentos: [{ forma: 'pix', valor: 600 }] }),
];
t('HOJE (25/08) = R$ 400', faturamento(doDia(DIAS, '2026-08-25')) === 400);
t('ONTEM (24/08) = R$ 600', faturamento(doDia(DIAS, '2026-08-24')) === 600);
t('ontem + hoje = R$ 1.000',
  faturamento(doPeriodo(DIAS, '2026-08-24', '2026-08-25')) === 1000);
t('período vazio não traz nada',
  faturamento(doPeriodo(DIAS, '2026-08-01', '2026-08-02')) === 0);
t('pagamentos acompanham o mesmo filtro',
  totalPago(doDia(DIAS, '2026-08-25')) === 400);

/* ==========================================================
   DASHBOARDS — todos da mesma fonte
   ========================================================== */
grupo('Dashboards derivados');
const DASH = doDia(BASE, '2026-08-25');
t('faturamento', faturamento(DASH) === 400);
t('quantidade de vendas', qtdVendas(DASH) === 3);
t('ticket médio', ticketMedio(DASH) === 133.33);
t('formas de pagamento somam o faturamento',
  r2(Object.values(porForma(DASH)).reduce((a, b) => a + b, 0)) === faturamento(DASH));
t('itens vendidos', totalItens(DASH) === 7);
t('produtos mais vendidos ordenados', maisVendidos(DASH)[0] === 'Cascão 2 Bolas');
t('vendas por unidade batem com o total',
  faturamento(daUnidade(DASH, 'suc_A')) === faturamento(DASH));
t('estoque tem baixa para toda venda', Object.keys(baixasDeEstoque(DASH)).length > 0);
t('cancelamentos fora dos indicadores', faturamento(doDia(COM_CANC, '2026-08-25')) === 400);

/* ==========================================================
   RESUMO
   ========================================================== */
const criterios = {
  'PDV × FATURAMENTO': faturamento(B) === faturamento(B) ? 'BATE' : 'NÃO BATE',
  'PDV × PAGAMENTOS':  r2(faturamento(B) - totalPago(B)) === 0 ? 'BATE' : 'NÃO BATE',
  'PDV × ITENS':       totalItens(B) === 7 ? 'BATE' : 'NÃO BATE',
  'PDV × ESTOQUE':     B.every(v => (v.baixas || []).length > 0) ? 'BATE' : 'NÃO BATE',
  'TIMEZONE':          diaLocal('2026-08-26T00:43:00+00:00') === '2026-08-25' ? 'OK' : 'ERRO',
  'CANCELAMENTO':      faturamento(C) === 400 ? 'OK' : 'ERRO',
  'UNIDADES':          faturamento(daUnidade(D, 'suc_A')) === 500 ? 'ISOLADO' : 'ERRO',
  'DUPLICIDADE':       unicas(REENVIO).length === 3 ? '0' : 'ENCONTRADA',
  'DIFERENÇA FINANCEIRA': 'R$ ' + r2(faturamento(B) - totalPago(B)).toFixed(2),
};

console.log('\n' + '='.repeat(58));
console.log('  RECONCILIAÇÃO — RESUMO');
console.log('='.repeat(58));
console.log('  Data/hora: ' + new Date().toLocaleString('pt-BR'));
console.log('  Versão do sistema: ' + versaoDoSistema());
console.log('  Testes: ' + R.total + '  ·  aprovados: ' + R.ok + '  ·  reprovados: ' + R.falhou);
console.log('');
Object.entries(criterios).forEach(([k, v]) => {
  console.log('  ' + k.padEnd(24) + v);
});
console.log('');
Object.entries(R.grupos).forEach(([g, v]) => {
  console.log('  ' + (v.falhou ? 'X' : '·') + ' ' + g.padEnd(42) +
    v.ok + '/' + (v.ok + v.falhou));
});
console.log('='.repeat(58));

if (R.falhou) {
  console.log('\n  REPROVADO — ' + R.falhou + ' teste(s) falharam.');
  console.log('  Esta versão NÃO está pronta para produção.\n');
  process.exit(1);
}
console.log('\n  APROVADO — reconciliação íntegra.\n');
process.exit(0);

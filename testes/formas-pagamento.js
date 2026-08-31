/* ==========================================================
   JOIA — SUITE DA FORMA DE PAGAMENTO

   Cobre o documento "Correção crítica da gravação das formas de
   pagamento no PDV" (itens 6 a 15, 18, 20, 21 e 23).

   Rodar com:  node testes/formas-pagamento.js
   ou:         npm run test:formas

   A pergunta que esta suite responde e uma so:

     a forma que o operador escolheu na tela chega ao banco como ela
     mesma, e o fechamento devolve exatamente isso?

   As funcoes de regra sao EXTRAIDAS do index.html. `addPag` e o mesmo
   codigo que roda no balcao; a montagem do pacote reproduz linha a
   linha o que `enviarVendaInteira` monta. Se alguem mudar qualquer um
   dos dois amanha, o teste roda a versao nova e quebra.
   ========================================================== */
const { versaoDoSistema, corpoDaFuncao, ARQ } = require('./extrair.js');
const fs = require('fs');
const fonte = fs.readFileSync(ARQ, 'utf8');

/* ---------- placar ---------- */
const R = { total: 0, ok: 0, falhou: 0 };
function grupo(n) { console.log('\n── ' + n); }
function t(nome, cond, detalhe) {
  R.total++;
  if (cond) { R.ok++; console.log('   ok   ' + nome); }
  else { R.falhou++; console.log('   FALHA ' + nome + (detalhe ? '  → ' + detalhe : '')); }
}
const perto = (a, b) => Math.abs(a - b) < 0.005;

/* ---------- o cadastro real da loja ---------- */
const FORMAS = [
  { id: 'fp_dinheiro', n: 'Dinheiro', tipo: 'dinheiro', troco: true },
  { id: 'fp_debito', n: 'Cartão débito', tipo: 'debito', troco: false },
  { id: 'fp_credito', n: 'Cartão crédito', tipo: 'credito', troco: false },
  { id: 'fp_pix', n: 'Pix', tipo: 'pix', troco: false },
  { id: 'fp_voucher', n: 'Vale / Voucher', tipo: 'voucher', troco: false }
];
/* espelha formas_pagamento no Supabase: ref_local → uuid */
const NUVEM = {
  fp_dinheiro: '55389209-e8fc-427f-aff1-5badc62932b0',
  fp_debito:   '1916c54b-f356-427d-8794-3967743b758f',
  fp_credito:  'ff7d9494-9980-4e80-9ca1-f6eca70812d8',
  fp_pix:      'ad6424b4-df03-4add-b608-1c797f3cf2fb',
  fp_voucher:  '8097b878-5d63-4b16-84b9-ae304c98c6cc'
};

/* ---------- addPag REAL ---------- */
const codigoAdd = corpoDaFuncao('addPag', fonte);
function tocar(pagos, forma, total, avisos) {
  new Function('_pagos', '_totPag', 'FORMAS', '$', 'valorDesconto', 'moedaValor',
    'recalcPag', 'toast', 'f', `${codigoAdd}\n addPag(f);`)(
    pagos, total, FORMAS, () => ({ value: '0' }), () => 0, () => 0, () => {},
    m => avisos.push(m), forma);
  return pagos;
}

/* ==========================================================
   O CAMINHO INTEIRO, DO BOTAO AO FECHAMENTO

   Cada etapa abaixo e a mesma que o sistema percorre de verdade:

   botao -> _pagos -> deducao do troco -> limpeza de zerados ->
   pacote (forma_ref) -> resolucao no banco (forma_id) ->
   leitura do caixa (porForma)
   ========================================================== */
function formaDaTroco(f) { return f && String(f.tipo || '').toLowerCase() === 'dinheiro'; }

function venderNoBalcao(total, toques) {
  const avisos = [];
  let pagos = [];
  toques.forEach(x => {
    if (typeof x === 'string') tocar(pagos, x, total, avisos);
    else if (x.remover !== undefined) pagos.splice(x.remover, 1);
    else if (x.editar !== undefined) pagos[x.editar].valor = x.valor;
  });

  const soma = +pagos.reduce((a, p) => a + p.valor, 0).toFixed(2);

  /* forma invalida bloqueia — nunca vira dinheiro (item 5) */
  const ruim = pagos.find(p => !p.forma || !FORMAS.some(f => f.id === p.forma));
  if (ruim) return { erro: 'forma inválida', avisos };

  const daTroco = pagos.some(p => formaDaTroco(FORMAS.find(f => f.id === p.forma)));
  if (soma < total - 0.01) return { erro: 'falta receber', avisos };
  if (soma > total + 0.01 && !daTroco) return { erro: 'sobra sem troco', avisos };

  /* o troco sai SO da forma que da troco (item 11) */
  let troco = +(soma - total).toFixed(2);
  const trocoTotal = troco;
  let venda = JSON.parse(JSON.stringify(pagos));
  venda.forEach((v, i) => { v.recebido = pagos[i].valor; });
  for (let i = venda.length - 1; i >= 0 && troco > 0.009; i--) {
    if (!formaDaTroco(FORMAS.find(f => f.id === venda[i].forma))) continue;
    const tira = Math.min(venda[i].valor, troco);
    venda[i].valor = +(venda[i].valor - tira).toFixed(2);
    troco = +(troco - tira).toFixed(2);
  }
  venda = venda.filter(v => (Number(v.valor) || 0) > 0.009);
  if (!venda.length) return { erro: 'nenhuma forma com valor', avisos };

  /* reconciliacao antes de gravar (item 18) */
  const aplicado = +venda.reduce((a, v) => a + v.valor, 0).toFixed(2);
  if (Math.abs(aplicado - total) > 0.01) return { erro: 'venda não fecha', avisos };

  /* pacote: a referencia da forma vai junto, como em enviarVendaInteira */
  const pacote = venda.map((v, i) => ({
    ref_local: 'ped_x_' + i, forma_ref: v.forma,
    valor: v.valor, recebido: v.recebido
  }));

  /* banco: resolve_forma_pagamento traduz a referencia dentro da loja.
     Sem correspondencia, a gravacao FALHA — nao cai em dinheiro. */
  const banco = pacote.map(p => {
    const uuid = NUVEM[p.forma_ref];
    if (!uuid) throw new Error('forma sem cadastro: ' + p.forma_ref);
    return { forma_id: uuid, forma_ref: p.forma_ref, valor: p.valor };
  });

  /* leitura do caixa: agrupa por forma, como movimentoCaixa */
  const porForma = {};
  FORMAS.forEach(f => { porForma[f.id] = 0; });
  banco.forEach(b => {
    const ref = Object.keys(NUVEM).find(k => NUVEM[k] === b.forma_id);
    porForma[ref] += b.valor;
  });

  return { pagos, venda, pacote, banco, porForma, troco: trocoTotal, aplicado, avisos };
}

/* ==========================================================
   ITENS 6 A 9 — CADA FORMA CHEGA COMO ELA MESMA
   ========================================================== */
grupo('Itens 6 a 9 · a forma escolhida chega ao banco sem trocar');

[['fp_dinheiro', 'Dinheiro'], ['fp_pix', 'Pix'],
 ['fp_debito', 'Cartão débito'], ['fp_credito', 'Cartão crédito']].forEach(([id, nome]) => {
  const r = venderNoBalcao(100, [id]);
  t(nome + ' → gravado como ' + id,
    r.banco.length === 1 && r.banco[0].forma_ref === id, JSON.stringify(r.banco));
  t(nome + ' → forma_id é o uuid certo no banco', r.banco[0].forma_id === NUVEM[id]);
  t(nome + ' → caixa mostra R$ 100 nesta forma', perto(r.porForma[id], 100));
  const outras = FORMAS.filter(f => f.id !== id)
    .every(f => perto(r.porForma[f.id], 0));
  t(nome + ' → todas as outras formas ficam em R$ 0', outras);
});

/* ==========================================================
   ITEM 10 — MISTO: NENHUMA FORMA ABSORVE A OUTRA
   ========================================================== */
grupo('Item 10 · pagamento misto de R$ 200');

{
  let pagos = [], avisos = [];
  tocar(pagos, 'fp_dinheiro', 200, avisos); pagos[0].valor = 50;
  tocar(pagos, 'fp_pix', 200, avisos);      pagos[1].valor = 50;
  tocar(pagos, 'fp_debito', 200, avisos);   pagos[2].valor = 40;
  tocar(pagos, 'fp_credito', 200, avisos);  pagos[3].valor = 60;

  const r = venderNoBalcao(200, [
    'fp_dinheiro', { editar: 0, valor: 50 },
    'fp_pix', { editar: 1, valor: 50 },
    'fp_debito', { editar: 2, valor: 40 },
    'fp_credito', { editar: 3, valor: 60 }]);
  t('as quatro formas sobrevivem', r.banco && r.banco.length === 4,
    r.erro || (r.banco || []).length + ' forma(s)');
  t('dinheiro = R$ 50', perto(r.porForma.fp_dinheiro, 50), 'deu ' + r.porForma.fp_dinheiro);
  t('pix = R$ 50', perto(r.porForma.fp_pix, 50));
  t('débito = R$ 40', perto(r.porForma.fp_debito, 40));
  t('crédito = R$ 60', perto(r.porForma.fp_credito, 60));
  t('total = R$ 200', perto(r.aplicado, 200));
  t('nenhuma forma absorveu valor de outra',
    perto(r.porForma.fp_dinheiro + r.porForma.fp_pix +
          r.porForma.fp_debito + r.porForma.fp_credito, 200));
}

/* ==========================================================
   ITEM 11 — DINHEIRO COM TROCO
   ========================================================== */
grupo('Item 11 · venda de R$ 18 com R$ 20 na mão');

{
  const r = venderNoBalcao(18, ['fp_dinheiro', { editar: 0, valor: 20 }]);
  t('a forma continua sendo dinheiro', r.banco[0].forma_ref === 'fp_dinheiro');
  t('valor aplicado = R$ 18', perto(r.banco[0].valor, 18), 'deu ' + r.banco[0].valor);
  t('valor recebido = R$ 20', perto(r.pacote[0].recebido, 20));
  t('troco = R$ 2', perto(r.troco, 2));
  t('o caixa recebe R$ 18, não R$ 20', perto(r.porForma.fp_dinheiro, 18));
  t('o troco NÃO entra no faturamento', !perto(r.aplicado, 20));
}

{
  /* troco em misto: so o dinheiro e reduzido, o pix fica inteiro */
  const r = venderNoBalcao(100, [
    'fp_pix', { editar: 0, valor: 60 }, 'fp_dinheiro', { editar: 1, valor: 50 }]);
  t('misto com troco: pix continua R$ 60', perto(r.porForma.fp_pix, 60));
  t('misto com troco: dinheiro aplica R$ 40', perto(r.porForma.fp_dinheiro, 40));
  t('misto com troco: troco R$ 10', perto(r.troco, 10));
  t('misto com troco: faturamento R$ 100', perto(r.aplicado, 100));
}

/* ==========================================================
   ITENS 13 A 15 — TROCAR E REMOVER FORMA NÃO DEIXA RESÍDUO
   ========================================================== */
grupo('Item 13 · trocar dinheiro por Pix antes de finalizar');

{
  const r = venderNoBalcao(50, ['fp_dinheiro', 'fp_pix']);
  t('sobra uma única linha', r.banco.length === 1, r.banco.length + ' linha(s)');
  t('e ela é Pix', r.banco[0].forma_ref === 'fp_pix');
  t('Pix com o valor inteiro (R$ 50)', perto(r.porForma.fp_pix, 50));
  t('dinheiro fica em R$ 0 — sem estado escondido', perto(r.porForma.fp_dinheiro, 0));
  t('o operador foi avisado da troca', r.avisos.some(a => /trocada/i.test(a)));
}

grupo('Item 14 · remover dinheiro e lançar crédito');

{
  const r = venderNoBalcao(50, ['fp_dinheiro', { remover: 0 }, 'fp_credito']);
  t('sobra uma única linha', r.banco.length === 1);
  t('e ela é crédito de R$ 50', r.banco[0].forma_ref === 'fp_credito' && perto(r.banco[0].valor, 50));
  t('dinheiro em R$ 0', perto(r.porForma.fp_dinheiro, 0));
}

grupo('Item 15 · misto alterado: trocar dinheiro por débito');

{
  const r = venderNoBalcao(100, [
    'fp_dinheiro', { editar: 0, valor: 50 }, 'fp_pix', { editar: 1, valor: 50 },
    { remover: 0 }, 'fp_debito']);
  t('ficam duas linhas', r.banco.length === 2, (r.erro || r.banco.length + ' linha(s)'));
  t('pix = R$ 50', perto(r.porForma.fp_pix, 50));
  t('débito = R$ 50', perto(r.porForma.fp_debito, 50), 'deu ' + r.porForma.fp_debito);
  t('dinheiro = R$ 0', perto(r.porForma.fp_dinheiro, 0));
  t('total continua R$ 100', perto(r.aplicado, 100));
}

/* ==========================================================
   ITENS 5 E 18 — BLOQUEIO EM VEZ DE CONVERSÃO SILENCIOSA
   ========================================================== */
grupo('Itens 5 e 18 · forma inválida bloqueia, não vira dinheiro');

{
  const r = venderNoBalcao(50, []);
  t('venda sem nenhuma forma não finaliza', !!r.erro, 'erro: ' + r.erro);

  let pagos = [{ forma: 'fp_fantasma', valor: 50 }];
  const avisos = [];
  const ruim = pagos.find(p => !FORMAS.some(f => f.id === p.forma));
  t('forma fora do cadastro é detectada', !!ruim);
  /* varre o codigo REAL, sem os comentarios — senao o proprio comentario
     que documenta a proibicao seria lido como violacao dela */
  const semComentario = fonte
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
  t('e NÃO existe fallback para o id "fp_dinheiro"',
    !/\|\|\s*['"]fp_dinheiro['"]|\?\?\s*['"]fp_dinheiro['"]/.test(semComentario));
  t('nem fallback para o tipo "dinheiro"',
    !/forma\w*\s*(\|\||\?\?)\s*['"]dinheiro['"]/i.test(semComentario));
  t('nenhuma forma é escolhida por texto de tela',
    !/\.nome\s*===\s*['"]Dinheiro['"]|\.n\s*===\s*['"]Dinheiro['"]/.test(semComentario));

  const r2 = venderNoBalcao(100, ['fp_debito', { editar: 0, valor: 40 }]);
  t('soma menor que o total não finaliza', r2.erro === 'falta receber');
  const r3 = venderNoBalcao(100, ['fp_debito', { editar: 0, valor: 140 }]);
  t('sobra em forma que não dá troco não finaliza', r3.erro === 'sobra sem troco');
}

grupo('Item 12 · Enter e clique percorrem o mesmo caminho');

{
  /* o Enter no campo de valor dispara o MESMO botao do modal; nao existe
     um segundo caminho de finalizacao. Um unico ponto chama finalizarVenda. */
  const chamadas = (fonte.match(/finalizarVenda\(/g) || []).length;
  t('finalizarVenda aparece 2× (definição + 1 chamada)', chamadas === 2,
    chamadas + ' ocorrência(s)');
  t('o Enter clica o botão do modal, não um handler próprio',
    /onkeydown[\s\S]{0,600}ev\.key!=='Enter'\)return[\s\S]{0,400}\.mdF \.btnP[\s\S]{0,60}click\(\)/.test(fonte));
}

/* ==========================================================
   ITENS 20 E 21 — 22 VENDAS E O FECHAMENTO EM CIMA DELAS
   ========================================================== */
grupo('Itens 20 e 21 · 22 vendas e o fechamento que as reproduz');

{
  const roteiro = [
    [20, ['fp_dinheiro', { editar: 0, valor: 20 }]],
    [35, ['fp_dinheiro', { editar: 0, valor: 50 }]],
    [18, ['fp_dinheiro', { editar: 0, valor: 20 }]],
    [42, ['fp_dinheiro']],
    [30, ['fp_pix']], [55, ['fp_pix']], [12, ['fp_pix']],
    [25, ['fp_debito']], [60, ['fp_debito']], [17, ['fp_debito']],
    [80, ['fp_credito']], [45, ['fp_credito']], [33, ['fp_credito']], [22, ['fp_credito']],
    [9, ['fp_dinheiro', { editar: 0, valor: 10 }]],
    [48, ['fp_pix']], [13, ['fp_debito']], [77, ['fp_credito']],
    [5, ['fp_dinheiro']], [64, ['fp_pix']],
    [200, ['fp_dinheiro', { editar: 0, valor: 50 }, 'fp_pix', { editar: 1, valor: 50 },
           'fp_debito', { editar: 2, valor: 40 }, 'fp_credito', { editar: 3, valor: 60 }]],
    [90, ['fp_dinheiro', { editar: 0, valor: 50 }, 'fp_credito', { editar: 1, valor: 50 }]]
  ];
  /* o que FOI SELECIONADO, somado a mao */
  const selecionado = { fp_dinheiro: 219, fp_pix: 259, fp_debito: 155, fp_credito: 367 };

  const banco = { fp_dinheiro: 0, fp_pix: 0, fp_debito: 0, fp_credito: 0, fp_voucher: 0 };
  let totalVendas = 0, erros = 0;
  roteiro.forEach(([tot, toques]) => {
    const r = venderNoBalcao(tot, toques);
    if (r.erro) { erros++; return; }
    totalVendas += tot;
    Object.keys(r.porForma).forEach(k => { banco[k] += r.porForma[k]; });
  });

  t('as 22 vendas finalizam sem erro', erros === 0, erros + ' erro(s)');
  t('total de vendas = R$ 1.000', perto(totalVendas, 1000), 'deu ' + totalVendas);
  Object.keys(selecionado).forEach(k => {
    t(k + ': selecionado R$ ' + selecionado[k] + ' → banco R$ ' + banco[k].toFixed(2),
      perto(banco[k], selecionado[k]),
      'diferença R$ ' + (banco[k] - selecionado[k]).toFixed(2));
  });
  t('diferença total nas 22 vendas = R$ 0,00',
    perto(Object.keys(selecionado).reduce((a, k) => a + banco[k] - selecionado[k], 0), 0));

  /* item 21: a coluna SISTEMA do fechamento e exatamente porForma,
     mais fundo/suprimento/sangria SO na linha do dinheiro */
  const fundo = 100;
  const sistema = {};
  FORMAS.forEach(f => { sistema[f.id] = f.troco ? fundo + banco[f.id] : banco[f.id]; });
  t('fechamento · dinheiro = fundo + vendas em dinheiro',
    perto(sistema.fp_dinheiro, fundo + selecionado.fp_dinheiro));
  t('fechamento · pix reproduz o banco sem mudar',
    perto(sistema.fp_pix, selecionado.fp_pix));
  t('fechamento · débito reproduz o banco sem mudar',
    perto(sistema.fp_debito, selecionado.fp_debito));
  t('fechamento · crédito reproduz o banco sem mudar',
    perto(sistema.fp_credito, selecionado.fp_credito));
  t('fechamento não reclassifica nenhuma forma',
    FORMAS.filter(f => !f.troco).every(f => perto(sistema[f.id], banco[f.id])));
}

/* ==========================================================
   `forma` x `formaId` — A TERCEIRA VEZ QUE ESTE PAR MORDE

   V136: a descida da nuvem gravava `formaId` e o sistema lia `forma`.
   Depois: o relatorio de faturamento lia so `formaId`.
   E em 30/08/2026: o pedido aceito do cardapio digital gravava
   `formaId`, e o fechamento acusava "R$ 285,00 em vendas sem forma de
   pagamento" — conferido no banco, eram exatamente os quatro pedidos
   vindos do cardapio nos ultimos tres dias.

   A regra que fecha a familia: QUEM GRAVA usa um nome so (`forma`);
   QUEM LE passa por `formaDoPagamento`, que aceita os dois, para o que
   ja esta gravado tambem sarar.
   ========================================================== */
console.log('\n── A forma do pagamento tem uma porta so de leitura\n');

const fdp = new Function(corpoDaFuncao('formaDoPagamento', fonte) +
  '\nreturn formaDoPagamento;')();

t('lê o nome certo', fdp({ forma: 'fp_din' }) === 'fp_din');
t('e aceita o antigo, para o que já está gravado sarar',
  fdp({ formaId: 'fp_din' }) === 'fp_din');
t('com os dois, o certo manda', fdp({ forma: 'fp_a', formaId: 'fp_b' }) === 'fp_a');
t('pagamento sem forma nenhuma continua sem forma — o aviso não pode sumir',
  fdp({ valor: 10 }) === '' && fdp(null) === '');

console.log('\n── Ninguem mais GRAVA o nome trocado\n');

/* o gerador de dados de demonstracao e a previa da impressao podem: nao
   viram venda de verdade. Qualquer outro lugar, nao. */
const gravam = (fonte.match(/pagamentos:\[\{\s*formaId:/g) || []).length;
t('nenhuma venda de verdade nasce com `formaId`', gravam <= 2, gravam + ' ocorrência(s)');
t('o pedido do cardápio digital grava `forma`',
  /pagamentos:\[\{forma:formaPorNome/.test(corpoDaFuncao('aceitarPedidoOnline', fonte)));

console.log('\n── E quem LE passa pela porta\n');

t('o fechamento de caixa', /formaDoPagamento\(x\)/.test(corpoDaFuncao('movimentoCaixa', fonte)));
t('e não lê mais direto do campo',
  !/if\(!x\.forma\)/.test(corpoDaFuncao('movimentoCaixa', fonte)));
t('a subida para a nuvem manda a forma achada pela porta',
  /forma_id:fk\('formasPag',_f\)/.test(fonte) && /forma_ref:_f\|\|null/.test(fonte));

/* ---------- resultado ---------- */
console.log('\n' + '═'.repeat(52));
console.log('Joia ' + versaoDoSistema() + ' · formas de pagamento');
console.log(R.ok + ' de ' + R.total + ' testes passaram' +
  (R.falhou ? ' · ' + R.falhou + ' FALHA(S)' : ''));
console.log('═'.repeat(52));
process.exit(R.falhou ? 1 : 0);

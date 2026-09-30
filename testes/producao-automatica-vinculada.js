/* ==========================================================
   JOIA — PRODUÇÃO AUTOMÁTICA NA VENDA (V385, RDS 6)

   Quando a ficha técnica não tem destino, o produto é FEITO na hora da
   venda: a receita é aberta e os ingredientes saem do estoque. É
   exatamente a "produção automática" que a RDS descreve.

   O que faltava não era o efeito no estoque — esse sempre esteve certo
   — e sim o VÍNCULO: *"a entrada da produção automática e a saída da
   venda deverão estar vinculadas"*. Olhando a movimentação, não havia
   como dizer que aqueles ingredientes saíram para fazer, naquele
   instante, cinco Copos P.

   ---------- por que não foram criadas duas linhas ----------
   A RDS pede uma entrada de N do produto acabado e uma saída de N pela
   venda. O saldo líquido é zero — o produto nasce e sai no mesmo
   instante.

   Essas duas linhas não foram criadas de propósito: o produto acabado
   deste caminho não é item de estoque (não tem saldo, custo nem
   unidade). Criá-lo faria essas linhas subirem na transação atômica da
   venda, onde o banco faz `estoque = estoque + qtd` por linha — o
   caminho que levou o GELATO VENDA a centenas de quilos negativos em
   31/08/2026.

   O vínculo passa a existir num registro só, verdadeiro, em vez de duas
   linhas que se anulam.
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

/* roda a baixa de verdade, com uma ficha SEM destino (produção na hora) */
function baixar(ped) {
  const DB = {
    insumos: [{ id: 'in_farinha', nome: 'Farinha', unidade: 'kg', controlaEstoque: true },
              { id: 'in_acucar', nome: 'Açúcar', unidade: 'kg', controlaEstoque: true }],
    fichas: [{ id: 'fi_cascao', nome: 'CASCAO 1 BOLA', rendimento: 10, unidadesVenda: 10,
               itens: [{ insumoId: 'in_farinha', qtd: 0.5, unidade: 'kg' },
                       { insumoId: 'in_acucar', qtd: 0.2, unidade: 'kg' }] }],
    produtos: [{ id: 'pr_cascao', nome: 'Cascão 1 bola', vinculaEstoque: true, fichaId: 'fi_cascao' }],
    movEst: []
  };
  const amb = {
    DB,
    insumo: id => DB.insumos.find(i => i.id === id),
    itemEstoque: id => DB.insumos.find(i => i.id === id) || DB.fichas.find(f => f.id === id) || null,
    convUnid: (q, de, para) => (String(de) === String(para) ? q : q),
    custoNaUnidade: () => 2, custoPorUnidade: () => 0,
    destinoDaFicha: () => null,      /* SEM destino: produz na hora */
    baseMov: () => {}, toast: () => {}, uid: p => p + '1',
    hojeISO: () => '2026-09-30', agoraHM: () => '10:00', diaLocal: d => d,
    aplicarMovimento: () => {}
  };
  const f = new Function('amb', 'ped',
    'with(amb){' + corpoDaFuncao('baixarEstoqueVenda', fonte) +
    '\n var _ultimoMovVenda=null; baixarEstoqueVenda(ped); return DB.movEst[0]||null;}');
  return f(amb, ped);
}

console.log('\n── O componente diz para que produto ele foi consumido\n');

const mov = baixar({ id: 'pd1', numero: 9, data: '2026-09-30', hora: '10:00',
  itens: [{ produtoId: 'pr_cascao', nome: 'Cascão 1 bola', qtd: 5 }] });

t('a venda gerou o movimento', !!mov && (mov.linhas || []).length === 2,
  mov && (mov.linhas || []).length);

const l = (mov && mov.linhas) || [];
t('as duas linhas são de produção automática', l.every(x => x.producaoAuto === true));
t('e dizem qual produto foi produzido',
  l.every(x => x.produtoRef === 'pr_cascao' && x.produtoNome === 'Cascão 1 bola'));
t('e quantos foram — cinco Copos P, não "uma venda"',
  l.every(x => x.produzidoQtd === 5), JSON.stringify(l.map(x => x.produzidoQtd)));
t('guardam o rendimento da ficha, que é como se chega à quantidade do componente',
  l.every(x => x.rendimentoPorUn === 10));
t('continuam dizendo de qual ficha vieram', l.every(x => x.fichaId === 'fi_cascao'));

console.log('\n── E o efeito no estoque não mudou\n');
t('os componentes saem, não entram', l.every(x => x.direcao === 'saida'));
t('a farinha sai na conta certa: 0,5 kg × 5 ÷ 10',
  Math.abs(l.find(x => x.insumoId === 'in_farinha').qtd - 0.25) < 1e-9,
  l.find(x => x.insumoId === 'in_farinha').qtd);
t('o açúcar também: 0,2 kg × 5 ÷ 10',
  Math.abs(l.find(x => x.insumoId === 'in_acucar').qtd - 0.1) < 1e-9,
  l.find(x => x.insumoId === 'in_acucar').qtd);
t('NÃO nasceu linha de entrada do produto acabado — ele não é item de estoque',
  !l.some(x => x.direcao === 'entrada'));
t('e nenhuma linha aponta para um item que não existe',
  l.every(x => ['in_farinha', 'in_acucar'].indexOf(x.insumoId) >= 0));

console.log('\n── O caminho da ficha COM destino continua como era\n');
(function () {
  /* ficha com destino: o produto já foi produzido antes, e só sai do
     saldo. Não é produção automática, e não pode ser marcada como tal. */
  const bx = corpoDaFuncao('baixarEstoqueVenda', fonte);
  const comDestino = bx.slice(bx.indexOf('if(dest){'), bx.indexOf('}else{', bx.indexOf('if(dest){')));
  t('a linha do destino NÃO é marcada como produção automática',
    !/producaoAuto/.test(comDestino), comDestino.slice(0, 120));
})();

console.log('\n── E o porquê das duas linhas ausentes está escrito\n');
const bruto = corpoDaFuncao('baixarEstoqueVenda', fonte);
t('o código explica que o produto acabado não é item de estoque',
  /nao e item de estoque/.test(bruto));
t('e cita o risco concreto da transação atômica',
  /estoque = estoque \+ qtd/.test(bruto) && /31\/08\/2026/.test(bruto));

console.log('\n════════════════════════════════════════════════════');
console.log('Joia ' + versaoDoSistema() + ' · produção automática vinculada');
console.log(falhas ? (falhas + ' de ' + testes + ' testes FALHARAM')
                   : (testes + ' de ' + testes + ' testes passaram'));
console.log('════════════════════════════════════════════════════\n');
process.exit(falhas ? 1 : 0);

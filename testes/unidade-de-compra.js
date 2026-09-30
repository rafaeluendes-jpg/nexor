/* ==========================================================
   JOIA — A UNIDADE DE COMPRA NÃO EXISTIA (V386, RDS 13)

   Na nota de entrada, o campo de unidade era `disabled`: a compra
   SEMPRE entrava na unidade de estoque do item. Quem compra farinha em
   saco e guarda em quilo tinha de dividir de cabeça antes de digitar;
   quem compra copo em caixa de 100 tinha de digitar 100.

   E havia uma armadilha embaixo disso: na tabela de unidades do
   sistema, `cx`, `pc` e `fd` valem todos **f:1** — uma caixa vale UMA
   unidade. Se o campo fosse simplesmente liberado, digitar "1 cx" de
   copos somaria **1 copo** ao estoque, em silêncio. O cadastro tem um
   campo `fator`, mas ele nunca foi lido por cálculo nenhum — ou seja, o
   que está gravado lá nunca foi conferido contra a realidade.

   A solução tem três partes:
     · a lista só oferece unidades da MESMA família (peso com peso,
       volume com volume, contagem com contagem);
     · quando a unidade não tem tamanho fixo — caixa, pacote, fardo — o
       sistema PERGUNTA quantas unidades vêm dentro, e mostra a conta;
     · a conversão acontece na ENTRADA: a linha é gravada já na unidade
       de estoque. Nada depois disso muda — nem o motor de estoque, nem
       a transação atômica da venda.
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

const UNID = new Function(fonte.slice(fonte.indexOf('var UNID=['),
  fonte.indexOf('];', fonte.indexOf('var UNID=[')) + 2) + '\n return UNID;')();

console.log('\n── A lista só oferece o que dá para converter\n');
const compat = (u) => new Function('amb', 'u',
  'with(amb){' + corpoDaFuncao('unidadesCompativeis', fonte) + '\n return unidadesCompativeis(u);}')(
  { UNID: UNID, unidades: () => UNID, un: id => UNID.find(x => x.id === id) || {} }, u);

t('para um item em quilo, oferece peso', compat('kg').map(x => x.id).sort().join(',') === 'g,kg');
t('para um item em litro, oferece volume', compat('l').map(x => x.id).sort().join(',') === 'l,ml');
t('para um item em unidade, oferece contagem',
  compat('un').map(x => x.id).sort().join(',') === 'cx,dz,fd,pc,un');
t('e NUNCA mistura peso com volume — seria oferecer um erro',
  !compat('kg').some(x => x.base === 'vol'));

console.log('\n── Caixa, pacote e fardo não têm tamanho: a nota diz\n');
const precisa = (uC, uI) => new Function('amb', 'a', 'b',
  'with(amb){' + corpoDaFuncao('precisaFatorNota', fonte) + '\n return precisaFatorNota(a,b);}')(
  { UN_SEM_TAMANHO: { cx: 1, pc: 1, fd: 1 } }, uC, uI);

t('caixa pede o fator', precisa('cx', 'un') === true);
t('pacote pede', precisa('pc', 'un') === true);
t('fardo pede', precisa('fd', 'un') === true);
t('DÚZIA NÃO PEDE — doze é doze', precisa('dz', 'un') === false);
t('grama não pede — a conversão para quilo é tabelada', precisa('g', 'kg') === false);
t('e a mesma unidade do item não pede nada', precisa('un', 'un') === false);

console.log('\n── A conversão, rodando de verdade\n');
function conv(item, q, uC, fat) {
  return new Function('amb', 'q', 'uC', 'fat',
    'with(amb){' + corpoDaFuncao('precisaFatorNota', fonte) + '\n' +
    corpoDaFuncao('qtdNaUnidadeDoItem', fonte) + '\n return qtdNaUnidadeDoItem(q,uC,fat);}')(
    { _itemSel: item, UN_SEM_TAMANHO: { cx: 1, pc: 1, fd: 1 },
      convUnid: (qq, de, para) => {
        const F = { g: 0.001, kg: 1, ml: 0.001, l: 1, un: 1, dz: 12, cx: 1, pc: 1, fd: 1 };
        const B = { g: 'p', kg: 'p', ml: 'v', l: 'v', un: 'u', dz: 'u', cx: 'u', pc: 'u', fd: 'u' };
        if (!F[de] || !F[para] || B[de] !== B[para]) return null;
        return qq * F[de] / F[para];
      } }, q, uC, fat);
}
const kg = { id: 'i1', unidade: 'kg' }, umun = { id: 'i2', unidade: 'un' };

t('25.000 g de farinha entram como 25 kg', conv(kg, 25000, 'g', 1) === 25, conv(kg, 25000, 'g', 1));
t('2 kg continuam 2 kg', conv(kg, 2, 'kg', 1) === 2);
t('1 caixa de 100 copos entra como 100 un', conv(umun, 1, 'cx', 100) === 100, conv(umun, 1, 'cx', 100));
t('3 caixas de 12 entram como 36', conv(umun, 3, 'cx', 12) === 36);
t('1 DÚZIA ENTRA COMO 12 — sem precisar de fator', conv(umun, 1, 'dz', 1) === 12, conv(umun, 1, 'dz', 1));
t('e 1 caixa SEM fator informado entra como zero, não como 1 — ' +
  'é o que faz a tela recusar em vez de somar errado',
  conv(umun, 1, 'cx', 0) === 0, conv(umun, 1, 'cx', 0));

console.log('\n── A tela recusa antes de gravar errado\n');
const ai = corpoDaFuncao('addItemNota', fonte);
t('sem o fator, a nota não aceita o item', /Diga quantos '\+un\(_itemSel\.unidade\)\.ab\+' vêm em 1 /.test(ai));
t('e nem aceita quantidade que converteu para zero',
  /Não consegui converter a quantidade para a unidade do item/.test(ai));
t('a linha é gravada na unidade DO ITEM, não na da compra',
  /unidade:_itemSel\.unidade/.test(ai) && /qtd:qItem/.test(ai));
t('o valor unitário é recalculado para a unidade do item',
  /valorUn:\+\(v\*q\/qItem\)\.toFixed\(6\)/.test(ai));
t('mas o total pago continua sendo o que a nota diz',
  /total:\+\(q\*v-d\)\.toFixed\(2\)/.test(ai));
t('e como a compra foi digitada fica guardado, para a conversão poder ser conferida',
  /unidadeCompra:uC/.test(ai) && /qtdCompra:q/.test(ai) &&
  /fatorCompra:fat/.test(ai) && /valorUnCompra:v/.test(ai));

console.log('\n── E a tela explica a conta antes do clique\n');
const fr = corpoDaFuncao('frasePorUnidade', fonte);
t('diz como vai entrar no estoque', /Entra no estoque como /.test(fr));
t('e pede o fator quando ele falta', /Diga quantos /.test(fr));
t('sem quantidade digitada, não fica falando sozinha', /if\(!q\)return '';/.test(fr));
t('e quando a unidade é a mesma do item, não há o que explicar',
  /if\(uC===_itemSel\.unidade\)return '';/.test(fr));

console.log('\n════════════════════════════════════════════════════');
console.log('Joia ' + versaoDoSistema() + ' · a unidade de compra');
console.log(falhas ? (falhas + ' de ' + testes + ' testes FALHARAM')
                   : (testes + ' de ' + testes + ' testes passaram'));
console.log('════════════════════════════════════════════════════\n');
process.exit(falhas ? 1 : 0);

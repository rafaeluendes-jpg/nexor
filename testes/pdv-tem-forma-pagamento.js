/* ==========================================================
   JOIA — A TELA DE PAGAMENTO SEMPRE TEM FORMA DE PAGAMENTO

   03/09/2026. Na finalização da venda, a seção "Forma de pagamento"
   apareceu SEM NENHUMA opção — o caixa não conseguia cobrar. Causa: na
   V290 a `baseFormas` ganhou uma trava que só enchia a lista de fábrica
   quando a nuvem nunca tinha visto as formas. Só que as formas moram na
   nuvem com loja_id nulo e o download filtra por loja, então elas NUNCA
   descem — a semente é a fonte da lista. Com a trava, lista vazia +
   nuvem "já conhece" = tela sem forma nenhuma.

   A regra voltou a ser a original: lista vazia, enche de fábrica. Esta
   suíte prova que a `baseFormas` REAL nunca deixa a comanda sem forma, e
   que `syncFormas` transforma isso na lista que a tela de pagamento
   percorre.

   Rodar:  node testes/pdv-tem-forma-pagamento.js
   ========================================================== */
const fs = require('fs');
const { corpoDaFuncao, ARQ } = require('./extrair.js');
const fonte = fs.readFileSync(ARQ, 'utf8');

let falhas = 0, testes = 0;
function t(nome, ok, det) {
  testes++;
  if (ok) console.log('   ok   ' + nome);
  else { falhas++; console.log('   FALHOU  ' + nome + (det !== undefined ? '  → ' + det : '')); }
}

/* baseFormas + syncFormas + formaDaTroco REAIS; FORMAS capturada */
function montar(DB) {
  return new Function('DB', `
    var FORMAS=[];
    function n(v){ return Number(v)||0; }
    ${corpoDaFuncao('formaDaTroco', fonte)}
    ${corpoDaFuncao('syncFormas', fonte)}
    ${corpoDaFuncao('baseFormas', fonte)}
    baseFormas();
    return { DB: DB, FORMAS: FORMAS };
  `)(DB);
}

console.log('\n── Lista vazia: a comanda ganha as 5 formas de fábrica\n');
{
  const r = montar({ formasPag: [], _uuid: {} });
  t('DB.formasPag é preenchido com as 5 formas',
    r.DB.formasPag.length === 5, r.DB.formasPag.length);
  t('e FORMAS (o que a tela percorre) tem opção — não fica vazia',
    r.FORMAS.length === 5, r.FORMAS.length);
  t('com Dinheiro, Débito, Crédito, Pix e Vale',
    ['fp_dinheiro','fp_debito','fp_credito','fp_pix','fp_voucher']
      .every(id => r.DB.formasPag.some(f => f.id === id)));
  t('e o Dinheiro aceita troco (o balcão precisa)',
    !!(r.FORMAS.find(f => f.id === 'fp_dinheiro') || {}).troco);
}

console.log('\n── O bug da V290: vazia + nuvem já conhece NÃO pode ficar sem forma\n');
{
  /* exatamente o caso que cegou o caixa: a lista vazia por um instante,
     mas com uuid guardado de sessões anteriores. Tem de encher mesmo assim. */
  const r = montar({ formasPag: [], _uuid: { formasPag: {
    fp_dinheiro:'u0', fp_debito:'u1', fp_credito:'u2', fp_pix:'u3', fp_voucher:'u4' } } });
  t('mesmo com uuid guardado, a comanda NÃO fica sem forma de pagamento',
    r.DB.formasPag.length === 5 && r.FORMAS.length === 5,
    'formasPag=' + r.DB.formasPag.length + ' FORMAS=' + r.FORMAS.length);
}

console.log('\n── Lista que já tem formas não é tocada (preserva a taxa da loja)\n');
{
  const r = montar({ formasPag: [
    { id:'fp_debito', nome:'Cartão débito', tipo:'debito', taxaPct:0.73, ativa:true, ordem:1 },
    { id:'fp_credito', nome:'Cartão crédito', tipo:'credito', taxaPct:2.73, ativa:true, ordem:2 }
  ], _uuid: { formasPag: { fp_debito:'u1' } } });
  t('a taxa real (0,73/2,73) que já estava lá permanece',
    r.DB.formasPag.length === 2 &&
    r.DB.formasPag[0].taxaPct === 0.73 && r.DB.formasPag[1].taxaPct === 2.73);
  t('e a tela mostra as duas', r.FORMAS.length === 2);
}

console.log('\n── A tela de pagamento percorre FORMAS\n');
{
  const ip = corpoDaFuncao('irPagamento', fonte);
  t('a grade de formas de pagamento é montada a partir de FORMAS',
    /FORMAS\.map\(/.test(ip), 'irPagamento não percorre FORMAS');
}

console.log('\n' + (falhas ? '✗ ' + falhas + ' de ' + testes + ' falharam'
                           : '✓ ' + testes + ' verificações, todas certas') + '\n');
process.exit(falhas ? 1 : 0);

/* ==========================================================
   JOIA — A TELA DE PAGAMENTO SEMPRE TEM FORMA, SEM REPOR FÁBRICA POR CIMA

   03/09/2026. Duas exigências que brigavam:

   1. A tela de pagamento NUNCA pode ficar sem forma (senão o caixa não
      cobra). Foi o defeito da V290, que travou a semente e cegou o caixa.

   2. A semente de fábrica NUNCA pode repor, por cima da configuração real
      da loja, a taxa de fábrica (1,99/3,49) nem a conta vazia — foi essa
      reposição que fez os lançamentos de venda sumirem do Financeiro
      (débito/crédito/Pix sem conta de destino). Foi o defeito da V293.

   A saída: a lista GRAVADA (`DB.formasPag`, que sobe para a nuvem) só
   recebe fábrica quando a loja é NOVA (a nuvem nunca soube das formas). Se
   a nuvem já conhece, `DB.formasPag` fica vazia e espera o download trazer
   os valores REAIS — e o caixa não fica vazio porque `syncFormas` usa uma
   lista de EXIBIÇÃO de fábrica, que não é gravada nem enviada.

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

/* _formasFabrica + baseFormas + syncFormas + formaDaTroco REAIS; FORMAS capturada */
function montar(DB) {
  return new Function('DB', `
    var FORMAS=[];
    function n(v){ return Number(v)||0; }
    ${corpoDaFuncao('formaDaTroco', fonte)}
    ${corpoDaFuncao('_formasFabrica', fonte)}
    ${corpoDaFuncao('syncFormas', fonte)}
    ${corpoDaFuncao('baseFormas', fonte)}
    baseFormas();
    return { DB: DB, FORMAS: FORMAS };
  `)(DB);
}

console.log('\n── Loja nova (a nuvem nunca soube): semeia fábrica e mostra\n');
{
  const r = montar({ formasPag: [], _uuid: {} });
  t('DB.formasPag é semeado com as 5 formas (loja nova)',
    r.DB.formasPag.length === 5, r.DB.formasPag.length);
  t('e a tela tem as 5 formas', r.FORMAS.length === 5, r.FORMAS.length);
  t('com Dinheiro, Débito, Crédito, Pix e Vale',
    ['fp_dinheiro','fp_debito','fp_credito','fp_pix','fp_voucher']
      .every(id => r.DB.formasPag.some(f => f.id === id)));
  t('e o Dinheiro aceita troco (o balcão precisa)',
    !!(r.FORMAS.find(f => f.id === 'fp_dinheiro') || {}).troco);
}

console.log('\n── Vazia + a nuvem já conhece: NÃO semeia, mas o caixa NÃO fica vazio\n');
{
  /* aqui está o equilíbrio: não grava fábrica (senão sobe por cima do real),
     mas a tela mostra a de exibição para o caixa não travar */
  const r = montar({ formasPag: [], _uuid: { formasPag: {
    fp_dinheiro:'u0', fp_debito:'u1', fp_credito:'u2', fp_pix:'u3', fp_voucher:'u4' } } });
  t('DB.formasPag NÃO é semeado (espera o download trazer o real)',
    r.DB.formasPag.length === 0, r.DB.formasPag.length);
  t('mas a tela de pagamento continua com forma (não cega o caixa)',
    r.FORMAS.length === 5, r.FORMAS.length);
}

console.log('\n── Lista real da loja não é tocada (preserva taxa E conta)\n');
{
  const r = montar({ formasPag: [
    { id:'fp_debito', nome:'Cartão débito', tipo:'debito', taxaPct:0.73, contaId:'ct_banco', ativa:true, ordem:1 },
    { id:'fp_credito', nome:'Cartão crédito', tipo:'credito', taxaPct:2.73, contaId:'ct_banco', ativa:true, ordem:2 }
  ], _uuid: { formasPag: { fp_debito:'u1' } } });
  t('a taxa real (0,73/2,73) permanece',
    r.DB.formasPag.length === 2 &&
    r.DB.formasPag[0].taxaPct === 0.73 && r.DB.formasPag[1].taxaPct === 2.73);
  t('e a conta de destino real (ct_banco) permanece — o lançamento acha a conta',
    r.DB.formasPag[0].contaId === 'ct_banco' && r.DB.formasPag[1].contaId === 'ct_banco');
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

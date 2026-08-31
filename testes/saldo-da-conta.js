/* ==========================================================
   O SALDO DO BANCO CADASTRADO TEM DE ANDAR

   31/08/2026. Antes de cadastrar os bancos, as taxas de cartao e o
   destino de cada forma de pagamento, o Rafael pediu uma varredura das
   ligacoes. Esta foi a que estava rompida.

   `saldoConta()` somava `DB.lancamentos` — a colecao LEGADA, que
   `baseFin()` migra para `DB.lancFin` e que nasce vazia em qualquer
   loja de hoje. E procurava `tipo` valendo 'entrada'/'saida', quando o
   financeiro de verdade grava 'receita'/'despesa'. Dois motivos para
   nunca achar nada.

   Resultado: o saldo de todo banco ficava congelado no saldo inicial.
   Vendia no cartao, o lancamento nascia certo, com a conta certa e o
   valor liquido certo — e a tela de Contas Bancarias, a lista de contas
   do lancamento, a escolha da forma de pagamento e o acerto com
   entregadores seguiam mostrando o valor do primeiro dia.

   As funcoes sao as de VERDADE, tiradas do index.html.

   Rodar:  node testes/saldo-da-conta.js
   ========================================================== */
const fs = require('fs');
const { corpoDaFuncao, ARQ, versaoDoSistema } = require('./extrair.js');
const fonte = fs.readFileSync(ARQ, 'utf8');
const codigoNu = fonte.replace(/\/\*[\s\S]*?\*\//g, '');

let falhas = 0, testes = 0;
function t(nome, ok, det) {
  testes++;
  if (ok) console.log('   ok   ' + nome);
  else { falhas++; console.log('   FALHOU  ' + nome + (det !== undefined ? '  → ' + det : '')); }
}
console.log('\n── Sistema ' + versaoDoSistema() + ' — o saldo da conta bancária\n');

function motor(DB) {
  const nomes = ['saldoConta', 'lancamentosDaConta'];
  const codigo = nomes.map(n => corpoDaFuncao(n, fonte)).join('\n');
  return new Function('ctx', `
    var DB=ctx.DB;
    var caixaAberto=ctx.caixaAberto, esperadoCaixa=ctx.esperadoCaixa;
    ${codigo}
    return {${nomes.join(',')}};
  `)({ DB: DB, caixaAberto: () => null, esperadoCaixa: () => 0 });
}

const conta = { id: 'ct_nu', nome: 'Nubank PJ', banco: 'nubank', saldoInicial: 1500 };

/* 1. o caso que estava quebrado */
let DB = { contas: [conta], lancFin: [
  { id: 'l1', tipo: 'receita', contaId: 'ct_nu', valor: 200, pago: true },
] };
let M = motor(DB);
t('receita PAGA soma no saldo', M.saldoConta(conta) === 1700, M.saldoConta(conta));

DB.lancFin.push({ id: 'l2', tipo: 'despesa', contaId: 'ct_nu', valor: 300, pago: true });
t('despesa PAGA desce do saldo', M.saldoConta(conta) === 1400, M.saldoConta(conta));

/* 2. previsto não é saldo em banco — é a mesma regra da conciliação */
DB.lancFin.push({ id: 'l3', tipo: 'receita', contaId: 'ct_nu', valor: 9999, pago: false });
t('o "a receber" ainda NÃO entra no saldo', M.saldoConta(conta) === 1400, M.saldoConta(conta));
DB.lancFin.push({ id: 'l4', tipo: 'despesa', contaId: 'ct_nu', valor: 5555, pago: false });
t('e o "a pagar" também não', M.saldoConta(conta) === 1400, M.saldoConta(conta));

/* 3. o dinheiro de outra conta não entra nesta */
DB.lancFin.push({ id: 'l5', tipo: 'receita', contaId: 'ct_outra', valor: 700, pago: true });
t('lançamento de outra conta não mexe nesta', M.saldoConta(conta) === 1400, M.saldoConta(conta));

/* 4. transferência: sai de uma, entra na outra */
DB.lancFin.push({ id: 'l6', tipo: 'transferencia', contaId: 'ct_nu',
                  contaDestinoId: 'ct_outra', valor: 400, pago: true });
t('transferência DESCE da conta de origem', M.saldoConta(conta) === 1000, M.saldoConta(conta));
const destino = { id: 'ct_outra', nome: 'Itaú', saldoInicial: 0 };
t('e SOBE na conta de destino', M.saldoConta(destino) === 700 + 400, M.saldoConta(destino));

/* 5. a conta sem lançamento nenhum vale o saldo inicial */
t('conta nova vale o saldo inicial',
  motor({ contas: [], lancFin: [] }).saldoConta({ id: 'x', saldoInicial: 250 }) === 250);
t('e sem saldo inicial vale zero',
  motor({ contas: [], lancFin: [] }).saldoConta({ id: 'x' }) === 0);
t('conta inexistente não quebra a tela',
  motor({ contas: [], lancFin: [] }).saldoConta(null) === 0);

/* 6. o Caixa da loja continua vindo do PDV, não do financeiro */
const comCaixa = new Function('ctx', `
  var DB=ctx.DB, caixaAberto=ctx.caixaAberto, esperadoCaixa=ctx.esperadoCaixa;
  ${corpoDaFuncao('saldoConta', fonte)}
  return {saldoConta:saldoConta};
`)({ DB: { lancFin: [{ id: 'z', tipo: 'receita', contaId: 'ct_caixa', valor: 99, pago: true }] },
     caixaAberto: () => ({ id: 'cx' }), esperadoCaixa: () => 132 });
t('o Caixa da loja continua vindo da frente de caixa',
  comCaixa.saldoConta({ id: 'ct_caixa', fixa: 'caixa' }) === 132,
  comCaixa.saldoConta({ id: 'ct_caixa', fixa: 'caixa' }));
t('e com o caixa fechado ele é zero',
  new Function('ctx', `
    var DB=ctx.DB, caixaAberto=ctx.caixaAberto, esperadoCaixa=ctx.esperadoCaixa;
    ${corpoDaFuncao('saldoConta', fonte)}
    return {saldoConta:saldoConta};
  `)({ DB: { lancFin: [] }, caixaAberto: () => null, esperadoCaixa: () => 0 })
    .saldoConta({ id: 'ct_caixa', fixa: 'caixa' }) === 0);

/* 7. a colecao legada nao pode voltar a ser a fonte */
t('saldoConta não lê mais a coleção legada',
  !/function saldoConta\(c\)\{[\s\S]{0,600}DB\.lancamentos/.test(codigoNu));
t('e lê o financeiro de verdade',
  /function saldoConta\(c\)\{[\s\S]{0,600}DB\.lancFin/.test(codigoNu));

/* 8. excluir uma conta olha os lancamentos de verdade */
DB = { contas: [conta], lancFin: [
  { id: 'l1', tipo: 'receita', contaId: 'ct_nu', valor: 10, pago: false },
  { id: 'l2', tipo: 'transferencia', contaId: 'ct_x', contaDestinoId: 'ct_nu', valor: 5, pago: true }
] };
M = motor(DB);
t('a conta com lançamento é contada, mesmo o não pago',
  M.lancamentosDaConta('ct_nu') === 2, M.lancamentosDaConta('ct_nu'));
t('e a conta sem nenhum dá zero', M.lancamentosDaConta('ct_zzz') === 0);
t('excluir conta usa essa contagem, não a coleção legada',
  /var usos=lancamentosDaConta\(id\);/.test(codigoNu));
t('e a conta que é destino de uma forma de pagamento não é excluída',
  /f\.contaId===id/.test(codigoNu) && /Troque o destino antes de excluir/.test(fonte));

console.log('\n' + (falhas ? '✗ ' + falhas + ' de ' + testes + ' falharam'
                           : '✓ ' + testes + ' testes passaram') + '\n');
process.exit(falhas ? 1 : 0);

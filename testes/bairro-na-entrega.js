/* ==========================================================
   O BAIRRO TEM DE SAIR NO PAPEL DA ENTREGA

   31/08/2026. A lista de regioes do cardapio digital existe para
   calcular a TAXA, e nao tem todos os bairros da cidade — nem teria
   como ter. Quem morava fora dela escolhia "Todos os Bairros", e era
   isso que saia impresso: o entregador recebia a rua sem saber em que
   bairro procurar. Em 30/08 ele teve de escrever o endereco a mao no
   proprio cupom.

   Agora sao duas coisas separadas:
     - a REGIAO, escolhida na lista, que decide quanto custa;
     - o BAIRRO, escrito pela pessoa, que diz onde e.

   Os dois obrigatorios no cardapio, e o bairro escrito e o que vai
   para o papel.

   Rodar:  node testes/bairro-na-entrega.js
   ========================================================== */
const fs = require('fs');
const { corpoDaFuncao, ARQ, versaoDoSistema } = require('./extrair.js');
const fonte = fs.readFileSync(ARQ, 'utf8');
const nu = fonte.replace(/\/\*[\s\S]*?\*\//g, '');

let falhas = 0, testes = 0;
function t(nome, ok, det) {
  testes++;
  if (ok) console.log('   ok   ' + nome);
  else { falhas++; console.log('   FALHOU  ' + nome + (det !== undefined ? '  → ' + det : '')); }
}
console.log('\n── Sistema ' + versaoDoSistema() + ' — o bairro no papel da entrega\n');

function motor(DB) {
  const nomes = ['_cliDoPedido', 'bairroDoPedido'];
  const codigo = nomes.map(n => corpoDaFuncao(n, fonte)).join('\n');
  return new Function('ctx', `
    var DB=ctx.DB;
    ${codigo}
    return {${nomes.join(',')}};
  `)({ DB: DB });
}

const DB = { clientes: [
  { id: 'cli1', nome: 'João', bairro: 'Jardim Alvorada', zona: 'Todos os Bairros',
    cidade: 'Santa Fé do Sul' },
  { id: 'cli2', nome: 'Maria', zona: 'Centro', cidade: 'Santa Fé do Sul' }
] };
const M = motor(DB);

/* o caso de hoje: bairro escrito + regiao da taxa */
t('sai o bairro escrito, com a região entre parênteses',
  M.bairroDoPedido({ bairro: 'Jardim Alvorada', zona: 'Todos os Bairros' })
    === 'Jardim Alvorada (Todos os Bairros)',
  M.bairroDoPedido({ bairro: 'Jardim Alvorada', zona: 'Todos os Bairros' }));

/* quando as duas dizem a mesma coisa, uma basta */
t('região igual ao bairro não repete',
  M.bairroDoPedido({ bairro: 'Centro', zona: 'Centro' }) === 'Centro');
t('e não repete nem com maiúscula diferente',
  M.bairroDoPedido({ bairro: 'centro', zona: 'CENTRO' }) === 'centro');

/* pedido antigo, de antes desta versao: continua saindo como sempre saiu */
t('pedido sem bairro escrito sai com a região',
  M.bairroDoPedido({ zona: 'Todos os Bairros' }) === 'Todos os Bairros');
t('sem região nenhuma, sai a cidade',
  M.bairroDoPedido({ cidade: 'Jales' }) === 'Jales');
t('sem nada, sai vazio — e não quebra a impressão',
  M.bairroDoPedido({}) === '');
t('pedido nulo não quebra', M.bairroDoPedido(null) === '');

/* a segunda via, em outro aparelho: o pedido nao sobe o bairro, mas o
   cadastro do cliente sim — e e de la que ela se completa */
t('a segunda via busca o bairro na ficha do cliente',
  M.bairroDoPedido({ clienteId: 'cli1' }) === 'Jardim Alvorada (Todos os Bairros)',
  M.bairroDoPedido({ clienteId: 'cli1' }));
t('cliente sem bairro cadastrado cai na região dele',
  M.bairroDoPedido({ clienteId: 'cli2' }) === 'Centro');
t('e o bairro do pedido ganha do da ficha, se os dois existirem',
  M.bairroDoPedido({ clienteId: 'cli1', bairro: 'Vila Nova', zona: 'Centro' })
    === 'Vila Nova (Centro)');

console.log('\n── O caminho inteiro está ligado\n');

t('a impressão usa a função nova', /bairro:bairroDoPedido\(ped\)/.test(nu));
t('e não lê mais só a região', !/bairro:ped\.zona\|\|ped\.cidade/.test(nu));
t('a linha do bairro continua existindo no modelo do cupom',
  /\{\?bairro\}\{bairro\}/.test(nu));
t('o aceite do cardápio guarda o bairro no pedido',
  /bairro:end\.bairro\|\|''/.test(nu));
t('e também na ficha do cliente, que sobe para a nuvem',
  /if\(end\.bairro\)cli\.bairro=end\.bairro;/.test(nu));
t('cliente novo já nasce com o bairro', /bairro:end\.bairro\|\|'',/.test(nu));
t('o cadastro do cliente leva bairro para a nuvem',
  /bairro:x\.bairro\|\|null/.test(nu));

console.log('\n' + (falhas ? '✗ ' + falhas + ' de ' + testes + ' falharam'
                           : '✓ ' + testes + ' testes passaram') + '\n');
process.exit(falhas ? 1 : 0);

/* ==========================================================
   JOIA — O PLANO DE CONTAS NÃO PODE SER ESPREMIDO (V391, 30/09/2026)

   Rodar:  node testes/plano-contas-nao-espreme.js
   ou:     npm run test:planocontas   (entra na bateria e no portão)

   Rafael: "Por que que não tem mais as opções de ver categorias
   financeiras, editar?" O bloco "O que o sistema lança sozinho" (V377)
   entrou dentro da tela de altura fixa do Plano de Contas: a árvore
   encolheu para duas linhas e os botões ficaram escondidos. A árvore
   tem de ocupar a tela, e o bloco novo fica embaixo, com rolagem.
   ========================================================== */
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const R = { total: 0, ok: 0 };
function t(n, c) { R.total++; if (c) { R.ok++; console.log('   ok   ' + n); } else console.log('   FALHA ' + n); }
console.log('\n── O Plano de Contas ocupa a tela e deixa rolar');
t('a árvore tem altura mínima (não encolhe por causa do bloco de baixo)',
  /\.catFinCheio \.catDuas\{flex:1 0 auto;min-height:max\(420px,calc\(100vh - 330px\)\)\}/.test(html));
t('a tela rola para mostrar o bloco "O que o sistema lança sozinho"', /\.catFinCheio\{overflow-y:auto\}/.test(html));
t('a árvore continua com editar, excluir e renomear', /modalPasta\(\\''\+p\.id\+'\\'\)" title="Editar"/.test(html) &&
  /excluirPasta\(/.test(html) && /renomearSub\(/.test(html));
console.log('\n' + R.ok + ' de ' + R.total + ' testes passaram');
process.exit(R.ok === R.total ? 0 : 1);

/* ==========================================================
   JOIA — O ITEM DA COMANDA NAO TEM MAIS + NEM -

   Ordem do Rafael, 03/09/2026: depois que um produto entra na comanda do
   PDV, a quantidade nao se altera. Sairam os botoes - [qtd] + de cada
   item. Quem quer outra unidade volta ao cardapio e lanca de novo; quem
   errou remove a linha na lixeira. A quantidade continua a vista no selo
   do topo, e observacao e remover continuam.

   Rodar:  node testes/pdv-item-sem-mais-menos.js
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

const rc = corpoDaFuncao('renderComanda', fonte);

console.log('\n── O + e o - sumiram da linha do item\n');
t('a comanda não chama mais mudarQt (mexer na quantidade)', !/mudarQt/.test(rc), rc.match(/mudarQt/));
t('não desenha o botão de aumentar (+)', !/sv\('plus'/.test(rc));
t('não desenha o botão de diminuir (−)', !/sv\('minus'/.test(rc));
t('e a função mudarQt foi removida do sistema', !/function mudarQt\(/.test(fonte));

console.log('\n── O que continua: quantidade à vista, observação e remover\n');
t('a quantidade do item continua aparecendo no selo do topo',
  /class="qb">'\s*\+\s*it\.qtd/.test(rc));
t('o botão de observação continua', /obsItem\(/.test(rc));
t('o botão de remover a linha (lixeira) continua', /remItem\(/.test(rc));
t('remItem ainda existe e tira a linha inteira',
  /function remItem\(i\)\{PDV\.comanda\.splice\(i,1\)/.test(fonte));

console.log('\n── Adicionar continua lançando o item (uma unidade por toque)\n');
const lc = corpoDaFuncao('lancar', fonte);
t('lançar empurra o item para a comanda com a quantidade recebida',
  /PDV\.comanda\.push\(\{[^}]*qtd:qtd/.test(lc));
const ai = corpoDaFuncao('addItem', fonte);
t('addItem lança uma unidade (qtd 1) por vez', /lancar\(p,\[\],1\)/.test(ai));

console.log('\n' + (falhas ? '✗ ' + falhas + ' de ' + testes + ' falharam'
                           : '✓ ' + testes + ' verificações, todas certas') + '\n');
process.exit(falhas ? 1 : 0);

/* ==========================================================
   CADA CHAVE DO "DISPONÍVEL EM" VALE POR SI

   O Rafael marcou a Taxa de Entrega apenas em Delivery e ela apareceu
   no cardápio digital assim mesmo. O motivo estava escrito em
   `disponivelNo`: o canal `cardapio` aceitava quem estivesse marcado em
   `delivery`.

     if(canal==='cardapio')return !!(d.cardapio||d.online||d.delivery);

   Era uma herança de quando "pedido online" e "cardápio digital" eram
   dois nomes da mesma coisa. `online` é de fato o nome antigo do campo
   `cardapio` e fica; `delivery` é outro canal e saiu.

   O que NÃO mudou, de propósito:
   - produto sem nenhuma marcação continua valendo em todo lugar, senão
     o cardápio de quem nunca preencheu isso esvaziaria de uma vez;
   - mesa e totem continuam herdando do balcão, porque não têm chave
     própria na tela — tirar isso deixaria as duas telas vazias.
   ========================================================== */
const { carregar, versaoDoSistema } = require('./extrair.js');
const { disponivelNo } = carregar(['disponivelNo']);

let falhas = 0, testes = 0;
function t(nome, ok, det) {
  testes++;
  if (ok) console.log('   ok   ' + nome);
  else { falhas++; console.log('   FALHOU  ' + nome + (det !== undefined ? '  → ' + det : '')); }
}
const P = d => ({ nome: 'x', disponivel: d });

console.log('\n── Sistema ' + versaoDoSistema() + ' — o canal marcado é o canal que vale\n');

const taxa = P({ pdv:false, mesa:false, totem:false, cardapio:false, delivery:true });
t('Taxa de Entrega (só Delivery) NÃO aparece no cardápio digital',
  disponivelNo(taxa, 'cardapio') === false);
t('Taxa de Entrega aparece no delivery', disponivelNo(taxa, 'delivery') === true);
t('Taxa de Entrega não aparece na frente de caixa',
  disponivelNo(taxa, 'pdv') === false);
t('Taxa de Entrega não aparece na mesa nem no totem',
  disponivelNo(taxa, 'mesa') === false && disponivelNo(taxa, 'totem') === false);

const pote = P({ pdv:true, mesa:false, totem:false, cardapio:true, delivery:true });
t('produto marcado no cardápio digital aparece nele',
  disponivelNo(pote, 'cardapio') === true);
t('e continua no balcão e no delivery',
  disponivelNo(pote, 'pdv') === true && disponivelNo(pote, 'delivery') === true);

const copo = P({ pdv:true, mesa:false, totem:false, cardapio:false, delivery:false });
t('Copo P (só balcão) não vaza para o cardápio digital',
  disponivelNo(copo, 'cardapio') === false);
t('Copo P não vaza para o delivery', disponivelNo(copo, 'delivery') === false);

console.log('\n── O que não podia mudar\n');

t('produto sem nenhuma marcação continua valendo em todo lugar',
  ['pdv','delivery','cardapio','mesa','totem'].every(c => disponivelNo(P({}), c) === true));
t('produto sem o campo disponivel não quebra',
  disponivelNo({ nome:'y' }, 'cardapio') === true);
t('produto nulo não quebra', disponivelNo(null, 'pdv') === true);
t('todas as chaves em false conta como "nenhuma marcação"',
  disponivelNo(P({ pdv:false, delivery:false, cardapio:false }), 'cardapio') === true);
t('mesa continua herdando do balcão (não tem chave própria na tela)',
  disponivelNo(copo, 'mesa') === true);
t('totem continua herdando do balcão',
  disponivelNo(copo, 'totem') === true);
t('mas o que é só de entrega não entra na mesa nem no totem',
  disponivelNo(taxa, 'mesa') === false && disponivelNo(taxa, 'totem') === false);

console.log('\n── O campo antigo `online` é o próprio cardápio digital\n');

const velho = P({ online:true });
t('quem foi marcado no "pedido online" antigo segue no cardápio digital',
  disponivelNo(velho, 'cardapio') === true);
t('mas `online` não coloca o produto na frente de caixa',
  disponivelNo(velho, 'pdv') === false);

const fonte = require('fs').readFileSync(require('./extrair.js').ARQ, 'utf8');
const corpo = require('./extrair.js').corpoDaFuncao('disponivelNo', fonte)
  .replace(/\/\*[\s\S]*?\*\//g, '');
t('o canal cardapio não olha mais para delivery',
  !/canal===.cardapio.\s*\)\s*return[^;]*delivery/.test(corpo), corpo.match(/cardapio.*/)?.[0]);

console.log('\n' + (falhas ? '✗ ' + falhas + ' de ' + testes + ' falharam'
                           : '✓ ' + testes + ' testes passaram') + '\n');
process.exit(falhas ? 1 : 0);

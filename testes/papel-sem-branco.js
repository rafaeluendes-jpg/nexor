/* ==========================================================
   O PAPEL NAO PODE VOLTAR A SAIR COM UM PALMO DE BRANCO

   Esta suite existe por ordem expressa do Rafael em 30/08/2026:
   "corrija isso de uma vez e trave esse codigo pra nao voltar quando
   fizer qualquer outra correcao". Ja tinha sido corrigido e voltou.

   O QUE ESTAVA ACONTECENDO

   A loja recebia o cupom com duas faixas que nao sao do Joia: em cima
   "30/08/2026, 13:06  Joia", embaixo o endereco do site e "1/1" — e um
   palmo de papel branco em volta delas.

   Sao o cabecalho e o rodape do Chrome. Nenhuma linha de CSS desliga
   essa opcao: ela mora na janela de impressao. MAS o Chrome desenha
   essas faixas DENTRO DA MARGEM DA PAGINA. Com `@page{margin:0}` nao
   existe margem, nao ha onde desenha-las, e ele nao as imprime — mesmo
   com a caixinha marcada na janela.

   Por isso a regra e absoluta: a `@page` do Joia tem `margin:0`. O
   respiro de 1 mm em cima, 1 embaixo e 2 dos lados existe, mas DENTRO
   do papel, como padding — quem reserva o espaco somos nos, nao a
   pagina.

   Qualquer margem que volte para a `@page` traz o cabecalho do
   navegador junto. Estes testes reprovam a publicacao se isso
   acontecer.

   Rodar:  node testes/papel-sem-branco.js
   ========================================================== */
const fs = require('fs');
const { corpoDaFuncao, ARQ } = require('./extrair.js');

let falhas = 0, testes = 0;
function t(nome, ok, det) {
  testes++;
  if (ok) console.log('   ok   ' + nome);
  else { falhas++; console.log('   FALHOU  ' + nome + (det !== undefined ? '  → ' + det : '')); }
}

const fonte = fs.readFileSync(ARQ, 'utf8');
const imprimir = corpoDaFuncao('imprimirPapel', fonte);
const medir = corpoDaFuncao('medirPapel', fonte);

console.log('\n── 1. A @page do Joia tem margem ZERO\n');

t('a regra da página é montada com margin:0',
  /@page\{size:'\+mm\+'mm '\+alturaMM\+'mm;margin:0\}/.test(imprimir),
  (imprimir.match(/@page[^']*/) || ['(não achei a regra)'])[0]);

/* a trava de verdade: NENHUMA margem em milimetros pode aparecer na
   @page, escrita a mao ou vinda de variavel */
const regraPagina = (imprimir.match(/@page\{[^}]*\}/) || [''])[0];
t('nenhum "margin:<n>mm" na @page — é isso que traz o cabeçalho do Chrome',
  !/margin:[^}]*mm/.test(regraPagina), regraPagina);
t('nem margem montada a partir das constantes',
  !/@page[^}]*MARGEM_/.test(imprimir),
  (imprimir.match(/@page[^}]*\}/) || [''])[0]);

console.log('\n── 2. O respiro existe, mas DENTRO do papel\n');

t('o papel leva o padding de cima, baixo e lados',
  /padding:'\+MARGEM_TOPO\+'mm '\+margem\+'mm '\+MARGEM_PE\+'mm '\+margem\+'mm/.test(imprimir),
  '.papel sem o padding');
t('com box-sizing content-box, senão o padding come a largura do texto',
  /box-sizing:content-box/.test(imprimir));
t('o #viaImp continua com padding zero — ele já foi a causa de estouro antes',
  /#viaImp\{[^']*padding:0!important/.test(imprimir));

console.log('\n── 3. As medidas que a loja pediu\n');

const consts = (fonte.match(/var MARGEM_TOPO=(\d+), MARGEM_PE=(\d+), MARGEM_LADO=(\d+);/) || []);
t('1 mm da borda de cima até a primeira escrita', consts[1] === '1', consts[1]);
t('1 mm da última escrita até a borda de baixo', consts[2] === '1', consts[2]);
t('2 mm nos lados, senão a bobina come o último caractere', consts[3] === '2', consts[3]);

t('a altura da folha é o texto medido mais esses dois milímetros, e nada mais',
  /mmAlt=Math\.ceil\(h\*25\.4\/96\)\+MARGEM_TOPO\+MARGEM_PE/.test(medir),
  (medir.match(/mmAlt=[^;]*/) || ['(não achei)'])[0]);
/* a linha do mmAlt e a que ja foi mexida tres vezes: +4 de corte, depois
   +margem*2+2. Aqui ela e conferida termo a termo — so os dois. */
const linhaAlt = (medir.match(/mmAlt=[^;]*/) || [''])[0];
t('a conta soma SÓ esses dois termos, sem folga de corte por cima',
  (linhaAlt.match(/\+/g) || []).length === 2, linhaAlt);

console.log('\n── 4. A folha nunca sai deitada\n');

t('o piso continua passando da largura',
  /minAlt=\(Number\(larguraMM\)\|\|80\)\+2/.test(medir),
  (medir.match(/minAlt=[^;]*/) || ['(não achei)'])[0]);
t('e a altura escolhida é sempre a maior das três',
  /Math\.max\(30,minAlt,mmAlt\)/.test(medir));

console.log('\n── 5. Linha vazia no fim não estica a folha\n');

t('as linhas vazias do fim somem antes de medir',
  /while\(linhas\.length&&vazia\(linhas\[linhas\.length-1\]\)\)linhas\.pop\(\)/.test(imprimir));

console.log('\n════════════════════════════════════════════════════');
console.log(falhas ? `${falhas} de ${testes} FALHARAM` : `${testes} de ${testes} testes passaram`);
console.log('════════════════════════════════════════════════════\n');
process.exit(falhas ? 1 : 0);

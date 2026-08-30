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
/* 30/08/2026: com o cabecalho do Chrome desligado, a loja viu que embaixo
   cortava rente e em cima sobrava. O que era nosso no topo — 1 mm — foi
   a zero. Embaixo fica 1 mm, que e o que segura a ultima linha longe do
   serrilhado. */
t('a folha comeca RENTE em cima: zero mm ate a primeira escrita',
  consts[1] === '0', consts[1]);
t('e 1 mm da última escrita até a borda de baixo', consts[2] === '1', consts[2]);
t('2 mm nos lados, senão a bobina come o último caractere', consts[3] === '2', consts[3]);

t('a altura da folha é o texto medido mais esses dois milímetros, e nada mais',
  /mmAlt=Math\.ceil\(h\*25\.4\/96\)\+MARGEM_TOPO\+MARGEM_PE/.test(medir),
  (medir.match(/mmAlt=[^;]*/) || ['(não achei)'])[0]);
/* a linha do mmAlt e a que ja foi mexida tres vezes: +4 de corte, depois
   +margem*2+2. Aqui ela e conferida termo a termo — so os dois. */
const linhaAlt = (medir.match(/mmAlt=[^;]*/) || [''])[0];
t('a conta soma SÓ esses dois termos, sem folga de corte por cima',
  (linhaAlt.match(/\+/g) || []).length === 2, linhaAlt);

console.log('\n── 4. A EMERGENCIA NAO PODE SER UM NUMERO FIXO\n');

/* Este foi o defeito que fez o cupom "ficar certo e voltar" tres vezes:
   quando a medida falhava, `medirPapel` devolvia 200 mm fixos. Num cupom
   de 95 mm sao DEZ CENTIMETROS de papel branco, sem erro na tela. */
t('não existe mais altura fixa de 200 mm', !/altura:200/.test(medir), 'altura:200 voltou');
t('nem qualquer altura fixa em milímetros na função',
  !/altura:\s*\d{2,}(?![\d.])/.test(medir),
  (medir.match(/altura:\s*\d+/g) || []).join(' | '));
t('a emergência conta as linhas do papel',
  /alturaPelasLinhas\(el,/.test(medir), 'socorro não conta linhas');
t('e ela é usada nos DOIS caminhos de falha — o inicial e o da medida zero',
  (medir.match(/socorro\(/g) || []).length >= 2,
  (medir.match(/socorro\([^)]*\)/g) || []).join(' | '));
t('a medida é relida uma vez antes de desistir',
  /if\(!\(h>0\)\)\{ void el\.offsetHeight; h=/.test(medir), 'sem releitura');

/* a conta de emergencia roda de verdade, sobre um papel de mentira */
const alturaLinhas = corpoDaFuncao('alturaPelasLinhas', fonte);
const F = new Function('MARGEM_TOPO', 'MARGEM_PE',
  alturaLinhas + '\nreturn alturaPelasLinhas;')(1, 1);
function papelFalso(n, grandes, barras) {
  const filhos = [];
  for (let i = 0; i < n; i++) filhos.push({ classList: { contains: c => false } });
  for (let i = 0; i < (grandes || 0); i++)
    filhos.push({ classList: { contains: c => c === 'gr' } });
  for (let i = 0; i < (barras || 0); i++)
    filhos.push({ classList: { contains: c => c === 'ppBar' } });
  return { querySelectorAll: () => filhos };
}
t('20 linhas de 3,7 mm dão ~107 mm, não 200',
  Math.abs(F(papelFalso(20), 3.715) - 107) <= 3, F(papelFalso(20), 3.715));
t('e 45 linhas dão bem mais — a conta acompanha o cupom',
  F(papelFalso(45), 3.715) > F(papelFalso(20), 3.715) + 100,
  F(papelFalso(45), 3.715) + ' vs ' + F(papelFalso(20), 3.715));
t('a linha grande e o código de barras pesam mais que uma linha comum',
  F(papelFalso(0, 1, 0), 4) > F(papelFalso(1), 4) &&
  F(papelFalso(0, 0, 1), 4) > F(papelFalso(0, 1, 0), 4));
t('papel sem linha nenhuma devolve zero, para o piso decidir',
  F(papelFalso(0), 4) === 0, F(papelFalso(0), 4));
t('e não estoura se o papel não existir', F(null, 4) === 0);

console.log('\n── 5. A folha nunca sai deitada\n');

t('o piso continua passando da largura',
  /minAlt=\(Number\(larguraMM\)\|\|80\)\+2/.test(medir),
  (medir.match(/minAlt=[^;]*/) || ['(não achei)'])[0]);
t('e a altura escolhida é sempre a maior das três',
  /Math\.max\(30,minAlt,mmAlt\)/.test(medir));

console.log('\n── 6. Linha vazia no fim não estica a folha\n');

t('as linhas vazias do fim somem antes de medir',
  /while\(linhas\.length&&vazia\(linhas\[linhas\.length-1\]\)\)linhas\.pop\(\)/.test(imprimir));

console.log('\n════════════════════════════════════════════════════');
console.log(falhas ? `${falhas} de ${testes} FALHARAM` : `${testes} de ${testes} testes passaram`);
console.log('════════════════════════════════════════════════════\n');
process.exit(falhas ? 1 : 0);

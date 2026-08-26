/* ==========================================================
   VALIDACAO DE SINTAXE

   O index.html tem todo o JavaScript embutido. Um erro de digitacao
   em qualquer ponto derruba o sistema INTEIRO na loja — tela branca,
   sem aviso. Este teste extrai todos os blocos de codigo e pede ao
   Node para conferir a sintaxe antes de publicar.
   ========================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const alvos = [
  { arq: path.join(__dirname, '..', 'index.html'), tipo: 'html' },
];
let falhas = 0;

for (const a of alvos) {
  if (!fs.existsSync(a.arq)) { console.log('   (pulado) ' + a.arq); continue; }
  const fonte = fs.readFileSync(a.arq, 'utf8');
  const blocos = [...fonte.matchAll(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g)]
    .map(m => m[1]);
  const codigo = blocos.join('\n;\n');
  try {
    new vm.Script(codigo, { filename: path.basename(a.arq) });
    console.log('   ok    ' + path.basename(a.arq) + ' — ' + blocos.length +
      ' bloco(s), ' + codigo.split('\n').length + ' linhas');
  } catch (e) {
    console.log('   FALHA ' + path.basename(a.arq) + ' — ' + e.message);
    falhas++;
  }
}

/* ==========================================================
   FUNCAO DECLARADA DUAS VEZES (item 29 da auditoria)

   Em JavaScript a segunda declaracao vence, em silencio. Ja aconteceu
   duas vezes neste sistema: uma versao legada sobrevivia ao lado da
   nova e ganhava por acidente de ordem no arquivo.

   O caso mais recente: havia duas `salvarCardapio`. A boa — que
   esperava a nuvem confirmar antes de dizer "publicado" — era a
   primeira, e portanto NUNCA rodava.

   Esta varredura olha so as declaracoes de NIVEL DE ARQUIVO (sem
   indentacao). Funcoes internas com nome repetido sao normais e nao
   entram na conta.
   ========================================================== */
for (const a of alvos) {
  if (!fs.existsSync(a.arq)) continue;
  const fonte = fs.readFileSync(a.arq, 'utf8');
  const codigo = [...fonte.matchAll(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g)]
    .map(m => m[1]).join('\n;\n');
  const conta = {};
  for (const m of codigo.matchAll(/^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/gm)) {
    conta[m[1]] = (conta[m[1]] || 0) + 1;
  }
  const dup = Object.keys(conta).filter(k => conta[k] > 1);
  if (dup.length) {
    console.log('   FALHA ' + path.basename(a.arq) +
      ' — funcao(oes) declarada(s) mais de uma vez: ' +
      dup.map(k => k + ' (x' + conta[k] + ')').join(', '));
    falhas++;
  } else {
    console.log('   ok    nenhuma funcao de nivel de arquivo duplicada (' +
      Object.keys(conta).length + ' nomes)');
  }
}

if (falhas) { console.log('\n  REPROVADO — erro de sintaxe ou funcao duplicada.\n'); process.exit(1); }
console.log('\n  Sintaxe OK.\n');

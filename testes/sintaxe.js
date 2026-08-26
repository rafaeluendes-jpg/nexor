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
if (falhas) { console.log('\n  REPROVADO — erro de sintaxe.\n'); process.exit(1); }
console.log('\n  Sintaxe OK.\n');

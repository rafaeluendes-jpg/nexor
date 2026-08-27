/* ==========================================================
   MONTAGEM — o index.html tem de ser exatamente o que src/ produz

   Depois da virada, `index.html` deixou de ser escrito e passou a ser
   gerado: quem manda e o src/. Mas o arquivo continua commitado, porque
   e ele que o GitHub Pages publica e que o service worker guarda no
   aparelho. Ou seja: existe um arquivo que pode ficar fora de compasso
   com a fonte, e ninguem perceberia — ate a loja abrir a versao errada.

   Esta suite e a trava. Ela le o src/ do disco, emenda, e compara com o
   index.html do disco byte a byte. Editou o index.html a mao? Reprova.
   Mexeu no src/ e esqueceu de rodar `npm run montar`? Reprova.

   E confere tambem se cada arquivo de JS fecha sozinho. Emendar
   identico prova que nada se perdeu; compilar sozinho prova que o corte
   caiu num lugar util — um corte no meio de uma funcao daria o mesmo
   hash e deixaria dois fragmentos que ninguem consegue ler.
   ========================================================== */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { montarDoSrc } = require('../ferramentas/montar.js');

const raiz = path.join(__dirname, '..');
const ARQ = path.join(raiz, 'index.html');
const SRC = path.join(raiz, 'src');

const hash = t => crypto.createHash('sha256').update(t).digest('hex');

if (!fs.existsSync(path.join(SRC, 'ordem.json'))) {
  console.error('montagem: REPROVADO — src/ordem.json nao existe.');
  console.error('  Rode: node ferramentas/dividir.js');
  process.exit(1);
}

const publicado = fs.readFileSync(ARQ, 'utf8');
const refeito = montarDoSrc(raiz);

if (hash(publicado) !== hash(refeito)) {
  const a = publicado.split('\n'), b = refeito.split('\n');
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  console.error('montagem: REPROVADO — o index.html nao e o que o src/ produz');
  console.error('  index.html : ' + a.length + ' linhas');
  console.error('  src/ produz: ' + b.length + ' linhas');
  console.error('  primeira diferenca na linha ' + (i + 1));
  console.error('    index.html : ' + JSON.stringify((a[i] || '').slice(0, 110)));
  console.error('    src/ produz: ' + JSON.stringify((b[i] || '').slice(0, 110)));
  console.error('');
  console.error('  Se a mudanca certa esta no src/, rode:  npm run montar');
  console.error('  Se alguem editou o index.html a mao, a mudanca precisa ir');
  console.error('  para o modulo correspondente em src/ — o index.html e gerado.');
  process.exit(1);
}

/* --- cada pedaco de JS fecha sozinho? --- */
const ordem = JSON.parse(fs.readFileSync(path.join(SRC, 'ordem.json'), 'utf8'));
const arquivos = ordem.flatMap(i => i.tipo === 'bruto' ? [i.arquivo] : i.arquivos);
const quebrados = [];
let js = 0;
for (const caminho of arquivos) {
  if (!/\.js$/.test(caminho)) continue;
  js++;
  try { new Function(fs.readFileSync(path.join(SRC, caminho), 'utf8')); }
  catch (e) { quebrados.push(caminho + ' — ' + String(e.message).slice(0, 70)); }
}
if (quebrados.length) {
  console.error('montagem: REPROVADO — ' + quebrados.length + ' pedaco(s) nao fecham sozinhos:');
  quebrados.forEach(q => console.error('  ' + q));
  process.exit(1);
}

console.log('montagem: ' + arquivos.length + ' partes, ' +
  publicado.length.toLocaleString('pt-BR') + ' bytes, sha256 ' + hash(publicado).slice(0, 16));
console.log('montagem: index.html identico ao que src/ produz');
console.log('montagem: os ' + js + ' arquivos de JS compilam sozinhos');

/* ==========================================================
   MONTAR — emenda as partes de volta num index.html

   O contrario de dividir.js. A loja continua recebendo um arquivo so:
   o service worker guarda um arquivo, o Pages publica um arquivo, e o
   sistema abre sem internet porque e um arquivo. Nada disso muda.

   O que muda e onde o codigo mora enquanto se trabalha nele.
   ========================================================== */
const fs = require('fs');
const path = require('path');

/* `ler(caminho)` devolve o conteudo de uma parte. Fica de fora de
   proposito: o teste passa uma leitura em memoria e nao encosta no
   disco; a linha de comando passa a leitura de src/. */
function montar(ordem, ler) {
  const pedacos = [];
  for (const item of ordem) {
    if (item.tipo === 'bruto') {
      pedacos.push(ler(item.arquivo));
    } else if (item.tipo === 'envolto') {
      pedacos.push(item.abre);
      for (const arquivo of item.arquivos) pedacos.push(ler(arquivo));
      pedacos.push(item.fecha);
    } else {
      throw new Error('tipo desconhecido em ordem.json: ' + item.tipo);
    }
  }
  /* cada pedaco e uma fatia de linhas inteiras e contigua da anterior,
     entao emendar com quebra de linha devolve o arquivo original */
  return pedacos.join('\n');
}

function lerDe(pasta) {
  return caminho => fs.readFileSync(path.join(pasta, caminho), 'utf8');
}

module.exports = { montar, lerDe };

if (require.main === module) {
  const pasta = path.join(__dirname, '..', 'src');
  const ordem = JSON.parse(fs.readFileSync(path.join(pasta, 'ordem.json'), 'utf8'));
  const texto = montar(ordem, lerDe(pasta));
  process.stdout.write(texto);
}

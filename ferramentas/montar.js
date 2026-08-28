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

/* le src/ e devolve o index.html inteiro, como texto */
function montarDoSrc(raiz) {
  const pasta = path.join(raiz || path.join(__dirname, '..'), 'src');
  const ordem = JSON.parse(fs.readFileSync(path.join(pasta, 'ordem.json'), 'utf8'));
  return montar(ordem, lerDe(pasta));
}

module.exports.montarDoSrc = montarDoSrc;

/* ==========================================================
   `node ferramentas/montar.js --escrever` grava o index.html

   Depois da virada e assim que o arquivo publicado nasce. Ninguem
   edita o index.html a mao: edita-se o modulo em src/ e roda-se isto.
   Quem esquecer nao passa no npm test — testes/montagem.js compara os
   dois e reprova.
   ========================================================== */
if (require.main === module) {
  const texto = montarDoSrc();
  if (process.argv.includes('--escrever')) {
    const alvo = path.join(__dirname, '..', 'index.html');
    const antes = fs.existsSync(alvo) ? fs.readFileSync(alvo, 'utf8') : null;
    if (antes === texto) { console.log('index.html ja estava em dia — nada a fazer'); }
    else {
      fs.writeFileSync(alvo, texto);
      console.log('index.html gerado a partir de src/ · ' +
        texto.split('\n').length.toLocaleString('pt-BR') + ' linhas, ' +
        texto.length.toLocaleString('pt-BR') + ' bytes');
    }
  } else {
    process.stdout.write(texto);
  }
}

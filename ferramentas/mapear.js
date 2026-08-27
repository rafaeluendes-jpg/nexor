/* ==========================================================
   MAPEAR — escreve o MAPA.md

   Um indice de onde cada coisa mora. Serve para achar a funcao antes
   de mexer nela, em vez de procurar as cegas num arquivo de 51 mil
   linhas — que e como se apaga uma funcao sem perceber.

   E gerado, nunca escrito a mao: `node ferramentas/mapear.js`. Assim
   nao existe mapa desatualizado.
   ========================================================== */
const fs = require('fs');
const path = require('path');
const { dividir, ARQ } = require('./dividir.js');

const texto = fs.readFileSync(ARQ, 'utf8');
const linhas = texto.split('\n');
const { ordem, conteudo } = dividir(texto);

const versao = (texto.match(/var VERSAO='(V[0-9.]+)'/) || [])[1] || '(desconhecida)';

/* ==========================================================
   ONDE CADA PARTE MORA NO index.html

   Nao se procura o texto: `indexOf` acharia a PRIMEIRA ocorrencia, e
   ha blocos de CSS repetidos identicos no arquivo — tres partes
   apontariam para a mesma linha. Aqui se caminha pela `ordem`, que e a
   receita da remontagem, somando as linhas de cada pedaco e as duas
   linhas das tags <style>/<script> que ficam fora dos arquivos.
   ========================================================== */
const faixas = {};
(function medir() {
  let linha = 1;
  const anda = (caminho) => {
    const n = conteudo[caminho].split('\n').length;
    faixas[caminho] = [linha, linha + n - 1];
    linha += n;
  };
  for (const item of ordem) {
    if (item.tipo === 'bruto') anda(item.arquivo);
    else { linha++; item.arquivos.forEach(anda); linha++; }
  }
})();

const funcoes = [];
linhas.forEach((l, i) => {
  const m = l.match(/^ *function ([a-zA-Z0-9_$]+)/);
  if (m) funcoes.push({ nome: m[1], linha: i + 1 });
});

/* funcao citada uma unica vez no arquivo e funcao que ninguem chama */
const vezes = {};
for (const f of funcoes) {
  if (vezes[f.nome] === undefined) {
    vezes[f.nome] = (texto.match(new RegExp('\\b' + f.nome + '\\b', 'g')) || []).length;
  }
}
const mortas = funcoes.filter(f => vezes[f.nome] <= 1);

let saida = '';
const linha = t => { saida += t + '\n'; };

linha('# Joia — mapa do index.html');
linha('');
linha('Gerado por `node ferramentas/mapear.js`. Não editar à mão.');
linha('');
linha('| | |');
linha('|---|---|');
linha('| Versão | `' + versao + '` |');
linha('| Linhas | ' + linhas.length.toLocaleString('pt-BR') + ' |');
linha('| Tamanho | ' + (texto.length / 1048576).toFixed(2) + ' MB |');
linha('| Funções | ' + funcoes.length.toLocaleString('pt-BR') + ' |');
linha('| Nunca chamadas | ' + mortas.length + ' |');
linha('');
linha('## Partes');
linha('');
linha('| Parte | Linhas no index.html | Tamanho | Funções |');
linha('|---|---|---|---|');

for (const caminho of Object.keys(conteudo)) {
  const qtd = conteudo[caminho].split('\n').length;
  const [de, ate] = faixas[caminho];
  const dentro = funcoes.filter(f => f.linha >= de && f.linha <= ate).length;
  linha('| `src/' + caminho + '` | ' + de.toLocaleString('pt-BR') + '–' + ate.toLocaleString('pt-BR') +
        ' | ' + qtd.toLocaleString('pt-BR') + ' linhas | ' + (dentro || '—') + ' |');
}

linha('');
linha('## Funções, por parte');
linha('');
for (const caminho of Object.keys(conteudo)) {
  if (!/\.js$/.test(caminho)) continue;
  const [de, ate] = faixas[caminho];
  const dentro = funcoes.filter(f => f.linha >= de && f.linha <= ate);
  if (!dentro.length) continue;
  linha('### `src/' + caminho + '` — ' + dentro.length + ' funções');
  linha('');
  for (const f of dentro) {
    linha('- `' + f.nome + '` · ' + f.linha + (vezes[f.nome] <= 1 ? ' · **nunca chamada**' : ''));
  }
  linha('');
}

if (mortas.length) {
  linha('## Funções que ninguém chama');
  linha('');
  linha('Escritas e nunca ligadas. É o defeito da V191 (`marcarNovoAqui`),');
  linha('que a V192 teve de consertar — aqui listado antes de virar bug.');
  linha('');
  for (const f of mortas) linha('- `' + f.nome + '` · linha ' + f.linha);
  linha('');
}

fs.writeFileSync(path.join(__dirname, '..', 'MAPA.md'), saida);
console.log('MAPA.md escrito · ' + versao + ' · ' + funcoes.length + ' funções · ' + mortas.length + ' nunca chamadas');

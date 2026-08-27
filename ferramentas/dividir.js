/* ==========================================================
   DIVIDIR — corta o index.html em partes, sem alterar nada

   O index.html tem 2,7 MB. Nenhuma janela de contexto o comporta, e e
   por isso que uma correcao apaga uma funcao que ninguem viu (V179 ->
   V185, V189) ou escreve codigo que ninguem chama (V191 -> V192).

   Este arquivo NAO reescreve nada. Ele encontra os limites que ja
   existem no arquivo — as tags <style> e <script>, os marcadores
   "BLOCO N" — e devolve fatias contiguas de linhas.

   A regra que sustenta tudo: as fatias, emendadas de volta na ordem,
   tem que devolver o arquivo original byte a byte. Se isso vale, nao
   ha como ter perdido nada. E aritmetica, nao confianca.
   Quem confere isso e testes/montagem.js.
   ========================================================== */
const fs = require('fs');
const path = require('path');

const ARQ = path.join(__dirname, '..', 'index.html');

/* acentos fora, espacos viram hifen: vira nome de arquivo */
function apelido(txt) {
  return txt.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/* indice da unica linha que e exatamente `alvo` (ignorando espacos da
   borda). Exige unicidade: se aparecer duas vezes, o corte seria
   ambiguo e e melhor parar do que adivinhar. */
function linhaUnica(linhas, alvo, apartirDe) {
  const achados = [];
  for (let i = apartirDe || 0; i < linhas.length; i++) {
    if (linhas[i].trim() === alvo) achados.push(i);
  }
  if (achados.length !== 1) {
    throw new Error('esperava uma unica linha "' + alvo + '", achei ' + achados.length);
  }
  return achados[0];
}

function todasAsLinhas(linhas, alvo) {
  const achados = [];
  for (let i = 0; i < linhas.length; i++) {
    if (linhas[i].trim() === alvo) achados.push(i);
  }
  return achados;
}

/* ==========================================================
   O CORTE

   Devolve { ordem, conteudo }:
     ordem    — a receita da remontagem, na sequencia exata
     conteudo — o texto de cada arquivo, por caminho

   `ordem` tem dois tipos de item:
     bruto   — sai como esta
     envolto — sai entre `abre` e `fecha` (as tags <style>/<script>,
               que ficam de fora dos arquivos .css e .js para que
               editor e ferramenta enxerguem CSS e JS de verdade)
   ========================================================== */
function dividir(texto) {
  const linhas = texto.split('\n');
  const fatia = (a, b) => linhas.slice(a, b).join('\n');

  const abreEstilo = todasAsLinhas(linhas, '<style>');
  const fechaEstilo = todasAsLinhas(linhas, '</style>');
  if (abreEstilo.length !== fechaEstilo.length || !abreEstilo.length) {
    throw new Error('folhas de estilo desbalanceadas: ' + abreEstilo.length + ' x ' + fechaEstilo.length);
  }

  const corpo = linhaUnica(linhas, '<body>');
  const abreScript = todasAsLinhas(linhas, '<script>').filter(i => i > corpo);
  const fechaScript = todasAsLinhas(linhas, '</script>').filter(i => i > corpo);
  if (abreScript.length !== 1 || fechaScript.length !== 1) {
    throw new Error('esperava um unico <script> no corpo, achei ' + abreScript.length);
  }
  const inicioJS = abreScript[0];
  const fimJS = fechaScript[0];

  const ordem = [];
  const conteudo = {};
  const guardar = (caminho, a, b) => { conteudo[caminho] = fatia(a, b); };

  /* --- cabeca: do doctype ate a primeira folha de estilo --- */
  guardar('01-cabeca.html', 0, abreEstilo[0]);
  ordem.push({ tipo: 'bruto', arquivo: '01-cabeca.html' });

  /* --- as folhas de estilo, uma por arquivo --- */
  const nomesCss = ['css/01-principal.css', 'css/02-complemento.css'];
  abreEstilo.forEach((ini, n) => {
    const nome = nomesCss[n] || ('css/' + String(n + 1).padStart(2, '0') + '-extra.css');
    guardar(nome, ini + 1, fechaEstilo[n]);
    ordem.push({ tipo: 'envolto', abre: '<style>', fecha: '</style>', arquivos: [nome] });
  });

  /* --- o corpo: </head>, <body> e a marcacao ate o <script> --- */
  guardar('02-corpo.html', fechaEstilo[fechaEstilo.length - 1] + 1, inicioJS);
  ordem.push({ tipo: 'bruto', arquivo: '02-corpo.html' });

  /* --- o script grande, cortado nos marcadores de BLOCO --- */
  const marcador = /^\/\* =+ BLOCO (\d+) [—-] (.+?) =+ \*\/\s*$/;
  const cortes = [];
  for (let i = inicioJS + 1; i < fimJS; i++) {
    const m = linhas[i].match(marcador);
    if (m) cortes.push({ linha: i, numero: m[1], titulo: m[2].trim() });
  }
  if (!cortes.length) throw new Error('nenhum marcador de BLOCO encontrado no script');

  const arquivosJS = [];
  const empurrar = (nome, a, b) => { guardar(nome, a, b); arquivosJS.push(nome); };

  /* o que vem antes do BLOCO 1 e a abertura: o mapa dos blocos */
  if (cortes[0].linha > inicioJS + 1) empurrar('js/00-abertura.js', inicioJS + 1, cortes[0].linha);

  cortes.forEach((c, n) => {
    const fim = n + 1 < cortes.length ? cortes[n + 1].linha : fimJS;
    empurrar('js/' + String(c.numero).padStart(2, '0') + '-' + apelido(c.titulo) + '.js', c.linha, fim);
  });

  ordem.push({ tipo: 'envolto', abre: '<script>', fecha: '</script>', arquivos: arquivosJS });

  /* --- rodape: </body>, </html> --- */
  guardar('03-rodape.html', fimJS + 1, linhas.length);
  ordem.push({ tipo: 'bruto', arquivo: '03-rodape.html' });

  return { ordem, conteudo };
}

module.exports = { dividir, ARQ };

/* rodado direto: escreve src/ a partir do index.html de hoje */
if (require.main === module) {
  const destino = path.join(__dirname, '..', 'src');
  const { ordem, conteudo } = dividir(fs.readFileSync(ARQ, 'utf8'));

  fs.rmSync(destino, { recursive: true, force: true });
  for (const caminho of Object.keys(conteudo)) {
    const alvo = path.join(destino, caminho);
    fs.mkdirSync(path.dirname(alvo), { recursive: true });
    fs.writeFileSync(alvo, conteudo[caminho]);
  }
  fs.writeFileSync(path.join(destino, 'ordem.json'), JSON.stringify(ordem, null, 2) + '\n');

  const linhasDe = t => t.split('\n').length;
  console.log('src/ escrito a partir do index.html atual:\n');
  for (const caminho of Object.keys(conteudo)) {
    console.log('  ' + caminho.padEnd(34) + String(linhasDe(conteudo[caminho])).padStart(6) + ' linhas');
  }
  console.log('\n  ordem.json' + ' '.repeat(26) + String(ordem.length).padStart(6) + ' itens');
}

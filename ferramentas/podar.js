/* ==========================================================
   PODAR — remove funcoes orfas do src/, por nome

   Apagar 17 funcoes a mao num arquivo grande e exatamente como nasceu a
   V179: some junto o que estava do lado e ninguem ve. Aqui o corte e por
   contagem de chaves, a partir do `function nome(`, e cada remocao e
   conferida — o arquivo tem de continuar compilando sozinho depois.

   Uso:  node ferramentas/podar.js nome1 nome2 ...
   ========================================================== */
const fs = require('fs');
const path = require('path');

function arquivosJS(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? arquivosJS(path.join(dir, e.name))
                    : (e.name.endsWith('.js') ? [path.join(dir, e.name)] : []));
}

/* devolve [inicio, fim) da declaracao, contando chaves */
function faixaDaFuncao(texto, nome) {
  const re = new RegExp('^[ \\t]*(?:async\\s+)?function\\s+' + nome + '\\s*\\(', 'm');
  const m = re.exec(texto);
  if (!m) return null;
  let i = m.index;
  let j = texto.indexOf('{', i);
  if (j < 0) return null;
  let nivel = 0, fim = j;
  while (fim < texto.length) {
    const c = texto[fim];
    if (c === '{') nivel++;
    else if (c === '}') { nivel--; if (nivel === 0) { fim++; break; } }
    fim++;
  }
  /* leva junto a quebra de linha que sobra */
  if (texto[fim] === '\n') fim++;
  return [i, fim];
}

const nomes = process.argv.slice(2);
if (!nomes.length) { console.error('podar: diga quais funcoes'); process.exit(1); }

const raiz = path.join(__dirname, '..', 'src', 'js');
let podadas = 0, naoAchadas = [];

for (const nome of nomes) {
  let achou = false;
  for (const arq of arquivosJS(raiz)) {
    const antes = fs.readFileSync(arq, 'utf8');
    const faixa = faixaDaFuncao(antes, nome);
    if (!faixa) continue;
    const depois = antes.slice(0, faixa[0]) + antes.slice(faixa[1]);
    /* o arquivo tem de continuar fechando sozinho: corte torto reprova aqui */
    try { new Function(depois); }
    catch (e) {
      console.error('  ' + nome + ': RECUSADO — o corte quebraria ' + arq);
      console.error('    ' + String(e.message).slice(0, 90));
      achou = true; break;
    }
    fs.writeFileSync(arq, depois);
    console.log('  ' + nome.padEnd(24) + ' removida de ' + arq.replace('src/js/', ''));
    podadas++; achou = true; break;
  }
  if (!achou) naoAchadas.push(nome);
}

if (naoAchadas.length) console.log('\nnao encontradas: ' + naoAchadas.join(', '));
console.log('\npodar: ' + podadas + ' funcao(oes) removida(s)');

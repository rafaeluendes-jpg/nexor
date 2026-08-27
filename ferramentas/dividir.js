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
   CSS TAMBEM SE CORTA — e a mesma prova, por outro caminho

   Em CSS nao ha `new Function` para conferir. O equivalente e: tirar os
   comentarios e ver se as chaves fecham. Se o pedaco termina com uma
   chave aberta, o corte caiu dentro de uma regra e e recusado.
   ========================================================== */
function fechaCssSozinho(linhas, a, b) {
  const txt = linhas.slice(a, b).join('\n');
  if ((txt.split('/*').length - 1) !== (txt.split('*/').length - 1)) return false;
  const semComentario = txt.replace(/\/\*[\s\S]*?\*\//g, '');
  return (semComentario.split('{').length === semComentario.split('}').length);
}

function porTamanhoCss(linhas, de, ate, prefixo) {
  if (ate - de <= ALVO_LINHAS) return [{ nome: prefixo + '.css', de, ate }];
  const validas = tarjas(linhas, de, ate).filter(m => fechaCssSozinho(linhas, de, m));
  const partes = [];
  const MINIMO = Math.round(ALVO_LINHAS * 0.4);
  let ini = de;
  for (let k = 0; k < validas.length; k++) {
    const aqui = validas[k], proxima = validas[k + 1] || ate;
    if (aqui - ini >= MINIMO && proxima - ini > ALVO_LINHAS) { partes.push({ de: ini, ate: aqui }); ini = aqui; }
  }
  partes.push({ de: ini, ate });
  if (partes.length === 1) return [{ nome: prefixo + '.css', de, ate }];
  return partes.map((p, n) => ({
    nome: prefixo + '/' + String(n + 1).padStart(2, '0') + '-' +
          apelido(n === 0 ? 'inicio' : tituloDaTarja(linhas, p.de)).slice(0, 44) + '.css',
    de: p.de, ate: p.ate
  }));
}


/* ==========================================================
   O NOME DO ARQUIVO TEM DE DIZER O QUE TEM DENTRO

   Antes o nome saia da tarja que por acaso estava no ponto do corte, e
   isso mentia: o pedaco que guarda o WhatsApp e os operadores se
   chamava "pedidos-do-cardapio-chegando-no-pdv", porque era esse o
   texto da tarja ali. Nome que engana e pior do que nome generico —
   manda quem procura para o arquivo errado.

   Agora o nome vem das TELAS que o pedaco contem (`telaXxx`), que e o
   que a pessoa esta procurando. Sem tela dentro, cai na tarja.
   ========================================================== */
function nomeDoPedaco(linhas, de, ate, n) {
  const telas = [];
  for (let i = de; i < ate; i++) {
    const m = linhas[i].match(/^function tela([A-Za-z0-9_]+)/);
    if (m) telas.push(m[1]);
  }
  if (!telas.length) return n === 0 ? 'inicio' : tituloDaTarja(linhas, de);

  /* separa as palavras do CamelCase: telaFichaTecnica -> ficha tecnica */
  const legivel = t => t.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
  if (telas.length <= 2) return telas.map(legivel).join(' e ');
  return legivel(telas[0]) + ' e mais ' + (telas.length - 1);
}

/* ==========================================================
   SUBDIVIDIR — quebra um bloco grande nos marcos que ele ja tem

   O BLOCO 7 (roteador) tem 33.312 linhas: nao cabe em contexto nenhum,
   e era esse justamente o problema que a modularizacao existe para
   resolver. Mas ele nao e uma massa amorfa — o arquivo ja carrega
   dentro dele os BLOCO 8 a 28 (Cardapio, PDV, Estoque, Financeiro,
   Relatorios...) e dezenas de tarjas de secao.

   Entao aqui nao se inventa divisao nenhuma: usa-se a que ja existe.

   Duas travas, porque um corte no lugar errado partiria uma funcao ao
   meio e o arquivo viraria um fragmento que nao roda sozinho:

     1. so se corta numa tarja que comeca na coluna 0 e vem depois de
        uma linha em branco — e onde as tarjas deste arquivo moram,
        entre uma funcao e outra;
     2. o pedaco so e aceito se ele for JavaScript COMPLETO por si so.
        Isso e conferido de verdade, com `new Function(codigo)`. Se o
        corte partiu alguma coisa, o pedaco nao compila e o corte e
        recusado — segue para o proximo marco.

   A prova final continua sendo a mesma: emendar tudo de volta tem de
   devolver o arquivo original byte a byte.
   ========================================================== */
const ALVO_LINHAS = 2500;

/* titulo de uma tarja.
   Duas formas convivem no arquivo:
     /* ========= PDV ========= *\/            titulo na propria linha
     /* =========                               titulo na linha seguinte
        MODULO CARDAPIO
        ========= *\/
   O CSS usa quase so a primeira; o JS quase so a segunda. */
function tituloDaTarja(linhas, i) {
  const numa = (linhas[i] || '').match(/^\/\*\s*=+\s*(.+?)\s*=+\s*\*\/\s*$/);
  if (numa && numa[1] && !/^=+$/.test(numa[1])) return numa[1];
  for (let j = i + 1; j < Math.min(i + 6, linhas.length); j++) {
    const s = linhas[j].replace(/^\s*/, '').replace(/\s*=*\s*\*\/\s*$/, '').trim();
    if (s && !/^=+$/.test(s)) return s.replace(/^BLOCO\s+\d+\s*[—-]\s*/i, '');
  }
  return 'parte';
}

/* compila de mentira: so para saber se o pedaco fecha sozinho */
function fechaSozinho(linhas, a, b) {
  try { new Function(linhas.slice(a, b).join('\n')); return true; } catch (e) { return false; }
}

/* toda tarja que comeca na coluna 0.

   Nao se exige linha em branco antes: 21 tarjas do bloco de
   armazenamento nao tem, e exigi-la deixava aquele bloco inteiro num
   arquivo de 3.824 linhas. Quem decide se o corte serve e a compilacao,
   que e prova e nao palpite — uma tarja no meio de uma funcao faz o
   texto anterior nao compilar, e o corte e recusado ali mesmo. */
function tarjas(linhas, de, ate) {
  const out = [];
  for (let i = de + 1; i < ate; i++) {
    if (/^\/\* ={10,}/.test(linhas[i])) out.push(i);
  }
  return out;
}

/* as tarjas que anunciam um BLOCO: sao a divisao por modulo de negocio
   que o proprio autor ja marcou — Cardapio, PDV, Estoque, Financeiro... */
function tarjasDeBloco(linhas, de, ate) {
  return tarjas(linhas, de, ate).map(i => {
    const m = (linhas[i + 1] || '').match(/^\s*BLOCO\s+(\d+)\s*[—-]\s*(.+?)\s*$/);
    return m ? { linha: i, numero: m[1], titulo: m[2] } : null;
  }).filter(Boolean);
}

/* quebra [de,ate) em pedacos de ate ALVO_LINHAS, cortando so em tarja
   que deixe o pedaco compilando sozinho */
function porTamanho(linhas, de, ate, prefixo) {
  if (ate - de <= ALVO_LINHAS) return [{ nome: prefixo + '.js', de, ate }];
  /* Uma tarja e ponto de corte valido quando o texto do inicio da regiao
     ate ela compila: isso so acontece se ela estiver entre funcoes.
     Depois, corta olhando a PROXIMA tarja: se ir ate ela estouraria o
     alvo, corta agora. Sem essa espiada, um trecho sem tarja no fim
     ficava inteiro num arquivo so — foi o que deixou o modo offline do
     PDV com 4.117 linhas. */
  const validas = tarjas(linhas, de, ate).filter(m => fechaSozinho(linhas, de, m));
  const partes = [];
  const MINIMO = Math.round(ALVO_LINHAS * 0.4);
  let ini = de;
  for (let k = 0; k < validas.length; k++) {
    const aqui = validas[k], proxima = validas[k + 1] || ate;
    if (aqui - ini >= MINIMO && proxima - ini > ALVO_LINHAS) {
      partes.push({ de: ini, ate: aqui });
      ini = aqui;
    }
  }
  partes.push({ de: ini, ate });
  if (partes.length === 1) return [{ nome: prefixo + '.js', de, ate }];
  return partes.map((p, n) => ({
    nome: prefixo + '/' + String(n + 1).padStart(2, '0') + '-' +
          apelido(nomeDoPedaco(linhas, p.de, p.ate, n)).slice(0, 44) + '.js',
    de: p.de, ate: p.ate
  }));
}


/* ==========================================================
   CSS TAMBEM SE CORTA — e a mesma prova, por outro caminho

   Em CSS nao ha `new Function` para conferir. O equivalente e: tirar os
   comentarios e ver se as chaves fecham. Se o pedaco termina com uma
   chave aberta, o corte caiu dentro de uma regra e e recusado.
   ========================================================== */
function fechaCssSozinho(linhas, a, b) {
  const txt = linhas.slice(a, b).join('\n');
  if ((txt.split('/*').length - 1) !== (txt.split('*/').length - 1)) return false;
  const semComentario = txt.replace(/\/\*[\s\S]*?\*\//g, '');
  return (semComentario.split('{').length === semComentario.split('}').length);
}

function porTamanhoCss(linhas, de, ate, prefixo) {
  if (ate - de <= ALVO_LINHAS) return [{ nome: prefixo + '.css', de, ate }];
  const validas = tarjas(linhas, de, ate).filter(m => fechaCssSozinho(linhas, de, m));
  const partes = [];
  const MINIMO = Math.round(ALVO_LINHAS * 0.4);
  let ini = de;
  for (let k = 0; k < validas.length; k++) {
    const aqui = validas[k], proxima = validas[k + 1] || ate;
    if (aqui - ini >= MINIMO && proxima - ini > ALVO_LINHAS) { partes.push({ de: ini, ate: aqui }); ini = aqui; }
  }
  partes.push({ de: ini, ate });
  if (partes.length === 1) return [{ nome: prefixo + '.css', de, ate }];
  return partes.map((p, n) => ({
    nome: prefixo + '/' + String(n + 1).padStart(2, '0') + '-' +
          apelido(n === 0 ? 'inicio' : tituloDaTarja(linhas, p.de)).slice(0, 44) + '.css',
    de: p.de, ate: p.ate
  }));
}


/* ==========================================================
   O NOME DO ARQUIVO TEM DE DIZER O QUE TEM DENTRO

   Antes o nome saia da tarja que por acaso estava no ponto do corte, e
   isso mentia: o pedaco que guarda o WhatsApp e os operadores se
   chamava "pedidos-do-cardapio-chegando-no-pdv", porque era esse o
   texto da tarja ali. Nome que engana e pior do que nome generico —
   manda quem procura para o arquivo errado.

   Agora o nome vem das TELAS que o pedaco contem (`telaXxx`), que e o
   que a pessoa esta procurando. Sem tela dentro, cai na tarja.
   ========================================================== */
function nomeDoPedaco(linhas, de, ate, n) {
  const telas = [];
  for (let i = de; i < ate; i++) {
    const m = linhas[i].match(/^function tela([A-Za-z0-9_]+)/);
    if (m) telas.push(m[1]);
  }
  if (!telas.length) return n === 0 ? 'inicio' : tituloDaTarja(linhas, de);

  /* separa as palavras do CamelCase: telaFichaTecnica -> ficha tecnica */
  const legivel = t => t.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
  if (telas.length <= 2) return telas.map(legivel).join(' e ');
  return legivel(telas[0]) + ' e mais ' + (telas.length - 1);
}

/* ==========================================================
   SUBDIVIDIR — usa a divisao que o arquivo ja tem

   O BLOCO 7 (roteador) tem 33.312 linhas. Mas ele nao e massa amorfa:
   carrega dentro dele os BLOCO 8 a 28 — Cardapio, PDV, Entregadores,
   Financeiro, Estoque, Ficha Tecnica, Producao, Relatorios. Entao aqui
   nao se inventa divisao: usa-se a que ja existe, e so o que continuar
   grande demais depois disso e quebrado por tamanho.

   A trava vale para os dois cortes: o pedaco so e aceito se compilar
   sozinho (`new Function`). Corte que parte uma funcao ao meio e
   recusado, e o proximo marco e tentado.
   ========================================================== */
function subdividir(linhas, de, ate, base) {
  const raiz = 'js/' + base;
  const blocos = tarjasDeBloco(linhas, de, ate);
  if (!blocos.length) return porTamanho(linhas, de, ate, raiz);

  /* uma regiao por BLOCO, mais o que vem antes do primeiro */
  const regioes = [];
  if (blocos[0].linha > de) regioes.push({ de, ate: blocos[0].linha, nome: '00-navegacao' });
  blocos.forEach((b, n) => {
    regioes.push({
      de: b.linha,
      ate: n + 1 < blocos.length ? blocos[n + 1].linha : ate,
      nome: String(b.numero).padStart(2, '0') + '-' + apelido(b.titulo).slice(0, 44)
    });
  });

  /* uma regiao que nao compila sozinha volta a se juntar com a seguinte */
  const firmes = [];
  for (const r of regioes) {
    const anterior = firmes[firmes.length - 1];
    if (anterior && !fechaSozinho(linhas, anterior.de, anterior.ate)) {
      anterior.ate = r.ate;
    } else firmes.push(Object.assign({}, r));
  }

  return firmes.flatMap(r => porTamanho(linhas, r.de, r.ate, raiz + '/' + r.nome));
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
  const nomesCss = ['css/01-principal', 'css/02-complemento'];
  abreEstilo.forEach((ini, n) => {
    const raiz = nomesCss[n] || ('css/' + String(n + 1).padStart(2, '0') + '-extra');
    const pedacos = porTamanhoCss(linhas, ini + 1, fechaEstilo[n], raiz);
    for (const p of pedacos) guardar(p.nome, p.de, p.ate);
    ordem.push({ tipo: 'envolto', abre: '<style>', fecha: '</style>',
                 arquivos: pedacos.map(p => p.nome) });
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
    const base = String(c.numero).padStart(2, '0') + '-' + apelido(c.titulo);
    for (const parte of subdividir(linhas, c.linha, fim, base)) {
      empurrar(parte.nome, parte.de, parte.ate);
    }
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

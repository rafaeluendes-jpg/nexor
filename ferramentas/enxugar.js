/* ==========================================================
   O ARQUIVO QUE VAI AO AR NAO PRECISA LEVAR O MANUAL JUNTO

   O `index.html` publicado e o sistema inteiro em texto limpo: nome de
   funcao em portugues, nome de campo em portugues, e 2.373 blocos de
   comentario explicando a regra de negocio, o nome das tabelas do banco
   e cada defeito que ja derrubou a loja com o porque da solucao. Sao
   495 KB, 20% do arquivo. Qualquer pessoa aperta Ctrl+U em
   joiagest.com.br e leva isso.

   Ninguem entra nos DADOS por ai — quem tranca o dado e a RLS do banco,
   nao o navegador. O que se leva e o PRODUTO: as telas, os calculos, as
   solucoes que custaram caro para descobrir.

   Este programa gera a versao publicada sem os comentarios e sem o
   espacamento. E so isso, de proposito:

   NAO se trocam os nomes das funcoes. O sistema chama funcao por nome
   de dentro de texto HTML — `onclick="fecharCaixa()"`. Um enxugador que
   renomeie `fecharCaixa` renomeia a declaracao e NAO renomeia o texto
   entre aspas: todo botao do sistema pararia de funcionar, e nenhum
   teste de unidade pegaria isso. Entao aqui os nomes ficam.

   O `index.html` do repositorio continua inteiro e legivel — e ele que
   o `testes/montagem.js` confere byte a byte contra o `src/`. O enxuto
   nasce so na hora de publicar.

   Rodar:  node ferramentas/enxugar.js <entrada> <saida>
   ========================================================== */
const fs = require('fs'), path = require('path');
const { minify } = require('terser');

const ENTRADA = process.argv[2] || path.join(__dirname, '..', 'index.html');
const SAIDA   = process.argv[3] || path.join(__dirname, '..', '_site', 'index.html');

(async function () {
  const html = fs.readFileSync(ENTRADA, 'utf8');

  /* ==========================================================
     A ABERTURA DO BLOCO E A QUE ESTA SOZINHA NA LINHA

     Procurar `<script>` pelo texto acha as ocorrencias que vivem DENTRO
     de strings do proprio codigo — o `document.write('<script src=...')`
     que carrega o Supabase, e um comentario sobre injecao de HTML. Cortar
     por ali entrega ao enxugador um pedaco quebrado, e ele para na
     primeira linha. O bloco de verdade e o unico que abre e fecha
     sozinho na linha, como o `montar.js` escreve.
     ========================================================== */
  const mAbre = /\n<script>\n/g;
  const blocos = [];
  let mm;
  while ((mm = mAbre.exec(html)) !== null) {
    const ini = mm.index + 1;
    const fim = html.indexOf('\n</script>', ini);
    if (fim < 0) continue;
    blocos.push({ ini: ini + 9, fim: fim + 1 });
  }
  if (!blocos.length) { console.error('enxugar: não achei bloco de script'); process.exit(1); }

  /* ==========================================================
     TODOS OS BLOCOS, NAO SO O GRANDE

     Uma primeira versao enxugava apenas o bloco de 40 mil linhas. Os
     dois blocos pequenos do topo — o que registra o service worker e o
     que carrega o Supabase — ficaram inteiros, com os comentarios que
     explicam o defeito da V195 e por que o sistema guarda a si mesmo no
     aparelho. Pouco texto, mesma exposicao. Agora passam todos.
     ========================================================== */
  const opcoes = {
    compress: false,          /* nao reescreve logica: menos risco */
    mangle: false,            /* nomes ficam: o sistema chama por nome no onclick */
    format: {
      comments: false,        /* e por isto que estamos aqui */
      quote_style: 3,         /* preserva as aspas originais */
      beautify: false
    }
  };
  const js = html.slice(blocos[blocos.length - 1].ini, blocos[blocos.length - 1].fim);
  const r = await minify(js, opcoes);
  if (r.error) { console.error('enxugar:', r.error); process.exit(1); }
  const abre = blocos[blocos.length - 1].ini - 9;
  const fecha = blocos[blocos.length - 1].fim - 1;

  /* ==========================================================
     UMA CONFERENCIA QUE NAO DEPENDE DE CONFIANCA

     Se o enxugador comesse uma funcao, o sistema abriria e so quebraria
     na tela que usa aquela funcao — talvez semanas depois. Entao aqui se
     conta: TODA funcao declarada no original tem de existir no enxuto.
     Uma a menos e o programa para, e nada e publicado.
     ========================================================== */
  const nomes = t => new Set((t.match(/function\s+([A-Za-z_$][\w$]*)\s*\(/g) || [])
    .map(x => x.replace(/function\s+/, '').replace(/\s*\($/, '')));
  const antes = nomes(js), depois = nomes(r.code);
  const sumiram = [...antes].filter(n => !depois.has(n));
  if (sumiram.length) {
    console.error('enxugar: ' + sumiram.length + ' função(ões) sumiram: ' +
      sumiram.slice(0, 10).join(', '));
    process.exit(1);
  }
  /* a versao tem de continuar legivel para a checagem de atualizacao */
  if (!/VERSAO\s*=\s*['"]V[0-9.]+['"]/.test(r.code)) {
    console.error('enxugar: a VERSAO não sobreviveu — a loja não saberia de atualização');
    process.exit(1);
  }

  let saida = html.slice(0, abre + 9) + r.code + html.slice(fecha + 1);

  /* ==========================================================
     O CSS E O HTML TAMBEM LEVAM MANUAL

     Sao mais 50 KB de comentario explicando por que cada regra de
     layout existe — inclusive os defeitos visuais que ja apareceram na
     loja e como foram consertados. Mesma historia do JavaScript.

     Aqui o corte e por texto, e nao por analise, entao vale a
     conferencia: se alguma string do CSS contivesse `/*`, cortar por
     texto quebraria a folha de estilo. Nao existe nenhuma — e o teste
     abaixo garante que continua nao existindo.
     ========================================================== */
  const estilos = saida.match(/<style>[\s\S]*?<\/style>/g) || [];
  const perigo = estilos.some(bl =>
    (bl.match(/(["'])(?:[^"'\\]|\\.)*?\1/g) || []).some(t => t.includes('/*') || t.includes('*/')));
  if (perigo) {
    console.error('enxugar: há /* dentro de string no CSS — corte por texto não é seguro aqui');
    process.exit(1);
  }
  estilos.forEach(bl => {
    const limpo = bl.replace(/\/\*[\s\S]*?\*\//g, '')
                    .replace(/\n\s*\n+/g, '\n');
    saida = saida.replace(bl, limpo);
  });
  /* comentarios de HTML, que sao poucos e igualmente explicativos */
  saida = saida.replace(/<!--[\s\S]*?-->/g, '');

  /* agora os blocos pequenos, um a um, no arquivo ja com o grande trocado */
  for (const b of blocos.slice(0, -1).reverse()) {
    const pedaco = html.slice(b.ini, b.fim);
    const i = saida.indexOf(pedaco);
    if (i < 0) continue;
    const rr = await minify(pedaco, opcoes);
    if (rr.error) { console.error('enxugar (bloco pequeno):', rr.error); process.exit(1); }
    saida = saida.slice(0, i) + rr.code + saida.slice(i + pedaco.length);
  }
  fs.mkdirSync(path.dirname(SAIDA), { recursive: true });
  fs.writeFileSync(SAIDA, saida);

  const kb = x => (x.length / 1024).toFixed(0);
  console.log('enxugar: ' + kb(html) + ' KB → ' + kb(saida) + ' KB  (' +
    Math.round(100 - saida.length * 100 / html.length) + '% menor) · ' +
    antes.size + ' funções, todas presentes');
})();

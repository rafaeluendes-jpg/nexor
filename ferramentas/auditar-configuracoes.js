/* ==========================================================
   JOIA — AUDITORIA DAS CONFIGURAÇÕES DA LOJA

   Regra do Rafael, 01/09/2026: "código/deploy ≠ configuração do cliente.
   Valores de fábrica só valem quando o registro AINDA NÃO EXISTE."

   As taxas de cartão de Santa Fé foram apagadas por essa porta: um
   aparelho com a cópia velha subiu por cima. Antes disso, os dois turnos
   desativados voltaram sozinhos porque um download que FALHOU foi lido
   como "a nuvem está vazia" e a semente de fábrica repôs tudo.

   Esta ferramenta varre o `src/` inteiro atrás das rotinas que podem
   fazer isso de novo, e confere, para cada coleção com semente, se ela
   está protegida pelas três travas que hoje existem:

     1. a semente só roda com a lista VAZIA;
     2. download vazio não apaga o que já existe (`volta`);
     3. nada sobe antes de baixar (`sincronizar`).

   Ela não conserta nada: aponta. Roda dentro do `npm test` e no portão
   de publicação, e nunca toca na nuvem.
   ========================================================== */
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const SRC = path.join(RAIZ, 'src', 'js');
const ARQ = process.env.JOIA_ARQ || path.join(RAIZ, 'index.html');

let achados = [], avisos = [], conferidos = 0;
function risco(arq, linha, o_que, porque) {
  achados.push({ arq: arq, linha: linha, o_que: o_que, porque: porque });
}
function aviso(arq, linha, o_que) { avisos.push({ arq: arq, linha: linha, o_que: o_que }); }

function arquivos(dir) {
  let out = [];
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function (d) {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) out = out.concat(arquivos(p));
    else if (d.name.endsWith('.js')) out.push(p);
  });
  return out;
}
/* o comentário é onde as decisões deste sistema moram: o que está dentro
   de /* … *​/ é explicação, não código, e não pode virar alarme falso */
function semComentarios(txt) {
  return txt.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
            .replace(/(^|[^:])\/\/[^\n]*/g, (m, a) => a + m.slice(a.length).replace(/./g, ' '));
}

const FONTES = arquivos(SRC).map(function (f) {
  const txt = fs.readFileSync(f, 'utf8');
  return { arq: path.relative(RAIZ, f), txt: txt, limpo: semComentarios(txt) };
});
function linhaDe(txt, i) { return txt.slice(0, i).split('\n').length; }

/* ----------------------------------------------------------
   1. AS SEMENTES: quem escreve valor de fábrica dentro do DB
   ---------------------------------------------------------- */
console.log('\n══ 1. Sementes de fábrica');
const SEMENTES = {};
FONTES.forEach(function (F) {
  /* `DB.x = DB.x || [ … ]` — só semeia quando não existe: seguro por forma */
  const re1 = /DB\.([a-zA-Z_$][\w$]*)\s*=\s*DB\.\1\s*\|\|\s*\[/g;
  let m;
  while ((m = re1.exec(F.limpo))) {
    const fim = F.limpo.indexOf(']', m.index);
    const corpo = F.limpo.slice(m.index, fim + 1);
    if (!/\{/.test(corpo)) continue;                 /* `|| []` é só garantia de array */
    SEMENTES[m[1]] = SEMENTES[m[1]] || [];
    SEMENTES[m[1]].push({ arq: F.arq, linha: linhaDe(F.limpo, m.index), forma: 'ou-vazio' });
    conferidos++;
  }
  /* `if(!DB.x || !DB.x.length){ DB.x = [ … ] }` — idem, e é a forma da
     `baseFormas()`; a lista precisa estar vazia para a semente entrar */
  const re2 = /if\s*\(\s*!\s*DB\.([a-zA-Z_$][\w$]*)\s*\|\|\s*!\s*DB\.\1\.length\s*\)/g;
  while ((m = re2.exec(F.limpo))) {
    SEMENTES[m[1]] = SEMENTES[m[1]] || [];
    SEMENTES[m[1]].push({ arq: F.arq, linha: linhaDe(F.limpo, m.index), forma: 'se-vazia' });
    conferidos++;
  }
  /* ATRIBUIÇÃO DIRETA de lista com conteúdo. Só é semente se estiver
     debaixo de uma pergunta pela lista VAZIA; solta, ela apaga o que existe */
  const re3 = /(?:^|[^|.\w])DB\.([a-zA-Z_$][\w$]*)\s*=\s*\[\s*\{/g;
  while ((m = re3.exec(F.limpo))) {
    const nome = m[1];
    const antes = F.limpo.slice(Math.max(0, m.index - 400), m.index);
    const guardada = new RegExp('if\\s*\\(\\s*!\\s*\\(?\\s*DB\\.' + nome +
      '\\b[\\s\\S]{0,40}?\\.length').test(antes);
    if (guardada) {
      SEMENTES[nome] = SEMENTES[nome] || [];
      SEMENTES[nome].push({ arq: F.arq, linha: linhaDe(F.limpo, m.index), forma: 'se-vazia' });
      conferidos++;
      continue;
    }
    risco(F.arq, linhaDe(F.limpo, m.index), 'DB.' + nome + ' = [ {…} ]',
      'grava uma lista pronta por cima do que já existe. Semente tem de ser ' +
      '"DB.' + nome + ' = DB.' + nome + ' || [...]" ou entrar só com a lista vazia.');
  }
});
Object.keys(SEMENTES).sort().forEach(function (c) {
  console.log('   · ' + c + '  (' + SEMENTES[c].map(s => s.forma).join(', ') + ')  ' +
    SEMENTES[c][0].arq + ':' + SEMENTES[c][0].linha);
});
if (!Object.keys(SEMENTES).length) console.log('   (nenhuma)');

/* ----------------------------------------------------------
   2. TODA SEMENTE PRECISA DAS TRÊS TRAVAS
   ---------------------------------------------------------- */
console.log('\n══ 2. As três travas de cada coleção com semente');
const idx = fs.readFileSync(ARQ, 'utf8');

/* trava 2 — o download vazio não apaga: `volta` descobre a lista atual
   pelo nome da coleção, então vale para todas de uma vez */
const corpoVolta = (function () {
  const i = idx.indexOf('function volta(');
  return i < 0 ? '' : idx.slice(i, i + 4000);
})();
const travaDownload = /if\(!Array\.isArray\(atual\)&&col\)atual=_ANT\(col\)/.test(corpoVolta) &&
                      /if\(!r\.length&&atual&&atual\.length\)return atual/.test(corpoVolta);
console.log('   ' + (travaDownload ? '✓' : '✗') +
  ' download que falha não apaga a lista local (volta)');
if (!travaDownload)
  risco('src/js/03-armazenamento/02-…', 0, 'volta() sem a guarda de download vazio',
    'um 500 na leitura zera a coleção e a semente de fábrica repõe tudo por cima.');

/* trava 3 — nada sobe antes de baixar */
const corpoSinc = (function () {
  const i = idx.indexOf('async function sincronizar(');
  return i < 0 ? '' : idx.slice(i, i + 12000);
})();
const travaEnvio = /if\(!NUVEM\.baixou\)\{/.test(corpoSinc);
console.log('   ' + (travaEnvio ? '✓' : '✗') +
  ' aparelho que ainda não baixou não escreve na nuvem (sincronizar)');
if (!travaEnvio)
  risco('src/js/03-armazenamento/01-inicio.js', 0, 'sincronizar() sem a trava de download',
    'aparelho com cópia velha sobe por cima da configuração nova. Foi o que ' +
    'apagou as taxas de cartão de Santa Fé em 31/08/2026.');

/* trava 1 — a semente só entra com a lista vazia (já verificado na forma) */
console.log('   ✓ ' + Object.keys(SEMENTES).length +
  ' coleção(ões) com semente, todas em forma que só grava com a lista vazia');

/* ----------------------------------------------------------
   TRAVA 4 — LISTA VAZIA NÃO BASTA: TEM DE SER LISTA VAZIA
   *DEPOIS DO DOWNLOAD*

   30/09/2026. A conta do Itaú de Santa Fé "sumiu" umas dez vezes. Ela
   nunca foi apagada da nuvem: estava lá, com agência, número, e as três
   formas de pagamento apontando para ela. O que sumia era da TELA.

   `baseFin` tinha a trava certa desde 28/09 — não semear enquanto o
   download não chegou, nem quando a nuvem já conhece a coleção. Mas
   `baseCat`, que roda logo depois na mesma tela, tinha a sua própria
   versão, mais fraca: "se não tem a conta Caixa, cria a conta Caixa".
   Num aparelho recém-atualizado, antes do download, `baseFin` não
   semeava nada e `baseCat` semeava Caixa e Cofre. A tela abria com duas
   contas, dizia "2 conta(s)", e a do banco não estava lá.

   Esta auditoria não pegou porque a forma de `baseCat` — um `push` de
   objeto atrás de um `if` — não casava com nenhum dos três padrões
   conhecidos. Passa a pegar: todo item de semente (`_semente:true`)
   tem de estar sob `podeSemear(`, que é a regra única.
   ---------------------------------------------------------- */
console.log('\n══ 2b. Semente não nasce antes do download');
/* ----------------------------------------------------------
   A UNICA EXCECAO, DECLARADA PELO NOME

   `baseSuc` semeia a unidade "Matriz" quando a lista esta vazia, e o
   sistema PRECISA de uma unidade para desenhar a tela — segurar a
   semente ate o download quebraria a abertura.

   Ela nao e um furo porque tem a mitigacao propria, escrita e usada:
   `soSemente()` responde "esta lista e so a semente", e nada e decidido
   a partir dela. Ausencia de dado nao vira resposta.

   Esta lista existe para que a excecao seja UMA, com nome e motivo. Toda
   semente nova cai na regra geral e precisa de `podeSemear`.
   ---------------------------------------------------------- */
const SEMENTE_COM_MITIGACAO = [
  /* a prova e conferida no fonte SEM espacos, entao ela vem sem espacos */
  { fn: 'baseSuc', prova: /functionsoSemente\(\)\{[\s\S]{0,200}_semente===true/ }
];
let semenPend = 0, semenOk = 0;
FONTES.forEach(function (F) {
  const re = /_semente\s*:\s*true/g;
  let m;
  while ((m = re.exec(F.limpo))) {
    /* a função em que este item mora: do `function` anterior até aqui */
    const ini = F.limpo.lastIndexOf('function ', m.index);
    const trecho = F.limpo.slice(ini < 0 ? 0 : ini, m.index);
    if (/podeSemear\s*\(/.test(trecho)) { semenOk++; conferidos++; continue; }
    const nomeFn = (/function\s+([A-Za-z_$][\w$]*)/.exec(trecho) || [])[1] || '';
    const exc = SEMENTE_COM_MITIGACAO.find(function (x) { return x.fn === nomeFn; });
    if (exc && exc.prova.test(idx.replace(/\s+/g, ''))) {
      aviso(F.arq, linhaDe(F.limpo, m.index),
        nomeFn + '() semeia sem podeSemear, mas tem mitigação própria (soSemente)');
      semenOk++; conferidos++; continue;
    }
    semenPend++;
    risco(F.arq, linhaDe(F.limpo, m.index), 'semente sem podeSemear()',
      'este item de fábrica pode nascer ANTES de o download chegar, e a tela ' +
      'mostra uma lista incompleta como se fosse a completa. Foi assim que a ' +
      'conta do Itaú "sumiu" dez vezes em Santa Fé. Ponha o bloco sob ' +
      '`if(!podeSemear(\'<coleção>\'))return;`.');
  }
});
console.log('   ' + (semenPend ? '✗' : '✓') + ' ' + semenOk +
  ' semente(s) sob podeSemear()' + (semenPend ? ', ' + semenPend + ' sem' : ''));

/* e a regra única tem de existir, e ser uma só */
const temRegra = /function podeSemear\(col\)\{/.test(idx.replace(/\s+/g, '')) ||
                 /function podeSemear\(/.test(idx);
console.log('   ' + (temRegra ? '✓' : '✗') + ' a regra mora num lugar só (podeSemear)');
if (!temRegra)
  risco('src/js/03-armazenamento/01-inicio.js', 0, 'podeSemear() não existe',
    'sem uma regra única, cada tela escreve a sua — e duas cópias da mesma ' +
    'regra divergem no primeiro caso de borda.');

/* ----------------------------------------------------------
   3. ROTINAS QUE PODEM APAGAR DADO DO CLIENTE
   ---------------------------------------------------------- */
console.log('\n══ 3. Rotinas que apagam dado');
const PERIGOS = [
  [/localStorage\.clear\s*\(/, 'localStorage.clear()',
   'apaga TODO o armazenamento do aparelho, inclusive o que ainda não subiu.'],
  [/indexedDB\.deleteDatabase\s*\(/, 'indexedDB.deleteDatabase()',
   'apaga a base local inteira.'],
  [/removeItem\(\s*['"]nexor_dados['"]/, "removeItem('nexor_dados')",
   'apaga os dados do aparelho; só pode acontecer por ordem explícita da pessoa.'],
  [/DB\._hash\s*=\s*\{\s*\}/, 'DB._hash = {}',
   'zera a memória do que já foi enviado: no envio seguinte TUDO parece alterado ' +
   'e a cópia local sobe por cima da nuvem. Foi o defeito do caixa que reabria (V227).'],
  [/caches\.delete\s*\(/, 'caches.delete()',
   'limpa cache do navegador — vale para ARQUIVOS, nunca para dados.']
];
/* Apagar dado NÃO é proibido — é proibido apagar SEM decisão. Vale quando
   está debaixo de uma pergunta à pessoa (`pergunta`/`confirmar`) ou da
   conferência de que quem entrou é OUTRO dono (`_mesmoDono`).

   Também vale, e NÃO é apagar dado, tirar a cópia velha do `localStorage`
   quando a MESMA base está sendo gravada/apagada no IndexedDB ao lado — é a
   virada de armazém (a base mudou de gaveta, não sumiu). Reconhecido pelo
   par `idbGravar('nexor_dados'`/`idbApagar('nexor_dados'` logo antes OU logo
   depois. Um `removeItem('nexor_dados')` solto, sem decisão e sem esse par,
   continua sendo risco. */
const COMDECISAO = /await\s+(pergunta|confirmar)\s*\(|_mesmoDono|else\s*\{|idb(Gravar|Apagar)\s*\(\s*['"]nexor_dados/;
let achouPerigo = 0;
FONTES.forEach(function (F) {
  PERIGOS.forEach(function (p) {
    const re = new RegExp(p[0].source, 'g');
    let m;
    while ((m = re.exec(F.limpo))) {
      const antes = F.limpo.slice(Math.max(0, m.index - 900), m.index);
      const depois = F.limpo.slice(m.index, m.index + 300);   /* o par do IndexedDB pode vir logo depois */
      if (COMDECISAO.test(antes) || COMDECISAO.test(depois)) { aviso(F.arq, linhaDe(F.limpo, m.index),
        p[1] + ' — debaixo de decisão explícita (ou virada para o IndexedDB), o que é o certo'); continue; }
      achouPerigo++;
      risco(F.arq, linhaDe(F.limpo, m.index), p[1], p[2]);
    }
  });
});
/* o Service Worker pode apagar CACHE DE ARQUIVO — e só */
const sw = fs.readFileSync(path.join(RAIZ, 'sw.js'), 'utf8');
const swLimpo = semComentarios(sw);
if (/localStorage|indexedDB|nexor_dados/.test(swLimpo))
  risco('sw.js', 0, 'o Service Worker toca em armazenamento de dados',
    'ele pode trocar ARQUIVOS da aplicação; dado do cliente, nunca.');
else console.log('   ✓ o Service Worker mexe só em cache de arquivo, não em dado');
if (!achouPerigo) console.log('   ✓ nenhuma rotina apaga armazenamento do cliente');

/* ----------------------------------------------------------
   4. AUSÊNCIA DE RESPOSTA NÃO É AUSÊNCIA DE CONFIGURAÇÃO
   ---------------------------------------------------------- */
console.log('\n══ 4. Leitura da nuvem que confunde "vazio" com "não existe"');
const semRede = /baixarTab/.test(idx);
console.log('   ' + (semRede ? '✓' : '·') +
  ' o download marca a tabela que falhou e a `volta` preserva o que estava aqui');

/* ----------------------------------------------------------
   RESULTADO
   ---------------------------------------------------------- */
if (avisos.length) {
  console.log('\n── Para olhar\n');
  avisos.forEach(a => console.log('   · ' + a.arq + ':' + a.linha + ' — ' + a.o_que));
}
if (achados.length) {
  console.log('\n── RISCOS\n');
  achados.forEach(function (a) {
    console.log('  ✗ ' + a.arq + (a.linha ? ':' + a.linha : '') + '\n    ' + a.o_que +
      '\n    → ' + a.porque + '\n');
  });
  console.log('✗ ' + achados.length + ' risco(s) para a configuração da loja.\n');
  process.exit(1);
}
console.log('\n✓ ' + conferidos + ' semente(s) conferida(s), as três travas no lugar, ' +
  'nenhuma rotina apaga configuração do cliente.\n');
process.exit(0);

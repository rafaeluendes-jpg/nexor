/* ==========================================================
   JOIA — VISTORIA (análise estática do sistema inteiro)

   Rodar:  node ferramentas/vistoriar.js
   (entra no portão de publicação, antes dos testes)

   POR QUE ESTE ARQUIVO EXISTE (ordem do Rafael, 05/09/2026)

   O problema que mais machucou: consertar uma coisa e quebrar outra que
   não tinha nada a ver. Boa parte desses defeitos é de UM tipo só, e é o
   tipo que uma ferramenta pega ANTES de rodar: o código chama um nome que
   não existe — uma função renomeada, removida, ou digitada errada. Foi
   assim o "ci is not defined" (V186), o "fundoSugerido" apagado (V179), o
   "_respConfirma is not a function" (04/09).

   Nenhum teste precisa rodar a tela para achar isso: é olhar o código e
   ver que o nome chamado não está declarado em lugar NENHUM do sistema.
   É o que esta vistoria faz, com o ESLint, o mesmo que os programadores
   usam. Ela lê os 39 arquivos como um só (que é como eles rodam na loja),
   então um nome só é "inexistente" se não existir em arquivo algum.

   Vale para QUALQUER pasta — PDV, financeiro, relatórios, estoque — e
   para os outros sistemas (o app, o robô) é só rodar o mesmo comando lá.

   Reprova a publicação se achar:
     · no-undef      — chamou algo que não existe (o defeito clássico);
     · no-dupe-keys  — a mesma chave duas vezes num objeto (campo perdido);
     · no-func-assign, no-const-assign, no-dupe-args, no-unreachable,
       no-obj-calls, use-isnan, valid-typeof — erros que estouram em
       tempo de execução;
     · nome-duplicado — duas funções de topo com o MESMO nome em arquivos
       diferentes: no escopo único do sistema a segunda apaga a primeira,
       calada, e quebra quem chamava a outra. É "conserta um, quebra
       outro" nascendo — e nenhum teste pega antes de a tela usar.

   Não reprova por estilo (aspas, ponto e vírgula, indentação): isso não
   quebra a loja e só faria barulho.
   ========================================================== */
const fs = require('fs');
const path = require('path');
const { Linter } = require('eslint');

const RAIZ = path.join(__dirname, '..');
const SRC = path.join(RAIZ, 'src');

/* os mesmos arquivos JS que o montar.js junta no index.html, na ordem */
const ordem = JSON.parse(fs.readFileSync(path.join(SRC, 'ordem.json'), 'utf8'));
const arquivos = [];
ordem.forEach(it => {
  if (it.tipo === 'envolto' && it.abre === '<script>') (it.arquivos || []).forEach(a => arquivos.push(a));
});

/* concatena tudo num escopo só, guardando onde cada arquivo começa para
   traduzir a linha do erro de volta para arquivo:linha */
let codigo = '';
const mapa = [];               /* {arquivo, linhaInicio} */
const declara = {};            /* nome de função -> [{arquivo, linhaGlobal}] */
arquivos.forEach(rel => {
  const txt = fs.readFileSync(path.join(SRC, rel), 'utf8');
  const inicio = codigo.split('\n').length;
  mapa.push({ arquivo: rel, inicio: inicio });
  /* funções declaradas no topo (coluna 0): no escopo único do sistema, duas
     com o mesmo nome fazem a SEGUNDA apagar a primeira, calada, e quebrar
     quem usava a outra. É "conserta um, quebra outro" nascendo. */
  txt.split('\n').forEach((l, i) => {
    const m = l.match(/^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/);
    if (m) (declara[m[1]] = declara[m[1]] || []).push({ arquivo: rel, linhaGlobal: inicio + i });
  });
  codigo += txt + '\n';
});
function ondeFica(linhaGlobal) {
  let achado = mapa[0];
  for (const m of mapa) { if (m.inicio <= linhaGlobal) achado = m; else break; }
  return { arquivo: achado.arquivo, linha: linhaGlobal - achado.inicio + 1 };
}

/* nomes externos legítimos que não são do navegador (CDN, libs) e por isso
   não são "inexistentes" — declará-los evita alarme falso no no-undef */
const GLOBAIS_EXTERNOS = {
  supabase: 'readonly', Chart: 'readonly', JsBarcode: 'readonly',
  QRCode: 'readonly', XLSX: 'readonly', jspdf: 'readonly', html2canvas: 'readonly',
  workbox: 'readonly', idbKeyval: 'readonly', LZString: 'readonly',
  /* carregadores opcionais que as libs UMD checam com typeof (não são bugs) */
  module: 'readonly', define: 'readonly', angular: 'readonly'
};

const config = {
  env: { browser: true, es2021: true, serviceworker: true },
  parserOptions: { ecmaVersion: 2021, sourceType: 'script' },
  globals: GLOBAIS_EXTERNOS,
  rules: {
    'no-undef': 'error',
    'no-dupe-keys': 'error',
    'no-func-assign': 'error',
    'no-const-assign': 'error',
    'no-dupe-args': 'error',
    'no-unreachable': 'error',
    'no-obj-calls': 'error',
    'use-isnan': 'error',
    'valid-typeof': 'error',
    'no-unsafe-negation': 'error'
  }
};

const linter = new Linter();
const msgs = linter.verify(codigo, config);
const erros = msgs.filter(m => m.severity === 2);

/* nomes de função declarados em mais de um lugar: a segunda declaração vence
   em silêncio. Entram na mesma catraca do ESLint (só REPROVAM se forem NOVOS). */
Object.keys(declara).forEach(nome => {
  const locs = declara[nome];
  if (locs.length < 2) return;
  const primeiro = locs[0];
  locs.slice(1).forEach(loc => {
    erros.push({
      ruleId: 'nome-duplicado', line: loc.linhaGlobal, severity: 2,
      message: "a função '" + nome + "' já é declarada em " + primeiro.arquivo +
        ' — no escopo único do sistema a segunda apaga a primeira e quebra quem chama a outra'
    });
  });
});

/* ==========================================================
   TRAVA DE CATRACA (baseline)

   Introduzir uma vistoria num sistema grande e antigo trava tudo se ela
   exigir zero problema no primeiro dia — e obrigaria a mexer, de uma vez,
   em dezenas de pontos que ninguém pediu. Errado e arriscado.

   Então a regra é de CATRACA: os problemas que JÁ existiam ficam
   congelados numa lista (vistoria-baseline.json). A vistoria só REPROVA
   quando aparece um problema NOVO — exatamente o que a correção de hoje
   pode ter introduzido. O de sempre não trava a publicação, e vai sendo
   zerado quando a gente encostar naquele arquivo.

   `node ferramentas/vistoriar.js --gravar` regrava a lista congelada
   (use depois de corrigir, ou ao aceitar o estado atual de propósito). */
const chave = m => (m.ruleId || 'sintaxe') + ' | ' + ondeFica(m.line).arquivo + ' | ' + m.message;
const ARQ_BASE = path.join(__dirname, 'vistoria-baseline.json');
const atuais = erros.map(chave);

console.log('\n╔══════════════════════════════════════════════════╗');
console.log('║  JOIA · VISTORIA — o código chama só o que existe ║');
console.log('╚══════════════════════════════════════════════════╝\n');
console.log('  ' + arquivos.length + ' arquivos, ' + codigo.split('\n').length + ' linhas, lidos como um só.\n');

if (process.argv.indexOf('--gravar') >= 0) {
  fs.writeFileSync(ARQ_BASE, JSON.stringify(atuais.slice().sort(), null, 2) + '\n');
  console.log('  ✓ Lista congelada regravada: ' + atuais.length + ' problema(s) conhecido(s).\n');
  process.exit(0);
}

let base = [];
try { base = JSON.parse(fs.readFileSync(ARQ_BASE, 'utf8')); } catch (e) { base = []; }
const setBase = new Set(base);
const novos = erros.filter(m => !setBase.has(chave(m)));
const setAtuais = new Set(atuais);
const corrigidos = base.filter(k => !setAtuais.has(k));

if (corrigidos.length)
  console.log('  ✓ ' + corrigidos.length + ' problema(s) da lista antiga já sumiram — bom trabalho.\n');

if (!novos.length) {
  console.log('  ✓ Nenhum problema NOVO. ' +
    (base.length ? '(' + base.length + ' antigo(s) ainda na fila, sem travar.)' : 'Tudo limpo.') + '\n');
  process.exit(0);
}

console.log('  ✗ REPROVADO — ' + novos.length + ' problema(s) NOVO(S) que esta mudança introduziu:\n');
const porRegra = {};
novos.forEach(m => { (porRegra[m.ruleId || 'sintaxe'] = porRegra[m.ruleId || 'sintaxe'] || []).push(m); });
Object.keys(porRegra).forEach(regra => {
  console.log('  ▸ ' + regra + ':');
  porRegra[regra].forEach(m => {
    const o = ondeFica(m.line);
    console.log('      ' + o.arquivo + ':' + o.linha + '  ' + m.message);
  });
  console.log('');
});
console.log('  Corrija o que a mudança introduziu antes de publicar.\n');
process.exit(1);

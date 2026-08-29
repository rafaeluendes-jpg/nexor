/* ==========================================================
   VALIDACAO DE SINTAXE

   O index.html tem todo o JavaScript embutido. Um erro de digitacao
   em qualquer ponto derruba o sistema INTEIRO na loja — tela branca,
   sem aviso. Este teste extrai todos os blocos de codigo e pede ao
   Node para conferir a sintaxe antes de publicar.
   ========================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const alvos = [
  { arq: path.join(__dirname, '..', 'index.html'), tipo: 'html' },
];
let falhas = 0;

for (const a of alvos) {
  if (!fs.existsSync(a.arq)) { console.log('   (pulado) ' + a.arq); continue; }
  const fonte = fs.readFileSync(a.arq, 'utf8');
  const blocos = [...fonte.matchAll(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g)]
    .map(m => m[1]);
  const codigo = blocos.join('\n;\n');
  try {
    new vm.Script(codigo, { filename: path.basename(a.arq) });
    console.log('   ok    ' + path.basename(a.arq) + ' — ' + blocos.length +
      ' bloco(s), ' + codigo.split('\n').length + ' linhas');
  } catch (e) {
    console.log('   FALHA ' + path.basename(a.arq) + ' — ' + e.message);
    falhas++;
  }
}

/* ==========================================================
   FUNCAO DECLARADA DUAS VEZES (item 29 da auditoria)

   Em JavaScript a segunda declaracao vence, em silencio. Ja aconteceu
   duas vezes neste sistema: uma versao legada sobrevivia ao lado da
   nova e ganhava por acidente de ordem no arquivo.

   O caso mais recente: havia duas `salvarCardapio`. A boa — que
   esperava a nuvem confirmar antes de dizer "publicado" — era a
   primeira, e portanto NUNCA rodava.

   Esta varredura olha so as declaracoes de NIVEL DE ARQUIVO (sem
   indentacao). Funcoes internas com nome repetido sao normais e nao
   entram na conta.
   ========================================================== */
for (const a of alvos) {
  if (!fs.existsSync(a.arq)) continue;
  const fonte = fs.readFileSync(a.arq, 'utf8');
  const codigo = [...fonte.matchAll(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g)]
    .map(m => m[1]).join('\n;\n');
  const conta = {};
  for (const m of codigo.matchAll(/^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/gm)) {
    conta[m[1]] = (conta[m[1]] || 0) + 1;
  }
  const dup = Object.keys(conta).filter(k => conta[k] > 1);
  if (dup.length) {
    console.log('   FALHA ' + path.basename(a.arq) +
      ' — funcao(oes) declarada(s) mais de uma vez: ' +
      dup.map(k => k + ' (x' + conta[k] + ')').join(', '));
    falhas++;
  } else {
    console.log('   ok    nenhuma funcao de nivel de arquivo duplicada (' +
      Object.keys(conta).length + ' nomes)');
  }
}


/* ==========================================================
   FUNCAO CHAMADA QUE NAO EXISTE (regressao real da V179)

   `fundoSugerido()` foi apagada por engano num recorte de texto, e
   `abrirCaixa()` continuou chamando. O botao ABRIR FRENTE DE CAIXA
   parou de responder e a loja nao conseguia vender.

   Nenhuma verificacao anterior pegava isto: `node --check` valida
   sintaxe, e a varredura de duplicadas procura nome REPETIDO, nao nome
   que sumiu. Um ReferenceError so aparece quando alguem clica.

   Esta varredura pega antes. Ela cobre as funcoes do caminho critico —
   as que, se sumirem, param a operacao.
   ========================================================== */
const CRITICAS = [
  'abrirCaixa','_abrirCaixa','fecharCaixa','movCaixa','_movCaixa','protegido','falhouNaTela',
  'fundoSugerido','montarSnapshot','esperadoCaixa','movimentoCaixa','totalMov',
  'perguntaImprimirFechamento','imprimirFechamento','linhasFechamento',
  'perguntaImprimirAbertura','imprimirAbertura','linhasAbertura',
  'lancarFechamento','lancarTransferenciaCaixa','definirSenhaOperador',
  'moedaHTML','moedaValor','moedaSet','moedaLer','moedaFmt','arred',
  'addPag','recalcPag','finalizarVenda','travarFecharVenda','liberarFecharVenda',
  'lojaAtual','lojaAtualId','baseSuc','soSemente','unidadeDoPerfil','podeTrocarUnidade',
  'dadosDoCaixa','verCaixa','imprimirRelatorioCaixa','rodarHealthCheck','pintaHealth',
  'temSenhaCadastrada','carregarQuemTemSenha','motivoSemOperador','listaDeSenhasOk',
  'travarOperacao','liberarOperacao','operadoresPara','autorizar',
  'hashSenhaLocal','conferirSenhaLocal','tecladoTouchAbrir','tecladoTouchFechar'
];

for (const a of alvos) {
  if (!fs.existsSync(a.arq)) continue;
  const fonte = fs.readFileSync(a.arq, 'utf8');
  const codigo = [...fonte.matchAll(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g)]
    .map(m => m[1]).join('\n;\n');
  /* declarada como function, ou atribuida a uma var (o caso do alias protegido) */
  const declarada = (n) =>
    new RegExp('(?:^|\\n)\\s*(?:async\\s+)?function\\s+' + n + '\\s*\\(').test(codigo) ||
    new RegExp('(?:var|let|const)\\s+' + n + '\\s*=').test(codigo);
  const sumidas = CRITICAS.filter(n => !declarada(n));
  /* e as que sao CHAMADAS mas nunca declaradas em lugar nenhum */
  const chamadas = new Set();
  for (const m of codigo.matchAll(/\b([a-zA-Z_$][\w$]*)\s*\(/g)) chamadas.add(m[1]);
  const orfas = CRITICAS.filter(n => chamadas.has(n) && !declarada(n));

  if (sumidas.length) {
    console.log('   FALHA ' + path.basename(a.arq) +
      ' — funcao(oes) critica(s) que nao existem: ' + sumidas.join(', '));
    falhas++;
  } else {
    console.log('   ok    ' + CRITICAS.length + ' funcoes criticas presentes' +
      (orfas.length ? ' (orfas: ' + orfas.join(', ') + ')' : ''));
  }
}


/* ==========================================================
   O SERVICE WORKER TEM DE MUDAR A CADA PUBLICACAO

   O navegador so instala um service worker novo se o ARQUIVO mudar.
   Enquanto `sw.js` ficou identico entre versoes, o service worker
   antigo continuou servindo o sistema antigo do cache — e a loja
   ficou presa na V192 com a V194 publicada.

   Esta verificacao exige que a versao dentro do sw.js seja a mesma do
   index.html. Se alguem publicar sem subir as duas, a suite quebra
   antes de a loja ficar travada.
   ========================================================== */
{
  const idx = path.join(__dirname, '..', 'index.html');
  const sw  = path.join(__dirname, '..', 'sw.js');
  if (fs.existsSync(idx) && fs.existsSync(sw)) {
    const vIdx = (fs.readFileSync(idx, 'utf8').match(/var VERSAO='(V[0-9.]+)'/) || [])[1];
    const vSw  = (fs.readFileSync(sw, 'utf8').match(/VERSAO_SW\s*=\s*'(V[0-9.]+)'/) || [])[1];
    if (!vSw) {
      console.log('   FALHA sw.js nao declara VERSAO_SW — o navegador nao vai trocar o cache');
      falhas++;
    } else if (vIdx !== vSw) {
      console.log('   FALHA versao do sw.js (' + vSw + ') diferente do index.html (' + vIdx +
        ') — o aparelho ficaria preso na versao antiga');
      falhas++;
    } else {
      console.log('   ok    sw.js e index.html na mesma versao (' + vIdx + ')');
    }
  }
}

if (falhas) { console.log('\n  REPROVADO — erro de sintaxe, funcao duplicada, funcao ausente ou versao do sw.js.\n'); process.exit(1); }
console.log('\n  Sintaxe OK.\n');

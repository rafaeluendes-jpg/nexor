/* ==========================================================
   JOIA — A TELA NAO SOBE SOZINHA, EM NENHUMA CAIXA

   Queixa do Rafael: "tem muita tela que voce esta la no final, clica pra
   mexer alguma coisa, ela sobe automatico pra cima."

   O sistema ja tinha uma guarda: 333 lugares redesenham a propria tela
   depois de salvar, e em vez de tapar um a um, o sistema anota onde a
   pessoa estava e devolve a posicao quando o conteudo e refeito SEM
   trocar de tela.

   So que ela olhava DUAS caixas: `.etScroll` e `.finWrap`. Medindo tela
   a tela, VINTE E OITO rolam em outra: o cardapio em `.cardB`, a ficha
   tecnica em `.ftWrap`, a movimentacao e os insumos em `.mvWrap`, os
   lancamentos em `.lfScroll`, a conciliacao em `.cbWrap`, as notas em
   `.ntWrap`, o fluxo em `.fxWrap` e mais onze em `.ctWrap`. Nessas, o
   defeito estava inteiro.

   Agora a posicao e guardada para toda caixa que role dentro do
   #content. Estes testes provam que a devolucao acontece nas caixas que
   antes ficavam de fora, e que trocar de tela continua comecando do
   topo — que e o certo.
   ========================================================== */
process.env.TZ = 'America/Sao_Paulo';
const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs');
const path = require('path');

const ARQ = path.join(__dirname, '..', 'index.html');
let falhas = 0, testes = 0;
function grupo(n) { console.log('\n── ' + n + '\n'); }
function t(nome, ok, det) {
  testes++;
  if (ok) console.log('   ok   ' + nome);
  else { falhas++; console.log('   FALHOU  ' + nome + (det !== undefined ? '  → ' + det : '')); }
}

const esp = ms => new Promise(r => setTimeout(r, ms || 80));

(async function () {
  const vc = new VirtualConsole();
  const dom = new JSDOM(fs.readFileSync(ARQ, 'utf8'), {
    runScripts: 'dangerously', pretendToBeVisual: true,
    url: 'https://joiagest.com.br/', virtualConsole: vc,
    beforeParse(w) {
      w.fetch = () => Promise.reject(new Error('offline'));
      w.matchMedia = w.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} }));
      w.print = () => {}; w.alert = () => {}; w.confirm = () => false; w.prompt = () => null;
      w.crypto = w.crypto || {};
      if (!w.crypto.subtle) w.crypto.subtle = { digest: async () => new ArrayBuffer(32) };
    }
  });
  await new Promise(r => setTimeout(r, 900));
  const w = dom.window, doc = w.document;
  try { w.eval("SESSAO.login='admin';SESSAO.usuarioId='usr_mestre';"); } catch (e) {}
  doc.getElementById('login').style.display = 'none';
  doc.getElementById('app').classList.remove('hide');
  w.toast = () => {};

  grupo('A marca de cada caixa sobrevive ao redesenho');

  /* monta uma tela de mentira dentro do #content, com duas caixas que rolam */
  function montar() {
    doc.getElementById('content').innerHTML =
      '<div class="mvWrap"><div class="lista" id="listaA">a</div>' +
      '<div class="lbTabW">b</div></div>';
  }
  montar();
  const cxA = doc.getElementById('listaA');
  const cxB = doc.querySelector('.lbTabW');
  t('a caixa com identificador é marcada por ele',
    w.marcaDeRolagem(cxA) === '#listaA', w.marcaDeRolagem(cxA));
  t('a caixa sem identificador é marcada pela classe e posição',
    w.marcaDeRolagem(cxB) === 'div.lbTabW|0', w.marcaDeRolagem(cxB));
  const marcaB = w.marcaDeRolagem(cxB);
  montar();
  t('e a marca reencontra o elemento depois do redesenho',
    w.elementoDaMarca(marcaB) === doc.querySelector('.lbTabW'));
  t('marca de caixa que sumiu devolve nada, sem estourar',
    w.elementoDaMarca('div.naoExiste|3') === null ||
    w.elementoDaMarca('div.naoExiste|3') === undefined);

  grupo('A rolagem volta ao lugar nas caixas que ficavam de fora');

  /* cada uma destas classes é a caixa principal de telas de verdade,
     e nenhuma era coberta pela guarda antiga */
  const CAIXAS = [['mvWrap', 'movimentação, insumos, mercadoria'],
                  ['ctWrap', 'backup, CMV, diagnóstico e mais oito'],
                  ['ftWrap', 'ficha técnica'],
                  ['lfScroll', 'lançamentos financeiros'],
                  ['cbWrap', 'conciliação bancária'],
                  ['ntWrap', 'notas de entrada'],
                  ['fxWrap', 'fluxo de caixa'],
                  ['cardB', 'gestão de cardápio']];
  for (const [cls, onde] of CAIXAS) {
    w.S.mod = 'teste'; w.S.it = cls;
    w._rolChave = 'teste/' + cls;          /* já estamos nesta tela */
    doc.getElementById('content').innerHTML = '<div class="' + cls + '">x</div>';
    const cx = doc.querySelector('.' + cls);
    /* a pessoa rola até o meio da lista */
    cx.scrollTop = 350;
    cx.dispatchEvent(new w.Event('scroll', { bubbles: false }));
    /* e o clique redesenha a tela, zerando a rolagem */
    doc.getElementById('content').innerHTML = '<div class="' + cls + '">x</div>';
    const novo = doc.querySelector('.' + cls);
    novo.scrollTop = 0;
    w.devolverRolagem();
    t('.' + cls + ' devolve a posição — ' + onde, novo.scrollTop === 350, novo.scrollTop);
    /* devolverRolagem() tranca a gravacao por 60ms para nao gravar o proprio
       ajuste. Sem esperar, o caso seguinte teria a rolagem ignorada. */
    await esp(80);
  }

  grupo('E as duas que já funcionavam continuam funcionando');

  for (const cls of ['etScroll', 'finWrap']) {
    w.S.mod = 'teste'; w.S.it = cls;
    w._rolChave = 'teste/' + cls;
    doc.getElementById('content').innerHTML = '<div class="' + cls + '">x</div>';
    const cx = doc.querySelector('.' + cls);
    cx.scrollTop = 220;
    cx.dispatchEvent(new w.Event('scroll', { bubbles: false }));
    doc.getElementById('content').innerHTML = '<div class="' + cls + '">x</div>';
    const novo = doc.querySelector('.' + cls);
    w.devolverRolagem();
    t('.' + cls + ' continua devolvendo', novo.scrollTop === 220, novo.scrollTop);
    await esp(80);
  }

  grupo('Trocar de tela continua começando do topo');

  w.S.mod = 'teste'; w.S.it = 'etScroll';
  w._rolChave = 'teste/etScroll';
  doc.getElementById('content').innerHTML = '<div class="etScroll">x</div>';
  const c1 = doc.querySelector('.etScroll');
  c1.scrollTop = 500;
  c1.dispatchEvent(new w.Event('scroll', { bubbles: false }));
  /* agora a pessoa vai para OUTRA tela */
  w.S.it = 'outra';
  doc.getElementById('content').innerHTML = '<div class="etScroll">y</div>';
  const c2 = doc.querySelector('.etScroll');
  w.devolverRolagem();
  t('tela nova abre no topo, não na posição da anterior', c2.scrollTop === 0, c2.scrollTop);
  await esp(80);
  /* e voltando para a primeira, a posição dela ainda está guardada */
  w.S.it = 'etScroll'; w._rolChave = 'teste/etScroll';
  doc.getElementById('content').innerHTML = '<div class="etScroll">x</div>';
  const c3 = doc.querySelector('.etScroll');
  w.devolverRolagem();
  t('e a posição da tela anterior não se perdeu', c3.scrollTop === 500, c3.scrollTop);

  grupo('Duas caixas na mesma tela guardam posições separadas');

  w.S.mod = 'teste'; w.S.it = 'duas'; w._rolChave = 'teste/duas';
  doc.getElementById('content').innerHTML =
    '<div class="mvWrap" id="cxTopo">a</div><div class="mvWrap" id="cxBaixo">b</div>';
  const t1 = doc.getElementById('cxTopo'), t2 = doc.getElementById('cxBaixo');
  await esp(80);
  t1.scrollTop = 120; t1.dispatchEvent(new w.Event('scroll', { bubbles: false }));
  t2.scrollTop = 640; t2.dispatchEvent(new w.Event('scroll', { bubbles: false }));
  doc.getElementById('content').innerHTML =
    '<div class="mvWrap" id="cxTopo">a</div><div class="mvWrap" id="cxBaixo">b</div>';
  w.devolverRolagem();
  t('a primeira volta para a posição dela',
    doc.getElementById('cxTopo').scrollTop === 120, doc.getElementById('cxTopo').scrollTop);
  t('e a segunda para a dela',
    doc.getElementById('cxBaixo').scrollTop === 640, doc.getElementById('cxBaixo').scrollTop);

  grupo('E o sistema continua sem mandar a tela para o topo à força');

  const fonte = fs.readFileSync(ARQ, 'utf8');
  /* o comentário que EXPLICA o defeito antigo cita a chamada; comparar o
     texto cru acusaria a própria explicação */
  const semComent = fonte.replace(/\/\*[\s\S]*?\*\//g, '');
  t('nenhum scrollTo(0,0) no código',
    (semComent.match(/scrollTo\(0,\s*0\)/g) || []).length === 0,
    (semComent.match(/scrollTo\(0,\s*0\)/g) || []).length + ' ocorrência(s)');
  t('a guarda está ligada no arranque', /vigiarConteudo\(\)/.test(fonte));
  t('e observa o conteúdo, não uma tela específica',
    /_obsRol\.observe\(alvo,\{childList:true\}\)/.test(fonte));

  console.log('\n════════════════════════════════════════════════════');
  console.log('Joia · a tela não sobe sozinha');
  console.log(testes - falhas + ' de ' + testes + ' testes passaram');
  console.log('════════════════════════════════════════════════════\n');
  process.exit(falhas ? 1 : 0);
})();

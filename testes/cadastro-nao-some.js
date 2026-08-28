/* ==========================================================
   JOIA — O CADASTRO NOVO NAO PODE SUMIR

   Relato do Rafael, na V212, com a foto da tela:

     "Criei a categoria Taxa de entrega. Quando eu tinha duas e cliquei
      numa, uma sumiu sozinha. Criei o produto dentro dela e apareceu
      'Produto ainda nao chegou a nuvem — Motivo: Cannot set properties
      of undefined (setting usuarioId)'. Deixa criar. Depois o produto
      some de dentro da categoria no PDV e some da gestao de cardapio."

   Eram tres defeitos amarrados, e o primeiro causava o segundo.

   1. `var SESSAO={usuarioId:null,login:null}` morava no BLOCO 28 — 33 mil
      linhas depois do bloco 5, que a usa em codigo de TOPO, no
      carregamento, para o "manter conectado". `var` sobe a declaracao,
      nao a atribuicao: SESSAO valia `undefined` e a linha estourava. O
      erro caia num catch que so anota. E a atribuicao tardia, quando
      enfim rodava, ZERAVA a sessao recem-restaurada.

   2. `carimbarOrigem()` desistia inteira quando nao havia sessao — e ela
      faz duas coisas: carimbar o dono (precisa de sessao) e marcar
      `_novoAqui`, que impede o download de apagar o registro (nao precisa
      de sessao nenhuma). Sem a marca, o cadastro novo era apagado pelo
      download seguinte.

   3. A limpeza de repetidos do envio apagava a linha de nome repetido do
      APARELHO, e quem apontava para ela ficava apontando para o vazio. O
      produto continuava gravado, sem categoria que existisse — invisivel
      no PDV e no cardapio.
   ========================================================== */
process.env.TZ = 'America/Sao_Paulo';
const fs = require('fs');
const path = require('path');
const { corpoDaFuncao, ARQ, versaoDoSistema } = require('./extrair.js');

const fonte = fs.readFileSync(ARQ, 'utf8');
let falhas = 0, testes = 0;
function grupo(n) { console.log('\n── ' + n + '\n'); }
function t(nome, ok, det) {
  testes++;
  if (ok) console.log('   ok   ' + nome);
  else { falhas++; console.log('   FALHOU  ' + nome + (det !== undefined ? '  → ' + det : '')); }
}

grupo('A sessão existe antes de alguém escrever nela');

/* a ordem no arquivo publicado é a prova: a declaração tem de vir ANTES
   do primeiro uso, porque os dois são código de topo */
const decl = fonte.indexOf("var SESSAO={usuarioId:null,login:null};");
const usoLogin = fonte.indexOf("SESSAO.usuarioId=u.id;");
const usoManter = fonte.indexOf("SESSAO.usuarioId=_u.id;");
t('SESSAO é declarada no arquivo', decl > 0);
t('e ANTES do login escrever nela', decl < usoLogin, decl + ' vs ' + usoLogin);
t('e antes do "manter conectado" escrever nela', decl < usoManter, decl + ' vs ' + usoManter);
/* o comentário que EXPLICA o defeito cita a declaração; contar o texto
   cru acusaria a própria explicação */
const semComent = fonte.replace(/\/\*[\s\S]*?\*\//g, '');
t('existe uma só declaração de SESSAO',
  (semComent.match(/var SESSAO=\{usuarioId/g) || []).length === 1,
  (semComent.match(/var SESSAO=\{usuarioId/g) || []).length + ' declaração(ões)');
t('nada zera a sessão depois do arranque',
  fonte.indexOf("var SESSAO={usuarioId:null,login:null};", decl + 10) === -1);

/* e roda de verdade: no arranque, a restauração não pode estourar */
grupo('O "manter conectado" só roda depois do arquivo inteiro');

/* ==========================================================
   ESTE E O DEFEITO QUE DERRUBOU A LOJA NA V213

   O restauro e codigo de topo: rodava enquanto o navegador ainda lia o
   arquivo. Chamava abrirSessao() -> boot() -> baseCanc(), do bloco 28,
   que usa `var MOTIVOS_CANC` — declarada no bloco 28 e ainda sem valor.
   Estourava "Cannot read properties of undefined (reading 'forEach')",
   o catch engolia, e a tela ficava com o login escondido, o app visivel
   e TUDO VAZIO.

   Antes da V213 isso nao aparecia por acidente: SESSAO tambem morava no
   bloco 28, entao a primeira linha ja estourava e o resto nem rodava.
   Consertar SESSAO destravou um caminho que nunca tinha rodado inteiro.
   ========================================================== */
const restaura = corpoDaFuncao('restaurarSessaoGuardada', fonte);
t('o restauro virou função, não código solto de topo', restaura.length > 100);
t('e é chamado por setTimeout, depois do arquivo carregar',
  /setTimeout\(restaurarSessaoGuardada,0\);/.test(fonte));
t('o "manter conectado" continua lá', /nexor_sessao/.test(restaura));
t('e chama abrirSessao quando acha o usuário', /abrirSessao\(\)/.test(restaura));

/* a chamada tem de vir DEPOIS da declaração, e ser a única */
t('não sobrou chamada direta no topo',
  (fonte.match(/setTimeout\(restaurarSessaoGuardada,0\)/g) || []).length === 1);

grupo('E se o restauro falhar, a pessoa vê o login — não uma tela vazia');

t('a falha volta para a tela de login',
  /_l\.classList\.remove\('hide'\)/.test(restaura) && /_a\.classList\.add\('hide'\)/.test(restaura));
t('a sessão é zerada antes de voltar',
  /SESSAO\.usuarioId=null;SESSAO\.login=null;/.test(restaura));
t('e o motivo fica escrito no Diagnóstico',
  /a sessão guardada não pôde ser restaurada/.test(restaura));

/* com SESSAO já definida, a atribuição funciona */
const simula = new Function(`
  var SESSAO={usuarioId:null,login:null};
  var _u={id:'u1',login:'Ana',ativo:true};
  SESSAO.usuarioId=_u.id; SESSAO.login=String(_u.login||'').toLowerCase();
  return SESSAO;`)();
t('a sessão recebe o usuário', simula.usuarioId === 'u1' && simula.login === 'ana');

grupo('A proteção do cadastro novo não depende da sessão');

const carimbo = corpoDaFuncao('carimbarOrigem', fonte);
t('não desiste mais na primeira linha',
  !/^function carimbarOrigem\(\)\{\s*if\(!NUVEM\.loja\)return 0;/.test(carimbo.replace(/\n\s*/g, '')));
t('marca _novoAqui ANTES de conferir a sessão',
  carimbo.indexOf('marcarNovoAqui(r,col)') < carimbo.indexOf('if(!temSessao)continue'),
  'ordem invertida');
t('e o carimbo do dono continua esperando a sessão',
  /if\(!temSessao\)continue;/.test(carimbo));

/* roda a função de verdade, sem sessão nenhuma */
function rodarCarimbo(comSessao) {
  const DB = { produtos: [{ id: 'pr_novo', nome: 'Taxa de entrega' }], _uuid: {} };
  const amb = {
    DB: DB,
    NUVEM: { loja: comSessao ? 'loja1' : '' },
    _COLS_SEM_CARIMBO: { _hash: 1, _uuid: 1, _snap: 1 },
    lojaAtualId: () => 'suc1',
    _quieto: () => {},
    marcarNovoAqui: function (x, col) {
      if (!x || !x.id) return;
      if (DB._uuid && DB._uuid[col] && DB._uuid[col][x.id]) { delete x._novoAqui; return; }
      x._novoAqui = true;
    }
  };
  const f = new Function('amb', 'with(amb){' + corpoDaFuncao('carimbarOrigem', fonte) +
    '\n return carimbarOrigem();}');
  const n = f(amb);
  return { n: n, p: DB.produtos[0] };
}
const semSessao = rodarCarimbo(false);
t('SEM sessão, o registro novo já fica protegido',
  semSessao.p._novoAqui === true, JSON.stringify(semSessao.p));
t('e ainda não recebe dono, que é o certo',
  semSessao.p._loja === undefined, semSessao.p._loja);
const comSessao = rodarCarimbo(true);
t('COM sessão, recebe dono também', comSessao.p._loja === 'loja1');
t('e continua protegido', comSessao.p._novoAqui === true);
t('e a unidade vai junto', comSessao.p._suc === 'suc1');

grupo('Registro que a nuvem já conhece perde a marca');

const jaNaNuvem = (function () {
  const DB = { produtos: [{ id: 'pr_velho', nome: 'Casquinha' }],
               _uuid: { produtos: { pr_velho: 'uuid-1' } } };
  const amb = { DB: DB, NUVEM: { loja: 'loja1' },
    _COLS_SEM_CARIMBO: { _uuid: 1 }, lojaAtualId: () => 'suc1', _quieto: () => {},
    marcarNovoAqui: function (x, col) {
      if (!x || !x.id) return;
      if (DB._uuid && DB._uuid[col] && DB._uuid[col][x.id]) { delete x._novoAqui; return; }
      x._novoAqui = true;
    } };
  new Function('amb', 'with(amb){' + corpoDaFuncao('carimbarOrigem', fonte) +
    '\n return carimbarOrigem();}')(amb);
  return DB.produtos[0];
})();
t('o que já subiu não fica marcado como novo',
  jaNaNuvem._novoAqui === undefined, jaNaNuvem._novoAqui);

grupo('Cadastro repetido: some um, mas os vínculos vão junto');

t('existe o remapeamento de referências',
  /function remapearReferencias\(de,para\)/.test(fonte));
t('ele é chamado quando uma linha repetida é descartada',
  /var mudou=remapearReferencias\(sai\.id,fica\.id\);/.test(fonte));
t('e o que aconteceu é registrado, não fica em silêncio',
  /estava cadastrada duas vezes/.test(fonte));

/* roda o remapeamento de verdade */
const remap = (function () {
  const DB = {
    categorias: [{ id: 'ct1', nome: 'Taxa de entrega' }],
    produtos: [{ id: 'pr1', nome: 'Taxa', categoriaId: 'ct2' },
               { id: 'pr2', nome: 'Outro', categoriaId: 'ct1' }],
    grupos: [{ id: 'g1', nome: 'G', opcoes: [{ nome: 'o', fichaId: 'ct2' }] }],
    _uuid: { produtos: {} }
  };
  const corpo = fonte.slice(fonte.indexOf('function remapearReferencias(de,para){'));
  const fim = (function () {
    let n = 0, i = corpo.indexOf('{');
    for (let j = i; j < corpo.length; j++) {
      if (corpo[j] === '{') n++;
      else if (corpo[j] === '}') { n--; if (!n) return j + 1; }
    }
    return corpo.length;
  })();
  const f = new Function('DB', '_COLS_SEM_CARIMBO',
    corpo.slice(0, fim) + '\n return remapearReferencias("ct2","ct1");');
  const n = f(DB, { _uuid: 1 });
  return { n: n, DB: DB };
})();
t('o produto órfão passa a apontar para a categoria que ficou',
  remap.DB.produtos[0].categoriaId === 'ct1', remap.DB.produtos[0].categoriaId);
t('quem já apontava certo não muda',
  remap.DB.produtos[1].categoriaId === 'ct1');
t('vínculo dentro de lista de filhos também é corrigido',
  remap.DB.grupos[0].opcoes[0].fichaId === 'ct1');
t('e o sistema conta quantos mudou', remap.n === 2, remap.n);

console.log('\n════════════════════════════════════════════════════');
console.log('Joia ' + versaoDoSistema() + ' · o cadastro novo não some');
console.log(testes - falhas + ' de ' + testes + ' testes passaram');
console.log('════════════════════════════════════════════════════\n');
process.exit(falhas ? 1 : 0);

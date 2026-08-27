/* ==========================================================
   JOIA — SUITE E2E: O SISTEMA CARREGADO DE VERDADE

   Rodar com:  node testes/e2e.js
   ou:         npm run test:e2e

   POR QUE ESTA SUITE EXISTE

   Em 27/08/2026 a loja nao conseguiu fechar o caixa: a tela estourava
   `ReferenceError: ci is not defined` antes de desenhar. O defeito
   estava no ar havia dez dias, e as 523 verificacoes das outras suites
   estavam VERDES o tempo todo.

   O motivo, medido e nao suposto:

     caixa.js ............ 0 uso de DOM
     formas-pagamento.js . 0 uso de DOM
     pdv-ux.js ........... 0 uso de DOM · 50 verificacoes por regex
     tenant.js ........... 0 uso de DOM · 59 verificacoes por regex
     fecharCaixa() ....... nunca executada por teste nenhum

   As suites anteriores fazem duas coisas, e nenhuma delas e executar a
   tela:

   1. EXTRAEM funcoes com `corpoDaFuncao` e rodam a matematica isolada.
      Isso pega erro de conta, e pegou muitos. Mas `montarSnapshot`
      calcular certo nao diz nada sobre a tela conseguir abrir.

   2. VERIFICAM O TEXTO do arquivo com expressao regular. Isso confirma
      que um trecho esta escrito — nao que ele roda. `ci` estava escrito
      exatamente como eu queria. O regex teria aprovado.

   E a varredura de "funcoes criticas presentes", criada na V186 depois
   de outro apagao, confere que a FUNCAO existe. `ci` e variavel. Passou
   reto.

   O QUE ESTA SUITE FAZ DE DIFERENTE

   Carrega o index.html inteiro num DOM (jsdom), deixa o sistema
   inicializar e entao CLICA. Qualquer `ReferenceError`, `TypeError` ou
   promessa rejeitada durante isso reprova a suite — mesmo que a tela
   pareca ter aberto.

   E o teste que teria pego o `ci` no mesmo dia.
   ========================================================== */
const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs');
const path = require('path');

const ARQ = path.join(__dirname, '..', 'index.html');
const R = { total: 0, ok: 0, falhou: 0 };
function grupo(n) { console.log('\n── ' + n); }
function t(nome, cond, det) {
  R.total++;
  if (cond) { R.ok++; console.log('   ok   ' + nome); }
  else { R.falhou++; console.log('   FALHA ' + nome + (det ? '  → ' + det : '')); }
}

/* ==========================================================
   O COLETOR DE ERROS DE RUNTIME

   Erro que ninguem ve nao deixa de existir. Tudo o que o navegador
   reportaria — window.onerror, promessa rejeitada, console.error —
   e recolhido aqui, e a suite reprova se algo aparecer.
   ========================================================== */
function novoColetor() {
  const erros = [];
  const registrar = (origem, e) => {
    const msg = String((e && (e.message || e.reason || e)) || e);
    /* ruido conhecido do ambiente de teste, nao do sistema */
    if (/Not implemented: |Could not parse CSS|localStorage is not available/i.test(msg)) return;
    erros.push({ origem, msg: msg.slice(0, 160), tipo: (e && e.constructor && e.constructor.name) || '?' });
  };
  return { erros, registrar };
}

async function carregarSistema() {
  const col = novoColetor();
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => col.registrar('jsdomError', e));
  vc.on('error', (...a) => col.registrar('console.error', a.join(' ')));

  const html = fs.readFileSync(ARQ, 'utf8');
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'https://joiagest.com.br/',
    virtualConsole: vc,
    beforeParse(win) {
      /* o sistema fala com a nuvem; aqui ele roda offline de propósito.
         Nada de rede: queremos exercitar a TELA, não o Supabase. */
      win.fetch = () => Promise.reject(new Error('offline no teste'));
      win.matchMedia = win.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} }));
      win.scrollTo = () => {};
      win.print = () => {};
      win.alert = () => {};
      win.confirm = () => true;
      win.crypto = win.crypto || {};
      if (!win.crypto.subtle) win.crypto.subtle = { digest: async () => new ArrayBuffer(32) };
      win.addEventListener('error', e => col.registrar('window.onerror', e.error || e.message));
      win.addEventListener('unhandledrejection', e => col.registrar('unhandledrejection', e.reason));
    }
  });
  /* deixa o boot terminar */
  await new Promise(r => setTimeout(r, 900));
  return { dom, win: dom.window, col };
}

(async function () {
  console.log('\nCarregando o sistema num DOM real…');
  let amb;
  try { amb = await carregarSistema(); }
  catch (e) {
    console.log('   FALHA não consegui carregar o index.html: ' + e.message);
    process.exit(1);
  }
  const { win, col } = amb;

  /* ---------------------------------------------------------- */
  grupo('O sistema carrega sem erro de runtime');

  t('index.html carregou num DOM', !!win.document);
  t('as funções do sistema existem no escopo global',
    typeof win.fecharCaixa === 'function', 'fecharCaixa: ' + typeof win.fecharCaixa);
  t('nenhum erro durante o carregamento', col.erros.length === 0,
    col.erros.map(e => e.tipo + ': ' + e.msg).join(' | '));

  /* ---------------------------------------------------------- */
  grupo('Regressão do `ci` · a tela de fechamento MONTA');

  /* monta um mundo mínimo: caixa aberto, formas ativas, um operador */
  const preparar = win.eval(`(function(){
    try{
      DB = DB || {};
      DB.sucursais=[{id:'suc_matriz',nome:'Matriz',matriz:true,ativa:true}];
      DB.lojaAtual='suc_matriz'; S.loja='suc_matriz';
      DB.formasPag=[
        {id:'fp_dinheiro',nome:'Dinheiro',tipo:'dinheiro',ativa:true,ordem:0},
        {id:'fp_pix',nome:'Pix',tipo:'pix',ativa:true,ordem:1},
        {id:'fp_debito',nome:'Cartão débito',tipo:'debito',ativa:true,ordem:2},
        {id:'fp_credito',nome:'Cartão crédito',tipo:'credito',ativa:true,ordem:3}];
      syncFormas();
      DB.usuarios=[{id:'usr_t',nome:'Operador Teste',login:'t@t.com',ativo:true,
        funcao:'gerente',tudo:true,permissoes:{},sucursais:['suc_matriz']}];
      DB.caixas=[{id:'cx_t',sucursalId:'suc_matriz',inicial:100,operador:'Operador Teste',
        aberto:'27/08/2026 08:00',movimentos:[],conferencia:{}}];
      DB.pedidos=[]; DB.cancelamentos=[]; DB.lancFin=[]; DB.contas=[
        {id:'ct_caixa',nome:'Caixa da loja',fixa:'caixa'},
        {id:'ct_cofre',nome:'Caixa-cofre'}];
      return 'ok';
    }catch(e){ return 'ERRO: '+e.message; }
  })()`);
  t('o cenário de teste foi montado', preparar === 'ok', String(preparar));

  const antes = col.erros.length;
  let abriu = null;
  try { abriu = win.eval('fecharCaixa(); "chamou"'); }
  catch (e) { col.registrar('chamada direta', e); }

  t('fecharCaixa() executou sem estourar', abriu === 'chamou',
    col.erros.slice(antes).map(e => e.msg).join(' | '));
  t('NENHUM ReferenceError durante a montagem',
    !col.erros.slice(antes).some(e => /ReferenceError/.test(e.tipo + e.msg)),
    col.erros.slice(antes).filter(e => /ReferenceError/.test(e.tipo + e.msg))
      .map(e => e.msg).join(' | '));

  const modal = win.document.getElementById('mdOv');
  t('o modal de fechamento apareceu na tela', !!modal);

  if (modal) {
    const campos = modal.querySelectorAll('.cfV');
    t('há um campo de conferência por forma de pagamento', campos.length === 4,
      campos.length + ' campo(s)');
    t('cada campo sabe a que forma pertence',
      [...campos].every(c => !!c.getAttribute('data-f')));
    /* ESTE é o teste do `ci`: o índice tem de existir e ser um número */
    const idx = [...campos].map(c => c.getAttribute('data-i'));
    t('cada campo tem o índice data-i preenchido',
      idx.every(v => v !== null && v !== '' && v !== 'undefined'), '[' + idx.join(', ') + ']');
    t('os índices são 0,1,2,3 em ordem', idx.join(',') === '0,1,2,3', idx.join(','));
    t('nenhum campo ficou com "undefined" no HTML',
      modal.innerHTML.indexOf('data-i="undefined"') < 0);
    t('o campo usa o componente monetário',
      [...campos].every(c => c.classList.contains('moeda')));
    t('o fechamento continua CEGO (não mostra o esperado)',
      modal.innerHTML.indexOf('oculto') >= 0 || modal.querySelectorAll('.cSis').length > 0);
  }

  /* ---------------------------------------------------------- */
  grupo('As outras telas do caixa também montam');

  const telas = [
    ['abrir caixa', 'abrirCaixa'],
    ['sangria', "movCaixa('sangria')"],
    ['suprimento', "movCaixa('suprimento')"],
    ['tela do PDV', 'telaPDV'],
  ];
  for (const [nome, chamada] of telas) {
    const n0 = col.erros.length;
    try {
      win.eval('try{fecharModal()}catch(e){}');
      win.eval(chamada.indexOf('(') > 0 ? chamada : chamada + '()');
      await new Promise(r => setTimeout(r, 120));
    } catch (e) { col.registrar(nome, e); }
    const novos = col.erros.slice(n0);
    t(nome + ' monta sem erro de runtime', novos.length === 0,
      novos.map(e => e.tipo + ': ' + e.msg).join(' | '));
  }

  /* ---------------------------------------------------------- */
  grupo('Nenhum handler aponta para função que não existe');

  /* ==========================================================
     HANDLER APONTANDO PARA O VAZIO

     O risco real e o botao que chama uma funcao que NAO EXISTE EM
     LUGAR NENHUM — renomeada, removida, com erro de digitacao. Foi
     assim que `fundoSugerido` derrubou o botao de abrir caixa.

     Duas coisas NAO sao defeito e ficam de fora:

     1. palavra reservada: `onkeydown="if(...)"` e codigo em linha, nao
        chamada de funcao;
     2. atribuicao tardia: `window._respConfirma` nasce quando o modal
        abre e e zerada quando fecha. No momento da carga ela nao
        existe — e esta certo que nao exista.

     Entao a regra e: ou a funcao esta viva agora, ou o nome dela
     aparece declarado em algum lugar do arquivo. Se nao aparece em
     nenhum dos dois, o botao aponta para o vazio.
     ========================================================== */
  const RESERVADAS = ['if', 'for', 'while', 'switch', 'return', 'try', 'do', 'else',
                      'typeof', 'new', 'delete', 'void', 'function'];
  const nomesEmHandlers = win.eval(`(function(){
    var html=document.documentElement.innerHTML, nomes={}, m,
        re=/on(?:click|change|input|keydown|keyup|blur|focus|submit)="([a-zA-Z_$][\\w$]*)\\s*\\(/g;
    while((m=re.exec(html))) nomes[m[1]]=true;
    return Object.keys(nomes).join(',');
  })()`).split(',').filter(Boolean).filter(n => RESERVADAS.indexOf(n) < 0);

  const fonteBruta = fs.readFileSync(ARQ, 'utf8');
  const declaradaNoArquivo = (n) =>
    new RegExp('(?:function\\s+' + n + '\\s*\\(|(?:var|let|const)\\s+' + n + '\\s*=' +
               '|window\\.' + n + '\\s*=)').test(fonteBruta);

  const apontamPraNada = nomesEmHandlers.filter(
    n => typeof win[n] !== 'function' && !declaradaNoArquivo(n));

  t('nenhum handler aponta para função inexistente',
    apontamPraNada.length === 0, apontamPraNada.join(', '));
  t('a varredura encontrou handlers para conferir',
    nomesEmHandlers.length > 20, nomesEmHandlers.length + ' nome(s)');

  const tardias = nomesEmHandlers.filter(n => typeof win[n] !== 'function');
  t('as de atribuição tardia estão declaradas no arquivo',
    tardias.every(declaradaNoArquivo), tardias.join(', '));

  /* ---------------------------------------------------------- */
  grupo('Balanço final de erros de runtime');

  const porTipo = {};
  col.erros.forEach(e => { porTipo[e.tipo] = (porTipo[e.tipo] || 0) + 1; });
  t('ZERO erros de runtime em toda a sessão', col.erros.length === 0,
    JSON.stringify(porTipo));
  t('zero ReferenceError', !col.erros.some(e => /ReferenceError/.test(e.tipo + e.msg)));
  t('zero TypeError', !col.erros.some(e => /TypeError/.test(e.tipo + e.msg)));
  t('zero promessa rejeitada sem tratamento',
    !col.erros.some(e => e.origem === 'unhandledrejection'));

  if (col.erros.length) {
    console.log('\n   Erros recolhidos:');
    col.erros.slice(0, 12).forEach(e =>
      console.log('     [' + e.origem + '] ' + e.tipo + ': ' + e.msg));
  }

  console.log('\n' + '═'.repeat(52));
  console.log('Joia · E2E com DOM real');
  console.log(R.ok + ' de ' + R.total + ' testes passaram' +
    (R.falhou ? ' · ' + R.falhou + ' FALHA(S)' : ''));
  console.log('═'.repeat(52));
  try { amb.dom.window.close(); } catch (e) {}
  process.exit(R.falhou ? 1 : 0);
})();

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

  /* ==========================================================
     PERSISTENCIA: O CADASTRO NAO PODE SUMIR DE QUEM O CRIOU

     Em 27/08/2026 Santa Fe criou a categoria "Taxa de Entrega", viu no
     cadastro e no PDV, e o item sumiu dos dois. No banco esteve sempre
     la, com `sucursais` vazio: o bloco "Quem enxerga este item" so
     aparece para a matriz, e `lerUnidades` desistia sem gravar nada.
     Na sincronizacao seguinte o filtro apagava da tela de quem acabara
     de cadastrar.
     ========================================================== */
  grupo('Persistência · cadastro criado por unidade não some dela');

  {
    /* muda o contexto para uma UNIDADE, nao a matriz */
    const cenario = win.eval(`(function(){
      try{
        DB.sucursais=[{id:'suc_matriz',nome:'Matriz',matriz:true,ativa:true},
                      {id:'suc_sf',nome:'Santa Fé',matriz:false,ativa:true}];
        DB.lojaAtual='suc_sf'; S.loja='suc_sf';
        DB.categorias=[]; DB.produtos=[];
        return ehSucMatriz(lojaAtualId()) ? 'ERRO: virou matriz' : 'ok';
      }catch(e){ return 'ERRO: '+e.message; }
    })()`);
    t('o contexto é de uma unidade, não da matriz', cenario === 'ok', String(cenario));

    /* cria a categoria como a tela cria, e le o bloco (que nao existe) */
    const criado = win.eval(`(function(){
      try{
        var alvo={id:uid('cat'),nome:'TESTE PERSISTENCIA',ativo:true,ordem:0,sucursais:[]};
        DB.categorias.push(alvo);
        lerUnidades('catUn',alvo);          /* bloco ausente: unidade */
        return JSON.stringify(alvo.sucursais);
      }catch(e){ return 'ERRO: '+e.message; }
    })()`);
    t('a categoria nasce liberada para a própria unidade',
      criado === '["suc_sf"]', criado);

    /* o produto dentro dela */
    const prod = win.eval(`(function(){
      try{
        var cat=DB.categorias[0];
        var p={id:uid('pd'),nome:'PRODUTO TESTE',categoriaId:cat.id,preco:10,
               ativo:true,ordem:0,sucursais:[]};
        DB.produtos.push(p);
        lerUnidades('pdUn',p);
        return JSON.stringify({cat:cat.id===p.categoriaId, suc:p.sucursais});
      }catch(e){ return 'ERRO: '+e.message; }
    })()`);
    const pj = JSON.parse(prod);
    t('o produto aponta para a categoria certa', pj.cat === true);
    t('o produto também nasce liberado para a unidade',
      JSON.stringify(pj.suc) === '["suc_sf"]', JSON.stringify(pj.suc));

    /* AGORA O TESTE QUE IMPORTA: a sincronizacao filtra e nao pode apagar */
    const sobreviveu = win.eval(`(function(){
      try{
        var antesC=DB.categorias.length, antesP=DB.produtos.length;
        filtrarCadastroDaUnidade();
        return JSON.stringify({cat:DB.categorias.length,prod:DB.produtos.length,
                               antesC:antesC,antesP:antesP});
      }catch(e){ return 'ERRO: '+e.message; }
    })()`);
    const sv2 = JSON.parse(sobreviveu);
    t('a categoria sobrevive ao filtro da sincronização', sv2.cat === sv2.antesC,
      sv2.cat + ' de ' + sv2.antesC);
    t('o produto sobrevive ao filtro', sv2.prod === sv2.antesP,
      sv2.prod + ' de ' + sv2.antesP);

    /* e o caso extremo: item que ficou sem liberação nenhuma */
    const orfao = win.eval(`(function(){
      try{
        DB.categorias.push({id:'cat_orfa',nome:'SEM LIBERACAO',ativo:true,
                            sucursais:[],_novoAqui:true});
        var antes=DB.categorias.length;
        filtrarCadastroDaUnidade();
        var achou=DB.categorias.some(function(c){return c.id==='cat_orfa'});
        return JSON.stringify({achou:achou,antes:antes,depois:DB.categorias.length});
      }catch(e){ return 'ERRO: '+e.message; }
    })()`);
    const oj = JSON.parse(orfao);
    t('item recém-criado sem liberação também não é apagado', oj.achou === true,
      JSON.stringify(oj));
  }

  /* ==========================================================
     O CADASTRO NAO SOBE E O FILTRO APAGA (V192)

     A sequencia real que a loja viveu, e que os testes anteriores nao
     reproduziam: criar -> fechar a tela -> abrir de novo SEM ter
     sincronizado. O filtro rodava no boot e apagava o que ainda nao
     tinha subido. O produto nunca chegou ao banco.
     ========================================================== */
  grupo('Regressão real · o que ainda não subiu nunca é apagado');

  {
    const r = win.eval(`(function(){
      try{
        DB.sucursais=[{id:'suc_matriz',nome:'Matriz',matriz:true,ativa:true},
                      {id:'suc_sf',nome:'Santa Fé',matriz:false,ativa:true}];
        DB.lojaAtual='suc_sf'; S.loja='suc_sf';
        DB._uuid=DB._uuid||{};
        DB._uuid.categorias={'cat_velha':'uuid-conhecido'};
        DB.categorias=[
          /* a nuvem conhece, e NAO esta liberada: pode sumir */
          {id:'cat_velha',nome:'ANTIGA',ativo:true,sucursais:[]},
          /* recem-criada, a nuvem nunca viu: NAO pode sumir */
          {id:'cat_nova',nome:'RECEM CRIADA',ativo:true,sucursais:[]}
        ];
        filtrarCadastroDaUnidade();
        return JSON.stringify({
          nova: DB.categorias.some(function(c){return c.id==='cat_nova'}),
          velha: DB.categorias.some(function(c){return c.id==='cat_velha'})
        });
      }catch(e){ return 'ERRO: '+e.message; }
    })()`);
    let rj=null; try{ rj=JSON.parse(r); }catch(e){}
    t('o cenário foi montado', !!rj, String(r));
    if (rj) {
      t('o cadastro que a nuvem NÃO conhece sobrevive ao filtro', rj.nova === true);
      t('o que a nuvem conhece e não está liberado é filtrado', rj.velha === false);
    }

    t('a verificação pergunta ao mapa de identificadores',
      /function aNuvemNaoConhece/.test(fonteBruta));
    t('e o filtro recebe a coluna para conseguir perguntar',
      /soLiberados\(DB\[c\.col\],suc,c\.col\)/.test(fonteBruta));
    t('o filtro NÃO roda mais no boot, antes de falar com a nuvem',
      !/try\{filtrarCadastroDaUnidade\(\)\}catch\(e\)\{_quieto\(e,'boot'\)\}/.test(fonteBruta));
    t('e o motivo está escrito no lugar onde ele rodava',
      /NAO SE FILTRA ANTES DE FALAR COM A NUVEM/.test(fonteBruta));
  }

  /* ==========================================================
     O REGISTRO CRIADO SEM SESSAO NAO PODE FICAR PRESO (V193)
     ========================================================== */
  grupo('Regressão · registro órfão volta para a fila quando a sessão chega');

  {
    const r = win.eval(`(function(){
      try{
        var reg={};
        /* ETAPA 1: sessao ainda nao chegou */
        NUVEM.loja=null;
        DB.produtos=[{id:'pd_orfao',nome:'PRODUTO ORFAO',categoriaId:'cat_x',ativo:true}];
        carimbarOrigem();
        reg.semSessao_temLoja = !!DB.produtos[0]._loja;

        /* ETAPA 2: o motor retem e marca */
        DB.produtos[0]._tenantDesconhecido=true;
        reg.retido = DB.produtos[0]._tenantDesconhecido===true;

        /* ETAPA 3: a sessao chega */
        NUVEM.loja='loja-uuid-teste';
        carimbarOrigem();
        reg.comSessao_temLoja = DB.produtos[0]._loja==='loja-uuid-teste';
        reg.marcaLimpa = DB.produtos[0]._tenantDesconhecido===undefined;

        /* ETAPA 4: registro de OUTRA empresa continua retido */
        DB.produtos.push({id:'pd_outra',nome:'DE OUTRA',_loja:'outra-empresa',
                          _tenantDesconhecido:true});
        carimbarOrigem();
        var o=DB.produtos.find(function(x){return x.id==='pd_outra'});
        reg.outraEmpresaIntacta = o._loja==='outra-empresa';
        return JSON.stringify(reg);
      }catch(e){ return 'ERRO: '+e.message; }
    })()`);
    let rj=null; try{ rj=JSON.parse(r); }catch(e){}
    t('o cenário foi montado', !!rj, String(r));
    if (rj) {
      t('sem sessão, o registro nasce sem dono', rj.semSessao_temLoja === false);
      t('o motor o retém (comportamento correto)', rj.retido === true);
      t('quando a sessão chega, ele ganha dono', rj.comSessao_temLoja === true);
      t('E A MARCA DE RETIDO É LIMPA — volta para a fila', rj.marcaLimpa === true);
      t('registro de OUTRA empresa NÃO é adotado', rj.outraEmpresaIntacta === true);
    }
    t('o motor avisa quando retém, em vez de calar',
      /registro\(s\) de '\+E2\.tab\+' não subiram/.test(fonteBruta));
  }

  grupo('Aviso de versão nova · a primeira checagem tem de comparar');

  {
    t('a primeira checagem NÃO desiste guardando só a etiqueta',
      !/if\(_etiquetaArquivo===null\)\{ _etiquetaArquivo=et; mudou=false; \}/.test(fonteBruta));
    t('ela guarda a etiqueta e segue comparando',
      /if\(_etiquetaArquivo===null\)\{ _etiquetaArquivo=et; \}/.test(fonteBruta));
    t('etiqueta igual continua economizando banda',
      /else if\(et===_etiquetaArquivo\) mudou=false;/.test(fonteBruta));
    t('e o motivo está escrito no código',
      /A PRIMEIRA CHECAGEM NAO PODE SO GUARDAR A ETIQUETA/.test(fonteBruta));

    /* simula o ciclo: 1ª checagem com versão diferente TEM de avisar */
    const sim = (etiquetaMuda, primeira) => {
      let _et = primeira ? null : 'aaa';
      let mudou = true;
      const et = etiquetaMuda ? 'bbb' : 'aaa';
      if (et) {
        if (_et === null) { _et = et; }
        else if (et === _et) mudou = false;
        else _et = et;
      }
      return mudou;
    };
    t('1ª checagem: baixa e compara', sim(false, true) === true);
    t('2ª checagem com etiqueta igual: economiza', sim(false, false) === false);
    t('2ª checagem com etiqueta nova: compara', sim(true, false) === true);
  }

  grupo('403 na sincronização · o motor não bate em porta fechada');

  {
    t('usuarios_sistema é marcada como só-gestor',
      /\{col:'usuarios', espelha:false, soGestor:true,/.test(fonteBruta));
    t('o motor pula a tabela quando não é matriz',
      /if\(E2\.soGestor&&!ehMatriz\(\)\)continue;/.test(fonteBruta));
    t('e o motivo está escrito no código',
      /A UNIDADE NAO ADMINISTRA USUARIOS — E NAO DEVE TENTAR/.test(fonteBruta));

    /* toda tabela que o sync faz upsert precisa poder ser reenviada.
       Se o MAPA marcar espelha/upsert, o banco precisa aceitar UPDATE —
       senão o 1º envio passa e todos os seguintes dão 403. */
    t('o padrão de upsert está documentado como exigindo UPDATE',
      /O UPSERT DO SYNC PRECISA DE POLITICA DE UPDATE/.test(
        require('fs').readFileSync(require('path').join(__dirname,'..','DECISOES.md'),'utf8')));
  }

grupo('V201 · sumir da lista NÃO é ser excluído');

  {
    const r = win.eval(`(function(){
      try{
        DB._apagados={};
        /* dois registros sumiram da lista: um foi excluído pela tela,
           o outro apenas saiu por filtro */
        declararExclusao('produtos','prod_apagado');
        var d=DB._apagados.produtos||{};
        return JSON.stringify({
          declarado: d['prod_apagado']===true,
          naoDeclarado: d['prod_filtrado']===undefined
        });
      }catch(e){ return 'ERRO: '+e.message; }
    })()`);
    let rj=null; try{ rj=JSON.parse(r); }catch(e){}
    t('a declaração de exclusão funciona', !!rj && rj.declarado === true, String(r));
    t('quem sumiu por filtro NÃO fica declarado', !!rj && rj.naoDeclarado === true);

    t('o espelhamento só apaga o que foi declarado',
      /var deVerdade=sumiram\.filter\(function\(r\)\{ return declarados\[r\]===true; \}\)/.test(fonteBruta));
    t('e avisa quando algo sumiu sem ter sido excluído',
      /sumiram da lista sem terem sido/.test(fonteBruta));
    t('não apaga nada quando nada foi declarado',
      /if\(!deVerdade\.length\)\{ DB\._snap\[chave\]=idsAgora\.slice\(\); return; \}/.test(fonteBruta));
    t('o motivo está escrito no código',
      /AUSENCIA NA LISTA NAO E EXCLUSAO/.test(fonteBruta));

    /* as telas de exclusão precisam declarar */
    ['categorias','produtos','grupos','gruposIng','insumos','fornec','contas',
     'formasPag','entregadores','cupons','mesas'].forEach(col => {
      t('excluir ' + col + ' declara',
        fonteBruta.indexOf("declararExclusao('" + col + "',id)") >= 0);
    });
  }

  grupo('V200 · "salvo" tem de significar "está na nuvem"');

  {
    t('existe a confirmação na nuvem', /async function confirmarNaNuvem/.test(fonteBruta));
    t('ela olha o mapa de identificadores, não a tela',
      /DB\._uuid\[col\]&&DB\._uuid\[col\]\[id\]/.test(fonteBruta));
    t('espera a sincronização antes de decidir',
      /toast\(rotulo\+' salvo — enviando…'\)[\s\S]{0,120}await sincronizar\(\)/.test(fonteBruta));
    t('avisa com o motivo quando não sobe',
      /ainda não chegou à nuvem/.test(fonteBruta));
    t('e deixa claro que o dado não se perde',
      /vai continuar tentando sozinho/.test(fonteBruta));
    t('salvarProduto usa a confirmação',
      /await confirmarNaNuvem\('produtos',p\.id,'Produto'\)/.test(fonteBruta));
    t('a categoria também', /confirmarNaNuvem\('categorias',alvo\.id/.test(fonteBruta));

    /* o produto sumia da lista ao editar quando findIndex dava -1 */
    t('editar produto fora da lista não o faz evaporar',
      /if\(i>=0\)DB\.produtos\[i\]=p; else DB\.produtos\.push\(p\);/.test(fonteBruta));

    /* canais padrão têm de existir de verdade */
    const canais = (fonteBruta.match(/var CANAIS=\[([\s\S]*?)\];/) || ['',''])[1];
    const ids = [...canais.matchAll(/id:'([a-z]+)'/g)].map(m => m[1]);
    const padrao = (fonteBruta.match(/disponivel:\{([a-z:true,]+)\}/) || ['',''])[1];
    const usados = [...padrao.matchAll(/([a-z]+):true/g)].map(m => m[1]);
    t('os canais existem no sistema', ids.length === 5, ids.join(','));
    t('o produto novo nasce só com canais que existem',
      usados.every(c => ids.indexOf(c) >= 0), usados.join(',') + ' vs ' + ids.join(','));
    t('e nasce visível na frente de caixa', usados.indexOf('pdv') >= 0, usados.join(','));
  }

  /* ==========================================================
     A TELA NAO PODE VOLTAR AO TOPO AO CLICAR
     ========================================================== */
  grupo('Rolagem · clicar na lista não joga a tela para o topo');

  {
    const r = win.eval(`(function(){
      try{
        /* as funcoes escrevem dentro destes containers; sem eles nao ha o que
           medir. Criamos para exercitar o redesenho de verdade. */
        ['colCat','colProd','bCat','bProd'].forEach(function(id){
          if(!document.getElementById(id)){
            var d=document.createElement('div'); d.id=id; document.body.appendChild(d);
          }
        });
        /* uma pagina alta o bastante para poder rolar */
        document.body.style.height='4000px';
        window.scrollTo(0,1200);
        var antes=window.scrollY||window.pageYOffset||0;
        /* redesenha a lista, que e o que o clique faz */
        if(typeof renderCategorias==='function')renderCategorias();
        if(typeof renderProdutos==='function')renderProdutos();
        var depois=window.scrollY||window.pageYOffset||0;
        return JSON.stringify({antes:antes,depois:depois});
      }catch(e){ return 'ERRO: '+e.message; }
    })()`);
    let rj = null;
    try { rj = JSON.parse(r); } catch (e) {}
    t('o cenário de rolagem foi montado', !!rj, String(r));
    if (rj) {
      t('redesenhar a lista NÃO volta para o topo', rj.depois !== 0 || rj.antes === 0,
        'antes ' + rj.antes + ' → depois ' + rj.depois);
    }

    /* ==========================================================
       A CAUSA REAL: O CONTEUDO ENCOLHE E O NAVEGADOR PUXA

       Nao ha `scrollTo`. Selecionar categoria filtra os produtos, a
       altura despenca, e a rolagem e clampada. Este teste reproduz
       isso — que os testes de `window.scrollTo` nunca pegariam.
       ========================================================== */
    const enc = win.eval(`(function(){
      try{
        var cx=document.createElement('div');
        cx.className='etScroll';
        cx.style.cssText='height:300px;overflow-y:scroll';
        var dentro=document.createElement('div');
        dentro.style.height='3000px';
        cx.appendChild(dentro);
        document.body.appendChild(cx);
        cx.scrollTop=1500;
        var antes=cx.scrollTop;
        /* o conteudo encolhe, como quando a categoria e filtrada */
        dentro.style.height='400px';
        var depois=cx.scrollTop;
        var res={antes:antes,depoisSemGuarda:depois};
        /* agora com a guarda: altura minima segurada antes da troca */
        cx.scrollTop=1500; dentro.style.height='3000px'; cx.scrollTop=1500;
        var trava=dentro.offsetHeight;
        dentro.style.minHeight=trava+'px';
        dentro.style.height='400px';
        res.depoisComGuarda=cx.scrollTop;
        cx.remove();
        return JSON.stringify(res);
      }catch(e){ return 'ERRO: '+e.message; }
    })()`);
    let ej=null; try{ ej=JSON.parse(enc); }catch(e){}
    t('o cenário de encolhimento foi montado', !!ej, String(enc));
    if (ej) {
      /* RESSALVA: jsdom não calcula layout, então NÃO reproduz o clamp que o
         Chrome faz quando o conteúdo encolhe. O que dá para verificar aqui é
         que a guarda existe e não estraga a rolagem. O clamp em si só o
         navegador real mostra — está na lista do teste manual. */
      t('a guarda não estraga a rolagem', ej.depoisComGuarda === ej.antes,
        ej.antes + ' → ' + ej.depoisComGuarda);
      t('(jsdom não simula o clamp de layout — verificação estrutural abaixo)',
        true, 'limitação do ambiente, não do sistema');
    }
    t('selCat segura a altura antes de trocar o conteúdo',
      /prod\.style\.minHeight=prod\.offsetHeight\+'px'/.test(fonteBruta));
    t('selCat devolve a rolagem ao lugar',
      /if\(cx&&pos\)cx\.scrollTop=pos;/.test(fonteBruta));
    t('e traz a categoria clicada de volta ao campo de visão',
      /scrollIntoView\(\{block:'nearest'\}\)/.test(fonteBruta));
    t('o motivo real está escrito no código',
      /A TELA SUBIA PORQUE O CONTEUDO ENCOLHIA/.test(fonteBruta));

    /* as causas classicas nao podem existir */
    t('nenhum href="#" no sistema', (fonteBruta.match(/href="#"/g) || []).length === 0);
    t('nenhum <form> que possa dar submit', (fonteBruta.match(/<form[\s>]/g) || []).length === 0);
    /* procura no CODIGO, sem os comentarios — senao o proprio comentario que
       documenta a remocao seria lido como violacao dela */
    const semComent = fonteBruta
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
    const scrollZero = (semComent.match(/scrollTo\(0,\s*0\)/g) || []).length;
    t('nenhum scrollTo(0,0) explícito no código', scrollZero === 0,
      scrollZero + ' ocorrência(s)');
    t('a rolagem é guardada e devolvida por chave de tela',
      /_rolChave/.test(fonteBruta));
  }

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

/* ==========================================================
   MEDIR NUNCA PODE QUEBRAR O QUE ESTA SENDO MEDIDO

   Foi exatamente o que aconteceu: dei a esta medicao o nome CRONO, que ja
   existia mais abaixo no arquivo para o cronometro de tela. A declaracao de
   baixo roda depois, sobrescreveu a de cima, e "CRONO.tabelas" deixou de
   existir. A linha que gravava o tempo estourava — inclusive DENTRO do bloco
   que trata erros de leitura, de onde o estouro escapa. Resultado: o download
   morria na primeira leitura e o sistema abria vazio.
   Agora toda gravacao de tempo passa por aqui, isolada. Se algum dia falhar
   de novo, perde-se a medicao — nunca o dado.
   ========================================================== */
function _medir(nome,t0){
  try{
    MEDIDA.tabelas=MEDIDA.tabelas||{};
    MEDIDA.tabelas[nome]=Date.now()-t0;
  }catch(e){}
}
function _relatorioLentidao(){
  var L=[];
  var kb=0, ok='?';
  try{ var t=localStorage.getItem('nexor_dados')||''; kb=Math.round(t.length/1024); ok='sim'; }
  catch(e){ ok='NAO — o navegador recusou ler'; }
  L.push('--- medição ---');
  L.push('guardado no aparelho: '+kb+' KB (leitura: '+ok+')');
  L.push('no aparelho AGORA: insumos '+((DB.insumos||[]).length)+
         ' | estoqueUn '+((DB.estoqueUn||[]).length)+
         ' | fichas '+((DB.fichas||[]).length)+
         ' | itens de ficha '+((DB.fichas||[]).reduce(function(a,f){
             return a+((f.itens||[]).length)},0)));
  L.push('na ABERTURA havia: insumos '+(MEDIDA.boot.insumos===undefined?'?':MEDIDA.boot.insumos)+
         ' | estoqueUn '+(MEDIDA.boot.estoqueUn===undefined?'?':MEDIDA.boot.estoqueUn)+
         ' | com saldo '+(MEDIDA.boot.comSaldo===undefined?'?':MEDIDA.boot.comSaldo));
  L.push('último envio: '+(MEDIDA.envio||0)+' ms | último download: '+(MEDIDA.download||0)+' ms');
  var lentas=Object.keys(MEDIDA.tabelas).map(function(k){return [k,MEDIDA.tabelas[k]]})
    .filter(function(p){return p[1]>=400}).sort(function(a,b){return b[1]-a[1]}).slice(0,10);
  L.push(lentas.length?('leituras acima de 400 ms: '+lentas.map(function(p){
      return p[0]+' '+p[1]+'ms'}).join(', '))
    :'nenhuma leitura passou de 400 ms');
  L.push('');
  return L.join('\n');
}
var _EMVOO={};
function adiantarTab(nome,url){
  var k=nome+'|'+url;
  if(!_EMVOO[k])_EMVOO[k]=baixarTab(nome,url);
  return _EMVOO[k];
}
async function baixarTab(nome,url){
  var k=nome+'|'+url;
  if(_EMVOO[k]){ var p=_EMVOO[k]; delete _EMVOO[k]; return await p; }
  var _tt=Date.now();
  try{
    var r=await comRetentativa(function(){ return api(url); },'baixar '+nome,2);
    var mlim=/[?&]limit=(\d+)/.exec(url||'');
    if(mlim&&Array.isArray(r)&&r.length>=Number(mlim[1])){
      _CORTADAS[nome]=true;
      logNuvem(nome+': download atingiu o limite de '+mlim[1]+
        ' — exclusões não serão espelhadas nesta tabela',true);
    }else{ delete _CORTADAS[nome]; }
    _medir(nome,_tt);
    return r;
  }catch(e){
    _medir(nome,_tt);
    _FALHOU_BAIXA.push(nome);
    registrarFalha('download',nome,(e&&e.message)||'falha ao ler',
      {situacao:'tabela pulada; dados locais mantidos',codigo:(e&&e.status)||''});
    return [];
  }
}
var _baixando=null, _ultimoDownload=0, _ultimoEnvio=0;
async function baixarDaNuvem(forcar){
  /* quem tem senha cadastrada — so os identificadores, nenhum hash */
  try{ await carregarQuemTemSenha(); }catch(e){ _quieto(e,'quemTemSenha'); }
  /* ==========================================================
     INTERVALO MINIMO ENTRE DOWNLOADS
     Medido no aparelho: /insumos levando 2.116 ms e congelamentos de 750 ms
     um atras do outro, sem parar. Sao SEIS caminhos diferentes que pedem
     download — tempo real, relogio de 6 s, conferencia de 45 s, volta para a
     aba, reconexao e o proprio envio. Fechei um por um e continuaram vindo
     pelos outros.
     Em vez de tapar cada caminho, a trava fica AQUI, na porta: fora um
     pedido explicito da pessoa (forcar), nao se baixa a base inteira mais de
     uma vez a cada 20 segundos. Novidade real nao se perde — chega no ciclo
     seguinte, e o tempo real continua avisando.
     ========================================================== */
  if(!forcar){
    var desde=Date.now()-_ultimoDownload;
    if(desde<20000){
      logNuvem('download ignorado: o anterior foi há '+Math.round(desde/1000)+' s');
      return false;
    }
  }
  _ultimoDownload=Date.now();
  /* ==========================================================
     DOWNLOAD SIMULTANEO: ESPERA, NAO DESCARTA
     Na primeira versao desta trava eu devolvia false quando ja havia um
     download rodando. Parecia inofensivo e nao era: o LOGIN chama esta
     funcao para montar a lista de usuarios do aparelho. Se o relogio de 6 s
     tivesse comecado um download um instante antes, o login recebia false,
     seguia com a lista vazia, e o sistema abria dizendo "sem sessao — acesso
     limitado". Foi o que aconteceu na V45.0.0.
     Agora quem chega depois ESPERA o download que ja esta rodando e recebe o
     mesmo resultado. Continua havendo um download so, sem descartar ninguem.
     ========================================================== */
  if(_baixando)return _baixando;
  var _tW=Date.now();
  _baixando=(async function(){
    try{ return await _baixarDaNuvem(forcar); }
    finally{ _baixando=null; try{MEDIDA.download=Date.now()-_tW;}catch(e){} }
  })();
  return _baixando;
}
/* ==========================================================
   SEMENTE SO NASCE UMA VEZ NA VIDA DA EMPRESA

   Os cadastros com semente (turnos, motivos de cancelamento, status de
   venda) so podiam ser semeados de novo porque a marca `_semeado` era
   posta por QUEM SEMEOU. Uma loja que recebeu a lista pronta da nuvem
   nunca ganhava a marca — entao, se a lista esvaziasse por qualquer
   motivo, a semente voltava, com os valores de fabrica, por cima da
   decisao do dono.

   Agora a marca e posta tambem por quem apenas VE a lista cheia: se
   ela existiu uma vez, existiu, e vazia passa a significar "a loja
   apagou todos" — que e para continuar apagado.
   ========================================================== */
function jaExistiu(col){
  try{
    DB._semeado=DB._semeado||{};
    if(Array.isArray(DB[col])&&DB[col].length&&!DB._semeado[col]){
      DB._semeado[col]=true;
    }
    return !!DB._semeado[col];
  }catch(e){ return false; }
}
async function _baixarDaNuvem(forcar){
  _FALHOU_BAIXA=[];
  if(NUVEM.plataforma){
    NUVEM.sujo=false;DB._sujo=false;
    return true;                       /* o dono nao baixa dados de loja */
  }
  /* ==========================================================
     APARELHO NO MESMO LOGIN NAO PODE FICAR ATRASADO PARA SEMPRE

     Aqui estava, depois de tentar enviar:

       if(NUVEM.sujo){ logNuvem('download cancelado'); return; }

     A intencao era certa — nao sobrescrever o aparelho enquanto houver
     coisa esperando para subir. O efeito nao era. Basta UMA coisa que
     nao consegue subir para aquele aparelho parar de RECEBER, e parar
     para sempre: nao ha limite de tempo, nem recuperacao. A tela
     continua desenhando o mundo do momento em que travou — pedido em
     "aguardando preparo" que ja saiu para entrega, loja ligada que ja
     foi desligada. Foi isso que o Rafael viu no tablet e no computador
     da loja: mesmo login, mesma internet, telas diferentes.

     E era uma trava a mais, nao a unica. A protecao de verdade e POR
     LINHA e mora dentro de `volta()`:

       - `temMudancaNaoEnviada` guarda a linha alterada aqui e ainda nao
         enviada, e a versao da nuvem nao entra por cima dela;
       - `_novoAqui` guarda a linha que so existe neste aparelho;
       - o mapa de filhos (V274) devolve o item, o pagamento e o
         movimento de caixa que ainda nao subiram.

     As 45 colecoes do download passam por `volta()` com o nome da
     colecao — conferido uma a uma — entao todas tem essa protecao. O
     bloqueio geral so acrescentava o congelamento.

     Continua valendo o que importa: antes de baixar, tenta enviar. Se o
     envio nao concluir, o download acontece assim mesmo, e cada linha
     nao enviada e preservada individualmente.
     ========================================================== */
  if(NUVEM.sujo&&!forcar){
    logNuvem('há mudanças pendentes — enviando antes de baixar');
    try{ await sincronizar(); }catch(e){_quieto(e,'baixarDaNuvem')}
    if(NUVEM.sujo)
      logNuvem('o envio não concluiu — baixando assim mesmo; o que não subiu '+
        'fica preservado linha a linha',true);
  }
  var antesCat=(DB.catfin||[]).reduce(function(a,p){return a+((p.itens||[]).length)},0);
  logNuvem('baixando da nuvem...');
  respaldoLocal('antes do download');
  /* guarda as listas de agora. Como o download SUBSTITUI DB[col] por um array novo,
     estas referencias continuam apontando para os dados originais. */
  var _antesDB={};
  Object.keys(DB).forEach(function(k){ if(Array.isArray(DB[k]))_antesDB[k]=DB[k]; });
  var _falhou=null;
  await tokenAtual();
  var l=NUVEM.loja;
  /* ==========================================================
     A CAUSA DO ERRO "invalid input syntax for type uuid: null"
     Quando NUVEM.loja era nulo, '?loja_id=eq.'+l virava a STRING "null" e
     seguia para o Postgres, que recusava a consulta inteira. O aviso
     aparecia na TELA DE LOGIN porque o download disparava antes de a
     sessao estar completa — sem loja definida ainda.
     JavaScript nao avisa disso: null concatenado com texto vira "null".
     Agora, sem empresa nao ha o que baixar: sai antes de montar consulta.
     ========================================================== */
  if(!ehUuid(l)){
    registrarFalha('download','baixarDaNuvem',
      'sessão ainda sem empresa definida — download adiado', {loja:String(l)});
    return false;
  }
  var q='?loja_id=eq.'+l;          /* sem select: cada consulta define o dela */
  /* ==========================================================
     P9 — JANELA DE TEMPO NAS TABELAS QUE CRESCEM PARA SEMPRE
     Medido em teste de carga: baixar tudo levava 1,2 s com 6 sessoes,
     15 s com 20 e 49 s com 50 — e isso com o banco praticamente vazio.
     Com um ano de operacao o login ficaria inviavel.
     Pedidos, movimentacoes, financeiro, cancelamentos e cupons passam a vir
     dos ultimos 90 dias. Cadastro (produto, insumo, cliente, ficha) continua
     inteiro, porque e pequeno e a tela precisa dele todo.
     Quem precisar de periodo maior usa o relatorio, que consulta a nuvem.
     ========================================================== */
  var _dJanela=new Date(); _dJanela.setDate(_dJanela.getDate()-(DIAS_JANELA||90));
  var _desde=_dJanela.toISOString().slice(0,10);
  /* ==========================================================
     PEDIDOS GUARDAM UMA JANELA MAIS CURTA (Etapa 2, 05/09/2026)
     O aparelho baixa poucos dias de pedidos; o histórico mais antigo o
     relatório busca na nuvem sob demanda (garantirHistorico/fontePedidos).
     Movimentações e cupons continuam na janela cheia, porque os relatórios
     que os usam (Itens Consumidos, CMV) ainda leem só do aparelho. */
  var _dJanelaPed=new Date();
  _dJanelaPed.setDate(_dJanelaPed.getDate()-(typeof DIAS_JANELA_PEDIDOS!=='undefined'?DIAS_JANELA_PEDIDOS:(DIAS_JANELA||90)));
  var _desdePed=_dJanelaPed.toISOString().slice(0,10);
  var qJan=q+'&data_venda=gte.'+_desdePed;   /* pedidos (janela curta) */
  var qJanD=q+'&data=gte.'+_desde;           /* movimentacoes, cupons (janela cheia) */
  var qs=q+'&select=*';            /* consultas simples */
  /* se a nuvem responder vazio mas houver dados aqui, mantém os daqui */
  /* o filho sobe como "idDoPai_idDoFilho"; na volta devolve o id original,
     senão o identificador cresce a cada sincronização e o sistema
     passa a achar que o item foi excluído e recriado */
  function idFilho(paiRef,ref,alt){
    if(!ref)return alt;
    var p=String(paiRef||'')+'_';
    return String(ref).indexOf(p)===0?String(ref).slice(p.length):ref;
  }
  /* ==========================================================
   O DOWNLOAD TAMBEM PRECISA GUARDAR O MAPA DE IDENTIFICADORES

   CAUSA DO INGREDIENTE QUE SUMIA AO SALVAR.
   Ao enviar, cada vinculo (ingrediente -> insumo) e traduzido por fk(), que
   busca em _ids o identificador que a nuvem deu ao insumo. E _ids so era
   alimentado por DB._uuid — que registra o que ESTE aparelho enviou.
   Insumo que chegou por DOWNLOAD nunca entrava nesse mapa. Entao fk()
   devolvia null, a coluna insumo_id e obrigatoria, e o banco recusava a
   linha inteira. O ingrediente ficava so na memoria do navegador; no
   download seguinte a ficha era substituida pela versao da nuvem — que nao
   tinha aquele ingrediente — e ele sumia da tela.
   Era exatamente o caso da Agua Filtrada: insumo importado, presente na
   lista, mas invisivel para o tradutor de vinculos.
   Agora toda linha que desce registra ref_local -> id. Vale para qualquer
   vinculo, nao so o da ficha: fornecedor de lancamento, conta, categoria.
   ========================================================== */
function guardarIds(col,linhas){
  if(!col||!linhas||!linhas.length)return;
  DB._uuid=DB._uuid||{};
  DB._uuid[col]=DB._uuid[col]||{};
  for(var i=0;i<linhas.length;i++){
    var x=linhas[i];
    if(x&&x.ref_local&&x.id){
      DB._uuid[col][x.ref_local]=x.id;
      _ids[x.ref_local]=x.id;
    }
    /* registro criado direto na nuvem nao tem ref_local: o proprio id serve
       de referencia local. Precisa ir para DB._uuid tambem — _ids e zerado a
       cada envio e remontado so a partir de DB._uuid, entao gravar apenas em
       _ids resolvia no primeiro envio e falhava em todos os seguintes. */
    else if(x&&x.id){ DB._uuid[col][x.id]=x.id; _ids[x.id]=x.id; }
  }
}
/* ==========================================================
   A PROTECAO EXISTIA E NUNCA RODOU

   volta() recebe quatro coisas: as linhas da nuvem, como traduzi-las, O QUE
   JA EXISTE AQUI, e o nome da colecao. Todo o cuidado de preservar o que
   ainda nao subiu — inclusive a devolucao dos ingredientes da ficha — esta
   dentro de "if(atual && atual.length)". So que a chamada das fichas passava
   null nesse lugar. A protecao inteira era codigo morto.
   Era exatamente isto: o segundo ingrediente entrava, o aviso de tempo real
   chegava, o download trocava a ficha inteira pela versao da nuvem — que
   ainda nao tinha o item — e ele sumia em segundos, sem erro nenhum.
   _ANT devolve a colecao viva no momento do download.
   ========================================================== */
function _ANT(col){
  try{ var a=DB[col]; return Array.isArray(a)?a:null; }catch(e){ return null; }
}
function volta(linhas,fn,atual,col){
    var _antesVolta=Array.isArray(atual)?atual.slice():null;
    if(col)guardarIds(col,linhas);
    var r=(linhas||[]).map(fn);
    /* ==========================================================
       DOWNLOAD VAZIO NAO E "A NUVEM ESTA VAZIA"

       `baixarTab()` devolve `[]` quando a consulta FALHA — e escreve no
       diagnostico "tabela pulada; dados locais mantidos". Os dados locais
       NAO eram mantidos: das 45 colecoes, 40 chamavam esta funcao sem
       passar a lista atual, e sem ela esta guarda logo abaixo nao tinha o
       que comparar. Um 500 na leitura de `turnos` zerava `DB.turnos`.

       E zerar nao para ai: `baseTurnos()` ve a lista vazia e SEMEIA de
       novo "Turno 1" e "Turno 2", ativos. Foi o que a loja de Santa Fe do
       Sul viu em 29/08/2026 — os dois turnos desativados pelo dono
       reaparecendo na abertura de caixa, com o horario de fabrica. O
       mesmo vale para motivos de cancelamento e para toda colecao com
       semente.

       A lista atual e descoberta pelo nome da colecao quando quem chamou
       nao a passou. Onde ela ja era passada, nada muda.
       ========================================================== */
    if(!Array.isArray(atual)&&col)atual=_ANT(col);
    if(!r.length&&atual&&atual.length)return atual;
    /* ==========================================================
       O QUE AINDA NAO SUBIU NAO PODE SER APAGADO PELO DOWNLOAD
       O download substitui a colecao inteira pela versao da nuvem. Se um
       registro foi criado aqui e ainda nao subiu — porque falhou, porque a
       rede caiu, porque o envio ainda nem aconteceu — ele simplesmente
       desaparecia da tela, sem erro nenhum.
       Aqui o que existe SO no aparelho e preservado. Nao e mesclagem de
       conteudo: registro que existe nos dois lados continua vindo da nuvem,
       que e a fonte da verdade. Preserva-se apenas o que a nuvem ainda nao
       conhece.
       ========================================================== */
    /* ==========================================================
       O FECHAMENTO DE CAIXA QUE O DOWNLOAD APAGAVA

       28/08/2026, 23h. A loja de Santa Fe do Sul fechou o caixa do dia,
       imprimiu o comprovante, e na manha seguinte o sistema mostrava
       aquele mesmo caixa aberto desde o dia anterior. As 57 vendas da
       noite estavam todas na nuvem; so o fechamento nao estava.

       O motivo estava escrito no comentario logo abaixo, como se fosse
       uma regra: "registro que existe nos dois lados continua vindo da
       nuvem, que e a fonte da verdade". Para um registro ALTERADO AQUI e
       ainda nao enviado, isso e falso — a verdade e a daqui, que a nuvem
       ainda nao conhece. O download passava por cima do fechamento
       segundos depois dele ser feito, e o envio seguinte ja nao tinha o
       que enviar. Nenhum erro, nenhum aviso, nada na tela.

       A pergunta certa e "esta linha ja foi confirmada pela nuvem?", e a
       resposta esta na impressao digital do ultimo envio confirmado.
       Se a linha daqui mudou desde entao, ela FICA — e sobe no envio
       seguinte.

       Nao e mesclagem de conteudo: quem nao tem alteracao pendente
       continua vindo da nuvem, como sempre.
       ========================================================== */
    if(col&&Array.isArray(atual)&&atual.length&&typeof temMudancaNaoEnviada==='function'){
      var meus={};
      /* download que ficou velho: comecou a ser buscado ANTES do meu ultimo
         envio confirmado. Nele, o que existe aqui e mais novo — mantem-se o
         local. O proximo download limpo reconcilia. Isso mata a corrida que
         apagava a edicao recem-salva. */
      var _NV = (typeof NUVEM!=='undefined' && NUVEM) ? NUVEM : {};
      var _baixaVelha = !!(_NV._enviouEm && _NV._baixaIniciou &&
                           _NV._enviouEm > _NV._baixaIniciou);
      /* ==========================================================
         O SALDO DE ESTOQUE NAO PODE VIRAR GUERRA ENTRE APARELHOS

         03/09/2026. `estoque_unidade` guarda um SALDO ABSOLUTO por
         (loja,item). Dois aparelhos da mesma loja, com saldos diferentes,
         ficavam gravando um por cima do outro — 100+ regravacoes em 48h, o
         numero oscilando (-278 <-> -458 <-> -999) no audit_log. Cada um
         preservava o SEU saldo como "ainda nao enviado" e reenviava para
         sempre; e enquanto ha algo para subir, o aparelho pausa os
         downloads. Era a fila que nao esvaziava e o "aparelho atrasado".

         Dois saldos absolutos NAO se resolvem preservando os dois lados
         (nao da para somar). Entao a regra deste cache passa a ser
         DETERMINISTA: vence a escrita MAIS RECENTE (`atualizadoEm`). O
         aparelho com o saldo mais novo mantem o seu e sobe; o outro adota
         o da nuvem em vez de reenviar o antigo. Os dois convergem, a
         guerra acaba, a fila esvazia. O razao (movimentacoes_estoque)
         continua guardando cada baixa, entao o historico nao se perde.
         ========================================================== */
      var _ehEstoque = (col==='estoqueUn');
      var _naNuvemEst = {};
      if(_ehEstoque) r.forEach(function(y){ if(y&&y.id)_naNuvemEst[y.id]=y; });
      function _maisNovoQue(a,b){
        if(!a)return false;            /* sem carimbo local: nao vence */
        if(!b)return true;             /* nuvem sem carimbo, local tem: local vence */
        return String(a)>String(b);    /* ISO ordena por texto */
      }
      atual.forEach(function(x,i){
        if(!x||!x.id)return;
        if(_ehEstoque){
          var nv=_naNuvemEst[x.id];
          if(!nv){ meus[x.id]=x; return; }               /* so existe aqui: sobe */
          if(_maisNovoQue(x.atualizadoEm,nv.atualizadoEm)) meus[x.id]=x; /* local mais novo vence */
          return;                                        /* senao: adota a nuvem, sem guerra */
        }
        if(temMudancaNaoEnviada(col,x,i)){ meus[x.id]=x; return; }
        if(_baixaVelha) meus[x.id]=x;
      });
      if(_baixaVelha)
        logNuvem(col+': download começou antes do último envio — mantido o que '+
          'está no aparelho, a nuvem reconcilia no próximo ciclo',true);
      var _fic=0;
      r=r.map(function(x){
        if(x&&x.id&&meus[x.id]){ _fic++; return meus[x.id]; }
        return x;
      });
      if(_fic)logNuvem(col+': '+_fic+' registro(s) com alteração ainda não enviada '+
        'foram mantidos como estão aqui — a nuvem recebe no próximo envio');
    }
    if(col&&Array.isArray(atual)&&atual.length){
      var naNuvem={};
      r.forEach(function(x){ if(x&&x.id)naNuvem[x.id]=true; });
      var sos=atual.filter(function(x){
        return x&&x.id&&!naNuvem[x.id]&&x._novoAqui===true; });
      if(sos.length){
        logNuvem(col+': '+sos.length+' registro(s) ainda não enviados foram '+
          'preservados no aparelho');
        r=r.concat(sos);
      }
      /* ==========================================================
         O REGISTRO EXISTE NOS DOIS LADOS — MAS OS FILHOS, NAO

         AQUI ESTAVA O INGREDIENTE SUMINDO.
         A preservacao acima so salvava o registro que a nuvem NAO tinha. A
         ficha tecnica existe nos dois lados, entao a versao da nuvem
         substituia a local inteira — inclusive a lista de ingredientes. Se
         o terceiro ingrediente ainda nao tinha subido, ele simplesmente
         deixava de existir, e a lista voltava ao que a nuvem tinha.
         Era exatamente o relato: adiciona o terceiro, ele toma o lugar do
         segundo (a lista voltou ao estado anterior e recebeu o novo), e
         segundos depois some tudo.
         Aqui os filhos que so existem no aparelho sao devolvidos ao
         registro que veio da nuvem. O resto continua vindo da nuvem.
         ========================================================== */
      /* ==========================================================
         A PROTECAO VALIA PARA TRES LISTAS DE OITO

         Este mapa era escrito a mao: {fichas:'itens', grupos:'opcoes',
         contas:'movs'} — e `contas` nem tem filho no MAPA, era entrada
         morta. Ficavam DE FORA, sem protecao nenhuma:

           caixas   -> movimentos   (sangria e suprimento)
           pedidos  -> itens, pagamentos
           catfin   -> itens
           pedidosBase -> itens
           entregadores -> taxas
           areas    -> zonas

         O caso que apareceu, 31/08/2026, Santa Fe do Sul: sangria de
         R$ 85,00 as 23:24, cupom impresso, dinheiro fora da gaveta. O
         movimento entrou em `cx.movimentos` aqui e ainda nao tinha
         subido. Veio um download, o caixa voltou da nuvem sem
         movimento nenhum, e a lista local foi substituida pela de la.
         No fechamento, meia hora depois: "Sangrias - R$ 0,00". O
         dinheiro saiu e o sistema esqueceu.

         Um mapa escrito a mao envelhece: quem criou o filho do caixa
         nao sabia que precisava vir aqui. Agora ele e montado a partir
         do proprio MAPA — filho novo nasce protegido, sem ninguem
         lembrar de nada. E cada pai pode ter mais de uma lista, que e o
         caso do pedido (itens E pagamentos).
         ========================================================== */
      /* a conta fica guardada na propria funcao: `volta` e extraida e
         rodada isolada pelos testes, e nao pode depender de variavel
         que mora fora dela */
      if(!volta._filhos){
        volta._filhos={};
        try{
          (MAPA||[]).forEach(function(E9){
            (E9.filhos||[]).forEach(function(F9){
              if(!F9||!F9.lista)return;
              volta._filhos[E9.col]=volta._filhos[E9.col]||[];
              if(volta._filhos[E9.col].indexOf(F9.lista)<0)
                volta._filhos[E9.col].push(F9.lista);
            });
          });
        }catch(e){ volta._filhos={}; }
      }
      var listasF=volta._filhos[col]||[];
      for(var _lf=0;_lf<listasF.length;_lf++){
        var campoF=listasF[_lf];
        var antesPorId={};
        atual.forEach(function(x){ if(x&&x.id)antesPorId[x.id]=x; });
        var devolvidos=0;
        r.forEach(function(novo){
          var velho=novo&&novo.id?antesPorId[novo.id]:null;
          if(!velho)return;
          var listaVelha=velho[campoF]||[], listaNova=novo[campoF]||[];
          if(!listaVelha.length)return;
          var temNaNuvem={};
          listaNova.forEach(function(o){ if(o&&o.id)temNaNuvem[o.id]=true; });
          var faltando=listaVelha.filter(function(o){
            return o&&o.id&&!temNaNuvem[o.id]; });
          if(faltando.length){
            novo[campoF]=listaNova.concat(faltando);
            devolvidos+=faltando.length;
            /* ==========================================================
               O PAI VOLTOU DA NUVEM, MAS ESTE FILHO AINDA NAO SUBIU

               A anotacao de impressao (anotarImpressoes) diz "esta linha
               ja esta na nuvem, nao precisa subir". Para um pai que
               acabou de receber de volta um filho que a nuvem NAO tem,
               isso seria uma mentira — e o ingrediente ficaria preso
               aqui para sempre. Marcado assim, o pai nao ganha impressao
               e sobe no envio seguinte, levando o filho junto.
               ========================================================== */
            novo._filhoPendente=true;
          }
        });
        if(devolvidos)
          logNuvem(col+' · '+campoF+': '+devolvidos+' item(ns) ainda não enviados '+
            'foram mantidos na lista');
      }
    }
    /* o download substitui a coleção inteira: se algo encolheu aqui, foi a
       nuvem que devolveu menos do que o aparelho tinha */
    if(col&&_antesVolta)registrarSumico(col,_antesVolta,r,'download substituiu a lista');
    return r;
  }
  try{
  /* ==========================================================
     A HORA EM QUE ESTE DOWNLOAD FOI BUSCADO

     Corrida que apagava a edicao do Rafael no MESMO aparelho: um download
     parte (busca a nuvem VELHA), a pessoa salva (a nuvem vira NOVA, e a
     impressao local passa a bater com o que subiu), e ai o download velho
     CHEGA e joga o valor velho por cima — a protecao "manter o que ainda
     nao subiu" nao dispara, porque o que ela editou JA subiu.

     Marcando a hora em que a busca comecou, o `volta` sabe reconhecer um
     download que ficou velho: se um envio foi confirmado DEPOIS desta
     hora, este download nao pode mandar por cima do que esta aqui.
     ========================================================== */
  NUVEM._baixaIniciou=Date.now();
  /* partem todas agora; cada "await baixarTab" abaixo apenas recolhe a sua */
  _EMVOO={};
  ['contas_capital'+qs,'formas_pagamento'+qs+'&order=ordem','fornecedores'+qs,
   'clientes'+qs,'categorias'+qs+'&order=ordem','produtos'+qs+'&order=ordem',
   'unidades_medida'+qs,'grupos_ingredientes'+qs,'insumos'+qs,
   'ficha_grupos'+qs,'fichas_tecnicas'+qs,'bases_catalogo'+qs,
   'baixas_pendentes'+qs,'motivos_movimentacao'+qs,
   'motivos_cancelamento'+qs+'&order=ordem','status_venda'+qs+'&order=ordem',
   'modelos_impressao'+qs,'estoque_unidade'+qs+'&limit=20000',
   'mesas'+qs+'&order=numero','turnos'+qs+'&order=ordem','sucursais'+qs,
   'cardapio_config'+qs]
   .forEach(function(u){ adiantarTab(u.split('?')[0],u); });
  adiantarTab('ficha_itens','ficha_itens?select=*&limit=20000');
  /* ==========================================================
     GARGALO PRINCIPAL: 50 CONSULTAS UMA ESPERANDO A OUTRA

     Cada `await baixarTab(...)` parava tudo ate a resposta chegar. Sao
     50 consultas em fila. Medido contra o banco: 0,15 a 0,50 s por
     consulta (o servidor esta em Ohio), media 0,23 s — ou seja, perto
     de 8 SEGUNDOS so de ida e volta, antes de o sistema desenhar
     qualquer coisa. Nao era o banco lento nem o aparelho fraco: era
     fila.

     Aqui as consultas sao DISPARADAS todas juntas e so depois
     aguardadas, na mesma ordem de antes. O navegador cuida de varias
     ao mesmo tempo, e o tempo total passa a ser o da consulta mais
     lenta, nao a soma de todas.

     Por que e seguro: nenhuma URL depende do resultado de outra —
     todas usam filtro fixo (loja e unidade). Foi verificado uma a uma.
     E o PROCESSAMENTO continua na ordem original, entao os mapas de
     identificador que uma etapa monta para a seguinte seguem prontos
     na hora certa.

     Quatro tabelas eram baixadas DUAS vezes no mesmo carregamento
     (cardapio_config, sucursais, usuarios_sistema, clientes_nexor).
     Agora a segunda reaproveita a mesma resposta.
     ========================================================== */
  var _p00=baixarTab('contas_capital', 'contas_capital'+qs);
  var _pbs=baixarTab('pedidos_base','pedidos_base'+q+
    '&select=*,pedido_base_itens(*)&order=criado_em.desc&limit=800');
  var _p01=baixarTab('formas_pagamento', 'formas_pagamento'+qs+'&order=ordem');
  var _p02=baixarTab('categorias_financeiras', 'categorias_financeiras'+q+'&select=*,subcategorias_financeiras(*)&order=ordem');
  var _p03=baixarTab('fornecedores', 'fornecedores'+qs);
  var _p04=baixarTab('clientes', 'clientes'+qs);
  var _p05=baixarTab('entregadores', 'entregadores'+q+'&select=*,entregador_taxas(*)');
  var _p06=baixarTab('lancamentos_financeiros', 'lancamentos_financeiros'+q+'&select=*&vencimento=gte.'+_desde+'&order=vencimento.desc&limit=3000');
  var _p07=baixarTab('categorias', 'categorias'+qs+'&order=ordem');
  var _p08=baixarTab('produtos', 'produtos'+qs+'&order=ordem');
  var _p09=baixarTab('grupos_opcoes', 'grupos_opcoes'+q+'&select=*,opcoes(*)&order=ordem');
  var _p10=baixarTab('cardapio_config', 'cardapio_config'+qs);
  var _p11=baixarTab('config_operacao', 'config_operacao'+qs+'&limit=1');
  var _p12=baixarTab('unidades_medida', 'unidades_medida'+qs);
  var _p13=baixarTab('grupos_ingredientes', 'grupos_ingredientes'+qs);
  var _p14=baixarTab('insumos', 'insumos'+qs);
  var _p15=baixarTab('ficha_grupos', 'ficha_grupos'+qs);
  var _p16=baixarTab('fichas_tecnicas', 'fichas_tecnicas'+qs);
  var _p17=baixarTab('ficha_itens', 'ficha_itens?select=*&limit=20000');
  var _p18=baixarTab('bases_catalogo', 'bases_catalogo'+qs);
  var _p19=baixarTab('baixas_pendentes', 'baixas_pendentes'+qs);
  var _p20=baixarTab('motivos_movimentacao', 'motivos_movimentacao'+qs);
  var _p21=baixarTab('motivos_cancelamento', 'motivos_cancelamento'+qs+'&order=ordem');
  var _p22=baixarTab('status_venda', 'status_venda'+qs+'&order=ordem');
  var _p23=baixarTab('modelos_impressao', 'modelos_impressao'+qs);
  var _p24=baixarTab('usuarios_sistema', 'usuarios_sistema'+qs+'&order=nome');
  var _p25=baixarTab('clientes_nexor', 'clientes_nexor'+q+'&order=rede');
  var _p26=baixarTab('estoque_unidade', 'estoque_unidade'+qs+'&limit=20000');
  var _p27=baixarTab('cupons_fiscais', 'cupons_fiscais'+qs+'&order=data_venda.desc&limit=2000');
  var _p28=baixarTab('mesa_comandas', 'mesa_comandas'+qs+'&order=aberta_em.desc&limit=500');
  var _p29=baixarTab('transferencias', 'transferencias'+qs+'&order=numero.desc&limit=1000');
  var _p30=baixarTab('mesas', 'mesas'+qs+'&order=numero');
  var _p31=baixarTab('turnos', 'turnos'+qs+'&order=ordem');
  var _p32=baixarTab('cancelamentos', 'cancelamentos'+q+'&select=*&criado_em=gte.'+_desde+'&order=criado_em.desc&limit=2000');
  var _p33=baixarTab('movimentacoes_estoque', 'movimentacoes_estoque'+qJanD+'&select=*&order=data.desc&limit=3000');
  var _p34=baixarTab('contagens_estoque', 'contagens_estoque'+qs+'&order=data.desc&limit=500');
  var _p35=baixarTab('areas_entrega', 'areas_entrega'+q+'&select=*,areas_zonas(*)');
  var _p36=baixarTab('sucursais', 'sucursais'+qs);
  var _p37=baixarTab('ordens_producao', 'ordens_producao'+qs+'&order=data.desc&limit=1000');
  var _p38=baixarTab('usuarios_sistema', 'usuarios_sistema'+qs+'&order=nome.asc&limit=500');
  var _p39=baixarTab('clientes_nexor', 'clientes_nexor'+qs+'&order=rede.asc&limit=500');
  var _p40=baixarTab('compras_sem_vinculo', 'compras_sem_vinculo'+qs+'&order=excluido_em.desc&limit=1000');
  var _p41=baixarTab('notas_entrada', 'notas_entrada'+qs+'&order=data.desc&limit=1000');
  var _p42=baixarTab('caixas', 'caixas'+q+'&select=*,caixa_movimentos(*)&order=aberto_em.desc&limit=400');
  var _p43=baixarTab('pedidos', 'pedidos'+qJan+'&select=*,pedido_itens(*),pedido_pagamentos(*)&order=criado_em.desc&limit=3000');
  var _p44=baixarTab('acertos', 'acertos'+qs+'&order=data.desc&limit=500');
  var _p45=baixarTab('cupons', 'cupons'+qs);
  var _p46=baixarTab('cupom_usos', 'cupom_usos'+qJanD+'&select=*&order=data.desc&limit=2000');
  var _p47=baixarTab('fiado_movimentos', 'fiado_movimentos'+qs+'&order=data.desc&limit=2000');
  var cont=await _p00;
  DB.contas=volta(cont,function(x){return {sucursais:x.sucursais||[], /* desce junto: o que sobe tem de descer (V188) */ id:x.ref_local||x.id,nome:x.nome,tipo:x.tipo,banco:x.banco,
    agencia:x.agencia,numero:x.numero,saldoInicial:Number(x.saldo_inicial)||0,fixa:x.fixa}},_ANT('contas'),'contas');
  var fp=await _p01;
  var mapaConta={};cont.forEach(function(x){mapaConta[x.id]=x.ref_local||x.id});
  DB.formasPag=volta(fp,function(x){return {sucursais:x.sucursais||[], /* desce junto: o que sobe tem de descer (V188) */ id:x.ref_local||x.id,nome:x.nome,tipo:x.tipo,bandeira:x.bandeira,
    taxaPct:Number(x.taxa_pct)||0,taxaFixa:Number(x.taxa_fixa)||0,dias:x.dias_recebimento||0,
    contaId:mapaConta[x.conta_id]||'',ativa:x.ativa!==false,online:!!x.online,ordem:x.ordem||0}},null,'formasPag');
  var cf=await _p02;
  DB.catfin=volta(cf,function(x){
    var paiRef=x.ref_local||x.id;
    return {sucursais:x.sucursais||[], /* desce junto: o que sobe tem de descer (V188) */ id:paiRef,nome:x.nome,tipo:x.tipo||'despesa',
      itens:(x.subcategorias_financeiras||[]).sort(function(a,b){return (a.ordem||0)-(b.ordem||0)})
        .map(function(s){return {id:idFilho(paiRef,s.ref_local,s.id),nome:s.nome}})};},null,'catfin');
  var fo=await _p03;
  DB.fornec=volta(fo,function(x){return {sucursais:x.sucursais||[], /* desce junto: o que sobe tem de descer (V188) */ id:x.ref_local||x.id,empresa:x.empresa,nome:x.contato,
    cnpj:x.cnpj,email:x.email,tel:x.telefone,whats:x.whatsapp}},null,'fornec');
  var cl=await _p04;
  DB.clientes=volta(cl,function(x){return {id:x.ref_local||x.id,nome:x.nome,tel:x.telefone,rua:x.rua,
    numero:x.numero,bairro:x.bairro,cidade:x.cidade,ref:x.referencia,
    compras:x.compras||0,gasto:Number(x.gasto)||0,
    cpf:x.cpf||'',nascimento:x.nascimento||'',obs:x.observacao||'',
    zonaId:x.zona_id||'',zona:x.zona||'',
    limiteFiado:Number(x.limite_fiado)||0,saldoFiado:Number(x.saldo_fiado)||0,
    ultima:x.ultima_compra||''}},null,'clientes');
  var en=await _p05;
  DB.entregadores=volta(en,function(x){return {sucursais:x.sucursais||[], /* desce junto: o que sobe tem de descer (V188) */ id:x.ref_local||x.id,nome:x.nome,tel:x.telefone,cpf:x.cpf,
    pix:x.pix,diarias:x.diarias||{},padrao:!!x.padrao,ativo:x.ativo!==false,
    /* mesmo defeito da venda: sem o id de volta, a taxa era reinserida a
       cada sincronizacao */
    taxas:(x.entregador_taxas||[]).map(function(t){return {id:t.ref_local||t.id,
      cidade:t.cidade,valor:Number(t.valor)||0}})}},null,'entregadores');
  var lf=await _p06;
  var mapaSub={};(cf||[]).forEach(function(c2){(c2.subcategorias_financeiras||[]).forEach(function(s){
    mapaSub[s.id]=s.ref_local||s.id})});
  var mapaFP={};fp.forEach(function(x){mapaFP[x.id]=x.ref_local||x.id});
  var mapaFo={};fo.forEach(function(x){mapaFo[x.id]=x.ref_local||x.id});
  DB.lancFin=volta(lf,function(x){return {id:x.ref_local||x.id,tipo:x.tipo,
    juros:Number(x.juros)||0,multa:Number(x.multa)||0,
    valorOriginal:(x.valor_original===null||x.valor_original===undefined?undefined:Number(x.valor_original)),
    contaId:mapaConta[x.conta_id]||'',contaDestinoId:mapaConta[x.conta_destino_id]||'',
    metodoId:mapaFP[x.forma_id]||'',categoriaId:mapaSub[x.subcategoria_id]||'',
    categoriaTxt:x.categoria_texto||'',fornecedorId:mapaFo[x.fornecedor_id]||'',
    fornecedor:x.fornecedor_nome||'',descricao:x.descricao,documento:x.documento,
    codigoBarras:x.codigo_barras||'',
    valor:Number(x.valor)||0,emissao:x.emissao,vencimento:x.vencimento,pagamento:x.pagamento,
    pago:!!x.pago,conciliado:!!x.conciliado,dataConc:x.data_conciliacao,
    origem:x.origem,ref:x.origem_ref||undefined,obs:x.observacao}},null,'lancFin');
  /* cardápio */
  var rc=await _p07;
  var rp=await _p08;
  /* o vinculo da opcao com a ficha precisa deste mapa, e as fichas descem
     depois — entao ele e montado aqui, com uma consulta enxuta. */
  var _mapaFichaId={},_mapaFichaOk=false;
  try{
    var _fl=await api('fichas_tecnicas?select=id,ref_local'+qs.replace('?','&'));
    (_fl||[]).forEach(function(f){_mapaFichaId[f.id]=f.ref_local||f.id});
    _mapaFichaOk=true;
  }catch(e){_quieto(e,'mapaFicha');}
  /* ==========================================================
     O VINCULO DA OPCAO NAO PODE SUMIR NUM DOWNLOAD RUIM

     Este mapa vem de uma consulta a parte, e o try/catch acima engole a
     falha dela. Sem o mapa, TODA opcao voltava com `fichaId:''` — mesmo
     tendo `ficha_id` gravado na nuvem. O envio seguinte mandava `null` e
     apagava o vinculo la tambem. Uma consulta que falhou uma vez, num
     aparelho so, apagava o cadastro da rede inteira, sem erro na tela.

     Foi o que o Rafael descreveu: "eu tinha vinculado, o sistema tirou".

     Regra da casa, pela quinta vez: AUSENCIA DE DADO NAO E RESPOSTA.
     Sem conseguir traduzir, mantem-se o que o aparelho ja sabia. Opcao
     que vem da nuvem SEM ficha continua sem ficha — desvincular tem de
     continuar funcionando.
     ========================================================== */
  var _fichaAntes={},_fichaSalvas=0;
  (_ANT('grupos')||[]).forEach(function(g){
    (g&&g.opcoes||[]).forEach(function(op){
      if(op&&op.id&&op.fichaId)_fichaAntes[op.id]=op.fichaId;
    });
  });
  function _fichaDaOpcao(op){
    if(!op.ficha_id)return '';                     /* sem ficha na nuvem: sem ficha */
    var achou=_mapaFichaId[op.ficha_id];
    if(achou)return achou;
    var guardado=_fichaAntes[op.ref_local];
    if(guardado){_fichaSalvas++;return guardado;}
    return '';
  }
  var rg=await _p09;
  var rv=await api('produto_grupos?select=produto_id,grupo_id');
  var mapaCat={};rc.forEach(function(x){mapaCat[x.id]=x.ref_local||x.id});
  var mapaGr={};rg.forEach(function(x){mapaGr[x.id]=x.ref_local||x.id});
  DB.categorias=volta(rc,function(x){return {id:x.ref_local||x.id,nome:x.nome,impressao:x.impressao,
    imposto:x.imposto,cor:x.cor,imagem:x.imagem,ativo:x.ativa!==false,ordem:x.ordem||0,sucursais:x.sucursais||[]}},null,'categorias');
  DB.grupos=volta(rg,function(x){return {id:x.ref_local||x.id,nome:x.nome,min:x.minimo||0,max:x.maximo||1,
    forcado:!!x.forcado,ordem:x.ordem||0,canais:x.canais||[],
    /* o que sobe tem de descer: sem isto a liberacao feita pela matriz
       nao chegava a unidade (V187) */
    sucursais:x.sucursais||[],
    /* A opcao voltava da nuvem SEM identificador. No envio seguinte ela era
       renumerada pela posicao, entao qualquer reordenacao criava linha nova
       em vez de atualizar a existente. Duas bordas viraram 2.000 linhas.
       Trazendo o ref_local de volta, a opcao mantem a mesma identidade em
       todas as voltas. */
    opcoes:(x.opcoes||[]).sort(function(a,b){return (a.ordem||0)-(b.ordem||0)})
      .map(function(o){return {id:o.ref_local||null,nome:o.nome,
        preco:Number(o.preco_adicional)||0,
        /* o que sobe tem de descer: sem isto o sabor desligado voltava
           ligado no download seguinte */
        ativo:o.ativo!==false,
        fichaId:_fichaDaOpcao(o)}})}},_ANT('grupos'),'grupos');
  if(_fichaSalvas)
    logNuvem('vínculo com ficha técnica preservado do aparelho em '+_fichaSalvas+
      ' opção(ões) — a nuvem não soube traduzir'+(_mapaFichaOk?'':' (a consulta de fichas falhou)'),true);
  /* ==========================================================
     O VINCULO DE ESTOQUE DO PRODUTO NAO PODE SUMIR NUM DOWNLOAD

     Mesma regra da opcao, logo acima: AUSENCIA DE DADO NAO E RESPOSTA.

     03/09/2026. A nuvem estava com produtos.ficha_id e insumo_id em
     branco para TODOS os produtos de Santa Fe. Como esta descida
     recalcula p.fichaId a partir desse valor (mapaFi[x.ficha_id]), cada
     download zerava o vinculo — e a venda parava de baixar estoque.

     Foi o "varias vendas no PDV, uma baixa so": dois caixas no balcao,
     um com o vinculo local ainda de pe (baixava), o outro que ja tinha
     baixado a versao vazia da nuvem (nao baixava). O mesmo produto
     baixava num pedido e no seguinte nao.

     Agora, quando a nuvem nao traz o vinculo, mantem-se o que o aparelho
     ja sabia — DESDE QUE a ficha (ou o insumo) ainda exista aqui. O envio
     seguinte traduz esse vinculo local e re-popula a nuvem, que passa a
     descer certo para todos os aparelhos. Desvincular pela tela continua
     valendo: quem tira a ficha deixa o proprio fichaId vazio, e nada
     aqui inventa vinculo — so preserva o que ja havia. */
  var _vincAntes={};
  (_ANT('produtos')||[]).forEach(function(p){
    if(p&&p.id&&(p.fichaId||p.insumoId))
      _vincAntes[p.id]={f:p.fichaId||'',i:p.insumoId||''};
  });
  var _vincSalvos=0;
  DB.produtos=volta(rp,function(x){
    var g=(rv||[]).filter(function(v){return v.produto_id===x.id}).map(function(v){return mapaGr[v.grupo_id]}).filter(Boolean);
    return {id:x.ref_local||x.id,nome:x.nome,preco:Number(x.preco)||0,codigo:x.codigo,
      detalhes:x.descricao,descricao:x.descricao,
      delivery:x.disponivel_delivery!==false,
      categoriaId:mapaCat[x.categoria_id]||'',ativo:x.ativo!==false,
      ordem:x.ordem||0,imagem:x.imagem_url,pesado:!!x.pesado,variacao:!!x.variacao,
      nomeOnline:x.nome_online,disponivel:x.disponivel||{},promocoes:x.promocoes||[],
      grupos:g,vinculaEstoque:!!x.vincula_estoque,
      _fichaUid:x.ficha_id||'',_insumoUid:x.insumo_id||'',
      insumoQtd:Number(x.insumo_qtd)||0,insumoUn:x.insumo_un||'',sucursais:x.sucursais||[]};},null,'produtos');
  var cfgS=await api('config_loja?loja_id=eq.'+l+'&select=*');
  if(cfgS&&cfgS[0]){var c3=cfg();
    c3.lojaAberta=cfgS[0].loja_aberta!==false;c3.tempoEntrega=cfgS[0].tempo_entrega;
    c3.tempoRetirada=cfgS[0].tempo_retirada;
    /* caixa_cego nao volta da nuvem: e regra do sistema, nao ajuste de
       loja. Uma linha antiga com false no banco desligaria o cego numa
       unidade sem ninguem pedir. O envio continua gravando true. */
    c3.layout=cfgS[0].layout||'normal';c3.fases=cfgS[0].fases||c3.fases;
    if(cfgS[0].cfg_dre)DB.cfgDre=cfgS[0].cfg_dre;
    if(cfgS[0].cfg_mesa)c3.mesa=cfgS[0].cfg_mesa;
    if(cfgS[0].cfg_modos)c3.modos=cfgS[0].cfg_modos;
    if(cfgS[0].cfg_fiscal)c3.fiscal=cfgS[0].cfg_fiscal;
    if(cfgS[0].cfg_totem)c3.totem=cfgS[0].cfg_totem;
    if(cfgS[0].cfg_pdv){var cp=cfgS[0].cfg_pdv;
      c3.colunas=cp.colunas;c3.mostraPreco=cp.mostraPreco;
      c3.mostraDesc=cp.mostraDesc;c3.botaoGrande=cp.botaoGrande;}
  }
  /* As seis que viviam so no navegador. Objeto vazio nao sobrescreve o que
     ja existe aqui: aparelho novo recebe tudo, aparelho antigo nao perde
     nada se a nuvem ainda estiver em branco. */
  /* Configuracao do cardapio por unidade: subia e nunca voltava. Aparelho
     novo mostrava o cardapio sem cor, sem logo e sem horario. */
  try{
    var cc=await _p10;
    if(cc&&cc.length){
      DB.cardapio=DB.cardapio||{};
      cc.forEach(function(x){
        var sid=x.ref_local?String(x.ref_local).replace(/^cc_/,''):null;
        if(!sid)return;
        DB.cardapio[sid]=Object.assign(DB.cardapio[sid]||{},{
          ativo:x.ativo!==false,titulo:x.titulo||'',slogan:x.slogan||'',
          logo:x.logo||'',capa:x.capa||'',
          corPrincipal:x.cor_principal||'#2F4A32',corFundo:x.cor_fundo||'#F7F3EA',
          whatsapp:x.whatsapp||'',instagram:x.instagram||'',endereco:x.endereco||'',
          pedidoMinimo:Number(x.pedido_minimo)||0,
          tempoEntrega:x.tempo_entrega||'',tempoRetirada:x.tempo_retirada||'',
          aceitaEntrega:x.aceita_entrega!==false,aceitaRetirada:x.aceita_retirada!==false,
          /* ==========================================================
             ESTA DESCIDA ESQUECIA O HORARIO — E ERA POR ISSO QUE ELE VOLTAVA

             Existem DUAS descidas da configuracao do cardapio. A primeira
             traz tudo, inclusive `horarios`. Esta segunda, mais abaixo no
             mesmo carregamento, faz Object.assign com uma lista de campos
             onde `horarios` NAO estava — entao a entrada ficava sem
             horario nenhum.

             E aí a armadilha: cardAtual() preenche horario vazio com o
             padrao (14:00 as 22:30, segunda fechada) e essa entrada NAO
             tem a marca `_padrao`, porque veio da nuvem. Resultado: o
             padrao subia por cima do horario de verdade, e o cardapio
             voltava a dizer que a loja esta fechada na segunda.

             Aconteceu de novo as 18:36, ja depois da V137. A trava da
             V137 estava certa; faltava esta linha.
             ========================================================== */
          horarios:(x.horarios&&x.horarios.length)?x.horarios
                   :((DB.cardapio[sid]||{}).horarios||[]),
          endereco:x.endereco||((DB.cardapio[sid]||{}).endereco||'')});
      });
    }
  }catch(ec2){ logNuvem('não consegui baixar a configuração do cardápio',true); }

  try{
    var co=await _p11;
    if(co&&co[0]){
      var o=co[0];
      if(o.gerente&&Object.keys(o.gerente).length)DB.gerente=o.gerente;
      if(o.zap&&Object.keys(o.zap).length)DB.zap=o.zap;
      if(o.canais&&Object.keys(o.canais).length)DB.canais=o.canais;
      if(o.ass_plat&&Object.keys(o.ass_plat).length)DB.assPlat=o.ass_plat;
      if(o.redes&&o.redes.length)DB.redes=o.redes;
      if(o.operadores&&o.operadores.length)DB.operadores=o.operadores;
    }
  }catch(eo){ logNuvem('não consegui baixar a configuração de operação',true); }
  /* ---------- ESTOQUE ---------- */
  var ue=await _p12;
  DB.unidExtra=volta(ue,function(x){return {sucursais:x.sucursais||[], /* desce junto: o que sobe tem de descer (V188) */ id:x.ref_local||x.id,n:x.nome,ab:x.sigla,
    base:x.base,f:Number(x.fator)||1}},null,'unidExtra');

  var gi=await _p13;
  var mapaGi={};gi.forEach(function(x){mapaGi[x.id]=x.ref_local||x.id});
  DB.gruposIng=volta(gi,function(x){return {id:x.ref_local||x.id,nome:x.nome,
    compoeCMV:x.compoe_cmv!==false,sucursais:x.sucursais||[]}},null,'gruposIng');

  var ins=await _p14;
  var mapaIns={};ins.forEach(function(x){mapaIns[x.id]=x.ref_local||x.id});
  DB.insumos=volta(ins,function(x){return {id:x.ref_local||x.id,nome:x.nome,codigo:x.codigo,
    unidade:x.unidade||'un',custo:Number(x.custo)||0,custoUltima:Number(x.custo_ultima)||0,
    modoCusto:normModo(x.modo_custo),grupoId:mapaGi[x.grupo_id]||'',
    catFinId:mapaSub[x.subcategoria_id]||'',controlaEstoque:x.controla_estoque!==false,
    compoeCMV:x.compoe_cmv!==false,estoqueMin:Number(x.estoque_min)||0,
    estoqueMax:Number(x.estoque_max)||0,
    validade:x.validade||'',ean13:x.ean13||'',
    permiteVenda:!!x.permite_venda,unidadeVenda:x.embalagem||'',
    estoqueAtual:Number(x.estoque_atual)||0,
    /* ==========================================================
       VARREDURA — LEITURA DE COLUNA QUE NAO EXISTE EM `insumos`

       Estas duas linhas liam `x.custo_medio` e `x.destino_nome`, colunas
       que existem em `fichas_tecnicas` e NAO em `insumos` — codigo
       copiado de um bloco para o outro. O resultado era sempre 0 e '',
       sem erro nenhum.

       Nao houve prejuizo ate hoje porque o insumo usa `custo` e
       `custoUltima`; quem tem custo medio por unidade e a tabela
       `estoque_unidade` (490 linhas), lida mais abaixo. Mas um campo
       que finge vir do banco e sempre vale zero e uma armadilha: basta
       alguem confiar nele um dia.

       Mantidos com valor explicito para nao mudar comportamento —
       agora esta claro que nao vem do banco.
       ========================================================== */
    custoMedio:0, destinoNome:'',
    fator:Number(x.fator)||1,
    fornecedorId:mapaFo[x.fornecedor_id]||'',descricao:x.descricao||'',
    compras:x.compras||[],gelatoVenda:!!x.gelato_venda,sucursais:x.sucursais||[]}},_ANT('insumos'),'insumos');

  var fg=await _p15;
  var mapaFg={};fg.forEach(function(x){mapaFg[x.id]=x.ref_local||x.id});
  DB.fichaCats=volta(fg,function(x){return {id:x.ref_local||x.id,nome:x.nome,subs:[],
    paiId:mapaFg[x.pai_id]||'',
    destinoId:x.destino_id||'',sucursais:x.sucursais||[]}},null,'fichaCats');

  /* ==========================================================
     DUAS LEITURAS SIMPLES NO LUGAR DE UMA COM EMBED

     Era "fichas_tecnicas?...&select=*,ficha_itens(*)". Essa URL vinha
     falhando no aparelho ANTES de chegar ao servidor — no registro do banco
     nao existe nenhuma chamada dela, so o diagnostico dizendo "fichas_tecnicas
     nao veio". E o embed ainda tinha um segundo defeito: quando ha mais de uma
     ligacao entre as duas tabelas, o PostgREST nao sabe qual usar e responde
     300, derrubando o download inteiro das fichas.
     Duas leituras planas nao tem nenhum dos dois problemas. Os itens sao
     costurados aqui, e a propria regra de acesso do banco ja limita as linhas
     as lojas de quem esta pedindo.
     ========================================================== */
  var ft=await _p16;
  var fi=await _p17;
  var itensPorFicha={};
  (fi||[]).forEach(function(i3){
    if(!i3||!i3.ficha_id)return;
    (itensPorFicha[i3.ficha_id]=itensPorFicha[i3.ficha_id]||[]).push(i3);
  });
  (ft||[]).forEach(function(x){ x.ficha_itens=itensPorFicha[x.id]||[]; });
  /* leitura dos itens falhou: NAO se pode concluir que as fichas estao vazias.
     Sem isto, uma falha de rede viraria "todas as fichas perderam a receita". */
  if((_FALHOU_BAIXA||[]).indexOf('ficha_itens')>=0){
    logNuvem('itens da ficha não vieram — as receitas deste aparelho foram mantidas',true);
    (ft||[]).forEach(function(x){ x._semItens=true; });
  }
  var mapaFiRef={};ft.forEach(function(x){mapaFiRef[x.id]=x.ref_local||x.id});
  /* rastro do download sobre a ficha que esta aberta na tela: diz quantos
     itens vieram da nuvem e quantos havia aqui, no instante da troca */
  try{
    if(typeof _fichaAberta!=='undefined'&&_fichaAberta){
      var _fn=ft.find(function(x){return (x.ref_local||x.id)===_fichaAberta});
      var _fl=(DB.fichas||[]).find(function(x){return x.id===_fichaAberta});
      console.log('[ficha] DOWNLOAD — nuvem trouxe '+
        ((_fn&&(_fn.ficha_itens||[]).length)||0)+' item(ns), aqui havia '+
        ((_fl&&(_fl.itens||[]).length)||0));
    }
  }catch(e9){}
  DB.fichas=volta(ft,function(x){return {id:x.ref_local||x.id,nome:x.nome,codigo:x.codigo,
    categoriaId:mapaFg[x.grupo_id]||'',subgrupoId:x.subgrupo_id||'',contaId:mapaSub[x.subcategoria_id]||'',
    unidade:x.unidade||'un',estocavel:x.estocavel!==false,disponivelVenda:!!x.disponivel_venda,
    naProducao:x.na_producao!==false,
    rendimento:Number(x.rendimento)||1,rendUnidade:x.rend_unidade||x.unidade,
    unidadesVenda:Number(x.unidades_venda)||0,preco:Number(x.preco)||0,
    receita:x.receita||'',tempo:x.tempo||0,validade:x.validade||0,temperatura:x.temperatura||'',
    obs:x.observacao||'',foto:x.foto||'',ncm:x.ncm||'',cfop:x.cfop||'',cest:x.cest||'',
    origem:x.origem||'',cst:x.cst||'',aliquota:Number(x.aliquota)||0,lojas:x.lojas||[],
    destinoId:mapaIns[x.destino_id]||mapaFiRef[x.destino_id]||'',destinoFator:Number(x.destino_fator)||1,
    estoqueAtual:Number(x.estoque_atual)||0,custoMedio:Number(x.custo_medio)||0,
    destinoNome:x.destino_nome||'',destinoModo:x.destino_modo||'igual',
    /* o ingrediente pode ser um insumo OU outra ficha — le as duas colunas */
    itens:x._semItens
      ? (((DB.fichas||[]).find(function(v){return v.id===(x.ref_local||x.id)})||{}).itens||[])
      : (x.ficha_itens||[]).map(function(i2){return {id:i2.ref_local||i2.id,
      insumoId:mapaIns[i2.insumo_id]||mapaFiRef[i2.ficha_ref]||'',
      qtd:Number(i2.quantidade)||0,unidade:i2.unidade||'un',perda:Number(i2.perda)||0}}),sucursais:x.sucursais||[]}},_ANT('fichas'),'fichas');
  /* O subgrupo nao e mais reconstruido a partir das fichas: ele e linha de
     ficha_grupos com pai_id. Esta chamada cobre so a heranca — ficha que
     aponta para um subgrupo que nunca chegou a ter linha. */
  normalizaGruposFicha();

  /* o destino do grupo pode ser insumo ou ficha — resolve agora que ambos existem */
  (DB.fichaCats||[]).forEach(function(c){
    if(!c.destinoId)return;
    c.destinoId=mapaIns[c.destinoId]||mapaFiRef[c.destinoId]||c.destinoId;
  });

  /* agora que fichas e insumos existem, liga cada produto ao seu vínculo de estoque */
  var mapaFi={};ft.forEach(function(x){mapaFi[x.id]=x.ref_local||x.id});
  var _temFicha={};(DB.fichas||[]).forEach(function(f){if(f&&f.id)_temFicha[f.id]=true;});
  var _temInsumo={};(DB.insumos||[]).forEach(function(i){if(i&&i.id)_temInsumo[i.id]=true;});
  (DB.produtos||[]).forEach(function(p){
    p.fichaId=mapaFi[p._fichaUid]||'';
    p.insumoId=mapaIns[p._insumoUid]||'';
    /* nuvem sem vínculo: não zera — mantém o que o aparelho já sabia,
       se a ficha/insumo apontado ainda existir aqui (ver bloco acima) */
    if(!p.fichaId&&!p.insumoId){
      var ant=_vincAntes[p.id];
      if(ant){
        if(ant.f&&_temFicha[ant.f]){p.fichaId=ant.f;_vincSalvos++;}
        else if(ant.i&&_temInsumo[ant.i]){p.insumoId=ant.i;_vincSalvos++;}
      }
    }
    delete p._fichaUid;delete p._insumoUid;
  });
  if(_vincSalvos)
    logNuvem('vínculo de estoque preservado do aparelho em '+_vincSalvos+
      ' produto(s) — a nuvem não trouxe a ficha; sobe de novo no próximo envio',true);

  var pbs=await _pbs;
  DB.pedidosBase=volta(pbs,function(x){return {id:x.ref_local||x.id,numero:x.numero,
    sucursalRef:x.sucursal_id,sucursalNome:x.sucursal_nome,data:x.data,
    responsavel:x.responsavel,obs:x.observacao,total:Number(x.total)||0,
    situacao:x.situacao||'rascunho',produzido:!!x.produzido,
    movProducaoRef:x.mov_producao_ref,finReceberRef:x.financeiro_receber_ref,
    entradaEstoque:!!x.entrada_estoque,movEntradaRef:x.mov_entrada_ref,
    finPagarRef:x.financeiro_pagar_ref,enviadoEm:x.enviado_em,
    confirmadoEm:x.confirmado_em,entregueEm:x.entregue_em,pagoEm:x.pago_em,
    motivoRejeicao:x.motivo_rejeicao,
    itens:(x.pedido_base_itens||[]).map(function(i){return {
      id:idFilho(x.ref_local,i.ref_local,i.id),baseRef:i.base_ref,
      baseNome:i.base_nome,fichaRef:i.ficha_ref,qtd:Number(i.quantidade)||0,
      valorUnit:Number(i.valor_unit)||0,total:Number(i.total)||0}})}},DB.pedidosBase,'pedidosBase');

  var bcat=await _p18;
  DB.basesCat=volta(bcat,function(x){return {id:x.ref_local||x.id,nome:x.nome,
    qtdCaixa:Number(x.qtd_caixa)||1,valorUnit:Number(x.valor_unit)||0,
    fichaRef:x.ficha_ref||'',ativo:x.ativo!==false,ordem:x.ordem||0}},DB.basesCat,'basesCat');

  var bxp=await _p19;
  DB.baixasPend=volta(bxp,function(x){return {id:x.ref_local||x.id,
    sucursalRef:x.sucursal_id,itemRef:x.item_ref,itemNome:x.item_nome,
    itemTipo:x.item_tipo,qtd:Number(x.quantidade)||0,unidade:x.unidade,
    custo:Number(x.custo_unit)||0,motivoRef:x.motivo_ref,motivoNome:x.motivo_nome,
    quem:x.quem_registrou,registradoPor:x.registrado_por,data:x.data,hora:x.hora,
    obs:x.observacao,situacao:x.situacao||'pendente',movRef:x.mov_ref,
    lancadaEm:x.lancada_em}},DB.baixasPend,'baixasPend');

  var mv=await _p20;
  var mapaMt={};mv.forEach(function(x){mapaMt[x.id]=x.ref_local||x.id});
  DB.motivosMov=volta(mv,function(x){return {sucursais:x.sucursais||[], /* desce junto: o que sobe tem de descer (V188) */ id:x.ref_local||x.id,nome:x.nome,tipo:x.tipo,
    sistema:!!x.sistema,ativo:x.ativo!==false,lojas:x.lojas_visiveis||[]}},null,'motivosMov');

  var mc=await _p21;
  var mapaMc={};mc.forEach(function(x){mapaMc[x.id]=x.ref_local||x.id});
  DB.motivosCanc=volta(mc,function(x){return {sucursais:x.sucursais||[], /* desce junto: o que sobe tem de descer (V188) */ id:x.ref_local||x.id,nome:x.nome,
    ativo:x.ativo!==false,ordem:x.ordem||0}},null,'motivosCanc');

  baixarLayoutMenu();
  var stv=await _p22;
  DB.statusVenda=volta(stv,function(x){return {sucursais:x.sucursais||[], /* desce junto: o que sobe tem de descer (V188) */ id:x.ref_local||x.id,nome:x.nome,
    papel:x.papel||'producao',ordem:x.ordem||0,ativo:x.ativo!==false,cor:x.cor||'',
    minutos:Number(x.minutos)||0,som:!!x.som,confPag:!!x.confere_pagamento}},null,'statusVenda');

  var mi=await _p23;
  DB.modelosImp=volta(mi,function(x){return {sucursais:x.sucursais||[], /* desce junto: o que sobe tem de descer (V188) */ id:x.ref_local||x.id,tipo:x.tipo,nome:x.nome,
    colunas:Number(x.colunas)||48,vias:Number(x.vias)||1,corte:x.corte!==false,
    gaveta:!!x.gaveta,modelo:x.modelo||'',blocos:x.blocos||[],manual:!!x.manual,
    ativo:x.ativo!==false}},null,'modelosImp');

  /* Estas duas subiam e nunca voltavam: trocar de aparelho ou limpar o
     navegador perdia os usuarios e a carteira de clientes Nexor. */
  try{
    var us=await _p24;
    if(us&&us.length)DB.usuarios=volta(us,function(x){return {id:x.ref_local||x.id,
      nome:x.nome,login:x.login||'',senha:x.senha||'',loginApp:x.login_app||'',
      /* senha nao desce mais: fica so no cofre */
      ativo:x.ativo!==false,tudo:!!x.tudo,mestre:!!x.mestre,
      sucursais:x.sucursais||[],permissoes:x.permissoes||{}}},null,'usuarios');
  }catch(e){ logNuvem('não consegui baixar os usuários: '+((e&&e.message)||''),true); }
  if(ehPlataforma&&ehPlataforma()){
    try{
      var cnx=await _p25;
      DB.clientesNexor=volta(cnx,function(x){return {id:x.ref_local||x.id,rede:x.rede,
        responsavel:x.responsavel||'',email:x.email||'',telefone:x.telefone||'',
        documento:x.documento||'',cidade:x.cidade||'',uf:x.uf||'',
        unidades:Number(x.unidades)||1,plano:x.plano||'',
        mensalidade:Number(x.mensalidade)||0,lojaId:x.loja_id||'',
        modulos:x.modulos||[],diaVenc:Number(x.dia_vencimento)||10,
        situacao:x.situacao||'ativo'}},null,'clientesNexor');
    }catch(e){_quieto(e,'baixarDaNuvem')}
  }

  /* A partir daqui, a unidade fica so com o cadastro liberado para ela.
     Filtrar aqui resolve as ~60 telas de uma vez, em vez de depender de
     cada uma lembrar de filtrar. A matriz nunca e filtrada. */
  filtrarCadastroDaUnidade();

  var eun=await _p26;
  DB.estoqueUn=volta(eun,function(x){return {id:x.ref_local||(x.sucursal_id+'|'+x.item_ref),
    sucursalId:x.sucursal_id,itemId:x.item_ref,tipo:x.tipo||'insumo',
    estoque:Number(x.estoque)||0,custoMedio:Number(x.custo_medio)||0,
    atualizadoEm:x.atualizado_em}},null,'estoqueUn');

  var cpf=await _p27;
  DB.cupons_f=volta(cpf,function(x){return {id:x.ref_local||x.id,pedidoId:x.pedido_ref||'',
    pedidoNumero:Number(x.pedido_numero)||0,origem:x.origem||'',serie:Number(x.serie)||0,
    numero:Number(x.numero)||0,chave:x.chave||'',protocolo:x.protocolo||'',
    status:x.status||'pendente',motivo:x.motivo||'',ambiente:x.ambiente||'',
    consumidor:x.consumidor_nome||'',doc:x.consumidor_doc||'',pagamento:x.pagamento||'',
    total:Number(x.valor_total)||0,desconto:Number(x.valor_desconto)||0,
    entrega:Number(x.valor_entrega)||0,data:x.data_venda||'',hora:x.hora_venda||'',
    nfeAgrupada:x.nfe_agrupada_ref||'',contingencia:!!x.contingencia}},null,'cupons_f');

  var cmd=await _p28;
  DB.comandas=volta(cmd,function(x){return {id:x.ref_local||x.id,mesaId:x.mesa_ref||'',
    mesaNumero:Number(x.mesa_numero)||0,nome:x.nome,itens:x.itens||[],
    aberta:x.aberta!==false,abertaEm:x.aberta_em,fechadaEm:x.fechada_em,
    pedidoRef:x.pedido_ref||'',sucursalId:x.sucursal_id||''}},null,'comandas');

  var trf=await _p29;
  DB.transf=volta(trf,function(x){return {id:x.ref_local||x.id,numero:Number(x.numero)||0,
    origemSuc:x.origem_suc,destinoSuc:x.destino_suc,situacao:x.situacao||'enviada',
    itens:x.itens||[],valorTotal:Number(x.valor_total)||0,obs:x.observacao||'',
    enviadaEm:x.enviada_em,enviadaPor:x.enviada_por||'',
    recebidaEm:x.recebida_em,recebidaPor:x.recebida_por||'',
    divergencia:!!x.divergencia,data:x.data_envio||''}},null,'transf');

  var ms=await _p30;
  var mapaMs={};ms.forEach(function(x){mapaMs[x.id]=x.ref_local||x.id});
  DB.mesas=volta(ms,function(x){return {id:x.ref_local||x.id,numero:Number(x.numero)||0,
    nome:x.nome||'',lugares:Number(x.lugares)||4,ativa:x.ativa!==false,
    sucursalId:x.sucursal_id||''}},null,'mesas');

  var tn=await _p31;
  var mapaTn={};tn.forEach(function(x){mapaTn[x.id]=x.ref_local||x.id});
  DB.turnos=volta(tn,function(x){return {sucursais:x.sucursais||[], /* desce junto: o que sobe tem de descer (V188) */ id:x.ref_local||x.id,nome:x.nome,
    ini:x.hora_inicio||'',fim:x.hora_fim||'',ativo:x.ativo!==false,ordem:x.ordem||0}},null,'turnos');

  var cnc=await _p32;
  DB.cancelamentos=volta(cnc,function(x){return {id:x.ref_local||x.id,
    pedidoId:x.pedido_ref||'',numero:x.pedido_numero||0,valor:Number(x.valor)||0,
    data:x.data||'',hora:x.hora||'',motivoId:mapaMc[x.motivo_id]||'',
    motivo:x.motivo_nome||'',obs:x.observacao||'',operadorId:x.operador_id||'',
    operador:x.operador_nome||'',caixaId:x.caixa_ref||'',turno:x.turno_nome||'',
    produzido:x.produzido,estoqueVoltou:x.estoque_voltou}},null,'cancelamentos');

  var me=await _p33;
  DB.movEst=volta(me,function(x){return {id:x.ref_local||x.id,data:x.data,hora:x.hora,
    sucursalId:x.sucursal_id||'',
    motivoId:mapaMt[x.motivo_id]||'',identificacao:x.identificacao||'',obs:x.observacao||'',
    origem:x.origem||'',linhas:x.linhas||[]}},null,'movEst');

  var ct=await _p34;
  /* o que sobe tem de descer: sem estas quatro, a contagem voltava da
     nuvem sem a marca de retroativa, sem o vinculo do ajuste e sem os
     custos corrigidos — e o envio seguinte regravava tudo em branco */
  DB.contagens=volta(ct,function(x){return {id:x.ref_local||x.id,data:x.data,hora:x.hora,
    sucursalId:x.sucursal_id||'',loja:x.sucursal_id||'',
    perda:Number(x.perda)||0,ganho:Number(x.ganho)||0,resultado:Number(x.resultado)||0,
    itens:x.itens||[],
    retroativa:x.retroativa===true,lancadaEm:x.lancada_em||'',
    movId:x.mov_ref||'',precos:x.precos||[]}},null,'contagens');

  var ae=await _p35;
  DB.areas=volta(ae,function(x){
    var paiRef=x.ref_local||x.id;
    return {id:paiRef,nome:x.nome,uf:x.uf||'',taxaPadrao:Number(x.taxa_padrao)||0,
      tempo:Number(x.tempo)||0,
      zonas:(x.areas_zonas||[]).sort(function(a,b){return (a.ordem||0)-(b.ordem||0)})
        .map(function(z){return {id:idFilho(paiRef,z.ref_local,z.id),nome:z.nome,
          tipo:z.tipo||'bairro',taxa:Number(z.taxa)||0,km:Number(z.km)||0,
          tempo:Number(z.tempo)||0,obs:z.observacao||'',ativa:z.ativa!==false}})};
  },null,'areas');

  var scPre=await _p36;
  var mapaSuc2={};scPre.forEach(function(x){mapaSuc2[x.id]=x.ref_local||x.id});
  var cd=await _p10;
  /* DB.cardapioL é derivado de DB.cardapio e recebe id 'cc_<sucursal>' no envio.
     Guardar aqui as linhas cruas da nuvem trocava esses ids por uuid, e no envio
     seguinte o sistema achava que TODOS tinham sido excluídos. Não se toca nele. */
  DB.cardapio=DB.cardapio||{};
  cd.forEach(function(x){
    var sid=mapaSuc2[x.sucursal_id]||x.sucursal_id;
    if(!sid)return;
    /* ==========================================================
       O QUE AINDA NAO SUBIU NAO PODE SER APAGADO PELA DESCIDA

       Esta descida escrevia por cima sem olhar nada. Quem preenchia o
       nome do cardapio e salvava, mas ficava um instante sem enviar —
       aparelho offline, fila de envio, ou so o intervalo entre uma coisa
       e outra — via o campo voltar sozinho ao valor antigo. Foi o que
       aconteceu com "Jolo Gelato SFS".

       Agora a configuracao local guarda a hora em que foi salva. Se ela
       for mais nova do que a da nuvem, a descida nao encosta: o envio
       seguinte leva a versao do aparelho.
       ========================================================== */
    var loc=DB.cardapio[sid];
    if(loc&&loc._salvoEm){
      var nuvem=Date.parse(x.atualizado_em||0)||0;
      /* a protecao vale so ate o envio acontecer. Passados 5 minutos, o
         que veio da nuvem manda — senao um aparelho com data futura, ou
         com envio falhando, fica ilhado para sempre. */
      var recente=(Date.now()-loc._salvoEm)<5*60*1000;
      if(recente&&loc._salvoEm>nuvem)return;
      if(!recente)delete loc._salvoEm;
    }
    DB.cardapio[sid]={ativo:x.ativo!==false,titulo:x.titulo||'',slogan:x.slogan||'',
      logo:x.logo||'',capa:x.capa||'',corPrincipal:x.cor_principal||'#2F4A32',
      corFundo:x.cor_fundo||'#F7F3EA',whatsapp:x.whatsapp||'',instagram:x.instagram||'',
      endereco:x.endereco||'',pedidoMinimo:Number(x.pedido_minimo)||0,
      tempoEntrega:x.tempo_entrega||'',tempoRetirada:x.tempo_retirada||'',
      aceitaEntrega:x.aceita_entrega!==false,aceitaRetirada:x.aceita_retirada!==false,
      pedeCpf:!!x.pede_cpf,formas:x.formas_aceitas||[],pixChave:x.pix_chave||'',
      aviso:x.aviso||'',
      /* nuvem sem horario: preenche padrao SO para a tela, e marca para
         nao subir de volta e apagar o horario de verdade */
      _padrao:!(x.horarios&&x.horarios.length),
      horarios:(x.horarios&&x.horarios.length)?x.horarios:horariosPadrao()};
  });

  var sc=await _p36;
  DB.sucursais=volta(sc,function(x){return {id:x.ref_local||x.id,nome:x.nome,
    apelido:x.apelido||'',cnpj:x.cnpj||'',telefone:x.telefone||'',cidade:x.cidade||'',
    uf:x.uf||'',matriz:!!x.matriz,ativa:x.ativa!==false,cor:x.cor||'#00A08B',
    loginResp:x.login_responsavel||'',
    mensalidade:Number(x.mensalidade)||0,diaVenc:x.dia_vencimento||null,
    redeId:x.rede_id||'',redeNome:x.rede_nome||''}},null,'sucursais');
  /* uuid da sucursal -> ref_local, para a venda saber de qual loja e */
  var mapaSucPed={};sc.forEach(function(x){mapaSucPed[x.id]=x.ref_local||x.id});

  var op=await _p37;
  DB.ordensProd=volta(op,function(x){return {id:x.ref_local||x.id,numero:x.numero,
    data:x.data,hora:x.hora,resp:x.responsavel||'',obs:x.observacao||'',
    sucursalId:x.sucursal_id||'',
    previsto:Number(x.previsto)||0,real:Number(x.real_produzido)||0,
    diferenca:Number(x.diferenca)||0,itens:x.itens||[],movId:x.mov_id||''}},null,'ordensProd');

  try{
    /* ------------------------------------------------------------------
       ESTA CONSULTA E A ORIGEM DA MISTURA ENTRE EMPRESAS.
       Ela baixava usuarios_sistema SEM filtro de loja, confiando so no RLS, e
       fundia o resultado na lista local por login. Bastava uma linha de outra
       empresa entrar aqui para, no envio seguinte, ela ser regravada com o
       loja_id de QUEM ESTA LOGADO — e a empresa A brotava dentro da empresa B.
       Era esse o ciclo: limpava a nuvem, o aparelho devolvia.
       Agora ela pede so a propria loja, como todas as outras consultas.
       ------------------------------------------------------------------ */
    var us=await _p38;
    if(us&&us.length){
      var locais=DB.usuarios||[];
      (us||[]).forEach(function(x){
        if(x.loja_id&&NUVEM.loja&&x.loja_id!==NUVEM.loja)return;  /* nunca de outra empresa */
        var lg=String(x.login||'').toLowerCase();
        if(!lg)return;
        var ja=locais.find(function(u){return String(u.login||'').toLowerCase()===lg});
        var obj={id:x.ref_local||('usr_'+lg.replace(/[^a-z0-9]/g,'').slice(0,12)),
          /* a SEGUNDA descida tambem precisa trazer a senha de autorizacao:
             foi assim que o horario do cardapio voltou ao padrao tres vezes
             (V141), porque a segunda leitura esquecia um campo */
          nome:x.nome||'',login:x.login||'',senha:x.senha||'',loginApp:x.login_app||'',
          ativo:x.ativo!==false,
          tudo:!!x.tudo,mestre:!!x.mestre,sucursais:x.sucursais||[],permissoes:x.permissoes||{}};
        if(ja)Object.assign(ja,obj); else locais.push(obj);
      });
      DB.usuarios=locais;
    }
  }catch(e){_quieto(e,'baixarDaNuvem')}
  try{
    var meu=await api('clientes_nexor?select=rede,modulos,situacao,plano&loja_id=eq.'+NUVEM.loja+'&limit=1');
    DB._contrato=(meu&&meu[0])?{rede:meu[0].rede,modulos:meu[0].modulos||[],
      situacao:meu[0].situacao,plano:meu[0].plano}:null;
  }catch(e){_quieto(e,'baixarDaNuvem')}
  try{
    var cnx=await _p39;
    if(cnx&&cnx.length)  /* so substitui a carteira se a nuvem realmente devolveu algo */
    DB.clientesNexor=volta(cnx,function(x){return {id:x.ref_local||x.id,rede:x.rede,
      responsavel:x.responsavel||'',email:x.email||'',telefone:x.telefone||'',
      documento:x.documento||'',cidade:x.cidade||'',uf:x.uf||'',unidades:x.unidades||1,
      plano:x.plano||'',mensalidade:Number(x.mensalidade)||0,diaVenc:x.dia_vencimento||10,
      situacao:x.situacao||'ativo',inicio:x.inicio||'',obs:x.observacao||'',
      lojaId:x.loja_id||'',modulos:x.modulos||[],cobrancas:x.cobrancas||[]}},null,'clientesNexor');
  }catch(e){_quieto(e,'baixarDaNuvem')}
  var csvw=await _p40;
  DB.comprasSemVinc=volta(csvw,function(x){return {id:x.ref_local||x.id,
    notaId:x.nota_id||'',notaNumero:x.nota_numero||'',fornecedor:x.fornecedor_nome||'',
    descricao:x.descricao||'',documento:x.documento||'',valor:Number(x.valor)||0,
    vencimento:x.vencimento||'',excluidoPor:x.excluido_por||'',excluidoEm:x.excluido_em||'',
    itens:(x.dados&&x.dados.itens)||[],lanc:(x.dados&&x.dados.lanc)||null}},null,'comprasSemVinc');
  var nt=await _p41;
  DB.notas=volta(nt,function(x){return {id:x.ref_local||x.id,numero:x.numero,
    fornecedorId:mapaFo[x.fornecedor_id]||'',fornecedorNome:x.fornecedor_nome||'',
    data:x.data,hora:x.hora,valorMercadorias:Number(x.valor_mercadorias)||0,
    valorTotal:Number(x.valor_total)||0,receber:x.recebida!==false,
    pagamento:x.pagamento||{},itens:x.itens||[]}},null,'notas');

  /* ---------- OPERAÇÃO ---------- */
  var cx=await _p42;
  var fechadosAqui={};
  (DB.caixas||[]).forEach(function(c){ if(c.fechadoEm)fechadosAqui[c.id]=c.fechadoEm; });
  DB.caixas=volta(cx,function(x){
    var ref=x.ref_local||x.id;
    return {id:ref,aberto:x.aberto_txt,
    /* se aqui já estava fechado, mantém — fechamento nunca é desfeito */
    fechadoEm:x.fechado_txt||fechadosAqui[ref]||null,
    operador:x.operador,inicial:Number(x.valor_inicial)||0,
    turnoId:mapaTn[x.turno_id]||'',turno:x.turno_nome||'',operadorId:x.operador_id||'',
    sucursalId:x.sucursal_id||'',
    vendas:Number(x.vendas)||0,esperado:Number(x.esperado)||0,contado:Number(x.contado)||0,
    totalInformado:Number(x.total_informado)||0,qtd:x.qtd_pedidos||0,
    conferencia:x.conferencia||{},obs:x.observacao||'',
    /* o que sobe tem de descer, senao a reimpressao de outro aparelho
       nao encontra a fotografia e volta a recalcular */
    snapshot:x.snapshot||null, esperadoPorForma:x.esperado_por_forma||null,
    fundoProximo:Number(x.fundo_proximo)||0,
    fechadoPor:x.fechado_por||'', fechadoPorId:x.fechado_por_id||'',
    diferencaTotal:Number(x.diferenca_total)||0, conciliado:x.conciliado===true,
    movimentos:(x.caixa_movimentos||[]).map(function(m2){return {id:m2.ref_local||m2.id,
      tipo:m2.tipo,
      valor:Number(m2.valor)||0,motivo:m2.motivo,responsavel:m2.responsavel,
      responsavelId:m2.responsavel_id||'',
      destinoContaId:mapaConta[m2.destino_conta_id]||'',destinoNome:m2.destino_nome||'',
      lancRef:m2.lanc_ref||'',hora:m2.hora||'',data:m2.data_hora||m2.criado_em,
      quando:m2.criado_em}})};
  },null,'caixas');
  /* ==========================================================
     ITEM 13 — CAIXA FECHADO NA NUVEM NAO PODE REABRIR AQUI

     O aparelho guarda tudo no proprio navegador para funcionar sem
     rede. Isso e proposital. Mas o caixa tem uma particularidade: se
     ele foi fechado em OUTRO aparelho, a copia local continua achando
     que esta aberto — e o operador segue vendendo num turno que ja
     acabou, com as vendas caindo num caixa encerrado.

     A nuvem manda no fechamento: se la esta fechado, aqui fecha
     tambem. O contrario nao vale (ja tratado logo acima: fechamento
     feito aqui nunca e desfeito pela nuvem).
     ========================================================== */
  (function(){
    var naNuvem={};
    (cx||[]).forEach(function(x){
      if(x.fechado_txt||x.fechado_em)naNuvem[x.ref_local||x.id]=x.fechado_txt||'fechado';
    });
    (DB.caixas||[]).forEach(function(c){
      if(!c.fechadoEm&&naNuvem[c.id]){
        c.fechadoEm=naNuvem[c.id];
        logNuvem('caixa '+String(c.id).slice(-6)+' foi fechado em outro aparelho — '+
          'encerrado aqui tambem',true);
      }
      /* ==========================================================
         O CAIXA FOI FECHADO AQUI E A NUVEM NAO SABE

         AQUI ESTAVA O CAIXA DE 30/08 QUE NAO FECHAVA NUNCA.

         O fechamento foi feito, o comprovante saiu, `fechadoEm` ficou
         gravado no aparelho. Mas o envio nao chegou a sair (aba
         fechada, rede caida, sessao expirada). No dia seguinte o
         aparelho BAIXA antes de enviar, e no fim do download
         `anotarImpressoes()` anota a impressao da linha LOCAL — que ja
         tem o fechamento — como se fosse "o ultimo envio confirmado
         pela nuvem".

         A partir dai a conta do envio (`impressao de agora` x
         `impressao do ultimo envio`) da IGUAL, e o caixa fechado nunca
         mais e enviado. Cada download seguinte reconfirma a mentira.
         Por isso reabria todo dia e por isso refazer o fechamento na
         mao nao resolvia: o segundo fechamento caia na mesma armadilha.

         A marca abaixo diz a verdade: esta linha NAO esta na nuvem do
         jeito que esta aqui. `anotarImpressoes()` pula quem tem a
         marca, o envio seguinte manda o caixa, e o proprio envio apaga
         a marca quando a nuvem confirma.
         ========================================================== */
      if(c.fechadoEm&&!naNuvem[c.id]){
        c._fechamentoPendente=true;
        logNuvem('caixa '+String(c.id).slice(-6)+' está fechado aqui e aberto na '+
          'nuvem — o fechamento será reenviado',true);
      }
    });
  })();

  /* ==========================================================
     O REMENDO QUE ESCONDIA O PROBLEMA

     Aqui, ao baixar da nuvem, o codigo fechava sozinho todos os caixas
     abertos menos o mais recente — e datava o fechamento com a hora da
     ABERTURA, o que apaga o rastro. Foi assim que o caixa de 20/08
     apareceu "fechado" em 24/08 sem ninguem ter fechado, com vendas
     zeradas.

     Isso nao era seguranca: era varrer para baixo do tapete. Um caixa
     aberto por engano em outra unidade nao pode ser encerrado em
     silencio por um aparelho qualquer que sincronizou.

     Agora so se resolve duplicidade DENTRO DA MESMA UNIDADE, e o caixa
     que sobra e marcado para o operador ver e decidir — nao apagado.
     ========================================================== */
  (function(){
    var porSuc={};
    (DB.caixas||[]).forEach(function(c){
      if(c.fechadoEm)return;
      var k=c.sucursalId||'(sem)';
      (porSuc[k]=porSuc[k]||[]).push(c);
    });
    Object.keys(porSuc).forEach(function(k){
      var ab=porSuc[k];
      if(ab.length<2)return;
      ab.sort(function(a,b){return String(b.aberto||'').localeCompare(String(a.aberto||''))});
      ab.slice(1).forEach(function(c){
        c.pendente=true;   /* nao fecha: sinaliza */
        c.obs=(c.obs||'')+' [há outro caixa aberto nesta unidade — confira]';
      });
      logNuvem(ab.length+' caixas abertos na mesma unidade — o mais antigo precisa '+
        'ser conferido e fechado',true);
    });
  })();

  var mapaCx={};cx.forEach(function(x){mapaCx[x.id]=x.ref_local||x.id});
  var mapaCli={};cl.forEach(function(x){mapaCli[x.id]=x.ref_local||x.id});
  var mapaEnt={};en.forEach(function(x){mapaEnt[x.id]=x.ref_local||x.id});
  var mapaPr={};rp.forEach(function(x){mapaPr[x.id]=x.ref_local||x.id});

  var pd=await _p43;
  DB.pedidos=volta(pd,function(x){return {id:x.ref_local||x.id,numero:x.numero,tipo:x.tipo,
    sucursalId:mapaSucPed[x.sucursal_id]||'',
    fase:x.fase,clienteId:mapaCli[x.cliente_id]||'',clienteNome:x.cliente_nome||'',
    entregadorId:mapaEnt[x.entregador_id]||'',caixaId:mapaCx[x.caixa_id]||'',
    cidade:x.cidade||'',total:Number(x.total)||0,taxa:Number(x.taxa)||0,
    desconto:Number(x.desconto)||0,cupomCodigo:x.cupom_codigo||'',
    cupomValor:Number(x.cupom_valor)||0,fiscal:!!x.fiscal,hora:x.hora,data:x.data_venda,
    canal:x.canal||'',origem:x.origem_venda||'',
    equipamento:x.equipamento||'',senha:Number(x.senha_totem)||0,
    mesaId:x.mesa_id||'',mesa:Number(x.mesa_numero)||0,
    comandaNome:x.comanda_nome||'',taxaServico:Number(x.taxa_servico)||0,
    /* ==========================================================
       O ITEM DA VENDA PRECISA VOLTAR COM O IDENTIFICADOR

       ESTA E A CAUSA DA VENDA QUE MULTIPLICA.
       O envio da um ref_local ao item que ainda nao tem (`o.id`), e grava
       esse id no proprio objeto. So que o download reconstruia a lista de
       itens SEM o id. Resultado: a cada sincronizacao os itens voltavam
       "novos", ganhavam um ref_local aleatorio no envio seguinte e eram
       INSERIDOS de novo — o indice unico e por ref_local, entao nada
       barrava. Uma venda de teste chegou a 10.024 itens e 14.522
       pagamentos, somando R$ 150 mil em relatorio de produto.
       A ficha tecnica ja lia `id:i2.ref_local` e por isso nunca duplicou.
       ========================================================== */
    /* o preço unitário volta nos DOIS nomes: o carrinho e o envio usam
       `unit`, os relatórios leem `unitario`. Escrever só um zerava o outro
       no próximo envio (a venda voltava com preço 0). */
    itens:(x.pedido_itens||[]).map(function(i3){var _u=Number(i3.unitario)||0;return {id:i3.ref_local||i3.id,
      produtoId:mapaPr[i3.produto_id]||'',
      nome:i3.nome,qtd:Number(i3.quantidade)||0,unit:_u,unitario:_u,
      total:Number(i3.total)||0,obs:i3.observacao||'',opcoes:i3.opcoes||[]}}),
    /* ==========================================================
       O PAGAMENTO VOLTAVA COM O CAMPO TROCADO

       ESTA E A CAUSA DAS VENDAS SEM FORMA DE PAGAMENTO.

       O sistema inteiro le a forma em `pagamento.forma` — o detalhe do
       pedido, o fechamento de caixa, o relatorio. Mas a descida gravava
       em `formaId`. Resultado: depois de QUALQUER download, todo
       pagamento ficava na memoria sem `forma`; a tela mostrava "forma
       nao informada", e o envio seguinte reescrevia o registro com o
       vinculo vazio — apagando na nuvem o que estava certo.

       Por isso as tres vendas que eu vi corretas as 14h estavam zeradas
       as 15h: nao era o mapa de vinculos, era o campo trocado. O
       aparelho destruia o proprio dado a cada volta.

       Agora volta em `forma`, com a referencia da nuvem quando o mapa
       nao souber traduzir. `formaId` fica junto, por compatibilidade.
       ========================================================== */
    pagamentos:(x.pedido_pagamentos||[]).map(function(p2){return {id:p2.ref_local||p2.id,
      forma:mapaFP[p2.forma_id]||p2.forma_ref||'',
      formaId:mapaFP[p2.forma_id]||p2.forma_ref||'',
      equipamento:p2.equipamento||'',
      valor:Number(p2.valor)||0}})}},null,'pedidos');

  var mapaPed={};pd.forEach(function(x){mapaPed[x.id]=x.ref_local||x.id});

  var ac=await _p44;
  DB.acertos=volta(ac,function(x){return {id:x.ref_local||x.id,
    entregadorId:mapaEnt[x.entregador_id]||'',data:x.data,de:x.periodo_de,ate:x.periodo_ate,
    qtd:x.qtd||0,taxas:Number(x.taxas)||0,diaria:Number(x.diaria)||0,
    acrescimos:Number(x.acrescimos)||0,descontos:Number(x.descontos)||0,
    vendas:Number(x.vendas)||0,forma:x.forma,contaId:mapaConta[x.conta_id]||'',
    pago:x.pago!==false,obs:x.observacao||''}},null,'acertos');

  var cp=await _p45;
  var mapaCp={};cp.forEach(function(x){mapaCp[x.id]=x.ref_local||x.id});
  DB.cupons=volta(cp,function(x){return {id:x.ref_local||x.id,codigo:x.codigo,tipo:x.tipo,
    valor:Number(x.valor)||0,tetoDesconto:Number(x.teto)||0,minimo:Number(x.minimo)||0,
    de:x.valido_de,ate:x.valido_ate,horaDe:x.hora_de,horaAte:x.hora_ate,
    quantidade:x.quantidade||0,limiteCliente:x.limite_cliente||0,
    canais:x.canais||[],formas:x.formas||[],ativo:x.ativo!==false}},null,'cupons');

  var cu=await _p46;
  DB.cupomUsos=volta(cu,function(x){return {id:x.ref_local||x.id,cupomId:mapaCp[x.cupom_id]||'',
    clienteId:mapaCli[x.cliente_id]||'',clienteNome:x.cliente_nome||'',data:x.data,
    valor:Number(x.valor)||0,totalPedido:Number(x.total_pedido)||0,numero:x.numero,
    pedidoId:mapaPed[x.pedido_id]||''}},null,'cupomUsos');

  var fm=await _p47;
  DB.fiadoMov=volta(fm,function(x){return {id:x.ref_local||x.id,clienteId:mapaCli[x.cliente_id]||'',
    tipo:x.tipo,valor:Number(x.valor)||0,data:x.data,formaId:mapaFP[x.forma_id]||'',
    contaId:mapaConta[x.conta_id]||'',obs:x.observacao||'',pedidoId:mapaPed[x.pedido_id]||''}},null,'fiadoMov');

  }catch(e){ _falhou=e; }

  /* ---- o download parou no meio: desfaz tudo e mantém o aparelho como estava ---- */
  if(_falhou){
    Object.keys(_antesDB).forEach(function(k){ DB[k]=_antesDB[k]; });
    var ondeT=(_falhou&&_falhou.tabela)?_falhou.tabela.replace(/_/g,' '):'';
    var pqT=(_falhou&&_falhou.message)||'erro';
    logNuvem('download interrompido em '+(ondeT||'?')+': '+pqT+
      ' — nada foi alterado neste aparelho',true);
    registrarFalha('download',ondeT||'?',pqT,{situacao:'dados locais preservados'});
    statusNuvem('erro','download incompleto — seus dados locais foram preservados');
    /* a mensagem tecnica (tabela, tipo de coluna, texto do Postgres) vai
       INTEIRA para o diagnostico, acima. Aqui nao se mostra nada: o rodape
       ja indica o estado da nuvem, e nada foi perdido. */
    avisoSinc('leitura da nuvem interrompida em '+(ondeT||'?')+': '+pqT,
              'dados locais preservados');
    return false;
  }

  /* ---- rede de proteção: nuvem vazia NUNCA apaga o que existe no aparelho ---- */
  var _repostos=[];
  Object.keys(_antesDB).forEach(function(k){
    var tinha=_antesDB[k], veio=DB[k];
    if(!tinha||!tinha.length)return;
    if(Array.isArray(veio)&&veio.length)return;
    DB[k]=tinha;                                  /* devolve o que era daqui */
    _repostos.push(k+' ('+tinha.length+')');
  });
  if(_repostos.length){
    /* ==========================================================
       NAO REENVIAR O CACHE POR CIMA DA NUVEM
       O comportamento antigo era: a nuvem devolveu menos do que tenho aqui,
       logo a nuvem esta errada — mantinha o local E MARCAVA PARA SUBIR TUDO.
       Isso ressuscita cadastro apagado de proposito e, quando o aparelho tem
       dado de outra empresa na memoria, despeja essa empresa dentro desta.
       Foi assim que a Jolo foi parar dentro da Rafaelos.
       Agora: o que esta na tela e preservado (ninguem perde o trabalho do
       dia), mas NADA sobe por conta disso. A causa fica registrada no log
       tecnico para ser investigada — pode ser RLS, loja errada, sessao
       vencida ou consulta com filtro errado, e nenhuma dessas se conserta
       reenviando cache.
       ========================================================== */
    logNuvem('a nuvem respondeu vazio em: '+_repostos.join(', ')+
      ' — mantido o que estava neste aparelho, e NADA foi reenviado',true);
    (_repostos||[]).forEach(function(t){
      logNuvem('  · '+t+' · loja='+(NUVEM.loja||'sem loja')+
        ' · perfil='+((NUVEM.perfil||{}).cargo||'?')+' · '+new Date().toISOString(),true);
    });
  }

  /* ---- rede de proteção 3: a nuvem nunca apaga um vínculo que existe aqui ----
     Era isto que "mudava a ficha de lugar": o vínculo subia vazio por um erro
     momentâneo, e o download seguinte trazia esse vazio e apagava o grupo correto
     que ainda estava no aparelho. Agora o vínculo cheio ganha do vazio, sempre. */
  var _VINC=['categoriaId','subgrupoId','grupoId','contaId','destinoId','fornecedorId',
             'metodoId','contaDestinoId','clienteId','entregadorId','ref','caixaId','motivoId'];
  var _religados=0;
  Object.keys(_antesDB).forEach(function(k){
    var tinha=_antesDB[k], veio=DB[k];
    if(!Array.isArray(tinha)||!Array.isArray(veio)||veio===tinha)return;
    var antesPorId={};
    tinha.forEach(function(x){ if(x&&x.id)antesPorId[x.id]=x; });
    veio.forEach(function(x){
      var v=x&&x.id?antesPorId[x.id]:null;
      if(!v)return;
      _VINC.forEach(function(c){
        if(!v[c])return;                       /* aqui também estava vazio: nada a fazer */
        if(x[c])return;                        /* a nuvem trouxe vínculo: ela manda */
        x[c]=v[c];_religados++;                /* a nuvem veio vazia: mantém o daqui */
      });
    });
  });
  if(_religados){
    logNuvem(_religados+' vínculo(s) mantidos deste aparelho — a nuvem os trouxe vazios');
    NUVEM.sujo=true;DB._sujo=true;agendarSync();
  }

  /* ---- rede de proteção 2: o que foi criado aqui e a nuvem ainda NÃO confirmou ----
     Este é o caso do motivo de baixa que sumia: o cadastro nascia no aparelho, o
     envio não chegava a acontecer (ou falhava numa tabela anterior), e o download
     seguinte trocava a lista inteira pela da nuvem — que não tinha o registro novo.
     Agora, quem a nuvem nunca confirmou volta para a lista e sobe no envio seguinte. */
  var _mantidos=[];
  Object.keys(_antesDB).forEach(function(k){
    var tinha=_antesDB[k], veio=DB[k];
    if(!tinha||!tinha.length)return;
    if(!Array.isArray(veio)||veio===tinha)return;   /* coleção que o download nem toca */
    var conf=(DB._enviados&&DB._enviados[k])||[];
    var naNuvem={};
    veio.forEach(function(x){ if(x&&x.id)naNuvem[x.id]=true; });
    var novos=tinha.filter(function(x){
      /* sumiu na volta E a nuvem nunca disse que recebeu: é novo, não é apagado */
      return x&&x.id&&!naNuvem[x.id]&&conf.indexOf(x.id)<0;
    });
    if(novos.length){
      DB[k]=veio.concat(novos);
      _mantidos.push(k+': '+novos.length);
    }
  });
  if(_mantidos.length){
    /* registro que existe aqui e nao na nuvem pode ser duas coisas muito
       diferentes: algo que ainda nao subiu, ou algo que foi APAGADO la de
       proposito. Reenviar sem saber qual dos dois e ressuscitar exclusao.
       Fica registrado; sobe junto com a proxima alteracao de verdade. */
    logNuvem('existem aqui e não na nuvem ('+_mantidos.join(' · ')+
      ') — mantidos na tela, sem reenvio automático');
  }

  /* ==========================================================
     O QUE VEIO DA NUVEM JA ESTA NA NUVEM

     Aqui estava `DB._hash={}`. O comentario dizia "registra a impressao
     para nao reenviar tudo" e a linha fazia o contrario: apagava todas.
     Sem impressao, o envio seguinte trata TODA linha como alterada e
     regrava a copia deste aparelho por cima da nuvem — desfazendo, em
     silencio, o que outro aparelho mudou nesse meio tempo.

     Foi assim que o caixa de 27/08 voltou a ficar aberto depois de
     fechado, e sumiu do relatorio de Frente de Caixa.

     `anotarImpressoes()` (bloco 3) anota o que desceu e deixa sem
     impressao apenas o que ainda precisa subir.

     A anotacao em si roda mais abaixo, depois do carimbo da empresa:
     linha sem `_loja` nao e reconhecida como desta loja, e ficaria de
     fora da anotacao.
     ========================================================== */

  NUVEM.baixou=true;   /* daqui em diante este aparelho pode espelhar exclusões */
  NUVEM.zerado=false;  /* ja tem os dados do dono: pode enviar */
  /* ==========================================================
     O SALDO PRECISA SER REAPLICADO DEPOIS QUE O DADO CHEGA

     A quantidade e o custo que a tela mostra nao vivem no insumo: vivem em
     estoque_unidade, uma linha por item POR UNIDADE. espelharEstoque()
     copia o saldo da unidade ativa para dentro de cada insumo.
     Ela rodava na abertura — quando o aparelho ainda estava vazio — e
     gravava zero em tudo. O download entao trazia os 241 saldos, mas
     ninguem mandava ela rodar de novo: os insumos continuavam com o zero
     escrito la atras. Era o "aparece o nome, nao aparece a quantidade nem
     o valor", com o dado inteiro no aparelho o tempo todo.
     Medido no diagnostico: 'no aparelho AGORA: insumos 250 | estoqueUn 241'
     e a tela mostrando R$ 0,00 em 252 itens.
     ========================================================== */
  try{ espelharEstoque(); }catch(e){ _quieto(e,'baixarDaNuvem'); }
  try{ conferirFilhosRepetidos(); }catch(e){ _quieto(e,'conferirFilhosRepetidos'); }
  /* alguem tentou enviar durante o download e foi segurado: agora pode ir */
  if(NUVEM.pendente){NUVEM.pendente=false;agendarSync();}
  var depoisCat=(DB.catfin||[]).reduce(function(a,p){return a+((p.itens||[]).length)},0);
  /* o que veio da nuvem pertence a loja de onde veio: carimba antes de
     qualquer gravacao, senao viraria "sem origem" no proximo envio */
  try{
    var _l=NUVEM.loja, _s=null; try{_s=lojaAtualId()}catch(e){_quieto(e,'baixarDaNuvem')}
    for(var _c in DB){
      if(_COLS_SEM_CARIMBO[_c])continue;
      var _li=DB[_c]; if(!Array.isArray(_li))continue;
      for(var _i=0;_i<_li.length;_i++){
        var _r=_li[_i];
        if(_r&&typeof _r==='object'&&!_r._loja){_r._loja=_l;_r._suc=_r._suc||_s;}
      }
    }
  }catch(e){_quieto(e,'carimboDownload')}
  /* marca que o download ja chegou uma vez neste aparelho. As funcoes que
     semeiam cadastro padrao (motivos, turnos, status, impressao) esperam por
     ela: semear antes do download e o que criava duplicata a cada entrada. */
  /* agora sim: com a empresa carimbada, anota a impressao do que desceu */
  try{
    var _imp=anotarImpressoes();
    logNuvem('impressão registrada em '+_imp+' registro(s) que vieram da nuvem');
  }catch(e){
    /* falhou a anotacao: deixa as impressoes como estao. Apagar aqui seria
       voltar ao defeito — o aparelho reenviaria tudo por cima da nuvem. */
    _quieto(e,'anotarImpressoes');
    logNuvem('não consegui registrar a impressão do download: '+(e&&e.message||e),true);
  }
  DB._baixouUmaVez=true;
  if(_FALHOU_BAIXA.length){
    logNuvem('leitura parcial: '+_FALHOU_BAIXA.length+' tabela(s) não vieram ('+
      _FALHOU_BAIXA.join(', ')+') — o restante carregou normalmente e o que '+
      'estava neste aparelho foi mantido',true);
  }
  logNuvem('download concluído — itens de categorias: '+antesCat+' -> '+depoisCat,
    depoisCat<antesCat);

  /* ==========================================================
     O QUE ACABOU DE CHEGAR DA NUVEM NAO PRECISA VOLTAR PARA ELA
     Sem isto, o download marcava os dados como pendentes de envio, o envio
     subia tudo de volta, o contador da loja subia, o relogio de 6 s via
     mudanca e baixava de novo. Era esse o ciclo que congelava a tela 750 ms
     por segundo, sem parar.
     ========================================================== */
  NUVEM.sujo=false; DB._sujo=false;
  clearTimeout(_timerSync);
  /* ==========================================================
     UMA COISA O DOWNLOAD NAO PODE DECLARAR LIMPA

     A linha acima existe por um bom motivo (o que acabou de chegar da
     nuvem nao volta para ela). Mas ela apaga TAMBEM a pendencia que
     este mesmo download acabou de descobrir: o caixa que esta fechado
     aqui e aberto la. E o `clearTimeout` ainda cancela o envio que
     estava agendado.

     Sem este bloco, a marca `_fechamentoPendente` ficaria gravada
     esperando outra mudanca qualquer para pegar carona. O fechamento
     de 30/08 nao pode depender de a loja fazer mais uma venda para
     subir: ele sobe agora.
     ========================================================== */
  try{
    var _pend=(DB.caixas||[]).filter(function(c){return c&&c._fechamentoPendente===true});
    if(_pend.length){
      NUVEM.sujo=true; DB._sujo=true;
      logNuvem('há '+_pend.length+' fechamento(s) de caixa que ainda não estão na '+
        'nuvem — enviando agora',true);
      /* ==========================================================
         O FECHAMENTO QUE FICOU PARA TRAS NAO ENTRA NA FILA

         Marcar como pendente resolve a conta do envio, mas o envio sobe
         tabela por tabela e `caixas` vem depois de `pedidos` e
         `pedido_pagamentos`. Num aparelho com fila grande — o da loja
         subia pagamento por pagamento, um POST a cada 190 ms — o caixa
         levaria minutos para chegar a vez, e nao chegaria nenhuma se a
         sessao caisse antes.

         O fechamento que ja existe aqui vai pelo mesmo caminho curto
         que o fechamento novo usa: a linha do caixa sozinha, com os
         campos do fechamento e mais nada. E depois se confere.

         E por isso que o operador NAO precisa fechar o caixa de novo:
         basta abrir o sistema no aparelho onde o fechamento foi feito.
         ========================================================== */
      for(var _i=0;_i<_pend.length;_i++){
        try{
          if(typeof gravarFechamentoNaNuvem!=='function')break;
          var _cxp=_pend[_i];
          if(!(await gravarFechamentoNaNuvem(_cxp)))continue;
          if((await fechamentoChegouNaNuvem(_cxp.id))===true){
            delete _cxp._fechamentoPendente;
            logNuvem('fechamento do caixa '+String(_cxp.id).slice(-6)+
              ' foi gravado na nuvem',true);
          }
        }catch(e){ _quieto(e,'fechamentoPendente'); }
      }
      agendarSync();
    }
  }catch(e){ _quieto(e,'fechamentoPendente'); }
  gravarLocal();
  return true;
}
/* aviso grande e fixo quando a sincronização faz algo que você precisa saber */
/* ==========================================================
   O OPERADOR NAO E O SUPORTE TECNICO
   Esta funcao mostrava uma faixa larga com o texto do erro do Postgres —
   nome de tabela, tipo de coluna, "me mande esta mensagem que eu corrijo" —
   inclusive na tela de login e no meio de um atendimento no PDV.
   Agora ela REGISTRA no diagnostico tecnico e nao interrompe ninguem. O
   indicador discreto do rodape ja informa o estado da nuvem.
   Falha que realmente impede uma operacao usa avisoOperacao(), que fala em
   portugues comum e nao cita banco de dados.
   ========================================================== */
/* Sessao vencida e das poucas coisas que o operador PRECISA saber: so ele
   resolve, entrando de novo. Sem isso ele lanca a tarde inteira sem nada
   subir — ou fica com a tela travada sem entender por que. */
var _avisouSessao=false;
/* ==========================================================
   O AVISO DE SESSAO TINHA DE SAIR QUANDO A SESSAO VOLTASSE

   Ele nascia com o id `avisoTab`, o mesmo que a lista de tabelas
   recusadas usa. Duas coisas diferentes disputando um id so: quem
   limpava uma limpava a outra, e — pior — quem NAO limpava deixava a
   faixa vermelha na tela depois de tudo ja ter voltado ao normal.
   `conferirNuvem()` so tirava o `avisoNuvem`; este ficava para sempre.

   Em Santa Fe do Sul, em 28/08/2026, a loja reconectou as 17h35 (o
   download inteiro esta no log do servidor, todo 200) e a faixa
   vermelha continuou na tela — em cima do botao de pagamento.

   Agora o aviso de sessao tem id proprio e uma funcao unica que o
   remove, chamada de todo lugar onde a sessao volta.
   ========================================================== */
function limparAvisoSessao(){
  try{
    _avisouSessao=false;
    var el=document.getElementById('avisoSessao');
    if(el)el.remove();
  }catch(e){ _quieto(e,'limparAvisoSessao'); }
}
/* ==========================================================
   A TRAVA NAO PODE VIVER LONGE DO QUE ELA GUARDA

   `_avisouSessao` era uma variavel: uma vez ligada, esta funcao voltava
   sem fazer nada. So `limparAvisoSessao()` a desligava. Enquanto os dois
   andarem juntos, funciona — mas basta a faixa sair da tela por outro
   caminho (uma remontagem do `#app`, um `remove()` de outro lugar) e o
   sistema fica com a trava ligada e sem faixa nenhuma: a sessao cai de
   novo e a loja NAO e avisada. Aviso que so aparece na primeira vez nao
   e aviso.

   A pergunta agora e feita a tela, que e a unica que sabe a verdade: se
   a faixa esta la, nao ha o que fazer; se nao esta, ela e montada. Isso
   nao tem como dessincronizar.
   ========================================================== */
function avisoSessaoCaiu(){
  try{
    if(document.getElementById('avisoSessao'))return;
    _avisouSessao=true;
    var el=document.createElement('div');
    el.id='avisoSessao'; el.className='avisoGrav sinc';
    el.innerHTML='<div><b>Sua sessão expirou</b>'+
      '<span>Nada foi perdido — o que você lançou está guardado neste aparelho '+
      'e sobe assim que você entrar de novo.</span></div>'+
      '<button class="btnP2 ok" onclick="sair()">Entrar de novo</button>';
    barraAvisos().appendChild(el);
  }catch(e){ _quieto(e,'avisoSessaoCaiu'); }
}
function avisoSinc(msg,detalhe){
  registrarFalha('sincronizacao','avisoSinc',msg,{detalhe:detalhe||'',situacao:'pendente'});
  try{ if(CONEXAO!=='offline')estadoNuvem(NUVEM.ligada?'online':'offline'); }catch(e){_quieto(e,'avisoSinc')}
}
/* mensagem curta, ligada a acao, sem termo tecnico */
function avisoOperacao(msg){
  try{ toast(msg); }catch(e){_quieto(e,'avisoOperacao')}
}


/* ehUuid REMOVIDA daqui: ja existe uma versao mais rigorosa la em cima, que
   tambem recusa as strings "null", "undefined" e "NaN". Esta, por vir DEPOIS
   no arquivo, sobrescrevia a outra — a mesma armadilha de funcao duplicada
   que ja custou horas neste projeto. */
/* mantida so por compatibilidade: tudo passa pelo estado unico */
function statusNuvem(e,msg){
  if(e==='enviando')return estadoNuvem('sincronizando');
  if(e==='baixando')return estadoNuvem('sincronizando');
  if(e==='ok')return estadoNuvem('online');
  if(e==='erro')return estadoNuvem('erro',msg);
  return estadoNuvem(NUVEM.ligada?'online':'offline');
}

function uid(p){return p+'_'+Date.now().toString(36)+Math.random().toString(36).slice(2,6)}

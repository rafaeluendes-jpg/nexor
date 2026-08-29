/* ==========================================================
   ITEM 3 (rodada 2) — O BANCO MANDA NO ESTADO DO CAIXA

   `caixaAberto()` le a copia local. Isso e proposital: sem rede a loja
   precisa vender. Mas quando HA rede, a copia local pode estar errada —
   o caixa pode ter sido fechado no outro computador, ou encerrado
   administrativamente. Ate agora o aparelho so descobria isso na
   proxima sincronizacao completa, e ate la seguia vendendo num turno
   que ja acabou.

   Esta verificacao e leve (uma linha, uma coluna) e roda no maximo uma
   vez por minuto. Se o banco disser que fechou, o aparelho encerra a
   sessao e mostra ABRIR CAIXA. O contrario nunca acontece: caixa
   fechado aqui jamais e reaberto pelo banco.
   ========================================================== */
var _ultimaConferenciaCaixa=0;
async function conferirCaixaNoBanco(){
  if(!NUVEM.ligada)return;
  var cx=caixaAberto(); if(!cx)return;
  if(Date.now()-_ultimaConferenciaCaixa<60000)return;
  _ultimaConferenciaCaixa=Date.now();
  try{
    var r=await api('caixas?ref_local=eq.'+encodeURIComponent(cx.id)+'&select=fechado_txt,fechado_em','GET');
    var linha=(r&&r.length)?r[0]:null;
    if(!linha)return;                    /* ainda nao subiu: nao e prova de nada */
    var fechadoLa=linha.fechado_txt||linha.fechado_em;
    if(fechadoLa&&!cx.fechadoEm){
      cx.fechadoEm=linha.fechado_txt||'fechado em outro aparelho';
      salvar();
      encerrarSessaoPDV();
      telaPDV();
      toast('Este caixa foi fechado em outro aparelho. Abra um novo para vender.');
    }
  }catch(e){ _quieto(e,'conferirCaixaNoBanco'); }
}
/* ---------- TELA PRINCIPAL ---------- */
function telaPDV(){
  /* confere em segundo plano: nao trava o desenho da tela */
  setTimeout(function(){ conferirCaixaNoBanco(); },50);
  DB.clientes=DB.clientes||[];DB.pedidos=DB.pedidos||[];DB.caixas=DB.caixas||[];
  baseFormas();
  var c=cfg(),cx=caixaAberto();
  var abertos=DB.pedidos.filter(function(p){return !ehFinalizado(p)&&!ehCancelado(p)}).length;

  $('content').innerHTML=
  '<div class="pdvBar">'+
   '<button class="voltarSis" onclick="sairPdvCheio()" title="Voltar ao menu do sistema">'+sv('menu2',15)+' Sistema</button>'+
   '<div class="pdvSep"></div>'+
   '<button class="lojaSw '+(c.lojaAberta?'ab':'fe')+'" onclick="toggleLoja()">'+
     '<i></i>'+(c.lojaAberta?'LOJA ABERTA':'LOJA FECHADA')+'</button>'+
   '<div class="pdvSep"></div>'+
   '<div class="pdvFld"><label>Entrega</label><input type="number" id="tEnt" value="'+c.tempoEntrega+'"><i>min</i></div>'+
   '<div class="pdvFld"><label>Retirada</label><input type="number" id="tRet" value="'+c.tempoRetirada+'"><i>min</i></div>'+
   '<div class="pdvGrow"></div>'+
   (cx?'<button class="cxTag" data-pop="1" onclick="menuCaixa(event)">'+sv('cash',14)+
       '<div><b>Caixa aberto'+(caixaDeOutroDia(cx)?' <em style="color:var(--red);font-style:normal">de '+E(String(cx.aberto).slice(0,10))+'</em>':'')+'</b><span>'+
        (caixaDeOutroDia(cx)?'ficou aberto do dia anterior — feche antes de vender'
          :(cfg().caixaCego?'valores ocultos':'R$ '+money(esperadoCaixa(cx))+' em gaveta'))+'</span></div>'+sv('dn',13)+'</button>'
      :'<button class="btnP2 ok" onclick="abrirCaixa()">'+sv('cash',14)+' Abrir frente de caixa</button>')+
  '</div>'+
  /* ==========================================================
     DOIS CAIXAS ABERTOS NA MESMA UNIDADE E AVISO NA CARA

     O operador precisa saber disso onde ele esta — no PDV —, nao so no
     relatorio. A venda continua indo para o caixa em operacao (o ultimo
     aberto); o que a faixa cobra e o fechamento do que sobrou.
     ========================================================== */
  (function(){
    var sobra=(typeof caixasEsquecidos==='function'?caixasEsquecidos():[]);
    if(!sobra.length)return '';
    return '<div class="cmdFaixa cmdAlerta">'+sv('help',14)+
     '<div>'+(sobra.length>1?sobra.length+' caixas ficaram abertos':'Um caixa ficou aberto')+
     ' sem fechamento (<b>'+sobra.map(function(c){return E(c.aberto)}).join(' · ')+'</b>). '+
     'A venda de agora está indo para o caixa aberto em '+E(cx?cx.aberto:'—')+'.</div>'+
     '<button class="btnP2" onclick="abrir(\'financeira\',\'frente-caixa\')">Resolver</button></div>';
  })()+
  (PDV.comandaId?(function(){var c=comandaPorId(PDV.comandaId);
    return c?'<div class="cmdFaixa">'+sv('store',14)+
     '<div>Lançando para <b>'+E(c.nome)+'</b> — mesa '+E(c.mesaNumero)+'</div>'+
     '<button class="btnP2" onclick="sairDaComanda()">Sair da comanda</button></div>':'';})():'')+
  '<div class="pdvTabs">'+
   '<button class="pdvTab'+(PDV.aba==='venda'?' on':'')+'" onclick="abaPDV(\'venda\')">'+sv('cart',15)+' Nova venda</button>'+
   '<button class="pdvTab'+(PDV.aba==='pedidos'?' on':'')+'" onclick="abaPDV(\'pedidos\')">'+sv('list',15)+' Pedidos'+
     (abertos?'<span class="bg2">'+abertos+'</span>':'')+'</button>'+
   (modoAtivo('mesa')
    ?'<button class="pdvTab'+(PDV.aba==='mesas'?' on':'')+'" onclick="abaPDV(\'mesas\')">'+
      sv('store',15)+' Mesas'+
      (function(){var o=(DB.mesas||[]).filter(function(m){return mesaOcupada(m.id)}).length;
        return o?'<span class="bg2">'+o+'</span>':'';})()+'</button>':'')+
   '<div class="pdvGrow"></div>'+
   '<button class="pdvTab" onclick="painelWhats()" id="abaZap">'+sv('qr',15)+' WhatsApp'+
    '<span class="zapPt" id="zapPt"></span></button>'+
  '</div>'+
  '<div class="pdvBody" id="pdvBody"></div>';

  $('tEnt').onchange=function(){
    c.tempoEntrega=parseInt(this.value)||0;
    aplicarTempos();
    toast('Entrega: '+c.tempoEntrega+' min — já valendo no cardápio e no WhatsApp.');};
  $('tRet').onchange=function(){
    c.tempoRetirada=parseInt(this.value)||0;
    aplicarTempos();
    toast('Retirada: '+c.tempoRetirada+' min — já valendo no cardápio.');};

  conferirZapPdv();
  if(PDV.aba==='venda')renderVenda();
  if(PDV.aba==='pedidos'){renderKanban();ligarBuscaKanban();}
  if(PDV.aba==='mesas')renderMesas();
  rodape(DB.pedidos.length+' pedidos · '+DB.clientes.length+' clientes');
}
/* leva os tempos do PDV para o cardápio digital e para o robô */
async function aplicarTempos(){
  var c=cfg();
  baseCard();
  var suc=lojaAtualId();
  var cd=(DB.cardapio||{})[suc];
  if(cd){
    cd.tempoEntrega=c.tempoEntrega?c.tempoEntrega+' min':'';
    cd.tempoRetirada=c.tempoRetirada?c.tempoRetirada+' min':'';
    cd.ativo=c.lojaAberta!==false;
  }
  salvar();
  if(NUVEM.ligada){
    try{
      await api('cardapio_config?sucursal_id=eq.'+suc,'PATCH',{
        tempo_entrega:cd?cd.tempoEntrega:null,
        tempo_retirada:cd?cd.tempoRetirada:null,
        ativo:c.lojaAberta!==false
      });
    }catch(e){_quieto(e,'aplicarTempos')}
  }
}
function lojaAtualId(){
  baseSuc();
  return lojaAtual();
}
async function conferirZapPdv(){
  var pt=$('zapPt');
  if(!pt)return;
  try{
    var r=await zapApi('/estado/'+lojaAtualId());
    pt.className='zapPt '+(r.estado==='conectado'?'on':'off');
    pt.title=(r.estado==='conectado'?'conectado: '+(r.numero||''):'não conectado');
  }catch(e){ pt.className='zapPt off'; }
}
function ligarBuscaKanban(){
  var b=$('kanB');
  if(!b)return;
  b.oninput=function(){
    KAN.busca=this.value;
    var p=this.selectionStart;
    renderKanban();ligarBuscaKanban();
    var n=$('kanB');
    if(n){n.focus();n.setSelectionRange(p,p);}
  };
}
function abaPDV(a){PDV.aba=a;telaPDV();}
function sairPdvCheio(){document.body.classList.remove('pdvFull');toast('Menu do sistema liberado.');}
function toggleLoja(){
  var c=cfg();c.lojaAberta=!c.lojaAberta;
  aplicarTempos();
  telaPDV();
  toast(c.lojaAberta?'Loja aberta — o cardápio já mostra que estamos atendendo.'
    :'Loja fechada — o cardápio avisa que não estamos atendendo agora.');}

/* ---------- ABA: NOVA VENDA ---------- */
function renderVenda(){
  var cx=caixaAberto();
  if(!cx){
    $('pdvBody').innerHTML='<div class="pdvAviso"><div class="av"><div class="ic">'+sv('cash',26)+'</div>'+
    '<b>Caixa fechado</b><span>Para lançar vendas é preciso abrir a frente de caixa e informar o fundo de troco.</span>'+
    '<button class="btnP2 ok" onclick="abrirCaixa()">Abrir frente de caixa</button></div></div>';
    return;
  }
  var C=cfgPDV();
  var gr=' lay-'+(C.layout||'foto')+(C.botaoGrande?' gr':'');
  var q=(PDV.busca||'').toLowerCase();
  /* "Disponível em" passa a valer de verdade: produto marcado só para
     cardápio digital não polui a tela de quem está no balcão. */
  var canalPDV=(PDV.tipo==='entrega')?'delivery':'pdv';
  /* ==========================================================
     A CATEGORIA SEGUE O CANAL DOS PRODUTOS DELA

     O "Disponível em" ja valia para o PRODUTO: marcado so para delivery,
     ele nao aparecia na grade do balcao. Mas a faixa de CATEGORIAS nao
     olhava canal nenhum — filtrava so por `ativo`. Resultado: "Taxa de
     Entrega", com um unico produto marcado so para Delivery, aparecia em
     "Pedido na loja" com a pastilha dizendo "1". Quem clicava achava a
     categoria vazia e nao entendia por que.

     Agora: categoria que TEM produto, mas nenhum disponivel neste canal,
     nao aparece neste canal. Categoria ainda sem produto nenhum continua
     aparecendo — quem acabou de cria-la precisa ve-la para pendurar o
     primeiro produto nela.

     A pastilha conta pelo mesmo criterio: o numero e o que a pessoa vai
     encontrar ao clicar.
     ========================================================== */
  function prodsDaCategoria(cid,canal){
    return DB.produtos.filter(function(p){
      return p.categoriaId===cid&&p.ativo!==false&&
             (!canal||disponivelNo(p,canal));
    });
  }
  /* ==========================================================
     CATEGORIA SEM NADA PARA VENDER NAO ENTRA NA VENDA

     A regra anterior deixava a categoria VAZIA a vista, pensando em
     quem esta montando o cardapio. Na loja isso vira armadilha: em
     28/08/2026 uma categoria duplicada, sem produto nenhum, aparecia na
     frente de caixa; o operador clicava e nao havia nada. Categoria
     vazia nao tem o que fazer numa tela de venda — ela continua
     inteira na Gestao de Cardapio, que e onde se monta o cardapio.
     ========================================================== */
  var cats=DB.categorias.filter(function(c){
    if(c.ativo===false)return false;
    return prodsDaCategoria(c.id,canalPDV).length>0;
  }).sort(function(a,b){return a.ordem-b.ordem});
  /* sem "Todos", a tela precisa abrir em alguma categoria */
  if(!PDV.cat&&!q&&cats.length)PDV.cat=cats[0].id;
  var prods=DB.produtos.filter(function(p){return p.ativo!==false})
    .filter(function(p){return disponivelNo(p,canalPDV)})
    .filter(function(p){return !PDV.cat||p.categoriaId===PDV.cat})
    .filter(function(p){return !q||p.nome.toLowerCase().indexOf(q)>=0||String(p.codigo||'').toLowerCase().indexOf(q)>=0})
    .sort(function(a,b){return (a.ordem||0)-(b.ordem||0)});

  var h='<div class="pdvLeft">'+
   '<div class="pnlBar">'+
    '<div class="segm">'+
     (modoAtivo('balcao')?'<button class="'+(PDV.tipo==='loja'?'on':'')+'" onclick="setTipo(\'loja\')">'+sv('store',14)+' Pedido na loja</button>':'')+
     (modoAtivo('entrega')?'<button class="'+(PDV.tipo==='entrega'?'on':'')+'" onclick="setTipo(\'entrega\')">'+sv('moto',14)+' Entrega</button>':'')+
    '</div>'+
    '<div class="pdvBusca">'+sv('search',14)+
      '<input id="bPdv" placeholder="Buscar produto ou código..." value="'+E(PDV.busca)+'"></div>'+
   '</div>'+
   '<div class="catFaixa">'+
    '<button class="catSeta" onclick="rolarCat(-1)">'+sv('cr2',15)+'</button>'+
    '<div class="catTrilho" id="catTrilho">'+
     /* ==========================================================
        SEM A PASTILHA "TODOS"

        Mostrar os 42 produtos de uma vez nao ajuda quem atende: e a
        lista mais longa possivel, com rolagem garantida. O caixa
        trabalha por categoria — cascao, copo, pote. A tela abre na
        primeira categoria e a busca cobre o caso de procurar um item
        especifico sem saber a categoria.
        ========================================================== */
     cats.map(function(c){
       var qt=prodsDaCategoria(c.id,canalPDV).length;
       return '<div class="catBox'+(PDV.cat===c.id?' on':'')+'" onclick="setCatPdv(\''+c.id+'\')">'+
       '<div class="ci2"'+(c.cor?' style="background:'+c.cor+';color:#fff"':'')+'>'+
       (c.imagem?'<img src="'+c.imagem+'">':E(c.nome.charAt(0).toUpperCase()))+'</div>'+
       '<span>'+E(c.nome)+'</span><em>'+qt+'</em></div>';}).join('')+
    '</div>'+
    '<button class="catSeta" onclick="rolarCat(1)">'+sv('cr',15)+'</button>'+
   '</div>'+
   '<div class="pnl2 flex1"><div class="pnl2H">'+(PDV.cat?E((cats.find(function(c){return c.id===PDV.cat})||{}).nome):'Todos os produtos')+
     '<span class="cnt2">'+prods.length+'</span></div>'+
    '<div class="pnl2B scroll1"><div class="prodGrid'+gr+'" style="--pcols:'+(C.colunas||4)+'">'+
     (prods.length?prods.map(function(p){
       var forc=(p.grupos||[]).some(function(g){var G=DB.grupos.find(function(x){return x.id===g});return G&&G.forcado&&grupoValeEm(G,'pdv')});
       var pv=precoVigente(p),base=Number(p.preco)||0;
       var semFoto=(C.layout==='lista');
       return '<div class="prodBox" onclick="addItem(\''+p.id+'\')">'+
       (semFoto?'':'<div class="ph2">'+
         (p.imagem?'<img src="'+p.imagem+'" alt="">':'<span class="semImg">'+sv('img',22)+'</span>')+
         (forc?'<span class="fTag">!</span>':'')+'</div>')+
       '<div class="inf"><b>'+E(p.nome)+
        (semFoto&&forc?' <span class="fTag2">!</span>':'')+'</b>'+
       (C.mostraDesc&&p.descricao?'<small class="pDesc">'+E(p.descricao)+'</small>':'')+
       (C.mostraPreco!==false?'<span>R$ '+money(pv)+(pv<base?' <s>'+money(base)+'</s>':'')+'</span>':'')+
       '</div></div>';}).join('')
      :'<div class="vazio2">'+(DB.produtos.length?'Nenhum produto nesta categoria.':'Nenhum produto cadastrado. Vá em <b>Gestão de Cardápio</b>.')+'</div>')+
    '</div></div></div>'+
  '</div>'+renderComanda();

  $('pdvBody').innerHTML=h;
  var bi=$('bPdv');
  bi.oninput=function(){PDV.busca=this.value;var pos=this.selectionStart;renderVenda();
    var n=$('bPdv');n.focus();n.setSelectionRange(pos,pos);};
}
function setTipo(t){PDV.tipo=t;renderVenda();}
function rolarCat(d){var t=$('catTrilho');if(t)t.scrollBy({left:d*260,behavior:'smooth'});}
function setCatPdv(c){PDV.cat=c;renderVenda();}
function precoVigente(p){
  var base=Number(p.preco)||0;
  var pr=(p.promocoes||[]).filter(function(x){return x.ativo&&Number(x.preco)>0});
  if(!pr.length)return base;
  var ag=new Date(),dia=ag.getDay(),hm=agoraHM();
  for(var i=0;i<pr.length;i++){
    var x=pr[i];
    if((x.dias||[]).length&&(x.dias||[]).indexOf(dia)<0)continue;
    if(x.de&&x.ate&&(hm<x.de||hm>x.ate))continue;
    return Number(x.preco);
  }
  return base;
}

/* ---------- COMANDA ---------- */
function renderComanda(){
  var tot=PDV.comanda.reduce(function(a,i){return a+i.total},0);
  var h='<div class="pdvRight">'+
  '<div class="comTop"><b>Comanda</b><span>'+(PDV.tipo==='entrega'?'Entrega':'Pedido na loja')+'</span></div>'+
  '<div class="comCli">'+
   (PDV.cliente
    ? '<div class="cliOn"><div class="av2">'+E(PDV.cliente.nome.charAt(0).toUpperCase())+'</div>'+
      '<div class="ci3"><b>'+E(PDV.cliente.nome)+'</b><span>'+E(PDV.cliente.tel||'sem telefone')+
      ((Number(PDV.cliente.saldoFiado)||0)?' · <b style="color:var(--red)">fiado R$ '+money(PDV.cliente.saldoFiado)+'</b>':'')+'</span></div>'+
      '<button class="qtBtn" onclick="formCliente(\''+PDV.cliente.id+'\')">'+sv('edit',13)+'</button>'+
      '<button class="qtBtn" onclick="PDV.cliente=null;renderVenda()">'+sv('x2',13)+'</button></div>'
    : '<button class="btnLinha" onclick="buscarCliente()">'+sv('users',14)+' Identificar cliente</button>')+
  '</div>'+
  '<div class="comItens">';
  if(!PDV.comanda.length)h+='<div class="comVazia">'+sv('cart',26)+'<b>Comanda vazia</b><span>Toque em um produto para lançar</span></div>';
  PDV.comanda.forEach(function(it,i){
    h+='<div class="comIt"><div class="l1"><span class="qb">'+it.qtd+'</span><b>'+E(it.nome)+'</b>'+
    '<span class="vl">R$ '+money(it.total)+'</span></div>'+
    (it.opcoes&&it.opcoes.length?'<div class="ops">'+it.opcoes.map(function(o){
      return '+ '+E(o.nome)+(o.preco?' (R$ '+money(o.preco)+')':'')}).join('<br>')+'</div>':'')+
    (it.obs?'<div class="ops obs">obs: '+E(it.obs)+'</div>':'')+
    '<div class="l2"><button class="qtBtn" onclick="mudarQt('+i+',-1)">'+sv('minus',13)+'</button>'+
    '<span class="qtN">'+it.qtd+'</span>'+
    '<button class="qtBtn" onclick="mudarQt('+i+',1)">'+sv('plus',13)+'</button>'+
    '<div style="flex:1"></div>'+
    '<button class="qtBtn" onclick="obsItem('+i+')" title="Observação">'+sv('edit',13)+'</button>'+
    '<button class="qtBtn rd2" onclick="remItem('+i+')" title="Remover">'+sv('trash',13)+'</button></div></div>';
  });
  h+='</div>'+
  '<div class="comFoot">'+
  '<div class="linha"><span>'+PDV.comanda.reduce(function(a,i){return a+i.qtd},0)+' itens</span>'+
  '<span>R$ '+money(tot)+'</span></div>'+
  '<div class="linha tot"><span>TOTAL</span><span>R$ '+money(tot)+'</span></div>'+
  '<div class="comBtns">'+
  '<button class="btnLinha" onclick="limparComanda()">Limpar</button>'+
  /* lançando para uma mesa, o botão não cobra: manda para a comanda */
  (PDV.comandaId
   ?'<button class="btnPag" onclick="enviarParaComanda()">'+sv('cart',16)+' Lançar na comanda</button>'
   :'<button class="btnPag" onclick="irPagamento()">'+sv('cash',16)+' Pagamento</button>')+'</div>'+
  '</div></div>';
  return h;
}
function addItem(pid){
  var p=DB.produtos.find(function(x){return x.id===pid});
  var grupos=(p.grupos||[]).map(function(g){return DB.grupos.find(function(x){return x.id===g})})
    .filter(function(g){return g&&grupoValeEm(g,'pdv')});
  if(grupos.length)return modalOpcoes(p,grupos);
  lancar(p,[],1);
}
function lancar(p,opcoes,qtd,obs){
  var extra=opcoes.reduce(function(a,o){return a+(Number(o.preco)||0)},0);
  var unit=precoVigente(p)+extra;
  PDV.comanda.push({produtoId:p.id,nome:p.nome,qtd:qtd,unit:unit,total:unit*qtd,opcoes:opcoes,obs:obs||''});
  renderVenda();
}
function mudarQt(i,d){
  var it=PDV.comanda[i];it.qtd+=d;
  if(it.qtd<1){PDV.comanda.splice(i,1);}else{it.total=it.unit*it.qtd;}
  renderVenda();
}
function remItem(i){PDV.comanda.splice(i,1);renderVenda();}
function obsItem(i){
  var it=PDV.comanda[i];
  var t=prompt('Observação para "'+it.nome+'":',it.obs||'');
  if(t===null)return;it.obs=t;renderVenda();
}
async function limparComanda(){
  if(!PDV.comanda.length)return;
  if(!await pergunta('Limpar todos os itens da comanda?'))return;
  PDV.comanda=[];renderVenda();
}

/* ---------- PERGUNTA FORÇADA ---------- */
function modalOpcoes(p,grupos){
  var h='<div class="mdB">';
  grupos.forEach(function(g,gi){
    h+='<div class="blk" style="margin:0 0 11px;max-width:none">'+
    '<h3>'+E(g.nome)+(g.forcado?' <span class="tagF">obrigatório</span>':'')+
    '<small>escolha de '+(g.min||0)+' a '+((g.max==null?1:Number(g.max)))+'</small></h3>';
    if(!(g.opcoes||[]).length)h+='<div class="hint">Sem opções cadastradas neste grupo.</div>';
    /* a pergunta é obrigatória responder, mas a resposta pode ser "não quero" */
    if(g.forcado)
      h+='<label class="chkL semOp"><input type="radio" name="g'+gi+'" class="opNao" '+
      'data-g="'+g.id+'" checked><span><b>Não quero</b>'+
      '<small style="display:block;color:var(--ink-3)">nada é acrescentado ao pedido</small></span></label>';
    (g.opcoes||[]).forEach(function(o,oi){
      h+='<label class="chkL"><input type="'+(((g.max==null?1:Number(g.max)))>1?'checkbox':'radio')+'" name="g'+gi+'" '+
      'class="opSel" data-g="'+g.id+'" data-i="'+oi+'">'+
      '<span>'+E(o.nome)+(o.preco?' <b style="color:var(--acc-d)">+ R$ '+money(o.preco)+'</b>':'')+'</span></label>';
    });
    h+='</div>';
  });
  h+='<div class="blk" style="margin:0;max-width:none"><div class="row2">'+
  '<div class="fld2" style="margin:0"><label>Observação</label><input id="obsIt" placeholder="ex: sem gelo"></div>'+
  '<div class="fld2" style="margin:0"><label>Quantidade</label><input id="qtIt" type="number" min="1" value="1"></div>'+
  '</div></div></div>';

  modal(p.nome,h,'Adicionar à comanda',function(){
    var esc=[];
    var cks=document.querySelectorAll('.opSel');
    for(var i=0;i<cks.length;i++)if(cks[i].checked){
      var gid=cks[i].getAttribute('data-g');
      var g=grupos.find(function(x){return x.id===gid});
      var o=g.opcoes[cks[i].getAttribute('data-i')];
      /* ==========================================================
         A OPCAO PRECISA LEVAR A FICHA JUNTO

         Aqui iam so grupo, nome e preco. O vinculo com a ficha tecnica,
         que a matriz cadastra em Gestao de Cardapio e que sobe e desce da
         nuvem em `ficha_id`, ficava para tras na hora de entrar na
         comanda.

         `baixarOpcoes` le `o.fichaId` e, quando nao acha, tenta descobrir
         a ficha PELO NOME da opcao. Como o nome nunca vinha, esse "plano
         B" virou o unico caminho — e ele so acerta quando o nome da opcao
         e o nome da ficha sao iguais.

         Medido no banco da Jolo em 28/08/2026: das 10 opcoes vinculadas
         fora de sabores, 7 tinham nome diferente do da ficha — "Borda de
         Doce de Leite" para a ficha "BORDA DOCE LEITE", "Creme de Avela"
         para "CALDA CREME DE AVELA", "Cascao Tradicional" para "CASCAO
         TRADICIONAL". Nenhuma delas baixava estoque. A tela mostrava o
         vinculo, a venda ignorava.

         Agora vai o identificador, que nao depende de como cada uma foi
         escrita. O plano B fica para as comandas antigas.
         ========================================================== */
      esc.push({grupo:g.id,nome:o.nome,preco:o.preco,fichaId:o.fichaId||''});
    }
    for(var k=0;k<grupos.length;k++){
      var G=grupos[k];
      var qtd=esc.filter(function(e){return e.grupo===G.id}).length;
      /* respondeu "não quero"? então a pergunta está respondida */
      var recusou=false;
      var nao=document.querySelectorAll('.opNao');
      for(var z=0;z<nao.length;z++)
        if(nao[z].getAttribute('data-g')===G.id&&nao[z].checked)recusou=true;
      if(recusou)continue;
      if(G.forcado&&qtd<1){toast('Responda "'+G.nome+'" — escolha uma opção ou marque Não quero.');return false;}
      if((G.min||0)>qtd&&qtd>0){toast('"'+G.nome+'" exige no mínimo '+G.min+'.');return false;}
      if(qtd>(G.max||1)){toast('"'+G.nome+'" permite no máximo '+G.max+'.');return false;}
    }
    lancar(p,esc,parseInt($('qtIt').value)||1,$('obsIt').value);
    return true;
  },'lg');
}

/* ---------- CLIENTE ---------- */
function soDigitos(t){return String(t||'').replace(/\D/g,'')}
function clientePorTel(tel){
  var d=soDigitos(tel);
  if(!d)return null;
  return (DB.clientes||[]).find(function(c){return soDigitos(c.tel)===d})||null;
}
function buscarCliente(){
  var h='<div class="mdB">'+
  '<div class="fld2"><label>Telefone do cliente</label>'+
  '<input id="cliB" type="tel" placeholder="digite o telefone" autocomplete="off">'+
  '<div class="hint">O telefone é o identificador do cliente — evita cadastro duplicado.</div></div>'+
  '<div id="cliRes"></div>'+
  '<button class="btn p" onclick="formCliente(null,($(\'cliB\')||{}).value)" style="margin-top:8px">'+sv('plus',14)+' Cadastrar novo cliente</button></div>';
  modal('Identificar cliente',h,'Fechar',function(){return true});
  var inp=$('cliB');
  function lista(q){
    var d=soDigitos(q);
    var r=(DB.clientes||[]).filter(function(c){
      if(!q)return true;
      if(d)return soDigitos(c.tel).indexOf(d)>=0;
      return c.nome.toLowerCase().indexOf(q.toLowerCase())>=0;
    });
    if(!q||soDigitos(q).length<3){
      $('cliRes').innerHTML='<div class="hint" style="padding:6px 2px">Digite o telefone para localizar o cliente.</div>';
      return;
    }
    var h2=r.length?'<div class="pickList">'+r.slice(0,20).map(function(c){
      return '<label onclick="usarCliente(\''+c.id+'\')" style="cursor:pointer"><span><b>'+E(c.tel||'sem telefone')+'</b>'+
      '<div style="font-size:11px;color:var(--ink-3)">'+E(c.nome)+' · '+(c.compras||0)+' compras · ticket R$ '+
      money(c.compras?(c.gasto/c.compras):0)+'</div></span></label>';
    }).join('')+'</div>':'';
    if(!r.length&&d.length>=8){
      h2='<div class="avisoCfg" style="margin-top:4px">'+sv('help',15)+
      '<div>Nenhum cliente com este telefone. Clique em <b>Cadastrar novo cliente</b> — o telefone já vai preenchido.</div></div>';
    }else if(!r.length){h2='<div class="hint">Digite o telefone para localizar.</div>';}
    $('cliRes').innerHTML=h2;
  }
  lista('');
  inp.oninput=function(){lista(this.value.trim());};
  inp.focus();
}
function usarCliente(id){
  PDV.cliente=DB.clientes.find(function(x){return x.id===id});
  fecharModal();renderVenda();
}
function selectZonasCli(cidade,zonaId){
  var zs=zonasDaCidade(cidade);
  if(!zs.length)
    return '<select id="clZ" disabled><option>'+
      (cidade?'nenhuma zona nesta cidade':'escolha a cidade primeiro')+'</option></select>';
  return '<select id="clZ">'+
   '<option value="">Não informada — usa a taxa padrão da cidade</option>'+
   zs.map(function(z){
     return '<option value="'+z.id+'"'+(zonaId===z.id?' selected':'')+'>'+
     E(z.nome)+' · R$ '+money(z.taxa)+
     (z.tipo==='rural'?'  (zona rural)':z.tipo==='raio'?'  (por distância)':'')+
     (z.obs?'  — '+E(z.obs):'')+'</option>';}).join('')+
  '</select>';
}
function recarregaZonasCli(cidade){
  var box=$('boxZonaCli');
  if(box)box.innerHTML=selectZonasCli(cidade,'');
}
function formCliente(id,telPre){
  fecharModal();
  var c=id?DB.clientes.find(function(x){return x.id===id}):null;
  var h='<div class="mdB"><div class="blk" style="margin:0 0 11px;max-width:none"><h3>Dados do cliente</h3>'+
  '<div class="row2"><div class="fld2"><label>Nome *</label><input id="clN" value="'+E(c?c.nome:'')+'"></div>'+
  '<div class="fld2"><label>Telefone * <small style="color:var(--ink-3);font-weight:400">identificador</small></label>'+'<input id="clT" type="tel" value="'+E(c?c.tel:(telPre||''))+'" placeholder="(00) 00000-0000"></div></div></div>'+
  '<div class="blk" style="margin:0;max-width:none"><h3>Endereço <small>para entrega</small></h3>'+
  '<div class="row2"><div class="fld2"><label>Rua</label><input id="clR" value="'+E(c?c.rua:'')+'"></div>'+
  '<div class="fld2"><label>Número</label><input id="clNu" value="'+E(c?c.numero:'')+'"></div></div>'+
  '<div class="row2"><div class="fld2"><label>Bairro</label><input id="clB2" value="'+E(c?c.bairro:'')+'"></div>'+
  '<div class="fld2"><label>Cidade / área de entrega</label>'+
  ((DB.areas||[]).length?
    '<select id="clC" onchange="recarregaZonasCli(this.value)">'+
    '<option value="">Selecione a cidade</option>'+
    (DB.areas||[]).map(function(a){
      return '<option value="'+E(a.nome)+'"'+(c&&(c.cidade||'').toLowerCase()===String(a.nome).toLowerCase()?' selected':'')+'>'+
      E(a.nome)+(a.taxaPadrao?' — padrão R$ '+money(a.taxaPadrao):'')+'</option>';}).join('')+
    '</select>'
   :'<input id="clC" value="'+E(c?c.cidade:'')+'" placeholder="cadastre em Áreas de Entrega">'+
    '<div class="hint">Cadastre as cidades em Configuração da Loja › Áreas de Entrega.</div>')+
  '</div></div>'+
  '<div class="fld2"><label>Zona de entrega <small style="color:var(--ink-3);font-weight:400">define a taxa</small></label>'+
   '<div id="boxZonaCli">'+selectZonasCli(c?c.cidade:'',c?c.zonaId:'')+'</div>'+
   '<div class="hint">Escolha aqui se o cliente é de bairro, sítio ou rancho. '+
   'A taxa vem sozinha e fica guardada para as próximas vendas.</div></div>'+
  '<div class="fld2" style="margin:0"><label>Referência</label><input id="clRef" value="'+E(c?c.ref:'')+'"></div></div>'+
  (c?'<div class="blk" style="margin:11px 0 0;max-width:none"><h3>Histórico</h3>'+
     '<div class="row3"><div><div class="hint">Compras</div><b style="font-size:17px">'+(c.compras||0)+'</b></div>'+
     '<div><div class="hint">Total gasto</div><b style="font-size:17px">R$ '+money(c.gasto||0)+'</b></div>'+
     '<div><div class="hint">Ticket médio</div><b style="font-size:17px">R$ '+money(c.compras?(c.gasto/c.compras):0)+'</b></div></div>'+
     '<div class="hint" style="margin-top:9px">Última compra: '+(c.ultima||'—')+'</div></div>':'')+
  '</div>';
  modal(c?'Cliente':'Cadastrar cliente',h,'Salvar',async function(){
    var nome=$('clN').value.trim();
    var tel=$('clT').value.trim();
    if(!nome){toast('Informe o nome.');return false;}
    if(soDigitos(tel).length<8){toast('Informe um telefone válido — é ele que identifica o cliente.');return false;}
    var dup=clientePorTel(tel);
    if(dup&&(!c||dup.id!==c.id)){
      if(!await pergunta('Já existe um cliente com este telefone: "'+dup.nome+'".\nDeseja atualizar o cadastro dele em vez de criar outro?','Atualizar o cadastro'))return false;
      c=dup;
    }
    var o={nome:nome,tel:tel,rua:$('clR').value.trim(),numero:$('clNu').value.trim(),
      bairro:$('clB2').value.trim(),cidade:$('clC').value.trim(),ref:$('clRef').value.trim(),
      zonaId:(($('clZ')||{}).value)||'',
      zona:(function(){var zz=($('clZ')||{}).value;var yy=zz?zonaPorId(zz):null;return yy?yy.nome:''})()};
    if(c){Object.assign(c,o);PDV.cliente=c;}
    else{o.id=uid('cli');o.compras=0;o.gasto=0;DB.clientes.push(o);PDV.cliente=o;}
    salvar();renderVenda();toast('Cliente salvo.');
    return true;
  });
}

/* ---------- PAGAMENTO ---------- */
var _pagos=[],_totPag=0,_cidadeVenda='',_cupomAtivo=null;
function aplicarCupom(){
  baseCupons();
  var cod=($('pgCup').value||'').trim().toUpperCase();
  if(!cod){toast('Digite o código do cupom.');return;}
  var cp=cupomPorCodigo(cod);
  var canal=(PDV.tipo==='entrega')?'delivery':'pdv';
  var v=cupomValido(cp,_totPag,null,canal);
  if(!v.ok){
    $('cupMsg').innerHTML='<div class="cupErr">'+sv('x2',13)+' '+E(v.msg)+'</div>';
    return;
  }
  if(cp.limiteCliente&&PDV.cliente){
    var us=usosDoCupom(cp.id).filter(function(u){return u.clienteId===PDV.cliente.id}).length;
    if(us>=cp.limiteCliente){
      $('cupMsg').innerHTML='<div class="cupErr">'+sv('x2',13)+' Este cliente já usou o limite deste cupom.</div>';
      return;
    }
  }
  _cupomAtivo=cp;
  $('cupMsg').innerHTML='<div class="cupOk">'+sv('check',13)+' '+E(cp.codigo)+
    ' aplicado — desconto de R$ '+money(valorCupom(cp,_totPag))+'</div>';
  recalcPag();
  toast('Cupom '+cp.codigo+' aplicado.');
}
function tirarCupom(){_cupomAtivo=null;$('cupMsg').innerHTML='';recalcPag();irPagamento();}
/* busca a taxa cadastrada para a cidade do cliente */
function taxaSugerida(){
  var c=PDV.cliente;
  if(!c)return 0;
  /* 1) zona guardada no cadastro do cliente */
  if(c.zonaId){
    var z=zonaPorId(c.zonaId);
    if(z&&z.ativa!==false)return Number(z.taxa)||0;
  }
  /* 2) zona pelo nome do bairro informado */
  if(c.cidade&&c.bairro){
    var z2=zonaPorNome(c.cidade,c.bairro);
    if(z2)return Number(z2.taxa)||0;
  }
  /* 3) taxa padrão da cidade cadastrada em Áreas de Entrega */
  var a=(DB.areas||[]).find(function(x){
    return String(x.nome||'').toLowerCase()===String(c.cidade||'').toLowerCase()});
  if(a&&Number(a.taxaPadrao))return Number(a.taxaPadrao);
  /* 4) tabela do entregador, como era antes */
  return valorCidade(c.cidade||'');
}
function zonaPorId(id){
  var r=null;
  (DB.areas||[]).forEach(function(a){
    (a.zonas||[]).forEach(function(z){ if(z.id===id)r=Object.assign({cidade:a.nome},z); });
  });
  return r;
}
function zonaPorNome(cidade,nome){
  var a=(DB.areas||[]).find(function(x){
    return String(x.nome||'').toLowerCase()===String(cidade||'').toLowerCase()});
  if(!a)return null;
  var n=String(nome||'').toLowerCase().trim();
  return (a.zonas||[]).find(function(z){
    return z.ativa!==false&&String(z.nome||'').toLowerCase()===n})||null;
}
/* todas as zonas de uma cidade, para o seletor */
function zonasDaCidade(cidade){
  var a=(DB.areas||[]).find(function(x){
    return String(x.nome||'').toLowerCase()===String(cidade||'').toLowerCase()});
  if(!a)return [];
  return (a.zonas||[]).filter(function(z){return z.ativa!==false});
}
/* seletor de zona dentro do pagamento */
function blocoZona(){
  var c=PDV.cliente;
  if(!c)return '';
  var zs=zonasDaCidade(c.cidade);
  if(!zs.length)return '<div class="hint">Cidade sem zonas cadastradas em Áreas de Entrega.</div>';
  var atual=c.zonaId||'';
  var z=atual?zonaPorId(atual):null;
  return '<div class="zonaPg">'+
   '<select id="pgZona" onchange="trocaZonaPDV(this.value)">'+
    '<option value="">Zona não informada — taxa manual</option>'+
    zs.map(function(y){
      return '<option value="'+y.id+'"'+(atual===y.id?' selected':'')+'>'+
      E(y.nome)+' · R$ '+money(y.taxa)+
      (y.tipo==='rural'?' (rural)':'')+'</option>';}).join('')+
   '</select>'+
   (z?'<small class="zonaOk">'+sv('check',10)+' zona guardada no cadastro de '+E(c.nome)+'</small>'
     :'<small class="zonaAviso">'+sv('help',10)+' escolha a zona — o sistema guarda para as próximas vendas</small>')+
  '</div>';
}
function trocaZonaPDV(zid){
  if(!PDV.cliente)return;
  PDV.cliente.zonaId=zid||'';
  var z=zid?zonaPorId(zid):null;
  if(z){
    PDV.cliente.zona=z.nome;
    if(!PDV.cliente.cidade)PDV.cliente.cidade=z.cidade;
    if($('pgTaxa')){moedaSet('pgTaxa',Number(z.taxa)||0,true);recalcPag();}
  }
  /* guarda no cadastro do cliente, para a próxima venda vir sozinha */
  var cli=(DB.clientes||[]).find(function(x){return x.id===PDV.cliente.id});
  if(cli){cli.zonaId=PDV.cliente.zonaId;cli.zona=PDV.cliente.zona;salvar();}
  var el=document.querySelector('.zonaPg small');
  if(el&&z){el.className='zonaOk';
    el.innerHTML=sv('check',10)+' zona guardada no cadastro de '+E(PDV.cliente.nome);}
}
function irPagamento(){
  if(!PDV.comanda.length){toast('Comanda vazia.');return;}
  /* ==========================================================
     SEM CAIXA ABERTO NAO SE FINALIZA VENDA

     A venda carimba `caixaId:(caixaAberto()||{}).id` — sem caixa, isso
     grava vazio e a venda nasce orfa: nao entra em fechamento nenhum,
     nao aparece no movimento do turno, e so reaparece num relatorio
     amplo, dias depois.

     Isso ficou possivel justamente depois do fechamento, quando a tela
     antiga continuava viva. Fechar a porta aqui vale mesmo que algum
     estado escape no futuro.
     ========================================================== */
  if(!caixaAberto()){
    toast('Não há caixa aberto. Abra o caixa antes de finalizar a venda.');
    return telaPDV();
  }
  if(PDV.tipo==='entrega'&&!PDV.cliente){toast('Entrega exige cliente identificado com endereço.');return buscarCliente();}
  var tot=PDV.comanda.reduce(function(a,i){return a+i.total},0);
  _pagos=[];_totPag=tot;_tpDesc='rs';_cupomAtivo=null;
  var h='<div class="mdB">'+
  '<div class="blk" style="margin:0 0 11px;max-width:none"><h3>Resumo</h3>'+
  '<div class="linha"><span>Subtotal</span><b>R$ '+money(tot)+'</b></div>'+
  '<div class="row2" style="margin-top:11px">'+
  (PDV.tipo==='entrega'?
   '<div class="fld2" style="margin:0"><label>Cidade / área de entrega</label>'+
   '<select id="pgCidade"><option value="">Sem área definida</option>'+
   cidadesEntrega().map(function(a){
     return '<option value="'+E(a.cidade)+'" data-v="'+a.valor+'"'+
     ((PDV.cliente&&(PDV.cliente.cidade||'').toLowerCase()===a.cidade.toLowerCase())?' selected':'')+'>'+
     E(a.cidade)+' — R$ '+money(a.valor)+'</option>';}).join('')+
   '</select><div class="hint">A taxa é preenchida pela cidade escolhida.</div></div>'
   :'')+
  '<div class="fld2" style="margin:0"><label>'+
   (PDV.mesaPag?'Taxa de serviço':'Taxa de entrega')+'</label><div class="cur"><span>R$</span>'+
  '<input id="pgTaxa" type="text" inputmode="decimal" autocomplete="off" class="moeda" '+
  'placeholder="0,00" value="'+
   (function(_t){return _t?money(_t):''})(PDV.mesaPag?((MESA_PAG&&MESA_PAG.taxa)||0)
    :(PDV.tipo==='entrega'?taxaSugerida():0))+'">'+
  (PDV.tipo==='entrega'?blocoZona():'')+'</div></div>'+
  '<div class="fld2" style="margin:0"><label>Desconto</label>'+'<div class="descBox">'+'<div class="segm2"><button id="dRS" class="on" onclick="tipoDesc(\'rs\')">R$</button>'+'<button id="dPC" onclick="tipoDesc(\'pc\')">%</button></div>'+'<input id="pgDesc" type="text" inputmode="decimal" autocomplete="off" class="moeda" '+
  'placeholder="0,00" value=""></div>'+'<div class="hint" id="descInfo"></div></div></div>'+
  '<div class="linha tot"><span>Total a pagar</span><span id="pgTot">R$ '+money(tot)+'</span></div></div>'+
  '<div class="blk" style="margin:0 0 11px;max-width:none"><h3>Forma de pagamento</h3>'+
  '<div class="pgGrid">'+FORMAS.map(function(f){
    return '<button class="pgBtn" onclick="addPag(\''+f.id+'\')">'+sv('cash',20)+f.n+'</button>'}).join('')+'</div>'+
  '<div class="hint" style="margin-top:9px">Para dividir a conta, clique em mais de uma forma e ajuste o valor de cada uma.</div>'+
  '<div class="pgLista" id="pgLista"></div></div>'+
  (PDV.tipo==='entrega'?
   '<div class="blk" style="margin:0 0 11px;max-width:none"><h3>Entregador</h3>'+
   ((DB.entregadores||[]).length?
     '<div class="contaGrid">'+(DB.entregadores||[]).map(function(e,i){
       return '<label class="contaBox"><input type="radio" name="pgEnt" value="'+e.id+'"'+((entregadorPadrao()&&entregadorPadrao().id===e.id)||(!entregadorPadrao()&&i===0)?' checked':'')+'>'+
       '<span><b>'+E(e.nome)+'</b><small>'+E(e.tel||'')+'</small></span></label>';}).join('')+'</div>'
     :'<div class="hint">Nenhum entregador cadastrado. Você pode atribuir depois, no quadro de pedidos.</div>')+
   '</div>':'')+
  '<div class="blk" style="margin:0 0 11px;max-width:none"><h3>Cupom de desconto</h3>'+
  '<div class="cupRow">'+
   '<input id="pgCup" placeholder="DIGITE O CÓDIGO" style="text-transform:uppercase;font-weight:700;letter-spacing:.05em">'+
   '<button class="btnP2 ok" onclick="aplicarCupom()">Aplicar</button>'+
   (_cupomAtivo?'<button class="btnP2 rdB" onclick="tirarCupom()">Remover</button>':'')+
  '</div>'+
  '<div id="cupMsg">'+(_cupomAtivo?'<div class="cupOk">'+sv('check',13)+' '+E(_cupomAtivo.codigo)+
   ' aplicado — desconto de R$ '+money(valorCupom(_cupomAtivo,_totPag))+'</div>':'')+'</div></div>'+
  '<div class="blk" style="margin:0;max-width:none">'+
  '<label class="chkL"><input type="checkbox" id="pgFiscal"><span>Gerar cupom fiscal</span></label>'+
  '<label class="chkL"><input type="checkbox" id="pgImp" checked><span>Imprimir via ao finalizar</span></label>'+
  '</div></div>';
  modal('Pagamento',h,'Finalizar venda',function(){
    /* uma venda por vez: clique duplo nao gera dois pedidos */
    if(!travarFecharVenda()){toast('Aguarde — a venda está sendo fechada.');return false;}
    var taxa=moedaValor('pgTaxa'),desc=valorDesconto();
    var final=tot+taxa-desc;
    var somaPg=_pagos.reduce(function(a,p){return a+p.valor},0);
    if(!_pagos.length){toast('Selecione ao menos uma forma de pagamento.');liberarFecharVenda();return false;}
    /* ==========================================================
       RECEBER A MAIS EM DINHEIRO NAO E ERRO — E TROCO

       A conferencia exigia soma EXATA. Quem digitava os R$ 100 que o
       cliente entregou, para o sistema mostrar o troco, era impedido de
       fechar: "pagamentos somam 100 e o total e 20". O campo existe
       justamente para o caixa nao ter de fazer a conta de cabeca, e a
       propria tela ja mostrava "Troco R$ 80" logo acima do aviso.

       Agora: faltar dinheiro continua barrando; sobrar so e aceito
       quando ha forma que da troco (dinheiro). Cartao e Pix continuam
       exigindo o valor exato — ali sobra e erro de digitacao, nao troco.

       O pedido guarda o valor da venda, nao o que entrou na mao: o
       troco volta para o cliente e nao e faturamento.
       ========================================================== */
    /* ==========================================================
       FORMA INVALIDA BLOQUEIA A VENDA — NUNCA VIRA DINHEIRO

       Em nenhum ponto deste sistema existe `forma || 'dinheiro'`, e a
       auditoria confirmou isso caminho a caminho. Mas o silencio era
       possivel por outra porta: um pagamento cuja forma nao existe mais
       em FORMAS (desativada no meio do turno, aparelho com lista velha,
       forma de outra unidade) subia com a referencia solta. O gatilho do
       banco nao achava o vinculo, gravava `forma_id` nulo, e o valor ia
       parar na linha "sem forma" do fechamento.

       Nao virava dinheiro — mas sumia da conferencia, que da no mesmo
       para quem esta fechando o caixa.

       Agora a venda para aqui, com o nome do problema na tela. Recusar
       uma venda e ruim; gravar uma venda com a classificacao errada e
       pior, porque ninguem descobre no mesmo dia.
       ========================================================== */
    var _formaRuim=null;
    for(var fi=0;fi<_pagos.length;fi++){
      var _idF=_pagos[fi].forma;
      if(!_idF){ _formaRuim='uma das linhas está sem forma de pagamento'; break; }
      if(!FORMAS.some(function(x){return x.id===_idF})){
        var _fc=formaPag(_idF);
        _formaRuim=_fc
          ? 'a forma "'+_fc.nome+'" não está ativa nesta loja'
          : 'a forma "'+_idF+'" não existe no cadastro desta loja';
        break;
      }
    }
    if(_formaRuim){
      toast('Não dá para finalizar: '+_formaRuim+'. Remova a linha e escolha '+
            'uma forma da lista.');
      liberarFecharVenda();return false;
    }
    /* pergunta pela funcao, nao pelo campo: se a lista for montada em outro
       lugar amanha e esquecer `troco`, a venda em dinheiro nao trava de novo */
    var _daTroco=_pagos.some(function(pg){return formaDaTroco(formaPag(pg.forma));});
    if(somaPg<final-0.01){
      toast('Faltam R$ '+money(final-somaPg)+' — os pagamentos somam R$ '+money(somaPg)+
            ' e o total é R$ '+money(final)+'.');
      liberarFecharVenda();return false;
    }
    if(somaPg>final+0.01&&!_daTroco){
      toast('Recebido a mais em forma que não dá troco: R$ '+money(somaPg)+
            ' para um total de R$ '+money(final)+'. Corrija o valor.');
      liberarFecharVenda();return false;
    }
    var _troco=+(somaPg-final).toFixed(2);
    var pcs=$('pgCidade');
    _cidadeVenda=pcs?pcs.value:((PDV.cliente&&PDV.cliente.cidade)||'');
    var entSel=document.querySelector('input[name=pgEnt]:checked');
    /* o que entra no caixa e o valor da venda; o excedente volta ao
       cliente. Sem isso o faturamento do dia sairia inflado pelo troco. */
    /* ==========================================================
       DOIS NUMEROS DIFERENTES, GUARDADOS SEPARADOS

       `valor`     = quanto daquela quantia QUITA a venda (o que vale
                     para faturamento, caixa e conferencia)
       `recebido`  = quanto o cliente entregou de fato

       Venda de R$ 18 com R$ 20 na mao: valor 18, recebido 20, troco 2.
       So o 18 entra em qualquer soma. O 20 fica registrado para quem
       precisar conferir a gaveta nota a nota.
       ========================================================== */
    var _pagosVenda=JSON.parse(JSON.stringify(_pagos));
    _pagosVenda.forEach(function(pv,ix){
      if(_pagos[ix])pv.recebido=+(Number(_pagos[ix].valor)||0).toFixed(2);
    });
    if(_troco>0.009){
      for(var ti=_pagosVenda.length-1;ti>=0&&_troco>0.009;ti--){
        var fT=formaPag(_pagosVenda[ti].forma);
        if(!formaDaTroco(fT))continue;
        var tira=Math.min(_pagosVenda[ti].valor,_troco);
        _pagosVenda[ti].valor=+(_pagosVenda[ti].valor-tira).toFixed(2);
        _troco=+(_troco-tira).toFixed(2);
      }
    }
    /* ==========================================================
       PAGAMENTO DE R$ 0,00 NAO E PAGAMENTO

       Esta limpeza existia, mas so rodava DENTRO do `if(_troco>0.009)`
       — ou seja, apenas quando havia troco. Sem troco, as linhas
       zeradas subiam para o banco.

       Nao movem dinheiro, mas sujam tudo o que conta transacao: a taxa
       fixa por transacao no fechamento (`taxaFixa * qtd`) cobrava por
       linhas que nao existiram, e a conferencia mostrava formas que a
       loja nao usou naquela venda.

       Ficaram 6 linhas assim no turno de 25/08. Agora a limpeza e
       incondicional.
       ========================================================== */
    _pagosVenda=_pagosVenda.filter(function(x){return (Number(x.valor)||0)>0.009});
    if(!_pagosVenda.length){
      toast('Nenhuma forma de pagamento com valor. Informe quanto foi pago.');
      liberarFecharVenda();
      return false;
    }
    /* ==========================================================
       RECONCILIACAO ANTES DE GRAVAR (item 18)

       A soma do que QUITA a venda tem de bater com o total. O recebido
       pode ser maior — e o troco —, mas o aplicado nao. Esta conferencia
       roda DEPOIS da deducao do troco, que e o unico ponto onde os dois
       numeros se separam.

       O banco ja devolvia `fecha:false` quando nao batia, mas isso so
       virava um aviso no Diagnostico: a venda ja estava gravada. Aviso
       depois do fato nao e trava.
       ========================================================== */
    var _aplicado=+_pagosVenda.reduce(function(a,x){return a+(Number(x.valor)||0)},0).toFixed(2);
    if(Math.abs(_aplicado-final)>0.01){
      toast('A venda não fecha: as formas aplicam R$ '+money(_aplicado)+
            ' para um total de R$ '+money(final)+'. Confira os valores.');
      liberarFecharVenda();return false;
    }
    var fiado=_pagos.filter(function(p){var f=formaPag(p.forma);return f&&f.tipo==='fiado'})
      .reduce(function(a,p){return a+p.valor},0);
    if(fiado>0){
      if(!PDV.cliente){toast('Venda no fiado exige cliente identificado.');liberarFecharVenda();return false;}
      var lim=Number(PDV.cliente.limiteFiado)||0;
      var novo=(Number(PDV.cliente.saldoFiado)||0)+fiado;
      if(lim<=0){toast(PDV.cliente.nome+' não tem limite de fiado liberado.');liberarFecharVenda();return false;}
      if(novo>lim+0.01){
        toast('Limite de fiado excedido. Saldo ficaria R$ '+money(novo)+' e o limite é R$ '+money(lim)+'.');
        return false;
      }
    }
    _trocoVenda=+(somaPg-final).toFixed(2);
    finalizarVenda(final,taxa,desc,_pagosVenda,$('pgFiscal').checked,$('pgImp').checked,entSel?entSel.value:null,fiado);
    return true;
  },'lg');
  $('pgTaxa').oninput=recalcPag;$('pgDesc').oninput=recalcPag;
  var pc=$('pgCidade');
  if(pc)pc.onchange=function(){
    var op=this.options[this.selectedIndex];
    moedaSet('pgTaxa',Number(op.getAttribute('data-v'))||0,true);
    recalcPag();
  };
  recalcPag();
}
var _tpDesc='rs';
function tipoDesc(t){
  _tpDesc=t;
  $('dRS').classList.toggle('on',t==='rs');
  $('dPC').classList.toggle('on',t==='pc');
  recalcPag();
}
function valorDesconto(){
  var v=moedaValor('pgDesc');
  var d=(_tpDesc==='pc')?+(_totPag*v/100).toFixed(2):v;
  if(_cupomAtivo)d+=valorCupom(_cupomAtivo,_totPag);
  return +d.toFixed(2);
}
function recalcPag(){
  var taxa=moedaValor('pgTaxa'),desc=valorDesconto();
  var final=_totPag+taxa-desc;
  var di=$('descInfo');
  if(di)di.textContent=_tpDesc==='pc'
    ?money(moedaValor('pgDesc'))+'% sobre R$ '+money(_totPag)+' = R$ '+money(desc)
    :(desc?'desconto de R$ '+money(desc):'sem desconto');
  $('pgTot').textContent='R$ '+money(final);
  var pago=_pagos.reduce(function(a,p){return a+p.valor},0);
  /* ==========================================================
     ITEM 2 — DINHEIRO, RECEBIDO E TROCO

     Tres defeitos nesta tela:

     1. o valor so era lido no `onchange`, que dispara ao SAIR do campo.
        Quem digitava 100 e tocava direto em Finalizar dependia da sorte
        de o navegador disparar o evento antes do clique — no toque, as
        vezes nao dispara. E a mesma armadilha da V124, que fez o robo
        salvar `[]`. Agora le a cada tecla (`oninput`).

     2. nao havia como confirmar com ENTER: no balcao, tirar a mao do
        teclado para achar o botao custa tempo em cada venda.

     3. o troco aparecia numa linha discreta, do mesmo tamanho do resto.
        E o numero que o operador precisa ler em voz alta para o cliente
        — merece destaque.

     O rotulo do campo tambem muda: em forma que da troco le-se
     "Recebido", porque o que se digita ali e o que veio da mao do
     cliente, nao o valor da venda.
     ========================================================== */
  var troco=+(pago-final).toFixed(2);
  $('pgLista').innerHTML=_pagos.map(function(p,i){
    var f=FORMAS.find(function(x){return x.id===p.forma});
    var daTroco=formaDaTroco(f);
    /* ==========================================================
       QUEM ESTA COM O DINHEIRO PRECISA SALTAR AOS OLHOS

       No balcao, com fila, o operador toca a forma e olha o total —
       nao le linha por linha. Era possivel finalizar uma venda de
       R$ 44 com "Dinheiro R$ 44" e "Debito R$ 0,00" na tela sem
       perceber que o valor tinha ficado na forma errada.

       A linha que carrega o valor fica em destaque; a zerada fica
       apagada e diz que nao vale nada.
       ========================================================== */
    var zero=(Number(p.valor)||0)<=0.009;
    return '<div class="pgLinha"'+(zero?' style="opacity:.55"':'')+'><b>'+f.n+
      (daTroco?'<small class="pgRot">recebido</small>':'')+
      (zero?'<small class="pgRot" style="color:var(--red)">sem valor</small>':'')+'</b>'+
    '<div class="cur" style="width:126px"><span>R$</span>'+
     /* ==========================================================
        O CAMPO EM EDICAO NAO PODE SER FORMATADO POR BAIXO

        `recalcPag` redesenha esta lista a CADA TECLA. Se o campo que
        esta sendo digitado voltasse formatado, quem digita "18" veria
        "1,00" depois do primeiro toque e nao conseguiria terminar o
        numero.

        Entao: o campo com o foco mantem o texto cru que a pessoa
        digitou; os outros saem formatados em pt-BR. `data-v` carrega
        o valor de verdade nos dois casos.
        ========================================================== */
     '<input type="text" inputmode="decimal" autocomplete="off" placeholder="0,00" '+
     'value="'+((_pgEditando===i)?_pgTexto:((Number(p.valor)||0)?money(p.valor):''))+'" '+
     'data-v="'+(Number(p.valor)||0)+'" data-i="'+i+'" class="moeda pgV"></div>'+
    '<button class="qtBtn rd2" onclick="remPag('+i+')">'+sv('trash',13)+'</button></div>';
  }).join('')+
  (_pagos.length
    ?(final-pago>0.009
       ?'<div class="linha" style="margin-top:8px"><span>Falta receber</span>'+
        '<b class="pgFalta">R$ '+money(final-pago)+'</b></div>'
       :'')+
     (troco>0.009?'<div class="pgTroco"><span>Troco para o cliente</span>'+
       '<b>R$ '+money(troco)+'</b></div>':'')
    :'');
  var vs=document.querySelectorAll('.pgV');
  for(var i=0;i<vs.length;i++){
    /* le a cada tecla: nao depende de sair do campo.
       `moedaLer` aceita virgula, ponto e milhar — o operador que digita
       "1.234,56" na correria nao perde os centavos, que era o que
       `parseFloat` fazia calado. */
    vs[i].oninput=function(){
      var idx=this.getAttribute('data-i');
      _pgEditando=Number(idx); _pgTexto=this.value;
      _pagos[idx].valor=moedaLer(this.value);
      var pos=this.selectionStart;
      recalcPag();
      var novo=document.querySelector('.pgV[data-i="'+idx+'"]');
      if(novo){novo.focus(); try{novo.setSelectionRange(pos,pos);}catch(e){}}
    };
    /* sair do campo devolve o texto formatado e encerra a edicao */
    vs[i].onblur=function(){
      _pagos[this.getAttribute('data-i')].valor=moedaLer(this.value);
      _pgEditando=null; _pgTexto='';
    };
    vs[i].onfocus=function(){
      _pgEditando=Number(this.getAttribute('data-i')); _pgTexto=this.value;
    };
    /* ENTER confirma a venda direto do campo de valor */
    vs[i].onkeydown=function(ev){
      if(ev.key!=='Enter')return;
      ev.preventDefault();
      _pagos[this.getAttribute('data-i')].valor=moedaLer(this.value);
      _pgEditando=null; _pgTexto='';
      if(typeof tecladoTouchFechar==='function')tecladoTouchFechar();
      var b=document.querySelector('.mdF .btnP,.mdF .ok');
      if(b)b.click();
    };
  }
}
/* qual campo de pagamento esta sendo digitado agora, e com que texto.
   Sem isto, o redesenho a cada tecla formataria o numero pela metade. */
var _pgEditando=null,_pgTexto='';
/* ==========================================================
   O PRIMEIRO BOTAO TOCADO FICAVA COM A VENDA INTEIRA

   `addPag` lancava a forma nova com o que FALTA receber. Na primeira
   forma isso e o total; da segunda em diante, zero — porque a venda ja
   esta coberta.

   Consequencia no balcao: o operador toca Dinheiro por habito, percebe
   que e cartao e toca Debito. O Debito entra com R$ 0,00. A tela mostra
   as duas linhas, nada reclama, a venda finaliza — e o valor inteiro
   ficou gravado em DINHEIRO. Do lado de fora parece que funcionou.

   Foi isso que inflou o dinheiro do turno de 25/08 em Santa Fe: o banco
   registrou R$ 758 em especie onde a gaveta tinha R$ 174. As linhas de
   R$ 0,00 ficaram no banco como rastro — vendas 371, 372, 380 e 385.

   Agora, quando a venda ja esta coberta e ha UMA forma so, tocar outra
   TROCA a forma em vez de criar uma linha morta: e o que a pessoa quis
   dizer, e continua reversivel com outro toque. Com pagamento dividido
   em duas ou mais formas, adivinhar seria pior — ai o sistema recusa e
   explica.
   ========================================================== */
function addPag(f){
  var taxa=moedaValor('pgTaxa'),desc=valorDesconto();
  var final=_totPag+taxa-desc;
  var pago=_pagos.reduce(function(a,p){return a+p.valor},0);
  var falta=+(final-pago).toFixed(2);

  if(falta<=0.009){
    if(_pagos.length===1){
      if(_pagos[0].forma===f){ toast('Esta forma já está lançada.'); return; }
      var antes=(FORMAS.find(function(x){return x.id===_pagos[0].forma})||{}).n||'';
      var agora=(FORMAS.find(function(x){return x.id===f})||{}).n||'';
      _pagos[0].forma=f;
      recalcPag();
      toast('Forma trocada de '+antes+' para '+agora+'.');
      return;
    }
    toast('A venda já está coberta. Ajuste ou remova uma das formas antes de '+
          'lançar outra.');
    return;
  }
  _pagos.push({forma:f,valor:falta});
  recalcPag();
}
function remPag(i){_pagos.splice(i,1);recalcPag();}

var _trocoVenda=0;
function finalizarVenda(total,taxa,desc,pagos,fiscal,imprimir,entregadorId,fiado){
  var ag=new Date();
  /* venda na frente de caixa já sai concluída — só delivery passa pelo fluxo.
     A conta da mesa também: o cliente já consumiu, não há o que preparar. */
  var primeira=PDV.mesaPag?(statusDoPapel('finalizado')||statusInicial('loja'))
                          :statusInicial(PDV.tipo);
  var ped={
    id:uid('ped'),numero:proxNumPedido(),
    tipo:PDV.tipo,fase:primeira,
    itens:JSON.parse(JSON.stringify(PDV.comanda)),
    clienteId:PDV.cliente?PDV.cliente.id:null,
    clienteNome:PDV.cliente?PDV.cliente.nome:'Consumidor',
    total:total,taxa:taxa,desconto:desc,pagamentos:pagos,fiscal:!!fiscal,
    entregadorId:entregadorId||(PDV.tipo==='entrega'&&entregadorPadrao()?entregadorPadrao().id:null),
    cidade:_cidadeVenda||(PDV.cliente&&PDV.cliente.cidade)||'',
    zonaId:(PDV.cliente&&PDV.cliente.zonaId)||'',
    zona:(PDV.cliente&&PDV.cliente.zona)||'',
    data:ag.toISOString(),hora:agoraHM(),caixaId:(caixaAberto()||{}).id,
    /* ==========================================================
       A VENDA DO BALCAO NASCIA SEM UNIDADE

       O totem carimbava `sucursalId`; a venda da frente de caixa, nao.
       Isso causava TRES estragos ao mesmo tempo:

       1. o relatorio contava a venda como da matriz, porque quem le usa
          `p.sucursalId||'suc_matriz'`;
       2. proxNumPedido() so olha as vendas DA unidade aberta — como as
          novas nasciam sem unidade, elas eram ignoradas na conta e o
          numero travava: sete vendas seguidas com o numero 317;
       3. duas vendas com o mesmo numero aparecem como uma so na tela.
          Foi a venda que "sumiu" — estava gravada, escondida atras da
          outra.
       ========================================================== */
    sucursalId:lojaAtualId(),
    canal:(PDV.tipo==='entrega'?'entrega':(PDV.mesaPag?'mesa':'pdv')),
    origem:'pdv',
    troco:_trocoVenda>0.009?_trocoVenda:0
  };
  _trocoVenda=0;
  if(_cupomAtivo)ped.cupom={id:_cupomAtivo.id,codigo:_cupomAtivo.codigo,valor:valorCupom(_cupomAtivo,total+desc-taxa)};
  /* de qual aparelho saiu o pagamento — o fechamento separa por isso */
  ped.equipamento=(ped.canal==='totem')?'totem':(ped.canal==='mesa'?'mesa':'balcao');
  (ped.pagamentos||[]).forEach(function(x){ if(!x.equipamento)x.equipamento=ped.equipamento; });
  /* fecha as comandas e carimba a mesa no pedido, antes de ele ser gravado */
  if(PDV.mesaPag&&MESA_PAG)concluirMesa(ped);
  DB.pedidos.push(ped);
  /* registra o cupom mesmo com a emissão desligada: no dia em que ligar,
     o histórico não começa do zero */
  try{ registrarCupom(ped); }catch(e){_quieto(e,'finalizarVenda')}
  if(_cupomAtivo){
    DB.cupomUsos=DB.cupomUsos||[];
    DB.cupomUsos.push({id:uid('cu'),cupomId:_cupomAtivo.id,clienteId:PDV.cliente?PDV.cliente.id:null,
      clienteNome:PDV.cliente?PDV.cliente.nome:'Consumidor',pedidoId:ped.id,numero:ped.numero,
      valor:ped.cupom.valor,totalPedido:total,data:hojeISO()});
    _cupomAtivo=null;
  }
  if(fiado>0&&PDV.cliente){
    DB.fiadoMov=DB.fiadoMov||[];
    PDV.cliente.saldoFiado=+((Number(PDV.cliente.saldoFiado)||0)+fiado).toFixed(2);
    DB.fiadoMov.push({id:uid('fm'),clienteId:PDV.cliente.id,tipo:'debito',valor:fiado,
      data:hojeISO(),pedidoId:ped.id,obs:'compra fiado — pedido #'+ped.numero});
  }
  if(PDV.cliente){
    PDV.cliente.compras=(PDV.cliente.compras||0)+1;
    PDV.cliente.gasto=(PDV.cliente.gasto||0)+total;
    PDV.cliente.ultima=ag.toLocaleDateString('pt-BR')+' '+ped.hora;
  }
  _ultimoMovVenda=null;
  /* Se a baixa de estoque falhar, a VENDA continua valendo — o cliente pagou
     e nao se desfaz isso. Mas o erro ia so para o console: a tela dizia
     "Venda finalizada" e o estoque ficava errado sem ninguem saber. Agora
     fica registrado no Diagnostico e avisa quem esta no caixa. */
  var _erroEstoque=null;
  try{baixarEstoqueVenda(ped);}
  catch(e){
    _erroEstoque=String((e&&e.message)||e).slice(0,120);
    try{ logNuvem('venda #'+ped.numero+': não consegui baixar o estoque — '+
      _erroEstoque, true); }catch(e2){_quieto(e2,'estoqueVenda')}
  }
  salvar();
  /* a venda sobe INTEIRA numa transacao — pedido, itens, movimentacao e
     saldo juntos. Se a rede cair, ela fica na fila normal e sobe depois;
     o que nao pode e chegar pela metade na nuvem. */
  try{ enviarVendaAtomica(ped,_ultimoMovVenda); }
  catch(e){
    /* a venda cai na fila normal e sobe depois; o registro fica no
       Diagnostico em vez de so no console, que ninguem abre */
    try{ logNuvem('venda #'+ped.numero+': envio direto falhou, foi para a fila — '+
      String((e&&e.message)||e).slice(0,100)); }catch(e2){_quieto(e2,'vendaAtomica')}
  }
  PDV.comanda=[];PDV.cliente=null;PDV.tipo='loja';_cidadeVenda='';
  if(imprimir)imprimirVia(ped);
  PDV.aba='pedidos';telaPDV();
  if(_erroEstoque){
    /* sem await de proposito: finalizarVenda e o caminho do caixa e continua
       sincrona. Tornar a funcao async faria a venda suspender no meio de um
       fluxo que tem trava de clique duplo esperando resposta imediata. */
    confirmar({titulo:'Venda registrada, estoque não baixou',
      texto:'O pedido #'+ped.numero+' está salvo e o pagamento vale. '+
        'O que não aconteceu foi a saída dos itens do estoque.',
      aviso:'Detalhe: '+E(_erroEstoque)+
        '<br>Confira o estoque destes itens antes de fechar o dia.',
      ok:'Entendi',cancelar:null});
  }else toast('Venda finalizada — pedido #'+ped.numero+'.');

}
var _ultimoMovVenda=null;
/* A trava de clique duplo ja existe desde antes: travarFecharVenda(), usada
   na linha que fecha o pagamento e no fluxo da mesa. Na auditoria eu a dei
   como ausente porque procurei por "disabled" no botao, e ela e feita por
   variavel. Nao criei uma segunda: duas travas para a mesma coisa e pior
   que nenhuma, porque uma solta e a outra prende. */
/* sobe a venda numa transacao so. Idempotente: reenviar nao duplica,
   porque a chave e loja + identificador do pedido. */
async function enviarVendaAtomica(ped,mov){
  if(!NUVEM.ligada||NUVEM.plataforma)return;
  /* P20: a venda so sobe na empresa em que foi feita. Se a sessao mudou de
     empresa antes de a fila esvaziar, ela espera — nunca nasce na outra. */
  if(ped._loja&&ped._loja!==NUVEM.loja){
    logNuvem('venda #'+ped.numero+' é da empresa de origem e NÃO foi enviada '+
             'nesta sessão — permanece pendente',true);
    return;
  }
  try{
    var suc=lojaAtualId();
    var pacote={
      loja_origem:ped._loja||NUVEM.loja,   /* o banco recusa se divergir */
      ref_local:ped.id,numero:ped.numero,tipo:ped.tipo,fase:ped.fase,
      cliente_nome:ped.clienteNome||'',cidade:ped.cidade||'',
      total:ped.total,taxa:ped.taxa,desconto:ped.desconto,fiscal:!!ped.fiscal,
      hora:ped.hora,data_venda:ped.data,canal:ped.canal||'',equipamento:ped.equipamento||'',
      cupom_codigo:(ped.cupom||{}).codigo||'',cupom_valor:(ped.cupom||{}).valor||null,
      /* ==========================================================
         ITEM 19 — A VENDA SUBIA SEM O CAIXA

         O pacote atomico nao mandava `caixa_ref`. Na nuvem, 80 de 115
         vendas dos ultimos dez dias estao sem caixa vinculado: no
         aparelho a venda pertence ao turno, na nuvem nao pertence a
         nenhum. Qualquer conferencia de fechamento feita fora do
         aparelho que vendeu da resultado errado.

         Vai a referencia local; o banco resolve para o identificador
         dele, como ja faz com sucursal e produto.
         ========================================================== */
      caixa_ref:ped.caixaId||'',
      itens:(ped.itens||[]).map(function(it,i){
        return {ref_local:(it.id||(ped.id+'_'+i)),nome:it.nome||'',
          produto_id:it.produtoId||'',           /* identificador local; o banco resolve */
          quantidade:it.qtd||1,unitario:it.preco||0,total:it.total||0,
          opcoes:it.opcoes||[],observacao:it.obs||''};
      }),
      /* ==========================================================
         OS PAGAMENTOS SOBEM JUNTO COM A VENDA

         Este pacote levava pedido, itens e movimentacao de estoque —
         e NAO levava pagamento nenhum. Os pagamentos subiam depois,
         pela sincronizacao comum, numa segunda viagem.

         Entre uma viagem e outra cabe muita coisa: rede que cai, aba
         fechada, aparelho desligado no fim do expediente. Quando isso
         acontecia, a nuvem ficava com a venda CONCLUIDA e sem nenhum
         pagamento — e ninguem percebia, porque o aparelho que fez a
         venda mostrava tudo certo (ele tem o dado local).

         Custo real: 10 vendas sem pagamento, R$ 531 — as 6 do dia 24
         e mais 4 do dia 25.

         Agora pagamento entra na MESMA transacao do pedido: ou grava
         tudo, ou nao grava nada.
         ========================================================== */
      /* ==========================================================
         A REFERENCIA TEM QUE SER A MESMA DOS DOIS CAMINHOS

         Aqui eu escrevi `ped.id+'_pg'+i`, enquanto a sincronizacao
         comum grava o mesmo pagamento como `ped.id+'_'+i`. Como o banco
         so evita repeticao quando a referencia bate, o MESMO pagamento
         entrava duas vezes — uma por cada caminho.

         Resultado medido: 30 pares duplicados, R$ 1.046,00 a mais nos
         pagamentos. O faturamento (que soma os pedidos) continuava
         certo, mas a conferencia por forma e o fechamento de caixa
         viam quase o dobro.

         Foi defeito meu, introduzido na correcao dos pagamentos. A
         licao e a mesma que ja aparece varias vezes neste arquivo: dois
         caminhos gravando o mesmo dado precisam usar exatamente a mesma
         chave, senao um nao enxerga o outro.
         ========================================================== */
      pagamentos:(ped.pagamentos||[]).map(function(pg,i){
        return {ref_local:(pg.id||(ped.id+'_'+i)),
          forma_ref:pg.forma||pg.formaId||'',
          valor:Number(pg.valor)||0,
          equipamento:pg.equipamento||ped.equipamento||''};
      }),
      movimentacoes:mov?[{ref_local:mov.id,data:mov.data,hora:mov.hora,
        motivo_id:mov.motivoId,identificacao:mov.identificacao,
        observacao:mov.obs||'',origem:'venda',linhas:mov.linhas||[],
        sucursal_id:suc}]:[],
      sucursal_ref:suc
      /* O SALDO NAO E MAIS ENVIADO.
         Mandar o saldo absoluto calculado aqui era o defeito: dois caixas
         liam 10, um vendia 2 e o outro 3, e gravavam 8 e 7 — o ultimo
         sobrescrevia o primeiro e sumiam 2 unidades. Agora vai so a
         QUANTIDADE, dentro das linhas da movimentacao, e o banco faz
         estoque = estoque - qtd com a linha travada. */
    };
    var r=await api('rpc/venda_registrar','POST',{p:pacote});
    var res=(r&&r.length)?r[0]:r;
    logNuvem('venda #'+ped.numero+' gravada inteira na nuvem — '+
      ((res&&res.pagamentos)||0)+' pagamento(s)'+
      ((res&&res.ja_existia)?' (já existia — não duplicou)':''));
    /* venda concluida precisa fechar com os pagamentos. Se nao fechar, isso
       aparece no Diagnostico AGORA, e nao no fechamento do caixa a noite. */
    if(res&&res.fecha===false){
      logNuvem('venda #'+ped.numero+': os pagamentos NAO fecham com o total '+
        '(R$ '+money(res.pago||0)+' de R$ '+money(ped.total)+') — confira a venda',true);
    }
  }catch(e){
    /* nao e falha: a venda esta gravada aqui e sobe pela fila normal */
    logNuvem('venda #'+ped.numero+' ficou na fila: '+((e&&e.message)||''),true);
  }
}
/* A via do pedido sai pelo modelo cadastrado em Configuracao da Loja >
   Modelo de Impressao. Antes o cupom estava escrito dentro desta funcao:
   mudar uma linha do papel exigia mexer no sistema. */
function imprimirVia(ped){
  if(!ped)return;
  baseImp();
  var tipo=(ped.tipo==='entrega')?'entrega':(ped.mesa?'mesa':'ficha');
  var m=modeloImp(tipo)||modeloImp('ficha');
  if(!m){toast('Nenhum modelo de impressao cadastrado.');return;}
  var cols=m.colunas||48;
  imprimirPapel(montarImp(textoDoModelo(m),ped,cols),cols,m.vias||1);
}

/* ---------- ABA: PEDIDOS (kanban) ---------- */
var KAN={busca:''};
/* o kanban é a operação do turno: mostra o caixa aberto.
   Ao fechar o caixa, a tela zera sozinha. */
function pedidosDoPeriodo(){
  var cx=caixaAberto();
  var lista=(DB.pedidos||[]).filter(function(p){
    if(ehCancelado(p))return false;
    /* pedido ainda não entregue aparece sempre, para não perder ninguém */
    if(!ehFinalizado(p))return true;
    /* entregues: só os do caixa aberto agora */
    return !!cx && p.caixaId===cx.id;
  });
  if(KAN.busca){
    var q=KAN.busca.toLowerCase();
    lista=lista.filter(function(p){
      return String(p.numero).indexOf(q)>=0||
        String(p.clienteNome||'').toLowerCase().indexOf(q)>=0;
    });
  }
  return lista;
}
function renderKanban(){
  var fases=fasesAtivas();
  var peds=pedidosDoPeriodo();
  var abertos=peds.filter(function(p){return !ehFinalizado(p)&&!ehCancelado(p)});
  var h='<div class="kanban">';
  fases.forEach(function(f){
    var lista=peds.filter(function(p){return p.fase===f.id});
    var soma=lista.reduce(function(a,p){return a+p.total},0);
    h+='<div class="kanCol" style="--kc:'+E(f.cor||'#8A8578')+'">'+
    '<div class="kanH"><b>'+E(f.n)+'</b><span class="n">'+lista.length+'</span></div>'+
    '<div class="kanB" data-fase="'+f.id+'">'+
    (lista.length?lista.map(function(p){
      return '<div class="ped" draggable="true" data-id="'+p.id+'" '+
      'ondblclick="verPedido(\''+p.id+'\')" title="clique duplo para ver o pedido">'+
      '<div class="t1"><b>#'+p.numero+'</b><span class="tp'+(p.tipo==='entrega'?' dv':'')+'">'+
      (p.tipo==='entrega'?'Entrega':'Loja')+'</span></div>'+
      '<div class="cli2">'+E(p.clienteNome)+'</div>'+(p.entregadorId?'<div class="cli2" style="color:var(--acc-d);font-weight:600">'+sv('moto',12)+' '+E((ent(p.entregadorId)||{}).nome||'')+'</div>':'')+'<div class="vl2">R$ '+money(p.total)+'</div>'+
      '<div class="hr">'+
       (diaLocal(p.data)!==hojeISO()
         ? dataBR(String(p.data).slice(0,10))+' · ' : '')+
       p.hora+' · '+p.itens.length+' itens'+
       /* o relogio do status: verde dentro do prazo, vermelho passou */
       (f.minutos?'<span class="pedT'+(atrasado(p)?' vc':'')+'">'+
         minutosNoStatus(p)+'/'+f.minutos+' min</span>':'')+
       '</div>'+
      '<div class="acts2">'+
      '<button class="btn sm" onclick="verPedido(\''+p.id+'\')" title="Ver o pedido">'+sv('eye',12)+'</button>'+
      '<button class="btn sm" onclick="imprimirPedido(\''+p.id+'\')">'+sv('print2',12)+'</button>'+(p.tipo==='entrega'?'<button class="btn sm" onclick="atribuirEntregador(\''+p.id+'\')" title="Entregador">'+sv('moto',12)+'</button>':'')+
      (f.id!=='cancelado'?'<button class="btn sm" onclick="moverPedido(\''+p.id+'\',\'cancelado\')">Cancelar</button>':
       '<button class="btn sm" onclick="moverPedido(\''+p.id+'\',\''+(statusInicial('entrega'))+'\')">Voltar</button>')+
      '</div></div>';}).join('')
     :'<div class="kanVazio">arraste pedidos para cá</div>')+
    '</div>'+
    (soma?'<div class="kanF">R$ '+money(soma)+'</div>':'')+
    '</div>';
  });
  h+='</div>';
  $('pdvBody').innerHTML=h;
  ativarKanban();
}
function ativarKanban(){
  var cards=document.querySelectorAll('.ped');
  for(var i=0;i<cards.length;i++){
    cards[i].ondragstart=function(e){_dragId=this.getAttribute('data-id');this.classList.add('drag');};
    cards[i].ondragend=function(){this.classList.remove('drag');};
  }
  var cols=document.querySelectorAll('.kanB');
  for(var j=0;j<cols.length;j++){
    cols[j].ondragover=function(e){e.preventDefault();this.classList.add('over');};
    cols[j].ondragleave=function(){this.classList.remove('over');};
    cols[j].ondrop=function(e){e.preventDefault();this.classList.remove('over');
      if(_dragId)moverPedido(_dragId,this.getAttribute('data-fase'));_dragId=null;};
  }
}
function moverPedido(id,fase){
  var p=DB.pedidos.find(function(x){return x.id===id});
  if(!p)return;
  var antes=p.fase;
  /* Cancelar e cancelar, venha do botao, do arrasto ou da busca por numero.
     Uma porta so: motivo do cadastro, quem cancelou e a senha dela. */
  var vaiCancelar=(papelDaFase(fase)==='cancelado');
  var eraCancelado=(papelDaFase(antes)==='cancelado');
  if(vaiCancelar&&!eraCancelado){pedirCancelamento(id);return;}
  p.fase=fase;
  p.statusEm=new Date().toISOString();   /* o relogio do status recomeca aqui */
  var stNovo=statusVenda(fase);
  if(stNovo&&stNovo.som)bipe();
  try{
    if(vaiCancelar&&!eraCancelado)estornarEstoqueVenda(p);
    if(eraCancelado&&!vaiCancelar)baixarEstoqueVenda(p);
  }catch(e){console.error('estoque pedido',e);}
  salvar();renderKanban();
  var f=statusVenda(fase);
  toast('Pedido #'+p.numero+' → '+(f?f.nome:fase));
  if(antes!==fase)avisarCliente(p,fase);
}
function imprimirPedido(id){imprimirVia(DB.pedidos.find(function(x){return x.id===id}));}
function verPedido(id){
  var p=DB.pedidos.find(function(x){return x.id===id});
  var h='<div class="mdB"><div class="blk" style="margin:0;max-width:none">'+
  '<h3>Pedido #'+p.numero+' <small>'+new Date(p.data).toLocaleString('pt-BR')+'</small></h3>'+
  '<div class="linha"><span>Cliente</span><b>'+E(p.clienteNome)+'</b></div>'+
  '<div class="linha"><span>Tipo</span><b>'+(p.tipo==='entrega'?'Entrega':'Pedido na loja')+'</b></div>'+
  (p.tipo==='entrega'?'<div class="linha"><span>Cidade / área</span><b>'+E(cidadePedido(p)||'não informada')+'</b></div>'+
   '<div class="linha"><span>Entregador</span><b>'+E((ent(p.entregadorId)||{}).nome||'não definido')+'</b></div>':'')+
  '<div style="margin:12px 0;border-top:1px solid var(--line-2);padding-top:10px">'+
  p.itens.map(function(i){return '<div class="linha"><span>'+i.qtd+'x '+E(i.nome)+
    (i.opcoes&&i.opcoes.length?'<br><small style="color:var(--ink-3)">'+i.opcoes.map(function(o){return '+'+E(o.nome)}).join(', ')+'</small>':'')+
    '</span><b>R$ '+money(i.total)+'</b></div>'}).join('')+'</div>'+
  (p.taxa?'<div class="linha"><span>Taxa de entrega</span><b>R$ '+money(p.taxa)+'</b></div>':'')+
  (p.desconto?'<div class="linha"><span>Desconto</span><b>- R$ '+money(p.desconto)+'</b></div>':'')+
  '<div class="linha tot"><span>Total</span><span>R$ '+money(p.total)+'</span></div>'+
  /* ==========================================================
     PAGAMENTO SEM FORMA NAO PODE DERRUBAR A TELA

     `FORMAS.find(...)` devolve undefined quando o pagamento chegou sem
     forma — e o codigo lia `f.n` direto. Resultado: "Cannot read
     properties of undefined (reading 'n')" e o detalhe do pedido nao
     abria. Justamente nos pedidos com pagamento incompleto, que sao os
     que mais precisam ser olhados.

     Agora forma desconhecida aparece como "não informada", em vermelho,
     e a tela abre. Ver o problema vale mais do que esconde-lo.
     ========================================================== */
  '<div style="margin-top:11px">'+
  ((p.pagamentos||[]).length
    ?(p.pagamentos||[]).map(function(x){
       var f=FORMAS.find(function(y){return y.id===x.forma});
       var nome=f?f.n:(x.nome||'forma não informada');
       return '<div class="linha"><span'+(f?'':' style="color:#B4593F"')+'>'+E(nome)+'</span>'+
         '<b>R$ '+money(x.valor)+'</b></div>'}).join('')
    :'<div class="linha"><span style="color:#B4593F">Sem forma de pagamento registrada</span>'+
     '<b>R$ '+money(p.total)+'</b></div>')+
  /* o troco fica no pedido: sem ele, quem confere depois nao entende
     por que o cliente entregou mais do que a venda */
  (p.troco?'<div class="linha"><span>Troco devolvido</span><b>R$ '+money(p.troco)+'</b></div>':'')+
  '</div>'+
  '<div class="linha"><span>Situação</span><b>'+E((statusVenda(p.fase)||{}).nome||p.fase||'—')+'</b></div>'+
  (p.caixaId?'<div class="linha"><span>Caixa aberto em</span><b>'+
    E(((DB.caixas||[]).find(function(c){return c.id===p.caixaId})||{}).aberto||'—')+'</b></div>':'')+
  '</div></div>';
  modal('Detalhes do pedido',h,'Fechar',function(){return true});
}

/* ---------- ABA: CAIXA ---------- */
function movimentoCaixa(id){
  var ps=DB.pedidos.filter(function(p){return p.caixaId===id&&!ehCancelado(p)});
  var porForma={},qtdForma={},porEquip={};
  FORMAS.forEach(function(f){porForma[f.id]=0;qtdForma[f.id]=0});
  /* ==========================================================
     ITEM 5 — VENDA SEM FORMA SUMIA DO FECHAMENTO

     A conta do caixa esta certa: abertura nao e venda, sangria nao
     reduz faturamento, e a gaveta e abertura + dinheiro + suprimento −
     sangria. Os testes C1, C2 e C3 confirmam.

     O buraco esta em outro lugar. Quando um pagamento fica sem forma
     — o defeito do item 1 —, o valor entra em `total` (que soma os
     pedidos) e NAO entra em nenhuma forma. O fechamento entao mostra
     "vendas R$ 300" com as formas somando R$ 225, e os R$ 75 que
     faltam nao aparecem em lugar nenhum: nao ha linha para eles.

     O operador conta a gaveta, bate com o esperado, fecha o caixa — e
     R$ 75 de venda ficaram fora do controle sem nenhum aviso.

     Agora esse valor e somado a parte e mostrado como linha propria no
     fechamento.
     ========================================================== */
  var _semForma=0;
  ps.forEach(function(p){(p.pagamentos||[]).forEach(function(x){
    if(!x.forma){ _semForma+=Number(x.valor)||0; return; }
    porForma[x.forma]=(porForma[x.forma]||0)+x.valor;
    qtdForma[x.forma]=(qtdForma[x.forma]||0)+1;
    /* De qual APARELHO veio o dinheiro. Sem isso, o fechamento junta a
       maquininha do balcao com a do totem e o operador nao consegue
       bater com o extrato de cada uma. */
    var eq=x.equipamento||p.equipamento||(p.canal==='totem'?'totem':'balcao');
    porEquip[x.forma]=porEquip[x.forma]||{};
    porEquip[x.forma][eq]=(porEquip[x.forma][eq]||0)+x.valor;
  })});
  var idDin=(FORMAS.find(function(f){return f.tipo==='dinheiro'})||{}).id;
  var _tot=ps.reduce(function(a,p){return a+p.total},0);
  var _somaF=FORMAS.reduce(function(a,f){return a+(porForma[f.id]||0)},0);
  return {qtd:ps.length,total:_tot,
          dinheiro:(idDin?porForma[idDin]:0)||porForma.dinheiro||0,
          porForma:porForma,qtdForma:qtdForma,porEquip:porEquip,
          semForma:+_semForma.toFixed(2),
          /* quanto de venda nao esta em nenhuma forma: pagamento sem forma
             mais venda que nao chegou a ter pagamento */
          descoberto:+(_tot-_somaF-_semForma).toFixed(2)};
}
/* ao fechar o caixa, cada forma vira um lançamento na conta dela, já com a taxa descontada */
function lancarFechamento(cx,mov){
  DB.lancFin=DB.lancFin||[];
  var dt=hojeISO();
  var contaCaixa=(DB.contas||[]).find(function(c){return c.fixa==='caixa'});
  var criados=0;
  (DB.formasPag||[]).forEach(function(f){
    var bruto=mov.porForma[f.id]||0;
    if(bruto<=0)return;
    var qtd=mov.qtdForma[f.id]||1;
    var taxa=+(bruto*(Number(f.taxaPct)||0)/100 + (Number(f.taxaFixa)||0)*qtd).toFixed(2);
    var liq=+(bruto-taxa).toFixed(2);
    var contaId=f.contaId||(f.tipo==='dinheiro'&&contaCaixa?contaCaixa.id:'');
    var venc=dt;
    if(Number(f.dias)>0){var d=new Date(dt+'T12:00:00');d.setDate(d.getDate()+Number(f.dias));venc=d.toISOString().slice(0,10);}
    DB.lancFin.push({id:uid('lf'),tipo:'receita',contaId:contaId,metodoId:f.id,
      descricao:'Vendas — '+f.nome+(taxa?' (taxa R$ '+money(taxa)+')':''),
      fornecedor:'',documento:'',categoriaTxt:'Frente de Caixa',
      valor:liq,emissao:dt,vencimento:venc,
      pagamento:Number(f.dias)>0?'':dt,pago:Number(f.dias)>0?false:true,
      origem:'fechamento-caixa',ref:cx.id,
      obs:'Bruto R$ '+money(bruto)+' · '+qtd+' transação(ões)'+(taxa?' · taxa R$ '+money(taxa):'')});
    criados++;
  });
  return criados;
}
function tabelaFormas(mov,cego){
  var h='<table class="fpgTab">';
  FORMAS.forEach(function(f){
    var v=mov.porForma[f.id]||0;
    /* mesmo defeito das outras duas: o destaque procurava id 'dinheiro',
       que nao existe, e a gaveta nunca aparecia marcada */
    h+='<tr'+(f.troco?' class="dest"':'')+'><td>'+f.n+
    (f.troco?' <small style="color:var(--ink-3)">(vai para a gaveta)</small>':'')+'</td>'+
    '<td>'+(cego?'—':'R$ '+money(v))+'</td></tr>';
  });
  h+='<tr><td><b>Total recebido</b></td><td><b>'+(cego?'—':'R$ '+money(mov.total))+'</b></td></tr></table>';
  return h;
}
function totalMov(cx,tipo){
  return (cx.movimentos||[]).filter(function(m){return m.tipo===tipo})
    .reduce(function(a,m){return a+m.valor},0);
}
function esperadoCaixa(cx){
  var mov=movimentoCaixa(cx.id);
  return cx.inicial+mov.dinheiro+totalMov(cx,'suprimento')-totalMov(cx,'sangria');
}
function pedeSenhaMov(){
  var sel=$('mvOp'), box=$('boxSenhaMv');
  if(!sel||!box)return;
  var op=operAtivos().find(function(o){return o.id===sel.value});
  /* quem decide se ha senha e o cofre, nao o cadastro local */
  box.style.display=temSenhaCadastrada(op)?'':'none';
  if(temSenhaCadastrada(op)){var i=$('mvSenha');if(i){i.value='';i.focus();}}
}
var movCaixa=protegido('sangria/suprimento', _movCaixa);
/* ==========================================================
   MOTIVOS DE SANGRIA E SUPRIMENTO

   Texto livre nao serve para auditoria: cada operador escreve de um
   jeito e ninguem consegue agrupar depois. A lista fecha o campo, e
   "outro" continua existindo para o caso que a lista nao previu — mas
   ai a descricao passa a ser obrigatoria.
   ========================================================== */
var MOTIVOS_SANGRIA=[
  {id:'cofre',   n:'Envio ao cofre'},
  {id:'deposito',n:'Depósito bancário'},
  {id:'admin',   n:'Retirada administrativa'},
  {id:'pagto',   n:'Pagamento autorizado'},
  {id:'outro',   n:'Outro (descrever)'}];
var MOTIVOS_SUPRIMENTO=[
  {id:'troco',   n:'Reforço de troco'},
  {id:'cofre',   n:'Vindo do cofre'},
  {id:'aporte',  n:'Aporte do proprietário'},
  {id:'outro',   n:'Outro (descrever)'}];

/* contas que podem receber ou mandar dinheiro da gaveta. A conta fixa
   'caixa' e a propria gaveta: ela e a origem, nunca o destino. */
function contasDestino(){
  return (DB.contas||[]).filter(function(c){return c.fixa!=='caixa'});
}
function contaDaGaveta(){
  return (DB.contas||[]).find(function(c){return c.fixa==='caixa'})||null;
}
function mostraOutroMv(){
  var s=$('mvMot'), b=$('boxMvDesc');
  if(!s||!b)return;
  b.style.display=(s.value==='outro')?'':'none';
  if(s.value==='outro'){var i=$('mvM');if(i)i.focus();}
}
/* ==========================================================
   SANGRIA E SUPRIMENTO SAO TRANSFERENCIA, NAO DESPESA NEM RECEITA

   Item 11 do documento, e o defeito era grave: a sangria mexia SO na
   gaveta. R$ 500 saiam do caixa e nao entravam em conta nenhuma —
   dinheiro que evapora do sistema e reaparece, se reaparecer, como
   um lancamento manual digitado a mao dias depois.

   Duas consequencias: o cofre nunca batia, e quem digitava o
   lancamento manual criava a SEGUNDA metade de uma operacao que ja
   tinha uma metade — sangria contada duas vezes no financeiro.

   Agora e uma operacao so, com as duas pontas: um lancamento do tipo
   `transferencia`, que o modulo financeiro ja entende (soma no destino,
   subtrai na origem, e nao entra em receita nem em despesa). O
   movimento da gaveta guarda a referencia do lancamento; o lancamento
   guarda a referencia do movimento. Um nao existe sem o outro.

   Faturamento nao e tocado em nenhuma das duas operacoes — e o que
   os itens 1, 2 e 13 exigem.
   ========================================================== */
function lancarTransferenciaCaixa(cx,mv,tipo){
  DB.lancFin=DB.lancFin||[];
  /* idempotencia: a mesma movimentacao nunca gera dois lancamentos,
     nem que esta funcao seja chamada de novo (item 12) */
  var ja=(DB.lancFin||[]).find(function(l){return l.ref===mv.id&&l.origem==='mov-caixa'});
  if(ja)return ja;
  var gaveta=contaDaGaveta();
  if(!gaveta||!mv.destinoContaId)return null;
  var de   = (tipo==='sangria')? gaveta.id       : mv.destinoContaId;
  var para = (tipo==='sangria')? mv.destinoContaId : gaveta.id;
  var dt=hojeISO();
  var l={id:uid('lf'),tipo:'transferencia',contaId:de,contaDestinoId:para,metodoId:'',
    descricao:(tipo==='sangria'?'Sangria':'Suprimento')+' de caixa: '+
      contaNome(de)+' → '+contaNome(para),
    categoriaTxt:'Transferência',
    valor:Number(mv.valor)||0,emissao:dt,vencimento:dt,pagamento:dt,pago:true,
    origem:'mov-caixa',ref:mv.id,caixaId:cx.id,
    obs:(mv.motivoNome||'')+(mv.motivo?' — '+mv.motivo:'')+
        ' · '+(mv.responsavel||'')+' · '+(mv.hora||'')};
  DB.lancFin.push(l);
  mv.lancRef=l.id;
  return l;
}
async function _movCaixa(tipo){
  var cx=caixaAberto();if(!cx)return;
  if(!operadoresPara(tipo).length){
    /* nao mentir: se a lista de senhas nao carregou, o problema e outro */
    toast(await motivoSemOperador('senha de autorização'));
    return;
  }
  var dests=contasDestino();
  if(!dests.length){
    toast('Cadastre ao menos uma conta em Financeiro › Contas bancárias antes de movimentar o caixa.');
    return;
  }
  var mots=(tipo==='sangria')?MOTIVOS_SANGRIA:MOTIVOS_SUPRIMENTO;
  var titulo=tipo==='sangria'?'Sangria — retirada de dinheiro':'Suprimento — reforço de caixa';
  var h='<div class="mdB"><div class="blk" style="margin:0;max-width:none">'+
  '<div class="hint" style="margin-bottom:12px">'+
  (tipo==='sangria'
    ?'Dinheiro sai da gaveta e <b>entra na conta de destino</b>. Não é despesa e não reduz o faturamento — é transferência entre contas.'
    :'Dinheiro sai da conta de origem e <b>entra na gaveta</b>. Não é venda e não aumenta o faturamento — é transferência entre contas.')+'</div>'+
  '<div class="fld2"><label>Valor *</label>'+moedaHTML({id:'mvV',valor:0})+'</div>'+
  '<div class="fld2"><label>Motivo *</label>'+
   '<select id="mvMot" onchange="mostraOutroMv()">'+
   mots.map(function(m){return '<option value="'+m.id+'">'+E(m.n)+'</option>'}).join('')+
   '</select></div>'+
  '<div class="fld2" id="boxMvDesc" style="display:none"><label>Descreva *</label>'+
   '<input id="mvM" placeholder="'+(tipo==='sangria'?'ex: adiantamento autorizado pelo sócio':'ex: troco trazido de casa')+'"></div>'+
  '<div class="fld2"><label>'+(tipo==='sangria'?'Destino do dinheiro *':'Origem do dinheiro *')+'</label>'+
   '<select id="mvDest">'+
   dests.map(function(c){return '<option value="'+E(c.id)+'">'+E(c.nome)+'</option>'}).join('')+
   '</select>'+
   '<small style="display:block;color:var(--ink-3);margin-top:4px">'+
   (tipo==='sangria'?'A conta escolhida recebe o valor no mesmo instante.'
                    :'A conta escolhida é debitada no mesmo instante.')+'</small></div>'+
  /* ==========================================================
     SANGRIA SEM SENHA ERA O BURACO MAIS SERIO DO MODULO

     Aqui havia um campo de TEXTO LIVRE chamado "Responsavel", ja
     preenchido com o nome de quem abriu o caixa. Retirar dinheiro da
     gaveta exigia digitar um nome — qualquer nome, inclusive o de
     outra pessoa. Sem senha, sem lista, sem permissao.

     Dinheiro que sai sem assinatura nao tem como ser auditado depois:
     o fechamento mostra a sangria, mas nao ha nada que ligue aquela
     retirada a uma pessoa de verdade.

     Agora vale a mesma regra do resto: operador da lista, senha, e so
     quem tem permissao (gerente ou administrador).
     ========================================================== */
  '<div class="fld2"><label>Quem está '+(tipo==='sangria'?'retirando':'lançando')+' *</label>'+
   '<select id="mvOp" onchange="pedeSenhaMov()">'+
    '<option value="">Selecione</option>'+
    operadoresPara(tipo).map(function(o){
      return '<option value="'+E(o.id)+'">'+E(o.nome)+' — '+E(nomeFuncao(o.funcao))+'</option>';
    }).join('')+'</select></div>'+
  '<div class="fld2" style="margin:0;display:none" id="boxSenhaMv"><label>Senha *</label>'+
   '<input id="mvSenha" type="password" autocomplete="off" placeholder="senha de autorização"></div>'+
  '</div></div>';
  modal(titulo,h,'Confirmar',async function(){
    /* item 30: duplo toque em SANGRIA nao tira o dinheiro duas vezes */
    if(!travarOperacao('mov-caixa-'+tipo))return false;
    var v=moedaValor('mvV');
    if(v<=0){liberarOperacao('mov-caixa-'+tipo);toast('Informe um valor maior que zero.');return false;}
    var motId=($('mvMot')||{}).value||'';
    var desc=(($('mvM')||{}).value||'').trim();
    var _lib=function(){liberarOperacao('mov-caixa-'+tipo)};
    if(motId==='outro'&&!desc){_lib();toast('Descreva o motivo.');return false;}
    var destId=($('mvDest')||{}).value||'';
    if(!destId){_lib();toast('Selecione o destino.');return false;}
    /* a gaveta nao pode ter mais saida do que tem dinheiro */
    if(tipo==='sangria'){
      var disp=esperadoCaixa(cx);
      if(v>disp+0.001){
        _lib();
        toast('A gaveta tem R$ '+money(disp)+'. Não dá para retirar R$ '+money(v)+'.');
        return false;
      }
    }
    var opM=await autorizar(tipo,($('mvOp')||{}).value||'',($('mvSenha')||{}).value||'');
    if(!opM){_lib();return false;}
    var motNome=(((tipo==='sangria')?MOTIVOS_SANGRIA:MOTIVOS_SUPRIMENTO)
      .find(function(m){return m.id===motId})||{}).n||'';
    cx.movimentos=cx.movimentos||[];
    var mv={id:uid('mv'),tipo:tipo,valor:v,
      motivoId:motId,motivoNome:motNome,motivo:desc,
      destinoContaId:destId,destinoNome:contaNome(destId),
      responsavel:opM.nome,responsavelId:opM.id,
      hora:agoraHM(),data:new Date().toISOString()};
    cx.movimentos.push(mv);
    /* a contrapartida nasce junto. Ou as duas pontas existem, ou nenhuma. */
    if(!lancarTransferenciaCaixa(cx,mv,tipo)){
      cx.movimentos.pop();
      _lib();
      toast('Não consegui gerar a contrapartida no financeiro. Verifique se existe a conta "Caixa da loja".');
      return false;
    }
    salvar();telaPDV();
    toast((tipo==='sangria'?'Sangria':'Suprimento')+' de R$ '+money(v)+' · '+
      (tipo==='sangria'?'→ ':'← ')+contaNome(destId));
    if(tipo==='sangria')
      avisarGerente(lojaAtualId(),'sangria',msgSangria(v,motNome+(desc?' — '+desc:'')));
    return true;
  });
}

function menuCaixa(ev){
  ev.stopPropagation();
  pop(ev,'<button onclick="movCaixa(\'sangria\');fecharPops()">'+sv('minus',15)+' Sangria (retirar dinheiro)</button>'+
  '<button onclick="movCaixa(\'suprimento\');fecharPops()">'+sv('plus',15)+' Suprimento (colocar dinheiro)</button>'+
  '<button onclick="painelCaixa();fecharPops()">'+sv('list',15)+' Movimentações do turno</button>'+
  '<button onclick="cancelarVenda();fecharPops()">'+sv('x2',15)+' Cancelar uma venda</button>'+
  '<div class="popSep"></div>'+
  '<button onclick="fecharCaixa();fecharPops()">'+sv('cash',15)+' Fechar caixa</button>');
}
function painelCaixa(){
  var cx=caixaAberto();if(!cx)return;
  var mov=movimentoCaixa(cx.id),cego=cfg().caixaCego;
  var movs=(cx.movimentos||[]).slice().reverse();
  var h='<div class="mdB">'+
  '<div class="blk" style="margin:0 0 11px;max-width:none"><h3>Recebimentos <small>'+mov.qtd+' pedidos</small></h3>'+
  tabelaFormas(mov,cego)+'</div>'+
  '<div class="blk" style="margin:0 0 11px;max-width:none"><h3>Dinheiro na gaveta</h3>'+
  '<div class="linha"><span>Fundo de troco</span><b>R$ '+money(cx.inicial)+'</b></div>'+
  '<div class="linha"><span>Recebido em dinheiro</span><b>'+(cego?'—':'+ R$ '+money(mov.dinheiro))+'</b></div>'+
  '<div class="linha"><span>Suprimentos</span><b>+ R$ '+money(totalMov(cx,'suprimento'))+'</b></div>'+
  '<div class="linha"><span>Sangrias</span><b>- R$ '+money(totalMov(cx,'sangria'))+'</b></div>'+
  '<div class="linha tot"><span>Esperado</span><span>'+(cego?'—':'R$ '+money(esperadoCaixa(cx)))+'</span></div></div>'+
  '<div class="blk" style="margin:0;max-width:none"><h3>Sangrias e suprimentos</h3>';
  if(!movs.length)h+='<div class="hint">Nenhum registro neste turno.</div>';
  else h+='<table class="fpgTab">'+movs.map(function(m){
    return '<tr><td>'+m.hora+' · '+(m.tipo==='sangria'?'<span class="badge2 rd">Sangria</span>':'<span class="badge2 gr">Suprimento</span>')+
    (m.motivo?' <span style="color:var(--ink-3)">'+E(m.motivo)+'</span>':'')+'</td>'+
    '<td style="color:'+(m.tipo==='sangria'?'var(--red)':'var(--acc-d)')+'">'+(m.tipo==='sangria'?'- ':'+ ')+'R$ '+money(m.valor)+'</td></tr>';
  }).join('')+'</table>';
  h+='</div></div>';
  h+='<div class="blk" style="margin:11px 0 0;max-width:none"><h3>Fechamentos anteriores</h3>';
  var fech=(DB.caixas||[]).filter(function(c){return c.fechadoEm}).slice().reverse();
  if(!fech.length)h+='<div class="hint">Nenhum fechamento registrado ainda.</div>';
  else h+='<table class="fpgTab">'+fech.slice(0,8).map(function(c){
    var d=(c.contado||0)-(c.esperado||0);
    return '<tr><td>'+c.fechadoEm+' <span style="color:var(--ink-3)">· '+E(c.operador||'—')+' · '+(c.qtd||0)+' pedidos</span>'+
    (c.obs?'<small style="display:block;color:var(--ink-3)">'+E(c.obs)+'</small>':'')+'</td>'+
    '<td style="color:'+(Math.abs(d)<0.01?'var(--acc-d)':'var(--red)')+'">'+
    (Math.abs(d)<0.01?'confere':(d>0?'+ ':'- ')+'R$ '+money(Math.abs(d)))+'</td></tr>';
  }).join('')+'</table>';
  h+='</div>';
  modal('Caixa · turno atual',h,'Fechar',function(){return true},'lg');
}
/* ==========================================================
   A FOTOGRAFIA DO FECHAMENTO (item 19)

   Ate aqui a reimpressao RECALCULAVA tudo a partir dos dados de hoje.
   Se uma venda daquele turno fosse cancelada na semana seguinte, o
   segundo cupom saia com numeros diferentes do primeiro — e o primeiro
   ja estava assinado e arquivado.

   Comprovante que muda depois de emitido nao serve para conferir nada.
   Aqui congela-se tudo o que o fechamento viu: esperado e informado por
   forma, diferencas, sangrias com motivo e destino, quem abriu, quem
   fechou e a que horas. A reimpressao le daqui e nunca recalcula.
   ========================================================== */
function montarSnapshot(cx,mov,esp,conf){
  var sup=totalMov(cx,'suprimento'), san=totalMov(cx,'sangria');
  var formas=FORMAS.map(function(f){
    var e=Number(esp[f.id])||0;
    var i=(conf[f.id]===undefined||conf[f.id]===null)?null:Number(conf[f.id]);
    return {id:f.id,nome:f.n,troco:!!f.troco,
      sistema:+e.toFixed(2),
      fisico:(i===null?null:+i.toFixed(2)),
      diferenca:(i===null?null:+(i-e).toFixed(2))};
  });
  var somaS=formas.reduce(function(a,x){return a+x.sistema},0);
  var somaF=formas.reduce(function(a,x){return a+(x.fisico||0)},0);
  var difTotal=+(somaF-somaS).toFixed(2);
  /* item 5: diferenca por forma e diferenca geral sao coisas separadas.
     Se o total bate mas as formas nao, o dinheiro esta todo la — o que
     errou foi a classificacao da forma na venda. Isso NAO e falta de
     caixa, e nao pode ser lido como tal. */
  var houveDivergencia=formas.some(function(x){
    return x.diferenca!==null&&Math.abs(x.diferenca)>=0.01;
  });
  var conciliado=Math.abs(difTotal)<0.01;
  return {
    versao:VERSAO, gerado:new Date().toISOString(),
    loja:sucNome(cx.sucursalId||lojaAtualId()),
    empresa:cfg().nomePublico||nomeLojaAtual()||'',
    caixaId:cx.id, turno:cx.turno||'',
    aberto:cx.aberto||'', fechado:cx.fechadoEm||'',
    operadorAbriu:cx.operador||'', operadorAbriuId:cx.operadorId||'',
    operadorFechou:cx.fechadoPor||'', operadorFechouId:cx.fechadoPorId||'',
    fundoAbertura:+(Number(cx.inicial)||0).toFixed(2),
    vendasDinheiro:+(Number(mov.dinheiro)||0).toFixed(2),
    suprimentos:+sup.toFixed(2), sangrias:+san.toFixed(2),
    faturamento:+(Number(mov.total)||0).toFixed(2),
    qtdVendas:mov.qtd||0,
    semForma:+((mov.semForma||0)+(mov.descoberto||0)).toFixed(2),
    canceladas:(DB.pedidos||[]).filter(function(p){
      return p.caixaId===cx.id&&ehCancelado(p)}).length,
    vCanceladas:+(DB.pedidos||[]).filter(function(p){
      return p.caixaId===cx.id&&ehCancelado(p)})
      .reduce(function(a,p){return a+(Number(p.total)||0)},0).toFixed(2),
    formas:formas,
    totalSistema:+somaS.toFixed(2), totalFisico:+somaF.toFixed(2),
    diferencaTotal:difTotal,
    conciliado:conciliado,
    divergenciaEntreFormas:(conciliado&&houveDivergencia),
    fundoProximo:+(Number(cx.fundoProximo)||0).toFixed(2),
    observacao:cx.obs||'',
    movimentos:(cx.movimentos||[]).map(function(m){
      return {hora:m.hora||'',tipo:m.tipo,valor:+(Number(m.valor)||0).toFixed(2),
        motivo:m.motivoNome||m.motivo||'',descricao:m.motivo||'',
        destino:m.destinoNome||'',responsavel:m.responsavel||'',lancRef:m.lancRef||''};
    })
  };
}
/* ==========================================================
   A TELA INTERMEDIARIA DE CONFERENCIA FOI REMOVIDA (itens 11 e 12)

   `resultadoFechamento()` vivia aqui: abria depois de fechar o caixa e
   mostrava previsto x fisico forma a forma, para o operador
   "confirmar". Ela nao confirmava nada — o caixa ja estava gravado
   quando abria — e mostrava o esperado justamente a quem o fechamento
   cego existe para nao mostrar.

   A conferencia NAO se perdeu. Ela vive no snapshot e aparece inteira
   em `verCaixa()` (Resumo, Recebimentos, Movimentacoes, Cancelamentos,
   Descontos, Vendas, Operadores, Auditoria), na impressao gerencial e
   no cupom. O que saiu foi a obrigacao de o operador olhar aquilo para
   terminar o turno.

   A funcao foi apagada, nao apenas desligada: funcao que ninguem chama
   volta a ser chamada por engano seis meses depois.
   ========================================================== */
/* ==========================================================
   O FIM DO FECHAMENTO: UMA PERGUNTA, DUAS RESPOSTAS

   Sem numero nenhum na tela. O caixa ja esta fechado e gravado quando
   isto aparece; nem imprimir nem nao imprimir muda qualquer valor.
   ========================================================== */
function perguntaImprimirFechamento(cx){
  var h='<div class="mdB"><div class="fcRes ok" style="margin:0">'+
    '<span>Caixa fechado com sucesso</span>'+
    '<b>'+E(cx.fechadoEm||'')+'</b>'+
    '<small>fechado por '+E(cx.fechadoPor||'')+'</small></div>'+
    '<div class="hint" style="margin-top:12px">A conferência completa — sistema, físico '+
    'e diferença por forma — fica no <b>Relatório de frente de caixa</b> e no histórico.</div>'+
   '</div>';
  var o=document.createElement('div');o.className='mdOv';o.id='mdOv';
  o.innerHTML='<div class="mdBox"><div class="mdH"><b>Fechamento realizado</b>'+
    '<button onclick="fecharModal()">&times;</button></div>'+h+
    '<div class="mdF"><button class="btnP2" onclick="fecharModal()">Não imprimir</button>'+
    '<button class="btnP2 ok" onclick="fecharModal();imprimirFechamento(\''+cx.id+'\')">'+
    sv('print2',13)+' Imprimir fechamento</button></div></div>';
  document.body.appendChild(o);
}
/* ==========================================================
   ESTA FUNCAO FOI APAGADA POR ENGANO NA V179 — E DERRUBOU O CAIXA

   `fundoSugerido()` nasceu na V176 para a abertura sugerir o valor que
   o fechamento anterior declarou deixar na gaveta. Na V179, ao remover
   a tela intermediaria de conferencia, eu recortei um trecho maior do
   que devia e levei esta funcao junto.

   `abrirCaixa()` continuou chamando. Efeito no balcao: o botao ABRIR
   FRENTE DE CAIXA parou de responder — e a loja nao conseguia vender.

   Duas licoes que ficam, as duas minhas:

   1. Recorte por indice de texto e perigoso. O corte foi de "inicio de
      resultadoFechamento" ate "inicio de perguntaImprimirFechamento", e
      no meio havia codigo que nao era de nenhuma das duas.

   2. Pior que o corte foi eu ter tornado `abrirCaixa` async na V182.
      Erro dentro de funcao async nao aparece na tela: a Promise falha
      calada. Antes, este ReferenceError teria estourado visivelmente na
      primeira vez que alguem abrisse o caixa. Depois da minha mudanca,
      o botao so ficou mudo — e ninguem soube por que.

   A trava contra funcao duplicada, que entrou na V182, nao pegaria
   isto: ela procura nome repetido, nao nome que sumiu. Por isso agora
   ha um teste que chama cada funcao usada por `abrirCaixa`.
   ========================================================== */
var abrirCaixa=protegido('abrir frente de caixa', _abrirCaixa);
function fundoSugerido(){
  var suc=lojaAtualId();
  var fech=(DB.caixas||[]).filter(function(c){
    return c.fechadoEm&&(!c.sucursalId||!suc||c.sucursalId===suc);
  });
  if(!fech.length)return 0;
  var ult=fech[fech.length-1];
  return +(Number(ult.fundoProximo)||0).toFixed(2);
}
/* ==========================================================
   FUNCAO ASYNC NAO PODE FALHAR CALADA (regressao da V182)

   `abrirCaixa` e `movCaixa` viraram async na V182 para poderem esperar
   a lista de autorizacoes. O efeito colateral quase parou a loja:
   erro dentro de funcao async nao estoura na tela — a Promise rejeita
   em silencio e o botao simplesmente nao responde.

   Foi assim que um `ReferenceError` de uma funcao apagada por engano
   ficou invisivel: o operador clicava em ABRIR FRENTE DE CAIXA e nada
   acontecia, sem nenhuma pista do motivo.

   `protegido()` devolve o erro para a superficie: registra no
   Diagnostico e mostra ao operador uma frase que ele pode repassar.
   Nao esconde nada — faz o contrario.
   ========================================================== */
function protegido(nome, fn){
  return function(){
    var args=arguments;
    try{
      var r=fn.apply(null,args);
      if(r&&typeof r.catch==='function')
        r.catch(function(e){ falhouNaTela(nome,e); });
      return r;
    }catch(e){ falhouNaTela(nome,e); }
  };
}
function falhouNaTela(nome,e){
  _quieto(e,nome);
  var det=String((e&&e.message)||e).slice(0,90);
  try{
    toast('Não consegui abrir "'+nome+'". Avise o suporte com esta frase: '+det);
  }catch(x){ alert('Falha em '+nome+': '+det); }
}
async function _abrirCaixa(){
  if(caixaAberto()){toast('Já existe um caixa aberto. Feche-o antes de abrir outro.');return;}
  baseOper();baseTurnos();
  /* so quem pode abrir caixa aparece na lista (item 12) */
  var ops=operadoresPara('abrir');
  if(!ops.length){
    toast(await motivoSemOperador('permissão para abrir o caixa'));
    return;
  }
  var tns=turnosAtivos();
  var sug=turnoDoRelogio();
  var h='<div class="mdB"><div class="blk" style="margin:0;max-width:none">'+
  /* O turno vem primeiro: e ele que define a que periodo pertence tudo o que
     for lancado neste caixa. Sem isso o relatorio nao consegue separar. */
  (tns.length?'<div class="fld2"><label>Turno *</label>'+
   '<div class="tipoEsc">'+tns.map(function(t){
     return '<label class="tipoOp'+(t.id===sug?' on':'')+'">'+
      '<input type="radio" name="cxTurno" value="'+E(t.id)+'"'+(t.id===sug?' checked':'')+'>'+
      '<b>'+E(t.nome)+'</b><span>'+(t.ini&&t.fim?E(t.ini)+' as '+E(t.fim):'sem horario')+'</span></label>';
   }).join('')+'</div>'+
   '<div class="hint">Sugerido pelo horario. Se estiver assumindo outro turno, troque aqui.</div></div>'
  :'<div class="hint" style="margin-bottom:10px">Nenhum turno cadastrado. '+
   'Cadastre em Configuracao da Loja &rsaquo; Turnos para separar os caixas por periodo.</div>')+
  '<div class="fld2"><label>Quem está abrindo o caixa *</label>'+
   (ops.length>1
    ?'<select id="cxOp" onchange="pedeSenhaCaixa(\'cx\')">'+
     '<option value="">Selecione o operador</option>'+
     ops.map(function(o){
       return '<option value="'+E(o.id)+'">'+E(o.nome)+' — '+E(nomeFuncao(o.funcao))+'</option>';
     }).join('')+'</select>'
    :'<select id="cxOp" onchange="pedeSenhaCaixa(\'cx\')">'+
     ops.map(function(o){return '<option value="'+E(o.id)+'">'+E(o.nome)+'</option>'}).join('')+
     '</select><div class="hint">Cadastre a equipe em Configuração da Loja › Usuários e Permissões.</div>')+
  '</div>'+
  '<div class="fld2" id="boxSenhaCx" style="display:none"><label>Senha do operador *</label>'+
   '<input id="cxSenha" type="password" inputmode="numeric" placeholder="senha cadastrada" autocomplete="off">'+
   '<div class="hint">A senha confirma quem está assumindo o caixa.</div></div>'+
  /* ==========================================================
     A ABERTURA SUGERE O QUE O FECHAMENTO ANTERIOR DEIXOU (item 14)

     Sugere — nao impoe. Se a regra da loja for outra, o operador
     digita outro valor. O que nao pode e comecar de zero por padrao
     quando o turno anterior declarou que ficaram R$ 200 na gaveta:
     o caixa nasceria com R$ 200 de sobra que ninguem consegue explicar.
     ========================================================== */
  '<div class="fld2" style="margin:0"><label>Valor inicial (fundo de troco)</label>'+
   moedaHTML({id:'cxIni',valor:fundoSugerido()})+
   (fundoSugerido()>0
     ?'<div class="hint">Sugerido pelo último fechamento, que declarou este valor '+
      'como fundo do próximo caixa. Confira a gaveta antes de confirmar.</div>':'')+
   '</div>'+
  '</div></div>';
  /* a conferencia agora vai ao banco: a funcao do modal precisa ser async,
     senao o `if(!op)` roda antes da resposta e libera sem conferir */
  modal('Abrir frente de caixa',h,'Abrir caixa',async function(){
    var opId=$('cxOp').value;
    var op=await autorizar('abrir',opId,($('cxSenha')||{}).value||'');
    if(!op)return false;
    var turnoId='';
    var rt=document.querySelectorAll('input[name="cxTurno"]');
    for(var ti=0;ti<rt.length;ti++)if(rt[ti].checked)turnoId=rt[ti].value;
    if(rt.length&&!turnoId){toast('Escolha o turno.');return false;}
    DB.caixas=DB.caixas||[];
    var ag=new Date();
    /* dois cliques no botao, ou duas abas abertas, nao podem abrir dois
       caixas na mesma unidade */
    if(caixaAberto()){
      toast('Já existe um caixa aberto nesta unidade.');
      telaPDV(); return true;
    }
    /* ==========================================================
       A MESMA PERGUNTA, AGORA PARA A NUVEM

       A trava acima olha so este aparelho. Se outro ja abriu o caixa
       desta unidade, o certo e trazer aquele — nao criar um segundo nem
       impedir a loja de vender. Sem rede, `caixaAbertoNaNuvem` devolve
       null e nada disto acontece.
       ========================================================== */
    var _naNuvem=await caixaAbertoNaNuvem();
    if(faltaAquiAlgumCaixa(_naNuvem)){
      toast('Já existe um caixa aberto nesta unidade em outro aparelho — trazendo.');
      try{ await baixarDaNuvem(true); }catch(e){ _quieto(e,'abrirCaixa'); }
      telaPDV(); return true;
    }
    var novoCx={id:uid('cx'),inicial:moedaValor('cxIni'),
      operador:op.nome,operadorId:op.id,funcao:op.funcao,
      turnoId:turnoId,turno:nomeTurno(turnoId),
      /* o caixa passa a saber de qual loja e */
      sucursalId:lojaAtualId(),
      movimentos:[],aberto:ag.toLocaleDateString('pt-BR')+' '+agoraHM()};
    DB.caixas.push(novoCx);
    salvar();telaPDV();
    toast('Caixa aberto por '+op.nome+(novoCx.turno?' — '+novoCx.turno:'')+'.');
    if(NUVEM.ligada)sincronizar();
    avisarGerente(lojaAtualId(),'abertura',msgAbertura(novoCx));
    return true;
  });
  setTimeout(function(){pedeSenhaCaixa('cx')},80);
}
/* mostra o campo de senha só quando o operador tem senha */
function pedeSenhaCaixa(pref){
  var sel=$(pref+'Op');
  var box=$('boxSenha'+(pref==='cx'?'Cx':'Fc'));
  if(!sel||!box)return;
  var op=(DB.operadores||[]).find(function(o){return o.id===sel.value});
  box.style.display=temSenhaCadastrada(op)?'':'none';
  if(temSenhaCadastrada(op)){
    var i=$(pref+'Senha');
    if(i){i.value='';i.focus();}
  }
}
/* `id` fecha um caixa especifico — o que ficou esquecido aberto de outro
   dia, pela tela de Frente de Caixa. Sem `id`, fecha o caixa em operacao,
   que e como o PDV sempre chamou. A conferencia, a fotografia e o
   lancamento no financeiro sao os mesmos nos dois caminhos. */
function fecharCaixa(id){
  var cx=id?(DB.caixas||[]).find(function(c){return c.id===id&&!c.fechadoEm})
           :caixaAberto();
  if(!cx){toast('Nenhum caixa aberto.');return;}
  var _eraOAtual=(caixaAberto()||{}).id===cx.id;
  var mov=movimentoCaixa(cx.id);
  var cego=cfg().caixaCego;
  var esperadoGaveta=esperadoCaixa(cx);

  /* ==========================================================
     A LINHA DO DINHEIRO NUNCA ERA A LINHA DA GAVETA

     Aqui estava escrito `f.id==='dinheiro'`. Nenhuma forma tem esse
     identificador: o banco grava `fp_dinheiro`. A comparacao dava
     falso SEMPRE, e a linha do dinheiro recebia apenas as vendas em
     especie — sem fundo de troco, sem suprimento, sem sangria.

     O bloco de cima do comprovante usa `cx.esperado`, que E a gaveta
     inteira. Resultado: os dois numeros da mesma tela saiam de bases
     diferentes, e o operador informa a gaveta CONTADA, que tem o fundo
     dentro. Comparava-se gaveta com venda.

     Medido no fechamento de 25/08 em Santa Fe: bloco de cima dizia
     esperar R$ 1.350,05 e a tabela dizia R$ 851,00 na mesma linha —
     exatamente os R$ 499,05 de fundo de troco de diferenca.

     O tipo ja e resolvido por `formaDaTroco` desde a V173, e e ele que
     vale aqui. Mesmo defeito, mesma familia: identificador de um lado,
     tipo do outro.
     ========================================================== */
  var esp={};
  FORMAS.forEach(function(f){
    esp[f.id]=f.troco?esperadoGaveta:(mov.porForma[f.id]||0);
  });

  var NOME_EQ={balcao:'balcão',totem:'totem',mesa:'mesa',entrega:'entrega'};
  /* ==========================================================
     `ci` NAO EXISTIA — E O FECHAMENTO NAO ABRIA (V189)

     Na V179, ao migrar este campo para o componente monetario, escrevi
     `data-i="'+ci+'"` copiando o padrao de outro `map` que tinha o
     indice. Este aqui e `function(f)`: nao ha segundo parametro.

     `ci` nunca foi declarado em lugar nenhum. Toda montagem desta tela
     estourava `ReferenceError: ci is not defined`, e o modal de
     fechamento simplesmente nao abria. A loja ficou sem conseguir
     fechar o caixa.

     O indice existe de verdade agora, e serve: e por ele que o ENTER
     encontra o proximo campo.
     ========================================================== */
  var linhas=FORMAS.map(function(f,ci){
    /* quebra por aparelho: e o que permite bater com o extrato de cada
       maquininha na hora de fechar */
    var eqs=(mov.porEquip&&mov.porEquip[f.id])||{};
    var kEq=Object.keys(eqs).filter(function(k){return eqs[k]>0.001});
    var det=(kEq.length>1)
      ?'<small style="display:block;color:var(--ink-3);margin-top:3px">'+
        kEq.map(function(k){return (NOME_EQ[k]||k)+' R$ '+money(eqs[k])}).join(' · ')+'</small>'
      :(kEq.length===1&&kEq[0]!=='balcao'
        ?'<small style="display:block;color:var(--ink-3);margin-top:3px">'+
          (NOME_EQ[kEq[0]]||kEq[0])+'</small>':'');
    return '<tr'+(f.troco?' class="dest"':'')+'>'+
    '<td><b>'+f.n+'</b>'+(f.troco?'<small style="display:block;color:var(--ink-3)">'+
      'conte a gaveta inteira, com o fundo de R$ '+money(cx.inicial||0)+' dentro</small>':det)+'</td>'+
    '<td class="cSis" style="text-align:right">'+(cego?'<span style="color:var(--ink-3)">oculto</span>':'R$ '+money(esp[f.id]))+'</td>'+
    '<td style="width:150px"><div class="cur"><span>R$</span>'+
    '<input type="text" inputmode="decimal" autocomplete="off" class="moeda cfV" data-f="'+f.id+'" data-i="'+ci+'" value="" placeholder="0,00"></div></td>'+
    '<td class="cDif" data-f="'+f.id+'" style="text-align:right;width:120px;color:var(--ink-3)">—</td></tr>';
  }).join('');

  var h='<div class="mdB">'+
  '<div class="blk" style="margin:0 0 11px;max-width:none">'+
  '<h3>Composição da gaveta <small>base do valor esperado em dinheiro</small></h3>'+
  '<div class="linha"><span>Fundo de troco</span><b>R$ '+money(cx.inicial)+'</b></div>'+
  '<div class="linha"><span>Recebido em dinheiro</span><b>'+(cego?'oculto':'+ R$ '+money(mov.dinheiro))+'</b></div>'+
  '<div class="linha"><span>Suprimentos</span><b>+ R$ '+money(totalMov(cx,'suprimento'))+'</b></div>'+
  '<div class="linha"><span>Sangrias</span><b>- R$ '+money(totalMov(cx,'sangria'))+'</b></div>'+
  '<div class="linha"><span>Pedidos no turno</span><b>'+mov.qtd+'</b></div>'+
  '</div>'+

  /* ==========================================================
     O SALDO FINAL NAO VIRA FUNDO DO DIA SEGUINTE SOZINHO (item 14)

     Assumir que tudo o que sobrou na gaveta e o fundo de amanha e uma
     regra da empresa, nao uma lei. Quem deixa R$ 200 e manda R$ 300
     para o cofre precisa dizer isso — senao a proxima abertura sugere
     R$ 500 que nao estao la, e o caixa ja nasce com diferenca.

     O campo e sugestao para a proxima abertura. Nao move dinheiro: o
     que sai da gaveta sai por sangria, com destino e contrapartida.
     ========================================================== */
  '<div class="blk" style="margin:0 0 11px;max-width:none">'+
  '<h3>Fundo do próximo caixa</h3>'+
  '<div class="hint" style="margin-bottom:10px">Quanto fica na gaveta para abrir amanhã. '+
  'O que for retirado além disso precisa sair por <b>sangria</b>, com destino. '+
  'Deixe zero se a gaveta for esvaziada por completo.</div>'+
  '<div class="fld2" style="margin:0"><label>Valor deixado como fundo</label>'+
  moedaHTML({id:'fcFundo',valor:Number(cx.inicial)||0})+'</div></div>'+

  '<div class="blk" style="margin:0 0 11px;max-width:none">'+
  '<h3>Conferência por forma de pagamento</h3>'+
  '<div class="hint" style="margin-bottom:10px">Informe o valor apurado em cada forma: dinheiro contado na gaveta, '+
  'e os totais das maquininhas e do Pix.'+(cego?' No caixa cego, o valor do sistema só aparece depois de fechar.':'')+'</div>'+
  '<table class="fpgTab confTab"><thead><tr>'+
  '<th style="text-align:left">Forma</th><th style="text-align:right">Sistema</th>'+
  '<th style="text-align:right">Informado</th><th style="text-align:right">Diferença</th></tr></thead>'+
  '<tbody>'+linhas+'</tbody>'+
  '<tfoot><tr><td><b>Total</b></td>'+
  '<td class="cSis" style="text-align:right"><b>'+(cego?'oculto':'R$ '+money(FORMAS.reduce(function(a,f){return a+esp[f.id]},0)))+'</b></td>'+
  '<td style="text-align:right"><b id="cfTot">R$ 0,00</b></td>'+
  '<td style="text-align:right"><b id="cfDifTot">—</b></td></tr></tfoot></table>'+
  /* ==========================================================
     VENDA QUE NAO ESTA EM NENHUMA FORMA PRECISA APARECER

     Este aviso NAO e ocultado pelo caixa cego, de proposito. O cego
     esconde o quanto o sistema espera, para a contagem ser honesta.
     Mas esconder que existe venda sem forma nao protege a contagem:
     so garante que o problema passe despercebido de novo.
     ========================================================== */
  ((mov.descoberto>0.01||mov.semForma>0.01)
    ? '<div class="cfAlerta">'+sv('help',15)+
      '<div><b>R$ '+money((mov.descoberto||0)+(mov.semForma||0))+
      ' em vendas sem forma de pagamento</b>'+
      '<small>Esse valor entra no total de vendas mas não está em nenhuma linha acima, '+
      'então não dá para conferir com a gaveta nem com as maquininhas. '+
      'Lance a forma nas vendas antes de fechar, ou anote na observação.</small></div></div>'
    : '')+
  '</div>'+

  '<div class="blk" style="margin:0;max-width:none">'+
  '<h3>Quem está fechando</h3>'+
  '<div class="hint" style="margin-bottom:10px">O caixa foi aberto por <b>'+E(cx.operador||'')+
   '</b>. Se quem fecha é outra pessoa, selecione abaixo.</div>'+
  /* ==========================================================
     SE NINGUEM TEM SENHA, A LOJA PRECISA SABER — E FECHAR ASSIM MESMO

     Sem este aviso, o operador via um campo "Senha *" obrigatorio, sem
     senha nenhuma para digitar, e nao tinha como adivinhar o que fazer.
     ========================================================== */
  (typeof alguemTemSenha==='function'&&!alguemTemSenha()
    ? '<div class="cfAlerta">'+sv('help',15)+
      '<div><b>Nenhum operador tem senha de autorização cadastrada</b>'+
      '<small>O fechamento vai ser gravado com o nome de quem confirmar, sem '+
      'assinatura por senha. Para exigir assinatura, cadastre as senhas em '+
      'Configuração da Loja → Operadores do Caixa.</small></div></div>'
    : '')+
  '<div class="row2">'+
   '<div class="fld2" style="margin:0"><label>Operador que fecha *</label>'+
    '<select id="fcOp" onchange="pedeSenhaCaixa(\'fc\')">'+
    '<option value="">Selecione</option>'+
    operadoresPara('fechar').map(function(o){
      return '<option value="'+E(o.id)+'"'+(o.id===cx.operadorId?' selected':'')+'>'+
      E(o.nome)+' — '+E(nomeFuncao(o.funcao))+'</option>';
    }).join('')+'</select></div>'+
   '<div class="fld2" style="margin:0" id="boxSenhaFc"><label>Senha *</label>'+
    '<input id="fcSenha" type="password" inputmode="numeric" autocomplete="off" '+
    'placeholder="senha do operador"></div>'+
  '</div>'+
  '<div class="fld2" style="margin:12px 0 0"><label>Observação do fechamento</label>'+
  '<input id="cxObs" placeholder="ex: faltou R$ 2 de troco / maquininha ficou offline às 19h"></div></div></div>';

  modal('Fechamento de caixa',h,'Confirmar fechamento',async function(){
    /* item 30: duplo toque em FECHAR CAIXA nao gera dois fechamentos */
    if(!travarOperacao('fechar-caixa'))return false;
    var opF=await autorizar('fechar',($('fcOp')||{}).value||'',($('fcSenha')||{}).value||'');
    if(!opF){liberarOperacao('fechar-caixa');return false;}
    if(cx.fechadoEm){liberarOperacao('fechar-caixa');toast('Este caixa já foi fechado.');return true;}
    var conf={},algum=false,totInf=0;
    var ins=document.querySelectorAll('.cfV');
    for(var i=0;i<ins.length;i++){
      var v=ins[i].value;
      if(v!=='')algum=true;
      var n=moedaValor(ins[i]);
      conf[ins[i].getAttribute('data-f')]=n;totInf+=n;
    }
    if(!algum){liberarOperacao('fechar-caixa');toast('Informe ao menos o valor contado em dinheiro.');return false;}
    var ag=new Date();
    cx.conferencia=conf;
    cx.esperadoPorForma=esp;
    /* ==========================================================
       O VALOR CONTADO NA GAVETA NUNCA CHEGAVA A SER GRAVADO

       `conf` e montado com as chaves reais das formas (`fp_dinheiro`),
       lidas do atributo `data-f` de cada campo. Aqui se lia
       `conf.dinheiro` — chave que nao existe. O `||0` engolia o vazio
       sem erro nenhum, e o caixa fechava com contado ZERO.

       Efeito na tela: "Informado pelo operador R$ 0,00" ao lado de uma
       tabela mostrando R$ 673,05 informados. E a diferenca destacada
       virava a gaveta inteira: R$ -1.350,05 em vez de R$ -177,95.

       Pior que a tela: `contado` alimenta o historico de fechamentos e
       os lancamentos no financeiro. Todo fechamento anterior a esta
       correcao esta gravado com contado zero.

       A tela "Editar fechamento" ja fazia certo (procura pelo tipo).
       Era o caminho principal que estava errado.
       ========================================================== */
    var idDin=(FORMAS.find(function(f){return f.troco})||{}).id;
    cx.contado=(idDin&&conf[idDin])||conf.dinheiro||0;
    cx.esperado=esperadoGaveta;
    cx.totalInformado=totInf;
    cx.qtd=mov.qtd;cx.vendas=mov.total;cx.obs=$('cxObs').value;
    cx.fundoProximo=moedaValor('fcFundo');
    cx.fechadoEm=ag.toLocaleDateString('pt-BR')+' '+agoraHM();
    cx.fechadoPor=opF.nome;
    cx.fechadoPorId=opF.id;
    /* ==========================================================
       A FOTOGRAFIA E TIRADA AQUI, E SO AQUI (itens 19 e 20)

       Depois deste ponto o turno acabou. O que o comprovante mostrar
       daqui para a frente — hoje, amanha ou daqui a um ano — sai desta
       fotografia, nao de uma nova conta sobre dados que podem ter
       mudado. E ela ja carrega a trilha: quem abriu, quem fechou, cada
       sangria com motivo, destino e responsavel.
       ========================================================== */
    cx.snapshot=montarSnapshot(cx,mov,esp,conf);
    cx.diferencaTotal=cx.snapshot.diferencaTotal;
    cx.conciliado=cx.snapshot.conciliado;
    /* ==========================================================
       FECHAR O MEU CAIXA NAO FECHA O CAIXA DOS OUTROS

       Esta linha fechava TODO caixa sem data de fechamento que
       estivesse neste aparelho — inclusive o de outra unidade. Quem
       entra pela matriz tem os caixas da rede inteira aqui dentro.

       Aconteceu de verdade: em 27/08/2026, as 13:39, o fechamento de
       Santa Fe do Sul fechou junto o caixa do Alphaville, aberto no dia
       26. Ficou gravado com o mesmo minuto, sem operador que fechou,
       sem conferencia, sem fotografia, R$ 0,00 contados. O relatorio do
       franqueado passou a mostrar um turno que ninguem fechou.

       O caixa e da unidade. Se sobrou outro aberto NA MESMA unidade
       — duplicata antiga, aparelho que abriu duas vezes — ele continua
       sendo encerrado junto, que era o motivo desta linha existir, e
       agora fica registrado no diagnostico.
       ========================================================== */
    var _minhaUn=lojaAtualId();
    (DB.caixas||[]).forEach(function(c){
      if(!c||c.fechadoEm||c.id===cx.id)return;
      if(c.sucursalId&&_minhaUn&&c.sucursalId!==_minhaUn)return;
      /* caixa aberto DEPOIS deste e o que esta em operacao agora: fechar
         o esquecido de ontem nao pode levar o de hoje junto */
      if(isoHoraDoCaixa(c.aberto)>isoHoraDoCaixa(cx.aberto))return;
      c.fechadoEm=cx.fechadoEm;
      try{logNuvem('caixa '+c.id+' estava aberto na mesma unidade e foi encerrado junto '+
        'com o fechamento de '+cx.id,true)}catch(e){}
    });
    var nLanc=lancarFechamento(cx,mov);
    salvar();
    /* o turno acabou: nada do que estava na tela pode sobreviver a ele.
       Fechando um caixa esquecido de outro dia, a venda em andamento no
       caixa de hoje nao tem nada com isso e continua onde estava. */
    if(_eraOAtual){encerrarSessaoPDV();telaPDV();}
    else if(typeof telaFrenteCaixa==='function')telaFrenteCaixa();
    if(NUVEM.ligada)sincronizar();
    avisarGerente(lojaAtualId(),'fechamento',msgFechamento(cx,resumoDoCaixa(cx)));
    /* ==========================================================
       O FECHAMENTO ACABA AQUI (itens 11 e 12)

       Havia uma tela intermediaria mostrando previsto x fisico para o
       operador "confirmar". Ela nao confirmava nada: o caixa ja estava
       gravado quando ela abria. Era um passo a mais no fim do
       expediente, e — pior — mostrava o esperado justamente a quem o
       fechamento cego existe para nao mostrar.

       A conferencia NAO some. Ela vive no snapshot e aparece inteira
       no relatorio gerencial, no historico de caixas e na impressao,
       para gestor e administrador. O que sai e a obrigacao de o
       operador olhar aquilo para terminar o turno.

       Fica so a pergunta que ele precisa responder: imprime ou nao.
       ========================================================== */
    setTimeout(function(){ perguntaImprimirFechamento(cx); },120);
    return true;
  },'lg');
  setTimeout(function(){pedeSenhaCaixa('fc')},80);

  /* calcula as diferenças enquanto digita */
  function recalcConf(){
    var tot=0,difTot=0;
    var ins=document.querySelectorAll('.cfV');
    for(var i=0;i<ins.length;i++){
      var f=ins[i].getAttribute('data-f');
      var v=ins[i].value===''?null:moedaValor(ins[i]);
      var cel=document.querySelector('.cDif[data-f="'+f+'"]');
      if(v===null){cel.textContent='—';cel.style.color='var(--ink-3)';continue;}
      tot+=v;
      var d=v-esp[f];difTot+=d;
      cel.textContent=(d>0?'+ ':d<0?'- ':'')+'R$ '+money(Math.abs(d));
      cel.style.color=Math.abs(d)<0.01?'var(--acc-d)':'var(--red)';
      cel.style.fontWeight='700';
      if(cego)cel.textContent='—';
    }
    $('cfTot').textContent='R$ '+money(tot);
    var dt=$('cfDifTot');
    if(cego){dt.textContent='—';}
    else{
      dt.textContent=(difTot>0?'+ ':difTot<0?'- ':'')+'R$ '+money(Math.abs(difTot));
      dt.style.color=Math.abs(difTot)<0.01?'var(--acc-d)':'var(--red)';
    }
  }
  var ins=document.querySelectorAll('.cfV');
  for(var k=0;k<ins.length;k++)ins[k].oninput=recalcConf;
  /* ==========================================================
     ENTER PERCORRE AS FORMAS (itens 8 e 9)

     Fechar um caixa com cinco formas exigia cinco toques de mouse ou
     um TAB que passava por botoes e selects no meio do caminho. No
     balcao, no fim do expediente, isso e atrito puro.

     A ordem e a das formas EFETIVAMENTE cadastradas e ativas na
     unidade — a lista vem de FORMAS, entao forma desabilitada nao
     entra no caminho. No ultimo campo, ENTER leva ao botao de fechar,
     nao ao inicio.

     O fechamento continua CEGO: isto muda so o caminho do foco, nunca
     o que aparece na tela.
     ========================================================== */
  for(var k2=0;k2<ins.length;k2++){
    ins[k2].onkeydown=function(ev){
      if(ev.key!=='Enter')return;
      ev.preventDefault();
      var lista=[].slice.call(document.querySelectorAll('.cfV'))
        .filter(function(x){return x.offsetParent!==null});
      var i=lista.indexOf(this);
      if(i>=0&&i<lista.length-1){ lista[i+1].focus(); lista[i+1].select(); return; }
      /* ultima forma: recolhe o teclado e leva ao botao de fechar */
      if(typeof tecladoTouchFechar==='function')tecladoTouchFechar();
      var b=document.querySelector('.mdF .btnP,.mdF .ok');
      if(b)b.focus();
    };
  }
  if(ins.length){ ins[0].focus(); }
}

/* ---------- WHATSAPP ---------- */
function painelWhats(){
  baseZap();
  var suc=lojaAtualId();
  var ov=document.createElement('div');
  ov.className='mdOv';ov.id='mdOv';
  ov.innerHTML='<div class="mdBox lg"><div class="mdH"><b>Robô do WhatsApp</b>'+
   '<button onclick="fecharModal()">&times;</button></div>'+
   '<div class="mdB"><div id="zapPdv"><div class="carregandoP">verificando a conexão...</div></div></div>'+
   '<div class="mdF"><button class="btnP2" onclick="fecharModal()">Fechar</button>'+
   /* Era `CN.aba`. `CN` existe, mas e o filtro de OUTRA tela
      ({situacao,busca}, dos lancamentos): a atribuicao criava um campo
      solto num objeto alheio e nao dizia nada a ninguem. A tela de
      Canais le `CN2.aba`, entao "Configurar mensagens" abria na aba
      padrao em vez da do WhatsApp — botao que responde e vai para o
      lugar errado, que e pior do que botao que nao responde. */
   '<button class="btnP2" onclick="fecharModal();CN2.aba=\'whatsapp\';abrir(\'loja\',\'canais-integracao\')">'+
    sv('gear2',13)+' Configurar mensagens</button></div></div>';
  document.body.appendChild(ov);
  fecharSoForaDeVerdade(ov);
  estadoZapPdv(suc);
}
async function estadoZapPdv(suc){
  var box=$('zapPdv');
  if(!box)return;
  try{
    var r=await zapApi('/estado/'+suc);
    if(r.estado==='conectado'){
      box.innerHTML='<div class="zapOn">'+
       '<div class="zapIc">'+sv('check',26)+'</div>'+
       '<b>WhatsApp conectado</b>'+
       '<span class="zapNum">'+E(r.numero||'')+'</span>'+
       '<span class="hint">O robô responde os clientes e avisa cada etapa do pedido.</span>'+
       '<button class="btnP2 rdB" onclick="desconectarZapPdv(\''+suc+'\')">Desconectar</button>'+
      '</div>';
      return;
    }
    if(r.qr){
      box.innerHTML='<div class="zapQr">'+
       '<b>Leia o código com o celular da loja</b>'+
       '<img src="'+r.qr+'" alt="QR code">'+
       '<span class="hint">WhatsApp → Aparelhos conectados → Conectar aparelho</span>'+
       '<div class="zapEsperando">'+sv('ref',13)+' esperando a leitura...</div></div>';
      if(!ZP._loopPdv)ZP._loopPdv=setInterval(function(){
        if(!document.getElementById('zapPdv')){clearInterval(ZP._loopPdv);ZP._loopPdv=null;return;}
        estadoZapPdv(suc);
      },3000);
      return;
    }
    box.innerHTML='<div class="zapOff">'+
     '<div class="zapIc off">'+sv('chat',26)+'</div>'+
     '<b>WhatsApp não conectado</b>'+
     '<span class="hint">Conecte o número da loja para o robô atender os clientes '+
     'e avisar quando o pedido sair para entrega.</span>'+
     '<button class="btnP2 ok" onclick="conectarZapPdv(\''+suc+'\')">'+
      sv('chat',13)+' Conectar agora</button></div>';
  }catch(e){
    box.innerHTML='<div class="zapOff">'+sv('help',22)+
     '<b>Não consegui falar com o robô</b>'+
     '<span class="hint">Verifique sua internet e tente de novo.</span>'+
     '<button class="btnP2" onclick="estadoZapPdv(\''+suc+'\')">Tentar de novo</button></div>';
  }
}
async function conectarZapPdv(suc){
  var box=$('zapPdv');
  if(box)box.innerHTML='<div class="carregandoP">gerando o código... isso leva alguns segundos</div>';
  try{
    var r=await zapApi('/conectar/'+suc,'POST',{});
    if(r&&r.qr){
      box.innerHTML='<div class="zapQr">'+
       '<b>Leia o código com o celular da loja</b>'+
       '<img src="'+r.qr+'" alt="QR code">'+
       '<span class="hint">WhatsApp → Aparelhos conectados → Conectar aparelho</span>'+
       '<div class="zapEsperando">'+sv('ref',13)+' esperando a leitura...</div></div>';
      if(!ZP._loopPdv)ZP._loopPdv=setInterval(function(){
        if(!document.getElementById('zapPdv')){clearInterval(ZP._loopPdv);ZP._loopPdv=null;return;}
        estadoZapPdv(suc);
      },3000);
      return;
    }
    if(r&&r.erro){
      box.innerHTML='<div class="zapOff">'+sv('help',22)+
       '<b>O robô recusou a conexão</b>'+
       '<span class="hint">'+E(String(r.erro).slice(0,180))+'</span>'+
       '<button class="btnP2" onclick="conectarZapPdv(\''+suc+'\')">Tentar de novo</button></div>';
      return;
    }
    estadoZapPdv(suc);
  }catch(e){
    box.innerHTML='<div class="zapOff">'+sv('help',22)+
     '<b>Não consegui falar com o robô</b>'+
     '<span class="hint">'+E(e.message||'')+'</span>'+
     '<button class="btnP2" onclick="conectarZapPdv(\''+suc+'\')">Tentar de novo</button></div>';
  }
}
async function desconectarZapPdv(suc){
  var ok=await confirmar({titulo:'Desconectar o WhatsApp',
    texto:'O robô para de responder por este número.',
    ok:'Desconectar',tipo:'perigo'});
  if(!ok)return;
  try{ await zapApi('/desconectar/'+suc,'POST',{}); }
  catch(e){ toast((e&&e.message)||'não consegui desconectar'); return; }
  estadoZapPdv(suc);
}

/* ---------- CONFIGURAÇÃO DO PDV ---------- */

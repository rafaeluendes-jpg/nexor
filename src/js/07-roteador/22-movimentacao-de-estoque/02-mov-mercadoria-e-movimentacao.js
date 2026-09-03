/* ==========================================================
   MOVIMENTACAO DE MERCADORIA
   Substitui o antigo "Historico de Posicao de Estoque". A pergunta que
   esta tela responde e: neste dia, quanto entrou, quanto saiu e com quanto
   este item terminou — e, abrindo a linha, POR QUE cada quilo se moveu.

   Uma linha por dia e por item. O "+" abre os lancamentos daquele dia, em
   ordem de hora, cada um com o saldo depois dele. Assim da para seguir o
   saldo passo a passo: comecou com X, a venda tirou tanto, a producao pos
   tanto, terminou com Y.

   O saldo do dia nao e guardado em lugar nenhum: e reconstruido a partir do
   razao de movimentos, com saldoNaData(). Por isso vale para qualquer dia
   do passado, sem depender de nada ter sido preparado antes.
   ========================================================== */
var MM={de:'',ate:'',item:'',abertos:{},pronto:false};

function mmRotulo(m,l){
  var o=String(m.origem||'');
  var ent=(l.direcao==='entrada');
  if(o==='venda')  return 'Saída por venda no PDV';
  if(o==='cardapio')return 'Saída por pedido do cardápio';
  if(o==='totem')  return 'Saída por pedido no totem';
  if(o==='fiado')  return 'Saída por venda fiado';
  if(o==='producao')return ent?'Entrada por produção':'Consumo na produção';
  if(o==='nota')   return 'Entrada por nota de entrada';
  if(o==='transferencia')return ent?'Entrada por transferência':'Saída por transferência';
  if(o==='contagem')return ent?'Ajuste de contagem (sobra)':'Ajuste de contagem (falta)';
  if(o==='assistente')return ent?'Entrada pelo Assistente':'Saída pelo Assistente';
  var mt=(DB.motivosMov||[]).find(function(x){return x.id===m.motivoId});
  if(mt&&mt.nome)return (ent?'Entrada':'Saída')+' — '+mt.nome;
  return ent?'Entrada manual':'Saída manual';
}

/* todos os lancamentos de um item, no periodo, ja com data e direcao */
function mmLancamentos(){
  baseMov();
  var loja=lojaAtualId();
  var de=MM.de, ate=MM.ate, alvo=MM.item;
  var out=[];
  (DB.movEst||[]).forEach(function(m){
    var d=String(m.data||'');
    if(!d||(de&&d<de)||(ate&&d>ate))return;
    if((m.sucursalId||loja)!==loja)return;
    (m.linhas||[]).forEach(function(l){
      if(alvo&&l.insumoId!==alvo)return;
      out.push({data:d,hora:m.hora||'',mov:m,l:l,
        id:l.insumoId,nome:l.nome||(itemEstoque(l.insumoId)||{}).nome||'—',
        un:l.unidade||'',qtd:Number(l.qtd)||0,ent:l.direcao==='entrada'});
    });
  });
  return out;
}

function telaMovMercadoria(){
  if(!MM.pronto){
    var hoje=hojeISO();
    MM.ate=hoje; MM.de=hoje.slice(0,8)+'01'; MM.pronto=true;
  }
  var lanc=mmLancamentos();

  /* agrupa por dia + item */
  var grupos={};
  lanc.forEach(function(x){
    var k=x.data+'|'+x.id;
    /* soma sempre na UNIDADE-BASE do item; a linha pode vir em grama e o
       item ser guardado em quilo. Sem converter, o dia somava grama com
       quilo e o saldo não fazia sentido (era o número "nada a ver"). */
    var baseUn=(itemEstoque(x.id)||{}).unidade||x.un;
    if(!grupos[k])grupos[k]={data:x.data,id:x.id,nome:x.nome,un:baseUn,ent:0,sai:0,itens:[]};
    var g=grupos[k];
    var qb=convUnid(x.qtd,x.un,baseUn); if(qb===null)qb=x.qtd;
    if(x.ent)g.ent+=qb; else g.sai+=qb;
    g.itens.push(x);
  });
  var lista=Object.keys(grupos).map(function(k){return grupos[k]});
  lista.sort(function(a,b){
    if(a.data!==b.data)return a.data<b.data?1:-1;      /* dia mais novo primeiro */
    return (a.nome||'').localeCompare(b.nome||'');
  });

  var itens=itensEstoque().slice().sort(function(a,b){
    return (a.nome||'').localeCompare(b.nome||'')});

  /* ==========================================================
     A TELA E A LISTA; O RESTO E MOLDURA
     Primeira versao: titulo, duas linhas de explicacao e os filtros
     espalhados numa caixa larga — a lista comecava no meio da tela e rolava
     junto com a pagina, numa barra minuscula.
     Agora so o titulo e os filtros ficam fixos, numa faixa fina, e a lista
     ocupa toda a altura que sobra com rolagem propria. A explicacao virou
     um "?" ao lado do titulo: quem ja sabe nao le duas vezes.
     ========================================================== */
  var html=
   '<div class="mvWrap">'+
    '<div class="mvTopo">'+
     '<h1>Movimentação de Mercadoria</h1>'+
     '<span class="mmAjuda" title="Uma linha por dia e por item: quanto entrou, '+
      'quanto saiu e com quanto terminou. Clique na linha para ver hora a hora '+
      'o motivo de cada movimento e o saldo depois dele.">?</span>'+
     '<div style="flex:1"></div>'+
     '<span class="hint">'+lista.length+' dia(s) com movimento</span>'+
    '</div>'+
    '<div class="mvFiltros">'+
     '<div class="f2" style="flex:0 0 150px"><label>Data inicial</label>'+
      '<input type="date" id="mmDe" value="'+E(MM.de)+'"></div>'+
     '<div class="f2" style="flex:0 0 150px"><label>Data final</label>'+
      '<input type="date" id="mmAte" value="'+E(MM.ate)+'"></div>'+
     '<div class="f2" style="flex:1 1 260px"><label>Ingrediente</label>'+
      '<select id="mmItem"><option value="">todos os ingredientes</option>'+
      itens.map(function(i){
        return '<option value="'+E(i.id)+'"'+(MM.item===i.id?' selected':'')+'>'+
          E(i.nome)+'</option>';}).join('')+'</select></div>'+
     '<button class="btnP2 ok" onclick="mmBuscar()">'+sv('search',13)+' Buscar</button>'+
     '<button class="btnP2" onclick="mmLimpar()">Limpar</button>'+
    '</div>';

  if(!lista.length){
    html+='<div class="mvTabW"><div class="mvVazio">'+sv('box',26)+
      '<b>Nenhuma movimentação no período</b>'+
      '<span>Ajuste as datas ou escolha outro ingrediente.</span></div></div></div>';
    $('content').innerHTML=html; rodape('0 registros'); return;
  }

  html+='<div class="mvTabW">'+
   '<table class="mvTab"><thead><tr>'+
    '<th style="width:110px">Data</th><th>Ingrediente</th>'+
    '<th style="width:150px;text-align:right">Qtde entrada</th>'+
    '<th style="width:150px;text-align:right">Qtde saída</th>'+
    '<th style="width:160px;text-align:right">Saldo do dia</th>'+
   '</tr></thead><tbody>';

  lista.forEach(function(g){
    var k=g.data+'|'+g.id, aberto=!!MM.abertos[k];
    var saldoFim=saldoNaData(g.id,g.data);
    var qE=qtdLegivel(g.ent,g.un), qS=qtdLegivel(g.sai,g.un), qF=qtdLegivel(saldoFim,g.un);
    html+='<tr style="cursor:pointer" onclick="mmAbrir(\''+E(k)+'\')">'+
      '<td>'+dataBR(g.data)+'</td>'+
      '<td><span class="mmMais">'+(aberto?'−':'+')+'</span> <b>'+E(g.nome)+'</b></td>'+
      '<td style="text-align:right;color:var(--ok)"><b>'+qE.n+'</b> <small>'+qE.u+'</small></td>'+
      '<td style="text-align:right;color:var(--rd)"><b>'+qS.n+'</b> <small>'+qS.u+'</small></td>'+
      '<td style="text-align:right"><b>'+qF.n+'</b> <small>'+qF.u+'</small></td></tr>';

    if(aberto){
      /* saldo corrido: comeca no fim do dia anterior e caminha lancamento a lancamento */
      var ini=new Date(g.data+'T12:00:00'); ini.setDate(ini.getDate()-1);
      var saldo=saldoNaData(g.id, ini.toISOString().slice(0,10));
      var _qi=qtdLegivel(saldo,g.un);
      var det=g.itens.slice().sort(function(a,b){return (a.hora||'').localeCompare(b.hora||'')});
      /* ==========================================================
         O DETALHE TEM DE TER AS MESMAS COLUNAS DE FORA
         A tabela de dentro tinha 4 colunas e a de fora tem 5. Resultado:
         tudo andava uma casa, e uma ENTRADA de 4,8 kg aparecia debaixo de
         "Qtde saida". Numero na coluna errada nao e detalhe de layout — e
         informacao errada. Agora entrada e saida tem cada uma a sua coluna,
         iguais as de cima, e cada valor cai onde deve.
         ========================================================== */
      html+='<tr class="mmDet"><td colspan="5" style="padding:0">'+
        '<table class="mmSub"><tbody>'+
        '<tr class="mmIni"><td style="width:110px">—</td>'+
        '<td>Saldo no início do dia</td>'+
        '<td style="width:150px"></td><td style="width:150px"></td>'+
        '<td style="width:160px;text-align:right"><b>'+_qi.n+'</b> '+_qi.u+'</td></tr>';
      det.forEach(function(x){
        /* o saldo caminha na unidade-base; o movimento aparece na unidade
           que se lê (grama abaixo de 1 kg, quilo acima) */
        var qb=convUnid(x.qtd,x.un,g.un); if(qb===null)qb=x.qtd;
        saldo += x.ent? qb : -qb;
        var qm=qtdLegivel(x.qtd,x.un), qsd=qtdLegivel(saldo,g.un);
        html+='<tr><td style="width:110px">'+E(x.hora||'')+'</td>'+
          '<td>'+E(mmRotulo(x.mov,x.l))+
            (x.mov.identificacao?' <small>· '+E(x.mov.identificacao)+'</small>':'')+'</td>'+
          '<td style="width:150px;text-align:right;color:var(--ok)">'+
            (x.ent?'+'+qm.n+' '+qm.u:'')+'</td>'+
          '<td style="width:150px;text-align:right;color:var(--rd)">'+
            (x.ent?'':'−'+qm.n+' '+qm.u)+'</td>'+
          '<td style="width:160px;text-align:right">'+qsd.n+' '+qsd.u+'</td></tr>';
      });
      html+='</tbody></table></td></tr>';
    }
  });
  html+='</tbody></table></div></div>';
  $('content').innerHTML=html;
  rodape(lista.length+' dia(s) com movimento');
}
function mmBuscar(){
  MM.de=$('mmDe').value; MM.ate=$('mmAte').value; MM.item=$('mmItem').value;
  MM.abertos={}; telaMovMercadoria();
}
function mmLimpar(){
  var hoje=hojeISO();
  MM.de=hoje.slice(0,8)+'01'; MM.ate=hoje; MM.item=''; MM.abertos={};
  telaMovMercadoria();
}
function mmAbrir(k){
  MM.abertos[k]=!MM.abertos[k];
  /* ==========================================================
     CLICAR NO "+" NÃO PODE EMPURRAR A TELA PARA O TOPO

     03/09/2026. Abrir o detalhe de um item redesenha a lista inteira; o
     redesenho troca a caixa que rola (.mvTabW) por uma nova, e a guarda
     geral de rolagem tenta devolver a posição — mas a altura ainda não foi
     recalculada e o scrollTop é cortado para zero. A tela "treme" e sobe.

     Aqui a posição é guardada e devolvida na hora E no quadro seguinte,
     quando a altura já assentou. A tela fica parada; só o detalhe abre
     abaixo do item. */
  var cx=document.querySelector('.mvTabW');
  var y=cx?cx.scrollTop:0;
  telaMovMercadoria();
  var cx2=document.querySelector('.mvTabW');
  if(cx2){ cx2.scrollTop=y; requestAnimationFrame(function(){ var c=document.querySelector('.mvTabW'); if(c)c.scrollTop=y; }); }
}

function telaMovimentacao(){
  baseMov();
  if(!MV.de){MV.de=diasAtrasISO(30);MV.ate=hojeISO();}
  var linhas=[];
  (DB.movEst||[]).forEach(function(m){
    if(MV.de&&m.data<MV.de)return;
    if(MV.ate&&m.data>MV.ate)return;
    if(MV.motivoId&&m.motivoId!==MV.motivoId)return;
    (m.linhas||[]).forEach(function(l){
      var ins=itemEstoque(l.insumoId);
      if(MV.insumoId&&l.insumoId!==MV.insumoId)return;
      if(MV.grupo&&(!ins||(ins.grupoId!==MV.grupo&&ins.categoriaId!==MV.grupo)))return;
      if(!casaBuscaMov(l,m,ins))return;
      linhas.push({m:m,l:l,ins:ins});
    });
  });
  linhas.sort(function(a,b){return (b.m.data+b.m.hora).localeCompare(a.m.data+a.m.hora)});
  var totCusto=linhas.reduce(function(a,x){return a+(Number(x.l.qtd)||0)*(Number(x.l.custo)||0)},0);
  var totEnt=linhas.filter(function(x){return x.l.direcao==='entrada'})
    .reduce(function(a,x){return a+(Number(x.l.qtd)||0)*(Number(x.l.custo)||0)},0);
  var totSai=totCusto-totEnt;
  /* Custo medio do que esta na tela: o valor movimentado dividido pela
     quantidade movimentada. Nao e a media dos custos unitarios — essa
     trataria 1 kg e 500 kg como se pesassem o mesmo. */
  var qtdTotal=linhas.reduce(function(a,x){return a+(Number(x.l.qtd)||0)},0);
  /* ==========================================================
     O RODAPE MOSTRA O TOTAL, NAO A MEDIA

     A media por lancamento entrou aqui para corrigir um rotulo errado —
     o rodape dizia "media" e mostrava a soma. Consertou o nome e
     estragou o numero: quem abre a Movimentacao filtrando um item quer
     saber QUANTO saiu no periodo, nao quanto saiu por pedido. Filtrando
     Gelato Venda em 31/08, 29 consumos, o rodape dizia "255,172 g -
     media de 29 consumos", quando o que a loja precisa e o total do dia.

     Agora e a soma, com o nome certo: "total de 29 consumos".

     Quando o filtro mistura unidades (g com kg), somar seria mentira —
     500 g + 2 kg nao sao 502 de coisa nenhuma. Nesse caso o rodape diz
     que as unidades estao misturadas, em vez de exibir um numero que
     nao quer dizer nada.
     ========================================================== */
  var ent=linhas.filter(function(x){return x.l.direcao==='entrada'});
  var sai=linhas.filter(function(x){return x.l.direcao!=='entrada'});
  var somaEnt=ent.reduce(function(a,x){return a+(Number(x.l.qtd)||0)},0);
  var somaSai=sai.reduce(function(a,x){return a+(Number(x.l.qtd)||0)},0);
  /* ==========================================================
     CUSTO MEDIO OLHA A ENTRADA, NAO O CONSUMO
     Custo medio responde "quanto me custa o quilo deste item". Quem
     responde isso e a COMPRA/PRODUCAO, nao a baixa. Misturando os dois, o
     mesmo material era contado duas vezes — uma ao entrar e outra ao sair —
     e o numero deixava de ser o custo do quilo para virar uma media de
     nada. Quando o filtro so mostra consumo (sem nenhuma entrada), a conta
     usa o consumo, senao a linha ficaria zerada sem explicacao.
     ========================================================== */
  var baseCusto = ent.length?ent:sai;
  var custoBase = baseCusto.reduce(function(a,x){
    return a+(Number(x.l.qtd)||0)*(Number(x.l.custo)||0)},0);
  var qtdBase = baseCusto.reduce(function(a,x){return a+(Number(x.l.qtd)||0)},0);
  var custoMedio = qtdBase?custoBase/qtdBase:0;
  var unMedia=(function(){
    var us={};
    linhas.forEach(function(x){ var u=(x.l.unidade||'')||'un'; us[u]=(us[u]||0)+1; });
    var ks=Object.keys(us);
    return ks.length===1?ks[0]:'';     /* unidades misturadas: nao rotula */
  })();

  $('content').innerHTML='<div class="mvWrap">'+
   '<div class="mvTopo">'+
    '<button class="btnMais" title="Nova baixa manual" onclick="modalMovimento()">'+sv('plus',20)+'</button>'+
    '<h1>Movimentações de estoque</h1>'+
    '<div style="flex:1"></div>'+
    '<button class="btnP2" onclick="exportarMov()">'+sv('down2',13)+' Exportar</button>'+
   '</div>'+
   '<div class="mvFiltros">'+
    '<div class="f2" style="max-width:140px"><label>De</label><input type="date" id="mvDe" value="'+MV.de+'"></div>'+
    '<div class="f2" style="max-width:140px"><label>Até</label><input type="date" id="mvAte" value="'+MV.ate+'"></div>'+
    /* ==========================================================
       A LISTA DE ITENS APARECE EMBAIXO DO CAMPO

       Era um `<datalist>`: quem escolhe onde e como desenhar aquilo e o
       navegador, e ele joga a lista onde quer — no Chrome do balcao ela
       saia colada na lateral e com a letra do sistema, nao a do Joia.
       Nao da para posicionar nem estilizar um datalist.

       Agora e a mesma lista de sugestao que a Baixa Manual ja usa
       (`.bxSug`): abre logo abaixo do campo, com o nome do item e a
       etiqueta de insumo ou ficha. Clicar no campo mostra o que existe;
       a partir de tres letras ela filtra.

       A escolha usa `onmousedown`, nao `onclick`: o clique tira o foco
       do campo, e o `onblur` redesenharia a tela ANTES de o clique
       chegar — que e como a sugestao antiga sumia debaixo do dedo.
       ========================================================== */
    '<div class="f2" style="min-width:210px;position:relative"><label>Item</label>'+
     '<input id="mvBusca" placeholder="clique ou digite 3 letras" autocomplete="off" '+
     'value="'+E(MV.insumoId?((itemEstoque(MV.insumoId)||{}).nome||''):(MV.busca||''))+'">'+
     '<div class="bxSug" id="mvSug" style="display:none"></div></div>'+
    '<div class="f2"><label>Grupo</label><select onchange="MV.grupo=this.value;telaMovimentacao()">'+
     '<option value="">Todos</option>'+
     (DB.gruposIng||[]).map(function(g){return '<option value="'+g.id+'"'+(MV.grupo===g.id?' selected':'')+'>'+E(g.nome)+'</option>'}).join('')+
    '</select></div>'+
    '<div class="f2"><label>Movimentação</label><select onchange="MV.motivoId=this.value;telaMovimentacao()">'+
     '<option value="">Todas</option>'+
     (DB.motivosMov||[]).map(function(m){return '<option value="'+m.id+'"'+(MV.motivoId===m.id?' selected':'')+'>'+E(m.nome)+'</option>'}).join('')+
    '</select></div>'+
    '<button class="btnP2 ok" onclick="buscarMov()">'+sv('search',13)+' Buscar</button>'+
    '<button class="btnP2" onclick="MV={de:diasAtrasISO(30),ate:hojeISO(),insumoId:\'\',grupo:\'\',motivoId:\'\',busca:\'\'};telaMovimentacao()">Limpar</button>'+
   '</div>'+
   '<div class="mvTabW">'+
   (linhas.length?'<table class="mvTab"><thead><tr>'+
    '<th style="width:92px">Data</th><th>Ingrediente</th>'+
    '<th style="width:130px">Grupo</th><th style="width:150px">Motivo</th>'+
    '<th style="width:120px">Identificação</th>'+
    '<th style="width:120px;text-align:right">Qtd / un. entrada</th>'+
    '<th style="width:120px;text-align:right">Qtd / un. consumo</th>'+
    '<th style="width:100px;text-align:right">Custo</th>'+
    '<th style="width:110px;text-align:right">Custo total</th>'+
    '<th style="width:130px">Obs.</th><th style="width:40px"></th></tr></thead><tbody>'+
    linhas.map(function(x){
      var l=x.l,m=x.m,ins=x.ins;
      var g=ins?grupoIng(ins.grupoId):null;
      var tot=(Number(l.qtd)||0)*(Number(l.custo)||0);
      return '<tr class="'+(l.direcao==='entrada'?'ent destaqueEnt':'sai')+'">'+
      '<td>'+dataBR(m.data)+'<small>'+E(m.hora||'')+'</small></td>'+
      '<td><b>'+E(l.nome)+'</b>'+
       (l.direcao==='entrada'?'<span class="tagGerou">gerado</span>':'')+
       (l.fichaNome?'<small>'+(l.direcao==='entrada'?'produzido a partir de ':'usado em ')+E(l.fichaNome)+'</small>':'')+'</td>'+
      '<td>'+E(g?g.nome:'—')+'</td>'+
      '<td>'+E(nomeMotivo(m.motivoId))+'</td>'+
      '<td>'+E(m.identificacao||'—')+'</td>'+
      '<td style="text-align:right">'+(l.direcao==='entrada'
        ?'<b class="vg">'+fmtQt(l.qtd)+' '+un(l.unidade).ab+'</b>':'—')+'</td>'+
      '<td style="text-align:right">'+(l.direcao==='saida'
        ?'<b class="vr">'+fmtQt(l.qtd)+' '+un(l.unidade).ab+'</b>':'—')+'</td>'+
      '<td style="text-align:right">'+money(l.custo)+'<small>/ '+un(l.unidade).ab+'</small></td>'+
      '<td style="text-align:right"><b>'+money(tot)+'</b></td>'+
      '<td class="obsC">'+(l.sistema!==undefined
        ?'sistema '+fmtQt(l.sistema)+' · contado '+fmtQt(l.conferido)
        :E(l.obs||m.obs||''))+'</td>'+
      '<td><div class="rowAct">'+
       '<button class="rBtn" onclick="verMovimento(\''+m.id+'\')" title="Ver o lançamento">'+sv('eye',11)+'</button>'+
       (m.origem!=='venda'?'<button class="rBtn rd" onclick="excluirMov(\''+m.id+'\')" title="Excluir lançamento">'+sv('trash',11)+'</button>':'')+
      '</div></td></tr>';
    }).join('')+'</tbody>'+
    /* ==========================================================
       UM RODAPE SO, CADA NUMERO NA SUA COLUNA
       Antes eram tres linhas: o subtotal, o custo medio jogado a esquerda e
       "Entradas/Consumo" solto embaixo. Numero longe da coluna nao se
       compara com nada — "4,8 kg" ao lado da palavra "Custo medio" chegava
       a parecer dinheiro. Agora cada total desce debaixo da sua coluna, com
       o nome em letra miuda embaixo do valor.
       ========================================================== */
    '<tfoot><tr>'+
     '<td colspan="5"><b>Subtotal — '+linhas.length+' movimentações</b></td>'+
     '<td style="text-align:right"><b>'+fmtQt(somaEnt)+(unMedia?' '+E(unMedia):'')+'</b>'+
      '<small>total de '+ent.length+' entrada'+(ent.length===1?'':'s')+
       (unMedia||!ent.length?'':' · unidades misturadas')+'</small></td>'+
     '<td style="text-align:right"><b>'+fmtQt(somaSai)+(unMedia?' '+E(unMedia):'')+'</b>'+
      '<small>total de '+sai.length+' consumo'+(sai.length===1?'':'s')+
       (unMedia||!sai.length?'':' · unidades misturadas')+'</small></td>'+
     '<td style="text-align:right"><b>R$ '+money(custoMedio)+'</b>'+
      '<small>custo médio'+(unMedia?' / '+E(unMedia):'')+
       (ent.length?'':' (consumo)')+'</small></td>'+
     '<td style="text-align:right"><b>R$ '+money(totCusto)+'</b>'+
      '<small>custo total</small></td>'+
     '<td colspan="2"></td></tr></tfoot></table>'
   :'<div class="mvVazio">'+sv('box',26)+'<b>Nenhum registro encontrado</b>'+
    '<span>Ajuste o período ou clique no <b>+</b> para lançar uma baixa manual.</span></div>')+
   '</div></div>';
  var mb=document.getElementById('mvBusca');
  if(mb){
    if(_focoBusca==='mvBusca'){mb.focus();
      try{mb.setSelectionRange(mb.value.length,mb.value.length)}catch(e){_quieto(e,'telaMovimentacao')}}
    /* ==========================================================
       A LISTA DE SUGESTAO SUMIA NA HORA DE CLICAR
       A cada letra, 260 ms depois, a tela inteira era redesenhada para
       filtrar a tabela. Redesenhar troca o <input> por um novo — e o
       navegador fecha a lista de sugestoes junto. Quem digitava "gelato",
       via a lista abrir e ia clicar, clicava no vazio.
       Agora digitar NAO redesenha nada. O redesenho acontece quando a
       escolha esta feita: nome exato (que e o que acontece ao clicar na
       sugestao), Enter, ou ao sair do campo. A lista fica de pe o tempo
       todo, que e como uma lista de sugestao tem de se comportar.
       ========================================================== */
    function _aplicaBuscaMov(txt,forcar){
      var t=String(txt||'').trim(), tl=t.toLowerCase();
      if(!t){
        if(MV.insumoId||MV.busca){MV.insumoId='';MV.busca='';telaMovimentacao();}
        return;
      }
      var l2=itensEstoque();
      var a=l2.find(function(i){return (i.nome||'').toLowerCase()===tl})
          || l2.find(function(i){return String(i.codigo||'').toLowerCase()===tl});
      if(a){
        if(a.id!==MV.insumoId||MV.busca){MV.insumoId=a.id;MV.busca='';telaMovimentacao();}
        return;
      }
      if(!forcar)return;                 /* ainda escolhendo: nao mexe na tela */
      var nova=(t.length>=3?t:'');
      if(nova===MV.busca&&!MV.insumoId)return;
      MV.insumoId='';MV.busca=nova;telaMovimentacao();
    }
    /* ---------- a lista de sugestão, desenhada por nós ---------- */
    var cxSug=document.getElementById('mvSug');
    function _sugestoesMov(txt){
      var t=String(txt||'').trim().toLowerCase();
      var l2=itensEstoque().slice()
        .sort(function(a,b){return (a.nome||'').localeCompare(b.nome||'')});
      if(t.length>=3)l2=l2.filter(function(i){
        return (i.nome||'').toLowerCase().indexOf(t)>=0 ||
               String(i.codigo||'').toLowerCase().indexOf(t)>=0; });
      else if(t.length)return [];        /* 1 ou 2 letras: ainda nao filtra */
      return l2.slice(0,40);
    }
    function _pintaSugMov(txt){
      if(!cxSug)return;
      var l2=_sugestoesMov(txt);
      if(!l2.length){ cxSug.style.display='none'; cxSug.innerHTML=''; return; }
      cxSug.innerHTML=l2.map(function(i){
        return '<div data-id="'+E(i.id)+'">'+E(i.nome)+
          '<span class="bxTg'+(ehFicha(i)?' f':'')+'">'+
          (ehFicha(i)?'ficha':'insumo')+'</span></div>';
      }).join('');
      cxSug.style.display='';
      var ds=cxSug.querySelectorAll('div[data-id]');
      for(var k=0;k<ds.length;k++)ds[k].onmousedown=function(ev){
        /* nao tira o foco antes de o clique chegar: era assim que a
           sugestao antiga sumia debaixo do dedo */
        ev.preventDefault();
        MV.insumoId=this.getAttribute('data-id'); MV.busca='';
        _focoBusca=''; cxSug.style.display='none';
        telaMovimentacao();
      };
    }
    mb.onfocus=function(){ _focoBusca='mvBusca'; _pintaSugMov(this.value); };
    mb.oninput=function(){ _focoBusca='mvBusca'; _pintaSugMov(this.value);
      _aplicaBuscaMov(this.value,false); };
    mb.onchange=function(){ _focoBusca='mvBusca'; _aplicaBuscaMov(this.value,true); };
    mb.onblur=function(){ var v=this.value;
      if(cxSug)cxSug.style.display='none';
      setTimeout(function(){_aplicaBuscaMov(v,true)},180); };
    mb.onkeydown=function(e){
      if(e.key==='Escape'&&cxSug){cxSug.style.display='none';return;}
      if(e.key==='Enter'){ _focoBusca='mvBusca';
        if(cxSug)cxSug.style.display='none';
        _aplicaBuscaMov(this.value,true); } };
    if(_focoBusca==='mvBusca')_pintaSugMov(mb.value);
  }
  rodape(linhas.length+' movimentações no período');
}
/* abre o lançamento inteiro: o que saiu, o que entrou, quando e por quê */
function verMovimento(id){
  var m=(DB.movEst||[]).find(function(x){return x.id===id});
  if(!m)return;
  var linhas=m.linhas||[];
  var ent=linhas.filter(function(l){return l.direcao==='entrada'});
  var sai=linhas.filter(function(l){return l.direcao==='saida'});
  var vEnt=ent.reduce(function(a,l){return a+(Number(l.qtd)||0)*(Number(l.custo)||0)},0);
  var vSai=sai.reduce(function(a,l){return a+(Number(l.qtd)||0)*(Number(l.custo)||0)},0);
  var fichas={};
  linhas.forEach(function(l){if(l.fichaNome)fichas[l.fichaNome]=true;});
  var nomesF=Object.keys(fichas);

  function tabela(tit,arr,cor){
    if(!arr.length)return '';
    return '<div class="blk" style="margin:0 0 11px;max-width:none;padding:0;overflow:hidden">'+
     '<div class="acTit">'+tit+' — '+arr.length+' item(ns)</div>'+
     '<table class="acTab"><thead><tr><th>Item</th>'+
     '<th style="width:120px;text-align:right">Quantidade</th>'+
     '<th style="width:110px;text-align:right">Custo unit.</th>'+
     '<th style="width:110px;text-align:right">Valor</th></tr></thead><tbody>'+
     arr.map(function(l){
       return '<tr><td><b>'+E(l.nome)+'</b>'+
       (l.fichaNome?'<small style="display:block;color:var(--ink-3)">'+
         (l.direcao==='entrada'?'produzido a partir de ':'usado em ')+E(l.fichaNome)+'</small>':'')+
       (l.obs?'<small style="display:block;color:var(--ink-3)">'+E(l.obs)+'</small>':'')+'</td>'+
       '<td style="text-align:right"><b class="'+cor+'">'+(l.direcao==='entrada'?'+':'-')+
        fmtQt(l.qtd)+' '+un(l.unidade).ab+'</b></td>'+
       '<td style="text-align:right">'+money(l.custo)+'</td>'+
       '<td style="text-align:right"><b>'+money((Number(l.qtd)||0)*(Number(l.custo)||0))+'</b></td></tr>';
     }).join('')+'</tbody></table></div>';
  }

  var h='<div class="mdB">'+
  '<div class="acHead"><div class="av3" style="width:42px;height:42px">'+sv('box',18)+'</div>'+
  '<div><b>'+E(nomeMotivo(m.motivoId))+'</b>'+
  '<span>'+dataBR(m.data)+' às '+E(m.hora||'')+
   (m.identificacao?' · '+E(m.identificacao):'')+'</span>'+
  (nomesF.length?'<span>Receita: '+E(nomesF.join(', '))+'</span>':'')+
  (m.obs?'<span>'+E(m.obs)+'</span>':'')+'</div>'+
  '<div style="text-align:right"><span class="hint">Movimento</span>'+
  '<b style="display:block;font-size:18px;color:var(--acc-d)">'+linhas.length+' linha(s)</b></div></div>'+
  '<div class="acKpis">'+
   '<div class="acK"><span>Entrou</span><b class="vg">'+ent.length+' item(ns)</b></div>'+
   '<div class="acK"><span>Valor que entrou</span><b class="vg">R$ '+money(vEnt)+'</b></div>'+
   '<div class="acK"><span>Saiu</span><b class="vr">'+sai.length+' item(ns)</b></div>'+
   '<div class="acK dest3"><span>Valor consumido</span><b>R$ '+money(vSai)+'</b></div>'+
  '</div>'+
  tabela('Entrou no estoque',ent,'vg')+
  tabela('Saiu do estoque',sai,'vr')+
  '</div>';

  var ov=document.createElement('div');ov.className='mdOv';ov.id='mdOv';
  ov.innerHTML='<div class="mdBox xl"><div class="mdH"><b>Lançamento de estoque</b>'+
   '<button onclick="fecharModal()">&times;</button></div>'+h+
   '<div class="mdF"><button class="btnP2" onclick="fecharModal()">Fechar</button>'+
   (m.origem!=='venda'?'<button class="btnP2 rdB" onclick="excluirMov(\''+m.id+'\')">'+
     sv('trash',13)+' Excluir lançamento</button>':'')+'</div></div>';
  document.body.appendChild(ov);
  fecharSoForaDeVerdade(ov);
}
async function excluirMov(id){
  var m=(DB.movEst||[]).find(function(x){return x.id===id});
  if(!m)return;
  var ok=await confirmar({titulo:'Excluir lançamento de estoque',
    texto:'As quantidades voltam para o estoque como estavam antes.',
    ok:'Excluir',tipo:'perigo'});
  if(!ok)return;
  aplicarMovimento(m,true);
  DB.movEst=DB.movEst.filter(function(x){return x.id!==id});
  salvar();fecharModal();telaMovimentacao();
  toast('Lançamento excluído e estoque desfeito.');
}
function buscarMov(){MV.de=$('mvDe').value;MV.ate=$('mvAte').value;telaMovimentacao();}
function exportarMov(){
  baseMov();
  var l=[['Data','Hora','Ingrediente','Grupo','Motivo','Identificacao','Entrada','Consumo','Unidade','Custo','Custo total','Obs']];
  (DB.movEst||[]).forEach(function(m){
    if(MV.de&&m.data<MV.de)return;
    if(MV.ate&&m.data>MV.ate)return;
    if(MV.motivoId&&m.motivoId!==MV.motivoId)return;
    (m.linhas||[]).forEach(function(x){
      var ins=itemEstoque(x.insumoId);
      if(MV.insumoId&&x.insumoId!==MV.insumoId)return;
      if(MV.grupo&&(!ins||ins.grupoId!==MV.grupo))return;
      if(!casaBuscaMov(x,m,ins))return;
      var g=ins?grupoIng(ins.grupoId):null;
      l.push([dataBR(m.data),m.hora||'',x.nome,g?g.nome:'',nomeMotivo(m.motivoId),m.identificacao||'',
        x.direcao==='entrada'?String(x.qtd).replace('.',','):'',
        x.direcao==='saida'?String(x.qtd).replace('.',','):'',
        un(x.unidade).ab,String(x.custo).replace('.',','),
        String(arred((Number(x.qtd)||0)*(Number(x.custo)||0)).toFixed(2)).replace('.',','),x.obs||m.obs||'']);
    });
  });
  var csv=l.map(function(r){return r.map(function(c){return '"'+String(c).replace(/"/g,'""')+'"'}).join(';')}).join('\n');
  var b=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'});
  var a=document.createElement('a');a.href=URL.createObjectURL(b);
  a.download='nexor-movimentacoes-'+MV.de+'-a-'+MV.ate+'.csv';
  document.body.appendChild(a);a.click();setTimeout(function(){a.remove()},400);
  toast('Movimentações exportadas.');
}

/* ---------- LANÇAMENTO ---------- */
var _movItens=[];
/* a baixa manual so aceita motivo do tipo Saida.
   Entrada vem por nota fiscal, producao pela ordem de producao, acerto pela contagem. */
function motivosBaixa(){
  return (DB.motivosMov||[]).filter(function(m){
    return motivoVisivel(m)&&!m.sistema&&tipoMotivo(m.id)==='saida';});
}
function modalMovimento(){
  baseMov();
  if(!motivosBaixa().length){
    alert('Nenhum motivo de SAIDA cadastrado.\n\n'+
      'Cadastre em Configuracao da Loja > Configuracao de Movimentacao de Estoque.\n\n'+
      'Esta tela so faz baixa manual: entrada vem por nota de entrada, producao pela '+
      'ordem de producao e acerto de saldo pela contagem de estoque.');
    return;
  }
  _movItens=[{tipo:'',refId:'',unidade:'',qtd:0,custo:0,obs:''}];
  /* a tela inteira e baixa manual — nao ha o que escolher.
     O motivo ja vem no primeiro cadastrado, e trocar e um clique. */
  _movMotivo=(motivosBaixa()[0]||{}).id||'';
  _movIdent='';_movObs='';_movData=hojeISO();_movHora=agoraHM();
  desenhaMovimento();
}
function desenhaMovimento(){
  function nomeItem(it){
    if(it.tipo==='insumo'){var i=insumo(it.refId);return i?i.nome:''}
    if(it.tipo==='ficha'){var f=(DB.fichas||[]).find(function(x){return x.id===it.refId});return f?f.nome:''}
    return '';
  }

  var total=_movItens.reduce(function(a,it){return a+(Number(it.qtd)||0)*(Number(it.custo)||0)},0);
  var tipoAtual=_movMotivo?tipoMotivo(_movMotivo):'';

  var h='<div class="mvMod">'+
   '<div class="mvH"><div><b>Baixa manual de estoque</b>'+
    '<span>Só saída, com motivo cadastrado · entrada vem por nota de entrada, '+
    'produção pela ordem de produção, acerto pela contagem</span></div>'+
    '<button onclick="fecharMov()">&times;</button></div>'+
   '<div class="mvCab">'+
    '<div class="f2" style="max-width:160px"><label>Operação</label>'+
     '<div class="opFixa">'+sv('dn4',13)+' Baixa manual</div></div>'+
    '<div class="f2" style="max-width:160px"><label>Data de movimentação</label>'+
     '<input type="date" id="mvD" value="'+(_movData||hojeISO())+'"></div>'+
    '<div class="f2" style="max-width:110px"><label>Hora</label>'+
     '<input type="time" id="mvH" value="'+(_movHora||agoraHM())+'"></div>'+
    /* ==========================================================
       O ATALHO DE CADASTRAR MOTIVO ESTAVA COMBINADO E NAO EXISTIA (V204)

       O DECISOES.md registra, desde a V10.4.1: "O atalho na baixa manual
       diz (cadastrar em Configuração da Loja)". A funcao que faz isso —
       `cadastrarMotivoBaixa()` — estava escrita, fecha a janela e abre a
       configuracao certa. O estilo do link — `.incNovo`, azul, negrito,
       sublinha ao passar — tambem estava na folha.

       Faltava so o elemento entre os dois. Sem ele, quem precisava de um
       motivo novo tinha de sair da baixa, procurar a tela, e voltar
       perdendo o que ja tinha digitado.

       Botao, e nao ancora: a suite E2E varre o TEXTO do arquivo atras
       de ancora vazia, e reprova ate quando ela aparece dentro de um
       comentario — foi o que esta versao deste comentario causou.
       ========================================================== */
    '<div class="f2"><label>Motivo da baixa *</label>'+
     '<select id="mvM" onchange="mudouMotivo(this)">'+
     motivosBaixa().map(function(m){
       return '<option value="'+m.id+'"'+(_movMotivo===m.id?' selected':'')+'>'+E(m.nome)+'</option>'}).join('')+
     '</select>'+
     '<button type="button" class="incNovo" style="border:0;background:none;padding:4px 0 0" '+
      'onclick="cadastrarMotivoBaixa()">cadastrar em Configuração da Loja</button>'+
    '</div>'+
   '</div>'+
   '<div class="mvItens">'+
    '<table class="mvItTab"><thead><tr>'+
     '<th>Item de estoque</th>'+
     '<th style="width:118px">Unidade</th>'+
     '<th style="width:96px;text-align:right">Qtd.</th>'+
     '<th style="width:104px;text-align:right">Custo médio</th>'+
     '<th style="width:110px;text-align:right">Valor total</th>'+
     '<th style="width:220px">Observação</th>'+
     '<th style="width:50px;text-align:center">Ações</th></tr></thead><tbody>'+
    _movItens.map(function(it,k){
      var base=it.tipo==='insumo'?insumo(it.refId):null;
      var f=it.tipo==='ficha'?(DB.fichas||[]).find(function(x){return x.id===it.refId}):null;
      var uBase=base?un(base.unidade).base:(f?un(f.rendUnidade||f.unidade).base:null);
      var alvo=it.refId?itemEstoque(it.refId):null;
      return '<tr>'+
      '<td><button class="selItem'+(it.refId?' ok3':'')+'" data-pop="1" onclick="abrirPickItem(event,'+k+')">'+
       '<span>'+(it.refId?E(nomeItem(it)):'Selecione...')+'</span>'+sv('dn',12)+'</button>'+
       (alvo?'<div class="destInfo">'+sv('box',11)+' em estoque: <b>'+
         fmtQt(Number(alvo.estoqueAtual)||0)+' '+un(alvo.unidade).ab+'</b></div>':'')+'</td>'+
      '<td><select class="mvUn" data-k="'+k+'">'+
       (uBase?unidades().filter(function(u){return u.base===uBase}).map(function(u){
         return '<option value="'+u.id+'"'+(it.unidade===u.id?' selected':'')+'>'+u.n+'</option>'}).join('')
        :'<option value="">—</option>')+
      '</select></td>'+
      '<td><input class="mvQt" data-k="'+k+'" type="number" step="0.0001" value="'+(it.qtd||'')+'"></td>'+
      '<td class="mvCuFix">'+money(it.custo)+'</td>'+
      '<td class="mvTot">'+money((Number(it.qtd)||0)*(Number(it.custo)||0))+'</td>'+
      '<td><input class="mvOb" data-k="'+k+'" value="'+E(it.obs||'')+'" placeholder="observação desta linha"></td>'+
      '<td style="text-align:center"><button class="xDel" onclick="remLinhaMov('+k+')">'+sv('trash',10)+'</button></td>'+
      '</tr>';
    }).join('')+'</tbody>'+
    '<tfoot><tr><td colspan="4"><b>Total da baixa</b></td>'+
    '<td class="mvTot"><b>'+money(total)+'</b></td><td colspan="2"></td></tr></tfoot></table>'+
    '<button class="btnMais peq" onclick="addLinhaMov()">'+sv('plus',16)+'</button>'+
   '</div>'+
   '<div class="mvF"><button class="btnP2" onclick="fecharMov()">Cancelar</button>'+
    '<button class="btnP2 ok" onclick="salvarMovimento()">Salvar</button></div>'+
  '</div>';

  var o=document.getElementById('mdOv');if(o)o.remove();
  var ov=document.createElement('div');ov.className='mdOv mvOv';ov.id='mdOv';
  ov.innerHTML=h;
  document.body.appendChild(ov);
  ligarLinhasMov();
}
var _movMotivo='',_movIdent='',_movObs='',_movData='',_movHora='';
/* sair da baixa e ir direto cadastrar um motivo novo */
function cadastrarMotivoBaixa(){
  fecharMov();
  abrir('loja','cfg-movimentacao');
}
function guardarCabMov(){
  if($('mvM'))_movMotivo=$('mvM').value;
  if($('mvI'))_movIdent=$('mvI').value;
  if($('mvD'))_movData=$('mvD').value;
  if($('mvH'))_movHora=$('mvH').value;
}
function mudouMotivo(sel){
  _movMotivo=sel.value;
  guardarCabMov();
  desenhaMovimento();
}
function ligarLinhasMov(){
  function liga(cls,campo){
    var e2=document.querySelectorAll(cls);
    for(var j=0;j<e2.length;j++){
      e2[j].oninput=function(){
        _movItens[this.getAttribute('data-k')][campo]=(campo==='unidade')?this.value:(parseFloat(this.value)||0);
        atualizaTotaisMov();
      };
      e2[j].onchange=function(){
        _movItens[this.getAttribute('data-k')][campo]=(campo==='unidade')?this.value:(parseFloat(this.value)||0);
        atualizaTotaisMov();
      };
    }
  }
  liga('.mvQt','qtd');
  /* observacao por linha: texto puro e sem redesenhar, senao o campo perde o foco */
  var obs=document.querySelectorAll('.mvOb');
  for(var y=0;y<obs.length;y++){
    obs[y].oninput=obs[y].onchange=function(){
      _movItens[this.getAttribute('data-k')].obs=this.value;
    };
  }
  var us=document.querySelectorAll('.mvUn');
  for(var z=0;z<us.length;z++)us[z].onchange=function(){
    var k=this.getAttribute('data-k');
    var qGuardada=_movItens[k].qtd;         /* trocar unidade nao mexe na quantidade digitada */
    _movItens[k].unidade=this.value;
    var alvo=itemEstoque(_movItens[k].refId);
    if(alvo)_movItens[k].custo=(alvo.itens!==undefined&&alvo.rendimento!==undefined)
      ?custoDoItem(alvo):custoNaUnidade(alvo,this.value);
    _movItens[k].qtd=qGuardada;
    guardarCabMov();desenhaMovimento();
  };
}
function atualizaTotaisMov(){
  var tds=document.querySelectorAll('.mvItTab tbody tr');
  var total=0;
  _movItens.forEach(function(it,k){
    var v=(Number(it.qtd)||0)*(Number(it.custo)||0);
    total+=v;
  });
  var cels=document.querySelectorAll('.mvItTab tbody .mvTot');
  var idx=0;
  _movItens.forEach(function(it){
    if(cels[idx])cels[idx].textContent=money((Number(it.qtd)||0)*(Number(it.custo)||0));
    idx++;
  });
  var f=document.querySelector('.mvItTab tfoot .mvTot');
  if(f)f.innerHTML='<b>'+money(total)+'</b>';
}
function abrirPickItem(ev,k){
  ev.stopPropagation();
  guardarCabMov();
  _pickLinha=k;
  _pickAbertas=_pickAbertas||{};
  pop(ev,montaPickItem());
  var b=document.getElementById('pkBusca');
  if(b){b.oninput=function(){_pickBusca=this.value;
    var box=document.querySelector('.popMenu');
    if(box){box.innerHTML=montaPickItem();
      var n2=document.getElementById('pkBusca');
      if(n2){n2.value=_pickBusca;n2.focus();}
    }
  };setTimeout(function(){b.focus()},40);}
}
var _pickLinha=0,_pickAbertas={},_pickBusca='';
function montaPickItem(){
  var q=(_pickBusca||'').toLowerCase();
  function filtra(nome){return !q||String(nome||'').toLowerCase().indexOf(q)>=0}
  var h='<div class="pkBox">'+
   '<div class="pkTopo"><input id="pkBusca" placeholder="localizar item..." value="'+E(_pickBusca)+'"></div>'+
   '<div class="pkLista">';

  /* pastas dos ingredientes */
  (DB.gruposIng||[]).forEach(function(g){
    var itens=(DB.insumos||[]).filter(function(i){
        return i.grupoId===g.id&&i.controlaEstoque!==false&&filtra(i.nome)})
      .sort(function(a,b){return a.nome.localeCompare(b.nome)});
    if(q&&!itens.length)return;
    var ab=!!_pickAbertas['g'+g.id]||!!q;
    h+='<div class="pkGrp">'+
     '<div class="pkPasta" onclick="event.stopPropagation();togglePick(\'g'+g.id+'\')">'+
      '<span class="ftSeta'+(ab?' ab':'')+'">'+sv('tri',9)+'</span>'+
      sv(ab?'folderOpen':'folder',13)+' <span class="pkNm">'+E(g.nome)+'</span>'+
      '<span class="pkQt">'+itens.length+'</span></div>'+
     (ab?'<div class="pkFilhos">'+(itens.length?itens.map(function(i){
       return '<div class="pkIt2" onclick="escolherItemMov(\'insumo\',\''+i.id+'\')">'+
       sv('file2',11)+' <span class="pkNm">'+E(i.nome)+'</span>'+
       '<span class="pkUn">'+un(i.unidade).ab+'</span></div>';
     }).join(''):'<div class="pkVaz">sem itens</div>')+'</div>':'')+
    '</div>';
  });
  /* itens sem grupo */
  var soltos=(DB.insumos||[]).filter(function(i){
    return !grupoIng(i.grupoId)&&i.controlaEstoque!==false&&filtra(i.nome)});
  if(soltos.length){
    var ab2=!!_pickAbertas['gsem']||!!q;
    h+='<div class="pkGrp"><div class="pkPasta" onclick="event.stopPropagation();togglePick(\'gsem\')">'+
     '<span class="ftSeta'+(ab2?' ab':'')+'">'+sv('tri',9)+'</span>'+sv(ab2?'folderOpen':'folder',13)+
     ' <span class="pkNm">Sem grupo</span><span class="pkQt">'+soltos.length+'</span></div>'+
     (ab2?'<div class="pkFilhos">'+soltos.map(function(i){
       return '<div class="pkIt2" onclick="escolherItemMov(\'insumo\',\''+i.id+'\')">'+
       sv('file2',11)+' <span class="pkNm">'+E(i.nome)+'</span>'+
       '<span class="pkUn">'+un(i.unidade).ab+'</span></div>';}).join('')+'</div>':'')+
    '</div>';
  }
  /* pastas das fichas técnicas */
  h+='<div class="pkSep">Fichas técnicas estocáveis</div>';
  var semGrupo=(DB.fichas||[]).filter(function(f){
    return !catFicha(f.categoriaId)&&f.estocavel!==false&&filtra(f.nome);});
  if(semGrupo.length){
    h+='<div class="pkGrp"><div class="pkPasta" onclick="event.stopPropagation();togglePick(\'fsem\')">'+
     '<span class="ftSeta'+(_pickAbertas['fsem']||q?' ab':'')+'">'+sv('tri',9)+'</span>'+
     sv('folder',13)+' <span class="pkNm">Sem grupo</span><span class="pkQt">'+semGrupo.length+'</span></div>'+
     ((_pickAbertas['fsem']||q)?'<div class="pkFilhos">'+semGrupo.map(function(f){
       return '<div class="pkIt2" onclick="escolherItemMov(\'ficha\',\''+f.id+'\')">'+
       sv('book',11)+' <span class="pkNm">'+E(f.nome)+'</span>'+
       '<span class="pkUn">'+un(f.rendUnidade||f.unidade).ab+'</span></div>';}).join('')+'</div>':'')+
    '</div>';
  }
  gruposFicha().forEach(function(c){
    var fs2=(DB.fichas||[]).filter(function(f){
        return f.categoriaId===c.id&&f.estocavel!==false&&filtra(f.nome)})
      .sort(function(a,b){return a.nome.localeCompare(b.nome)});
    if(q&&!fs2.length)return;
    var ab3=!!_pickAbertas['f'+c.id]||!!q;
    h+='<div class="pkGrp">'+
     '<div class="pkPasta" onclick="event.stopPropagation();togglePick(\'f'+c.id+'\')">'+
      '<span class="ftSeta'+(ab3?' ab':'')+'">'+sv('tri',9)+'</span>'+
      sv(ab3?'folderOpen':'folder',13)+' <span class="pkNm">'+E(c.nome)+'</span>'+
      '<span class="pkQt">'+fs2.length+'</span></div>'+
     (ab3?'<div class="pkFilhos">'+(fs2.length?fs2.map(function(f){
       return '<div class="pkIt2" onclick="escolherItemMov(\'ficha\',\''+f.id+'\')">'+
       sv('book',11)+' <span class="pkNm">'+E(f.nome)+'</span>'+
       '<span class="pkUn">'+un(f.rendUnidade||f.unidade).ab+'</span></div>';
     }).join(''):'<div class="pkVaz">sem fichas</div>')+'</div>':'')+
    '</div>';
  });
  h+='</div></div>';
  return h;
}
function togglePick(k){
  _pickAbertas[k]=!_pickAbertas[k];
  var box=document.querySelector('.popMenu');
  if(box){box.innerHTML=montaPickItem();
    var b=document.getElementById('pkBusca');
    if(b){b.value=_pickBusca;
      b.oninput=function(){_pickBusca=this.value;togglePick('__');};}
  }
}
function escolherItemMov(tipo,id){
  var it=_movItens[_pickLinha];
  it.tipo=tipo;it.refId=id;
  if(it.obs===undefined)it.obs='';
  if(tipo==='insumo'){
    var i=insumo(id);
    it.unidade=i?i.unidade:'';it.custo=i?custoNaUnidade(i,i.unidade):0;
  }else{
    var f=(DB.fichas||[]).find(function(x){return x.id===id});
    it.unidade=f?(f.rendUnidade||f.unidade):'';it.custo=f?custoDoItem(f):0;
  }
  _pickBusca='';
  fecharPops();
  desenhaMovimento();
}
function addLinhaMov(){guardarCabMov();_movItens.push({tipo:'',refId:'',unidade:'',qtd:0,custo:0,obs:''});desenhaMovimento();}
function remLinhaMov(k){guardarCabMov();_movItens.splice(k,1);if(!_movItens.length)_movItens.push({tipo:'',refId:'',unidade:'',qtd:0,custo:0,obs:''});desenhaMovimento();}
function fecharMov(){
  var o=document.getElementById('mdOv');if(o)o.remove();
  _movMotivo='';_movIdent='';_movObs='';_movData='';_movHora='';
  telaMovimentacao();
}
async function salvarMovimento(){
  guardarCabMov();
  if(!_movMotivo){toast('Selecione o motivo da movimentação.');return;}
  var itens=_movItens.filter(function(it){return it.tipo&&it.refId&&(Number(it.qtd)||0)>0});
  if(!itens.length){toast('Informe ao menos um item com quantidade.');return;}
  /* esta tela so faz baixa: o motivo tem de ser do tipo Saida */
  if(tipoMotivo(_movMotivo)!=='saida'){
    alert('"'+nomeMotivo(_movMotivo)+'" nao e um motivo de saida.\n\n'+
      'Esta tela so registra baixa manual. Para entrada use a nota de entrada, '+
      'para produzir use a ordem de producao e para acertar saldo use a contagem de estoque.');
    return;
  }
  var tipo='saida';
  var linhas=montarLinhas(itens,tipo);
  if(!linhas.length){toast('Nada a baixar — verifique se os itens controlam estoque.');return;}
  var falta=faltaEstoque(linhas);
  if(falta.length){alert(avisoFalta(falta,'esta baixa'));return;}
  var ok=await confirmar({
    titulo:'Confirmar a baixa',
    texto:linhas.length+' item(ns) sairão do estoque por "'+nomeMotivo(_movMotivo)+'".',
    aviso:linhas.map(function(l){
      return '&minus; '+fmtQt(l.qtd)+' '+un(l.unidade).ab+' de <b>'+E(l.nome)+'</b>'+
        (l.obs?' <i>('+E(l.obs)+')</i>':'');}).join('<br>'),
    ok:'Dar baixa',tipo:'perigo'});
  if(!ok)return;
  var mov={id:uid('mv'),data:$('mvD').value||hojeISO(),hora:$('mvH').value||agoraHM(),
    motivoId:_movMotivo,identificacao:_movIdent,obs:'',
    itens:JSON.parse(JSON.stringify(itens)),linhas:linhas,origem:'manual'};
  DB.movEst.push(mov);
  aplicarMovimento(mov);
  salvar();
  fecharMov();
  toast('Baixa registrada — '+linhas.length+' item(ns).');
}

/* devolve ao estoque o que a venda tinha baixado */
function estornarEstoqueVenda(ped){
  baseMov();
  var movs=(DB.movEst||[]).filter(function(m){return m.pedidoId===ped.id&&m.origem==='venda'});
  if(!movs.length)return 0;
  movs.forEach(function(m){aplicarMovimento(m,true)});
  DB.movEst=(DB.movEst||[]).filter(function(m){return !(m.pedidoId===ped.id&&m.origem==='venda')});
  return movs.length;
}

/* ---------- BAIXA AUTOMÁTICA PELA VENDA ---------- */
function baixarEstoqueVenda(ped){
  baseMov();
  var linhas=[];
  /* ==========================================================
     A OPCAO ESCOLHIDA TAMBEM SAI DO ESTOQUE

     A baixa olhava so o produto. A borda de Nutella, a cobertura e o
     Ovomaltine sumiam do pote e nao sumiam do sistema — perda invisivel,
     que so aparecia na contagem, sem ninguem saber de onde vinha.
     Agora cada opcao com ficha ligada baixa o que ela consome, na
     quantidade do item.
     ========================================================== */
  function baixarOpcoes(it,q){
    (it.opcoes||[]).forEach(function(o){
      var fid=o.fichaId||o.ficha_id;
      if(!fid){
        /* opcao antiga, sem vinculo gravado: tenta pelo nome */
        var achou=(DB.fichas||[]).find(function(f){
          return String(f.nome||'').trim().toLowerCase()===String(o.nome||'').trim().toLowerCase();});
        if(!achou)return;
        fid=achou.id;
      }
      var f=(DB.fichas||[]).find(function(x){return x.id===fid});
      if(!f)return;
      /* ==========================================================
         SABOR DE GELATO NAO SE DESCONTA DUAS VEZES

         AQUI ESTAVA A BASE SAINDO NA VENDA.

         Pedido #735, 31/08/2026: um Gelato 500gr com sabor Belga e
         Morango. Saiu, certo, GELATO VENDA 500 g pela receita do
         produto. E saiu, errado, BASE BELGA 0,2083 un e BASE MORANGO
         0,2175 un — porque este trecho abria a RECEITA da ficha do
         sabor, como se o gelato estivesse sendo produzido na hora da
         venda.

         A base ja tinha sido consumida na producao, quando virou
         gelato. Descontar de novo na venda e contar duas vezes.

         A regra da casa, dita pelo Rafael: toda base produzida vira
         gelato de venda, e a loja SO vende gelato de venda. Nao se
         desconta base nem sabor. Vale igual para a massa de cascao, que
         vira cascao pronto na producao.

         Como o sistema sabe a diferenca: a ficha que TEM DESTINO e algo
         que a producao ja transformou e ja entregou no estoque como o
         item de destino — o produto vendido consome esse item pela
         propria receita dele. A ficha SEM destino e o extra que so
         existe no momento da venda (borda de Nutella, cobertura,
         Ovomaltine): essa continua abrindo a receita, que foi o motivo
         de este trecho existir.

         O caminho do PRODUTO, logo abaixo, ja respeitava o destino. Era
         so este, o das opcoes, que nao respeitava.
         ========================================================== */
      if(destinoDaFicha(f))return;
      var porUn=(Number(f.unidadesVenda)||Number(f.rendimento)||1);
      var fator=(Number(o.qtd)||1)*q/porUn;
      (f.itens||[]).forEach(function(ci){
        var i3=insumo(ci.insumoId);
        if(!i3)return;
        var uL=ci.unidade||i3.unidade;
        linhas.push({insumoId:i3.id,nome:i3.nome,unidade:uL,
          qtd:+((Number(ci.qtd)||0)*fator).toFixed(4),
          custo:custoNaUnidade(i3,uL),direcao:'saida',origem:'venda',fichaNome:f.nome});
      });
    });
  }
  (ped.itens||[]).forEach(function(it){
    baixarOpcoes(it,Number(it.qtd)||1);
    var p=(DB.produtos||[]).find(function(x){return x.id===it.produtoId});
    if(!p||!p.vinculaEstoque)return;
    var q=Number(it.qtd)||1;
    if(p.insumoId){
      var ins=insumo(p.insumoId);
      if(!ins)return;
      var qq=(Number(p.insumoQtd)||1)*q;
      var uL=p.insumoUn||ins.unidade;
      linhas.push({insumoId:ins.id,nome:ins.nome,unidade:uL,qtd:+qq.toFixed(4),
        custo:custoNaUnidade(ins,uL),direcao:'saida',origem:'venda'});
    }else if(p.fichaId){
      var f=(DB.fichas||[]).find(function(x){return x.id===p.fichaId});
      if(!f)return;
      var dest=destinoDaFicha(f);
      var porUn=(Number(f.unidadesVenda)||Number(f.rendimento)||1);
      if(dest){
        /* o produto pronto sai do estoque do destino (ex.: Gelato Venda) */
        var qd=(Number(f.rendimento)||1)/porUn*q;
        linhas.push({insumoId:dest.id,nome:dest.nome,unidade:f.rendUnidade||f.unidade,
          qtd:+qd.toFixed(4),custo:custoPorUnidade(f),direcao:'saida',origem:'venda',fichaNome:f.nome});
      }else{
        /* sem destino: baixa os ingredientes da receita */
        var fator=q/porUn;
        (f.itens||[]).forEach(function(ci){
          var i2=insumo(ci.insumoId);
          if(!i2)return;
          var qc=(Number(ci.qtd)||0)*fator;
          linhas.push({insumoId:i2.id,nome:i2.nome,unidade:ci.unidade,qtd:+qc.toFixed(4),
            custo:custoNaUnidade(i2,ci.unidade),direcao:'saida',origem:'venda',
            fichaId:f.id,fichaNome:f.nome});
        });
      }
    }
  });
  /* ==========================================================
     A BAIXA SAI NA UNIDADE DO ITEM — NUNCA EM GRAMA CONTRA UM SALDO EM QUILO

     AQUI ESTAVA O SALDO DE ESTOQUE INDO PARA CENTENAS DE QUILOS NEGATIVOS.

     31/08/2026, GELATO VENDA (Santa Fé): a ficha rende em GRAMA, então cada
     venda gerava uma linha tipo `qtd:242, unidade:'g'`. O item, porém, é
     guardado em QUILO. O caminho LOCAL (ajustaEstoque → convUnid) convertia
     e descontava 0,242 kg, certo. Mas a venda também sobe pelo pacote
     atômico (rpc/venda_registrar → estoque_aplicar), e ali o banco faz
     `estoque = estoque + qtd` SEM converter: descontava 242 kg por bola de
     sorvete. Mil vezes a mais.

     Os dois lados brigavam pelo saldo da nuvem — o delta errado do banco e o
     absoluto certo do aparelho — e o download adotava o mais recente. Bastava
     um dia de venda para o saldo despencar (medido: −779 kg onde o certo eram
     ~73 kg).

     Correção na PORTA ÚNICA da venda: antes de virar movimento, cada linha é
     normalizada para a unidade-base do próprio item. Assim o que o aparelho
     guarda, o que sobe no pacote e o delta que o banco aplica são a MESMA
     quantidade, na MESMA unidade. Unidade incompatível (sem base comum) é
     mantida como está — melhor não converter do que converter errado. */
  linhas=linhas.map(function(l){
    var ins=itemEstoque(l.insumoId);
    if(!ins||!ins.unidade||!l.unidade||l.unidade===ins.unidade)return l;
    var q=convUnid(Number(l.qtd)||0,l.unidade,ins.unidade);
    if(q===null)return l;                 /* sem base comum: não arrisca */
    return Object.assign({},l,{qtd:+q.toFixed(4),unidade:ins.unidade,
      custo:custoNaUnidade(ins,ins.unidade)});
  });
  if(!linhas.length){
    var semVinc=(ped.itens||[]).filter(function(it){
      var p2=(DB.produtos||[]).find(function(x){return x.id===it.produtoId});
      return !p2||!p2.vinculaEstoque||(!p2.fichaId&&!p2.insumoId);
    });
    if(semVinc.length)
      toast(semVinc.length+' produto(s) sem ficha técnica vinculada — o estoque não baixou.');
    return 0;
  }
  var mov={id:uid('mv'),data:diaLocal(ped.data)||hojeISO(),hora:ped.hora||agoraHM(),
    motivoId:'mv_venda',identificacao:'Pedido #'+ped.numero,
    obs:ped.clienteNome||'',linhas:linhas,origem:'venda',pedidoId:ped.id};
  DB.movEst.push(mov);
  aplicarMovimento(mov);
  _ultimoMovVenda=mov;      /* a venda atomica precisa subir este junto */
  return linhas.length;
}

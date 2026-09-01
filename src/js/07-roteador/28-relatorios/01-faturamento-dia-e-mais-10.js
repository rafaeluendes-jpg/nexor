/* ==========================================================
   BLOCO 28 — RELATÓRIOS
   ========================================================== */
var DIAS_SEM=['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
function diaSemana(d){ return new Date(String(d)+'T12:00:00').getDay(); }
/* ==========================================================
   O SELETOR DE CANAIS TINHA UMA LISTA PARALELA

   Esta funcao montava a lista de canais somando tres nomes fixos
   ("Frente de caixa", "Entrega", "Retirada") com TODO valor cru que
   aparecesse em `pedido.canal`. O seletor de cinco relatorios —
   Faturamento por Dia, Itens Vendidos, Vendas por Area, Vendas por
   Forma de Pagamento e Vendas por Periodo — mostrava, um embaixo do
   outro: "Frente de caixa", "Entrega", "Retirada", "pdv", "cardapio".
   Nomes de banco de dados na tela, e a mesma venda em duas opcoes.

   Pior: o filtro comparava `p.canal||p.tipo`, e o resto do sistema
   compara `canalDoPedido(p)`. Marcar "Entrega" aqui nao trazia a mesma
   venda que "Delivery" trazia na tela de Canais de Venda.

   Agora estes cinco relatorios usam a mesma lista e a mesma regra dos
   outros: CANAIS_REL e canalDoPedido.
   ========================================================== */
function canaisVenda(){
  var s={};
  CANAIS_REL.forEach(function(c){s[c.id]=c.n});
  return s;
}
/* ==========================================================
   A TRAVA DE UNIDADE VALIA SO PARA METADE DOS RELATORIOS

   `pedsPeriodo` corta pela unidade aberta desde a V-do-tenant, e o
   comentario dela diz que o corte "nao pode depender de o painel
   lembrar de filtrar". Mas os cinco relatorios que passam por AQUI
   nunca tiveram esse corte: quem estava com Santa Fe aberta via, no
   Faturamento por Dia, a venda de Jales somada a sua.

   Passa pela mesma porta agora. A matriz continua vendo a rede toda.
   O pedido cancelado NAO e cortado aqui de proposito: o Faturamento
   por Dia mostra uma coluna de cancelamentos e precisa dele.
   ========================================================== */
function pedidosFiltrados(f){
  return (DB.pedidos||[]).filter(function(p){
    if(!vendaDaUnidadeAberta(p))return false;
    var d=diaLocal(p.data);
    if(f.de&&d<f.de)return false;
    if(f.ate&&d>f.ate)return false;
    if(f.canais&&f.canais.length&&f.canais.indexOf(canalDoPedido(p))<0)return false;
    if(f.dias&&f.dias.length&&f.dias.indexOf(diaSemana(d))<0)return false;
    return true;
  });
}
/* painel de explicação padrão de todos os relatórios */
function explicaRel(titulo,linhas,fontes,fora){
  var h='<div class="mdB"><div class="blk" style="margin:0;max-width:none">'+
  '<h3>De onde vem cada número</h3>'+
  '<div class="expList">'+linhas.map(function(l){
    return '<div class="expIt"><b>'+E(l[0])+'</b><span>'+E(l[1])+'</span></div>';}).join('')+'</div>'+
  '<div class="hint" style="margin-top:14px;line-height:1.7">'+
   '<b>Fontes:</b> '+fontes+'<br><br><b>O que não entra:</b> '+fora+'</div></div></div>';
  var o=document.createElement('div');o.className='mdOv';o.id='mdOv';
  o.innerHTML='<div class="mdBox lg"><div class="mdH"><b>'+E(titulo)+'</b>'+
   '<button onclick="fecharModal()">&times;</button></div>'+h+
   '<div class="mdF"><button class="btnP2" onclick="fecharModal()">Fechar</button></div></div>';
  document.body.appendChild(o);
  fecharSoForaDeVerdade(o);
}
/* ==========================================================
   baixarCSV(NOME, LINHAS) — nesta ordem

   Quatro botoes de exportar chamavam com os argumentos trocados. Dentro
   da funcao, `linhas` recebia o texto do nome do arquivo e `linhas.map`
   nao existe: o clique estourava e nada era baixado. Nao dava aviso
   nenhum na tela — so um erro no console, que ninguem abre no balcao.

   Eram: Vendas por Mesa, Cancelamentos, Cupons Gerados e o "Baixar
   modelo" da tela de importacao. Os outros oito exportadores do sistema
   sempre chamaram na ordem certa; estes quatro nasceram trocados.
   ========================================================== */
function baixarCSV(nome,linhas){
  var csv=linhas.map(function(r){return r.map(function(c){
    return '"'+String(c).replace(/"/g,'""')+'"'}).join(';')}).join('\n');
  var b=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'});
  var a=document.createElement('a');a.href=URL.createObjectURL(b);
  a.download=nome;document.body.appendChild(a);a.click();
  setTimeout(function(){a.remove()},400);
  toast('Relatório exportado.');
}

/* ==========================================================
   1 — FATURAMENTO POR DIA
   ========================================================== */
var FD={de:'',ate:'',canais:[],dias:[]};
function telaFaturamentoDia(){
  baseMov();
  if(!FD.de){var d=new Date();
    FD.de=new Date(d.getFullYear(),d.getMonth(),1).toISOString().slice(0,10);
    FD.ate=hojeISO();}
  var peds=pedidosFiltrados(FD);
  var porDia={};
  peds.forEach(function(p){
    var d=diaLocal(p.data);
    porDia[d]=porDia[d]||{qtd:0,valor:0,itens:0,taxa:0,desc:0,acresc:0,canc:0,vcanc:0};
    var x=porDia[d];
    if(ehCancelado(p)){x.canc++;x.vcanc+=Number(p.total)||0;return;}
    x.qtd++; x.valor+=Number(p.total)||0;
    x.itens+=(p.itens||[]).reduce(function(a,i){return a+(Number(i.qtd)||0)},0);
    x.taxa+=Number(p.taxa)||0; x.desc+=Number(p.desconto)||0;
    x.acresc+=Number(p.acrescimo)||0;
  });
  var dias=Object.keys(porDia).sort();
  var acum=0;
  var linhas=dias.map(function(d){
    var x=porDia[d];
    acum+=x.valor;
    return {data:d,ds:DIAS_SEM[diaSemana(d)],qtd:x.qtd,valor:x.valor,acum:acum,
      ticket:x.qtd?x.valor/x.qtd:0,itens:x.itens,taxa:x.taxa,desc:x.desc,
      acresc:x.acresc,canc:x.canc,vcanc:x.vcanc};
  });
  var t={qtd:0,valor:0,itens:0,taxa:0,desc:0,acresc:0,canc:0,vcanc:0};
  linhas.forEach(function(l){for(var k in t)t[k]+=l[k]||0;});

  var canais=canaisVenda();
  $('content').innerHTML='<div class="etWrap"><div class="etScroll">'+
   '<div class="etTopo">'+
    '<div><h1>Faturamento por Dia</h1><p>Vendas dia a dia, com acumulado e ticket médio.</p></div>'+
    '<button class="infoBt" onclick="explicaFaturamentoDia()">'+sv('help',15)+'</button>'+
    '<div style="flex:1"></div>'+
    '<button class="btnP2" onclick="imprimirRel(\'Faturamento por Dia\')">'+sv('print2',13)+' PDF</button>'+
    '<button class="btnP2" onclick="exportarFatDia()">'+sv('down2',13)+' Exportar</button>'+
   '</div>'+
   '<div class="barraF">'+
    '<div class="bfCampo"><label>De</label><input type="date" id="fdDe" value="'+FD.de+'"></div>'+
    '<div class="bfCampo"><label>Até</label><input type="date" id="fdAte" value="'+FD.ate+'"></div>'+
    selMulti('fdCanal','Canal',
      Object.keys(canais).map(function(k){return {id:k,nome:canais[k]}}),
      FD.canais,'togFD','togTodosFD(\'canais\')')+
    selMulti('fdDia','Dia da semana',
      DIAS_SEM.map(function(d,i){return {id:String(i),nome:d}}),
      FD.dias.map(String),'togFDdia','togTodosFD(\'dias\')')+
    '<button class="btnP2 ok" onclick="FD.de=$(\'fdDe\').value;FD.ate=$(\'fdAte\').value;telaFaturamentoDia()">'+
     sv('search',13)+' Buscar</button>'+
    '<div class="bfAtalhos">'+
     '<button onclick="perFD(0)">Mês</button>'+
     '<button onclick="perFD(-1)">Anterior</button>'+
     '<button onclick="perFD(7)">7d</button>'+
     '<button onclick="perFD(30)">30d</button>'+
     (FD.canais.length||FD.dias.length?'<button class="lim" onclick="limparFD()">limpar</button>':'')+
    '</div>'+
   '</div>'+
   '<div class="relKpis">'+
    '<div class="rk"><span>Vendas</span><b>'+t.qtd+'</b></div>'+
    '<div class="rk dest"><span>Faturamento</span><b>R$ '+money(t.valor)+'</b></div>'+
    '<div class="rk"><span>Ticket médio</span><b>R$ '+money(t.qtd?t.valor/t.qtd:0)+'</b></div>'+
    '<div class="rk"><span>Itens</span><b>'+fmtQt(t.itens)+'</b></div>'+
    '<div class="rk"><span>Taxa de entrega</span><b>R$ '+money(t.taxa)+'</b></div>'+
    '<div class="rk"><span>Descontos</span><b class="vr">R$ '+money(t.desc)+'</b></div>'+
    '<div class="rk"><span>Canceladas</span><b class="'+(t.canc?'vr':'')+'">'+t.canc+' · R$ '+money(t.vcanc)+'</b></div>'+
   '</div>'+
   '<div class="etTabW plano2" id="relArea">'+
   (linhas.length?'<table class="etTab semBusca"><thead><tr>'+
    '<th style="width:100px">Data</th><th style="width:90px">Dia</th>'+
    '<th style="width:80px;text-align:right">Vendas</th>'+
    '<th style="width:120px;text-align:right">Valor</th>'+
    '<th style="width:130px;text-align:right">Acumulado</th>'+
    '<th style="width:110px;text-align:right">Ticket médio</th>'+
    '<th style="width:90px;text-align:right">Itens</th>'+
    '<th style="width:110px;text-align:right">Taxa entrega</th>'+
    '<th style="width:100px;text-align:right">Acréscimos</th>'+
    '<th style="width:100px;text-align:right">Descontos</th>'+
    '<th style="width:90px;text-align:right">Canc.</th>'+
    '<th style="width:110px;text-align:right">Valor canc.</th></tr></thead><tbody>'+
    linhas.map(function(l){
      return '<tr><td><b>'+dataBR(l.data)+'</b></td><td>'+l.ds+'</td>'+
      '<td style="text-align:right">'+l.qtd+'</td>'+
      '<td style="text-align:right"><b>R$ '+money(l.valor)+'</b></td>'+
      '<td style="text-align:right;color:var(--ink-3)">R$ '+money(l.acum)+'</td>'+
      '<td style="text-align:right">R$ '+money(l.ticket)+'</td>'+
      '<td style="text-align:right">'+fmtQt(l.itens)+'</td>'+
      '<td style="text-align:right">'+(l.taxa?'R$ '+money(l.taxa):'—')+'</td>'+
      '<td style="text-align:right">'+(l.acresc?'R$ '+money(l.acresc):'—')+'</td>'+
      '<td style="text-align:right" class="'+(l.desc?'vr':'')+'">'+(l.desc?'R$ '+money(l.desc):'—')+'</td>'+
      '<td style="text-align:right" class="'+(l.canc?'vr':'')+'">'+(l.canc||'—')+'</td>'+
      '<td style="text-align:right" class="'+(l.vcanc?'vr':'')+'">'+(l.vcanc?'R$ '+money(l.vcanc):'—')+'</td></tr>';
    }).join('')+'</tbody>'+
    '<tfoot><tr><td colspan="2"><b>Total — '+linhas.length+' dia(s)</b></td>'+
    '<td style="text-align:right"><b>'+t.qtd+'</b></td>'+
    '<td style="text-align:right"><b>R$ '+money(t.valor)+'</b></td><td></td>'+
    '<td style="text-align:right"><b>R$ '+money(t.qtd?t.valor/t.qtd:0)+'</b></td>'+
    '<td style="text-align:right"><b>'+fmtQt(t.itens)+'</b></td>'+
    '<td style="text-align:right"><b>R$ '+money(t.taxa)+'</b></td>'+
    '<td style="text-align:right"><b>R$ '+money(t.acresc)+'</b></td>'+
    '<td style="text-align:right"><b>R$ '+money(t.desc)+'</b></td>'+
    '<td style="text-align:right"><b>'+t.canc+'</b></td>'+
    '<td style="text-align:right"><b>R$ '+money(t.vcanc)+'</b></td></tr></tfoot></table>'
   :'<div class="mvVazio">'+sv('box',26)+'<b>Nenhuma venda no período</b>'+
    '<span>Ajuste as datas ou os filtros.</span></div>')+
   '</div></div></div>';
  rodape(linhas.length+' dias · R$ '+money(t.valor));
}
/* seletor múltiplo compacto: um botão que abre a lista em menu */
function selMulti(id,rotulo,itens,arr,onTog,onTodos){
  var n=arr.length;
  var txt=!n?'Todos':(n===1
    ?((itens.find(function(x){return String(x.id)===String(arr[0])})||{}).nome||'1 selecionado')
    :n+' selecionados');
  return '<div class="smWrap">'+
   '<label>'+E(rotulo)+'</label>'+
   '<button class="smBt'+(n?' on':'')+'" onclick="abreSelMulti(event,\''+id+'\')">'+
    '<span>'+E(txt)+'</span>'+sv('dn',12)+'</button>'+
   '<div class="smPop" id="sm-'+id+'" style="display:none">'+
    '<div class="smPopH">'+E(rotulo)+
     '<button onclick="'+onTodos+'">'+(n?'limpar':'marcar todos')+'</button></div>'+
    '<div class="smPopL">'+itens.map(function(x){
      var on=arr.map(String).indexOf(String(x.id))>=0;
      return '<label class="smIt'+(on?' on':'')+'">'+
      '<input type="checkbox"'+(on?' checked':'')+' onchange="'+onTog+'(\''+x.id+'\')">'+
      '<span>'+E(x.nome)+'</span>'+(x.n?'<i>'+x.n+'</i>':'')+'</label>';
    }).join('')+'</div></div></div>';
}
function abreSelMulti(ev,id){
  ev.stopPropagation();
  var el=document.getElementById('sm-'+id);
  if(!el)return;
  var abrindo=(el.style.display==='none');
  var todos=document.querySelectorAll('.smPop');
  for(var i=0;i<todos.length;i++)todos[i].style.display='none';
  el.style.display=abrindo?'':'none';
  if(abrindo)setTimeout(function(){
    document.addEventListener('click',function fecha(e){
      if(el.contains(e.target))return;
      el.style.display='none';
      document.removeEventListener('click',fecha);
    });
  },10);
}

/* filtros num painel só, que recolhe — e mostra o que está ativo */
var _filtroAberto={};
function togFiltro(arr,v){
  var i=arr.indexOf(v);
  if(i>=0)arr.splice(i,1); else arr.push(v);
}
function togFD(k){togFiltro(FD.canais,k);telaFaturamentoDia();}
function togFDdia(i){togFiltro(FD.dias,Number(i));telaFaturamentoDia();}
function togTodosFD(campo){
  if(campo==='canais')FD.canais=FD.canais.length?[]:Object.keys(canaisVenda());
  else FD.dias=FD.dias.length?[]:[0,1,2,3,4,5,6];
  telaFaturamentoDia();
}
function limparFD(){FD.canais=[];FD.dias=[];telaFaturamentoDia();}
function perFD(n){
  var d=new Date();
  if(n===0){FD.de=new Date(d.getFullYear(),d.getMonth(),1).toISOString().slice(0,10);FD.ate=hojeISO();}
  else if(n===-1){FD.de=new Date(d.getFullYear(),d.getMonth()-1,1).toISOString().slice(0,10);
    FD.ate=new Date(d.getFullYear(),d.getMonth(),0).toISOString().slice(0,10);}
  else {FD.de=diasAtrasISO(n);FD.ate=hojeISO();}
  telaFaturamentoDia();
}
function explicaFaturamentoDia(){
  explicaRel('Faturamento por Dia — como é feito',[
   ['Vendas','quantidade de pedidos do dia, sem contar os cancelados'],
   ['Valor','soma do total de cada pedido, já com taxa e desconto aplicados'],
   ['Acumulado','soma corrida do valor, do primeiro dia até aquele'],
   ['Ticket médio','valor do dia dividido pela quantidade de vendas'],
   ['Itens','soma das quantidades de todos os itens vendidos no dia'],
   ['Taxa de entrega','taxas cobradas nos pedidos de delivery'],
   ['Acréscimos e descontos','valores lançados no fechamento de cada pedido'],
   ['Canceladas','pedidos que foram para a fase Cancelado — não entram no faturamento']
  ],'os pedidos registrados no PDV, pela data da venda.',
    'pedidos cancelados no faturamento (aparecem em coluna própria), '+
    'lançamentos financeiros que não vieram de venda, e vendas de outras lojas.');
}
function exportarFatDia(){
  var peds=pedidosFiltrados(FD), porDia={};
  peds.forEach(function(p){
    var d=diaLocal(p.data);
    porDia[d]=porDia[d]||{qtd:0,valor:0,itens:0,taxa:0,desc:0,canc:0,vcanc:0};
    var x=porDia[d];
    if(ehCancelado(p)){x.canc++;x.vcanc+=Number(p.total)||0;return;}
    x.qtd++;x.valor+=Number(p.total)||0;
    x.itens+=(p.itens||[]).reduce(function(a,i){return a+(Number(i.qtd)||0)},0);
    x.taxa+=Number(p.taxa)||0;x.desc+=Number(p.desconto)||0;
  });
  var l=[['Data','Dia da semana','Vendas','Valor','Acumulado','Ticket medio','Itens','Taxa','Descontos','Canceladas','Valor cancelado']];
  var acum=0;
  Object.keys(porDia).sort().forEach(function(d){
    var x=porDia[d];acum+=x.valor;
    l.push([dataBR(d),DIAS_SEM[diaSemana(d)],x.qtd,
      String(x.valor.toFixed(2)).replace('.',','),String(acum.toFixed(2)).replace('.',','),
      String((x.qtd?x.valor/x.qtd:0).toFixed(2)).replace('.',','),x.itens,
      String(x.taxa.toFixed(2)).replace('.',','),String(x.desc.toFixed(2)).replace('.',','),
      x.canc,String(x.vcanc.toFixed(2)).replace('.',',')]);
  });
  baixarCSV('nexor-faturamento-dia.csv',l);
}
function imprimirRel(titulo){
  var area=document.getElementById('relArea');
  if(!area)return;
  var el=document.getElementById('viaImp')||document.createElement('div');
  el.id='viaImp';
  el.innerHTML='<div style="text-align:center;border-bottom:2px solid #000;padding-bottom:6px;margin-bottom:10px">'+
   '<b style="font-size:15px">'+E(titulo)+'</b><br>'+
   '<span style="font-size:11px">'+E(nomeLojaAtual())+' · emitido em '+
   new Date().toLocaleString('pt-BR')+'</span></div>'+
   '<style>#viaImp table{width:100%;border-collapse:collapse;font-size:9.5px}'+
   '#viaImp th{background:#eee;text-align:left;padding:4px;border-bottom:1px solid #000}'+
   '#viaImp td{padding:3px 4px;border-bottom:1px solid #ddd}'+
   '#viaImp tfoot td{font-weight:700;border-top:1px solid #000}</style>'+
   area.innerHTML;
  document.body.appendChild(el);
  setTimeout(function(){window.print()},250);
}

/* ==========================================================
   2 — ITENS CONSUMIDOS
   ========================================================== */
var IC={de:'',ate:'',motivos:[],grupo:'',item:'',busca:''};
function telaItensConsumidos(){
  baseMov();
  if(!IC.de){var d=new Date();
    IC.de=new Date(d.getFullYear(),d.getMonth(),1).toISOString().slice(0,10);
    IC.ate=hojeISO();}
  var por={};
  (DB.movEst||[]).forEach(function(m){
    var d=diaLocal(m.data);
    if(IC.de&&d<IC.de)return;
    if(IC.ate&&d>IC.ate)return;
    if(IC.motivos.length&&IC.motivos.indexOf(m.motivoId)<0)return;
    (m.linhas||[]).forEach(function(l){
      if(l.direcao!=='saida')return;                 /* consumo = saída */
      var it=itemEstoque(l.insumoId);
      if(IC.grupo&&(!it||(it.grupoId!==IC.grupo&&it.categoriaId!==IC.grupo)))return;
      if(IC.item&&l.insumoId!==IC.item)return;
      var k=l.insumoId;
      por[k]=por[k]||{nome:l.nome,item:it,qtd:0,valor:0,mov:0,unidade:l.unidade};
      var q=it?convUnid(l.qtd,l.unidade,it.unidade):null;
      por[k].qtd+=(q===null?Number(l.qtd)||0:q);
      if(it)por[k].unidade=it.unidade;
      por[k].valor+=(Number(l.qtd)||0)*(Number(l.custo)||0);
      por[k].mov++;
    });
  });
  var lista=Object.keys(por).map(function(k){return por[k]})
    .filter(function(x){
      if(!IC.busca)return true;
      return String(x.nome||'').toLowerCase().indexOf(IC.busca.toLowerCase())>=0;
    })
    .sort(function(a,b){return b.valor-a.valor});
  var total=lista.reduce(function(a,x){return a+x.valor},0);

  $('content').innerHTML='<div class="etWrap"><div class="etScroll">'+
   '<div class="etTopo">'+
    '<div><h1>Itens Consumidos</h1><p>Tudo que saiu do estoque, por motivo.</p></div>'+
    '<button class="infoBt" onclick="explicaItensConsumidos()">'+sv('help',15)+'</button>'+
    '<div style="flex:1"></div>'+
    '<button class="btnP2" onclick="imprimirRel(\'Itens Consumidos\')">'+sv('print2',13)+' PDF</button>'+
    '<button class="btnP2" onclick="exportarItensCons()">'+sv('down2',13)+' Exportar</button>'+
   '</div>'+
   (function(){
     var mots=(DB.motivosMov||[]).map(function(m){
       var q=(DB.movEst||[]).filter(function(mv){
         if(mv.motivoId!==m.id)return false;
         var d2=diaLocal(mv.data);
         return (!IC.de||d2>=IC.de)&&(!IC.ate||d2<=IC.ate);
       }).length;
       return {id:m.id,nome:m.nome,n:q||''};
     });
     return '<div class="barraF">'+
      '<div class="bfCampo"><label>De</label><input type="date" id="icDe" value="'+IC.de+'"></div>'+
      '<div class="bfCampo"><label>Até</label><input type="date" id="icAte" value="'+IC.ate+'"></div>'+
      selMulti('icMot','Motivo da saída',mots,IC.motivos,'togIC','togTodosIC()')+
      '<div class="bfRapido">'+
       '<button class="'+(IC.motivos.length===1&&IC.motivos[0]==='mv_venda'?'on':'')+'" '+
        'onclick="soMotivo(\'mv_venda\')" title="tudo que saiu pelas vendas no PDV, puxando a ficha técnica de cada produto">'+
        sv('cart',12)+' Vendas PDV</button>'+
       '<button class="'+(IC.motivos.length&&IC.motivos.every(function(m){return tipoMotivo(m)==='producao'})?'on':'')+'" '+
        'onclick="soTipoMotivo(\'producao\')">'+sv('box',12)+' Produção</button>'+
       '<button class="'+(IC.motivos.length===2&&IC.motivos.indexOf('mv_perdaprod')>=0?'on':'')+'" '+
        'onclick="soPerdas()">'+sv('dn4',12)+' Perdas</button>'+
      '</div>'+
      '<div class="bfCampo"><label>Grupo</label>'+
       '<select onchange="IC.grupo=this.value;telaItensConsumidos()">'+
       '<option value="">Todos</option>'+
       (DB.gruposIng||[]).map(function(g){return '<option value="'+g.id+'"'+(IC.grupo===g.id?' selected':'')+'>'+E(g.nome)+'</option>'}).join('')+
       gruposFicha().map(function(c){return '<option value="'+c.id+'"'+(IC.grupo===c.id?' selected':'')+'>'+E(c.nome)+'</option>'}).join('')+
       '</select></div>'+
      '<div class="bfCampo cresce"><label>Buscar</label>'+
       '<input id="icBusca" value="'+E(IC.busca)+'" placeholder="nome do ingrediente"></div>'+
      '<button class="btnP2 ok" onclick="IC.de=$(\'icDe\').value;IC.ate=$(\'icAte\').value;telaItensConsumidos()">'+
       sv('search',13)+' Buscar</button>'+
      (IC.motivos.length||IC.grupo?'<button class="btnP2" onclick="limparIC()">Limpar</button>':'')+
     '</div>';
   })()+
   '<div class="relKpis">'+
    '<div class="rk"><span>Itens diferentes</span><b>'+lista.length+'</b></div>'+
    '<div class="rk dest"><span>Custo total consumido</span><b>R$ '+money(total)+'</b></div>'+
    '<div class="rk"><span>Movimentos</span><b>'+lista.reduce(function(a,x){return a+x.mov},0)+'</b></div>'+
   '</div>'+
   '<div class="etTabW plano2" id="relArea">'+
   (lista.length?'<table class="etTab semBusca"><thead><tr>'+
    '<th>Item</th><th style="width:160px">Grupo</th>'+
    '<th style="width:130px;text-align:right">Consumido</th>'+
    '<th style="width:130px;text-align:right">Custo por unidade</th>'+
    '<th style="width:140px;text-align:right">Custo total</th>'+
    '<th style="width:100px;text-align:right">% do total</th></tr></thead><tbody>'+
    lista.map(function(x){
      var it=x.item||{};
      var g=ehFicha(it)?catFicha(it.categoriaId):grupoIng(it.grupoId);
      var pc=total?(x.valor/total*100):0;
      return '<tr><td><b>'+E(x.nome)+'</b>'+
       (ehFicha(it)?'<span class="tagFicha">ficha</span>':'')+
       '<small style="display:block;color:var(--ink-3)">'+x.mov+' movimento(s)</small></td>'+
      '<td>'+E(g?g.nome:'—')+'</td>'+
      '<td style="text-align:right"><b>'+fmtQt(x.qtd)+' '+un(x.unidade).ab+'</b></td>'+
      '<td style="text-align:right">'+money(x.qtd?x.valor/x.qtd:0)+'</td>'+
      '<td style="text-align:right"><b>R$ '+money(x.valor)+'</b></td>'+
      '<td style="text-align:right"><span class="hpBar"><i style="width:'+Math.min(100,pc)+'%"></i></span>'+
       '<small>'+pc.toFixed(1)+'%</small></td></tr>';
    }).join('')+'</tbody>'+
    '<tfoot><tr><td colspan="4"><b>Total consumido</b></td>'+
    '<td style="text-align:right"><b>R$ '+money(total)+'</b></td><td></td></tr></tfoot></table>'
   :'<div class="mvVazio">'+sv('box',26)+'<b>Nenhum consumo no período</b></div>')+
   '</div></div></div>';
  var b=$('icBusca');
  if(b)b.oninput=function(){IC.busca=this.value;var p=this.selectionStart;telaItensConsumidos();
    var n=$('icBusca');if(n){n.focus();n.setSelectionRange(p,p);}};
  rodape(lista.length+' itens · R$ '+money(total));
}
function soMotivo(id){
  baseMov();
  if(!(DB.motivosMov||[]).some(function(m){return m.id===id})){
    DB.motivosMov.push({id:'mv_venda',nome:'Venda PDV',tipo:'saida',
      sistema:true,ativo:true,lojas:[]});
    salvar();
  }
  IC.motivos=(IC.motivos.length===1&&IC.motivos[0]===id)?[]:[id];
  telaItensConsumidos();
}
function soTipoMotivo(tipo){
  var ids=(DB.motivosMov||[]).filter(function(m){return m.tipo===tipo}).map(function(m){return m.id});
  var igual=(IC.motivos.length===ids.length&&ids.every(function(i){return IC.motivos.indexOf(i)>=0}));
  IC.motivos=igual?[]:ids;
  telaItensConsumidos();
}
function soPerdas(){
  var ids=(DB.motivosMov||[]).filter(function(m){
    return /perda|quebra/i.test(m.nome||'')}).map(function(m){return m.id});
  var igual=(IC.motivos.length===ids.length&&ids.every(function(i){return IC.motivos.indexOf(i)>=0}));
  IC.motivos=igual?[]:ids;
  telaItensConsumidos();
}
function togIC(k){togFiltro(IC.motivos,k);telaItensConsumidos();}
function togTodosIC(){
  IC.motivos=IC.motivos.length?[]:(DB.motivosMov||[]).map(function(m){return m.id});
  telaItensConsumidos();
}
function limparIC(){IC.motivos=[];IC.grupo='';IC.busca='';telaItensConsumidos();}
function explicaItensConsumidos(){
  explicaRel('Itens Consumidos — como é feito',[
   ['Consumido','soma de todas as saídas de estoque do item no período, convertidas para a unidade de cadastro'],
   ['Custo por unidade','custo total dividido pela quantidade consumida — é a média real do período'],
   ['Custo total','quantidade que saiu multiplicada pelo custo do item no momento de cada baixa'],
   ['Motivo da saída','filtra por venda, produção, baixa manual, perda ou qualquer motivo cadastrado'],
   ['% do total','peso daquele item no custo total consumido no período'],
   ['Vendas PDV','mostra tudo que saiu pelas vendas: ao vender um cascão, o sistema puxa a '+
    'ficha técnica dele e baixa gelato, cascão, colher e guardanapo — cada um aparece aqui '+
    'com a quantidade e o custo do período']
  ],'as movimentações de estoque com direção de saída, no período escolhido. '+
    'O custo usado é o que estava valendo no momento de cada baixa, não o de hoje.',
   'entradas de estoque (compras e produção), itens que não controlam estoque, '+
   'e saídas de outras lojas.');
}
function exportarItensCons(){
  var area=[['Item','Grupo','Consumido','Unidade','Custo unitario','Custo total']];
  var tab=document.querySelectorAll('#relArea tbody tr');
  for(var i=0;i<tab.length;i++){
    var td=tab[i].querySelectorAll('td');
    area.push([td[0].innerText.split('\n')[0],td[1].innerText,
      td[2].innerText,'',td[3].innerText,td[4].innerText]);
  }
  baixarCSV('nexor-itens-consumidos.csv',area);
}

/* ==========================================================
   3 — ITENS VENDIDOS
   ========================================================== */
var IV={de:'',ate:'',canais:[],cats:[],busca:'',abertas:{},verAdic:false};
function telaItensVendidos(){
  baseMov();
  if(!IV.de){var d=new Date();
    IV.de=new Date(d.getFullYear(),d.getMonth(),1).toISOString().slice(0,10);
    IV.ate=hojeISO();}
  var peds=pedidosFiltrados(IV).filter(function(p){return !ehCancelado(p)});
  var porCat={},adicionais={},totalFat=0,totalItens=0;
  peds.forEach(function(p){
    totalFat+=Number(p.total)||0;
    (p.itens||[]).forEach(function(it){
      var prod=(DB.produtos||[]).find(function(x){return x.id===it.produtoId});
      var cat=prod?(DB.categorias||[]).find(function(c){return c.id===prod.categoriaId}):null;
      var ck=cat?cat.id:'_sem';
      var cn=cat?cat.nome:'Sem categoria';
      if(IV.cats.length&&IV.cats.indexOf(ck)<0)return;
      porCat[ck]=porCat[ck]||{nome:cn,qtd:0,valor:0,itens:{}};
      var C=porCat[ck];
      var q=Number(it.qtd)||0, v=Number(it.total)||0;
      C.qtd+=q; C.valor+=v; totalItens+=q;
      var ik=it.produtoId||it.nome;
      C.itens[ik]=C.itens[ik]||{nome:it.nome,qtd:0,valor:0};
      C.itens[ik].qtd+=q; C.itens[ik].valor+=v;
      /* acompanhamentos escolhidos no pedido */
      (it.opcoes||[]).forEach(function(o){
        var on=o.nome||o;
        adicionais[on]=adicionais[on]||{nome:on,qtd:0,valor:0};
        adicionais[on].qtd+=q;
        adicionais[on].valor+=(Number(o.preco)||0)*q;
      });
    });
  });
  var cats=Object.keys(porCat).map(function(k){
    var c=porCat[k];c.id=k;
    c.lista=Object.keys(c.itens).map(function(i2){return c.itens[i2]})
      .sort(function(a,b){return b.valor-a.valor});
    return c;
  }).filter(function(c){
    if(!IV.busca)return true;
    var q2=IV.busca.toLowerCase();
    return c.nome.toLowerCase().indexOf(q2)>=0||
      c.lista.some(function(i3){return i3.nome.toLowerCase().indexOf(q2)>=0});
  }).sort(function(a,b){return b.valor-a.valor});
  var adic=Object.keys(adicionais).map(function(k){return adicionais[k]})
    .sort(function(a,b){return b.qtd-a.qtd});
  var totalCat=cats.reduce(function(a,c){return a+c.valor},0);
  var canais=canaisVenda();

  $('content').innerHTML='<div class="etWrap"><div class="etScroll">'+
   '<div class="etTopo">'+
    '<div><h1>Itens Vendidos</h1><p>O que saiu no cardápio, por categoria e produto.</p></div>'+
    '<button class="infoBt" onclick="explicaItensVendidos()">'+sv('help',15)+'</button>'+
    '<div style="flex:1"></div>'+
    '<button class="btnP2" onclick="imprimirRel(\'Itens Vendidos\')">'+sv('print2',13)+' PDF</button>'+
    '<button class="btnP2" onclick="exportarItensVend()">'+sv('down2',13)+' Exportar</button>'+
   '</div>'+
   '<div class="barraF">'+
    '<div class="bfCampo"><label>De</label><input type="date" id="ivDe" value="'+IV.de+'"></div>'+
    '<div class="bfCampo"><label>Até</label><input type="date" id="ivAte" value="'+IV.ate+'"></div>'+
    selMulti('ivCanal','Canal',
      Object.keys(canais).map(function(k){return {id:k,nome:canais[k]}}),
      IV.canais,'togIVc','togTodosIV(\'canais\')')+
    selMulti('ivCat','Categorias',
      (DB.categorias||[]).map(function(c){
        var q=0;(DB.produtos||[]).forEach(function(p){if(p.categoriaId===c.id)q++;});
        return {id:c.id,nome:c.nome,n:q||''};}),
      IV.cats,'togIVcat','togTodosIV(\'cats\')')+
    '<div class="bfCampo cresce"><label>Buscar</label>'+
     '<input id="ivBusca" value="'+E(IV.busca)+'" placeholder="produto ou categoria"></div>'+
    '<button class="btnP2 ok" onclick="IV.de=$(\'ivDe\').value;IV.ate=$(\'ivAte\').value;telaItensVendidos()">'+
     sv('search',13)+' Buscar</button>'+
    '<div class="bfAtalhos">'+
     '<button onclick="perIV(0)">Mês</button>'+
     '<button onclick="perIV(-1)">Anterior</button>'+
     (IV.canais.length||IV.cats.length?'<button class="lim" onclick="limparIV()">limpar</button>':'')+
    '</div>'+
   '</div>'+
   '<div class="relKpis">'+
    '<div class="rk"><span>Itens vendidos</span><b>'+fmtQt(totalItens)+'</b></div>'+
    '<div class="rk dest"><span>Faturamento do período</span><b>R$ '+money(totalFat)+'</b></div>'+
    '<div class="rk"><span>Valor em itens</span><b>R$ '+money(totalCat)+'</b></div>'+
    '<div class="rk"><span>Categorias</span><b>'+cats.length+'</b></div>'+
   '</div>'+
   '<div class="ivGrade">'+
   '<div class="etTabW plano2" id="relArea">'+
   (cats.length?'<table class="etTab ivTab"><thead><tr>'+
    '<th>Categoria / produto</th>'+
    '<th style="width:110px;text-align:right">Quantidade</th>'+
    '<th style="width:140px;text-align:right">Valor total</th>'+
    '<th style="width:130px;text-align:right">% do faturamento</th></tr></thead><tbody>'+
    cats.map(function(c){
      var ab=!!IV.abertas[c.id];
      var pc=totalFat?(c.valor/totalFat*100):0;
      return '<tr class="ivCat" onclick="IV.abertas[\''+c.id+'\']=!IV.abertas[\''+c.id+'\'];telaItensVendidos()">'+
      '<td><span class="ftSeta'+(ab?' ab':'')+'">'+sv('tri',10)+'</span> <b>'+E(c.nome)+'</b>'+
       '<small style="color:var(--ink-3)"> · '+c.lista.length+' produto(s)</small></td>'+
      '<td style="text-align:right"><b>'+fmtQt(c.qtd)+'</b></td>'+
      '<td style="text-align:right"><b>R$ '+money(c.valor)+'</b></td>'+
      '<td style="text-align:right"><span class="hpBar"><i style="width:'+Math.min(100,pc)+'%"></i></span>'+
       '<small>'+pc.toFixed(1)+'%</small></td></tr>'+
      (ab?c.lista.map(function(i4){
        var p2=totalFat?(i4.valor/totalFat*100):0;
        return '<tr class="ivProd"><td>'+E(i4.nome)+'</td>'+
        '<td style="text-align:right">'+fmtQt(i4.qtd)+'</td>'+
        '<td style="text-align:right">R$ '+money(i4.valor)+'</td>'+
        '<td style="text-align:right;color:var(--ink-3)">'+p2.toFixed(1)+'%</td></tr>';
      }).join(''):'');
    }).join('')+'</tbody>'+
    '<tfoot><tr><td><b>Total</b></td>'+
    '<td style="text-align:right"><b>'+fmtQt(totalItens)+'</b></td>'+
    '<td style="text-align:right"><b>R$ '+money(totalCat)+'</b></td>'+
    '<td style="text-align:right"><b>'+(totalFat?(totalCat/totalFat*100).toFixed(1):'0')+'%</b></td></tr></tfoot></table>'
   :'<div class="mvVazio">'+sv('box',26)+'<b>Nenhuma venda no período</b></div>')+
   '</div>'+
   '<aside class="ivAdic">'+
    '<div class="ivAdicH">'+sv('plus',13)+' Acompanhamentos'+
     '<span class="cnt2">'+adic.length+'</span></div>'+
    (adic.length?'<table class="ivAdicT"><tbody>'+adic.map(function(a){
      return '<tr><td>'+E(a.nome)+'</td>'+
      '<td style="text-align:right">'+fmtQt(a.qtd)+'</td>'+
      '<td style="text-align:right">'+(a.valor?'R$ '+money(a.valor):'—')+'</td></tr>';
    }).join('')+'</tbody></table>'
    :'<div class="hint" style="padding:14px">Nenhum acompanhamento vendido no período.</div>')+
   '</aside>'+
   '</div></div></div>';
  var b=$('ivBusca');
  if(b)b.oninput=function(){IV.busca=this.value;var p=this.selectionStart;telaItensVendidos();
    var n=$('ivBusca');if(n){n.focus();n.setSelectionRange(p,p);}};
  rodape(fmtQt(totalItens)+' itens · R$ '+money(totalCat));
}
function togIVc(k){togFiltro(IV.canais,k);telaItensVendidos();}
function togIVcat(k){togFiltro(IV.cats,k);telaItensVendidos();}
function togTodosIV(campo){
  if(campo==='canais')IV.canais=IV.canais.length?[]:Object.keys(canaisVenda());
  else IV.cats=IV.cats.length?[]:(DB.categorias||[]).map(function(c){return c.id});
  telaItensVendidos();
}
function limparIV(){IV.canais=[];IV.cats=[];IV.busca='';telaItensVendidos();}
function perIV(n){
  var d=new Date();
  if(n===0){IV.de=new Date(d.getFullYear(),d.getMonth(),1).toISOString().slice(0,10);IV.ate=hojeISO();}
  else if(n===-1){IV.de=new Date(d.getFullYear(),d.getMonth()-1,1).toISOString().slice(0,10);
    IV.ate=new Date(d.getFullYear(),d.getMonth(),0).toISOString().slice(0,10);}
  else {IV.de=diasAtrasISO(n);IV.ate=hojeISO();}
  telaItensVendidos();
}
function explicaItensVendidos(){
  explicaRel('Itens Vendidos — como é feito',[
   ['Quantidade','soma das quantidades de cada produto nos pedidos do período'],
   ['Valor total','soma do valor de cada item já com o preço praticado na venda'],
   ['% do faturamento','valor do item dividido pelo faturamento total do período'],
   ['Categoria','a categoria do cardápio à qual o produto pertence — clique para abrir os produtos'],
   ['Acompanhamentos','opções escolhidas dentro do pedido, como borda e adicionais, contadas à parte']
  ],'os itens de cada pedido do PDV, no período e nos filtros escolhidos. '+
    'O faturamento usado como base é o total dos mesmos pedidos.',
   'pedidos cancelados, taxas de entrega e acréscimos do pedido (não são itens), '+
   'e vendas de outras lojas. O percentual pode não somar 100% porque taxa de entrega '+
   'entra no faturamento mas não é item.');
}
function exportarItensVend(){
  var l=[['Categoria','Produto','Quantidade','Valor total']];
  var trs=document.querySelectorAll('#relArea tbody tr');
  var catAtual='';
  for(var i=0;i<trs.length;i++){
    var td=trs[i].querySelectorAll('td');
    if(trs[i].className.indexOf('ivCat')>=0){
      catAtual=td[0].innerText.split('·')[0].trim();
      l.push([catAtual,'',td[1].innerText,td[2].innerText]);
    }else{
      l.push([catAtual,td[0].innerText,td[1].innerText,td[2].innerText]);
    }
  }
  baixarCSV('nexor-itens-vendidos.csv',l);
}

/* ==========================================================
   4 — VENDAS POR ÁREA DE ENTREGA
   ========================================================== */
var VA={de:'',ate:'',cidades:[],canais:[]};
function cidadesCadastradas(){
  var s={};
  (DB.areas||[]).forEach(function(a){ if(a.nome)s[a.nome]=true; });
  (DB.entregadores||[]).forEach(function(e){
    (e.taxas||[]).forEach(function(t){ if(t.cidade)s[t.cidade]=true; });
  });
  (DB.areas||[]).forEach(function(a){ if(a.nome)s[a.nome]=true; });
  (DB.pedidos||[]).forEach(function(p){ if(p.cidade)s[p.cidade]=true; });
  return Object.keys(s).sort();
}
function telaVendasArea(){
  baseMov();
  if(!VA.de){var d=new Date();
    VA.de=new Date(d.getFullYear(),d.getMonth(),1).toISOString().slice(0,10);
    VA.ate=hojeISO();}
  var peds=pedidosFiltrados(VA).filter(function(p){return !ehCancelado(p)});
  var totalFat=peds.reduce(function(a,p){return a+(Number(p.total)||0)},0);
  var ents=peds.filter(function(p){return (p.tipo==='entrega')});
  var porCid={};
  ents.forEach(function(p){
    var c=p.cidade||'Sem cidade';
    if(VA.cidades.length&&VA.cidades.indexOf(c)<0)return;
    porCid[c]=porCid[c]||{nome:c,qtd:0,valor:0,taxa:0,itens:0};
    porCid[c].qtd++; porCid[c].valor+=Number(p.total)||0;
    porCid[c].taxa+=Number(p.taxa)||0;
    porCid[c].itens+=(p.itens||[]).reduce(function(a,i){return a+(Number(i.qtd)||0)},0);
  });
  var lista=Object.keys(porCid).map(function(k){return porCid[k]})
    .sort(function(a,b){return b.valor-a.valor});
  var totEnt=lista.reduce(function(a,x){return a+x.valor},0);
  var totQtd=lista.reduce(function(a,x){return a+x.qtd},0);
  var totTaxa=lista.reduce(function(a,x){return a+x.taxa},0);

  /* evolução mês a mês das entregas */
  var porMes={};
  (DB.pedidos||[]).forEach(function(p){
    if(ehCancelado(p)||p.tipo!=='entrega')return;
    var m=String(p.data||'').slice(0,7);
    if(!m)return;
    porMes[m]=porMes[m]||{qtd:0,valor:0};
    porMes[m].qtd++; porMes[m].valor+=Number(p.total)||0;
  });
  var meses=Object.keys(porMes).sort().slice(-12);
  var maxM=Math.max.apply(null,meses.map(function(m){return porMes[m].valor}).concat([1]));
  var canais=canaisVenda();

  $('content').innerHTML='<div class="etWrap"><div class="etScroll">'+
   '<div class="etTopo">'+
    '<div><h1>Vendas por Área de Entrega</h1><p>Quanto cada cidade representa no delivery.</p></div>'+
    '<button class="infoBt" onclick="explicaVendasArea()">'+sv('help',15)+'</button>'+
    '<div style="flex:1"></div>'+
    '<button class="btnP2" onclick="imprimirRel(\'Vendas por Área de Entrega\')">'+sv('print2',13)+' PDF</button>'+
    '<button class="btnP2" onclick="exportarArea()">'+sv('down2',13)+' Exportar</button>'+
   '</div>'+
   '<div class="barraF">'+
    '<div class="bfCampo"><label>De</label><input type="date" id="vaDe" value="'+VA.de+'"></div>'+
    '<div class="bfCampo"><label>Até</label><input type="date" id="vaAte" value="'+VA.ate+'"></div>'+
    selMulti('vaCid','Cidades',
      cidadesCadastradas().map(function(c){
        var q=0;(DB.pedidos||[]).forEach(function(p){if(p.cidade===c&&p.tipo==='entrega')q++;});
        return {id:c,nome:c,n:q||''};}),
      VA.cidades,'togVA','togTodosVA()')+
    selMulti('vaCan','Canal',
      Object.keys(canais).map(function(k){return {id:k,nome:canais[k]}}),
      VA.canais,'togVAc','togTodosVAc()')+
    '<button class="btnP2 ok" onclick="VA.de=$(\'vaDe\').value;VA.ate=$(\'vaAte\').value;telaVendasArea()">'+
     sv('search',13)+' Buscar</button>'+
    '<div class="bfAtalhos">'+
     '<button onclick="perVA(0)">Mês</button>'+
     '<button onclick="perVA(-1)">Anterior</button>'+
     '<button onclick="perVA(90)">90d</button>'+
     (VA.cidades.length||VA.canais.length?'<button class="lim" onclick="limparVA()">limpar</button>':'')+
    '</div>'+
   '</div>'+
   '<div class="relKpis">'+
    '<div class="rk"><span>Entregas</span><b>'+totQtd+'</b></div>'+
    '<div class="rk dest"><span>Faturamento em entregas</span><b>R$ '+money(totEnt)+'</b></div>'+
    '<div class="rk"><span>Faturamento total</span><b>R$ '+money(totalFat)+'</b></div>'+
    '<div class="rk"><span>Entrega no faturamento</span><b class="vg">'+
     (totalFat?(totEnt/totalFat*100).toFixed(1).replace('.',','):'0')+'%</b></div>'+
    '<div class="rk"><span>Ticket da entrega</span><b>R$ '+money(totQtd?totEnt/totQtd:0)+'</b></div>'+
    '<div class="rk"><span>Taxas cobradas</span><b>R$ '+money(totTaxa)+'</b></div>'+
   '</div>'+
   (meses.length>1?(function(){
     var W=Math.max(560,meses.length*86), H=248, PL=58, PR=16, PT=62, PB=36;
     var iw=W-PL-PR, ih=H-PT-PB;
     var maxQ=Math.max.apply(null,meses.map(function(m){return porMes[m].qtd}).concat([1]));
     var passo=iw/meses.length;
     var larg=Math.min(38,passo*0.5);
     /* linhas de referência */
     var grade='',eixo='';
     for(var g=0;g<=4;g++){
       var y=PT+ih-(ih*g/4);
       grade+='<line x1="'+PL+'" y1="'+y+'" x2="'+(W-PR)+'" y2="'+y+'" '+
         'stroke="var(--line-2)" stroke-width="1"'+(g?' stroke-dasharray="3 4"':'')+'/>';
       eixo+='<text x="'+(PL-8)+'" y="'+(y+4)+'" text-anchor="end" font-size="9.5" '+
         'fill="var(--ink-3)">'+(maxM*g/4>=1000?(maxM*g/4/1000).toFixed(1)+'k':Math.round(maxM*g/4))+'</text>';
     }
     /* barras e linha de quantidade */
     var barras='',pontos=[],rot='',tips='';
     meses.forEach(function(m,k){
       var v=porMes[m].valor, q=porMes[m].qtd;
       var h=(v/maxM)*ih;
       var x=PL+passo*k+(passo-larg)/2;
       var y=PT+ih-h;
       var ant=k>0?porMes[meses[k-1]].valor:0;
       var vr=ant?((v-ant)/ant*100):0;
       var cx=PL+passo*k+passo/2;
       barras+='<g class="gBar" data-i="'+k+'">'+
        '<rect x="'+x+'" y="'+y+'" width="'+larg+'" height="'+Math.max(2,h)+'" rx="4" '+
         'fill="url(#gradEnt)"/>'+
        '<rect class="gHit" x="'+(PL+passo*k)+'" y="'+PT+'" width="'+passo+'" height="'+ih+'" fill="transparent"/>'+
        '</g>';
       /* o balão fica preso dentro da área do gráfico e nunca cobre os meses */
       var bw=132, bh=46;
       var bx=Math.min(Math.max(cx-bw/2,PL+2),W-PR-bw-2);
       var by=Math.max(PT+2,y-bh-8);
       tips+='<g class="gTip" data-i="'+k+'">'+
        '<rect x="'+bx+'" y="'+by+'" width="'+bw+'" height="'+bh+'" rx="8" fill="#122A42" '+
         'stroke="rgba(255,255,255,.12)"/>'+
        '<text x="'+(bx+bw/2)+'" y="'+(by+16)+'" text-anchor="middle" font-size="10.5" '+
         'fill="#fff" font-weight="700">'+nomeMes(m)+'</text>'+
        '<text x="'+(bx+bw/2)+'" y="'+(by+29)+'" text-anchor="middle" font-size="11" '+
         'fill="#5FE0CB" font-weight="600">R$ '+money(v)+'</text>'+
        '<text x="'+(bx+bw/2)+'" y="'+(by+40)+'" text-anchor="middle" font-size="9.5" '+
         'fill="#9AB4CC">'+q+' entregas'+(k>0?'   '+(vr>=0?'▲ +':'▼ ')+vr.toFixed(0)+'%':'')+'</text>'+
       '</g>';
       pontos.push([PL+passo*k+passo/2, PT+ih-((q/maxQ)*ih*0.82)]);
       rot+='<text x="'+(PL+passo*k+passo/2)+'" y="'+(H-12)+'" text-anchor="middle" '+
         'font-size="10" fill="var(--ink-3)" font-weight="600">'+nomeMes(m)+'</text>';
     });
     var linha=pontos.map(function(p,k){return (k?'L':'M')+p[0]+' '+p[1]}).join(' ');
     var bolas=pontos.map(function(p){
       return '<circle cx="'+p[0]+'" cy="'+p[1]+'" r="4" fill="#fff" stroke="#B8730B" stroke-width="2.5"/>';
     }).join('');
     return '<div class="grafCard">'+
      '<div class="grafH">'+
       '<div><b>Evolução das entregas</b><span>últimos '+meses.length+' meses</span></div>'+
       '<div class="grafLeg">'+
        '<span><i class="lg1"></i>faturamento</span>'+
        '<span><i class="lg2"></i>quantidade</span>'+
       '</div></div>'+
      '<div class="grafBox"><svg viewBox="0 0 '+W+' '+H+'" width="100%" height="'+H+'" '+
       'preserveAspectRatio="xMidYMid meet">'+
       '<defs><linearGradient id="gradEnt" x1="0" y1="0" x2="0" y2="1">'+
        '<stop offset="0%" stop-color="#00B89E"/><stop offset="100%" stop-color="#00806F"/>'+
       '</linearGradient></defs>'+
       grade+eixo+barras+
       '<path d="'+linha+'" fill="none" stroke="#B8730B" stroke-width="2.5" '+
        'stroke-linejoin="round" stroke-linecap="round" opacity=".9"/>'+bolas+rot+
       tips+
      '</svg></div></div>';
   })():'')+
   '<div class="etTabW plano2" id="relArea">'+
   (lista.length?'<table class="etTab semBusca"><thead><tr>'+
    '<th>Cidade / área</th>'+
    '<th style="width:110px;text-align:right">Entregas</th>'+
    '<th style="width:100px;text-align:right">Itens</th>'+
    '<th style="width:140px;text-align:right">Valor</th>'+
    '<th style="width:120px;text-align:right">Ticket médio</th>'+
    '<th style="width:120px;text-align:right">Taxas</th>'+
    '<th style="width:150px;text-align:right">% do faturamento</th></tr></thead><tbody>'+
    lista.map(function(x){
      var pc=totalFat?(x.valor/totalFat*100):0;
      return '<tr><td><b>'+E(x.nome)+'</b></td>'+
      '<td style="text-align:right"><b>'+x.qtd+'</b></td>'+
      '<td style="text-align:right">'+fmtQt(x.itens)+'</td>'+
      '<td style="text-align:right"><b>R$ '+money(x.valor)+'</b></td>'+
      '<td style="text-align:right">R$ '+money(x.qtd?x.valor/x.qtd:0)+'</td>'+
      '<td style="text-align:right">R$ '+money(x.taxa)+'</td>'+
      '<td style="text-align:right"><span class="hpBar"><i style="width:'+Math.min(100,pc*3)+'%"></i></span>'+
       '<small>'+pc.toFixed(1).replace('.',',')+'%</small></td></tr>';
    }).join('')+'</tbody>'+
    '<tfoot><tr><td><b>Total das entregas</b></td>'+
    '<td style="text-align:right"><b>'+totQtd+'</b></td>'+
    '<td style="text-align:right"><b>'+fmtQt(lista.reduce(function(a,x){return a+x.itens},0))+'</b></td>'+
    '<td style="text-align:right"><b>R$ '+money(totEnt)+'</b></td>'+
    '<td style="text-align:right"><b>R$ '+money(totQtd?totEnt/totQtd:0)+'</b></td>'+
    '<td style="text-align:right"><b>R$ '+money(totTaxa)+'</b></td>'+
    '<td style="text-align:right"><b>'+(totalFat?(totEnt/totalFat*100).toFixed(1).replace('.',','):'0')+'%</b></td></tr>'+
    '<tr class="sub2"><td colspan="7">Faturamento total do período: R$ '+money(totalFat)+
     ' — as entregas representam '+(totalFat?(totEnt/totalFat*100).toFixed(1).replace('.',','):'0')+
     '% desse valor</td></tr></tfoot></table>'
   :'<div class="mvVazio">'+sv('box',26)+'<b>Nenhuma entrega no período</b></div>')+
   '</div></div></div>';
  rodape(totQtd+' entregas · R$ '+money(totEnt));
}
function togVA(c){togFiltro(VA.cidades,c);telaVendasArea();}
function togVAc(c){togFiltro(VA.canais,c);telaVendasArea();}
function togTodosVA(){VA.cidades=VA.cidades.length?[]:cidadesCadastradas();telaVendasArea();}
function togTodosVAc(){VA.canais=VA.canais.length?[]:Object.keys(canaisVenda());telaVendasArea();}
function limparVA(){VA.cidades=[];VA.canais=[];telaVendasArea();}
function perVA(n){
  var d=new Date();
  if(n===0){VA.de=new Date(d.getFullYear(),d.getMonth(),1).toISOString().slice(0,10);VA.ate=hojeISO();}
  else if(n===-1){VA.de=new Date(d.getFullYear(),d.getMonth()-1,1).toISOString().slice(0,10);
    VA.ate=new Date(d.getFullYear(),d.getMonth(),0).toISOString().slice(0,10);}
  else {VA.de=diasAtrasISO(n);VA.ate=hojeISO();}
  telaVendasArea();
}
function explicaVendasArea(){
  explicaRel('Vendas por Área de Entrega — como é feito',[
   ['Cidade / área','a cidade informada no cadastro do cliente, gravada no pedido no momento da venda'],
   ['Entregas','quantidade de pedidos do tipo entrega naquela cidade'],
   ['Valor','soma do total dos pedidos, já com taxa de entrega e descontos'],
   ['Ticket médio','valor da cidade dividido pela quantidade de entregas'],
   ['Taxas','soma das taxas de entrega cobradas — vêm da tabela de taxas do entregador por cidade'],
   ['% do faturamento','valor da cidade dividido pelo faturamento total do período, incluindo as vendas de balcão'],
   ['Gráfico','faturamento em entregas mês a mês, com a variação em relação ao mês anterior']
  ],'os pedidos do tipo entrega registrados no PDV. As cidades vêm das taxas cadastradas '+
    'nos entregadores e do endereço dos clientes.',
   'pedidos cancelados, vendas de balcão e retirada no cálculo das entregas — '+
   'elas entram apenas no faturamento total, que serve de base para o percentual.');
}
function exportarArea(){
  var l=[['Cidade','Entregas','Itens','Valor','Ticket medio','Taxas','% faturamento']];
  var trs=document.querySelectorAll('#relArea tbody tr');
  for(var i=0;i<trs.length;i++){
    var td=trs[i].querySelectorAll('td');
    l.push([td[0].innerText,td[1].innerText,td[2].innerText,td[3].innerText,
      td[4].innerText,td[5].innerText,td[6].innerText]);
  }
  baixarCSV('nexor-vendas-area-entrega.csv',l);
}

/* ==========================================================
   5 — VENDAS POR FORMA DE PAGAMENTO
   ========================================================== */
var VP={de:'',ate:'',formas:[],canais:[]};
function telaVendasFormaPag(){
  baseMov();baseFormas();
  if(!VP.de){var d=new Date();
    VP.de=new Date(d.getFullYear(),d.getMonth(),1).toISOString().slice(0,10);
    VP.ate=hojeISO();}
  var peds=pedidosFiltrados(VP).filter(function(p){return !ehCancelado(p)});
  var totalFat=peds.reduce(function(a,p){return a+(Number(p.total)||0)},0);
  var porForma={},semForma=0;
  peds.forEach(function(p){
    var pgs=p.pagamentos||[];
    if(!pgs.length){semForma+=Number(p.total)||0;return;}
    pgs.forEach(function(pg){
      /* ==========================================================
         A VENDA DO DIA APARECIA COMO "NAO INFORMADO"

         O PDV grava a forma em `pagamento.forma` — e sempre gravou:
         addPag() faz `_pagos.push({forma:f,valor:...})`. Quem so le
         `formaId` nao acha nada, e a venda cai na linha "Nao informado".

         Nao aparecia sempre: a DESCIDA da nuvem devolve o pagamento com
         os dois campos preenchidos (`forma` e `formaId`, desde a V136).
         Entao a venda de ontem, que ja foi e voltou, aparecia certa — e
         a de hoje, que ainda nao voltou, aparecia sem forma. O relatorio
         se consertava sozinho de um dia para o outro, e por isso passou.

         Le-se os dois, como o fechamento e o detalhe do pedido ja fazem.
         ========================================================== */
      var f=(DB.formasPag||[]).find(function(x){return x.id===(pg.formaId||pg.forma)});
      var k=f?f.id:'_sem';
      if(VP.formas.length&&VP.formas.indexOf(k)<0)return;
      porForma[k]=porForma[k]||{nome:f?f.nome:'Não informado',tipo:f?f.tipo:'',
        taxaPct:f?Number(f.taxaPct)||0:0,taxaFixa:f?Number(f.taxaFixa)||0:0,
        prazo:f?Number(f.dias)||0:0,qtd:0,valor:0};
      porForma[k].qtd++; porForma[k].valor+=Number(pg.valor)||0;
    });
  });
  var lista=Object.keys(porForma).map(function(k){
    var x=porForma[k];
    x.taxa=(x.valor*x.taxaPct/100)+(x.taxaFixa*x.qtd);
    x.liquido=x.valor-x.taxa;
    return x;
  }).sort(function(a,b){return b.valor-a.valor});
  var totV=lista.reduce(function(a,x){return a+x.valor},0);
  var totT=lista.reduce(function(a,x){return a+x.taxa},0);
  var totQ=lista.reduce(function(a,x){return a+x.qtd},0);
  var canais=canaisVenda();

  $('content').innerHTML='<div class="etWrap"><div class="etScroll">'+
   '<div class="etTopo">'+
    '<div><h1>Vendas por Forma de Pagamento</h1>'+
    '<p>Quanto entrou em cada forma, com as taxas descontadas.</p></div>'+
    '<button class="infoBt" onclick="explicaVendasFormaPag()">'+sv('help',15)+'</button>'+
    '<div style="flex:1"></div>'+
    '<button class="btnP2" onclick="imprimirRel(\'Vendas por Forma de Pagamento\')">'+sv('print2',13)+' PDF</button>'+
    '<button class="btnP2" onclick="exportarFormaPag()">'+sv('down2',13)+' Exportar</button>'+
   '</div>'+
   '<div class="barraF">'+
    '<div class="bfCampo"><label>De</label><input type="date" id="vpDe" value="'+VP.de+'"></div>'+
    '<div class="bfCampo"><label>Até</label><input type="date" id="vpAte" value="'+VP.ate+'"></div>'+
    selMulti('vpFor','Formas de pagamento',
      (DB.formasPag||[]).map(function(f){return {id:f.id,nome:f.nome}}),
      VP.formas,'togVP','togTodosVP()')+
    selMulti('vpCan','Canal',
      Object.keys(canais).map(function(k){return {id:k,nome:canais[k]}}),
      VP.canais,'togVPc','togTodosVPc()')+
    '<button class="btnP2 ok" onclick="VP.de=$(\'vpDe\').value;VP.ate=$(\'vpAte\').value;telaVendasFormaPag()">'+
     sv('search',13)+' Buscar</button>'+
    '<div class="bfAtalhos">'+
     '<button onclick="perVP(0)">Mês</button>'+
     '<button onclick="perVP(-1)">Anterior</button>'+
     (VP.formas.length||VP.canais.length?'<button class="lim" onclick="limparVP()">limpar</button>':'')+
    '</div>'+
   '</div>'+
   '<div class="relKpis">'+
    '<div class="rk"><span>Recebimentos</span><b>'+totQ+'</b></div>'+
    '<div class="rk dest"><span>Valor recebido</span><b>R$ '+money(totV)+'</b></div>'+
    '<div class="rk"><span>Taxas das maquininhas</span><b class="vr">R$ '+money(totT)+'</b></div>'+
    '<div class="rk"><span>Líquido</span><b class="vg">R$ '+money(totV-totT)+'</b></div>'+
    (semForma?'<div class="rk"><span>Sem forma informada</span><b class="vr">R$ '+money(semForma)+'</b></div>':'')+
   '</div>'+
   '<div class="vpGrade">'+
   '<div class="etTabW plano2" id="relArea">'+
   (lista.length?'<table class="etTab semBusca"><thead><tr>'+
    '<th>Forma de pagamento</th>'+
    '<th style="width:100px;text-align:right">Qtd</th>'+
    '<th style="width:140px;text-align:right">Valor bruto</th>'+
    '<th style="width:110px;text-align:right">Taxa</th>'+
    '<th style="width:140px;text-align:right">Líquido</th>'+
    '<th style="width:90px;text-align:right">Prazo</th>'+
    '<th style="width:150px;text-align:right">% do faturamento</th></tr></thead><tbody>'+
    lista.map(function(x){
      var pc=totalFat?(x.valor/totalFat*100):0;
      return '<tr><td><b>'+E(x.nome)+'</b>'+
       (x.taxaPct||x.taxaFixa?'<small style="display:block;color:var(--ink-3)">taxa '+
         (x.taxaPct?fmtQt(x.taxaPct)+'%':'')+
         (x.taxaFixa?(x.taxaPct?' + ':'')+'R$ '+money(x.taxaFixa)+' por venda':'')+'</small>':'')+'</td>'+
      '<td style="text-align:right">'+x.qtd+'</td>'+
      '<td style="text-align:right"><b>R$ '+money(x.valor)+'</b></td>'+
      '<td style="text-align:right" class="'+(x.taxa?'vr':'')+'">'+(x.taxa?'R$ '+money(x.taxa):'—')+'</td>'+
      '<td style="text-align:right"><b class="vg">R$ '+money(x.liquido)+'</b></td>'+
      '<td style="text-align:right">'+(x.prazo?x.prazo+' dias':'na hora')+'</td>'+
      '<td style="text-align:right"><span class="hpBar"><i style="width:'+Math.min(100,pc)+'%"></i></span>'+
       '<small>'+pc.toFixed(1).replace('.',',')+'%</small></td></tr>';
    }).join('')+'</tbody>'+
    '<tfoot><tr><td><b>Total</b></td>'+
    '<td style="text-align:right"><b>'+totQ+'</b></td>'+
    '<td style="text-align:right"><b>R$ '+money(totV)+'</b></td>'+
    '<td style="text-align:right"><b class="vr">R$ '+money(totT)+'</b></td>'+
    '<td style="text-align:right"><b class="vg">R$ '+money(totV-totT)+'</b></td>'+
    '<td></td><td style="text-align:right"><b>'+
     (totalFat?(totV/totalFat*100).toFixed(1).replace('.',','):'0')+'%</b></td></tr></tfoot></table>'
   :'<div class="mvVazio">'+sv('box',26)+'<b>Nenhum recebimento no período</b></div>')+
   '</div>'+
   (lista.length?'<aside class="vpPizza">'+
    '<div class="ivAdicH">'+sv('chart',13)+' Participação</div>'+
    '<div class="vpBarras">'+lista.map(function(x,k){
      var pc=totV?(x.valor/totV*100):0;
      return '<div class="vpB"><div class="vpBt"><span>'+E(x.nome)+'</span>'+
      '<b>'+pc.toFixed(1).replace('.',',')+'%</b></div>'+
      '<div class="vpBar"><i style="width:'+pc+'%;background:'+
       ['#00A08B','#2C6FD1','#B8730B','#8B5CF6','#C94141','#0E8A46'][k%6]+'"></i></div>'+
      '<small>R$ '+money(x.valor)+'</small></div>';
    }).join('')+'</div></aside>':'')+
   '</div></div></div>';
  rodape(totQ+' recebimentos · R$ '+money(totV));
}
function togVP(f){togFiltro(VP.formas,f);telaVendasFormaPag();}
function togVPc(c){togFiltro(VP.canais,c);telaVendasFormaPag();}
function togTodosVP(){VP.formas=VP.formas.length?[]:(DB.formasPag||[]).map(function(f){return f.id});telaVendasFormaPag();}
function togTodosVPc(){VP.canais=VP.canais.length?[]:Object.keys(canaisVenda());telaVendasFormaPag();}
function limparVP(){VP.formas=[];VP.canais=[];telaVendasFormaPag();}
function perVP(n){
  var d=new Date();
  if(n===0){VP.de=new Date(d.getFullYear(),d.getMonth(),1).toISOString().slice(0,10);VP.ate=hojeISO();}
  else {VP.de=new Date(d.getFullYear(),d.getMonth()-1,1).toISOString().slice(0,10);
    VP.ate=new Date(d.getFullYear(),d.getMonth(),0).toISOString().slice(0,10);}
  telaVendasFormaPag();
}
function explicaVendasFormaPag(){
  explicaRel('Vendas por Forma de Pagamento — como é feito',[
   ['Forma de pagamento','vem do cadastro em Financeiro › Formas de Pagamento, escolhida no fechamento da venda'],
   ['Qtd','quantos recebimentos foram feitos naquela forma — um pedido pode ter mais de uma'],
   ['Valor bruto','soma do que foi pago naquela forma, antes de qualquer desconto de taxa'],
   ['Taxa','calculada pelo que está no cadastro da forma: percentual sobre o valor mais valor fixo por venda'],
   ['Líquido','o que efetivamente entra na conta depois da taxa da maquininha'],
   ['Prazo','dias até o dinheiro cair, conforme cadastrado na forma de pagamento'],
   ['% do faturamento','valor daquela forma dividido pelo faturamento total do período']
  ],'os pagamentos registrados em cada pedido do PDV, cruzados com o cadastro de formas '+
    'de pagamento — de onde vêm a taxa e o prazo.',
   'pedidos cancelados e pedidos sem forma de pagamento informada, que aparecem em '+
   'indicador próprio no topo. A taxa é calculada, não é o valor real cobrado pela operadora.');
}
function exportarFormaPag(){
  var l=[['Forma','Qtd','Valor bruto','Taxa','Liquido','Prazo','% faturamento']];
  var trs=document.querySelectorAll('#relArea tbody tr');
  for(var i=0;i<trs.length;i++){
    var td=trs[i].querySelectorAll('td');
    l.push([td[0].innerText.split('\n')[0],td[1].innerText,td[2].innerText,
      td[3].innerText,td[4].innerText,td[5].innerText,td[6].innerText]);
  }
  baixarCSV('nexor-vendas-forma-pagamento.csv',l);
}


/* ==========================================================
   GERADOR DE VENDAS DE DEMONSTRAÇÃO
   ========================================================== */
function telaGerarDemo(){
  baseMov();baseFormas();
  var qtd=(DB.pedidos||[]).filter(function(p){return p.demo}).length;
  var qmov=(DB.movEst||[]).filter(function(x){return x.demo}).length;
  $('content').innerHTML='<div class="finWrap">'+
  '<div class="finTop"><div><h1>Gerar Vendas de Demonstração</h1>'+
  '<p>Cria vendas fictícias nos últimos meses para você ver os relatórios e gráficos preenchidos.</p></div></div>'+
  '<div class="cfgCard"><div class="h"><div class="ic2">'+sv('chart',16)+'</div>'+
  '<div><b>Criar vendas de teste</b><span>gera pedidos com cidades, formas de pagamento e '+
  'produtos variados nos últimos 6 meses</span></div></div>'+
  '<div class="b">'+
   '<div class="row2">'+
    '<div class="fld2" style="margin:0"><label>Quantos meses para trás</label>'+
     '<input id="gdMeses" type="number" min="1" max="24" value="6"></div>'+
    '<div class="fld2" style="margin:0"><label>Vendas por dia (média)</label>'+
     '<input id="gdDia" type="number" min="1" max="200" value="18"></div>'+
   '</div>'+
   '<div class="avisoCfg" style="margin-top:12px">'+sv('help',15)+
   '<div>As vendas criadas ficam marcadas como demonstração e podem ser apagadas a qualquer momento, '+
   'sem afetar o que você cadastrou de verdade.</div></div>'+
   '<button class="btnP2 ok" style="margin-top:12px" onclick="gerarVendasDemo()">'+
    sv('plus',13)+' Gerar vendas</button>'+
  '</div></div>'+
  (qtd?'<div class="cfgCard" style="border-color:var(--red)"><div class="h">'+
   '<div class="ic2" style="background:var(--red-soft);color:var(--red)">'+sv('trash',16)+'</div>'+
   '<div><b>Apagar dados de demonstração</b><span>'+qtd+' venda(s) e '+qmov+' movimentação(ões) de teste</span></div></div>'+
   '<div class="b"><button class="btnP2 rdB" onclick="apagarVendasDemo()">Apagar dados de demonstração</button>'+
   '</div></div>':'')+
  '</div>';
  rodape(qtd?qtd+' vendas de demonstração':'');
}
function gerarVendasDemo(){
  baseMov();baseFormas();
  /* garante que todas as listas existem */
  ['pedidos','produtos','categorias','clientes','entregadores','movEst','formasPag','sucursais']
    .forEach(function(k){ DB[k]=DB[k]||[]; });
  baseSuc();
  /* Nao inventa mais unidade nenhuma. Antes criava "Jolô Três Fronteiras",
     "Rafaellos Shopping" e outras duas — fixas, com nome de cliente real —
     em QUALQUER empresa que clicasse em gerar demonstracao. A demonstracao
     usa as unidades que a propria loja tem. */
  if(!DB.sucursais.length){
    toast('Cadastre ao menos uma unidade antes de gerar a demonstração.');
    return;
  }
  var meses=parseInt($('gdMeses').value)||6;
  var porDia=parseInt($('gdDia').value)||18;
  var cidades=cidadesCadastradas();
  if(!cidades.length)cidades=['Santa Fé do Sul','Jales','Rubinéia','Três Fronteiras'];
  var formas=(DB.formasPag||[]).filter(function(f){return f.ativa!==false});
  if(!formas.length){toast('Cadastre as formas de pagamento antes.');return;}
  /* cria o que faltar, para o gerador nunca parar */
  if(!(DB.categorias||[]).length){
    DB.categorias=[{id:'cat_demo1',nome:'Cascões',cor:'#00A08B',ativo:true,ordem:0,demo:true},
      {id:'cat_demo2',nome:'Potes',cor:'#2C6FD1',ativo:true,ordem:1,demo:true},
      {id:'cat_demo3',nome:'Bebidas',cor:'#B8730B',ativo:true,ordem:2,demo:true}];
  }
  if(!(DB.produtos||[]).length){
    DB.produtos=[
     {id:'pd1',nome:'Cascão 1 bola',preco:12,categoriaId:DB.categorias[0].id,ativo:true,ordem:0,demo:true,disponivel:{},promocoes:[]},
     {id:'pd2',nome:'Cascão 2 bolas',preco:18,categoriaId:DB.categorias[0].id,ativo:true,ordem:1,demo:true,disponivel:{},promocoes:[]},
     {id:'pd3',nome:'Cascão 3 bolas',preco:24,categoriaId:DB.categorias[0].id,ativo:true,ordem:2,demo:true,disponivel:{},promocoes:[]},
     {id:'pd4',nome:'Pote 500ml',preco:32,categoriaId:DB.categorias[1].id,ativo:true,ordem:0,demo:true,disponivel:{},promocoes:[]},
     {id:'pd5',nome:'Pote 1 litro',preco:58,categoriaId:DB.categorias[1].id,ativo:true,ordem:1,demo:true,disponivel:{},promocoes:[]},
     {id:'pd6',nome:'Água mineral',preco:5,categoriaId:DB.categorias[2].id,ativo:true,ordem:0,demo:true,disponivel:{},promocoes:[]},
     {id:'pd7',nome:'Refrigerante lata',preco:7,categoriaId:DB.categorias[2].id,ativo:true,ordem:1,demo:true,disponivel:{},promocoes:[]}];
  }
  if(!(DB.clientes||[]).length){
    ['Maria Silva','João Pereira','Ana Souza','Carlos Lima','Fernanda Rocha',
     'Paulo Dias','Juliana Alves','Marcos Antunes'].forEach(function(nm,i){
      DB.clientes.push({id:'cli_d'+i,nome:nm,tel:'1799900'+String(1000+i),
        rua:'Rua Exemplo',numero:String(100+i),bairro:'Centro',
        cidade:cidades[i%cidades.length],compras:0,gasto:0,
        limiteFiado:0,saldoFiado:0,demo:true});
    });
  }
  if(!(DB.entregadores||[]).length){
    DB.entregadores.push({id:'ent_d1',nome:'Entregador Demo',tel:'17999000000',
      ativo:true,padrao:true,diarias:{},demo:true,
      taxas:cidades.map(function(c,i){return {id:'tx'+i,cidade:c,valor:[5,6,8,10][i%4]}})});
  }
  var prods=(DB.produtos||[]);
  var clientes=(DB.clientes||[]);
  var hoje=new Date();
  var criados=0, num=(DB.pedidos||[]).reduce(function(a,p){return Math.max(a,Number(p.numero)||0)},0);

  for(var m=meses-1;m>=0;m--){
    var ini=new Date(hoje.getFullYear(),hoje.getMonth()-m,1);
    var fim=new Date(hoje.getFullYear(),hoje.getMonth()-m+1,0);
    if(m===0)fim=hoje;
    var cresc=1+((meses-1-m)*0.06);          /* cresce ~6% ao mês */
    for(var d=new Date(ini);d<=fim;d.setDate(d.getDate()+1)){
      var dia=d.getDay();
      var peso=(dia===5||dia===6)?1.6:(dia===0?1.3:1);   /* fim de semana vende mais */
      var n=Math.max(1,Math.round(porDia*peso*cresc*(0.8+Math.random()*0.4)));
      for(var k=0;k<n;k++){
        var entrega=Math.random()<0.32;
        var itens=[],total=0;
        var qi=1+Math.floor(Math.random()*3);
        for(var z=0;z<qi;z++){
          var pr=prods[Math.floor(Math.random()*prods.length)];
          var q=1+Math.floor(Math.random()*2);
          var v=(Number(pr.preco)||10)*q;
          total+=v;
          itens.push({produtoId:pr.id,nome:pr.nome,qtd:q,unitario:Number(pr.preco)||10,
            total:v,obs:'',opcoes:[]});
        }
        var taxa=entrega?[5,6,8,10][Math.floor(Math.random()*4)]:0;
        var desc=Math.random()<0.12?[2,3,5][Math.floor(Math.random()*3)]:0;
        total=total+taxa-desc;
        var f=formas[Math.floor(Math.random()*formas.length)];
        var cl=clientes.length?clientes[Math.floor(Math.random()*clientes.length)]:null;
        num++;
        var sucL=DB.sucursais[Math.floor(Math.random()*DB.sucursais.length)];
        var canalR=Math.random();
        DB.pedidos.push({id:uid('ped'),numero:num,demo:true,
          sucursalId:sucL.id,
          canal:(entrega&&canalR<0.35)?'whatsapp':((entrega&&canalR<0.6)?'cardapio':''),
          data:d.toISOString().slice(0,10),
          hora:String(10+Math.floor(Math.random()*12)).padStart(2,'0')+':'+
               String(Math.floor(Math.random()*60)).padStart(2,'0'),
          tipo:entrega?'entrega':'loja',fase:'entregue',
          cidade:entrega?cidades[Math.floor(Math.random()*cidades.length)]:'',
          clienteId:cl?cl.id:'',clienteNome:cl?cl.nome:'',
          total:+total.toFixed(2),taxa:taxa,desconto:desc,
          itens:itens,pagamentos:[{formaId:f.id,valor:+total.toFixed(2)}]});
        criados++;
      }
    }
  }
  /* consumo de estoque e produções, para alimentar os relatórios de custo */
  var movs=0;
  var insumosOk=(DB.insumos||[]).filter(function(i){return i.controlaEstoque!==false});
  var fichasOk=fichasProduziveis();
  if(insumosOk.length){
    DB.pedidos.filter(function(p){return p.demo}).forEach(function(p){
      if(Math.random()>0.55)return;                 /* nem toda venda gera linha */
      var linhas=[];
      var qi=1+Math.floor(Math.random()*3);
      for(var z=0;z<qi;z++){
        var ins=insumosOk[Math.floor(Math.random()*insumosOk.length)];
        var q=+(0.05+Math.random()*0.4).toFixed(3);
        linhas.push({insumoId:ins.id,nome:ins.nome,unidade:ins.unidade,qtd:q,
          custo:custoAtual(ins),direcao:'saida',origem:'venda'});
      }
      DB.movEst.push({id:uid('mv'),sucursalId:lojaAtualId(),data:p.data,hora:p.hora,motivoId:'mv_venda',
        identificacao:'Pedido #'+p.numero,obs:'',linhas:linhas,origem:'venda',
        pedidoId:p.id,demo:true});
      movs++;
    });
  }
  if(fichasOk.length){
    for(var mm=meses-1;mm>=0;mm--){
      var base=new Date(hoje.getFullYear(),hoje.getMonth()-mm,1);
      for(var dd=1;dd<=26;dd+=3){
        var dia=new Date(base.getFullYear(),base.getMonth(),dd);
        if(dia>hoje)break;
        var f=fichasOk[Math.floor(Math.random()*fichasOk.length)];
        var itensP=[{tipo:'ficha',refId:f.id,qtd:Number(f.rendimento)||1,
          unidade:f.rendUnidade||f.unidade,custo:0}];
        var lin=montarLinhas(itensP,'producao');
        if(!lin.length)continue;
        lin.forEach(function(l){l.demo=true});
        var mv2={id:uid('mv'),data:dia.toISOString().slice(0,10),hora:'09:00',
          motivoId:motivoProduzir(),identificacao:'Produção demo',obs:'',
          linhas:lin,origem:'producao',demo:true};
        DB.movEst.push(mv2);
        aplicarMovimento(mv2);
        movs++;
      }
    }
  }
  salvar();
  telaGerarDemo();
  toast(criados+' vendas e '+movs+' movimentações criadas nos últimos '+meses+' meses.');
}
async function apagarVendasDemo(){
  var q=(DB.pedidos||[]).filter(function(p){return p.demo}).length;
  var m=(DB.movEst||[]).filter(function(x){return x.demo}).length;
  if(!await pergunta('Apagar '+q+' venda(s) e '+m+' movimentação(ões) de demonstração?\n\n'+
    'Os cadastros criados junto (produtos, clientes) também serão removidos.'))return;
  (DB.movEst||[]).filter(function(x){return x.demo}).forEach(function(x){
    try{aplicarMovimento(x,true);}catch(e){_quieto(e,'apagarVendasDemo')}
  });
  DB.movEst=(DB.movEst||[]).filter(function(x){return !x.demo});
  DB.pedidos=(DB.pedidos||[]).filter(function(p){return !p.demo});
  DB.produtos=(DB.produtos||[]).filter(function(p){return !p.demo});
  DB.categorias=(DB.categorias||[]).filter(function(c){return !c.demo});
  DB.clientes=(DB.clientes||[]).filter(function(c){return !c.demo});
  DB.entregadores=(DB.entregadores||[]).filter(function(e){return !e.demo});
  DB.sucursais=(DB.sucursais||[]).filter(function(x){return !x.demo});
  salvar();telaGerarDemo();
  toast('Dados de demonstração apagados.');
}


/* ==========================================================
   CONFIRMAÇÃO E AVISO — no lugar das caixas do navegador
   ========================================================== */
/* Aviso no padrão do Nexor, no meio da tela. Substitui a janela cinza do
   navegador, que muda de cara em cada máquina e mostra o endereço do site. */
function aviso(msg,titulo,tipo){
  return new Promise(function(resolve){
    var txt=String(msg==null?'':msg);
    var linhas=txt.split('\n');
    var t=titulo||'';
    if(!t&&linhas.length>1&&linhas[0].length<=70){t=linhas.shift().replace(/\s*[—-]\s*$/,'');}
    var corpo=linhas.join('\n').replace(/^\n+|\n+$/g,'');
    tipo=tipo||(/insuficiente|não pode|nao pode|erro|falha|atenção|atencao/i.test(txt)?'perigo':'info');
    var ic=tipo==='perigo'?'help':'help';
    var cor=tipo==='perigo'?'var(--red)':'var(--blue)';
    var fundo=tipo==='perigo'?'var(--red-soft)':'var(--blue-soft)';
    var h='<div class="cfBox">'+
     '<div class="cfTopo">'+
      '<div class="cfIc" style="background:'+fundo+';color:'+cor+'">'+sv(ic,22)+'</div>'+
      '<div><b>'+E(t||'Aviso')+'</b></div></div>'+
     (corpo?'<div class="cfTexto">'+E(corpo)+'</div>':'')+
     '<div class="cfBt"><button class="btnP2 ok" onclick="_respAviso()">Entendi</button></div>'+
    '</div>';
    var ov=document.createElement('div');
    ov.className='mdOv cfOv';ov.id='avOv';
    ov.innerHTML=h;
    document.body.appendChild(ov);
    var fim=function(){
      var o=document.getElementById('avOv');if(o)o.remove();
      document.removeEventListener('keydown',esc);
      window._respAviso=null;resolve(true);
    };
    window._respAviso=fim;
    var esc=function(e){ if(e.key==='Escape'||e.key==='Enter')fim(); };
    document.addEventListener('keydown',esc);
    ov.addEventListener('mousedown',function(e){ if(e.target===ov)fim(); });
    setTimeout(function(){var b=ov.querySelector('button');if(b)b.focus();},40);
  });
}
/* qualquer alert() do sistema passa a abrir a janela do Nexor */
window.alert=function(m){ try{aviso(m)}catch(e){console.log(m)} };
/* Pergunta de sim/nao no padrao do Nexor, no lugar da caixa cinza do navegador.
   Mesma caixa do aviso, com dois botoes. */
function pergunta(msg,ok,tipo){
  var txt=String(msg==null?'':msg);
  var linhas=txt.split('\n');
  var t=(linhas.length>1&&linhas[0].length<=70)?linhas.shift():'';
  var corpo=linhas.join('\n').replace(/^\n+|\n+$/g,'');
  if(!t){t=corpo;corpo='';}
  return confirmar({
    titulo:t||'Confirmar',
    texto:'',
    aviso:corpo?E(corpo).replace(/\n/g,'<br>'):'',
    ok:ok||'Confirmar',
    tipo:tipo||(/excluir|apagar|remover|substitui|limpar|sair/i.test(txt)?'perigo':'pergunta')
  });
}
function confirmar(op){
  /* op: {titulo, texto, linhas:[[rotulo,valor,cor]], aviso, ok, cancelar, tipo, aoConfirmar} */
  return new Promise(function(resolve){
    var tipo=op.tipo||'pergunta';
    var ic={pergunta:'help',perigo:'trash',check:'check',info:'help'}[tipo]||'help';
    var cor={pergunta:'var(--acc)',perigo:'var(--red)',check:'var(--acc)',info:'var(--blue)'}[tipo];
    var fundo={pergunta:'var(--acc-soft)',perigo:'var(--red-soft)',
               check:'var(--acc-soft)',info:'var(--blue-soft)'}[tipo];
    var h='<div class="cfBox">'+
     '<div class="cfTopo">'+
      '<div class="cfIc" style="background:'+fundo+';color:'+cor+'">'+sv(ic,22)+'</div>'+
      '<div><b>'+E(op.titulo||'Confirmar')+'</b>'+
      (op.texto?'<span>'+E(op.texto)+'</span>':'')+'</div></div>'+
     ((op.linhas&&op.linhas.length)?'<div class="cfLinhas">'+op.linhas.map(function(l){
        return '<div class="cfL"><span>'+E(l[0])+'</span>'+
        '<b class="'+(l[2]||'')+'">'+E(l[1])+'</b></div>';}).join('')+'</div>':'')+
     (op.aviso?'<div class="cfAviso">'+sv('help',14)+'<div>'+op.aviso+'</div></div>':'')+
     '<div class="cfBt">'+
      '<button class="btnP2" onclick="_respConfirma(false)">'+E(op.cancelar||'Cancelar')+'</button>'+
      '<button class="btnP2 '+(tipo==='perigo'?'rdB':'ok')+'" onclick="_respConfirma(true)">'+
       E(op.ok||'Confirmar')+'</button>'+
     '</div></div>';
    var ov=document.createElement('div');
    ov.className='mdOv cfOv';ov.id='cfOv';
    ov.innerHTML=h;
    document.body.appendChild(ov);
    window._respConfirma=function(v){
      var chk=document.getElementById('cfAjEst');
      window._cfAjEst=chk?chk.checked:undefined;
      var o=document.getElementById('cfOv');if(o)o.remove();
      window._respConfirma=null;
      resolve(v);
      if(v&&op.aoConfirmar)op.aoConfirmar();
    };
    var esc=function(e){
      if(e.key==='Escape'){document.removeEventListener('keydown',esc);_respConfirma(false);}
      if(e.key==='Enter'){document.removeEventListener('keydown',esc);_respConfirma(true);}
    };
    document.addEventListener('keydown',esc);
    ov.addEventListener('mousedown',function(e){ if(e.target===ov)_respConfirma(false); });
  });
}
function avisar(titulo,texto,tipo){
  return confirmar({titulo:titulo,texto:texto,tipo:tipo||'info',
    ok:'Entendi',cancelar:null}).then(function(){});
}

/* ==========================================================
   6 — VENDAS POR PERÍODO
   ========================================================== */
var VPE={de:'',ate:'',canais:[],cupons:[],formas:[],ordem:'data'};
function telaVendasPeriodo(){
  baseMov();baseFormas();
  if(!VPE.de){var d=new Date();
    VPE.de=new Date(d.getFullYear(),d.getMonth(),1).toISOString().slice(0,10);
    VPE.ate=hojeISO();}
  var todos=pedidosFiltrados(VPE);
  if(VPE.cupons.length)
    todos=todos.filter(function(p){return p.cupomCodigo&&VPE.cupons.indexOf(p.cupomCodigo)>=0});
  if(VPE.formas.length)
    todos=todos.filter(function(p){
      return (p.pagamentos||[]).some(function(g){
        return VPE.formas.indexOf(g.formaId||g.forma)>=0})});
  var peds=todos.filter(function(p){return !ehCancelado(p)});
  var canc=todos.filter(function(p){return ehCancelado(p)});

  /* ---- indicadores ---- */
  function soma(arr,fn){return arr.reduce(function(a,p){return a+(fn(p)||0)},0)}
  var ent=peds.filter(function(p){return p.tipo==='entrega'});
  var loja=peds.filter(function(p){return p.tipo!=='entrega'});
  var vTotal=soma(peds,function(p){return Number(p.total)||0});
  var vEnt=soma(ent,function(p){return Number(p.total)||0});
  var vLoja=soma(loja,function(p){return Number(p.total)||0});
  var vItens=soma(peds,function(p){
    return (p.itens||[]).reduce(function(a,i){return a+(Number(i.total)||0)},0)});
  var qItens=soma(peds,function(p){
    return (p.itens||[]).reduce(function(a,i){return a+(Number(i.qtd)||0)},0)});
  var vTaxa=soma(peds,function(p){return Number(p.taxa)||0});
  var vAcr=soma(peds,function(p){return Number(p.acrescimo)||0});
  var vDesc=soma(peds,function(p){return Number(p.desconto)||0});
  var vCup=soma(peds,function(p){return Number(p.cupomValor)||0});
  var comCupom=peds.filter(function(p){return p.cupomCodigo});
  var clientes={};peds.forEach(function(p){ if(p.clienteId)clientes[p.clienteId]=true; });
  function porCanal(c){return peds.filter(function(p){return (p.canal||'')===c}).length}

  var IND=[
   ['Total de pedidos',peds.length,'','quantidade de vendas concluídas no período, sem contar canceladas'],
   ['Pedidos cancelados',canc.length,canc.length?'vr':'','pedidos que foram para a fase Cancelado no PDV'],
   ['Faturamento total','R$ '+money(vTotal),'dest','soma do valor final de cada pedido, já com taxa, acréscimo e desconto'],
   ['Ticket médio geral','R$ '+money(peds.length?vTotal/peds.length:0),'','faturamento dividido pela quantidade de pedidos'],
   ['Ticket médio da entrega','R$ '+money(ent.length?vEnt/ent.length:0),'','faturamento das entregas dividido pela quantidade de entregas'],
   ['Ticket médio do balcão','R$ '+money(loja.length?vLoja/loja.length:0),'','faturamento do salão dividido pela quantidade de vendas no balcão'],
   ['Pedidos na frente de caixa',loja.length,'','vendas do tipo salão ou balcão, feitas no PDV'],
   ['Pedidos de entrega',ent.length,'','vendas do tipo entrega, com endereço e taxa'],
   ['Clientes que compraram',Object.keys(clientes).length,'','clientes diferentes identificados nas vendas — quem comprou sem se identificar não entra'],
   ['Total em itens','R$ '+money(vItens),'','soma do valor dos produtos, sem taxa de entrega nem acréscimo'],
   ['Quantidade de itens',fmtQt(qItens),'','soma das quantidades de todos os produtos vendidos'],
   ['Taxa de entrega','R$ '+money(vTaxa),'','taxas cobradas nas entregas, conforme a cidade do cliente'],
   ['Acréscimos','R$ '+money(vAcr),'','valores somados no fechamento do pedido'],
   ['Descontos','R$ '+money(vDesc),vDesc?'vr':'','descontos concedidos no fechamento, incluindo cupons'],
   ['Pedidos pelo cardápio digital',porCanal('cardapio'),'','pedidos vindos do cardápio online — disponível quando o módulo for publicado'],
   ['Pedidos pelo WhatsApp',porCanal('whatsapp'),'','pedidos vindos do robô do WhatsApp — disponível quando o módulo for publicado']
  ];

  /* ---- lista de pedidos ---- */
  var lista=todos.slice().sort(function(a,b){
    if(VPE.ordem==='valor')return (Number(b.total)||0)-(Number(a.total)||0);
    return (String(a.data)+String(a.hora)).localeCompare(String(b.data)+String(b.hora));
  });
  var cupons=(DB.cupons||[]).map(function(c){
    var q=(DB.pedidos||[]).filter(function(p){return p.cupomCodigo===c.codigo}).length;
    return {id:c.codigo,nome:c.codigo,n:q||''};
  });
  var canais=canaisVenda();

  $('content').innerHTML='<div class="etWrap"><div class="etScroll">'+
   '<div class="etTopo">'+
    '<div><h1>Vendas por Período</h1>'+
    '<p>Todos os números do período, pedido a pedido — a base da apresentação de resultado.</p></div>'+
    '<button class="infoBt" onclick="explicaVendasPeriodo()">'+sv('help',15)+'</button>'+
    '<div style="flex:1"></div>'+
    '<button class="btnP2" onclick="imprimirRel(\'Vendas por Período\')">'+sv('print2',13)+' PDF</button>'+
    '<button class="btnP2" onclick="exportarPeriodo()">'+sv('down2',13)+' Exportar</button>'+
   '</div>'+
   '<div class="barraF">'+
    '<div class="bfCampo"><label>De</label><input type="date" id="vpeDe" value="'+VPE.de+'"></div>'+
    '<div class="bfCampo"><label>Até</label><input type="date" id="vpeAte" value="'+VPE.ate+'"></div>'+
    selMulti('vpeCan','Canal de venda',
      Object.keys(canais).map(function(k){return {id:k,nome:canais[k]}}),
      VPE.canais,'togVPE','togTodosVPE(\'canais\')')+
    selMulti('vpeCup','Cupom de desconto',cupons,VPE.cupons,'togVPEcup','togTodosVPE(\'cupons\')')+
    selMulti('vpeFor','Forma de pagamento',
      (DB.formasPag||[]).map(function(f){return {id:f.id,nome:f.nome}}),
      VPE.formas,'togVPEfor','togTodosVPE(\'formas\')')+
    '<button class="btnP2 ok" onclick="VPE.de=$(\'vpeDe\').value;VPE.ate=$(\'vpeAte\').value;telaVendasPeriodo()">'+
     sv('search',13)+' Buscar</button>'+
    '<div class="bfAtalhos">'+
     '<button onclick="perVPE(0)">Mês</button>'+
     '<button onclick="perVPE(-1)">Anterior</button>'+
     '<button onclick="perVPE(7)">7d</button>'+
     (VPE.canais.length||VPE.cupons.length||VPE.formas.length
       ?'<button class="lim" onclick="limparVPE()">limpar</button>':'')+
    '</div>'+
   '</div>'+
   (VPE.cupons.length||comCupom.length?
    '<div class="cupBox">'+
     '<div class="cupIc">'+sv('copy',16)+'</div>'+
     '<div class="cupT"><b>Cupons de desconto</b>'+
      '<span>'+(VPE.cupons.length?'filtrando por '+VPE.cupons.join(', '):'todos os cupons do período')+'</span></div>'+
     '<div class="cupN"><span>Vendas com cupom</span><b>'+comCupom.length+'</b></div>'+
     '<div class="cupN"><span>Valor dessas vendas</span><b>R$ '+
      money(soma(comCupom,function(p){return Number(p.total)||0}))+'</b></div>'+
     '<div class="cupN"><span>Desconto concedido</span><b class="vr">R$ '+money(vCup||vDesc)+'</b></div>'+
    '</div>':'')+
   '<div class="painelInd">'+
    '<div class="piH">Resumo do período'+
     '<span class="piSub">'+dataBR(VPE.de)+' a '+dataBR(VPE.ate)+'</span></div>'+
    '<div class="piGrade">'+
    IND.map(function(x,k){
      return '<div class="piIt'+(x[2]==='dest'?' dest':'')+'">'+
       '<span class="piT">'+E(x[0])+
        '<button class="piI" onclick="dicaInd(event,'+k+')" title="o que é isso">i</button></span>'+
       '<b class="'+(x[2]&&x[2]!=='dest'?x[2]:'')+'">'+E(String(x[1]))+'</b></div>';
    }).join('')+
    '</div></div>'+
   '<div class="etTabW plano2" id="relArea">'+
   (lista.length?'<table class="etTab semBusca"><thead><tr>'+
    '<th style="width:70px">Pedido</th>'+
    '<th style="width:110px">Data</th><th style="width:70px">Hora</th>'+
    '<th>Cliente</th>'+
    '<th style="width:150px">Pagamento</th>'+
    '<th style="width:120px">Tipo</th>'+
    '<th style="width:110px;text-align:right">Itens</th>'+
    '<th style="width:100px;text-align:right">Taxa</th>'+
    '<th style="width:110px;text-align:right">Acr. / Desc.</th>'+
    '<th style="width:120px;text-align:right">Total</th>'+
    '<th style="width:50px"></th></tr></thead><tbody>'+
    lista.slice(0,500).map(function(p){
      var pg=(p.pagamentos||[]).map(function(g){
        var f=(DB.formasPag||[]).find(function(x){return x.id===(g.formaId||g.forma)});
        return f?f.nome:'—';}).join(', ');
      var vi=(p.itens||[]).reduce(function(a,i){return a+(Number(i.total)||0)},0);
      var canc2=(ehCancelado(p));
      return '<tr class="'+(canc2?'linCanc':'')+'" style="cursor:pointer" onclick="verPedidoRel(\''+p.id+'\')">'+
      '<td><b>#'+E(p.numero)+'</b></td>'+
      '<td>'+dataBR(p.data)+'</td><td>'+E(p.hora||'')+'</td>'+
      '<td>'+E(p.clienteNome||'Não identificado')+
       (p.cupomCodigo?'<small style="color:var(--acc-d)">cupom '+E(p.cupomCodigo)+'</small>':'')+'</td>'+
      '<td>'+E(pg||'—')+'</td>'+
      '<td>'+(canc2?'<span class="badge2 rd">Cancelado</span>':
        p.tipo==='entrega'?'<span class="cidTag">Entrega'+(p.cidade?' · '+E(p.cidade):'')+'</span>'
        :'<span class="cidTag">Frente de caixa</span>')+'</td>'+
      '<td style="text-align:right">R$ '+money(vi)+'</td>'+
      '<td style="text-align:right">'+(p.taxa?'R$ '+money(p.taxa):'—')+'</td>'+
      '<td style="text-align:right">'+
       (p.acrescimo?'<span class="vg">+'+money(p.acrescimo)+'</span> ':'')+
       (p.desconto?'<span class="vr">-'+money(p.desconto)+'</span>':'')+
       (!p.acrescimo&&!p.desconto?'—':'')+'</td>'+
      '<td style="text-align:right"><b>R$ '+money(p.total)+'</b></td>'+
      '<td onclick="event.stopPropagation()"><button class="rBtn" onclick="verPedidoRel(\''+p.id+'\')" '+
       'title="Ver o pedido">'+sv('eye',12)+'</button></td></tr>';
    }).join('')+'</tbody>'+
    '<tfoot><tr><td colspan="6"><b>'+peds.length+' pedido(s)'+
     (canc.length?' · '+canc.length+' cancelado(s)':'')+
     (lista.length>500?' — mostrando os 500 primeiros':'')+'</b></td>'+
    '<td style="text-align:right"><b>R$ '+money(vItens)+'</b></td>'+
    '<td style="text-align:right"><b>R$ '+money(vTaxa)+'</b></td>'+
    '<td style="text-align:right"><b class="vr">-'+money(vDesc)+'</b></td>'+
    '<td style="text-align:right"><b>R$ '+money(vTotal)+'</b></td><td></td></tr></tfoot></table>'
   :'<div class="mvVazio">'+sv('box',26)+'<b>Nenhum pedido no período</b></div>')+
   '</div></div></div>';
  _dicasInd=IND.map(function(x){return [x[0],x[3]]});
  rodape(peds.length+' pedidos · R$ '+money(vTotal));
}
var _dicasInd=[];
function dicaInd(ev,k){
  ev.stopPropagation();
  fecharPops();
  var d=_dicasInd[k]||['',''];
  pop(ev,'<div class="dicaBox"><b>'+E(d[0])+'</b><span>'+E(d[1])+'</span></div>');
}
function togVPE(c){togFiltro(VPE.canais,c);telaVendasPeriodo();}
function togVPEcup(c){togFiltro(VPE.cupons,c);telaVendasPeriodo();}
function togVPEfor(f){togFiltro(VPE.formas,f);telaVendasPeriodo();}
function togTodosVPE(campo){
  if(campo==='canais')VPE.canais=VPE.canais.length?[]:Object.keys(canaisVenda());
  else if(campo==='cupons')VPE.cupons=VPE.cupons.length?[]:(DB.cupons||[]).map(function(c){return c.codigo});
  else VPE.formas=VPE.formas.length?[]:(DB.formasPag||[]).map(function(f){return f.id});
  telaVendasPeriodo();
}
function limparVPE(){VPE.canais=[];VPE.cupons=[];VPE.formas=[];telaVendasPeriodo();}
function perVPE(n){
  var d=new Date();
  if(n===0){VPE.de=new Date(d.getFullYear(),d.getMonth(),1).toISOString().slice(0,10);VPE.ate=hojeISO();}
  else if(n===-1){VPE.de=new Date(d.getFullYear(),d.getMonth()-1,1).toISOString().slice(0,10);
    VPE.ate=new Date(d.getFullYear(),d.getMonth(),0).toISOString().slice(0,10);}
  else {VPE.de=diasAtrasISO(n);VPE.ate=hojeISO();}
  telaVendasPeriodo();
}
/* ver o pedido completo */
function verPedidoRel(id){
  var p=(DB.pedidos||[]).find(function(x){return x.id===id});
  if(!p)return;
  var vi=(p.itens||[]).reduce(function(a,i){return a+(Number(i.total)||0)},0);
  var pg=(p.pagamentos||[]).map(function(g){
    var f=(DB.formasPag||[]).find(function(x){return x.id===(g.formaId||g.forma)});
    return {nome:f?f.nome:'—',valor:Number(g.valor)||0};});
  var h='<div class="mdB">'+
  '<div class="acHead"><div class="av3" style="width:42px;height:42px">'+sv('cart',18)+'</div>'+
  '<div><b>Pedido #'+E(p.numero)+'</b>'+
   '<span>'+dataBR(p.data)+' às '+E(p.hora||'')+' · '+
    (p.tipo==='entrega'?'Entrega'+(p.cidade?' para '+E(p.cidade):''):'Frente de caixa')+'</span>'+
   '<span>'+E(p.clienteNome||'Cliente não identificado')+'</span></div>'+
  '<div style="text-align:right"><span class="hint">Total</span>'+
   '<b style="display:block;font-size:20px;color:var(--acc-d)">R$ '+money(p.total)+'</b></div></div>'+
  '<div class="blk" style="margin:0 0 11px;max-width:none;padding:0;overflow:hidden">'+
   '<div class="acTit">Itens do pedido</div>'+
   '<table class="acTab"><thead><tr><th>Produto</th>'+
   '<th style="width:80px;text-align:right">Qtd</th>'+
   '<th style="width:110px;text-align:right">Unitário</th>'+
   '<th style="width:110px;text-align:right">Total</th></tr></thead><tbody>'+
   (p.itens||[]).map(function(i2){
     return '<tr><td><b>'+E(i2.nome)+'</b>'+
     ((i2.opcoes||[]).length?'<small style="display:block;color:var(--ink-3)">'+
       (i2.opcoes||[]).map(function(o){return E(o.nome||o)}).join(' · ')+'</small>':'')+
     (i2.obs?'<small style="display:block;color:var(--ink-3)">obs: '+E(i2.obs)+'</small>':'')+'</td>'+
     '<td style="text-align:right">'+fmtQt(i2.qtd)+'</td>'+
     '<td style="text-align:right">R$ '+money(i2.unitario)+'</td>'+
     '<td style="text-align:right"><b>R$ '+money(i2.total)+'</b></td></tr>';
   }).join('')+'</tbody></table></div>'+
  '<div class="blk" style="margin:0;max-width:none"><h3>Fechamento</h3>'+
   '<div class="linha"><span>Itens</span><b>R$ '+money(vi)+'</b></div>'+
   (p.taxa?'<div class="linha"><span>Taxa de entrega</span><b>R$ '+money(p.taxa)+'</b></div>':'')+
   (p.acrescimo?'<div class="linha"><span>Acréscimo</span><b class="vg">+ R$ '+money(p.acrescimo)+'</b></div>':'')+
   (p.desconto?'<div class="linha"><span>Desconto'+
     (p.cupomCodigo?' (cupom '+E(p.cupomCodigo)+')':'')+'</span><b class="vr">- R$ '+money(p.desconto)+'</b></div>':'')+
   '<div class="linha tot"><span>Total do pedido</span><span>R$ '+money(p.total)+'</span></div>'+
   (pg.length?'<div style="margin-top:12px">'+pg.map(function(g){
     return '<div class="linha"><span>'+E(g.nome)+'</span><b>R$ '+money(g.valor)+'</b></div>';
   }).join('')+'</div>':'')+
  '</div></div>';
  var o=document.createElement('div');o.className='mdOv';o.id='mdOv';
  o.innerHTML='<div class="mdBox lg"><div class="mdH"><b>Pedido #'+E(p.numero)+'</b>'+
   '<button onclick="fecharModal()">&times;</button></div>'+h+
   '<div class="mdF"><button class="btnP2" onclick="fecharModal()">Fechar</button></div></div>';
  document.body.appendChild(o);
  fecharSoForaDeVerdade(o);
}
function explicaVendasPeriodo(){
  explicaRel('Vendas por Período — como é feito',[
   ['Total de pedidos','vendas concluídas no PDV, sem contar as canceladas'],
   ['Ticket médio','faturamento dividido pela quantidade de pedidos — calculado separado para entrega e balcão'],
   ['Clientes que compraram','clientes diferentes identificados nas vendas; quem comprou sem se identificar não é contado'],
   ['Total em itens','soma do valor dos produtos, sem taxa de entrega nem acréscimo'],
   ['Taxa de entrega','vem da tabela de taxas do entregador, pela cidade do cliente'],
   ['Cupom de desconto','filtra as vendas onde um cupom foi aplicado e mostra o desconto concedido'],
   ['Cardápio digital e WhatsApp','contam os pedidos por canal de origem; ficam em zero até esses módulos existirem'],
   ['Lista de pedidos','cada venda do período — clique na linha para abrir o pedido completo']
  ],'os pedidos registrados no PDV, cruzados com o cadastro de clientes, formas de pagamento '+
    'e cupons. O ticket médio usa o valor final do pedido, já com taxa e desconto.',
   'pedidos cancelados nos totais (aparecem em indicador próprio e marcados na lista), '+
   'lançamentos financeiros que não vieram de venda, e vendas de outras lojas.');
}
function exportarPeriodo(){
  var l=[['Pedido','Data','Hora','Cliente','Pagamento','Tipo','Itens','Taxa','Acrescimo','Desconto','Total']];
  var trs=document.querySelectorAll('#relArea tbody tr');
  for(var i=0;i<trs.length;i++){
    var td=trs[i].querySelectorAll('td');
    l.push([td[0].innerText,td[1].innerText,td[2].innerText,td[3].innerText.split('\n')[0],
      td[4].innerText,td[5].innerText,td[6].innerText,td[7].innerText,'',td[8].innerText,td[9].innerText]);
  }
  baixarCSV('nexor-vendas-periodo.csv',l);
}

/* ==========================================================
   DRE — Demonstrativo de Lucros e Perdas
   ========================================================== */
var RUBRICAS=[
 {c:'01',   n:'FATURAMENTO TOTAL',        t:'tot', base:true},
 {c:'01.01',n:'Vendas Diretas',           t:'sub', auto:'vendas'},
 {c:'01.02',n:'Outras Receitas de Venda', t:'sub'},
 {c:'02',   n:'CPV',                      t:'neg', auto:'compras'},
 {c:'03',   n:'IMPOSTOS',                 t:'neg', auto:'imposto'},
 {c:'04',   n:'Franqueador',              t:'neg', soma:['04.01','04.02']},
 {c:'04.01',n:'Royalties',                t:'sub'},
 {c:'04.02',n:'Fundo de Promoção',        t:'sub'},
 {c:'05',   n:'DFV',                      t:'neg', auto:'taxas',
   d:'Despesas Financeiras Variáveis — taxas de cartão e maquininha'},
 {c:'06',   n:'DGV',                      t:'neg', d:'Despesas Gerais Variáveis — embalagem, entrega, comissões'},
 {c:'07',   n:'MARGEM DE CONTRIBUIÇÃO',   t:'res', calc:'01-02-03-04-05-06'},
 {c:'08',   n:'DF',                       t:'neg', d:'Despesas Fixas — aluguel, energia, contador'},
 {c:'09',   n:'PESSOAL',                  t:'neg', d:'salários, encargos, pró-labore'},
 {c:'10',   n:'RESULTADO OPERACIONAL',    t:'res', calc:'07-08-09'},
 {c:'11',   n:'GASTOS NÃO OPERACIONAIS',  t:'neg', soma:['12','13']},
 {c:'12',   n:'DNOP',                     t:'sub', d:'Despesas Não Operacionais'},
 {c:'13',   n:'INVESTIMENTOS',            t:'sub'},
 {c:'14',   n:'RECEITAS NÃO OPERACIONAIS',t:'pos', soma:['15','16','17']},
 {c:'15',   n:'FINANCEIRAS',              t:'sub'},
 {c:'16',   n:'Outras Receitas',          t:'sub'},
 {c:'17',   n:'Franqueador (crédito)',    t:'sub'},
 {c:'18',   n:'RESULTADO FINAL',          t:'fin', calc:'10-11+14'}
];
var MESES_DRE=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

function cfgDRE(){
  DB.cfgDre=DB.cfgDre||{};
  var c=DB.cfgDre;
  if(c.regime===undefined)c.regime='competencia';
  if(c.aliqImposto===undefined)c.aliqImposto=0;
  if(c.royaltiesPct===undefined)c.royaltiesPct=0;
  if(c.fundoPct===undefined)c.fundoPct=0;
  if(!c.mapa)c.mapa={};          /* categoriaId -> rubrica */
  if(!c.fora)c.fora=[];          /* categorias que não entram */
  if(c.cpvPorCompra===undefined)c.cpvPorCompra=true;
  return c;
}
/* todas as categorias e subcategorias financeiras, achatadas */
function catsFin(){
  var l=[];
  (DB.catfin||[]).forEach(function(p){
    l.push({id:p.id,nome:p.nome,pai:null});
    (p.itens||[]).forEach(function(i){ l.push({id:i.id,nome:i.nome,pai:p.nome}); });
  });
  return l;
}
/* ---------- cálculo ---------- */
function calcularDRE(ano){
  var c=cfgDRE();
  var m=[];
  for(var i=0;i<12;i++){
    var o={};
    RUBRICAS.forEach(function(r){o[r.c]=0});
    m.push(o);
  }
  function mesDe(dt){
    var s=String(dt||'');
    if(s.slice(0,4)!==String(ano))return -1;
    var k=parseInt(s.slice(5,7),10)-1;
    return (k>=0&&k<12)?k:-1;
  }
  /* 01.01 — vendas do PDV */
  (DB.pedidos||[]).forEach(function(p){
    if(ehCancelado(p))return;
    var k=mesDe(p.data);
    if(k<0)return;
    m[k]['01.01']+=Number(p.total)||0;
  });
  /* 05 — taxas de cartão calculadas pelas formas de pagamento */
  (DB.pedidos||[]).forEach(function(p){
    if(ehCancelado(p))return;
    var k=mesDe(p.data);
    if(k<0)return;
    (p.pagamentos||[]).forEach(function(g){
      var f=(DB.formasPag||[]).find(function(x){return x.id===(g.formaId||g.forma)});
      if(!f)return;
      m[k]['05']+=((Number(g.valor)||0)*(Number(f.taxaPct)||0)/100)+(Number(f.taxaFixa)||0);
    });
  });
  /* 02 — CPV: tudo que foi comprado no mês (notas de entrada) */
  if(c.cpvPorCompra){
    (DB.notas||[]).forEach(function(n){
      var k=mesDe(n.data);
      if(k<0)return;
      m[k]['02']+=Number(n.valorTotal)||0;
    });
  }else{
    (DB.movEst||[]).forEach(function(mv){
      var k=mesDe(mv.data);
      if(k<0)return;
      (mv.linhas||[]).forEach(function(l){
        if(l.direcao!=='saida'||String(l.origem||'')!=='venda')return;
        m[k]['02']+=(Number(l.qtd)||0)*(Number(l.custo)||0);
      });
    });
  }
  /* lançamentos financeiros, pela rubrica configurada */
  (DB.lancFin||[]).forEach(function(l){
    var dt=(c.regime==='caixa')?(l.pagamento||l.vencimento):(l.emissao||l.vencimento);
    if(c.regime==='caixa'&&!l.pago)return;
    var k=mesDe(dt);
    if(k<0)return;
    var cat=l.categoriaId||'';
    if(c.fora.indexOf(cat)>=0)return;
    var rub=c.mapa[cat];
    if(!rub)return;                                   /* sem rubrica: fica de fora */
    if(c.cpvPorCompra&&rub==='02'&&l.origem==='nota')return;  /* evita contar a nota duas vezes */
    m[k][rub]=(m[k][rub]||0)+(Number(l.valor)||0);
  });
  /* percentuais automáticos sobre o faturamento */
  for(var k2=0;k2<12;k2++){
    var fat=m[k2]['01.01']+m[k2]['01.02'];
    m[k2]['01']=fat;
    if(Number(c.aliqImposto)>0&&!m[k2]['03'])m[k2]['03']=fat*Number(c.aliqImposto)/100;
    if(Number(c.royaltiesPct)>0&&!m[k2]['04.01'])m[k2]['04.01']=fat*Number(c.royaltiesPct)/100;
    if(Number(c.fundoPct)>0&&!m[k2]['04.02'])m[k2]['04.02']=fat*Number(c.fundoPct)/100;
    m[k2]['04']=m[k2]['04.01']+m[k2]['04.02'];
    m[k2]['11']=m[k2]['12']+m[k2]['13'];
    m[k2]['14']=m[k2]['15']+m[k2]['16']+m[k2]['17'];
    m[k2]['07']=m[k2]['01']-m[k2]['02']-m[k2]['03']-m[k2]['04']-m[k2]['05']-m[k2]['06'];
    m[k2]['10']=m[k2]['07']-m[k2]['08']-m[k2]['09'];
    m[k2]['18']=m[k2]['10']-m[k2]['11']+m[k2]['14'];
  }
  return m;
}

/* ---------- TELA DO DRE ---------- */
var DRE={ano:0,tri:0,mes:0};
function telaDRE(){
  baseMov();baseFormas();
  if(!DRE.ano)DRE.ano=new Date().getFullYear();
  var m=calcularDRE(DRE.ano);
  var cols=[];
  if(DRE.mes){ cols=[DRE.mes-1]; }
  else{
    var ini=DRE.tri===0?0:(DRE.tri-1)*3;
    var fim=DRE.tri===0?12:ini+3;
    for(var i=ini;i<fim;i++)cols.push(i);
  }
  var anos=[];
  var ah=new Date().getFullYear();
  for(var a=ah-4;a<=ah+1;a++)anos.push(a);

  function pc(v,fat){ if(!fat)return '—'; return (v/fat*100).toFixed(1).replace('.',',')+'%'; }

  $('content').innerHTML='<div class="etWrap"><div class="etScroll">'+
   '<div class="etTopo">'+
    '<div><h1>DRE — Demonstrativo de Lucros e Perdas</h1>'+
    '<p>Resultado mês a mês, com o percentual de cada linha sobre o faturamento.</p></div>'+
    '<button class="infoBt" onclick="explicaDRE()">'+sv('help',15)+'</button>'+
    '<div style="flex:1"></div>'+
    '<button class="btnP2" onclick="abrir(\'loja\',\'cfg-dre\')">'+sv('gear2',13)+' Configurar</button>'+
    '<button class="btnP2" onclick="imprimirRel(\'DRE '+DRE.ano+'\')">'+sv('print2',13)+' PDF</button>'+
    '<button class="btnP2" onclick="exportarDRE()">'+sv('down2',13)+' Exportar</button>'+
   '</div>'+
   '<div class="barraF">'+
    '<div class="bfCampo"><label>Ano</label>'+
     '<select onchange="DRE.ano=Number(this.value);telaDRE()">'+
     anos.map(function(a){return '<option value="'+a+'"'+(DRE.ano===a?' selected':'')+'>'+a+'</option>'}).join('')+
     '</select></div>'+
    '<div class="bfCampo"><label>Mês</label>'+
     '<select onchange="DRE.mes=Number(this.value);telaDRE()">'+
     '<option value="0"'+(!DRE.mes?' selected':'')+'>Todos os meses</option>'+
     MESES_DRE.map(function(nm,k){
       return '<option value="'+(k+1)+'"'+(DRE.mes===k+1?' selected':'')+'>'+nm+'</option>'}).join('')+
     '</select></div>'+
    '<div class="bfCampo"><label>Período</label>'+
     '<select onchange="DRE.tri=Number(this.value);DRE.mes=0;telaDRE()"'+(DRE.mes?' disabled':'')+'>'+
     [[0,'Ano inteiro'],[1,'1º trimestre'],[2,'2º trimestre'],[3,'3º trimestre'],[4,'4º trimestre']]
      .map(function(t){return '<option value="'+t[0]+'"'+(DRE.tri===t[0]?' selected':'')+'>'+t[1]+'</option>'}).join('')+
     '</select></div>'+
    '<div class="bfAtalhos">'+
     '<button class="'+(!DRE.mes&&!DRE.tri?'on2':'')+'" onclick="DRE.tri=0;DRE.mes=0;telaDRE()">Ano</button>'+
     '<button class="'+(DRE.mes?'on2':'')+'" onclick="DRE.mes='+(new Date().getMonth()+1)+';telaDRE()">Mês atual</button>'+
     '<button onclick="DRE.ano=DRE.ano-1;telaDRE()">Ano anterior</button>'+
    '</div>'+
    '<div style="flex:1"></div>'+
    '<div class="dreRegime">'+sv('help',12)+' Regime: <b>'+
     (cfgDRE().regime==='caixa'?'Caixa':'Competência')+'</b></div>'+
   '</div>'+
   '<div class="etTabW plano2" id="relArea">'+
   '<table class="etTab dreTab"><thead><tr>'+
    '<th style="width:56px">Rubrica</th><th style="width:230px">Elemento</th>'+
    cols.map(function(k){return '<th style="text-align:right" colspan="2">'+MESES_DRE[k]+'</th>'}).join('')+
    (cols.length>1?'<th style="text-align:right" colspan="2" class="colAno">Acumulado</th>':'')+
   '</tr></thead><tbody>'+
   RUBRICAS.map(function(r){
     var cls=r.t==='sub'?'dreSub':(r.t==='res'?'dreRes':(r.t==='fin'?'dreFin':
       (r.t==='tot'?'dreTot':'dreLin')));
     var totAno=0,fatAno=0;
     cols.forEach(function(k){totAno+=m[k][r.c]||0;fatAno+=m[k]['01']||0;});
     return '<tr class="'+cls+'">'+
      '<td class="dreC">'+r.c+'</td>'+
      '<td class="dreN">'+E(r.n)+
       (r.d?'<button class="piI" onclick="dicaRub(event,\''+r.c+'\')">i</button>':'')+'</td>'+
      cols.map(function(k){
        var v=m[k][r.c]||0, fat=m[k]['01']||0;
        return '<td class="dreV'+(v<0?' neg':'')+'">'+(v?money(v):'—')+'</td>'+
               '<td class="drePc">'+(r.c==='01'?'100%':pc(v,fat))+'</td>';
      }).join('')+
      (cols.length>1?
       '<td class="dreV colAno'+(totAno<0?' neg':'')+'"><b>'+(totAno?money(totAno):'—')+'</b></td>'+
       '<td class="drePc colAno">'+(r.c==='01'?'100%':pc(totAno,fatAno))+'</td>':'')+
     '</tr>';
   }).join('')+
   '</tbody></table></div></div></div>';
  rodape('DRE '+(DRE.mes?MESES_DRE[DRE.mes-1]+'/':'')+DRE.ano+' · regime de '+
    (cfgDRE().regime==='caixa'?'caixa':'competência'));
}
function dicaRub(ev,c){
  ev.stopPropagation();fecharPops();
  var r=RUBRICAS.find(function(x){return x.c===c});
  if(!r)return;
  pop(ev,'<div class="dicaBox"><b>'+E(r.c)+' · '+E(r.n)+'</b><span>'+E(r.d||'')+'</span></div>');
}
function explicaDRE(){
  var c=cfgDRE();
  explicaRel('DRE — como é feito',[
   ['01.01 Vendas Diretas','soma dos pedidos do PDV no mês, sem os cancelados'],
   ['02 CPV',c.cpvPorCompra
     ?'tudo que foi comprado no mês — soma das notas de entrada pela data da nota'
     :'custo das mercadorias que saíram por venda, pelo custo médio no momento da baixa'],
   ['03 Impostos','calculado sobre o faturamento pela alíquota configurada, ou lançado manualmente'],
   ['04 Franqueador','royalties e fundo de promoção, por percentual configurado ou lançamento'],
   ['05 DFV','taxas de cartão calculadas pelo cadastro de cada forma de pagamento'],
   ['06 DGV','despesas variáveis lançadas nas categorias apontadas para esta rubrica'],
   ['07 Margem de contribuição','faturamento menos CPV, impostos, franqueador, DFV e DGV'],
   ['08 DF e 09 Pessoal','despesas fixas e folha, pelas categorias configuradas'],
   ['10 Resultado operacional','margem de contribuição menos despesas fixas e pessoal'],
   ['18 Resultado final','resultado operacional menos gastos não operacionais mais receitas não operacionais'],
   ['Regime',c.regime==='caixa'
     ?'caixa — o lançamento entra no mês em que foi pago'
     :'competência — o lançamento entra no mês da emissão, mesmo que pago depois']
  ],'as vendas vêm do PDV; as compras, das notas de entrada; as despesas, dos lançamentos '+
    'financeiros classificados por categoria. Cada categoria é apontada para uma rubrica em '+
    'Configuração da Loja › Configuração do DRE.',
   'lançamentos em categorias sem rubrica configurada e categorias marcadas para não entrar '+
   'no DRE. Se um número parecer baixo, confira a configuração das categorias.');
}
function exportarDRE(){
  var m=calcularDRE(DRE.ano);
  var l=[['Rubrica','Elemento'].concat(MESES_DRE).concat(['Acumulado'])];
  RUBRICAS.forEach(function(r){
    var lin=[r.c,r.n],t=0;
    for(var k=0;k<12;k++){lin.push(String((m[k][r.c]||0).toFixed(2)).replace('.',','));t+=m[k][r.c]||0;}
    lin.push(String(t.toFixed(2)).replace('.',','));
    l.push(lin);
  });
  baixarCSV('nexor-dre-'+DRE.ano+'.csv',l);
}

/* ---------- CONFIGURAÇÃO DO DRE ---------- */
function telaCfgDRE(){
  baseMov();
  var c=cfgDRE();
  var cats=catsFin();
  var opts=RUBRICAS.filter(function(r){return r.t!=='res'&&r.t!=='fin'&&
    r.c!=='01'&&r.c!=='04'&&r.c!=='11'&&r.c!=='14'});
  var semRub=cats.filter(function(x){return !c.mapa[x.id]&&c.fora.indexOf(x.id)<0}).length;

  /* agrupa as categorias por rubrica, para ver o DRE se montando */
  var porRub={};
  cats.forEach(function(x){
    if(c.fora.indexOf(x.id)>=0)return;
    var r=c.mapa[x.id];
    if(!r)return;
    porRub[r]=porRub[r]||[];
    porRub[r].push(x.nome);
  });

  $('content').innerHTML='<div class="etWrap"><div class="etScroll">'+
   '<div class="etTopo">'+
    '<div><h1>Configuração do DRE</h1>'+
    '<p>Diga para onde vai cada categoria financeira e como o resultado é apurado.</p></div>'+
    '<div style="flex:1"></div>'+
    (semRub?'<span class="alertaCfg">'+sv('help',13)+' '+semRub+' categoria(s) sem rubrica</span>':
      '<span class="okCfg">'+sv('check',13)+' tudo classificado</span>')+
    '<button class="btnP2" onclick="salvarCfgDRE()">'+sv('check',13)+' Salvar</button>'+
    '<button class="btnP2 ok" onclick="abrir(\'relatorios\',\'dre\')">'+sv('file',13)+' Ver o DRE</button>'+
   '</div>'+

   '<div class="cfgFaixa">'+
    '<div class="cfgF"><label>Regime de apuração</label>'+
     '<select id="drRegime">'+
      '<option value="competencia"'+(c.regime==='competencia'?' selected':'')+'>Competência — data de emissão</option>'+
      '<option value="caixa"'+(c.regime==='caixa'?' selected':'')+'>Caixa — data de pagamento</option>'+
     '</select></div>'+
    '<div class="cfgF"><label>Cálculo do CPV</label>'+
     '<select id="drCpv">'+
      '<option value="1"'+(c.cpvPorCompra?' selected':'')+'>Compras do mês (notas de entrada)</option>'+
      '<option value="0"'+(!c.cpvPorCompra?' selected':'')+'>Custo do que foi vendido</option>'+
     '</select></div>'+
    '<div class="cfgF peq"><label>Impostos %</label>'+
     '<input id="drImp" type="number" step="0.01" value="'+(c.aliqImposto||0)+'"></div>'+
    '<div class="cfgF peq"><label>Royalties %</label>'+
     '<input id="drRoy" type="number" step="0.01" value="'+(c.royaltiesPct||0)+'"></div>'+
    '<div class="cfgF peq"><label>Fundo promoção %</label>'+
     '<input id="drFun" type="number" step="0.01" value="'+(c.fundoPct||0)+'"></div>'+
    '<div class="cfgDica">'+sv('help',12)+' Percentuais em zero: os valores vêm dos lançamentos manuais.</div>'+
   '</div>'+

   '<div class="cfgDuas">'+
    '<div class="cfgCol">'+
     '<div class="colH">Categorias financeiras'+
      '<span class="cnt2">'+cats.length+'</span></div>'+
     '<div class="colB">'+
     (cats.length?'<table class="etTab cfgDreTab"><thead><tr>'+
      '<th>Categoria</th><th style="width:240px">Rubrica no DRE</th>'+
      '<th style="width:62px;text-align:center">Fora</th></tr></thead><tbody>'+
      cats.map(function(x){
        var fora=c.fora.indexOf(x.id)>=0;
        var sem=!c.mapa[x.id]&&!fora;
        return '<tr class="'+(fora?'foraDre':'')+(sem?' semRub':'')+'">'+
        '<td>'+(x.pai?'<span class="dreP">'+E(x.pai)+' › </span>':'')+'<b>'+E(x.nome)+'</b></td>'+
        '<td><select onchange="setRubrica(\''+x.id+'\',this.value)"'+(fora?' disabled':'')+'>'+
         '<option value="">— escolha —</option>'+
         opts.map(function(r){
           return '<option value="'+r.c+'"'+(c.mapa[x.id]===r.c?' selected':'')+'>'+
           r.c+' · '+E(r.n)+'</option>';}).join('')+
        '</select></td>'+
        '<td style="text-align:center"><input type="checkbox" '+
         'onchange="setForaDre(\''+x.id+'\',this.checked)"'+(fora?' checked':'')+'></td></tr>';
      }).join('')+'</tbody></table>'
     :'<div class="hint" style="padding:16px">Cadastre em Gestão Financeira › Categorias Financeiras.</div>')+
     '</div></div>'+

    '<div class="cfgCol estreita">'+
     '<div class="colH">Como o DRE vai ficar</div>'+
     '<div class="colB">'+
      '<table class="etTab previaDre"><tbody>'+
      RUBRICAS.filter(function(r){return r.t!=='sub'||r.c==='01.01'}).map(function(r){
        var itens=porRub[r.c]||[];
        var auto=(r.c==='01.01'?'vendas do PDV':
          r.c==='02'?(c.cpvPorCompra?'notas de entrada':'custo das vendas'):
          r.c==='05'?'taxas das formas de pagamento':
          (r.c==='03'&&c.aliqImposto)?c.aliqImposto+'% do faturamento':
          (r.c==='04'&&(c.royaltiesPct||c.fundoPct))?'% do faturamento':'');
        var cls=r.t==='res'?'pRes':(r.t==='fin'?'pFin':(r.t==='tot'?'pTot':''));
        return '<tr class="'+cls+'"><td class="pC">'+r.c+'</td>'+
        '<td class="pN">'+E(r.n)+
         (auto?'<small class="pAuto">'+sv('check',9)+' '+E(auto)+'</small>':'')+
         (itens.length?'<small class="pIt">'+itens.map(E).join(' · ')+'</small>':'')+
         (!auto&&!itens.length&&r.t!=='res'&&r.t!=='fin'&&r.t!=='tot'
           ?'<small class="pVazio">sem categoria apontada</small>':'')+
        '</td></tr>';
      }).join('')+'</tbody></table>'+
     '</div></div>'+
   '</div></div></div>';
  rodape(cats.length+' categorias · '+(semRub?semRub+' sem rubrica':'todas classificadas'));
}
function setRubrica(id,v){
  guardarCamposDRE();
  var c=cfgDRE();
  if(v)c.mapa[id]=v; else delete c.mapa[id];
  salvar();telaCfgDRE();
}
function setForaDre(id,v){
  guardarCamposDRE();
  var c=cfgDRE();
  var i=c.fora.indexOf(id);
  if(v&&i<0)c.fora.push(id);
  if(!v&&i>=0)c.fora.splice(i,1);
  salvar();telaCfgDRE();
}
function guardarCamposDRE(){
  var c=cfgDRE();
  if($('drRegime'))c.regime=$('drRegime').value;
  if($('drCpv'))c.cpvPorCompra=$('drCpv').value==='1';
  if($('drImp'))c.aliqImposto=parseFloat($('drImp').value)||0;
  if($('drRoy'))c.royaltiesPct=parseFloat($('drRoy').value)||0;
  if($('drFun'))c.fundoPct=parseFloat($('drFun').value)||0;
}
function salvarCfgDRE(){
  guardarCamposDRE();
  salvar();telaCfgDRE();
  toast('Configuração do DRE salva.');
}

/* ==========================================================
   SUCURSAIS
   ========================================================== */
/* ==========================================================
   A MATRIZ SEMEADA LOCALMENTE SEQUESTRAVA O CONTEXTO (item 98)

   `baseSuc()` cria uma Matriz local quando a lista esta vazia — para o
   sistema ter alguma unidade no primeiro uso. Mas ela nasce ANTES de a
   nuvem responder.

   O estrago, reproduzido com o login santafe@jologelato.com.br:

   1. o perfil carrega e diz `sucursal_ref = suc_mt1unhbx2xrb`;
   2. as sucursais da nuvem AINDA nao chegaram;
   3. `lojasCad()` devolve UMA unidade: a Matriz semeada aqui;
   4. `existe(fixa)` da falso — Santa Fe nao esta na lista;
   5. o sistema avisa "A unidade do seu acesso nao existe mais" e cai
      na Matriz.

   O guarda `if(!a.length)` nao pegava este caso, porque a lista NAO
   estava vazia: tinha exatamente a unidade errada dentro.

   Consequencia grave: durante esses segundos o gerente de Santa Fe
   opera como Matriz. Qualquer coisa gravada ali nasce com a unidade
   errada, e a tela de cardapio aparece vazia porque nao ha produto
   nenhum na Matriz.

   Correcao: a semente ganha marca `_semente`. Enquanto a lista for so
   semente, o sistema assume que AINDA NAO SABE — nao avisa nada e nao
   escolhe unidade nenhuma. E o mesmo principio que a V130 ja aplicou
   para lista vazia: ausencia de dado nao e resposta.
   ========================================================== */
function baseSuc(){
  DB.sucursais=DB.sucursais||[];
  if(!DB.sucursais.length)
    DB.sucursais.push({id:'suc_matriz',nome:'Matriz',apelido:'Matriz',cnpj:'',
      cidade:'',uf:'',telefone:'',matriz:true,ativa:true,cor:'#00A08B',_semente:true});
  return DB.sucursais;
}
/* a lista ainda e so a semente do primeiro uso? entao nao se sabe nada */
function soSemente(){
  var a=DB.sucursais||[];
  return a.length===1&&a[0]&&a[0]._semente===true;
}
/* ----------------------------------------------------------
   REDE JOLO — sucursais e acessos padrao
   Idempotente: confere antes de criar, nunca duplica e nunca
   mexe em senha de usuario que ja existe.
   ---------------------------------------------------------- */
function sucAtivas(){return baseSuc().filter(function(s){return s.ativa!==false})}
function sucNome(id){var s=baseSuc().find(function(x){return x.id===id});return s?s.nome:'—'}
var CORES_SUC=['#00A08B','#2C6FD1','#B8730B','#8B5CF6','#C94141','#0E8A46','#D9488A','#0891B2'];

function telaSucursais(){
  baseSuc();
  var l=DB.sucursais;
  $('content').innerHTML='<div class="etWrap"><div class="etScroll">'+
   '<div class="etTopo">'+
    '<div><h1>Sucursais da Franquia</h1><p>As unidades que aparecem nos painéis e relatórios.</p></div>'+
    '<div style="flex:1"></div>'+
    '<button class="btnP2 ok" onclick="formSucursal()">'+sv('plus',14)+' Cadastrar sucursal</button>'+
   '</div>'+
   '<div class="etTabW plano2">'+
   '<table class="etTab semBusca"><thead><tr>'+
    '<th style="width:36px"></th><th>Nome</th><th style="width:150px">Apelido</th>'+
    '<th style="width:170px">CNPJ</th><th style="width:180px">Cidade</th>'+
    '<th style="width:100px;text-align:center">Situação</th>'+
    '<th style="width:90px"></th></tr></thead><tbody>'+
   l.map(function(s){
     return '<tr>'+
     '<td><span class="pontoSuc" style="background:'+(s.cor||'#00A08B')+'"></span></td>'+
     '<td><b>'+E(s.nome)+'</b>'+(s.matriz?'<span class="tagFicha">matriz</span>':'')+'</td>'+
     '<td>'+E(s.apelido||'—')+'</td>'+
     '<td>'+E(s.cnpj||'—')+'</td>'+
     '<td>'+E(s.cidade||'—')+(s.uf?' / '+E(s.uf):'')+'</td>'+
     '<td style="text-align:center">'+(s.ativa!==false
       ?'<span class="badge2">Ativa</span>':'<span class="badge2 rd">Inativa</span>')+'</td>'+
     '<td><div class="rowAct">'+
      '<button class="rBtn" onclick="formSucursal(\''+s.id+'\')">'+sv('edit',12)+'</button>'+
      (s.matriz?'':'<button class="rBtn rd" onclick="excluirSucursal(\''+s.id+'\')">'+sv('trash',12)+'</button>')+
     '</div></td></tr>';
   }).join('')+'</tbody></table></div></div></div>';
  rodape(l.length+' sucursais');
}
function formSucursal(id){
  baseSuc();
  var s=id?DB.sucursais.find(function(x){return x.id===id}):null;
  modal(s?'Editar sucursal':'Cadastrar sucursal',
  '<div class="mdB"><div class="row2">'+
   '<div class="fld2"><label>Nome *</label><input id="scNome" value="'+E(s?s.nome:'')+'" placeholder="Gelato Rafaellos Centro"></div>'+
   '<div class="fld2"><label>Apelido</label><input id="scApe" value="'+E(s?s.apelido:'')+'" placeholder="Centro"></div>'+
  '</div><div class="row2">'+
   '<div class="fld2"><label>CNPJ</label><input id="scCnpj" value="'+E(s?s.cnpj:'')+'"></div>'+
   '<div class="fld2"><label>Telefone</label><input id="scTel" value="'+E(s?s.telefone:'')+'"></div>'+
  '</div><div class="row2">'+
   '<div class="fld2"><label>Cidade</label><input id="scCid" value="'+E(s?s.cidade:'')+'"></div>'+
   '<div class="fld2"><label>UF</label><input id="scUf" maxlength="2" value="'+E(s?s.uf:'')+'"></div>'+
  '</div><div class="row2">'+
   '<div class="fld2"><label>Mensalidade (R$)</label>'+
    '<input id="scMens" value="'+E(s&&s.mensalidade?String(s.mensalidade).replace('.',','):'')+'" '+
    'placeholder="0,00"></div>'+
   '<div class="fld2"><label>Dia do vencimento</label>'+
    '<input id="scVenc" type="number" min="1" max="28" value="'+E(s&&s.diaVenc?s.diaVenc:'')+'" '+
    'placeholder="10"></div>'+
  '</div><div class="row2">'+
   '<div class="fld2"><label>Cor nos gráficos</label>'+
    '<div class="coresSuc">'+CORES_SUC.map(function(c){
      return '<button class="corB'+((s?s.cor:CORES_SUC[0])===c?' on':'')+'" style="background:'+c+'" '+
      'onclick="_corSuc=\''+c+'\';document.querySelectorAll(\'.corB\').forEach(function(b){b.classList.remove(\'on\')});this.classList.add(\'on\')"></button>';
    }).join('')+'</div></div>'+
   '<div class="fld2"><label>&nbsp;</label>'+
    '<label class="chkL"><input type="checkbox" id="scAtiva" '+(!s||s.ativa!==false?'checked':'')+'>'+
    '<span>Sucursal ativa</span></label></div>'+
  '</div>'+
  /* ==========================================================
     O ACESSO DA UNIDADE NASCE AQUI
     Antes, cadastrar a loja e criar quem entra nela eram duas telas
     diferentes — e nenhuma era dona do cadastro inteiro. Agora a unidade
     e o acesso dela saem do mesmo formulario, de uma vez.
     ========================================================== */
  '<div class="mdSep"></div>'+
  /* ==========================================================
     DUAS SENHAS DIFERENTES, E A TELA NAO DIZIA ISSO

     Este bloco cria o acesso ao SISTEMA — o Joia no computador da loja.
     O APLICATIVO do celular tem outro acesso, publicado em Canais de
     Venda, com senha propria.

     A tela dizia so "Quem entra nesta loja", entao quem cadastrava aqui
     achava, com razao, que ja tinha liberado o celular tambem — e
     depois batia no erro "este acesso esta sem senha" sem entender por
     que, ja que tinha acabado de cadastrar uma.

     Agora cada tela diz de qual acesso esta falando.
     ========================================================== */
  '<b style="font-size:13px">Acesso ao sistema (computador da loja)</b>'+
  '<p class="hint" style="margin:4px 0 10px">'+
   (acessoDaSuc(s)
     ? 'Já existe um acesso ao sistema para esta unidade. Deixe a senha em '+
       'branco para não trocá-la.'
     : 'O responsável da unidade entra no sistema com este e-mail e senha, e '+
       'enxerga só esta loja.')+
   '<br><b>O aplicativo do celular tem senha própria</b>, definida em '+
   'Canais de Venda › Aplicativo.</p>'+
  '<div class="row2">'+
   '<div class="fld2"><label>E-mail (login)</label>'+
    '<input id="scMail" value="'+E((acessoDaSuc(s)||{}).login||'')+'" '+
    'placeholder="responsavel@empresa.com"></div>'+
   '<div class="fld2"><label>Senha</label>'+
    '<input id="scSenha" type="text" placeholder="'+
      (acessoDaSuc(s)?'deixe em branco para manter':'mínimo 6 caracteres')+'"></div>'+
  '</div></div>','Salvar',async function(){
    var nome=$('scNome').value.trim();
    if(!nome){toast('Informe o nome da sucursal.');return false;}
    var o={nome:nome,apelido:$('scApe').value.trim(),cnpj:$('scCnpj').value.trim(),
      telefone:$('scTel').value.trim(),cidade:$('scCid').value.trim(),
      uf:$('scUf').value.trim().toUpperCase(),ativa:$('scAtiva').checked,
      mensalidade:Number(String($('scMens').value||'0').replace(/\./g,'').replace(',','.'))||0,
      diaVenc:Math.min(28,Math.max(1,parseInt($('scVenc').value,10)||10)),
      cor:_corSuc||(s?s.cor:CORES_SUC[DB.sucursais.length%CORES_SUC.length])};
    var mail=($('scMail').value||'').trim().toLowerCase();
    var senha=($('scSenha').value||'');
    var jaTem=acessoDaSuc(s);
    if(mail&&!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)){
      toast('O login precisa ser um e-mail válido.');return false;}
    if(mail&&!jaTem&&senha.length<6){
      toast('Informe a senha do responsável (mínimo 6 caracteres).');return false;}
    if(senha&&senha.length<6){
      toast('A senha precisa ter ao menos 6 caracteres.');return false;}

    var alvo=s;
    if(s)Object.assign(s,o);
    else {alvo=Object.assign({id:uid('suc'),matriz:false},o);DB.sucursais.push(alvo);}
    _corSuc='';
    salvar();

    /* O acesso vai depois da unidade existir: ele aponta para ela.
       Se o acesso falhar, a unidade FICA — desfazer o cadastro por causa
       do login perderia tudo o que a pessoa digitou. */
    /* ==========================================================
       ACESSO SO E TOCADO SE ALGO NELE MUDOU
       Editar a mensalidade da loja mandava o acesso junto, com a senha
       vazia — e o servidor recusava, dizendo que a senha e curta demais.
       Quem edita o cadastro da loja nao esta mexendo em senha nenhuma.
       ========================================================== */
    var mexeuNoAcesso = mail && (!jaTem || senha ||
      String(jaTem.login||'').toLowerCase()!==mail);
    if(mexeuNoAcesso){
      /* ==========================================================
         A MATRIZ E A EXCECAO
         O responsavel de uma filial responde por aquela loja. O da matriz
         e a franqueadora: ela responde pela REDE. Prende-la a uma unidade
         a rebaixa a gestora de unidade — foi assim que o banco passou a
         recusar as gravacoes com 403 e travou a sincronizacao inteira.
         Por isso a matriz grava sem unidade e com cargo de administrador.
         ========================================================== */
      var er=await criarAcesso(NUVEM.loja,{
        nome:o.nome, email:mail, senha:senha,
        cargo:alvo.matriz?'admin':'gerente',
        sucursal_ref:alvo.matriz?'':alvo.id,
        perfil_id:(jaTem&&jaTem.perfilId)||''
      });
      if(er){
        telaSucursais();
        painelErro('A unidade foi salva, mas o acesso não.',er);
        return true;
      }
      alvo.loginResp=mail;      /* fica registrado de quem e esta unidade */
      salvar();
      if(NUVEM.ligada){try{await sincronizar()}catch(e){_quieto(e,'formSucursal')}}
    }
    telaSucursais();
    toast(mexeuNoAcesso?'Sucursal e acesso salvos.':'Sucursal salva.');
    return true;
  },'lg');
}
var _corSuc='';
/* qual acesso pertence a esta unidade — o formulario precisa saber se
   esta criando ou editando o login */
function acessoDaSuc(s){
  if(!s)return null;
  /* ==========================================================
     QUEM E O RESPONSAVEL DA UNIDADE E UM FATO GRAVADO
     Tentei deduzir: primeiro pelo primeiro acesso da unidade (e o caixa
     virava responsavel conforme a ordem da lista), depois pela funcao
     "gerente" (e o acesso salvo como Atendente deixava de ser reconhecido,
     reabrindo a edicao de login onde ela nao deve existir).
     Deduzir errado aqui troca a senha da pessoa errada. Entao o vinculo
     passou a ser escrito na propria sucursal, no campo loginResp.
     ========================================================== */
  var lg=String(s.loginResp||'').toLowerCase();
  if(!lg)return null;
  return (DB.usuarios||[]).find(function(u){
    return u.ativo!==false&&String(u.login||'').toLowerCase()===lg;
  })||null;
}
async function excluirSucursal(id){
  var s=DB.sucursais.find(function(x){return x.id===id});
  var ok=await confirmar({titulo:'Excluir a sucursal '+(s?s.nome:''),
    texto:'As vendas já registradas continuam no histórico.',ok:'Excluir',tipo:'perigo'});
  if(!ok)return;
  DB.sucursais=DB.sucursais.filter(function(x){return x.id!==id});
  salvar();telaSucursais();
}
/* ==========================================================
   TRAVA DE UNIDADE NOS PAINEIS

   Os relatorios filtravam so pelo seletor de sucursais do proprio painel,
   que nasce em "Todos". Quem estava com Jales aberta via o faturamento da
   rede inteira, e o valor de Santa Fe aparecia dentro de Jales.

   O corte por unidade nao pode depender de o painel lembrar de filtrar:
   passa a ser feito na porta, junto com o periodo. A matriz continua vendo
   tudo — e para ela que existe a comparacao por loja. Qualquer outra
   unidade so enxerga a propria venda.
   ========================================================== */
/* ==========================================================
   DE QUAL LOJA E ESTA VENDA

   O pedido aceito do cardapio digital nascia SEM loja: a linha era
   `sucursalId: p.sucursal_id||'suc_matriz'`, e o cardapio nao manda
   sucursal nenhuma. Entao toda venda do cardapio virava venda da
   MATRIZ — enquanto o dinheiro dela entrava no caixa da loja que
   aceitou o pedido.

   Efeito, conferido no banco em 01/09/2026: os 9 pedidos do cardapio de
   agosto (R$ 608,00) estavam todos em caixas de Santa Fe do Sul e todos
   com `sucursal_id` nulo. Santa Fe abria Canais de Venda e via
   "Delivery R$ 213,00 · 2 pedidos" — os dois unicos digitados como
   entrega no PDV. As nove entregas do cardapio nao apareciam em lugar
   nenhum do relatorio dela.

   A origem esta corrigida (o pedido agora nasce na loja que o aceitou),
   mas o que ja foi gravado continuaria invisivel. Por isso o relatorio
   nao pergunta so ao pedido: quando ele nao diz de que loja e, quem
   responde e o CAIXA em que a venda entrou — que e o mesmo caixa que
   contou esse dinheiro no fechamento. Nao ha chute: se nem o caixa
   souber, ai sim cai na matriz, como era antes.
   ========================================================== */
function sucursalDoPedido(p){
  if(!p)return 'suc_matriz';
  if(p.sucursalId)return p.sucursalId;
  var cx=p.caixaId&&(DB.caixas||[]).find(function(c){return c.id===p.caixaId});
  if(cx&&cx.sucursalId)return cx.sucursalId;
  return 'suc_matriz';
}
function vendaDaUnidadeAberta(p){
  var suc=lojaAtualId();
  if(ehSucMatriz(suc))return true;          /* a matriz compara a rede */
  return sucursalDoPedido(p)===suc;
}
/* filtro de sucursais usado nos painéis */

/* ==========================================================
   PAINÉIS — base comum
   ========================================================== */
function periodoPadrao(o){
  if(!o.de){var d=new Date();
    o.de=new Date(d.getFullYear(),d.getMonth(),1).toISOString().slice(0,10);
    o.ate=hojeISO();}
}
/* De qual porta a venda entrou. E uma so por pedido, e ela e a base de
   todo relatorio que separa balcao, entrega, totem e mesa. */
/* ==========================================================
   ENTREGA E ENTREGA, VENHA DE ONDE VIER

   O relatorio tinha "Delivery" e "Cardapio digital" como dois canais
   diferentes, e a mesma venda so podia cair num deles. Como o pedido do
   cardapio nasce com `canal:'cardapio'`, TODA entrega pedida pelo
   cardapio saia de dentro do Delivery e ia para o outro cartao. Sobrava
   no Delivery so o que alguem digitou como entrega na mao, no PDV.

   O Rafael, em 01/09/2026: "a gente tem delivery e tem cardapio digital,
   nao faz sentido... toda venda que sai no WhatsApp e delivery digital,
   tem que ser um so, o outro tem que tirar."

   Ele esta certo, e o aplicativo do celular ja fazia assim: la o
   delivery e `tipo==='entrega'`, sem olhar o canal — por isso os dois
   davam numeros diferentes para o mesmo dia.

   Agora e um canal so, Delivery, e ele responde a mesma pergunta que o
   aplicativo responde: esta venda saiu para entrega? O cardapio, o
   WhatsApp e o PDV sao a PORTA por onde o pedido entrou, nao o canal —
   e a porta continua gravada em `pedido.canal`, visivel no detalhe do
   pedido. Pedido de RETIRADA feito pelo cardapio continua sendo balcao,
   porque o cliente veio buscar no balcao.
   ========================================================== */
function canalDoPedido(p){
  var c=String(p.canal||'').toLowerCase();
  if(p.tipo==='entrega')return 'entrega';
  if(c==='totem')return 'totem';
  if(c==='mesa')return 'mesa';
  return 'balcao';
}
var CANAIS_REL=[
 {id:'balcao',  n:'Balcão',          cor:'#0E8A46'},
 {id:'entrega', n:'Delivery',        cor:'#E8574A'},
 {id:'mesa',    n:'Mesa (QR Code)',  cor:'#B4542F'},
 {id:'totem',   n:'Totem',           cor:'#1F5F8B'}
];
/* Porta unica dos relatorios: filtrar o canal AQUI faz o filtro valer em
   todas as telas de uma vez, em vez de cada uma ter a sua regra. */
function pedsPeriodo(o){
  baseSuc();
  return (DB.pedidos||[]).filter(function(p){
    if(ehCancelado(p))return false;
    if(!vendaDaUnidadeAberta(p))return false;   /* unidade nao ve a venda da outra */
    var d=diaLocal(p.data);
    if(o.de&&d<o.de)return false;
    if(o.ate&&d>o.ate)return false;
    if(o.sucs&&o.sucs.length&&o.sucs.indexOf(sucursalDoPedido(p))<0)return false;
    if(o.canais&&o.canais.length&&o.canais.indexOf(canalDoPedido(p))<0)return false;
    return true;
  });
}
/* o seletor que entra nas telas de relatorio */
/* os seletores chamam por nome; sem estas, o clique no canal nao fazia nada */
function togCanCV(id){togCanalRel(CV2,id,'telaCanaisVenda')}
function togTodosCanCV(){togTodosCanais(CV2,'telaCanaisVenda')}
function togCanFT(id){togCanalRel(FTP,id,'telaFaturamento')}
function togTodosCanFT(){togTodosCanais(FTP,'telaFaturamento')}
function togCanVD(id){togCanalRel(VDH,id,'telaVendaDataHora')}
function togTodosCanVD(){togTodosCanais(VDH,'telaVendaDataHora')}
function togCanalRel(estado,id,tela){
  var a=estado.canais||[];
  var i=a.indexOf(id);
  if(i>=0)a.splice(i,1); else a.push(id);
  estado.canais=a;
  if(typeof window[tela]==='function')window[tela]();
}
function togTodosCanais(estado,tela){
  estado.canais=[];
  if(typeof window[tela]==='function')window[tela]();
}
function seletorCanal(id,arr,onTog,onTodos){
  return selMulti(id,'Canais',
    CANAIS_REL.map(function(c){return {id:c.id,nome:c.n}}),arr,onTog,onTodos);
}
function seletorSuc(id,arr,onTog,onTodos){
  return selMulti(id,'Sucursais',
    sucAtivas().map(function(s){return {id:s.id,nome:s.nome}}),arr,onTog,onTodos);
}
function diasEntre(de,ate){
  var l=[],d=new Date(de+'T12:00:00'),f=new Date(ate+'T12:00:00');
  while(d<=f){l.push(d.toISOString().slice(0,10));d.setDate(d.getDate()+1);}
  return l;
}
/* gráfico de linha, como o do exemplo */
function grafLinha(pontos,rotulos,opts){
  opts=opts||{};
  var W=Math.max(600,pontos.length*34), H=opts.altura||280;
  var PL=62,PR=18,PT=18,PB=42;
  var iw=W-PL-PR, ih=H-PT-PB;
  var max=Math.max.apply(null,pontos.concat([1]));
  var teto=Math.ceil(max/1000)*1000||Math.ceil(max);
  if(teto<max)teto=max;
  var passo=pontos.length>1?iw/(pontos.length-1):iw;
  var grade='',eixo='';
  for(var g=0;g<=5;g++){
    var y=PT+ih-(ih*g/5);
    grade+='<line x1="'+PL+'" y1="'+y+'" x2="'+(W-PR)+'" y2="'+y+'" stroke="var(--line-2)"/>';
    eixo+='<text x="'+(PL-9)+'" y="'+(y+4)+'" text-anchor="end" font-size="10" fill="var(--ink-3)">'+
      (teto*g/5>=1000?(teto*g/5/1000).toFixed(teto>=10000?0:1)+'k':Math.round(teto*g/5))+'</text>';
  }
  /* linhas verticais leves */
  for(var v=0;v<pontos.length;v+=Math.max(1,Math.round(pontos.length/16))){
    var xv=PL+passo*v;
    grade+='<line x1="'+xv+'" y1="'+PT+'" x2="'+xv+'" y2="'+(PT+ih)+'" stroke="var(--line-2)" opacity=".6"/>';
  }
  var pts=pontos.map(function(v2,k){
    return [PL+passo*k, PT+ih-((v2/teto)*ih)];
  });
  var cor=opts.cor||'#7FB3D5';
  var area='M'+pts[0][0]+' '+(PT+ih)+' '+pts.map(function(p){return 'L'+p[0]+' '+p[1]}).join(' ')+
    ' L'+pts[pts.length-1][0]+' '+(PT+ih)+' Z';
  var linha=pts.map(function(p,k){return (k?'L':'M')+p[0]+' '+p[1]}).join(' ');
  var bolas='',tips='';
  pts.forEach(function(p,k){
    bolas+='<circle class="lnP" data-i="'+k+'" cx="'+p[0]+'" cy="'+p[1]+'" r="4" '+
      'fill="#fff" stroke="'+cor+'" stroke-width="2.5"/>'+
      '<rect class="lnH" data-i="'+k+'" x="'+(p[0]-passo/2)+'" y="'+PT+'" width="'+passo+'" height="'+ih+'" fill="transparent"/>';
    var bw=126,bh=40;
    var bx=Math.min(Math.max(p[0]-bw/2,PL),W-PR-bw);
    var by=Math.max(PT+2,p[1]-bh-10);
    tips+='<g class="lnT" data-i="'+k+'">'+
      '<line x1="'+p[0]+'" y1="'+PT+'" x2="'+p[0]+'" y2="'+(PT+ih)+'" stroke="'+cor+'" stroke-dasharray="3 3"/>'+
      '<rect x="'+bx+'" y="'+by+'" width="'+bw+'" height="'+bh+'" rx="7" fill="#122A42"/>'+
      '<text x="'+(bx+bw/2)+'" y="'+(by+16)+'" text-anchor="middle" font-size="10" fill="#9AB4CC">'+
        E(rotulos[k])+'</text>'+
      '<text x="'+(bx+bw/2)+'" y="'+(by+31)+'" text-anchor="middle" font-size="12" fill="#fff" '+
        'font-weight="700">R$ '+money(pontos[k])+'</text></g>';
  });
  var rot='';
  var salto=Math.max(1,Math.round(pontos.length/12));
  rotulos.forEach(function(r,k){
    if(k%salto)return;
    rot+='<text x="'+pts[k][0]+'" y="'+(H-16)+'" text-anchor="middle" font-size="10" '+
      'fill="var(--ink-3)">'+E(r)+'</text>';
  });
  return '<div class="grafBox" onmousemove="realceLinha(event,this)" onmouseleave="limpaLinha(this)">'+
   '<svg viewBox="0 0 '+W+' '+H+'" width="100%" height="'+H+'">'+
   '<defs><linearGradient id="gArea" x1="0" y1="0" x2="0" y2="1">'+
   '<stop offset="0%" stop-color="'+cor+'" stop-opacity=".28"/>'+
   '<stop offset="100%" stop-color="'+cor+'" stop-opacity="0"/></linearGradient></defs>'+
   grade+eixo+
   '<path d="'+area+'" fill="url(#gArea)"/>'+
   '<path d="'+linha+'" fill="none" stroke="'+cor+'" stroke-width="2.5" '+
    'stroke-linejoin="round" stroke-linecap="round"/>'+
   bolas+rot+tips+'</svg></div>';
}

function realceLinha(ev,box){
  var svg=box.querySelector('svg');
  if(!svg)return;
  var r=svg.getBoundingClientRect();
  var hits=svg.querySelectorAll('.lnH');
  var achou=-1;
  for(var i=0;i<hits.length;i++){
    var hb=hits[i].getBoundingClientRect();
    if(ev.clientX>=hb.left&&ev.clientX<=hb.right){achou=hits[i].getAttribute('data-i');break;}
  }
  var tips=svg.querySelectorAll('.lnT');
  for(var k=0;k<tips.length;k++)
    tips[k].style.opacity=(tips[k].getAttribute('data-i')===String(achou))?'1':'0';
  var pts=svg.querySelectorAll('.lnP');
  for(var z=0;z<pts.length;z++)
    pts[z].setAttribute('r',pts[z].getAttribute('data-i')===String(achou)?'6':'4');
}
function limpaLinha(box){
  var svg=box.querySelector('svg');if(!svg)return;
  var t=svg.querySelectorAll('.lnT');
  for(var i=0;i<t.length;i++)t[i].style.opacity='0';
  var p=svg.querySelectorAll('.lnP');
  for(var k=0;k<p.length;k++)p[k].setAttribute('r','4');
}

/* ==========================================================
   CANAIS DE VENDA
   ========================================================== */
var CV2={de:'',ate:'',sucs:[],canais:[]};
function telaCanaisVenda(){
  baseMov();baseSuc();
  periodoPadrao(CV2);
  var peds=pedsPeriodo(CV2);
  var total=peds.reduce(function(a,p){return a+(Number(p.total)||0)},0);
  /* ==========================================================
     ESTA TELA TINHA A PROPRIA REGRA DE CANAL

     O sistema tem uma porta unica para dizer de que canal e a venda —
     `canalDoPedido` — e o comentario dela diz, desde que foi escrita,
     que filtrar ali faz o filtro valer em todas as telas de uma vez.
     Só que esta tela, a que se chama Canais de Venda, nao passava por
     essa porta: tinha a propria lista, com a propria regra em cada
     linha. As duas foram ficando diferentes, e o mesmo pedido era
     "Cardapio digital" aqui e "Entrega" no seletor de canais logo
     acima, na mesma tela.

     Agora ela le CANAIS_REL e chama `canalDoPedido`, como as outras.
     Um pedido cai em um cartao so, e o cartao e o mesmo em toda parte.
     ========================================================== */
  var canais=CANAIS_REL.map(function(c0){
    var c={id:c0.id,n:c0.n,cor:c0.cor};
    var lista=peds.filter(function(p){return canalDoPedido(p)===c.id});
    c.valor=lista.reduce(function(a,p){return a+(Number(p.total)||0)},0);
    c.qtd=lista.length;
    c.pct=total?(c.valor/total*100):0;
    return c;
  });
  var dias=diasEntre(CV2.de,CV2.ate);
  var porDia=dias.map(function(d){
    return peds.filter(function(p){return diaLocal(p.data)===d})
      .reduce(function(a,p){return a+(Number(p.total)||0)},0);
  });
  var rot=dias.map(function(d){return d.slice(8,10)+'/'+d.slice(5,7)});
  var rank=canais.slice().filter(function(c){return c.valor>0})
    .sort(function(a,b){return b.valor-a.valor});

  $('content').innerHTML='<div class="etWrap"><div class="etScroll">'+
   '<div class="etTopo">'+
    '<div><h1>Canais de Venda</h1><p>Por onde o faturamento entrou, dia a dia.</p></div>'+
    '<button class="infoBt" onclick="explicaCanais()">'+sv('help',15)+'</button>'+
    '<div style="flex:1"></div>'+
    '<button class="btnP2" onclick="imprimirRel(\'Canais de Venda\')">'+sv('print2',13)+' PDF</button>'+
   '</div>'+
   '<div class="barraF">'+
    '<div class="bfCampo"><label>Data inicial</label><input type="date" id="cvDe" value="'+CV2.de+'"></div>'+
    '<div class="bfCampo"><label>Data final</label><input type="date" id="cvAte" value="'+CV2.ate+'"></div>'+
    seletorSuc('cvSuc',CV2.sucs,'togCV','togTodosCV()')+
    seletorCanal('cvCan',CV2.canais,'togCanCV','togTodosCanCV()')+
    '<button class="btnP2 ok" onclick="CV2.de=$(\'cvDe\').value;CV2.ate=$(\'cvAte\').value;telaCanaisVenda()">'+
     sv('search',13)+' Buscar</button>'+
    '<div class="bfAtalhos">'+
     '<button onclick="perCV(0)">Mês</button><button onclick="perCV(-1)">Anterior</button>'+
     '<button onclick="perCV(7)">7d</button><button onclick="perCV(30)">30d</button></div>'+
   '</div>'+
   '<div class="cvGrade" id="relArea">'+
    '<div class="cvLat">'+
     '<div class="cvCard total"><div class="cvPct">100%</div>'+
      '<div><span>TOTAL</span><b>R$ '+money(total)+'</b>'+
      '<small>'+peds.length+' pedidos</small></div></div>'+
     canais.map(function(c){
       return '<div class="cvCard" style="background:'+c.cor+'">'+
       '<div class="cvPct">'+c.pct.toFixed(0)+'%</div>'+
       '<div><span>'+E(c.n.toUpperCase())+'</span><b>R$ '+money(c.valor)+'</b>'+
       '<small>'+c.qtd+' pedidos</small></div></div>';
     }).join('')+
    '</div>'+
    '<div class="cvCentro">'+
     '<div class="grafH"><div><b>Evolução no período</b>'+
      '<span>'+dias.length+' dias · '+dataBR(CV2.de)+' a '+dataBR(CV2.ate)+'</span></div></div>'+
     grafLinha(porDia,rot,{cor:'#7FB3D5',altura:300})+
    '</div>'+
    '<aside class="cvRank">'+
     '<div class="colH">Ranking de canais</div>'+
     '<div class="cvRankL">'+
     (rank.length?rank.map(function(c){
       return '<div class="cvRk"><span class="cvRkP">'+c.pct.toFixed(0)+'%</span>'+
       '<div class="cvRkN">'+E(c.n)+'<small>R$ '+money(c.valor)+'</small></div>'+
       '<div class="cvRkB"><i style="width:'+c.pct+'%;background:'+c.cor+'"></i></div></div>';
     }).join(''):'<div class="hint" style="padding:14px">Nenhuma venda no período.</div>')+
     '</div></aside>'+
   '</div></div></div>';
  rodape('R$ '+money(total)+' em '+peds.length+' pedidos');
}
function togCV(s){togFiltro(CV2.sucs,s);telaCanaisVenda();}
function togTodosCV(){CV2.sucs=CV2.sucs.length?[]:sucAtivas().map(function(s){return s.id});telaCanaisVenda();}
function perCV(n){
  var d=new Date();
  if(n===0){CV2.de=new Date(d.getFullYear(),d.getMonth(),1).toISOString().slice(0,10);CV2.ate=hojeISO();}
  else if(n===-1){CV2.de=new Date(d.getFullYear(),d.getMonth()-1,1).toISOString().slice(0,10);
    CV2.ate=new Date(d.getFullYear(),d.getMonth(),0).toISOString().slice(0,10);}
  else {CV2.de=diasAtrasISO(n);CV2.ate=hojeISO();}
  telaCanaisVenda();
}
function explicaCanais(){
  explicaRel('Canais de Venda — como é feito',[
   ['Total','soma de todos os pedidos do período, sem os cancelados'],
   ['Delivery','toda venda que saiu para entrega, não importa por onde o pedido entrou: '+
    'cardápio digital, WhatsApp ou digitada no PDV. É a mesma conta que o aplicativo do celular faz'],
   ['Balcão','quem foi atendido na loja — inclui a retirada pedida pelo cardápio, '+
    'porque o cliente veio buscar no balcão'],
   ['Mesa e Totem','pedidos feitos pelo QR Code da mesa e pelo autoatendimento'],
   ['Por onde o pedido entrou','o cardápio e o WhatsApp não são canais, são a porta de entrada. '+
    'Isso fica gravado em cada pedido e aparece no detalhe dele'],
   ['Evolução no período','faturamento de cada dia — passe o mouse para ver o valor'],
   ['Ranking','participação de cada canal no faturamento do período']
  ],'os pedidos da unidade aberta, separados pelo tipo de venda, '+
    'filtrados pelas sucursais escolhidas.',
   'pedidos cancelados e vendas fora do período selecionado.');
}

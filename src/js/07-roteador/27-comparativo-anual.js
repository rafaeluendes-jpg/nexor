/* ==========================================================
   BLOCO 27 — COMPARATIVO ANUAL
   ========================================================== */
var CA={modo:'anual',a1:0,a2:0,metrica:'fat',m1:'',m2:'',sucs:[]};

function anosComVenda(){
  var s={};
  (DB.pedidos||[]).forEach(function(p){
    var d=String(p.data||'').slice(0,4);
    if(d&&d.length===4)s[d]=true;
  });
  var hoje=new Date().getFullYear();
  s[hoje]=true;s[hoje-1]=true;
  return Object.keys(s).sort().reverse();
}
/* junta tudo de um ano, mês a mês */
function dadosAno(ano){
  var m=[];
  for(var i=0;i<12;i++)m.push({fat:0,ped:0,loja:0,entrega:0,desc:0,taxa:0,
    cmv:0,clientes:{},itens:0});
  (DB.pedidos||[]).forEach(function(p){
    if(ehCancelado(p))return;
    if(CA.sucs.length&&CA.sucs.indexOf(p.sucursalId||'suc_matriz')<0)return;
    var d=String(p.data||'');
    if(d.slice(0,4)!==String(ano))return;
    var k=parseInt(d.slice(5,7),10)-1;
    if(isNaN(k)||k<0||k>11)return;
    m[k].fat+=Number(p.total)||0;
    m[k].ped++;
    if(p.tipo==='entrega')m[k].entrega++; else m[k].loja++;
    m[k].desc+=Number(p.desconto)||0;
    m[k].taxa+=Number(p.taxa)||0;
    m[k].itens+=(p.itens||[]).reduce(function(a,i){return a+(Number(i.qtd)||0)},0);
    if(p.clienteId)m[k].clientes[p.clienteId]=true;
  });
  /* custo da mercadoria: saídas de estoque por venda */
  (DB.movEst||[]).forEach(function(mv){
    var d=String(mv.data||'');
    if(d.slice(0,4)!==String(ano))return;
    var k=parseInt(d.slice(5,7),10)-1;
    if(isNaN(k)||k<0||k>11)return;
    (mv.linhas||[]).forEach(function(l){
      if(l.direcao!=='saida')return;
      if(String(l.origem||'')!=='venda')return;
      m[k].cmv+=(Number(l.qtd)||0)*(Number(l.custo)||0);
    });
  });
  m.forEach(function(x){
    x.ticket=x.ped?x.fat/x.ped:0;
    x.nclientes=Object.keys(x.clientes).length;
    x.cmvPct=x.fat?(x.cmv/x.fat*100):0;
    x.margem=x.fat?((x.fat-x.cmv)/x.fat*100):0;
  });
  return m;
}
var MESES_CURTO=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
/* junta tudo de um mês, dia a dia */
function dadosMes(ano,mes){
  var dias=new Date(ano,mes,0).getDate();
  var d=[];
  for(var i=0;i<dias;i++)d.push({fat:0,ped:0,loja:0,entrega:0,desc:0,taxa:0,cmv:0,clientes:{},itens:0});
  var pref=ano+'-'+String(mes).padStart(2,'0');
  (DB.pedidos||[]).forEach(function(p){
    if(ehCancelado(p))return;
    if(CA.sucs.length&&CA.sucs.indexOf(p.sucursalId||'suc_matriz')<0)return;
    var s2=String(p.data||'');
    if(s2.slice(0,7)!==pref)return;
    var k=parseInt(s2.slice(8,10),10)-1;
    if(isNaN(k)||k<0||k>=dias)return;
    d[k].fat+=Number(p.total)||0; d[k].ped++;
    if(p.tipo==='entrega')d[k].entrega++; else d[k].loja++;
    d[k].desc+=Number(p.desconto)||0; d[k].taxa+=Number(p.taxa)||0;
    d[k].itens+=(p.itens||[]).reduce(function(a,i){return a+(Number(i.qtd)||0)},0);
    if(p.clienteId)d[k].clientes[p.clienteId]=true;
  });
  (DB.movEst||[]).forEach(function(mv){
    var s3=String(mv.data||'');
    if(s3.slice(0,7)!==pref)return;
    var k2=parseInt(s3.slice(8,10),10)-1;
    if(isNaN(k2)||k2<0||k2>=dias)return;
    (mv.linhas||[]).forEach(function(l){
      if(l.direcao!=='saida'||String(l.origem||'')!=='venda')return;
      d[k2].cmv+=(Number(l.qtd)||0)*(Number(l.custo)||0);
    });
  });
  d.forEach(function(x){
    x.ticket=x.ped?x.fat/x.ped:0;
    x.nclientes=Object.keys(x.clientes).length;
    x.cmvPct=x.fat?(x.cmv/x.fat*100):0;
    x.margem=x.fat?((x.fat-x.cmv)/x.fat*100):0;
  });
  return d;
}
function mesesComVenda(){
  var s4={};
  (DB.pedidos||[]).forEach(function(p){
    var m=String(p.data||'').slice(0,7);
    if(m.length===7)s4[m]=true;
  });
  var h=new Date();
  s4[h.toISOString().slice(0,7)]=true;
  var ant=new Date(h.getFullYear(),h.getMonth()-1,1);
  s4[ant.toISOString().slice(0,7)]=true;
  return Object.keys(s4).sort().reverse();
}
function nomeMes(ym){
  var p=String(ym).split('-');
  return MESES_CURTO[Number(p[1])-1]+'/'+p[0];
}
var METRICAS=[
 {id:'fat',      n:'Faturamento',        fmt:'money', dica:'soma dos pedidos não cancelados'},
 {id:'ped',      n:'Pedidos',            fmt:'int',   dica:'quantidade de pedidos'},
 {id:'ticket',   n:'Ticket médio',       fmt:'money', dica:'faturamento dividido pelos pedidos'},
 {id:'loja',     n:'Frente de caixa',    fmt:'int',   dica:'pedidos feitos na loja'},
 {id:'entrega',  n:'Entrega',            fmt:'int',   dica:'pedidos de delivery'},
 {id:'itens',    n:'Itens vendidos',     fmt:'int',   dica:'soma das quantidades dos itens'},
 {id:'nclientes',n:'Clientes atendidos', fmt:'int',   dica:'clientes diferentes no mês'},
 {id:'cmv',      n:'CMV (R$)',           fmt:'money', dica:'custo das mercadorias que saíram por venda'},
 {id:'cmvPct',   n:'CMV (%)',            fmt:'pct',   dica:'custo dividido pelo faturamento'},
 {id:'margem',   n:'Margem bruta (%)',   fmt:'pct',   dica:'quanto sobra depois do custo da mercadoria'},
 {id:'desc',     n:'Descontos',          fmt:'money', dica:'descontos e cupons concedidos'},
 {id:'taxa',     n:'Taxa de entrega',    fmt:'money', dica:'taxas cobradas nas entregas'}
];
function fmtM(v,tipo){
  if(tipo==='money')return 'R$ '+money(v);
  if(tipo==='pct')return (Number(v)||0).toFixed(1).replace('.',',')+'%';
  return fmtQt(Math.round(v));
}

function telaComparativo(){
  baseMov();
  var anos=anosComVenda(), meses=mesesComVenda();
  if(!CA.a2)CA.a2=Number(anos[0]);
  if(!CA.a1)CA.a1=CA.a2-1;
  if(!CA.m2)CA.m2=meses[0];
  if(!CA.m1)CA.m1=meses[1]||meses[0];
  var mensal=(CA.modo==='mensal');

  var d1,d2,rot,tit1,tit2;
  if(mensal){
    var p1=CA.m1.split('-'), p2=CA.m2.split('-');
    d1=dadosMes(Number(p1[0]),Number(p1[1]));
    d2=dadosMes(Number(p2[0]),Number(p2[1]));
    var n=Math.max(d1.length,d2.length);
    while(d1.length<n)d1.push({fat:0,ped:0,loja:0,entrega:0,desc:0,taxa:0,cmv:0,itens:0,ticket:0,nclientes:0,cmvPct:0,margem:0});
    while(d2.length<n)d2.push({fat:0,ped:0,loja:0,entrega:0,desc:0,taxa:0,cmv:0,itens:0,ticket:0,nclientes:0,cmvPct:0,margem:0});
    rot=[];for(var r=1;r<=n;r++)rot.push(String(r));
    tit1=nomeMes(CA.m1); tit2=nomeMes(CA.m2);
  }else{
    d1=dadosAno(CA.a1); d2=dadosAno(CA.a2);
    rot=MESES_CURTO.slice(); tit1=String(CA.a1); tit2=String(CA.a2);
  }
  var met=METRICAS.find(function(x){return x.id===CA.metrica})||METRICAS[0];

  function tot(d,campo){
    if(campo==='ticket'){
      var f=d.reduce(function(a,x){return a+x.fat},0),p=d.reduce(function(a,x){return a+x.ped},0);
      return p?f/p:0;
    }
    if(campo==='cmvPct'||campo==='margem'){
      var f2=d.reduce(function(a,x){return a+x.fat},0),c=d.reduce(function(a,x){return a+x.cmv},0);
      if(!f2)return 0;
      return campo==='cmvPct'?(c/f2*100):((f2-c)/f2*100);
    }
    return d.reduce(function(a,x){return a+(Number(x[campo])||0)},0);
  }
  function varia(a,b){ if(!a)return b?100:0; return ((b-a)/Math.abs(a))*100; }

  var vals=[];
  for(var i=0;i<rot.length;i++){vals.push(d1[i]?d1[i][met.id]||0:0);vals.push(d2[i]?d2[i][met.id]||0:0);}
  var maxV=Math.max.apply(null,vals.concat([1]));
  var barras='';
  for(var i2=0;i2<rot.length;i2++){
    var v1=d1[i2]?d1[i2][met.id]||0:0, v2=d2[i2]?d2[i2][met.id]||0:0;
    var h1=Math.max(2,(v1/maxV)*150), h2=Math.max(2,(v2/maxV)*150);
    var vr2=varia(v1,v2);
    barras+='<div class="caCol'+(mensal?' fino':'')+'">'+
      '<div class="caBarras">'+
       '<div class="caB b1" style="height:'+h1+'px">'+
        '<span class="caTip">'+E(tit1)+'<br>'+fmtM(v1,met.fmt)+'</span></div>'+
       '<div class="caB b2" style="height:'+h2+'px">'+
        '<span class="caTip">'+E(tit2)+'<br>'+fmtM(v2,met.fmt)+
        ((v1||v2)?'<br><i class="'+(vr2>=0?'sobe':'desce')+'">'+(vr2>=0?'▲ +':'▼ ')+
          vr2.toFixed(0)+'%</i>':'')+'</span></div>'+
      '</div><div class="caMes">'+rot[i2]+'</div></div>';
  }

  $('content').innerHTML='<div class="etWrap"><div class="etScroll">'+
   '<div class="etTopo">'+
    '<div><h1>Comparativo Anual e Mensal</h1>'+
    '<p>Compare dois anos ou dois meses e veja onde cresceu ou caiu.</p></div>'+
    '<button class="infoBt" onclick="explicaComparativo()" title="Como este relatório é feito">'+
     sv('help',15)+'</button>'+
    '<div style="flex:1"></div>'+
    '<button class="btnP2" onclick="exportarComparativo()">'+sv('down2',13)+' Exportar</button>'+
   '</div>'+
   '<div class="caModo">'+
    '<button class="caModoB'+(!mensal?' on':'')+'" onclick="CA.modo=\'anual\';telaComparativo()">'+
     sv('chart',14)+' Ano contra ano</button>'+
    '<button class="caModoB'+(mensal?' on':'')+'" onclick="CA.modo=\'mensal\';telaComparativo()">'+
     sv('list',14)+' Mês contra mês</button>'+
   '</div>'+
   '<div class="etFiltros">'+
   (mensal
    ?'<div class="f2" style="max-width:170px"><label>Mês base</label>'+
      '<select onchange="CA.m1=this.value;telaComparativo()">'+
      meses.map(function(m){return '<option value="'+m+'"'+(CA.m1===m?' selected':'')+'>'+nomeMes(m)+'</option>'}).join('')+
      '</select></div>'+
     '<div class="f2" style="max-width:170px"><label>Comparar com</label>'+
      '<select onchange="CA.m2=this.value;telaComparativo()">'+
      meses.map(function(m){return '<option value="'+m+'"'+(CA.m2===m?' selected':'')+'>'+nomeMes(m)+'</option>'}).join('')+
      '</select></div>'
    :'<div class="f2" style="max-width:130px"><label>Ano base</label>'+
      '<select onchange="CA.a1=Number(this.value);telaComparativo()">'+
      anos.map(function(a){return '<option value="'+a+'"'+(CA.a1==a?' selected':'')+'>'+a+'</option>'}).join('')+
      '</select></div>'+
     '<div class="f2" style="max-width:130px"><label>Comparar com</label>'+
      '<select onchange="CA.a2=Number(this.value);telaComparativo()">'+
      anos.map(function(a){return '<option value="'+a+'"'+(CA.a2==a?' selected':'')+'>'+a+'</option>'}).join('')+
      '</select></div>')+
    seletorSuc('caSuc',CA.sucs,'togCA','togTodosCA()')+
    '<div class="f2"><label>Indicador do gráfico</label>'+
     '<select onchange="CA.metrica=this.value;telaComparativo()">'+
     METRICAS.map(function(m){return '<option value="'+m.id+'"'+(CA.metrica===m.id?' selected':'')+'>'+m.n+'</option>'}).join('')+
     '</select></div>'+
   '</div>'+

   '<div class="caResumo">'+
   METRICAS.slice(0,6).map(function(m){
     var t1=tot(d1,m.id), t2=tot(d2,m.id), vr=varia(t1,t2);
     return '<div class="caCard">'+
      '<span class="caCardT">'+m.n+'</span>'+
      '<div class="caCardV"><b>'+fmtM(t2,m.fmt)+'</b>'+
       '<span class="caVar '+(vr>=0?'sobe':'desce')+'">'+(vr>=0?'▲':'▼')+' '+
       Math.abs(vr).toFixed(1).replace('.',',')+'%</span></div>'+
      '<span class="caCardA">'+E(tit1)+': '+fmtM(t1,m.fmt)+'</span></div>';
   }).join('')+
   '</div>'+

   '<div class="caGraf">'+
    '<div class="caGrafH">'+E(met.n)+' — '+E(tit1)+' contra '+E(tit2)+
     (mensal?' <small style="font-weight:400;color:var(--ink-3)">(por dia)</small>':'')+
     '<span class="caLeg"><i class="b1"></i>'+E(tit1)+'<i class="b2"></i>'+E(tit2)+'</span></div>'+
    '<div class="caBox">'+barras+'</div>'+
   '</div>'+

   '<div class="etTabW plano2"><table class="etTab caTab"><thead><tr>'+
    '<th style="width:150px">Indicador</th>'+
    rot.map(function(m){return '<th style="text-align:right">'+m+'</th>'}).join('')+
    '<th style="text-align:right;width:120px">Total</th></tr></thead><tbody>'+
    METRICAS.map(function(m){
      var t1=tot(d1,m.id), t2=tot(d2,m.id), vr=varia(t1,t2);
      return '<tr class="caGrupo"><td colspan="'+(rot.length+2)+'"><b>'+m.n+'</b> '+
        '<small style="color:var(--ink-3)">'+m.dica+'</small></td></tr>'+
      '<tr><td class="caAno">'+E(tit1)+'</td>'+
       d1.map(function(x){return '<td style="text-align:right">'+fmtM(x[m.id],m.fmt)+'</td>'}).join('')+
       '<td style="text-align:right"><b>'+fmtM(t1,m.fmt)+'</b></td></tr>'+
      '<tr><td class="caAno destaque">'+E(tit2)+'</td>'+
       d2.map(function(x,k){
         var a=d1[k]?d1[k][m.id]||0:0,b=x[m.id]||0;
         var v=varia(a,b);
         return '<td style="text-align:right">'+fmtM(b,m.fmt)+
           (a||b?'<small class="'+(v>=0?'vg':'vr')+'">'+(v>=0?'+':'')+v.toFixed(0)+'%</small>':'')+'</td>';
       }).join('')+
       '<td style="text-align:right"><b>'+fmtM(t2,m.fmt)+'</b>'+
       '<small class="'+(vr>=0?'vg':'vr')+'">'+(vr>=0?'+':'')+vr.toFixed(1).replace('.',',')+'%</small></td></tr>';
    }).join('')+
   '</tbody></table></div>'+
   '</div></div>';
  rodape('comparando '+tit1+' e '+tit2);
}
function togCA(s){togFiltro(CA.sucs,s);telaComparativo();}
function togTodosCA(){CA.sucs=CA.sucs.length?[]:sucursaisDoUsuario().map(function(s){return s.id});telaComparativo();}
function explicaComparativo(){
  var h='<div class="mdB"><div class="blk" style="margin:0;max-width:none">'+
  '<h3>De onde vem cada número</h3>'+
  '<div class="expList">'+
   METRICAS.map(function(m){
     return '<div class="expIt"><b>'+m.n+'</b><span>'+m.dica+'</span></div>';
   }).join('')+
  '</div>'+
  '<div class="hint" style="margin-top:14px;line-height:1.7">'+
   '<b>Fontes:</b> os pedidos vêm do PDV (tabela de pedidos), considerando apenas os '+
   'não cancelados. O CMV vem das movimentações de estoque com origem em venda, usando o '+
   'custo médio de cada item no momento da baixa.<br><br>'+
   '<b>O que não entra:</b> pedidos cancelados, perdas de produção, ajustes de contagem '+
   'e movimentações manuais de estoque. Esses aparecem nos relatórios próprios.<br><br>'+
   '<b>Período:</b> a data considerada é a da venda, não a do pagamento.'+
  '</div></div></div>';
  var o=document.createElement('div');o.className='mdOv';o.id='mdOv';
  o.innerHTML='<div class="mdBox lg"><div class="mdH"><b>Como este relatório é feito</b>'+
   '<button onclick="fecharModal()">&times;</button></div>'+h+
   '<div class="mdF"><button class="btnP2" onclick="fecharModal()">Fechar</button></div></div>';
  document.body.appendChild(o);
  fecharSoForaDeVerdade(o);
}
function exportarComparativo(){
  var mensal=(CA.modo==='mensal'), d1,d2,rot,t1,t2;
  if(mensal){
    var p1=CA.m1.split('-'),p2=CA.m2.split('-');
    d1=dadosMes(Number(p1[0]),Number(p1[1])); d2=dadosMes(Number(p2[0]),Number(p2[1]));
    rot=[];for(var r=1;r<=Math.max(d1.length,d2.length);r++)rot.push('Dia '+r);
    t1=nomeMes(CA.m1); t2=nomeMes(CA.m2);
  }else{
    d1=dadosAno(CA.a1); d2=dadosAno(CA.a2); rot=MESES_CURTO.slice();
    t1=String(CA.a1); t2=String(CA.a2);
  }
  var l=[['Indicador','Período'].concat(rot).concat(['Total'])];
  METRICAS.forEach(function(m){
    [[t1,d1],[t2,d2]].forEach(function(par){
      var linha=[m.n,par[0]];
      var t=0;
      par[1].forEach(function(x){linha.push(String(x[m.id]||0).replace('.',','));t+=Number(x[m.id])||0;});
      linha.push(String(t.toFixed(2)).replace('.',','));
      l.push(linha);
    });
  });
  var csv=l.map(function(r){return r.map(function(c){return '"'+String(c).replace(/"/g,'""')+'"'}).join(';')}).join('\n');
  var b=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'});
  var a=document.createElement('a');a.href=URL.createObjectURL(b);
  a.download='nexor-comparativo-'+String(t1).replace('/','-')+'-'+String(t2).replace('/','-')+'.csv';
  document.body.appendChild(a);a.click();setTimeout(function(){a.remove()},400);
  toast('Comparativo exportado.');
}

/* ==========================================================
   FATURAMENTO
   ========================================================== */
var FTP={de:'',ate:'',sucs:[],canais:[]};
function telaFaturamento(){
  baseMov();baseSuc();
  /* ==========================================================
     ITEM 10 — A TELA ABRE NEUTRA

     Antes `periodoPadrao(FTP)` preenchia sozinho o mes inteiro assim
     que a tela abria. Dois problemas: o numero grande que aparecia nao
     era o que a pessoa foi ver (ela quase sempre quer o dia), e o mes
     inteiro era percorrido a toa toda vez.

     Agora nao se presume periodo nenhum. A tela mostra os filtros e os
     atalhos; os numeros so aparecem depois da escolha.
     ========================================================== */
  var semPeriodo=!FTP.de&&!FTP.ate;
  var peds=semPeriodo?[]:pedsPeriodo(FTP);
  function tk(lista){
    var v=lista.reduce(function(a,p){return a+(Number(p.total)||0)},0);
    return {v:v,q:lista.length,t:lista.length?v/lista.length:0};
  }
  var tot=tk(peds);
  var ent=tk(peds.filter(function(p){return p.tipo==='entrega'}));
  var ret=tk(peds.filter(function(p){return p.tipo==='retirada'}));
  var sal=tk(peds.filter(function(p){return p.tipo==='loja'||p.tipo==='salao'}));
  var fic=tk(peds.filter(function(p){return p.tipo!=='entrega'&&p.tipo!=='retirada'}));

  var porLoja=sucAtivas().map(function(s){
    var l=peds.filter(function(p){return sucursalDoPedido(p)===s.id});
    var x=tk(l);
    return {suc:s,valor:x.v,qtd:x.q,ticket:x.t,
      ent:tk(l.filter(function(p){return p.tipo==='entrega'})).t,
      ret:tk(l.filter(function(p){return p.tipo==='retirada'})).t,
      sal:tk(l.filter(function(p){return p.tipo!=='entrega'&&p.tipo!=='retirada'})).t};
  }).sort(function(a,b){return b.valor-a.valor});
  var maxL=Math.max.apply(null,porLoja.map(function(x){return x.valor}).concat([1]));

  var KPI=[
   ['Faturamento Total','R$ '+money(tot.v),'#00B8D4','chart'],
   ['Ticket entrega','R$ '+money(ent.t),'#5B7C8D','truck'],
   ['Ticket retirada','R$ '+money(ret.t),'#F5A623','bag'],
   ['Ticket salão','R$ '+money(sal.t),'#4CAF50','users'],
   ['Ticket ficha','R$ '+money(fic.t),'#E8574A','file']
  ];

  $('content').innerHTML='<div class="etWrap"><div class="etScroll">'+
   '<div class="etTopo">'+
    '<div><h1>Faturamento</h1><p>Quanto cada unidade está faturando no período.</p></div>'+
    '<button class="infoBt" onclick="explicaFaturamento()">'+sv('help',15)+'</button>'+
    '<div style="flex:1"></div>'+
    '<button class="btnP2" onclick="imprimirRel(\'Faturamento\')">'+sv('print2',13)+' PDF</button>'+
   '</div>'+
   '<div class="barraF">'+
    '<div class="bfCampo"><label>Data inicial</label><input type="date" id="ftDe" value="'+FTP.de+'"></div>'+
    '<div class="bfCampo"><label>Data final</label><input type="date" id="ftAte" value="'+FTP.ate+'"></div>'+
    seletorSuc('ftSuc',FTP.sucs,'togFT','togTodosFT()')+
    seletorCanal('ftCan',FTP.canais,'togCanFT','togTodosCanFT()')+
    '<button class="btnP2 ok" onclick="FTP.de=$(\'ftDe\').value;FTP.ate=$(\'ftAte\').value;telaFaturamento()">'+
     sv('search',13)+' Buscar</button>'+
    '<div class="bfAtalhos">'+
     '<button onclick="perFT(1)">Hoje</button>'+
     '<button onclick="perFT(-2)">Ontem</button>'+
     '<button onclick="perFT(7)">7 dias</button>'+
     '<button onclick="perFT(0)">Este mês</button>'+
     '<button onclick="perFT(-1)">Mês anterior</button></div>'+
   '</div>'+
   /* sem periodo escolhido: diz o que fazer, em vez de mostrar zeros que
      parecem defeito */
   (semPeriodo
     ? '<div class="ftVazio">'+sv('chart',26)+
       '<div><b>Escolha o período</b>'+
       '<span>Use um atalho acima — Hoje, Ontem, 7 dias, Este mês — '+
       'ou informe as datas e clique em Buscar.</span></div></div>'
     : '')+
   (semPeriodo?'':'<div class="kpiFaixa">')+(semPeriodo?'':KPI.map(function(k){
     return '<div class="kpiC" style="--c:'+k[2]+'">'+
      '<div class="kpiIc">'+sv(k[3],20)+'</div>'+
      '<div><span>'+E(k[0])+'</span><b>'+E(k[1])+'</b></div></div>';
   }).join('')+'</div>')+
   (semPeriodo?'':'<div class="etTabW plano2" id="relArea">'+
   '<table class="etTab semBusca"><thead><tr>'+
    '<th style="width:30px"></th><th>Loja</th>'+
    '<th style="width:140px;text-align:right">Faturamento</th>'+
    '<th style="width:100px;text-align:right">Pedidos</th>'+
    '<th style="width:120px;text-align:right">Ticket entrega</th>'+
    '<th style="width:120px;text-align:right">Ticket retirada</th>'+
    '<th style="width:120px;text-align:right">Ticket salão</th>'+
    '<th style="width:230px">Representatividade</th></tr></thead><tbody>'+
   porLoja.map(function(x){
     var pc=tot.v?(x.valor/tot.v*100):0;
     return '<tr><td><span class="pontoSuc" style="background:'+(x.suc.cor||'#00A08B')+'"></span></td>'+
     '<td><b>'+E(x.suc.nome)+'</b></td>'+
     '<td style="text-align:right"><b>R$ '+money(x.valor)+'</b></td>'+
     '<td style="text-align:right">'+x.qtd+'</td>'+
     '<td style="text-align:right">R$ '+money(x.ent)+'</td>'+
     '<td style="text-align:right">R$ '+money(x.ret)+'</td>'+
     '<td style="text-align:right">R$ '+money(x.sal)+'</td>'+
     '<td><div class="repBar"><i style="width:'+pc+'%;background:'+(x.suc.cor||'#00A08B')+'"></i>'+
      '<span>'+pc.toFixed(2).replace('.',',')+'%</span></div></td></tr>';
   }).join('')+'</tbody></table></div>'+
   '<div class="grafCard" style="margin:0 16px 16px">'+
    '<div class="grafH"><div><b>Faturamento por loja</b>'+
     '<span>'+dataBR(FTP.de)+' a '+dataBR(FTP.ate)+'</span></div></div>'+
    '<div class="grafBox">'+(function(){
      var W=Math.max(520,porLoja.length*130),H=250,PL=64,PR=18,PT=18,PB=44;
      var iw=W-PL-PR,ih=H-PT-PB;
      var passo=iw/Math.max(1,porLoja.length);
      var larg=Math.min(78,passo*0.58);
      var g='',eixo='';
      for(var k=0;k<=4;k++){
        var y=PT+ih-(ih*k/4);
        g+='<line x1="'+PL+'" y1="'+y+'" x2="'+(W-PR)+'" y2="'+y+'" stroke="var(--line-2)"'+
          (k?' stroke-dasharray="3 4"':'')+'/>';
        eixo+='<text x="'+(PL-9)+'" y="'+(y+4)+'" text-anchor="end" font-size="10" '+
          'fill="var(--ink-3)">'+(maxL*k/4>=1000?(maxL*k/4/1000).toFixed(1)+'k':Math.round(maxL*k/4))+'</text>';
      }
      var b='';
      porLoja.forEach(function(x,k){
        var h=Math.max(2,(x.valor/maxL)*ih);
        var px=PL+passo*k+(passo-larg)/2;
        var py=PT+ih-h;
        b+='<g class="gBar"><rect x="'+px+'" y="'+py+'" width="'+larg+'" height="'+h+'" rx="5" '+
          'fill="'+(x.suc.cor||'#00A08B')+'" opacity=".88"/>'+
          '<text x="'+(px+larg/2)+'" y="'+(py-7)+'" text-anchor="middle" font-size="11" '+
           'font-weight="700" fill="var(--ink-2)">R$ '+money(x.valor)+'</text>'+
          '<text x="'+(px+larg/2)+'" y="'+(H-16)+'" text-anchor="middle" font-size="10.5" '+
           'fill="var(--ink-2)" font-weight="600">'+E(x.suc.apelido||x.suc.nome)+'</text></g>';
      });
      return '<svg viewBox="0 0 '+W+' '+H+'" width="100%" height="'+H+'">'+g+eixo+b+'</svg>';
    })()+'</div></div>'+
   '</div>')+'</div>';
  rodape(semPeriodo?'escolha o período'
    :('R$ '+money(tot.v)+' · '+porLoja.length+' loja(s)'));
}
function togFT(s){togFiltro(FTP.sucs,s);telaFaturamento();}
function togTodosFT(){FTP.sucs=FTP.sucs.length?[]:sucAtivas().map(function(s){return s.id});telaFaturamento();}
function perFT(n){
  var d=new Date();
  if(n===0){FTP.de=new Date(d.getFullYear(),d.getMonth(),1).toISOString().slice(0,10);FTP.ate=hojeISO();}
  else if(n===-1){FTP.de=new Date(d.getFullYear(),d.getMonth()-1,1).toISOString().slice(0,10);
    FTP.ate=new Date(d.getFullYear(),d.getMonth(),0).toISOString().slice(0,10);}
  else if(n===1){FTP.de=hojeISO();FTP.ate=hojeISO();}
  else if(n===-2){FTP.de=diasAtrasISO(1);FTP.ate=diasAtrasISO(1);}
  else {FTP.de=diasAtrasISO(n);FTP.ate=hojeISO();}
  telaFaturamento();
}
function explicaFaturamento(){
  explicaRel('Faturamento — como é feito',[
   ['Faturamento total','soma dos pedidos do período, sem os cancelados, nas sucursais escolhidas'],
   ['Ticket entrega','faturamento das entregas dividido pela quantidade de entregas'],
   ['Ticket retirada','mesma conta para os pedidos de retirada'],
   ['Ticket salão','mesma conta para as vendas no salão e balcão'],
   ['Ticket ficha','ticket médio de tudo que não é entrega — é a venda de frente de caixa'],
   ['Representatividade','peso de cada loja no faturamento total do período'],
   ['Gráfico por loja','faturamento de cada unidade, na cor cadastrada da sucursal']
  ],'os pedidos do PDV de cada sucursal, no período escolhido.',
   'pedidos cancelados e sucursais desmarcadas no filtro.');
}

/* ==========================================================
   VENDA POR DATA E HORA
   ========================================================== */
var VDH={de:'',ate:'',sucs:[],canais:[],aba:'hora'};
function telaVendaDataHora(){
  baseMov();baseSuc();
  periodoPadrao(VDH);
  var peds=pedsPeriodo(VDH);
  var total=peds.reduce(function(a,p){return a+(Number(p.total)||0)},0);

  /* ==========================================================
     A HORA DA VENDA IMPORTADA NAO EXISTE

     A carga do sistema antigo trouxe 315 vendas de agosto de 2026 — R$
     50.763,38 — e nenhuma delas tinha hora. Todas foram gravadas com
     "19:00" para ocupar o campo. O grafico somava esse carimbo como se
     fosse hora de venda: uma barra de R$ 51,5 mil as 19h contra menos
     de R$ 2 mil em cada uma das outras onze horas do dia, e "Melhor
     horario: 19h" no topo da tela.

     Nunca houve pico as 19h. O que houve foi a importacao.

     Quem tem hora de verdade e a venda registrada no PDV, no cardapio
     ou no WhatsApp — nessas o relogio marcou o momento do atendimento,
     no horario de Sao Paulo (`agoraHM`). A venda importada continua
     contando no faturamento, no numero de pedidos e no dia da semana,
     porque a DATA dela e verdadeira; so a hora nao e, e por isso ela
     fica fora do grafico de horario, com o aviso na tela dizendo
     quantas ficaram e quanto elas somam.
     ========================================================== */
  var comHora=peds.filter(function(p){return String(p.origem||'')!=='importado'});
  var semHora=peds.filter(function(p){return String(p.origem||'')==='importado'});
  var vSemHora=semHora.reduce(function(a,p){return a+(Number(p.total)||0)},0);
  /* por hora */
  var horas=[];for(var h=0;h<24;h++)horas.push({v:0,q:0});
  comHora.forEach(function(p){
    var hh=parseInt(String(p.hora||'0').slice(0,2),10);
    if(isNaN(hh)||hh<0||hh>23)return;
    horas[hh].v+=Number(p.total)||0;horas[hh].q++;
  });
  var temHora=horas.some(function(x){return x.q>0});
  var hIni=0,hFim=23;
  while(hIni<23&&!horas[hIni].q)hIni++;
  while(hFim>0&&!horas[hFim].q)hFim--;
  if(hIni>hFim){hIni=8;hFim=22;}
  /* ==========================================================
     "DOMINGO: 177 PEDIDOS EM 120 DIA(S)" — EM UM MES DE 31 DIAS

     A conta da media dividia pelo numero de dias em que aquele dia da
     semana apareceu. So que a chave usada para contar os dias era
     `p.data` — o carimbo INTEIRO da venda, com hora, minuto, segundo e
     fuso ("2026-08-30T18:00:31.364Z"). Cada pedido virava um "dia".

     Agosto de 2026 tem cinco domingos. A tela dizia 120, que e
     exatamente o numero de carimbos diferentes dos domingos: 117 vendas
     de PDV, cada uma no seu segundo, mais os tres domingos importados,
     que compartilham o mesmo carimbo por dia.

     Consequencia: a media de cada dia da semana saia dividida por um
     numero inventado, e o "Melhor dia" era o dia com menos carimbos
     distintos — quarta-feira, com 11, que so tinha essa marca por ser o
     dia com mais venda importada em relacao a venda digitada. Domingo,
     que e o dia forte da loja, aparecia em quinto.

     A chave agora e o DIA da loja (`diaLocal`, fuso de Sao Paulo), que
     e o que a frase "em N dia(s)" sempre quis dizer.
     ========================================================== */
  var sem=[];for(var d=0;d<7;d++)sem.push({v:0,q:0,dias:{}});
  peds.forEach(function(p){
    var dia=diaLocal(p.data);
    var k=diaSemana(dia);
    sem[k].v+=Number(p.total)||0;sem[k].q++;sem[k].dias[dia]=true;
  });
  sem.forEach(function(x){x.nd=Object.keys(x.dias).length;x.media=x.nd?x.v/x.nd:0;});
  var maxSem=Math.max.apply(null,sem.map(function(x){return x.media}).concat([1]));
  var maxH=Math.max.apply(null,horas.map(function(x){return x.v}).concat([1]));
  /* melhor hora e melhor dia */
  var melhorH=horas.indexOf(horas.slice().sort(function(a,b){return b.v-a.v})[0]);
  var melhorD=sem.indexOf(sem.slice().sort(function(a,b){return b.media-a.media})[0]);

  $('content').innerHTML='<div class="etWrap"><div class="etScroll">'+
   '<div class="etTopo">'+
    '<div><h1>Venda por Data e Hora</h1><p>Quando a loja vende mais — por hora e por dia da semana.</p></div>'+
    '<button class="infoBt" onclick="explicaDataHora()">'+sv('help',15)+'</button>'+
    '<div style="flex:1"></div>'+
    '<button class="btnP2" onclick="imprimirRel(\'Venda por Data e Hora\')">'+sv('print2',13)+' PDF</button>'+
   '</div>'+
   '<div class="barraF">'+
    '<div class="bfCampo"><label>Data inicial</label><input type="date" id="vdDe" value="'+VDH.de+'"></div>'+
    '<div class="bfCampo"><label>Data final</label><input type="date" id="vdAte" value="'+VDH.ate+'"></div>'+
    seletorSuc('vdSuc',VDH.sucs,'togVDH','togTodosVDH()')+
    seletorCanal('vdCan',VDH.canais,'togCanVD','togTodosCanVD()')+
    '<button class="btnP2 ok" onclick="VDH.de=$(\'vdDe\').value;VDH.ate=$(\'vdAte\').value;telaVendaDataHora()">'+
     sv('search',13)+' Buscar</button>'+
    '<div class="bfAtalhos">'+
     '<button onclick="perVDH(0)">Mês</button><button onclick="perVDH(-1)">Anterior</button>'+
     '<button onclick="perVDH(30)">30d</button><button onclick="perVDH(90)">90d</button></div>'+
   '</div>'+
   '<div class="relKpis">'+
    '<div class="rk dest"><span>Faturamento</span><b>R$ '+money(total)+'</b></div>'+
    '<div class="rk"><span>Pedidos</span><b>'+peds.length+'</b></div>'+
    '<div class="rk"><span>Melhor horário</span><b>'+
     (temHora?String(melhorH).padStart(2,'0')+'h':'—')+'</b></div>'+
    '<div class="rk"><span>Melhor dia</span><b>'+DIAS_SEM[melhorD]+'</b></div>'+
    '<div class="rk"><span>Média por dia da semana</span><b>R$ '+money(sem[melhorD].media)+'</b></div>'+
   '</div>'+
   '<div class="grafCard" style="margin:12px 16px" id="relArea">'+
    '<div class="grafH"><div><b>Faturamento por horário</b>'+
     '<span>soma de todos os dias do período · horário de São Paulo'+
      (semHora.length?' · fora: '+semHora.length+' venda(s) importada(s), R$ '+money(vSemHora)+
       ', sem hora de venda':'')+'</span></div>'+
     '<div class="grafLeg"><span><i class="lg1"></i>valor por hora</span></div></div>'+
    '<div class="grafBox">'+(function(){
      if(!temHora)return '<div class="hint" style="padding:26px;text-align:center">'+
        'Nenhuma venda com hora de venda no período'+
        (semHora.length?' — as '+semHora.length+' vendas do período vieram da importação do sistema antigo, que não trouxe horário.':'.')+
        '</div>';
      var n=hFim-hIni+1;
      var W=Math.max(620,n*54),H=250,PL=62,PR=18,PT=22,PB=42;
      var iw=W-PL-PR,ih=H-PT-PB,passo=iw/n,larg=Math.min(30,passo*0.55);
      var g='',eixo='',b='';
      for(var k=0;k<=4;k++){
        var y=PT+ih-(ih*k/4);
        g+='<line x1="'+PL+'" y1="'+y+'" x2="'+(W-PR)+'" y2="'+y+'" stroke="var(--line-2)"'+
          (k?' stroke-dasharray="3 4"':'')+'/>';
        eixo+='<text x="'+(PL-9)+'" y="'+(y+4)+'" text-anchor="end" font-size="10" fill="var(--ink-3)">'+
          (maxH*k/4>=1000?(maxH*k/4/1000).toFixed(1)+'k':Math.round(maxH*k/4))+'</text>';
      }
      for(var hh=hIni;hh<=hFim;hh++){
        var x2=horas[hh];
        var i2=hh-hIni;
        var hgt=Math.max(2,(x2.v/maxH)*ih);
        var px=PL+passo*i2+(passo-larg)/2;
        var py=PT+ih-hgt;
        var pico=(hh===melhorH);
        b+='<g class="gBar"><rect x="'+px+'" y="'+py+'" width="'+larg+'" height="'+hgt+'" rx="4" '+
          'fill="'+(pico?'#00806F':'url(#gradEnt)')+'"/>'+
          '<text x="'+(px+larg/2)+'" y="'+(H-16)+'" text-anchor="middle" font-size="10" '+
           'fill="'+(pico?'var(--acc-d)':'var(--ink-3)')+'" font-weight="'+(pico?'700':'500')+'">'+
           String(hh).padStart(2,'0')+'h</text>'+
          '<g class="gTip"><rect x="'+Math.min(Math.max(px+larg/2-58,PL),W-PR-116)+'" y="'+Math.max(2,py-44)+'" '+
           'width="116" height="38" rx="7" fill="#122A42"/>'+
           '<text x="'+Math.min(Math.max(px+larg/2,PL+58),W-PR-58)+'" y="'+(Math.max(2,py-44)+15)+'" '+
            'text-anchor="middle" font-size="10" fill="#9AB4CC">'+String(hh).padStart(2,'0')+'h · '+x2.q+' pedidos</text>'+
           '<text x="'+Math.min(Math.max(px+larg/2,PL+58),W-PR-58)+'" y="'+(Math.max(2,py-44)+30)+'" '+
            'text-anchor="middle" font-size="12" fill="#5FE0CB" font-weight="700">R$ '+money(x2.v)+'</text></g></g>';
      }
      return '<svg viewBox="0 0 '+W+' '+H+'" width="100%" height="'+H+'">'+
        '<defs><linearGradient id="gradEnt" x1="0" y1="0" x2="0" y2="1">'+
        '<stop offset="0%" stop-color="#00B89E"/><stop offset="100%" stop-color="#00806F"/></linearGradient></defs>'+
        g+eixo+b+'</svg>';
    })()+'</div></div>'+
   '<div class="grafCard" style="margin:0 16px 16px">'+
    '<div class="grafH"><div><b>Média por dia da semana</b>'+
     '<span>faturamento médio de cada dia no período</span></div></div>'+
    '<div class="semGrade">'+sem.map(function(x,k){
      var pc=maxSem?(x.media/maxSem*100):0;
      return '<div class="semIt'+(k===melhorD?' top':'')+'">'+
       '<div class="semN">'+DIAS_SEM[k]+(k===melhorD?' <i>melhor</i>':'')+'</div>'+
       '<div class="semB"><i style="width:'+pc+'%"></i></div>'+
       '<div class="semV"><b>R$ '+money(x.media)+'</b>'+
        '<small>'+x.q+' pedidos em '+x.nd+' dia(s)</small></div></div>';
    }).join('')+'</div></div>'+
   '</div></div>';
  rodape('R$ '+money(total)+(temHora?' · pico às '+String(melhorH).padStart(2,'0')+'h':''));
}
function togVDH(s){togFiltro(VDH.sucs,s);telaVendaDataHora();}
function togTodosVDH(){VDH.sucs=VDH.sucs.length?[]:sucAtivas().map(function(s){return s.id});telaVendaDataHora();}
function perVDH(n){
  var d=new Date();
  if(n===0){VDH.de=new Date(d.getFullYear(),d.getMonth(),1).toISOString().slice(0,10);VDH.ate=hojeISO();}
  else if(n===-1){VDH.de=new Date(d.getFullYear(),d.getMonth()-1,1).toISOString().slice(0,10);
    VDH.ate=new Date(d.getFullYear(),d.getMonth(),0).toISOString().slice(0,10);}
  else {VDH.de=diasAtrasISO(n);VDH.ate=hojeISO();}
  telaVendaDataHora();
}
function explicaDataHora(){
  explicaRel('Venda por Data e Hora — como é feito',[
   ['Faturamento por horário','soma das vendas de cada hora, juntando todos os dias do período. A hora é a de São Paulo, gravada no momento da venda'],
   ['Melhor horário','a hora que mais faturou — útil para escalar equipe'],
   ['Média por dia da semana','faturamento total daquele dia dividido por quantos DIAS daquele dia da semana houve no período (agosto tem 5 domingos, então divide por 5)'],
   ['Melhor dia','o dia da semana com maior média, não com maior total'],
   ['Sucursais','com várias marcadas, os números somam; com uma só, mostra o comportamento dela']
  ],'a data e a hora gravadas em cada pedido no momento da venda, no fuso de São Paulo.',
   'pedidos cancelados. E, só no gráfico de horário, a venda trazida do sistema antigo: '+
   'ela não tem hora de venda, e entrar com a hora de carimbo criaria um pico que nunca existiu. '+
   'Essa venda continua contando no faturamento, nos pedidos e no dia da semana.');
}

/* ==========================================================
   CONFIGURAÇÃO DO PDV — com prévia ao lado
   ========================================================== */
var LAYOUTS_PDV=[
 {id:'lista',  n:'Lista sem foto',
  d:'linhas densas com nome e preço — o mais rápido para quem já conhece o cardápio'},
 {id:'quadro', n:'Quadrados com foto',
  d:'a foto inteira num quadrado, sem cortar nada'},
 {id:'linha',  n:'Linha com miniatura',
  d:'foto pequena ao lado do nome, cabe muito produto na tela'}
];
function cfgPDV(){
  var c=cfg();
  if(!c.layout||['foto','compacto','grade'].indexOf(c.layout)>=0)c.layout='quadro';
  if(c.colunas===undefined)c.colunas=4;
  if(c.mostraPreco===undefined)c.mostraPreco=true;
  if(c.mostraDesc===undefined)c.mostraDesc=false;
  if(c.botaoGrande===undefined)c.botaoGrande=false;
  return c;
}
function telaCfgPDV(){
  baseMov();
  var c=cfgPDV();
  $('content').innerHTML='<div class="etWrap"><div class="etScroll">'+
   '<div class="etTopo">'+
    '<div><h1>Configuração do PDV</h1><p>Escolha como o cardápio aparece na frente de caixa.</p></div>'+
    '<div style="flex:1"></div>'+
    '<button class="btnP2 ok" onclick="salvarCfgPDV()">'+sv('check',13)+' Salvar</button>'+
   '</div>'+
   '<div class="mdvBox">'+
    '<div class="mdvH"><b>Modos de venda</b>'+
     '<span>O que esta loja usa. O que estiver desligado some do PDV, do menu e '+
     'dos relatórios — em vez de ficar ali sem servir para nada.</span></div>'+
    '<div class="mdvGrade">'+MODOS.map(function(m){
      var travado=(m.id==='mesa'&&!recursoContratado('loja','mesas'));
      var on=modos()[m.id]!==false&&!!modos()[m.id];
      return '<label class="mdvOp'+(on?' on':'')+(travado?' trv':'')+'">'+
       '<input type="checkbox" class="mdvCk" data-m="'+E(m.id)+'"'+(on?' checked':'')+
       (travado?' disabled':'')+' onchange="salvarModos()">'+
       '<b>'+E(m.n)+'</b><span>'+(travado?'não faz parte do seu contrato':E(m.d))+'</span></label>';
    }).join('')+'</div>'+
   /* Ligar o modo Mesa faz aparecer telas em outros lugares do menu. Sem
      dizer isso aqui, a pessoa liga e nao sabe para onde ir. */
   (modoAtivo('mesa')
    ?'<div class="mdvIr">'+sv('nike',13)+'<div>Mesa ligada — o cadastro das mesas, '+
     'o QR Code e a taxa de serviço ficam em <b>Mesas e QR Code</b>.</div>'+
     '<button class="btnP2 ok" onclick="abrir(\'loja\',\'mesas\')">Ir para Mesas e QR Code</button></div>'
    :'<div class="hint" style="margin-top:9px">Ligando <b>Mesa</b>, aparecem no menu o cadastro '+
     'das mesas com QR Code, a aba Mesas no PDV e o relatório de vendas por mesa.</div>')+
   '</div>'+
   '<div class="cfgDuas">'+
    '<div class="cfgCol">'+
     '<div class="colH">Aparência do cardápio</div>'+
     '<div class="colB" style="padding:14px">'+
      '<div class="layGrade">'+LAYOUTS_PDV.map(function(l){
        return '<button class="layOp'+(c.layout===l.id?' on':'')+'" onclick="trocaLayout(\''+l.id+'\')">'+
        '<div class="layMini">'+miniLayout(l.id)+'</div>'+
        '<b>'+E(l.n)+'</b><span>'+E(l.d)+'</span></button>';
      }).join('')+'</div>'+
      '<div class="cfgSep">Ajustes</div>'+
      '<div class="row2">'+
       '<div class="fld2" style="margin:0"><label>Produtos por linha</label>'+
        '<select id="pvCols" onchange="c_prev()">'+
        [2,3,4,5,6].map(function(n){return '<option value="'+n+'"'+(c.colunas===n?' selected':'')+'>'+n+'</option>'}).join('')+
        '</select></div>'+
       '<div class="fld2" style="margin:0"><label>Fases do pedido</label>'+
        '<input id="pvFases" value="'+E((c.fases||[]).join(', '))+'" placeholder="aguardando, preparo, saiu, entregue"></div>'+
      '</div>'+
      '<div class="chkGrade">'+
       '<label class="chkL"><input type="checkbox" id="pvPreco" '+(c.mostraPreco?'checked':'')+' onchange="c_prev()">'+
        '<span><b>Mostrar preço</b><span>o valor aparece no cartão do produto</span></span></label>'+
       '<label class="chkL"><input type="checkbox" id="pvDesc" '+(c.mostraDesc?'checked':'')+' onchange="c_prev()">'+
        '<span><b>Mostrar descrição</b><span>uma linha com a descrição embaixo do nome</span></span></label>'+
       '<label class="chkL"><input type="checkbox" id="pvBotao" '+(c.botaoGrande?'checked':'')+' onchange="c_prev()">'+
        '<span><b>Botões grandes</b><span>alvo maior, melhor para tela sensível ao toque</span></span></label>'+
      '</div>'+
     '</div></div>'+
    '<div class="cfgCol previaCol">'+
     '<div class="colH">Como vai ficar'+
      '<button class="btnMini" onclick="c_prev()">'+sv('ref',12)+' atualizar</button></div>'+
     '<div class="colB" id="pdvPrevia">'+previaPDV(c)+'</div>'+
    '</div>'+
   '</div></div></div>';
  rodape('layout: '+(LAYOUTS_PDV.find(function(l){return l.id===c.layout})||{}).n);
}
function miniLayout(id){
  if(id==='lista')return '<div class="mL g1"><i class="l"></i><i class="l"></i><i class="l"></i><i class="l"></i></div>';
  if(id==='quadro')return '<div class="mL g2"><i class="q"></i><i class="q"></i><i class="q"></i><i class="q"></i></div>';
  return '<div class="mL g1"><i class="c"></i><i class="c"></i><i class="c"></i></div>';
}
function trocaLayout(id){
  var c=cfgPDV();c.layout=id;telaCfgPDV();
}
function c_prev(){
  var c=cfgPDV();
  c.colunas=parseInt(($('pvCols')||{}).value)||4;
  c.mostraPreco=($('pvPreco')||{}).checked;
  c.mostraDesc=($('pvDesc')||{}).checked;
  c.botaoGrande=($('pvBotao')||{}).checked;
  var el=$('pdvPrevia');
  if(el)el.innerHTML=previaPDV(c);
}
function previaPDV(c){
  var cats=(DB.categorias||[]).filter(function(x){return x.ativo!==false}).slice(0,4);
  if(!cats.length)cats=[{id:'d1',nome:'Cascões',cor:'#00A08B'},{id:'d2',nome:'Potes',cor:'#2C6FD1'}];
  var prods=(DB.produtos||[]).filter(function(p){return p.ativo!==false}).slice(0,8);
  if(!prods.length)prods=[
   {nome:'Cascão 1 bola',preco:12,desc:'uma bola do sabor que escolher'},
   {nome:'Cascão 2 bolas',preco:18,desc:'duas bolas, cascão crocante'},
   {nome:'Pote 500ml',preco:32,desc:'para levar para casa'},
   {nome:'Pote 1 litro',preco:58,desc:'rende bem para a família'},
   {nome:'Milkshake 400ml',preco:22,desc:''},
   {nome:'Água mineral',preco:5,desc:''}];
  var cls='pv-'+c.layout+(c.botaoGrande?' pv-grande':'');
  return '<div class="pvPrev">'+
   '<div class="pvCats">'+cats.map(function(x,k){
     return '<button class="pvCat'+(k===0?' on':'')+'" style="--cc:'+(x.cor||'#00A08B')+'">'+E(x.nome)+'</button>';
   }).join('')+'</div>'+
   '<div class="pvProds '+cls+'" style="--cols:'+c.colunas+'">'+
   prods.map(function(p,k){
     var cor=cats[k%cats.length].cor||'#00A08B';
     return '<div class="pvP">'+
      (c.layout==='quadro'?'<div class="pvFoto">'+sv('img',20)+'</div>':'')+
      (c.layout==='linha'?'<div class="pvFotoP">'+sv('img',14)+'</div>':'')+
      '<div class="pvInfo"><b>'+E(p.nome)+'</b>'+
       (c.mostraDesc&&p.desc?'<small>'+E(p.desc)+'</small>':'')+
       (c.mostraPreco?'<span class="pvPreco">R$ '+money(p.preco)+'</span>':'')+
      '</div></div>';
   }).join('')+'</div>'+
   '<div class="pvComanda"><div class="pvCH">Comanda</div>'+
    '<div class="pvCI"><span>2× Cascão 1 bola</span><b>R$ 24,00</b></div>'+
    '<div class="pvCI"><span>1× Pote 500ml</span><b>R$ 32,00</b></div>'+
    '<div class="pvCT"><span>Total</span><b>R$ 56,00</b></div></div>'+
   '</div>';
}
function salvarModos(){
  var md=modos();
  var cs=document.querySelectorAll('.mdvCk');
  var ligados=0;
  for(var i=0;i<cs.length;i++)if(cs[i].checked)ligados++;
  if(!ligados){
    toast('A loja precisa de pelo menos um modo de venda ligado.');
    telaCfgPDV();return;
  }
  for(var k=0;k<cs.length;k++)md[cs[k].getAttribute('data-m')]=cs[k].checked;
  salvar();
  telaCfgPDV();faixa();
  toast('Modos de venda salvos — o PDV e o menu já mudaram.');
  if(NUVEM.ligada)sincronizar();
}
function salvarCfgPDV(){
  var c=cfgPDV();
  c_prev();
  var f=($('pvFases')||{}).value||'';
  var lista=f.split(',').map(function(x){return x.trim().toLowerCase()}).filter(Boolean);
  if(lista.length)c.fases=lista;
  salvar();
  toast('Configuração salva — o PDV já está usando o layout '+
    ((LAYOUTS_PDV.find(function(l){return l.id===c.layout})||{}).n||'')+'.');
}

/* ==========================================================
   ÁREAS DE ENTREGA
   ========================================================== */
function baseAreas(){
  DB.areas=DB.areas||[];
  DB.areas.forEach(function(a){ a.zonas=a.zonas||[]; });
  return DB.areas;
}
var AE={aberta:{},busca:''};
function telaAreasEntrega(){
  baseMov();baseAreas();
  var q=(AE.busca||'').toLowerCase();
  var lista=DB.areas.filter(function(a){
    if(!q)return true;
    return (a.nome||'').toLowerCase().indexOf(q)>=0||
      (a.zonas||[]).some(function(z){return (z.nome||'').toLowerCase().indexOf(q)>=0});
  });
  var totZ=DB.areas.reduce(function(a,x){return a+(x.zonas||[]).length},0);
  $('content').innerHTML='<div class="etWrap"><div class="etScroll">'+
   '<div class="etTopo">'+
    '<div><h1>Áreas de Entrega</h1>'+
    '<p>Cidades, bairros e zonas rurais com a taxa de cada uma.</p></div>'+
    '<button class="infoBt" onclick="explicaAreas()">'+sv('help',15)+'</button>'+
    '<div style="flex:1"></div>'+
    '<button class="btnP2 ok" onclick="formCidade()">'+sv('plus',14)+' Cadastrar cidade</button>'+
   '</div>'+
   '<div class="barraF">'+
    '<div class="bfCampo cresce"><label>Buscar</label>'+
     '<input id="aeB" value="'+E(AE.busca)+'" placeholder="cidade, bairro ou zona"></div>'+
    '<div class="bfAtalhos">'+
     '<button onclick="expandirAreas(true)">Abrir todas</button>'+
     '<button onclick="expandirAreas(false)">Fechar todas</button></div>'+
   '</div>'+
   '<div class="relKpis">'+
    '<div class="rk dest"><span>Cidades</span><b>'+DB.areas.length+'</b></div>'+
    '<div class="rk"><span>Zonas cadastradas</span><b>'+totZ+'</b></div>'+
    '<div class="rk"><span>Taxa mínima</span><b>R$ '+money(taxaMinMax().min)+'</b></div>'+
    '<div class="rk"><span>Taxa máxima</span><b>R$ '+money(taxaMinMax().max)+'</b></div>'+
   '</div>'+
   '<div class="areasLista">'+
   (lista.length?lista.map(function(a){
     var ab=AE.aberta[a.id]!==false;
     var zs=a.zonas||[];
     return '<div class="areaCard">'+
      '<div class="areaH" onclick="AE.aberta[\''+a.id+'\']='+(ab?'false':'true')+';telaAreasEntrega()">'+
       '<span class="ftSeta'+(ab?' ab':'')+'">'+sv('tri',10)+'</span>'+
       sv('map',15)+
       '<div class="areaN"><b>'+E(a.nome)+'</b>'+
        '<small>'+(a.uf?E(a.uf)+' · ':'')+zs.length+' zona(s)'+
        (a.taxaPadrao?' · taxa padrão R$ '+money(a.taxaPadrao):'')+'</small></div>'+
       '<div class="areaAc" onclick="event.stopPropagation()">'+
        '<button class="rBtn" onclick="formZona(\''+a.id+'\')" title="Nova zona">'+sv('plus',12)+'</button>'+
        '<button class="rBtn" onclick="formCidade(\''+a.id+'\')" title="Editar cidade">'+sv('edit',12)+'</button>'+
        '<button class="rBtn rd" onclick="excluirCidade(\''+a.id+'\')" title="Excluir">'+sv('trash',12)+'</button>'+
       '</div></div>'+
      (ab?'<div class="areaB">'+
       (zs.length?'<table class="etTab zonaTab"><thead><tr>'+
        '<th>Zona / bairro</th><th style="width:120px">Tipo</th>'+
        '<th style="width:110px;text-align:right">Distância</th>'+
        '<th style="width:110px;text-align:right">Taxa</th>'+
        '<th style="width:110px;text-align:right">Tempo</th>'+
        '<th style="width:90px;text-align:center">Situação</th>'+
        '<th style="width:70px"></th></tr></thead><tbody>'+
        zs.map(function(z,k){
          return '<tr>'+
          '<td><b>'+E(z.nome)+'</b>'+(z.obs?'<small style="display:block;color:var(--ink-3)">'+E(z.obs)+'</small>':'')+'</td>'+
          '<td><span class="tipoZ '+(z.tipo||'bairro')+'">'+
           (z.tipo==='rural'?'Rural / sítio':z.tipo==='raio'?'Por raio':'Bairro')+'</span></td>'+
          '<td style="text-align:right">'+(z.km?fmtQt(z.km)+' km':'—')+'</td>'+
          '<td style="text-align:right"><b>R$ '+money(z.taxa)+'</b></td>'+
          '<td style="text-align:right">'+(z.tempo?z.tempo+' min':'—')+'</td>'+
          '<td style="text-align:center">'+(z.ativa!==false
            ?'<span class="badge2">Ativa</span>':'<span class="badge2 rd">Inativa</span>')+'</td>'+
          '<td><div class="rowAct">'+
           '<button class="rBtn" onclick="formZona(\''+a.id+'\','+k+')">'+sv('edit',11)+'</button>'+
           '<button class="rBtn rd" onclick="excluirZona(\''+a.id+'\','+k+')">'+sv('trash',11)+'</button>'+
          '</div></td></tr>';
        }).join('')+'</tbody></table>'
       :'<div class="zonaVazia">'+sv('map',20)+'<span>Nenhuma zona nesta cidade. '+
        'Use o botão <b>+</b> para cadastrar bairros, zonas rurais ou faixas por distância.</span>'+
        '<button class="btnP2 ok" onclick="formZona(\''+a.id+'\')">'+sv('plus',12)+' Cadastrar zona</button></div>')+
      '</div>':'')+
     '</div>';
   }).join('')
   :'<div class="mvVazio">'+sv('map',26)+'<b>Nenhuma cidade cadastrada</b>'+
    '<span>Cadastre as cidades onde você entrega para o PDV calcular a taxa sozinho.</span></div>')+
   '</div></div></div>';
  var b=$('aeB');
  if(b)b.oninput=function(){AE.busca=this.value;var p=this.selectionStart;telaAreasEntrega();
    var n=$('aeB');if(n){n.focus();n.setSelectionRange(p,p);}};
  rodape(DB.areas.length+' cidades · '+totZ+' zonas');
}
function taxaMinMax(){
  var t=[];
  (DB.areas||[]).forEach(function(a){(a.zonas||[]).forEach(function(z){
    if(z.ativa!==false)t.push(Number(z.taxa)||0);})});
  if(!t.length)return {min:0,max:0};
  return {min:Math.min.apply(null,t),max:Math.max.apply(null,t)};
}
function expandirAreas(v){
  (DB.areas||[]).forEach(function(a){AE.aberta[a.id]=v});
  telaAreasEntrega();
}
function formCidade(id){
  baseAreas();
  var a=id?DB.areas.find(function(x){return x.id===id}):null;
  modal(a?'Editar cidade':'Cadastrar cidade',
  '<div class="mdB"><div class="row2">'+
   '<div class="fld2"><label>Cidade *</label><input id="acNome" value="'+E(a?a.nome:'')+'" placeholder="Santa Fé do Sul"></div>'+
   '<div class="fld2"><label>UF</label><input id="acUf" maxlength="2" value="'+E(a?a.uf:'')+'"></div>'+
  '</div><div class="row2">'+
   '<div class="fld2"><label>Taxa padrão</label><input id="acTaxa" type="number" step="0.01" value="'+(a?(a.taxaPadrao||0):0)+'">'+
    '<div class="hint">usada quando o endereço não cair em nenhuma zona</div></div>'+
   '<div class="fld2"><label>Tempo estimado (min)</label><input id="acTempo" type="number" value="'+(a?(a.tempo||0):0)+'"></div>'+
  '</div></div>','Salvar',function(){
    var nome=$('acNome').value.trim();
    if(!nome){toast('Informe a cidade.');return false;}
    var o={nome:nome,uf:$('acUf').value.trim().toUpperCase(),
      taxaPadrao:parseFloat($('acTaxa').value)||0,tempo:parseInt($('acTempo').value)||0};
    if(a)Object.assign(a,o);
    else {var novo=Object.assign({id:uid('ar'),zonas:[]},o);DB.areas.push(novo);AE.aberta[novo.id]=true;}
    salvar();telaAreasEntrega();
    toast('Cidade salva.');
    return true;
  });
}
function formZona(cid,k){
  baseAreas();
  var a=DB.areas.find(function(x){return x.id===cid});
  if(!a)return;
  var z=(k!==undefined)?a.zonas[k]:null;
  modal(z?'Editar zona':'Nova zona em '+a.nome,
  '<div class="mdB"><div class="row2">'+
   '<div class="fld2"><label>Nome da zona *</label><input id="azNome" value="'+E(z?z.nome:'')+'" placeholder="Centro, Jardim América, Sítio do Braz..."></div>'+
   '<div class="fld2"><label>Tipo</label><select id="azTipo">'+
    '<option value="bairro"'+(!z||z.tipo==='bairro'?' selected':'')+'>Bairro</option>'+
    '<option value="rural"'+(z&&z.tipo==='rural'?' selected':'')+'>Zona rural / sítio / rancho</option>'+
    '<option value="raio"'+(z&&z.tipo==='raio'?' selected':'')+'>Faixa por distância</option>'+
   '</select></div>'+
  '</div><div class="row3">'+
   '<div class="fld2" style="margin:0"><label>Taxa de entrega *</label>'+
    '<input id="azTaxa" type="number" step="0.01" value="'+(z?z.taxa:(a.taxaPadrao||0))+'"></div>'+
   '<div class="fld2" style="margin:0"><label>Distância (km)</label>'+
    '<input id="azKm" type="number" step="0.1" value="'+(z?(z.km||''):'')+'" placeholder="opcional"></div>'+
   '<div class="fld2" style="margin:0"><label>Tempo (min)</label>'+
    '<input id="azTempo" type="number" value="'+(z?(z.tempo||''):(a.tempo||''))+'"></div>'+
  '</div>'+
  '<div class="fld2"><label>Referência / observação</label>'+
   '<input id="azObs" value="'+E(z?(z.obs||''):'')+'" placeholder="depois do trevo, estrada do porto..."></div>'+
  '<label class="chkL"><input type="checkbox" id="azAtiva" '+(!z||z.ativa!==false?'checked':'')+'>'+
   '<span>Zona ativa — aparece no PDV e no cardápio digital</span></label>'+
  '</div>','Salvar',function(){
    var nome=$('azNome').value.trim();
    if(!nome){toast('Informe o nome da zona.');return false;}
    var o={nome:nome,tipo:$('azTipo').value,taxa:parseFloat($('azTaxa').value)||0,
      km:parseFloat($('azKm').value)||0,tempo:parseInt($('azTempo').value)||0,
      obs:$('azObs').value.trim(),ativa:$('azAtiva').checked};
    if(z)Object.assign(z,o); else a.zonas.push(Object.assign({id:uid('zn')},o));
    salvar();telaAreasEntrega();
    toast('Zona salva.');
    return true;
  },'lg');
}
async function excluirCidade(id){
  var a=DB.areas.find(function(x){return x.id===id});
  var ok=await confirmar({titulo:'Excluir '+(a?a.nome:''),
    texto:(a&&a.zonas.length?a.zonas.length+' zona(s) serão removidas junto.':''),
    ok:'Excluir',tipo:'perigo'});
  if(!ok)return;
  DB.areas=DB.areas.filter(function(x){return x.id!==id});
  salvar();telaAreasEntrega();
}
async function excluirZona(cid,k){
  var a=DB.areas.find(function(x){return x.id===cid});
  if(!a)return;
  var ok=await confirmar({titulo:'Excluir a zona '+a.zonas[k].nome,ok:'Excluir',tipo:'perigo'});
  if(!ok)return;
  a.zonas.splice(k,1);salvar();telaAreasEntrega();
}
function explicaAreas(){
  explicaRel('Áreas de Entrega — como funciona',[
   ['Cidade','agrupa as zonas. A taxa padrão vale quando o endereço não cair em nenhuma zona'],
   ['Bairro','a divisão comum dentro da cidade'],
   ['Zona rural','para sítios, ranchos e estradas — use a referência para orientar o entregador'],
   ['Faixa por distância','cobra pela distância: até 3 km um valor, de 3 a 6 km outro'],
   ['Taxa','o valor cobrado do cliente — aparece no PDV ao escolher a cidade'],
   ['Onde isso aparece','no PDV ao lançar uma entrega, no cardápio digital, no relatório de '+
    'Vendas por Área de Entrega e no acerto do entregador']
  ],'as zonas cadastradas aqui. Ao lançar uma entrega, o PDV busca a zona do cliente e traz a taxa.',
   'zonas marcadas como inativas, que somem do PDV e do cardápio mas continuam no histórico.');
}
/* usada pelo PDV e pelos relatórios */
function cidadesEntrega(){
  baseAreas();
  var l=[];
  (DB.areas||[]).forEach(function(a){
    l.push({cidade:a.nome,valor:Number(a.taxaPadrao)||0,zona:'',areaId:a.id});
    (a.zonas||[]).forEach(function(z){
      if(z.ativa===false)return;
      l.push({cidade:a.nome,valor:Number(z.taxa)||0,zona:z.nome,areaId:a.id,zonaId:z.id,tipo:z.tipo});
    });
  });
  return l;
}
function nomesCidadesEntrega(){
  baseAreas();
  return (DB.areas||[]).map(function(a){return a.nome}).sort();
}

/* ==========================================================
   CONFIGURAÇÃO DE MOTIVOS DE MOVIMENTAÇÃO
   ========================================================== */
function telaCfgMovimentacao(){
  baseMov();
  var por={entrada:[],saida:[],producao:[]};
  (DB.motivosMov||[]).forEach(function(m){ (por[m.tipo]||por.saida).push(m); });
  var TIPOS=[
   {id:'saida',   n:'Saída',    ic:'dn4',  cor:'#C94141', seu:true,
    d:'os motivos da baixa manual — estes são os seus'},
   {id:'entrada', n:'Entrada',  ic:'up2',  cor:'#0E8A46',
    d:'o sistema usa sozinho na nota de entrada e na contagem'},
   {id:'producao',n:'Produzir', ic:'box',  cor:'#00A08B',
    d:'o sistema usa sozinho na ordem de produção'}
  ];
  $('content').innerHTML='<div class="etWrap"><div class="etScroll">'+
   '<div class="etTopo">'+
    '<div><h1>Motivos de Baixa de Estoque</h1>'+
    '<p>Aqui é onde você cadastra os motivos da <b>baixa manual</b> — perda, quebra, vencimento, '+
    'consumo interno, degustação. O que você cadastrar na coluna <b>Saída</b> aparece na hora '+
    'em Estoque › Movimentação de Estoque, sem precisar salvar nada além disto.</p></div>'+
    '<button class="infoBt" onclick="explicaMotivos()">'+sv('help',15)+'</button>'+
    '<div style="flex:1"></div>'+
    '<button class="btnP2 ok" onclick="formMotivo()">'+sv('plus',14)+' Cadastrar motivo</button>'+
   '</div>'+
   '<div class="motGrade">'+
   TIPOS.map(function(t){
     var l=por[t.id]||[];
     return '<div class="motCol" style="--mc:'+t.cor+'">'+
      '<div class="motH">'+sv(t.ic,15)+'<div><b>'+t.n+(t.seu?' — baixa manual':'')+'</b>'+
      '<span>'+t.d+'</span></div>'+
      '<span class="cnt2">'+l.length+'</span></div>'+
      '<div class="motB">'+
      (l.length?l.map(function(m){
        var usos=(DB.movEst||[]).filter(function(x){return x.motivoId===m.id}).length;
        return '<div class="motIt'+(m.ativo===false?' off':'')+'">'+
         '<div class="motN"><b>'+E(m.nome)+'</b>'+
          '<small>'+(m.sistema?'do sistema · ':'')+usos+' lançamento(s)</small></div>'+
         '<div class="motAc">'+
          (m.sistema?'<span class="lockIc" title="motivo do sistema">'+sv('lock',12)+'</span>'
           :'<button class="rBtn" onclick="formMotivo(\''+m.id+'\')">'+sv('edit',11)+'</button>'+
            '<button class="rBtn rd" onclick="excluirMotivo(\''+m.id+'\')">'+sv('trash',11)+'</button>')+
          '<label class="miniSw"><input type="checkbox" '+(m.ativo!==false?'checked':'')+
           ' onchange="togMotivo(\''+m.id+'\')"><i></i></label>'+
         '</div></div>';
      }).join('')
      :'<div class="motVazio">nenhum motivo deste tipo</div>')+
      /* o botão de incluir fica só no + do topo: um lugar para a ação, não quatro */
      '</div></div>';
   }).join('')+
   '</div></div></div>';
  rodape((DB.motivosMov||[]).length+' motivos cadastrados');
}
function formMotivo(id,tipoPadrao){
  baseMov();
  var m=id?DB.motivosMov.find(function(x){return x.id===id}):null;
  modal(m?'Editar motivo':'Cadastrar motivo',
  '<div class="mdB">'+
   '<div class="fld2"><label>Nome do motivo *</label>'+
    '<input id="mvNome" value="'+E(m?m.nome:'')+'" placeholder="Perda por quebra, Produzir gelato..."></div>'+
   '<div class="fld2"><label>O que este motivo faz *</label>'+
    '<div class="tipoEsc">'+
    [['entrada','Entrada','soma a quantidade no estoque'],
     ['saida','Saída','subtrai a quantidade do estoque'],
     ['producao','Produzir','baixa os ingredientes da ficha e gera o produto acabado']]
     .map(function(t){
      var sel=(m?m.tipo:(tipoPadrao||'saida'))===t[0];
      return '<label class="tipoOp'+(sel?' on':'')+'">'+
       '<input type="radio" name="mvTipo" value="'+t[0]+'"'+(sel?' checked':'')+'>'+
       '<b>'+t[1]+'</b><span>'+t[2]+'</span></label>';
     }).join('')+'</div></div>'+
   '<label class="chkL"><input type="checkbox" id="mvAtivo" '+(!m||m.ativo!==false?'checked':'')+'>'+
    '<span>Motivo ativo — aparece na lista ao lançar movimentação</span></label>'+
  '</div>','Salvar',function(){
    var nome=$('mvNome').value.trim();
    if(!nome){toast('Informe o nome do motivo.');return false;}
    var tipo='saida';
    var rs=document.querySelectorAll('input[name="mvTipo"]');
    for(var i=0;i<rs.length;i++)if(rs[i].checked)tipo=rs[i].value;
    var o={nome:nome,tipo:tipo,ativo:$('mvAtivo').checked};
    if(m)Object.assign(m,o);
    else DB.motivosMov.push(Object.assign({id:uid('mt'),sistema:false,lojas:[]},o));
    salvar();telaCfgMovimentacao();
    toast('Motivo salvo.');
    return true;
  },'lg');
}
function togMotivo(id){
  var m=DB.motivosMov.find(function(x){return x.id===id});
  if(!m)return;
  m.ativo=(m.ativo===false);
  salvar();telaCfgMovimentacao();
}
async function excluirMotivo(id){
  var m=DB.motivosMov.find(function(x){return x.id===id});
  var usos=(DB.movEst||[]).filter(function(x){return x.motivoId===id}).length;
  if(usos){
    await confirmar({titulo:'Não dá para excluir',
      texto:'"'+(m?m.nome:'')+'" já foi usado em '+usos+' lançamento(s).',
      aviso:'Você pode <b>desativar</b> o motivo na chavinha ao lado — ele some da lista de '+
        'lançamento mas o histórico continua correto.',
      ok:'Entendi',cancelar:null,tipo:'info'});
    return;
  }
  var ok=await confirmar({titulo:'Excluir o motivo '+(m?m.nome:''),ok:'Excluir',tipo:'perigo'});
  if(!ok)return;
  DB.motivosMov=DB.motivosMov.filter(function(x){return x.id!==id});
  salvar();telaCfgMovimentacao();
}
function explicaMotivos(){
  explicaRel('Motivos de Movimentação — como funciona',[
   ['Entrada','soma a quantidade no estoque. Ex.: devolução de cliente, ajuste para mais'],
   ['Saída','subtrai do estoque. Ex.: perda, quebra, uso interno, degustação'],
   ['Produzir','o único que transforma: baixa os ingredientes da ficha técnica e gera o produto acabado'],
   ['Motivo do sistema','criado automaticamente e usado por venda, nota de entrada e contagem — não pode ser excluído'],
   ['Desativar','o motivo some da lista de lançamento, mas o histórico dele continua intacto']
  ],'os motivos cadastrados aqui aparecem ao lançar movimentação de estoque, na produção '+
    'e no filtro do relatório de Itens Consumidos.',
   'nada — todos os motivos cadastrados aparecem. Os inativos só somem da hora de lançar.');
}


var AFAZER={
 'relatorios/cupons':['Relatório de Cupons',
   'Cupons usados no período, quanto de desconto cada um gerou e quantos clientes novos trouxe.'],
 'loja/dados-fiscais':['Dados Fiscais',
   'Regime tributário, CNPJ, certificado e a integração com o emissor de nota.'],

};
/* ==========================================================
   BUSCA E ORDENAÇÃO EM TODA TABELA
   Em vez de mexer em cada uma das dezenas de telas, o sistema
   olha o que está desenhado e liga busca e ordenação sozinho.
   Toda tela nova nasce com isso funcionando.
   Quem já tem busca/ordenação própria (Estoque Total, por exemplo)
   é reconhecido e não recebe outra por cima.
   ========================================================== */
function numDaCelula(v){
  var t=String(v||'').replace(/[^\d,.\-]/g,'');
  if(!t||t==='-')return null;
  t=t.replace(/\.(?=\d{3}(\D|$))/g,'').replace(',','.');
  var n=parseFloat(t);
  return isNaN(n)?null:n;
}
function ordenarTabela(t,i,th){
  var tb=t.tBodies[0];if(!tb||!tb.rows.length)return;
  var linhas=Array.prototype.slice.call(tb.rows);
  /* linha com célula juntada (subtotal, separador) quebraria a ordem */
  for(var z=0;z<linhas.length;z++){
    if(linhas[z].cells.length<=i)return;
    if(linhas[z].cells[i].colSpan>1)return;
  }
  var vals=linhas.map(function(tr){return (tr.cells[i].textContent||'').trim()});
  var nums=vals.map(numDaCelula);
  var ehNum=nums.filter(function(x){return x!==null}).length>=Math.max(1,Math.floor(vals.length*0.7));
  var dir=th.getAttribute('data-dir');
  if(!dir)dir=ehNum?'desc':'asc';              /* número começa do maior; texto, de A a Z */
  else dir=(dir==='asc'?'desc':'asc');
  var cab=t.querySelectorAll('thead th');
  for(var c=0;c<cab.length;c++){cab[c].removeAttribute('data-dir');cab[c].classList.remove('bsOn');}
  th.setAttribute('data-dir',dir);th.classList.add('bsOn');
  var mul=(dir==='asc'?1:-1);
  linhas.forEach(function(tr,k){tr._k=k});
  linhas.sort(function(a,b){
    var r;
    if(ehNum){
      var na=nums[a._k],nb=nums[b._k];
      if(na===null&&nb===null)r=0; else if(na===null)r=1; else if(nb===null)r=-1;
      else r=na-nb;
    }else r=vals[a._k].localeCompare(vals[b._k],'pt',{numeric:true,sensitivity:'base'});
    return r?r*mul:(a._k-b._k);               /* empate mantém a ordem original */
  });
  linhas.forEach(function(tr){tb.appendChild(tr)});
}
function ligarBuscaTabela(t){
  var cx=document.createElement('div');
  cx.className='bsBox';
  cx.innerHTML='<input type="text" placeholder="Buscar por nome — digite 3 letras" autocomplete="off">'+
    '<span class="bsCont"></span>';
  t.parentNode.insertBefore(cx,t);
  var inp=cx.querySelector('input'),ct=cx.querySelector('.bsCont');
  inp.addEventListener('input',function(){
    var q=this.value.trim().toLowerCase();
    var tb=t.tBodies[0];if(!tb)return;
    var vis=0,rs=tb.rows;
    for(var r=0;r<rs.length;r++){
      var passa=(q.length<3)||((rs[r].textContent||'').toLowerCase().indexOf(q)>=0);
      rs[r].style.display=passa?'':'none';
      if(passa)vis++;
    }
    ct.textContent=(q.length<3)?'':(vis+' de '+rs.length);
    cx.classList.toggle('ativo',q.length>=3);
  });
}
function ativarTabelas(){
  var cont=document.getElementById('content');if(!cont)return;
  var tabs=cont.getElementsByTagName('table');
  for(var i=0;i<tabs.length;i++){
    var t=tabs[i];
    if(t.getAttribute('data-bs'))continue;
    if(t.className.indexOf('semBusca')>=0){t.setAttribute('data-bs','x');continue;}
    var cab=t.querySelectorAll('thead th');
    var tb=t.tBodies[0];
    if(!cab.length||!tb||tb.rows.length<2)continue;
    t.setAttribute('data-bs','1');
    for(var c=0;c<cab.length;c++){
      var th=cab[c];
      /* já tem ordenação própria nesta coluna: não mexe */
      if(th.getAttribute('onclick')||th.className.indexOf('ordCol')>=0)continue;
      if(!(th.textContent||'').trim())continue;
      th.classList.add('bsOrd');
      th.title='Ordenar por '+(th.textContent||'').trim();
      (function(tt,idx,cel){
        cel.addEventListener('click',function(){ordenarTabela(tt,idx,cel)});
      })(t,c,th);
    }
    /* ==========================================================
       DUAS BUSCAS NA MESMA TELA NAO
       Esta busca automatica entra em qualquer tabela com 6 linhas ou mais.
       Util onde a tela nao tem filtro proprio — mas em Ingredientes e
       Insumos ela aparecia logo abaixo do campo "Buscar" do filtro, duas
       caixas fazendo a mesma coisa, uma empurrando a lista para baixo.
       Agora ela so entra quando a tela NAO tem campo de busca proprio na
       faixa de filtros. Campo de data e seletor nao contam: eles filtram,
       mas nao procuram por nome.
       ========================================================== */
    var jaTem=t.previousElementSibling&&
      (t.previousElementSibling.className||'').indexOf('bsBox')>=0;
    var casca=(t.closest&&t.closest('.mvWrap,.finWrap'))||document.getElementById('content');
    var buscaPropria=casca&&casca.querySelector(
      '.filtroCard input[type="text"],.filtroCard input:not([type]),'+
      '.mvFiltros input[type="text"],.mvFiltros input:not([type])');
    if(tb.rows.length>=6&&!jaTem&&!buscaPropria)ligarBuscaTabela(t);
  }
}
(function(){
  function liga(){
    var cont=document.getElementById('content');
    if(!cont){setTimeout(liga,400);return;}
    var esp=null;
    new MutationObserver(function(){
      clearTimeout(esp);esp=setTimeout(ativarTabelas,90);
    }).observe(cont,{childList:true,subtree:true});
    ativarTabelas();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',liga);
  else liga();
  /* uma vez por aparelho: alivia a memoria das fotos gravadas antes da V96 */
  setTimeout(function(){
    try{ if(typeof encolherFotos==='function')encolherFotos(false); }
    catch(e){ _quieto(e,'encolherFotos'); }
  },9000);
})();

/* ==========================================================
   O QUE JÁ ESTÁ PRONTO E O QUE FALTA
   ========================================================== */
/* Uma tela está pronta quando o roteador sabe abri-la. Perguntar direto ao roteador
   é a única forma do mapa não mentir: lista escrita à mão envelhece, como aconteceu
   com Usuários e Permissões e com Canais de Integração. */
var _rotasProntas=null;
function telaPronta(mid,iid){
  if(_rotasProntas===null){
    _rotasProntas={};
    try{
      var src=String(abrir),re2=/iid===['"]([a-z0-9-]+)['"]/g,m2;
      while((m2=re2.exec(src)))_rotasProntas[m2[1]]=true;
    }catch(e){_quieto(e,'telaPronta')}
  }
  if(_rotasProntas[iid])return true;
  return !AFAZER[mid+'/'+iid];
}
function telaMapaModulos(){
  var pronto=0,falta=0;
  var cols=MOD.map(function(m){
    var its=m.it.map(function(t){
      var f=!telaPronta(m.id,t.id);
      if(f)falta++;else pronto++;
      return {n:t.n,f:f,d:(AFAZER[m.id+'/'+t.id]||[])[1]||''};
    });
    /* os prontos primeiro; os que faltam vêm depois, no fim da lista */
    its.sort(function(a,b){return (a.f?1:0)-(b.f?1:0)});
    var qf=its.filter(function(x){return x.f}).length;
    return '<div class="mmCol">'+
      '<div class="mmH">'+svMod(m.id,m.ic,15)+'<b>'+E(m.n)+'</b>'+
       (qf?'<span class="mmPend">'+qf+'</span>':'<span class="mmOk">'+sv('check',11)+'</span>')+
      '</div>'+
      its.map(function(x){
        return '<div class="mmIt'+(x.f?' falta':'')+'" title="'+E(x.f?x.d:'pronto')+'">'+
          '<i></i><span>'+E(x.n)+'</span>'+
          (x.f?'<em>a construir</em>':'')+'</div>';
      }).join('')+
    '</div>';
  }).join('');
  var tot=pronto+falta;
  $('content').innerHTML=
   '<div class="topo"><div><h1>Mapa do Sistema</h1>'+
   '<p>O que já está construído e o que ainda falta. A bolinha vermelha marca '+
   'os módulos que estão no menu porque fazem parte do plano, mas ainda não foram feitos.</p></div></div>'+
   '<div class="mmResumo">'+
    '<div class="erBox dest"><span>Prontos</span><b>'+pronto+'</b>'+
     '<small>de '+tot+' telas do plano</small></div>'+
    '<div class="erBox"><span>A construir</span><b>'+falta+'</b>'+
     '<small><i class="mmDot"></i> marcados em vermelho</small></div>'+
    '<div class="erBox"><span>Concluído</span><b>'+
     String((pronto/tot*100).toFixed(0))+'%</b><small>do plano do sistema</small></div>'+
   '</div>'+
   '<div class="mmGrid">'+cols+'</div>';
  rodape(pronto+' de '+tot+' telas prontas');
}
function telaConstrucao(mid,iid){
  var k=mid+'/'+iid;
  var x=AFAZER[k];
  var nome=x?x[0]:'Este módulo';
  var desc=x?x[1]:'';
  $('content').innerHTML='<div class="construWrap">'+
   '<div class="construBox">'+
    '<div class="construIc">'+sv('gear2',30)+'</div>'+
    '<b>'+E(nome)+'</b>'+
    (desc?'<p>'+E(desc)+'</p>':'')+
    '<span class="construTag">ainda não construído</span>'+
    '<div class="construNota">Este item está no menu porque faz parte do plano do sistema, '+
     'mas ainda não foi desenvolvido. O que já funciona está nos outros itens.</div>'+
   '</div></div>';
  rodape(nome+' — a construir');
}

/* ==========================================================
   CANAIS DE VENDA E INTEGRAÇÃO
   ========================================================== */
function baseCanais(){
  DB.canais=DB.canais||{};
  var c=DB.canais;
  if(!c.cfg)c.cfg={};
  CANAIS_LISTA.forEach(function(k){
    if(!c.cfg[k.id])c.cfg[k.id]={ativo:(k.id==='appgestao'||k.id==='cardapio')};
  });
  if(!c.pixels)c.pixels={fbPixel:'',fbToken:'',ga4:'',gtm:'',tiktok:'',googleAds:''};
  return c;
}
var CANAIS_LISTA=[
 {id:'cardapio', n:'Cardápio Digital', g:'proprio', ic:'book',
  d:'sua página de pedidos, com link próprio', pronto:true,
  det:'O cliente escolhe a loja, monta o pedido e ele cai direto no seu PDV.'},
 {id:'whatsapp', n:'WhatsApp',         g:'proprio', ic:'chat',
  d:'robô que atende e avisa cada etapa do pedido', pronto:true,
  det:'Conecte o número da loja lendo um QR code. O robô responde os clientes e avisa quando o pedido sai para entrega.'},
 {id:'appgestao',n:'Aplicativo Joia', g:'proprio', ic:'chart',
  d:'painel no celular para você e os franqueados', pronto:true,
  det:'Cada pessoa entra com o próprio login e vê apenas a loja dela: faturamento, pedidos, ticket médio e mais vendidos.'},
 {id:'totem',    n:'Totem de Autoatendimento', g:'proprio', ic:'store',
  d:'a pessoa faz o próprio pedido na tela', pronto:true,
  det:'Uma tela em pé na loja. O cliente monta o pedido sozinho e recebe uma senha. '+
   'Mesmos produtos, mesmo estoque e mesmo PDV — muda só a porta de entrada.',
  tela:['loja','totem']},
 {id:'balcao',   n:'Frente de Caixa',  g:'proprio', ic:'store',
  d:'vendas no salão e balcão', pronto:true, fixo:true,
  det:'Sempre ativo — é o PDV que você já usa.'},
 {id:'ifood',    n:'iFood',            g:'market', ic:'moto',
  d:'pedidos do iFood caindo no PDV', pronto:false,
  det:'Exige cadastro como parceiro de tecnologia e homologação junto ao iFood.'},
 {id:'rappi',    n:'Rappi',            g:'market', ic:'moto',
  d:'integração com o Rappi', pronto:false, det:'Exige contrato e homologação.'},
 {id:'99food',   n:'99Food',           g:'market', ic:'moto',
  d:'integração com o 99Food', pronto:false, det:'Exige contrato e homologação.'},
 {id:'instagram',n:'Instagram',        g:'social', ic:'img',
  d:'link do cardápio na bio', pronto:true, semInt:true,
  det:'Sem integração automática — use o link do cardápio digital na bio.'},
 {id:'facebook', n:'Facebook',         g:'social', ic:'users',
  d:'link e pixel de conversão', pronto:true, semInt:true,
  det:'Use o link do cardápio e configure o Pixel na aba API de Dados.'}
];
var CN2={aba:'canais',busca:'',filtro:'todos'};

function telaCanaisIntegracao(){
  baseMov();baseSuc();
  var c=baseCanais();
  $('content').innerHTML='<div class="etWrap"><div class="etScroll">'+
   '<div class="etTopo">'+
    '<div><h1>Canais de Venda e Integração</h1>'+
    '<p>Por onde os pedidos entram e como medir os resultados.</p></div>'+
    '<div style="flex:1"></div>'+
   '</div>'+
   '<div class="abasCN">'+
    [['canais','Canais de venda','store'],
     ['cardapio','Cardápio Digital','book'],
     ['whatsapp','Robô do WhatsApp','chat'],
     ['app','Aplicativo Joia','chart'],
     ['dados','API de dados','chart'],
     ['tef','Integração TEF','cash']].map(function(a){
      return '<button class="abaCN'+(CN2.aba===a[0]?' on':'')+'" onclick="CN2.aba=\''+a[0]+'\';telaCanaisIntegracao()">'+
      sv(a[2],14)+' '+a[1]+'</button>';}).join('')+
   '</div>'+
   (CN2.aba==='canais'?blocoCanais(c):
    CN2.aba==='dados'?blocoDados(c):
    CN2.aba==='tef'?blocoTEF(c):
    CN2.aba==='app'?blocoApp():'<div id="subCfg"></div>')+
   '</div></div>';
  if(CN2.aba==='cardapio'){telaCfgCardapio(true);return;}
  if(CN2.aba==='whatsapp'){telaZap(true);return;}
  ligarCN();
  if(CN2.aba==='canais'&&ESTADO_REAL.whatsapp===undefined)conferirCanais();
  rodape();
}
var ESTADO_REAL={};
async function conferirCanais(){
  /* WhatsApp: pergunta ao robô se há sessão conectada */
  try{
    var d=await zapApi('/diagnostico');
    var s=(d.sessoes||[]).find(function(x){return x.estado==='conectado'});
    ESTADO_REAL.whatsapp=!!s;
    ESTADO_REAL.whatsappNum=s?s.numero:'';
  }catch(e){ ESTADO_REAL.whatsapp=false; }
  /* cardápio: está ativo se alguma loja publicou */
  baseCard();
  ESTADO_REAL.cardapio=Object.keys(DB.cardapio||{}).some(function(k){
    return (DB.cardapio[k]||{}).ativo!==false;});
  /* aplicativo: alguém com acesso publicado */
  baseUsr();
  ESTADO_REAL.appgestao=(DB.usuarios||[]).some(function(u){return u.publicadoEm});
  if(CN2.aba==='canais')telaCanaisIntegracao();
}
function blocoCanais(c){
  var q=(CN2.busca||'').toLowerCase();
  var lista=CANAIS_LISTA.filter(function(k){
    if(q&&k.n.toLowerCase().indexOf(q)<0)return false;
    if(CN2.filtro==='ativos')return c.cfg[k.id].ativo||k.fixo;
    if(CN2.filtro==='inativos')return !(c.cfg[k.id].ativo||k.fixo);
    return true;
  });
  var grupos=[['proprio','Seus canais'],['market','Marketplaces'],['social','Redes sociais']];
  return '<div class="barraF">'+
   '<div class="bfCampo cresce"><label>Buscar</label>'+
    '<input id="cnB" value="'+E(CN2.busca)+'" placeholder="nome do canal"></div>'+
   '<div class="bfAtalhos">'+
    [['todos','Todos'],['ativos','Ativos'],['inativos','Inativos']].map(function(f){
      return '<button class="'+(CN2.filtro===f[0]?'on2':'')+'" onclick="CN2.filtro=\''+f[0]+'\';telaCanaisIntegracao()">'+
      f[1]+'</button>';}).join('')+
   '</div></div>'+
   grupos.map(function(g){
     var l=lista.filter(function(k){return k.g===g[0]});
     if(!l.length)return '';
     return '<div class="cnGrupo"><div class="cnGT">'+g[1]+'</div>'+
      '<div class="cnGrade">'+l.map(function(k){
        var st=c.cfg[k.id]||{};
        /* canais com estado próprio mostram a verdade, não a chavinha */
        var auto=(ESTADO_REAL[k.id]!==undefined);
        var on=auto?ESTADO_REAL[k.id]:(st.ativo||k.fixo);
        return '<div class="cnCard'+(on?' on':'')+(k.pronto?'':' futuro')+'">'+
         '<div class="cnTopo">'+
          '<div class="cnIc">'+sv(k.ic,18)+'</div>'+
          '<div class="cnN"><b>'+E(k.n)+'</b><span>'+E(k.d)+'</span></div>'+
          (k.fixo
            ?'<span class="badge2">sempre ativo</span>'
            :auto
            ?'<span class="badge2'+(on?'':' am')+'">'+
             (on?sv('check',10)+' conectado':'desconectado')+'</span>'
            :'<label class="miniSw" title="'+(k.pronto?'ativar canal':'ainda não disponível')+'">'+
             '<input type="checkbox"'+(st.ativo?' checked':'')+(k.pronto?'':' disabled')+
             ' onchange="togCanal(\''+k.id+'\')"><i></i></label>')+
         '</div>'+
         '<div class="cnDet">'+
          (k.id==='whatsapp'&&ESTADO_REAL.whatsapp&&ESTADO_REAL.whatsappNum
            ?'Conectado no número <b>'+E(ESTADO_REAL.whatsappNum)+'</b>. '
            :'')+E(k.det)+'</div>'+
         '<div class="cnRod">'+
          (k.pronto
            ?(k.semInt?'<span class="cnTag cinza">sem integração</span>'
               :'<span class="cnTag verde">'+sv('check',10)+' com integração</span>')
            :'<span class="cnTag amarelo">a construir</span>')+
          (k.id==='appgestao'
            ?'<button class="btnP2" onclick="CN2.aba=\'app\';telaCanaisIntegracao()">'+
             sv('gear2',12)+' Configurar</button>'
            :k.id==='cardapio'
            ?'<button class="btnP2" onclick="CN2.aba=\'cardapio\';telaCanaisIntegracao()">'+
             sv('gear2',12)+' Configurar</button>'
            :k.id==='whatsapp'
            ?'<button class="btnP2" onclick="CN2.aba=\'whatsapp\';telaCanaisIntegracao()">'+
             sv('gear2',12)+' Configurar</button>'
            :k.tela
            /* canal com tela propria vai direto para ela. Antes caia no
               cfgCanal, que so mostra a explicacao — o botao "Configurar"
               abria um aviso e nao configurava nada. */
            ?'<button class="btnP2" onclick="abrir(\''+k.tela[0]+'\',\''+k.tela[1]+'\')">'+
             sv('gear2',12)+' Configurar</button>'
            :k.pronto&&!k.semInt&&!k.fixo
              ?'<button class="btnP2" onclick="cfgCanal(\''+k.id+'\')">'+sv('gear2',12)+' Configurar</button>':'')+
         '</div></div>';
      }).join('')+'</div></div>';
   }).join('');
}
function blocoDados(c){
  var p=c.pixels;
  return '<div class="cfgFaixa" style="border-bottom:none;background:transparent;padding-top:16px">'+
   '<div class="cnAviso">'+sv('help',15)+
   '<div><b>Para que serve</b> — estes códigos ficam no seu cardápio digital e permitem que '+
   'a agência de tráfego meça quantas pessoas visitaram, quantas fizeram pedido e quanto '+
   'cada anúncio rendeu. Sem eles, não dá para saber se o anúncio deu retorno.</div></div>'+
  '</div>'+
  '<div class="cfgDuas" style="padding-top:0">'+
   '<div class="cfgCol">'+
    '<div class="colH">Códigos de acompanhamento</div>'+
    '<div class="colB" style="padding:16px">'+
     campoPixel('Pixel do Facebook / Meta','fbPixel',p.fbPixel,
       'só os números, ex.: 1234567890123456','encontre em Gerenciador de Eventos › Fontes de dados')+
     campoPixel('Token da API de Conversões','fbToken',p.fbToken,
       'token gerado no Gerenciador de Eventos','envia as conversões pelo servidor, mais preciso que o pixel sozinho')+
     campoPixel('Google Analytics 4','ga4',p.ga4,
       'ex.: G-XXXXXXXXXX','em Administrador › Fluxos de dados')+
     campoPixel('Google Tag Manager','gtm',p.gtm,
       'ex.: GTM-XXXXXXX','use se a agência preferir gerenciar tudo pelo GTM')+
     campoPixel('TikTok Pixel','tiktok',p.tiktok,'ex.: CXXXXXXXXXXXXXXXXX','')+
     campoPixel('Google Ads — ID de conversão','googleAds','','ex.: AW-XXXXXXXXX','')+
     '<button class="btnP2 ok" style="margin-top:12px" onclick="salvarPixels()">'+
      sv('check',13)+' Salvar códigos</button>'+
    '</div></div>'+
   '<div class="cfgCol estreita">'+
    '<div class="colH">Eventos que o cardápio envia</div>'+
    '<div class="colB">'+
     '<table class="etTab previaDre"><tbody>'+
     [['PageView','abriu o cardápio'],
      ['ViewContent','abriu um produto'],
      ['AddToCart','colocou na sacola'],
      ['InitiateCheckout','foi para o fechamento'],
      ['Purchase','finalizou o pedido — com o valor'],
      ['Lead','cadastrou telefone']].map(function(e){
       return '<tr><td class="pC">'+sv('check',10)+'</td>'+
       '<td class="pN">'+e[0]+'<small class="pAuto">'+e[1]+'</small></td></tr>';
     }).join('')+'</tbody></table>'+
     '<div class="hint" style="padding:12px">Estes eventos são disparados sozinhos assim que '+
     'você preencher os códigos ao lado. Passe esta lista para quem cuida do tráfego.</div>'+
    '</div></div>'+
  '</div>';
}
function campoPixel(rot,id,val,ph,dica){
  return '<div class="fld2"><label>'+E(rot)+'</label>'+
   '<input id="px_'+id+'" value="'+E(val||'')+'" placeholder="'+E(ph)+'">'+
   (dica?'<div class="hint">'+E(dica)+'</div>':'')+'</div>';
}
function blocoApp(){
  baseUsr();baseSuc();
  var link='https://app.joiagest.com.br/';
  var usrs=(DB.usuarios||[]).filter(function(u){return u.ativo!==false});
  var pub=usrs.filter(function(u){return estaPublicadoNoApp(u)}).length;
  /* confere no banco em segundo plano e redesenha se algo mudou */
  if(_appPublicados===null)setTimeout(function(){
    carregarPublicadosApp().then(function(){ try{telaCanaisIntegracao();}catch(e){} });
  },60);
  return '<div class="cfgDuas">'+
   '<div class="cfgCol"><div class="colH">Quem tem acesso ao aplicativo</div>'+
    '<div class="colB" style="padding:0">'+
    '<table class="etTab semBusca"><thead><tr>'+
     '<th>Pessoa</th><th style="width:150px">Login do app</th>'+
     '<th style="width:170px">Lojas</th>'+
     '<th style="width:130px;text-align:center">No aplicativo</th>'+
     '<th style="width:150px">Senha do app</th>'+
     '<th style="width:120px"></th></tr></thead><tbody>'+
    usrs.map(function(u){
      var lojas=(u.mestre||u.tudo||!(u.sucursais||[]).length)?'todas'
        :(u.sucursais||[]).map(function(id){return sucNome(id)}).join(', ');
      return '<tr>'+
      '<td><b>'+E(u.nome)+'</b></td>'+
      /* ==========================================================
         O LOGIN DO APLICATIVO PODE SER SIMPLES

         Aqui so se mostrava o e-mail do sistema, sem poder mudar. Mas o
         aplicativo e somente leitura — quem entra ve os numeros da loja
         dele e mais nada, nao lanca, nao apaga, nao cancela.

         Exigir "santafe@jologelato.com.br" num teclado de celular, todo
         dia, e atrito a toa. `app_entrar` procura pelo login como texto
         livre: nao precisa ser e-mail.

         Entao o campo virou editavel, com o e-mail como sugestao. Quem
         quiser deixa "santafe"; quem preferir o e-mail, mantem.
         ========================================================== */
      '<td><input class="senhaApp" id="lo_'+E(u.id)+'" type="text" '+
       'value="'+E(u.loginApp||u.login||'')+'" autocomplete="off" '+
       'placeholder="ex: santafe"></td>'+
      '<td>'+E(lojas)+'</td>'+
      '<td style="text-align:center">'+(estaPublicadoNoApp(u)
        ?'<span class="badge2">'+sv('check',10)+' liberado</span>'
        :'<span class="badge2 am">não publicado</span>')+'</td>'+
      /* ==========================================================
         A SENHA DO APLICATIVO SE DEFINE AQUI

         Antes era preciso sair desta tela, abrir Usuarios (ou o cadastro
         da loja), digitar a senha, salvar, voltar aqui e publicar. Tres
         telas para uma coisa so — e a senha que se digitava la era a do
         sistema, nao a do aplicativo.

         Agora o campo esta na propria linha: digita e publica. E o texto
         diz o que a senha e: simples, so para ver os numeros no celular.
         ========================================================== */
      '<td><input class="senhaApp" id="sa_'+E(u.id)+'" type="text" '+
       'placeholder="'+(estaPublicadoNoApp(u)?'trocar senha':'senha do app')+'" '+
       'autocomplete="off"></td>'+
      '<td><button class="btnP2" onclick="publicarUsuarioApp(\''+u.id+'\')">'+
       sv('cloud',12)+' '+(estaPublicadoNoApp(u)?'Republicar':'Publicar')+'</button>'+
       /* enviar o acesso de UMA pessoa, com o login dela na mensagem */
       (estaPublicadoNoApp(u)
         ?' <button class="btnP2" title="Enviar o acesso pelo WhatsApp" '+
          'onclick="enviarLinkAppDe(\''+u.id+'\')">'+sv('link',12)+' Enviar</button>':'')+
      '</td></tr>';
    }).join('')+
    /* os sócios entram na mesma tabela, logo abaixo */
    sociosApp().map(function(x){
      var ref=String(x.ref||'');
      return '<tr>'+
      '<td><b>'+E(x.login||'sócio')+'</b>'+
       '<div class="hint" style="margin:0">sócio — só o aplicativo</div></td>'+
      '<td><input class="senhaApp" id="lo_'+E(ref)+'" type="text" '+
       'value="'+E(x.login||'')+'" autocomplete="off" placeholder="ex: carlos"></td>'+
      '<td>todas</td>'+
      '<td style="text-align:center">'+((x.tem_senha&&x.ativo!==false)
        ?'<span class="badge2">'+sv('check',10)+' liberado</span>'
        :'<span class="badge2 am">não publicado</span>')+'</td>'+
      '<td><input class="senhaApp" id="sa_'+E(ref)+'" type="text" '+
       'placeholder="'+(x.tem_senha?'trocar senha':'senha do app')+'" '+
       'autocomplete="off"></td>'+
      '<td><button class="btnP2" onclick="publicarSocioApp(\''+E(ref)+'\')">'+
       sv('cloud',12)+' '+(x.tem_senha?'Republicar':'Publicar')+'</button>'+
       (x.tem_senha?' <button class="btnP2" title="Enviar o acesso pelo WhatsApp" '+
         'onclick="enviarLinkSocioApp(\''+E(ref)+'\')">'+sv('link',12)+' Enviar</button>':'')+
       /* a classe de perigo do btnP2 e `rdB`; `rd` existe para outros
          elementos e aqui sairia um botao sem cor nenhuma */
       ' <button class="btnP2 rdB" title="Tirar o acesso deste sócio" '+
        'onclick="removerSocioApp(\''+E(ref)+'\')">'+sv('trash',12)+'</button>'+
      '</td></tr>';
    }).join('')+'</tbody></table>'+
    /* ==========================================================
       A JOIA TEM MAIS DE UM DONO

       A lista acima sai de `DB.usuarios`: um acesso de aplicativo por
       usuario do sistema. Para a loja isso basta — cada unidade tem um
       dono. Para a matriz nao: sao socios, varias pessoas, e nenhuma
       delas precisa de usuario do SISTEMA so para ver o faturamento no
       celular. Criar um usuario para cada socio seria dar PDV, estoque
       e financeiro a quem so quer olhar numero.
       ========================================================== */
    '<div style="padding:12px 14px 0">'+
     '<button class="btnP2 ok" onclick="novoSocioApp()">'+sv('plus',13)+
     ' Adicionar sócio</button>'+
    '</div>'+
    '<div class="hint" style="padding:14px">'+
    '<b>O login e a senha aqui são só do aplicativo</b> — não são os de entrar no sistema. '+
    'Como serve apenas para ver os números no celular, pode ser simples: '+
    'o nome da pessoa e alguns números já bastam.<br>'+
    'O login pode ser o nome da pessoa ou da loja — "santafe", "jales" — sem '+
    'espaço e com no mínimo 3 letras.<br>'+
    'Preencha login e senha na linha e clique em Publicar. Republique sempre que '+
    'trocar a senha, o login ou as lojas.<br>'+
    'Para escolher o que cada um vê, use <b>Usuários e Permissões</b>, aba <b>Aplicativo</b>.<br>'+
    '<b>Sócio</b> é acesso só do aplicativo: vê todas as lojas no celular e '+
    'não entra no sistema. Use para os outros donos da Joia.</div>'+
    '</div></div>'+
   '<div class="cfgCol estreita"><div class="colH">Link para enviar</div>'+
    '<div class="colB" style="padding:16px">'+
     '<div class="appQr">'+
      /* ==========================================================
         O CARTAO MOSTRA O ICONE DO APLICATIVO, NAO O DA MARCA

         Aqui aparecia `joia-icone.png` — o icone do sistema. Quem
         olhasse esta tela para saber "como e o aplicativo que vou
         mandar para o franqueado" via a marca errada, e no celular
         chegava outra coisa.

         Agora e o proprio icone do aplicativo, o mesmo que o franqueado
         vai ver na tela do celular dele.
         ========================================================== */
      '<div class="appIco"><img src="app-icone.png" alt="Joia Gestão"></div>'+
      '<b>Joia Gestão</b>'+
      '<span>painel da loja no celular</span>'+
     '</div>'+
     '<div class="linkGrande">'+E(link)+'</div>'+
     '<button class="btnP2 ok" style="width:100%;justify-content:center;margin-top:10px" '+
      'onclick="copiarLinkApp()">'+sv('copy',13)+' Copiar link</button>'+
     '<button class="btnP2" style="width:100%;justify-content:center;margin-top:8px" '+
      'onclick="enviarLinkApp()">'+sv('chat',13)+' Enviar no WhatsApp</button>'+
     '<a class="btnP2" href="'+link+'" target="_blank" '+
      'style="width:100%;justify-content:center;margin-top:8px;text-decoration:none">'+
      sv('eye',13)+' Ver o aplicativo</a>'+
     '<div class="cfgSep">Como instalar</div>'+
     '<div class="passoZ"><b>1</b><div>Abra o link no celular</div></div>'+
     '<div class="passoZ"><b>2</b><div>No Android, toque em <b>Instalar</b>.<br>'+
      'No iPhone, toque em <b>Compartilhar</b> e depois em <b>Adicionar à Tela de Início</b></div></div>'+
     '<div class="passoZ"><b>3</b><div>Entre com o login e a senha do sistema</div></div>'+
     '<div class="hint" style="margin-top:12px">'+pub+' de '+usrs.length+' pessoa(s) com acesso liberado.</div>'+
    '</div></div></div>';
}
/* ==========================================================
   QUEM ESTA PUBLICADO E O BANCO QUE SABE

   `publicadoEm` era gravado so no aparelho e nunca subia. Bastava
   recarregar a pagina, ou abrir o sistema no outro computador, para
   todo mundo voltar a aparecer como "nao publicado" — mesmo com o
   acesso funcionando no celular.

   Pior que o incomodo: quem visse aquilo publicaria de novo, achando
   que nao tinha dado certo. A verdade e a tabela `app_usuarios`; e ela
   que o aplicativo consulta na hora de deixar alguem entrar.
   ========================================================== */
var _appPublicados=null;
async function carregarPublicadosApp(){
  if(!NUVEM.ligada)return null;
  try{
    var r=await api('rpc/app_publicados','POST',{});
    _appPublicados=Array.isArray(r)?r:(r||[]);
    /* guarda no aparelho tambem, para a tela nao piscar quando abrir offline */
    (DB.usuarios||[]).forEach(function(u){
      var e=_appPublicados.find(function(x){return x.ref===u.id});
      if(e&&e.tem_senha){ if(!u.publicadoEm)u.publicadoEm=new Date().toISOString();
                          u.loginApp=u.loginApp||e.login; }
      else if(e&&!e.tem_senha){ u.publicadoEm=''; }
    });
    salvar();
  }catch(e){ _quieto(e,'carregarPublicadosApp'); }
  return _appPublicados;
}
function estaPublicadoNoApp(u){
  if(_appPublicados){
    var e=_appPublicados.find(function(x){return x.ref===u.id});
    return !!(e&&e.tem_senha&&e.ativo!==false);
  }
  return !!u.publicadoEm;
}
/* ==========================================================
   O SOCIO E UM ACESSO QUE SO EXISTE NO APLICATIVO

   Mora na tabela `app_usuarios` do banco, com a referencia comecando
   por `soc_`, e enxerga todas as lojas — como a matriz. Nao tem
   usuario do sistema: nao entra no Joia, nao aparece em Usuarios e
   Permissoes, nao lanca nada.

   A lista deles vem do PROPRIO BANCO (`app_publicados`), nao de uma
   copia no aparelho. Assim o socio cadastrado no computador da matriz
   aparece tambem no computador da loja, sem depender de sincronizacao
   nova e sem coluna nova em tabela nenhuma.
   ========================================================== */
function sociosApp(){
  return (_appPublicados||[]).filter(function(x){
    return x&&String(x.ref||'').indexOf('soc_')===0;
  });
}
function novoSocioApp(){
  if(!NUVEM.ligada){toast('Ligue a nuvem para cadastrar um sócio.');return;}
  modal('Novo sócio no aplicativo',
   '<div class="mdB">'+
    '<div class="hint" style="margin-bottom:12px">Acesso só do aplicativo: a pessoa vê '+
    'o faturamento de todas as lojas no celular e <b>não entra no sistema</b>.</div>'+
    '<div class="fld2"><label>Login do aplicativo *</label>'+
     '<input id="soLogin" placeholder="ex: carlos" autocomplete="off">'+
     '<div class="hint">Sem espaço, no mínimo 3 letras. É o que a pessoa digita no celular.</div></div>'+
    '<div class="fld2" style="margin:0"><label>Senha do aplicativo *</label>'+
     '<input id="soSenha" placeholder="mínimo 4 caracteres" autocomplete="off"></div>'+
   '</div>','Cadastrar',function(){
    var lg=String(($('soLogin')||{}).value||'').trim().toLowerCase();
    var sn=String(($('soSenha')||{}).value||'').trim();
    if(lg.length<3){toast('O login precisa ter ao menos 3 caracteres.');return false;}
    if(/\s/.test(lg)){toast('O login não pode ter espaço.');return false;}
    if(sn.length<4){toast('A senha precisa ter ao menos 4 caracteres.');return false;}
    /* dois logins iguais no aplicativo se atropelam: um entraria na conta
       do outro sem erro nenhum */
    var repetidoUsr=(DB.usuarios||[]).some(function(u){
      return String(u.loginApp||u.login||'').toLowerCase()===lg; });
    var repetidoSoc=sociosApp().some(function(x){
      return String(x.login||'').toLowerCase()===lg; });
    if(repetidoUsr||repetidoSoc){toast('Já existe outro acesso com esse login.');return false;}
    gravarSocioApp('soc_'+uid('s'),lg,sn);
    return true;
  });
}
/* grava (ou regrava) o socio no banco e recarrega a lista */
async function gravarSocioApp(ref,login,senha){
  if(!NUVEM.ligada){toast('Ligue a nuvem para publicar o acesso.');return;}
  try{
    var campos={loja_id:NUVEM.loja,nome:login,login:login,
      ativo:true,mestre:false,
      /* `tudo` deixa explicito que ve a rede inteira. Confiar em
         "sucursais vazio = ve tudo" amarraria o socio a uma regra que
         um dia pode — e deve — ser apertada. */
      tudo:true,sucursais:[],permissoes:{},cartoes:[],ref_local:ref};
    /* PATCH primeiro, pela referencia: POST com merge substituiria a linha
       inteira e apagaria a SENHA_HASH de quem ja existia */
    var ja=await api('app_usuarios?ref_local=eq.'+encodeURIComponent(ref),
                     'PATCH',campos,{'Prefer':'return=representation'});
    if(!(Array.isArray(ja)&&ja.length))
      await api('app_usuarios?on_conflict=login','POST',[campos],
                {'Prefer':'resolution=merge-duplicates'});
    if(senha){
      var rs=await api('rpc/app_definir_senha','POST',{p_login:login,p_senha:senha});
      var dd=Array.isArray(rs)?rs[0]:rs;
      if(dd&&dd.erro)throw new Error(dd.erro);
    }
    _appPublicados=null;
    await carregarPublicadosApp();
    telaCanaisIntegracao();
    toast('Sócio liberado — entra com o login "'+login+'".');
  }catch(e){
    var det=String((e&&(e.message||e.hint||e.details))||e||'').slice(0,140);
    await confirmar({titulo:'Não consegui liberar o sócio',
      texto:'O acesso não foi publicado no aplicativo.',
      aviso:det?'Detalhe: '+E(det):'Verifique se a nuvem está ligada.',
      ok:'Entendi',cancelar:null,tipo:'perigo'});
  }
}
function publicarSocioApp(ref){
  var x=sociosApp().find(function(y){return y.ref===ref});
  if(!x)return;
  var cl=$('lo_'+ref), cs=$('sa_'+ref);
  var lg=String((cl&&cl.value)||x.login||'').trim().toLowerCase();
  var sn=String((cs&&cs.value)||'').trim();
  if(lg.length<3){toast('O login precisa ter ao menos 3 caracteres.');return;}
  if(/\s/.test(lg)){toast('O login não pode ter espaço.');return;}
  var repetido=(DB.usuarios||[]).some(function(u){
      return String(u.loginApp||u.login||'').toLowerCase()===lg; })
    ||sociosApp().some(function(y){
      return y.ref!==ref&&String(y.login||'').toLowerCase()===lg; });
  if(repetido){toast('Já existe outro acesso com esse login.');return;}
  /* senha em branco significa "mantem a que tem" — so e obrigatoria
     quando o acesso ainda nao tem nenhuma */
  if(!sn&&!x.tem_senha){
    toast('Digite a senha do aplicativo nesta linha e clique em Publicar.');return;
  }
  if(sn&&sn.length<4){toast('A senha precisa ter ao menos 4 caracteres.');return;}
  if(cs)cs.value='';
  gravarSocioApp(ref,lg,sn);
}
async function removerSocioApp(ref){
  var x=sociosApp().find(function(y){return y.ref===ref});
  if(!x)return;
  var ok=await confirmar({titulo:'Tirar o acesso do sócio',
    texto:E(x.login||''),
    aviso:'Ele deixa de entrar no aplicativo. Nada do sistema muda, e o '+
      'acesso pode ser liberado de novo depois.',
    ok:'Tirar acesso',tipo:'perigo'});
  if(!ok)return;
  try{
    /* desativa, nao apaga: assim o historico da linha continua no banco e
       liberar de novo e so republicar */
    await api('app_usuarios?ref_local=eq.'+encodeURIComponent(ref),
              'PATCH',{ativo:false});
    _appPublicados=null;
    await carregarPublicadosApp();
    telaCanaisIntegracao();
    toast('Acesso do sócio retirado.');
  }catch(e){
    toast('Não consegui tirar o acesso: '+String((e&&e.message)||'').slice(0,60));
  }
}
function enviarLinkSocioApp(ref){
  var x=sociosApp().find(function(y){return y.ref===ref});
  if(!x)return;
  var msg=encodeURIComponent(
    'Acompanhe o faturamento da Joia pelo celular 📊\n\n'+
    'https://app.joiagest.com.br/\n\n'+
    'Seu login: '+String(x.login||'')+'\nA senha foi combinada com você.\n\n'+
    'Abra o link e toque em instalar para ficar como aplicativo no celular.');
  window.open('https://wa.me/?text='+msg,'_blank');
}
function publicarUsuarioApp(id){
  US.sel=id;
  /* o que estiver digitado na linha vale: login e senha do aplicativo */
  var u=(DB.usuarios||[]).find(function(x){return x.id===id});
  var cl=$('lo_'+id);
  if(u&&cl){
    var novo=String(cl.value||'').trim().toLowerCase();
    if(!novo){ toast('Informe o login do aplicativo.'); return; }
    if(novo.length<3){ toast('O login precisa ter ao menos 3 caracteres.'); return; }
    if(/\s/.test(novo)){ toast('O login não pode ter espaço.'); return; }
    /* dois logins iguais no aplicativo se atropelam: um entraria na conta do
       outro sem erro nenhum */
    var repetido=(DB.usuarios||[]).some(function(x){
      return x.id!==id && String(x.loginApp||x.login||'').toLowerCase()===novo; });
    if(repetido){ toast('Já existe outro acesso com esse login.'); return; }
    u.loginApp=novo;
    salvar();
  }
  publicarAcesso().then(function(){
    /* recarrega a verdade do banco antes de redesenhar, senao a linha
       continuaria dizendo "Publicar" logo depois de publicar */
    carregarPublicadosApp().then(function(){ telaCanaisIntegracao(); });
  });
}
function enviarLinkApp(){
  var l='https://app.joiagest.com.br/';
  /* ==========================================================
     A MENSAGEM LEVA O LOGIN DA PESSOA

     Antes dizia so "entre com seu login e senha" — e o franqueado
     recebia o link sem saber QUAL era o login dele. Como agora o login
     pode ser simples ("santafe"), ele nao tem como adivinhar.

     Se houver um so acesso publicado, a mensagem ja diz qual e. Com
     varios, nao chuta: pede para escolher antes.
     ========================================================== */
  var pubs=(DB.usuarios||[]).filter(function(u){return estaPublicadoNoApp(u)});
  var quem='';
  if(pubs.length===1)quem=String(pubs[0].loginApp||pubs[0].login||'');
  var msg=encodeURIComponent(
    'Acompanhe o faturamento da sua loja pelo celular 📊\n\n'+
    l+'\n\n'+
    (quem?('Seu login: '+quem+'\nA senha foi combinada com você.\n\n'):'')+
    'Abra o link e toque em instalar para ficar como aplicativo no celular.');
  window.open('https://wa.me/?text='+msg,'_blank');
}
/* manda o link de UMA pessoa, com o login dela escrito */
function enviarLinkAppDe(id){
  var u=(DB.usuarios||[]).find(function(x){return x.id===id});
  if(!u)return;
  var lg=String(u.loginApp||u.login||'');
  var msg=encodeURIComponent(
    'Acompanhe o faturamento da '+(u.nome||'sua loja')+' pelo celular 📊\n\n'+
    'https://app.joiagest.com.br/\n\n'+
    'Seu login: '+lg+'\nA senha foi combinada com você.\n\n'+
    'Abra o link e toque em instalar para ficar como aplicativo no celular.');
  window.open('https://wa.me/?text='+msg,'_blank');
}
function blocoTEF(c){
  return '<div class="construWrap"><div class="construBox">'+
   '<div class="construIc">'+sv('cash',30)+'</div>'+
   '<b>Integração TEF</b>'+
   '<p>Ligação com a maquininha para a venda já sair paga, sem digitar o valor duas vezes.</p>'+
   '<span class="construTag">ainda não construído</span>'+
   '<div class="construNota">Depende da adquirente (Cielo, Stone, PagSeguro) e de um '+
   'programa instalado no computador do caixa. Vamos avaliar quando o volume justificar.</div>'+
  '</div></div>';
}
function togCanal(id){
  var c=baseCanais();
  c.cfg[id].ativo=!c.cfg[id].ativo;
  salvar();telaCanaisIntegracao();
  var k=CANAIS_LISTA.find(function(x){return x.id===id});
  toast((k?k.n:'Canal')+(c.cfg[id].ativo?' ativado.':' desativado.'));
}
function cfgCanal(id){
  var k=CANAIS_LISTA.find(function(x){return x.id===id});
  if(k&&k.tela){abrir(k.tela[0],k.tela[1]);return;}
  avisar((k?k.n:'Canal'),(k?k.det:''),'info');
}
function salvarPixels(){
  var c=baseCanais();
  ['fbPixel','fbToken','ga4','gtm','tiktok','googleAds'].forEach(function(k){
    var el=$('px_'+k);
    if(el)c.pixels[k]=el.value.trim();
  });
  salvar();
  toast('Códigos salvos — o cardápio digital vai usá-los.');
}
function ligarCN(){
  var b=$('cnB');
  if(b)b.oninput=function(){CN2.busca=this.value;var p=this.selectionStart;telaCanaisIntegracao();
    var n=$('cnB');if(n){n.focus();n.setSelectionRange(p,p);}};
}

/* ==========================================================
   CONFIGURAÇÃO DO CARDÁPIO DIGITAL
   ========================================================== */
var CD={suc:'',aba:'marca'};
/* ==========================================================
   O PADRAO DA TELA NAO PODE SUBIR COMO SE FOSSE ESCOLHA

   ESTA E A CAUSA DOS HORARIOS QUE "SOMEM" A CADA ATUALIZACAO.

   baseCard() cria uma configuracao padrao para toda unidade que ainda
   nao tem uma — 14:00 as 22:30 com segunda fechada. Isso e certo para
   a tela ter o que mostrar. O erro era essas configuracoes entrarem no
   ENVIO como se fossem escolha do lojista.

   Sequencia do estrago, que se repetiu quinze vezes:
     1. Ctrl+Shift+R: o aparelho abre vazio;
     2. baseCard() semeia o padrao nas quatro unidades;
     3. o envio sai antes de a descida terminar;
     4. o padrao sobrescreve na nuvem o horario de verdade.
   No fim, as quatro lojas ficavam com o MESMO horario — o padrao. Foi
   o que apareceu no banco: Matriz, Jales, Alphaville e Santa Fe
   identicas, 14:00 as 22:30, segunda fechada.

   Agora o que nasce padrao fica marcado com `_padrao` e NAO sobe. A
   marca cai no primeiro salvamento de verdade, e a partir dali a
   configuracao e do lojista e sobe normalmente.
   ========================================================== */
function baseCard(){
  DB.cardapio=DB.cardapio||{};
  baseSuc();
  sucAtivas().forEach(function(s){
    if(!DB.cardapio[s.id])DB.cardapio[s.id]={_padrao:true,
      ativo:true,titulo:'',slogan:'',logo:'',capa:'',
      corPrincipal:'#2F4A32',corFundo:'#F7F3EA',
      whatsapp:'',instagram:'',endereco:'',
      pedidoMinimo:0,tempoEntrega:'40 a 60 min',tempoRetirada:'15 min',
      aceitaEntrega:true,aceitaRetirada:true,pedeCpf:false,
      formas:['Dinheiro','Pix','Cartão de débito','Cartão de crédito'],
      pixChave:'',aviso:'',horarios:horariosPadrao()};
  });
  return DB.cardapio;
}
function horariosPadrao(){
  return [0,1,2,3,4,5,6].map(function(d){
    return {dia:d,fechado:(d===1),abre:'14:00',fecha:'22:30'};
  });
}
function cardAtual(){
  baseCard();
  /* ==========================================================
     QUEM ENTROU POR UMA UNIDADE CONFIGURA A UNIDADE DELE

     Antes esta tela abria em `sucAtivas()[0]` — a primeira da lista,
     que na pratica e a Matriz ou o Alphaville. Quem entrava pelo login
     de Santa Fe abria a tela do cardapio ja apontando para OUTRA loja,
     sem perceber, e o que salvasse ia para a loja errada. Foi assim que
     o fechamento de segunda foi parar no Alphaville enquanto Santa Fe
     seguia com o horario antigo e o robo respondia "fechada".

     Agora: quem nao circula entre unidades abre travado na dele.
     ========================================================== */
  if(!podeTrocarUnidade()){
    var minha=lojaAtual();
    if(minha&&sucAtivas().some(function(s){return s.id===minha}))CD.suc=minha;
  }
  if(!CD.suc||!DB.cardapio[CD.suc])
    CD.suc=(podeTrocarUnidade()?(sucAtivas()[0]||{}):(sucAtivas().find(function(s){return s.id===lojaAtual()})||{})).id
           ||lojaAtual()||(sucAtivas()[0]||{}).id||'';
  var c=DB.cardapio[CD.suc]||{};
  /* horario vazio ganha o padrao SO PARA A TELA TER O QUE MOSTRAR. Sem a
     marca, esse padrao sobe e apaga o horario de verdade — foi o que
     aconteceu duas vezes. A marca cai no primeiro salvamento. */
  if(!c.horarios||!c.horarios.length){c.horarios=horariosPadrao();c._padrao=true;}
  if(!c.formas||!c.formas.length)c.formas=['Dinheiro','Pix','Cartão de débito','Cartão de crédito'];
  return c;
}
function telaCfgCardapio(dentro){
  baseMov();baseSuc();
  var c=cardAtual();
  var sucs=sucAtivas();
  /* o atalho curto e o que se divulga; o endereco completo continua
     valendo, mas ninguem poe um /delivery/?loja= num cartao */
  var link=linkCardapio(CD.suc);
  $('content').innerHTML='<div class="etWrap"><div class="etScroll">'+
   '<div class="etTopo">'+
    (dentro?'<button class="btnP2" onclick="CN2.aba=\'canais\';telaCanaisIntegracao()">'+
      sv('cr2',13)+' Canais</button>':'')+
    '<div><h1>Configuração do Cardápio Digital</h1>'+
    '<p>A página que seus clientes acessam para pedir.</p></div>'+
    '<div style="flex:1"></div>'+
    '<button class="btnP2" onclick="copiarLink()">'+sv('copy',13)+' Copiar link</button>'+
    '<a class="btnP2" href="'+link+'" target="_blank" style="text-decoration:none">'+
     sv('eye',13)+' Ver o cardápio</a>'+
    /* o botao diz EM QUAL loja vai gravar: com quatro unidades, salvar sem
       ver o nome ja mandou horario para a loja errada */
    '<button class="btnP2 ok" onclick="salvarCardapio(true)">'+sv('check',13)+
      ' Salvar '+E(sucNome(CD.suc))+'</button>'+
   '</div>'+
   '<div class="barraF">'+
    /* franqueado nao escolhe loja: ve o nome da dele, escrito, sem campo
       para trocar. Quem circula continua com a lista. */
    (podeTrocarUnidade()
      ? '<div class="bfCampo" style="min-width:220px"><label>Configurando a loja</label>'+
        '<select onchange="trocarLojaCardapio(this.value)">'+
        sucs.map(function(s){
          return '<option value="'+s.id+'"'+(CD.suc===s.id?' selected':'')+'>'+E(s.nome)+'</option>';
        }).join('')+'</select></div>'
      : '<div class="bfCampo" style="min-width:220px"><label>Configurando a loja</label>'+
        '<div style="font-weight:700;padding:6px 0">'+E(sucNome(CD.suc))+'</div></div>')+
    '<div class="bfCampo"><label>Situação</label>'+
     '<label class="chkL" style="height:32px;margin:0"><input type="checkbox" id="cdAtivo" '+
      (c.ativo!==false?'checked':'')+'><span>Cardápio no ar</span></label></div>'+
    '<div style="flex:1"></div>'+
    '<div class="linkBox"><span>Link público</span><b id="linkTxt">'+link+'</b></div>'+
   '</div>'+
   '<div class="abasCN">'+
    [['marca','Marca e visual','img'],['loja','Loja e horários','store'],
     ['entrega','Entrega e pagamento','moto'],['prods','Produtos no cardápio','book']]
     .map(function(a){
      return '<button class="abaCN'+(CD.aba===a[0]?' on':'')+'" onclick="trocarAbaCardapio(\''+a[0]+'\')">'+
      sv(a[2],14)+' '+a[1]+'</button>';}).join('')+
   '</div>'+
   (CD.aba==='marca'?abaMarca(c):CD.aba==='loja'?abaLoja(c):
    CD.aba==='entrega'?abaEntrega(c):abaProdutos(c))+
   '</div></div>'+
   '<div class="cdSalvar"><span>As mudanças valem para o cardápio de '+
    E(sucNome(CD.suc))+'.</span>'+
    '<button class="btnP2 ok" onclick="salvarCardapio(true)">'+sv('check',14)+' Salvar</button></div>';
  ligarCardapio();
  rodape('cardápio de '+(sucNome(CD.suc)));
}
/* ---------- marca ---------- */
function abaMarca(c){
  return '<div class="cfgDuas">'+
   '<div class="cfgCol"><div class="colH">Identidade da loja</div>'+
    '<div class="colB" style="padding:16px">'+
     '<div class="row2">'+
      '<div class="fld2" style="margin:0"><label>Nome que aparece no cardápio</label>'+
       '<input id="cdTitulo" value="'+E(c.titulo||'')+'" placeholder="'+E(sucNome(CD.suc))+'"></div>'+
      '<div class="fld2" style="margin:0"><label>Frase de apoio</label>'+
       '<input id="cdSlogan" value="'+E(c.slogan||'')+'" placeholder="feito para valer a pena"></div>'+
     '</div>'+
     '<div class="cfgSep">Imagens</div>'+
     /* a coluna larga e da CAPA. Com `row2` a logo e que ficava com ela,
        e por isso a moldura da logo aparecia enorme e a da capa apertada. */
     '<div class="rowImgs">'+
      /* ==========================================================
         O TAMANHO CERTO FICA ESCRITO EMBAIXO

         Sem a medida, cada um manda uma foto de um jeito e o resultado
         no cardapio sai torto. A logo e quadrada e aparece pequena; a
         capa e larga e ocupa a faixa do topo. A moldura aqui imita a
         proporcao de cada uma, para o que se ve no cadastro ser o que
         vai para o ar.
         ========================================================== */
      '<div><label class="rotImg">Logo</label>'+
       '<div class="imgDrop logo'+(c.logo?' tem':'')+'" onclick="escolherImg(\'logo\')">'+
        (c.logo?'<img src="'+c.logo+'">':'<div>'+sv('img',20)+'<span>enviar</span></div>')+
       '</div>'+
       '<div class="medidaImg">Quadrada · <b>512 × 512</b> px · fundo claro'+
        (c.logo?' <button class="btnMini" onclick="limparImg(\'logo\')">remover</button>':'')+
       '</div>'+
      '</div>'+
      '<div><label class="rotImg">Foto de capa</label>'+
       '<div class="imgDrop capa'+(c.capa?' tem':'')+'" onclick="escolherImg(\'capa\')">'+
        (c.capa?'<img src="'+c.capa+'">':'<div>'+sv('img',24)+'<span>enviar capa</span></div>')+
       '</div>'+
       '<div class="medidaImg">Deitada · <b>1200 × 600</b> px · o produto no meio'+
        (c.capa?' <button class="btnMini" onclick="limparImg(\'capa\')">remover</button>':'')+
       '</div>'+
      '</div>'+
     '</div>'+
     '<div class="cfgSep">Cores</div>'+
     '<div class="row2">'+
      '<div class="fld2" style="margin:0"><label>Cor principal</label>'+
       '<div class="corLinha"><input type="color" id="cdCor1" value="'+(c.corPrincipal||'#2F4A32')+'" '+
        'oninput="previewCard()">'+
        '<div class="corSug">'+['#2F4A32','#1C3A5E','#8B2E3C','#B8730B','#5B3E8E','#0F5C52']
         .map(function(k){return '<button style="background:'+k+'" onclick="setCor(1,\''+k+'\')"></button>'}).join('')+
        '</div></div></div>'+
      '<div class="fld2" style="margin:0"><label>Cor de fundo</label>'+
       '<div class="corLinha"><input type="color" id="cdCor2" value="'+(c.corFundo||'#F7F3EA')+'" '+
        'oninput="previewCard()">'+
        '<div class="corSug">'+['#F7F3EA','#FAF7F2','#F4F6F8','#FDF6F0','#F5F4F8','#FFFFFF']
         .map(function(k){return '<button style="background:'+k+';border:1px solid #ddd" onclick="setCor(2,\''+k+'\')"></button>'}).join('')+
        '</div></div></div>'+
     '</div>'+
     '<div class="cfgSep">Contato</div>'+
     '<div class="row3">'+
      '<div class="fld2" style="margin:0"><label>WhatsApp</label>'+
       '<input id="cdZap" value="'+E(c.whatsapp||'')+'" placeholder="17999999999"></div>'+
      '<div class="fld2" style="margin:0"><label>Instagram</label>'+
       '<input id="cdInsta" value="'+E(c.instagram||'')+'" placeholder="@sualoja"></div>'+
      '<div class="fld2" style="margin:0"><label>Endereço</label>'+
       '<input id="cdEnd" value="'+E(c.endereco||'')+'" placeholder="rua, número, bairro"></div>'+
     '</div>'+
    '</div></div>'+
   '<div class="cfgCol estreita"><div class="colH">Como vai ficar</div>'+
    '<div class="colB" style="padding:14px"><div id="prevCard">'+previaCardapio(c)+'</div></div>'+
   '</div></div>';
}
function previaCardapio(c){
  var t=c.titulo||sucNome(CD.suc);
  return '<div class="pcW" style="background:'+(c.corFundo||'#F7F3EA')+'">'+
   '<div class="pcTopo" style="background:'+(c.corPrincipal||'#2F4A32')+'">'+
    (c.logo?'<img src="'+c.logo+'">':'<div class="pcLg">'+E(t.charAt(0))+'</div>')+
    '<b>'+E(t)+'</b></div>'+
   '<div class="pcCapa">'+(c.capa?'<img src="'+c.capa+'">':'<span>foto de capa</span>')+
    '<div class="pcCapaIn" style="color:#fff"><b>'+E(t)+'</b>'+
    '<span>'+E(c.slogan||'')+'</span></div></div>'+
   '<div class="pcCats">'+['Tudo','Cascão','Potes'].map(function(x,k){
     return '<span class="pcCat'+(k===0?' on':'')+'"'+
     (k===0?' style="background:'+(c.corPrincipal||'#2F4A32')+'"':'')+'>'+x+'</span>';}).join('')+'</div>'+
   '<div class="pcProds">'+[1,2].map(function(){
     return '<div class="pcP"><div class="pcF"></div><div class="pcI">'+
      '<b>Produto</b><span style="color:'+(c.corPrincipal||'#2F4A32')+'">R$ 00,00</span></div></div>';
   }).join('')+'</div></div>';
}
function setCor(n,v){
  var el=$('cdCor'+n);
  if(el){el.value=v;previewCard();}
}
function previewCard(){
  var c=cardAtual();
  lerCardapio(true);
  var el=$('prevCard');
  if(el)el.innerHTML=previaCardapio(cardAtual());
}
function escolherImg(qual){
  var inp=document.createElement('input');
  inp.type='file';inp.accept='image/*';
  inp.onchange=function(){
    var f=this.files[0];if(!f)return;
    var r=new FileReader();
    r.onload=function(){
      comprimir(r.result,qual==='logo'?400:1200,function(dataUrl){
        var c=cardAtual();
        c[qual]=dataUrl;
        salvar();telaCfgCardapio();
        toast((qual==='logo'?'Logo':'Capa')+' atualizada.');
      });
    };
    r.readAsDataURL(f);
  };
  inp.click();
}
function comprimir(src,max,cb){
  var im=new Image();
  im.onload=function(){
    var w=im.width,h=im.height;
    if(w>max){h=h*max/w;w=max;}
    var cv=document.createElement('canvas');
    cv.width=w;cv.height=h;
    cv.getContext('2d').drawImage(im,0,0,w,h);
    cb(cv.toDataURL('image/jpeg',0.82));
  };
  im.src=src;
}
function limparImg(qual){
  var c=cardAtual();c[qual]='';salvar();telaCfgCardapio();
}

/* ---------- loja e horários ---------- */
var DIAS_S=['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
function abaLoja(c){
  /* ==========================================================
     ABRIR A TELA NAO E ESCOLHER HORARIO

     Aqui estava `salvar()`. Bastava ABRIR esta aba para o sistema
     gravar o horario padrao (14:00 as 22:30, segunda fechada) e
     mandar para a nuvem — sem ninguem clicar em nada. Foi assim que
     o horario de Santa Fe voltou ao padrao varias vezes, inclusive
     depois de ja ter sido corrigido.

     Agora o padrao entra SO PARA A TELA TER O QUE MOSTRAR, marcado
     com `_padrao`, e nao sobe. A marca cai no primeiro salvamento
     de verdade.
     ========================================================== */
  if(!c.horarios||!c.horarios.length){c.horarios=horariosPadrao();c._padrao=true;}
  var h=c.horarios;
  return '<div class="cfgDuas">'+
   '<div class="cfgCol"><div class="colH">Horário de funcionamento</div>'+
    '<div class="colB" style="padding:14px">'+
     /* ==========================================================
        PREENCHER SETE DIAS UM A UM E TRABALHO A TOA

        Na pratica a loja abre no mesmo horario a semana quase inteira e
        muda so no domingo. Digitar catorze horarios para mudar dois e o
        tipo de coisa que faz ninguem manter o cadastro em dia.
        Esta barra define uma vez e aplica no conjunto escolhido.
        ========================================================== */
     '<div class="horTodos">'+
      '<span class="horTit">Aplicar de uma vez</span>'+
      '<div class="horIn"><input type="time" id="hrDe" value="'+(h[1]&&h[1].abre||'14:00')+'">'+
       '<span>às</span><input type="time" id="hrAte" value="'+(h[1]&&h[1].fecha||'22:30')+'"></div>'+
      '<div class="horBt">'+
       [['seg-sex','Seg a Sex',[1,2,3,4,5]],['seg-sab','Seg a Sáb',[1,2,3,4,5,6]],
        ['fds','Sáb e Dom',[6,0]],['todos','Todos os dias',[0,1,2,3,4,5,6]]]
        .map(function(o){
          return '<button class="btnP2" onclick="aplicarHorario('+JSON.stringify(o[2])+')">'+
                 o[1]+'</button>';}).join('')+
      '</div>'+
      '<div class="hint" style="width:100%;margin:2px 0 0">Marca o horário acima nos dias '+
      'escolhidos e reabre quem estava fechado. Depois é só ajustar a exceção.</div>'+
      /* ==========================================================
         FECHAR EM LOTE ERA A METADE QUE FALTAVA (V204)

         `aplicarHorario(dias)` marca o horário e REABRE os dias — e o
         próprio texto acima diz isso. `fecharDias(dias)` é a metade
         oposta, escrita com o mesmo formato e a mesma contagem, e
         nunca foi chamada: para fechar a semana inteira era preciso
         desligar dia por dia, sete vezes.
         ========================================================== */
      '<span class="horTit" style="width:100%;margin-top:10px">Fechar de uma vez</span>'+
      '<div class="horBt">'+
       [['Seg a Sex',[1,2,3,4,5]],['Seg a Sáb',[1,2,3,4,5,6]],
        ['Sáb e Dom',[6,0]],['Todos os dias',[0,1,2,3,4,5,6]]]
        .map(function(o){
          return '<button class="btnP2" onclick="fecharDias('+JSON.stringify(o[1])+')">'+
                 o[0]+'</button>';}).join('')+
      '</div>'+
      '<div class="hint" style="width:100%;margin:2px 0 0">Marca os dias escolhidos como '+
      'fechados, sem mexer no horário guardado.</div>'+
     '</div>'+
     '<div class="horG">'+h.map(function(x,k){
       return '<div class="horL'+(x.fechado?' off':'')+'">'+
        '<label class="miniSw"><input type="checkbox" '+(x.fechado?'':'checked')+
         ' onchange="togDia('+k+')"><i></i></label>'+
        '<b>'+DIAS_S[x.dia]+'</b>'+
        (x.fechado?'<span class="fechadoTag">fechado</span>'
         :'<div class="horIn"><input type="time" value="'+(x.abre||'14:00')+'" '+
          'onchange="setHora('+k+',\'abre\',this.value)"><span>às</span>'+
          '<input type="time" value="'+(x.fecha||'22:30')+'" '+
          'onchange="setHora('+k+',\'fecha\',this.value)"></div>')+
       '</div>';
     }).join('')+'</div>'+
     '<div class="hint" style="margin-top:12px">Fora do horário o cardápio continua visível, '+
     'mas avisa que a loja está fechada. O cliente pode montar o pedido e enviar depois.</div>'+
     '<div class="cfgSep">Aviso no topo do cardápio</div>'+
     '<div class="fld2" style="margin:0"><input id="cdAviso" value="'+E(c.aviso||'')+'" '+
      'placeholder="ex.: hoje sem entrega no bairro X · promoção de terça"></div>'+
    '</div></div>'+
   '<div class="cfgCol estreita"><div class="colH">Situação agora</div>'+
    '<div class="colB" style="padding:16px">'+
     (function(){
       var ag=new Date(),d=ag.getDay(),m=ag.getHours()*60+ag.getMinutes();
       var hoje=h.find(function(x){return Number(x.dia)===d})||{};
       var ab=false;
       if(!hoje.fechado&&hoje.abre){
         var a=hoje.abre.split(':'),f=(hoje.fecha||'23:59').split(':');
         var ini=+a[0]*60+ +a[1],fim=+f[0]*60+ +f[1];
         if(fim<ini)fim+=1440;
         ab=(m>=ini&&m<=fim);
       }
       return '<div class="estAgora '+(ab?'ok':'no')+'">'+
        '<span class="pt2"></span><b>'+(ab?'Aberto agora':'Fechado agora')+'</b>'+
        '<span>'+DIAS_S[d]+(hoje.fechado?' — dia de folga'
          :' · '+(hoje.abre||'')+' às '+(hoje.fecha||''))+'</span></div>';
     })()+
     '<div class="hint" style="margin-top:14px">O cardápio confere este horário toda vez que '+
     'alguém abre a página.</div>'+
     '<button class="btnP2 ok" style="width:100%;margin-top:12px;justify-content:center" '+
      'onclick="abrirHojeAgora()">'+sv('check',13)+' Abrir hoje até 23:59</button>'+
     '<div class="hint" style="margin-top:7px">Atalho para deixar a loja aberta agora — '+
      'útil para testar ou para um dia fora do horário normal.</div>'+
    '</div></div></div>';
}
function abrirHojeAgora(){
  var c=cardAtual();
  var d=new Date().getDay();
  var h=c.horarios.find(function(x){return Number(x.dia)===d});
  if(!h){h={dia:d};c.horarios.push(h);}
  h.fechado=false;
  h.abre='00:00';h.fecha='23:59';
  c.ativo=true;
  /* ==========================================================
     O ATALHO ABRIA A LOJA SO NESTE APARELHO

     Faltavam as duas marcas que todo o resto do horario grava, e cada
     uma sozinha ja bastava para o atalho nao valer:

     `_padrao` — a configuracao que o lojista nunca salvou nasce marcada
     assim, e o envio filtra essas fora de proposito (config padrao nao
     pode subir e apagar o horario de verdade). Sem apagar a marca aqui,
     o `sincronizar()` da linha abaixo saia sem levar nada: a loja
     abria na tela e continuava fechada para o robo e para o cardapio.

     `_salvoEm` — e o que a trava da V119 compara com `atualizado_em` da
     nuvem para decidir quem e mais novo. Sem ela, o proximo download
     escrevia por cima e DESFAZIA a abertura.

     Mexer no horario e escolha do lojista: sobe, e vale mais do que o
     que estava na nuvem. `setHora`, `aplicarHorario` e `fecharDias` ja
     faziam isso; estes dois botoes tinham ficado para tras.
     ========================================================== */
  delete c._padrao; c._salvoEm=Date.now();
  salvar();
  if(NUVEM.ligada)sincronizar();
  telaCfgCardapio();
  toast('Loja aberta hoje até 23:59.');
}
function togDia(k){
  var c=cardAtual();
  c.horarios[k].fechado=!c.horarios[k].fechado;
  /* mesma historia do abrirHojeAgora: fechar a segunda pelo interruptor
     valia so na tela deste aparelho, e voltava no download seguinte */
  delete c._padrao; c._salvoEm=Date.now();
  salvar();telaCfgCardapio();
}
function setHora(k,campo,v){
  var c=cardAtual();
  c.horarios[k][campo]=v;
  delete c._padrao;               /* mexeu no horario: e escolha, sobe */
  c._salvoEm=Date.now();
  salvar();
}
function aplicarHorario(dias){
  var de=$('hrDe')&&$('hrDe').value, ate=$('hrAte')&&$('hrAte').value;
  if(!de||!ate){toast('Informe o horário de abertura e de fechamento.');return;}
  var c=cardAtual();
  c.horarios=c.horarios||horariosPadrao();
  var n=0;
  c.horarios.forEach(function(x){
    if(dias.indexOf(Number(x.dia))<0)return;
    x.abre=de; x.fecha=ate; x.fechado=false; n++;
  });
  delete c._padrao; c._salvoEm=Date.now();
  salvar(); telaCfgCardapio();
  toast(n+' dia(s) com horário '+de+' às '+ate+'.');
}
/* fecha de vez os dias marcados, sem precisar desligar um a um */
function fecharDias(dias){
  var c=cardAtual();
  c.horarios=c.horarios||horariosPadrao();
  var n=0;
  c.horarios.forEach(function(x){
    if(dias.indexOf(Number(x.dia))<0)return;
    x.fechado=true; n++;
  });
  delete c._padrao; c._salvoEm=Date.now();
  salvar(); telaCfgCardapio();
  toast(n+' dia(s) marcado(s) como fechado.');
}
/* ---------- entrega e pagamento ---------- */
function abaEntrega(c){
  baseAreas();
  var formas=['Dinheiro','Pix','Cartão de débito','Cartão de crédito','Vale refeição'];
  return '<div class="cfgDuas">'+
   '<div class="cfgCol"><div class="colH">Como o cliente recebe</div>'+
    '<div class="colB" style="padding:16px">'+
     '<div class="chkGrade">'+
      '<label class="chkL"><input type="checkbox" id="cdEnt" '+(c.aceitaEntrega!==false?'checked':'')+'>'+
       '<span><b>Aceita entrega</b><span>o cliente informa o endereço e paga a taxa</span></span></label>'+
      '<label class="chkL"><input type="checkbox" id="cdRet" '+(c.aceitaRetirada!==false?'checked':'')+'>'+
       '<span><b>Aceita retirada</b><span>o cliente busca na loja, sem taxa</span></span></label>'+
      '<label class="chkL"><input type="checkbox" id="cdCpf" '+(c.pedeCpf?'checked':'')+'>'+
       '<span><b>Pedir CPF</b><span>para nota fiscal; deixe desmarcado se não precisa</span></span></label>'+
     '</div>'+
     '<div class="row3" style="margin-top:14px">'+
      '<div class="fld2" style="margin:0"><label>Pedido mínimo</label>'+
       '<input id="cdMin" type="number" step="0.01" value="'+(c.pedidoMinimo||0)+'"></div>'+
      '<div class="fld2" style="margin:0"><label>Tempo de entrega</label>'+
       '<input id="cdTE" value="'+E(c.tempoEntrega||'')+'" placeholder="40 a 60 min"></div>'+
      '<div class="fld2" style="margin:0"><label>Tempo de retirada</label>'+
       '<input id="cdTR" value="'+E(c.tempoRetirada||'')+'" placeholder="15 min"></div>'+
     '</div>'+
     '<div class="cfgSep">Formas de pagamento aceitas no delivery</div>'+
     '<div class="rfChips">'+formas.map(function(f){
       var on=(c.formas||[]).indexOf(f)>=0;
       return '<label class="chip'+(on?' on':'')+'">'+
       '<input type="checkbox"'+(on?' checked':'')+' onchange="togFormaCard(\''+f+'\')">'+f+'</label>';
     }).join('')+'</div>'+
     '<div class="fld2" style="margin-top:12px"><label>Chave Pix (aparece para o cliente)</label>'+
      '<input id="cdPix" value="'+E(c.pixChave||'')+'" placeholder="telefone, e-mail ou chave aleatória"></div>'+
     '<div class="hint">O pagamento é feito na entrega ou na retirada — o cliente só informa '+
     'como vai pagar.</div>'+
    '</div></div>'+
   '<div class="cfgCol estreita"><div class="colH">Taxas de entrega</div>'+
    '<div class="colB">'+
     ((DB.areas||[]).length
      ?'<table class="etTab previaDre"><tbody>'+(DB.areas||[]).map(function(a){
        return '<tr class="pTot"><td class="pC">'+sv('map',11)+'</td>'+
         '<td class="pN">'+E(a.nome)+'<small class="pAuto">padrão R$ '+money(a.taxaPadrao)+'</small></td></tr>'+
         (a.zonas||[]).filter(function(z){return z.ativa!==false}).map(function(z){
           return '<tr><td class="pC"></td><td class="pN" style="font-weight:400">'+E(z.nome)+
           '<small class="pIt">R$ '+money(z.taxa)+(z.tipo==='rural'?' · zona rural':'')+'</small></td></tr>';
         }).join('');
       }).join('')+'</tbody></table>'+
       '<div class="hint" style="padding:12px">Estas zonas aparecem para o cliente escolher. '+
       'Altere em <b>Áreas de Entrega</b>.</div>'
      :'<div class="hint" style="padding:16px">Nenhuma área cadastrada. '+
       'Vá em <b>Configuração da Loja › Áreas de Entrega</b> para o cliente conseguir pedir entrega.</div>')+
    '</div></div></div>';
}
function togFormaCard(f){
  var c=cardAtual();
  c.formas=c.formas||[];
  var i=c.formas.indexOf(f);
  if(i>=0)c.formas.splice(i,1); else c.formas.push(f);
  salvar();telaCfgCardapio();
}
/* ---------- produtos ---------- */
function abaProdutos(c){
  var cats=(DB.categorias||[]).filter(function(x){return x.ativo!==false});
  var semFoto=(DB.produtos||[]).filter(function(p){return p.ativo!==false&&!p.imagem}).length;
  return '<div style="padding:14px 16px">'+
   (semFoto?'<div class="cnAviso" style="margin-bottom:12px">'+sv('help',15)+
     '<div><b>'+semFoto+' produto(s) sem foto</b> — no cardápio eles aparecem com um desenho. '+
     'Fotos boas aumentam muito o pedido. Adicione em Gestão de Cardápio.</div></div>':'')+
   '<div class="etTabW plano2" style="margin:0">'+
   '<table class="etTab semBusca"><thead><tr>'+
    '<th style="width:54px">Foto</th><th>Produto</th><th style="width:150px">Categoria</th>'+
    '<th style="width:110px;text-align:right">Preço</th>'+
    '<th style="width:130px;text-align:center">No cardápio</th></tr></thead><tbody>'+
   cats.map(function(cat){
     var ps=(DB.produtos||[]).filter(function(p){return p.categoriaId===cat.id&&p.ativo!==false});
     if(!ps.length)return '';
     return '<tr class="caGrupo"><td colspan="5"><b>'+E(cat.nome)+'</b> '+
      '<small style="color:var(--ink-3)">'+ps.length+' produto(s)</small>'+
      '<button class="btnMini" style="float:right" onclick="togCatCard(\''+cat.id+'\')">'+
      'marcar/desmarcar todos</button></td></tr>'+
      ps.map(function(p){
       return '<tr><td>'+(p.imagem?'<img src="'+p.imagem+'" class="miniF">'
         :'<span class="miniF vaz">'+sv('img',13)+'</span>')+'</td>'+
       '<td><b>'+E(p.nome)+'</b>'+
        (p.detalhes?'<small style="display:block;color:var(--ink-3)">'+E(p.detalhes)+'</small>'
         :'<small style="display:block;color:#C4A05A">sem descrição</small>')+'</td>'+
       '<td>'+E(cat.nome)+'</td>'+
       '<td style="text-align:right"><b>R$ '+money(p.preco)+'</b></td>'+
       '<td style="text-align:center"><label class="miniSw"><input type="checkbox" '+
        (p.delivery!==false?'checked':'')+' onchange="togProdCard(\''+p.id+'\')"><i></i></label></td></tr>';
      }).join('');
   }).join('')+
   '</tbody></table></div></div>';
}
function togProdCard(id){
  var p=(DB.produtos||[]).find(function(x){return x.id===id});
  if(!p)return;
  p.delivery=(p.delivery===false);
  /* ==========================================================
     MARCAR UM ITEM NAO PODE JOGAR A TELA PARA CIMA

     A tela e redesenhada a cada clique, e o navegador volta a rolagem
     ao topo. Com 42 produtos, quem estava no fim da lista era jogado
     para o comeco a cada marcacao — e tinha de rolar tudo de novo.
     semPular() ja existia para isso; faltava usar aqui.
     ========================================================== */
  salvar();semPular(telaCfgCardapio);
}
function togCatCard(cid){
  var ps=(DB.produtos||[]).filter(function(p){return p.categoriaId===cid});
  var todos=ps.every(function(p){return p.delivery!==false});
  ps.forEach(function(p){p.delivery=!todos});
  salvar();telaCfgCardapio();
}
/* ---------- salvar ---------- */
function lerCardapio(silencioso){
  var c=cardAtual();
  if($('cdAtivo'))c.ativo=$('cdAtivo').checked;
  if($('cdTitulo'))c.titulo=$('cdTitulo').value.trim();
  if($('cdSlogan'))c.slogan=$('cdSlogan').value.trim();
  if($('cdCor1'))c.corPrincipal=$('cdCor1').value;
  if($('cdCor2'))c.corFundo=$('cdCor2').value;
  if($('cdZap'))c.whatsapp=$('cdZap').value.trim();
  if($('cdInsta'))c.instagram=$('cdInsta').value.trim();
  if($('cdEnd'))c.endereco=$('cdEnd').value.trim();
  if($('cdAviso'))c.aviso=$('cdAviso').value.trim();
  if($('cdEnt'))c.aceitaEntrega=$('cdEnt').checked;
  if($('cdRet'))c.aceitaRetirada=$('cdRet').checked;
  if($('cdCpf'))c.pedeCpf=$('cdCpf').checked;
  if($('cdMin'))c.pedidoMinimo=parseFloat($('cdMin').value)||0;
  if($('cdTE'))c.tempoEntrega=$('cdTE').value.trim();
  if($('cdTR'))c.tempoRetirada=$('cdTR').value.trim();
  if($('cdPix'))c.pixChave=$('cdPix').value.trim();
  if(!silencioso)salvar();
}
/* ==========================================================
   HAVIA DUAS `salvarCardapio` — A MELHOR ESTAVA MORTA (item 29)

   Duas funcoes com o MESMO nome neste arquivo. Em JavaScript a segunda
   declaracao vence: a versao que ficava aqui, `async`, NUNCA rodava.
   Os botoes chamavam a de baixo.

   E a morta era a boa. Ela esperava `sincronizar()` terminar antes de
   dizer que o cardapio estava publicado, e abria um aviso claro quando
   a nuvem recusava: "Salvei aqui, mas nao publiquei". A viva dizia
   "Cardapio salvo." e agendava o envio — se a nuvem recusasse, a
   pagina publica continuava a antiga e ninguem ficava sabendo.

   E o mesmo padrao que ja derrubou 33 funcoes neste sistema: codigo
   legado que sobrevive ao lado do novo e ganha por acidente de ordem.

   As duas foram FUNDIDAS na de baixo, com a espera e o aviso da morta.
   Nao ficou nenhuma sobra: a varredura de nomes duplicados roda no
   `npm test` e quebra se acontecer de novo.
   ========================================================== */
function copiarLink(){
  var l=linkCardapio(CD.suc);
  try{navigator.clipboard.writeText(l);toast('Link copiado: '+l);}
  catch(e){prompt('Copie o link:',l);}
}
function ligarCardapio(){
  ['cdTitulo','cdSlogan','cdZap','cdInsta','cdEnd','cdAviso'].forEach(function(id){
    var el=$(id);
    if(el)el.oninput=function(){if(id==='cdTitulo'||id==='cdSlogan')previewCard()};
  });
}
/* ==========================================================
   O QUE FOI DIGITADO PRECISA SER GRAVADO

   Os campos desta tela so tinham `oninput` para atualizar a previa. Nada
   escrevia na configuracao: quem preenchia WhatsApp, Instagram e endereco
   e trocava de aba perdia tudo, sem aviso nenhum. Agora existe
   salvarCardapio(), que le todos os campos das quatro abas — o que nao
   estiver na tela e ignorado — e roda tambem ao trocar de aba, para nada
   se perder no caminho.
   ========================================================== */
function apelidoLink(sucId){
  var s=(DB.sucursais||[]).find(function(x){return x.id===sucId});
  var t=(s&&(s.apelido||s.nome))||'';
  return String(t).toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
}
function linkCardapio(sucId){
  var a=apelidoLink(sucId);
  return a?('https://joiagest.com.br/'+a)
          :'https://rafaeluendes-jpg.github.io/delivery/';
}
/* ==========================================================
   UMA CONFIGURACAO SO, NAO DUAS

   Eu criei cardapioAtual() na V117 sem ver que cardAtual() ja existia e
   fazia o mesmo. As duas escolhiam a loja por caminhos diferentes:

     cardAtual()    — cai na primeira loja se DB.cardapio[CD.suc] ainda
                      nao existir, mesmo com CD.suc apontando para outra
     cardapioAtual()— cria a entrada da loja escolhida e devolve ela

   Resultado: o horario, gravado por setHora() via cardAtual(), ia para
   uma loja; o titulo e o resto, gravados por salvarCardapio() via
   cardapioAtual(), iam para outra. Quem trocava da Matriz para Santa Fe
   e mexia no horario escrevia na Matriz sem perceber — a tela mostrava
   Santa Fe e a nuvem recebia o horario antigo dela de volta.

   Agora existe uma so: cardapioAtual() virou apelido de cardAtual().
   ========================================================== */
function cardapioAtual(){ return cardAtual(); }
function trocarLojaCardapio(id){
  try{ salvarCardapio(false); }catch(e){ _quieto(e,'trocarLojaCardapio'); }
  CD.suc=id;
  /* garante a entrada da loja escolhida: sem isso cardAtual() cairia na
     primeira loja da lista e a tela mostraria a configuracao errada */
  DB.cardapio=DB.cardapio||{};
  DB.cardapio[id]=DB.cardapio[id]||{};
  telaCfgCardapio();
}
async function salvarCardapio(avisar){
  var c=cardapioAtual();
  var txt={cdTitulo:'titulo',cdSlogan:'slogan',cdZap:'whatsapp',cdInsta:'instagram',
    cdEnd:'endereco',cdAviso:'aviso',cdPix:'pixChave',cdTE:'tempoEntrega',cdTR:'tempoRetirada'};
  Object.keys(txt).forEach(function(id){ if($(id))c[txt[id]]=$(id).value.trim(); });
  if($('cdCor1'))c.corPrincipal=$('cdCor1').value;
  if($('cdCor2'))c.corFundo=$('cdCor2').value;
  if($('cdMin'))c.pedidoMinimo=Number($('cdMin').value)||0;
  var chk={cdAtivo:'ativo',cdEnt:'aceitaEntrega',cdRet:'aceitaRetirada',cdCpf:'pedeCpf'};
  Object.keys(chk).forEach(function(id){ if($(id))c[chk[id]]=$(id).checked; });
  c._salvoEm=Date.now();          /* protege da descida ate o envio acontecer */
  delete c._padrao;               /* deixou de ser padrao: agora e escolha */
  salvar();
  /* ==========================================================
     PROMETER PUBLICACAO E DIFERENTE DE PROMETER GRAVACAO

     Herdado da versao que estava morta acima. Dizer "salvo" e agendar
     o envio faz a tela prometer uma coisa e entregar outra: quando a
     nuvem recusa, a pagina publica continua a anterior e a loja so
     descobre pelo cliente reclamando do preco antigo.

     Salvar em silencio (troca de aba, troca de loja) continua
     agendando o envio, porque ali ninguem prometeu nada.
     ========================================================== */
  if(!avisar){
    if(NUVEM.ligada)agendarSync();
    return c;
  }
  if(!NUVEM.ligada){
    toast('Cardápio salvo neste aparelho — a página pública será atualizada '+
      'quando a nuvem voltar.');
    return c;
  }
  try{
    await sincronizar();
    if(NUVEM.erros&&NUVEM.erros.length)
      throw new Error(NUVEM.erros[0].motivo||NUVEM.erros[0].msg||'a nuvem recusou');
    toast('Cardápio salvo — a página pública já está atualizada.');
  }catch(e){
    await confirmar({titulo:'Salvei aqui, mas não publiquei',
      texto:'As mudanças estão guardadas neste aparelho, porém a página '+
        'pública ainda mostra a versão anterior.',
      aviso:'Detalhe: '+E(String((e&&e.message)||e).slice(0,120))+
        '<br>Assim que a nuvem voltar, o envio acontece sozinho.',
      ok:'Entendi',cancelar:null});
  }
  return c;
}
function trocarAbaCardapio(a){
  try{ salvarCardapio(false); }catch(e){ _quieto(e,'trocarAbaCardapio'); }
  CD.aba=a; telaCfgCardapio();
}

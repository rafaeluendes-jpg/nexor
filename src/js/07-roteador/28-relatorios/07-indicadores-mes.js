/* ==========================================================
   INDICADORES DO MÊS — O FECHAMENTO DO MÊS MONTADO SOZINHO
   (Rafael, 29/09/2026)

   "Analise essa planilha com os principais indicadores que a gente analisa
   no mês. Em KPIs, bem visual. Pode ser atualizado em tempo real: conforme
   for venda, conforme for compra. No último dia do mês a gente filtra os 30
   dias e tem esse relatório fixo. Coloca filtros."

   A planilha de Jales (JALES_INDICADORES_JOLO_2026) tem, por mês: vendas e
   o mix (gelato, sobremesa, bebidas, Experiência Jolô), média por dia,
   ticket médio, clientes, descontos, cancelamentos, custo médio de produção
   do gelato, ajustes, baixas manuais, consumo, perda geral, CPV, valor em
   estoque, dias de estoque, compras sem vínculo, stock out, energia,
   conciliação, funcionários e receita por funcionário.

   De onde cada número sai — nenhum é digitado de novo:
     - vendas, mix, ticket, clientes, descontos, cancelamentos: os pedidos
       (`pedsPeriodo`/`fontePedidos`, os mesmos do Faturamento; mês antigo
       vem da nuvem por `carregarHistorico`);
     - consumo (CMV), ajustes, baixas, perdas, produção: as movimentações de
       estoque, com a MESMA classificação do relatório "CMV por Mercadoria";
     - estoque, dias de estoque, itens zerados: o saldo de hoje da unidade;
     - conciliação: os lançamentos financeiros; compras sem vínculo: a lista
       de compras sem vínculo;
     - funcionários e energia (kWh): NÃO passam pelo sistema. Campo próprio
       na tela, com botão Atualizar, gravado por unidade e por mês na tabela
       `indicadores_manuais` e conferido na nuvem.

   O mês em andamento se refaz sozinho a cada 30 s quando entra venda,
   compra ou movimentação. Mês que já acabou fica como está.
   ========================================================== */
var IM={mes:'',suc:'',cmp:'ant',aba:'vendas',_t:null,_imp:''};
var MESES_CURTO=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
var MESES_LONGO=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto',
  'Setembro','Outubro','Novembro','Dezembro'];
var GRUPOS_MIX=[
  {id:'gelato',n:'Gelato',c:'var(--deep-2)'},
  {id:'sobremesa',n:'Sobremesas',c:'var(--acc)'},
  {id:'bebida',n:'Bebidas',c:'var(--blue)'},
  {id:'experiencia',n:'Experiência Jolô',c:'var(--acc-l)'}];

function imLimites(mes){
  var y=+mes.slice(0,4),m=+mes.slice(5,7);
  var ult=new Date(y,m,0).getDate();
  return {de:mes+'-01',ate:mes+'-'+String(ult).padStart(2,'0'),dias:ult};
}
function imMesMais(mes,n){
  var d=new Date(+mes.slice(0,4),+mes.slice(5,7)-1+n,1);
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
}
function imCurto(mes){return MESES_CURTO[+mes.slice(5,7)-1]+'/'+mes.slice(2,4)}
function imLongo(mes){return MESES_LONGO[+mes.slice(5,7)-1]+' / '+mes.slice(0,4)}
function imSucPadrao(){
  var s=lojaAtualId();
  var lst=sucursaisDoUsuario();
  if(lst.some(function(x){return x.id===s}))return s;
  return lst.length?lst[0].id:s;
}

/* o grupo do mix vem da CATEGORIA do produto — "Cascão", "Copo" e "Potes
   Gelato" somam em Gelato, como na planilha */
function grupoMixDoItem(it){
  var p=(DB.produtos||[]).find(function(x){return x.id===it.produtoId})||
        (DB.produtos||[]).find(function(x){
          return String(x.nome||'').toLowerCase()===String(it.nome||'').toLowerCase();});
  var cat=p?(DB.categorias||[]).find(function(c){return c.id===p.categoriaId}):null;
  var n=String((cat&&cat.nome)||(p&&p.nome)||it.nome||'').toLowerCase();
  if(/taxa de entrega/.test(n))return null;
  if(/bebida/.test(n))return 'bebida';
  if(/sobremesa/.test(n))return 'sobremesa';
  if(/experi[eê]ncia/.test(n))return 'experiencia';
  return 'gelato';
}

/* ---------- vendas e clientes ----------
   Os pedidos são separados por mês UMA vez por desenho da tela (mesmos
   filtros do `pedsPeriodo`: unidade que a pessoa pode ver, unidade
   escolhida, cancelado à parte). Refazer o filtro para cada um dos 13
   meses custava 7 s com 9 mil vendas; separado uma vez, é instantâneo. */
var _imCache={chave:'',baldes:null};
/* o mesmo dia de `diaLocal` (dia da loja, fuso de Brasília), com o
   conversor criado UMA vez: criar um Intl por venda era o que pesava */
var _imFmt=null;
function imDia(v){
  var t=String(v||'');
  if(!t)return '';
  if(t.length<=10||!/[TZ+]|\d\d:\d\d/.test(t))return t.slice(0,10);
  try{
    if(!_imFmt)_imFmt=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',
      year:'numeric',month:'2-digit',day:'2-digit'});
    var d=new Date(t);if(isNaN(d))return t.slice(0,10);
    return _imFmt.format(d);
  }catch(e){ return diaLocal(v); }
}
function imBaldes(suc){
  var fonte=fontePedidos();
  var ult=fonte.length?fonte[fonte.length-1]:null;
  var chave=suc+'|'+fonte.length+'|'+(ult?ult.id+ult.fase:'')+'|'+(DB.cancelamentos||[]).length;
  if(_imCache.chave===chave&&_imCache.baldes)return _imCache.baldes;
  baseSuc();
  var b={};
  fonte.forEach(function(p){
    if(!p||!vendaDaUnidadeAberta(p))return;
    if(suc&&sucursalDoPedido(p)!==suc)return;
    var d=imDia(p.data);if(!d)return;
    var x=b[d.slice(0,7)]||(b[d.slice(0,7)]={peds:[],canc:[]});
    (ehCancelado(p)?x.canc:x.peds).push(p);
  });
  _imCache={chave:chave,baldes:b};
  return b;
}
function imVendas(mes,suc){
  var L=imLimites(mes), hoje=hojeISO();
  var aberto=hoje>=L.de&&hoje<=L.ate;
  var bal=imBaldes(suc)[mes]||{peds:[],canc:[]};
  var peds=bal.peds, canc=bal.canc;
  var r={mes:mes,aberto:aberto,vendas:0,pedidos:peds.length,descontos:0,
    cancel:0,qCancel:canc.length,mix:{},mixTot:0};
  GRUPOS_MIX.forEach(function(g){r.mix[g.id]=0});
  peds.forEach(function(p){
    r.vendas+=Number(p.total)||0;
    r.descontos+=Number(p.desconto)||0;
    (p.itens||[]).forEach(function(it){
      var g=grupoMixDoItem(it);if(!g)return;
      var v=Number(it.total)||0;r.mix[g]+=v;r.mixTot+=v;
    });
  });
  canc.forEach(function(p){r.cancel+=Number(p.total)||0});
  r.dias=aberto?Math.max(1,+hoje.slice(8,10)):L.dias;
  r.porDia=r.vendas/r.dias;
  r.ticket=r.pedidos?r.vendas/r.pedidos:0;
  return r;
}

/* ---------- custos e estoque ----------
   Mesma classificação do "CMV por Mercadoria" (cmvCalcular). Duas
   diferenças, as duas para não contar duas vezes:
     - venda cancelada não é CMV;
     - o insumo consumido NA PRODUÇÃO não é CMV: ele vira o gelato, e o
       gelato é que sai na venda.

   ==========================================================
   O ESTORNO QUE ESTE CÓDIGO ESPERAVA NUNCA EXISTIU

   Havia aqui `if(org==='estorno')` e, no fim, `cmv = cmv − estorno`.
   Varrendo o sistema inteiro, `'estorno'` nunca era ESCRITO em lugar
   nenhum: `r.estorno` era sempre zero, e o desconto do CMV nunca
   acontecia. Código que descreve um comportamento que não existe é pior
   que código ausente — ele faz quem lê acreditar que o caso está
   tratado.

   O caso é real e tem duas formas:
     · cancelamento NÃO produzido — o estorno apaga o movimento, e ele
       simplesmente deixa de existir (nada a descontar);
     · cancelamento JÁ produzido — o movimento fica (o insumo foi gasto
       mesmo), agora marcado com `perdaCancelamento`. Isso não é CMV:
       é perda, e entra em `perdas`, como o resto.
   ========================================================== */
function imJanelaMov(){
  var d=new Date();d.setDate(d.getDate()-(typeof DIAS_JANELA!=='undefined'?DIAS_JANELA:90));
  return d.toISOString().slice(0,10);
}
function imEstoque(mes,suc){
  var L=imLimites(mes);
  if(L.de<imJanelaMov())return null;          /* o aparelho não tem esse mês inteiro */
  var r={cmv:0,perdaCanc:0,ajustes:0,baixas:0,perdaProd:0,compras:0,prodV:0,prodKg:0};
  (DB.movEst||[]).forEach(function(m){
    if(!m||m.demo||m.data<L.de||m.data>L.ate)return;
    if(suc&&m.sucursalId&&m.sucursalId!==suc)return;
    var tipo=tipoMotivo(m.motivoId),org=String(m.origem||''),nome=nomeMotivo(m.motivoId);
    (m.linhas||[]).forEach(function(l){
      var ins=itemEstoque(l.insumoId);if(!ins)return;
      var q=convUnid(l.qtd,l.unidade,ins.unidade);if(q===null)q=Number(l.qtd)||0;
      var v=Math.abs(q*(Number(l.custo)||0));
      var ent=(l.direcao==='entrada');
      if(m.perdaCancelamento){ if(!ent)r.perdaCanc+=v; return; }
      if(org==='venda'){r.cmv+=ent?-v:v;return;}
      if(org.indexOf('producao')>=0||tipo==='producao'||String(l.origem||'').indexOf('producao')>=0){
        if(ent&&/gelato/i.test(ins.nome||'')){
          r.prodV+=v;
          var kg=convUnid(Math.abs(q),ins.unidade,'kg');if(kg!==null)r.prodKg+=kg;
        }else if(!ent&&/perda/i.test(nome))r.perdaProd+=v;
        return;
      }
      if(org==='nota'||tipo==='entrada'){ if(ent)r.compras+=v; return; }
      if(/contagem|ajuste|invent/i.test(nome)||org==='contagem'){r.ajustes+=ent?-v:v;return;}
      if(org==='transferencia'||org.indexOf('pedbase')===0||/transfer|base para unidade/i.test(nome))return;
      if(!ent)r.baixas+=v;
    });
  });
  r.cmv=Math.max(0,r.cmv);
  r.perdas=Math.max(0,r.ajustes)+r.baixas+r.perdaProd+r.perdaCanc;
  r.custoKg=r.prodKg>0?r.prodV/r.prodKg:null;
  return r;
}
/* saldo de HOJE da unidade: estoque não tem fotografia por mês */
function imEstoqueHoje(suc){
  var v=0,zerados=0,itens=0;
  (DB.insumos||[]).forEach(function(i){
    if(!i||i.controlaEstoque===false||i.ativo===false)return;
    itens++;
    var s=Number(saldoUn(i.id,suc))||0;
    if(s<=0.0001)zerados++;
    else v+=s*(Number(custoAtual(i))||0);
  });
  return {valor:v,zerados:zerados,itens:itens};
}
function imConciliacao(mes){
  var L=imLimites(mes);
  var bancos={};(DB.contas||[]).forEach(function(c){
    if(!c.fixa&&/banco/i.test(String(c.tipo||'')))bancos[c.id]=true;});
  var l=(DB.lancFin||[]).filter(function(x){
    return x&&x.pago&&bancos[x.contaId]&&x.pagamento>=L.de&&x.pagamento<=L.ate&&x.tipo!=='transferencia';});
  if(!l.length)return null;
  return l.filter(function(x){return x.conciliado}).length/l.length;
}
function imSemVinculo(mes){
  var L=imLimites(mes);
  return (DB.comprasSemVinc||[]).filter(function(c){
    var d=String(c.excluidoEm||'').slice(0,10);return d>=L.de&&d<=L.ate;}).length;
}

/* ---------- o que se digita à mão ---------- */
function idManual(suc,mes){return 'im_'+suc+'_'+mes;}
function manualDoMes(suc,mes){
  return (DB.indManuais||[]).find(function(x){return x.id===idManual(suc,mes)})||null;
}
async function salvarManual(campo){
  var inp=$('im_'+campo);if(!inp)return;
  var txt=String(inp.value||'').trim().replace(',','.');
  var v=txt===''?null:Number(txt);
  if(v!==null&&(!isFinite(v)||v<0)){toast('Digite um número maior ou igual a zero.');inp.focus();return;}
  if(campo==='funcionarios'&&v!==null&&Math.round(v)!==v){toast('Funcionários é um número inteiro.');inp.focus();return;}
  DB.indManuais=DB.indManuais||[];
  var id=idManual(IM.suc,IM.mes);
  var r=manualDoMes(IM.suc,IM.mes);
  if(!r){r={id:id,sucursalId:IM.suc,mes:IM.mes,funcionarios:null,energiaKwh:null};DB.indManuais.push(r);}
  r[campo==='funcionarios'?'funcionarios':'energiaKwh']=v;
  salvar();
  IM._estado='Salvando…';
  telaIndicadoresMes();
  var ok=await confirmarNaNuvem('indManuais',id,campo==='funcionarios'?'Funcionários':'Energia');
  IM._estado=ok?'Tudo salvo':(NUVEM.ligada?'Enviando para a nuvem…':'Salvo neste aparelho — sobe quando a internet voltar');
  if(S.mod==='relatorios'&&S.it==='indicadores-mes')telaIndicadoresMes();
}
function manualSujo(){
  var r=manualDoMes(IM.suc,IM.mes)||{};
  var f=$('im_funcionarios'),e=$('im_energia');
  var dif=function(inp,val){
    if(!inp)return false;
    var t=String(inp.value||'').trim().replace(',','.');
    return (t===''?null:Number(t))!==(val==null?null:Number(val));
  };
  return dif(f,r.funcionarios)||dif(e,r.energiaKwh);
}

/* ---------- desenho ---------- */
function imVar(a,b,menorMelhor,pontos){
  if(b==null||a==null)return {txt:'sem comparação',cls:'nt'};
  if(pontos){
    var dp=(a-b)*100;if(Math.abs(dp)<0.05)return {txt:'igual',cls:'nt'};
    var bom=menorMelhor?dp<0:dp>0;
    return {txt:(dp>0?'▲ ':'▼ ')+Math.abs(dp).toFixed(1).replace('.',',')+' ponto(s)',cls:bom?'up':'dn'};
  }
  if(!b)return {txt:'sem comparação',cls:'nt'};
  var p=(a-b)/Math.abs(b)*100;
  if(Math.abs(p)<0.05)return {txt:'igual',cls:'nt'};
  var bom2=menorMelhor?p<0:p>0;
  return {txt:(p>0?'▲ ':'▼ ')+Math.abs(p).toFixed(1).replace('.',',')+'%',cls:bom2?'up':'dn'};
}
function imKpi(t,v,dv,nota,dest){
  return '<div class="imK'+(dest?' dest':'')+'"><span>'+E(t)+'</span><b>'+v+'</b>'+
    (dv?'<em class="'+dv.cls+'">'+E(dv.txt)+'</em>':'')+
    (nota?'<small>'+nota+'</small>':'')+'</div>';
}
function imBarras(vals,rot,fmt){
  var W=640,H=210,PL=48,PB=24,PT=16,iw=W-PL-10,ih=H-PB-PT;
  var max=Math.max.apply(null,vals.concat([1]))*1.12,bw=iw/Math.max(1,vals.length);
  var s='<svg viewBox="0 0 '+W+' '+H+'" role="img">';
  for(var g=0;g<=4;g++){var y=PT+ih-ih*g/4;
    s+='<line x1="'+PL+'" x2="'+(W-10)+'" y1="'+y+'" y2="'+y+'" stroke="var(--line-2)"/>'+
      '<text x="'+(PL-6)+'" y="'+(y+3)+'" font-size="9.5" fill="var(--ink-3)" text-anchor="end">'+fmt(max*g/4)+'</text>';}
  vals.forEach(function(v,i){
    var h=ih*v/max,x=PL+i*bw+bw*.18,y=PT+ih-h,ult=i===vals.length-1;
    s+='<rect x="'+x+'" y="'+y+'" width="'+(bw*.64)+'" height="'+Math.max(0,h)+'" rx="3" fill="'+(ult?'var(--acc)':'var(--line)')+'"/>';
    if(ult)s+='<text x="'+(x+bw*.32)+'" y="'+(y-5)+'" font-size="10" font-weight="700" fill="var(--acc-d)" text-anchor="middle">'+fmt(v)+'</text>';
    s+='<text x="'+(x+bw*.32)+'" y="'+(H-7)+'" font-size="9.5" fill="var(--ink-2)" text-anchor="middle">'+rot[i]+'</text>';
  });
  return s+'</svg>';
}
function imLinha(vals,rot,fmt){
  var W=640,H=200,PL=48,PB=24,PT=18,iw=W-PL-16,ih=H-PB-PT;
  var vv=vals.filter(function(x){return x!=null});
  if(!vv.length)return '<div class="imSem">Sem dados no período.</div>';
  var max=Math.max.apply(null,vv)*1.1,min=Math.min.apply(null,vv)*0.85;if(max===min)max=min+1;
  var X=function(i){return PL+iw*i/Math.max(1,vals.length-1)},Y=function(v){return PT+ih-ih*(v-min)/(max-min)};
  var s='<svg viewBox="0 0 '+W+' '+H+'" role="img">';
  for(var g=0;g<=4;g++){var val=min+(max-min)*g/4,y=Y(val);
    s+='<line x1="'+PL+'" x2="'+(W-16)+'" y1="'+y+'" y2="'+y+'" stroke="var(--line-2)"/>'+
      '<text x="'+(PL-6)+'" y="'+(y+3)+'" font-size="9.5" fill="var(--ink-3)" text-anchor="end">'+fmt(val)+'</text>';}
  var pts=[];vals.forEach(function(v,i){if(v!=null)pts.push([X(i),Y(v)])});
  s+='<path d="M'+pts[0][0]+','+(PT+ih)+' L'+pts.map(function(p){return p.join(',')}).join(' L')+
    ' L'+pts[pts.length-1][0]+','+(PT+ih)+' Z" fill="var(--blue)" opacity=".10"/>'+
    '<polyline points="'+pts.map(function(p){return p.join(',')}).join(' ')+'" fill="none" stroke="var(--blue)" stroke-width="2.4"/>';
  vals.forEach(function(v,i){
    if(v!=null){var ult=i===vals.length-1;
      s+='<circle cx="'+X(i)+'" cy="'+Y(v)+'" r="'+(ult?5:2.8)+'" fill="'+(ult?'var(--acc)':'var(--blue)')+'" stroke="var(--panel)" stroke-width="1.5"/>';
      if(ult)s+='<text x="'+(X(i)-8)+'" y="'+(Y(v)-10)+'" font-size="10.5" font-weight="700" fill="var(--acc-d)" text-anchor="end">'+fmt(v)+'</text>';}
    s+='<text x="'+X(i)+'" y="'+(H-7)+'" font-size="9.5" fill="var(--ink-2)" text-anchor="middle">'+rot[i]+'</text>';
  });
  return s+'</svg>';
}
function imRosca(r){
  var tot=r.mixTot;
  if(!tot)return '<div class="imSem">Sem vendas no mês.</div>';
  var a0=-Math.PI/2,s='<svg viewBox="0 0 160 160" class="imRosca" role="img">';
  GRUPOS_MIX.forEach(function(g){
    var v=r.mix[g.id];if(!v)return;
    var a1=a0+2*Math.PI*v/tot;if(a1-a0>=2*Math.PI-0.0001)a1=a0+2*Math.PI-0.0001;
    var l=(a1-a0)>Math.PI?1:0;
    var p=function(a,rr){return (80+rr*Math.cos(a)).toFixed(2)+','+(80+rr*Math.sin(a)).toFixed(2)};
    s+='<path d="M'+p(a0,70)+' A70,70 0 '+l+' 1 '+p(a1,70)+' L'+p(a1,44)+' A44,44 0 '+l+' 0 '+p(a0,44)+' Z" fill="'+g.c+'"/>';
    a0=a1;
  });
  return s+'<text x="80" y="76" text-anchor="middle" font-size="10" fill="var(--ink-2)">vendas</text>'+
    '<text x="80" y="92" text-anchor="middle" font-size="12" font-weight="700" fill="var(--ink)">R$ '+
    (tot>=1000?(tot/1000).toFixed(1).replace('.',',')+' mil':money(tot))+'</text></svg>';
}
function imPct(v,d){return v==null?'—':(v*100).toFixed(d==null?1:d).replace('.',',')+'%';}

function telaIndicadoresMes(){
  baseMov();baseSuc();
  _imCache.chave='';                     /* cada desenho relê os pedidos uma vez */
  if(!IM.mes)IM.mes=hojeISO().slice(0,7);
  if(!IM.suc)IM.suc=imSucPadrao();
  GUARDA.fn=function(){return manualSujo()?'Funcionários ou energia foram digitados e não foram atualizados.':''};
  var L=imLimites(IM.mes);
  /* 13 meses: os 12 do gráfico e o de antes, para a média e o "mês anterior" */
  carregarHistorico(imLimites(imMesMais(IM.mes,-12)).de,L.ate,telaIndicadoresMes);
  var serie=[];for(var k=-11;k<=0;k++)serie.push(imVendas(imMesMais(IM.mes,k),IM.suc));
  var v=serie[serie.length-1];
  var cmpMes=IM.cmp==='ano'?imMesMais(IM.mes,-12):imMesMais(IM.mes,-1);
  var c;
  if(IM.cmp==='media'){
    var ant=[];for(var j=-12;j<=-1;j++)ant.push(imVendas(imMesMais(IM.mes,j),IM.suc));
    ant=ant.filter(function(x){return x.pedidos>0});
    var med=function(f){return ant.length?ant.reduce(function(a,x){return a+x[f]},0)/ant.length:null};
    c={vendas:med('vendas'),porDia:med('porDia'),ticket:med('ticket'),pedidos:med('pedidos'),
       descontos:med('descontos'),cancel:med('cancel')};
  }else c=imVendas(cmpMes,IM.suc);
  var nomeCmp=IM.cmp==='media'?'a média de 12 meses':(IM.cmp==='ano'?imCurto(cmpMes):imCurto(cmpMes));
  var fechado=!v.aberto&&IM.mes<hojeISO().slice(0,7);
  var sucs=sucursaisDoUsuario();
  var opMes=[];for(var m=0;m<18;m++){var mm=imMesMais(hojeISO().slice(0,7),-m);opMes.push(mm);}

  var h='<div class="etWrap"><div class="etScroll">'+
   '<div class="etTopo"><div><h1>Indicadores do Mês</h1>'+
    '<p>O fechamento do mês montado sozinho, a partir das vendas, compras e estoque. '+
    (v.aberto?'Mês em andamento: atualiza a cada venda.':'Mês encerrado: números do mês inteiro.')+'</p></div>'+
    '<button class="infoBt" onclick="explicaIndicadores()" aria-label="Como cada número é feito">'+sv('help',15)+'</button>'+
    '<div style="flex:1"></div>'+
    '<button class="btnP2" onclick="imprimirRel(\'Indicadores do Mês\')">'+sv('print2',13)+' PDF</button>'+
    '<button class="btnP2" onclick="exportarIndicadores()">'+sv('file2',13)+' Exportar</button>'+
   '</div>'+
   '<div class="barraF">'+
    '<div class="bfCampo"><label for="imMes">Mês</label><select id="imMes" onchange="IM.mes=this.value;IM._estado=\'\';telaIndicadoresMes()">'+
     opMes.map(function(x){return '<option value="'+x+'"'+(x===IM.mes?' selected':'')+'>'+imLongo(x)+'</option>'}).join('')+
    '</select></div>'+
    '<div class="bfCampo"><label for="imSuc">Unidade</label><select id="imSuc" onchange="IM.suc=this.value;IM._estado=\'\';telaIndicadoresMes()">'+
     sucs.map(function(s){return '<option value="'+E(s.id)+'"'+(s.id===IM.suc?' selected':'')+'>'+E(s.nome)+'</option>'}).join('')+
    '</select></div>'+
    '<div class="bfCampo"><label>Comparar com</label><div class="imChips">'+
     [['ant','Mês anterior'],['ano','Mesmo mês do ano passado'],['media','Média de 12 meses']].map(function(o){
       return '<button class="'+(IM.cmp===o[0]?'on':'')+'" onclick="IM.cmp=\''+o[0]+'\';telaIndicadoresMes()">'+o[1]+'</button>';}).join('')+
    '</div></div>'+
    '<span class="imSit '+(fechado?'ok':'vivo')+'">'+(fechado?'✓ Mês encerrado':'● Em andamento — atualiza sozinho')+'</span>'+
   '</div>'+
   '<div class="imAbas" role="tablist">'+
    '<button role="tab" class="'+(IM.aba==='vendas'?'on':'')+'" onclick="IM.aba=\'vendas\';telaIndicadoresMes()">Vendas e clientes</button>'+
    '<button role="tab" class="'+(IM.aba==='custos'?'on':'')+'" onclick="IM.aba=\'custos\';telaIndicadoresMes()">Custos, estoque e equipe</button>'+
   '</div>'+
   '<div class="imCorpo" id="relArea">'+
   (IM.aba==='custos'?imAbaCustos(v,serie,nomeCmp):imAbaVendas(v,c,serie,nomeCmp))+
   '</div></div></div>';
  $('content').innerHTML=h;
  rodape('Indicadores de '+imLongo(IM.mes)+' · '+sucNome(IM.suc)+' · R$ '+money(v.vendas));
  imArmarTempoReal();
}
function imAbaVendas(v,c,serie,nomeCmp){
  var rot=serie.map(function(x){return imCurto(x.mes)});
  var h='<div class="imKpis">'+
   imKpi('Vendas do mês','R$ '+money(v.vendas),imVar(v.vendas,c.vendas),'vs '+E(nomeCmp),true)+
   imKpi('Média por dia','R$ '+money(v.porDia),imVar(v.porDia,c.porDia),v.dias+' dia(s)'+(v.aberto?' até hoje':''))+
   imKpi('Ticket médio','R$ '+money(v.ticket),imVar(v.ticket,c.ticket),'vendas ÷ pedidos')+
   imKpi('Clientes',String(v.pedidos),imVar(v.pedidos,c.pedidos),'pedidos no mês')+
   imKpi('Descontos','R$ '+money(v.descontos),imVar(v.descontos,c.descontos,true),
     v.vendas?imPct(v.descontos/v.vendas,2)+' das vendas':'')+
   imKpi('Cancelamentos','R$ '+money(v.cancel),imVar(v.cancel,c.cancel,true),v.qCancel+' venda(s) cancelada(s)')+
  '</div>'+
  '<div class="imGrid g2">'+
   '<div class="grafCard"><div class="grafH"><div><b>Vendas — últimos 12 meses</b><span>o mês escolhido em dourado</span></div></div>'+
    '<div class="grafBox">'+imBarras(serie.map(function(x){return x.vendas}),rot,function(n){return n>=1000?Math.round(n/1000)+' mil':String(Math.round(n))})+'</div></div>'+
   '<div class="grafCard"><div class="grafH"><div><b>Mix de vendas</b><span>quanto cada grupo representa do mês</span></div></div>'+
    '<div class="imMix">'+imRosca(v)+'<div class="imLeg">'+
     GRUPOS_MIX.map(function(g){var x=v.mix[g.id];
       return '<div><i style="background:'+g.c+'"></i>'+E(g.n)+'<b>R$ '+money(x)+' · '+imPct(v.mixTot?x/v.mixTot:0)+'</b></div>';}).join('')+
    '</div></div></div>'+
  '</div>'+
  '<div class="imGrid g21">'+
   '<div class="grafCard"><div class="grafH"><div><b>Ticket médio — 12 meses</b><span>quanto cada cliente gastou, em média</span></div></div>'+
    '<div class="grafBox">'+imLinha(serie.map(function(x){return x.pedidos?x.ticket:null}),rot,function(n){return 'R$ '+Math.round(n)})+'</div></div>'+
   '<div class="grafCard"><div class="grafH"><div><b>Clientes atendidos — 12 meses</b><span>pedidos no mês</span></div></div>'+
    '<div class="grafBox">'+imBarras(serie.map(function(x){return x.pedidos}),rot,function(n){return String(Math.round(n))})+'</div></div>'+
  '</div>';
  return h;
}
function imAbaCustos(v,serie,nomeCmp){
  var e=imEstoque(IM.mes,IM.suc);
  var mesAnt=imMesMais(IM.mes,-1);
  var eA=imEstoque(mesAnt,IM.suc), vA=imVendas(mesAnt,IM.suc);
  var hojeMes=hojeISO().slice(0,7)===IM.mes;
  var est=hojeMes?imEstoqueHoje(IM.suc):null;
  var man=manualDoMes(IM.suc,IM.mes)||{};
  /* sem nenhuma saída de estoque no mês não há CPV para mostrar: "—", nunca
     um 0,0% que parece número de verdade */
  var cpv=function(ee,vv){return (ee&&vv.vendas&&(ee.cmv+ee.perdas)>0)?(ee.cmv+ee.perdas)/vv.vendas:null};
  var perda=function(ee){return (ee&&ee.cmv)?ee.perdas/ee.cmv:null};
  var diasEst=(est&&e&&e.cmv)?est.valor/(e.cmv/v.dias):null;
  var func=man.funcionarios, kwh=man.energiaKwh;
  var rpf=(func&&func>0)?v.vendas/func:null;
  var semMov=!e||!(e.cmv+e.perdas+e.compras+e.prodV>0);
  var h='<div class="imKpis">'+
   imKpi('CPV do mês',semMov?'—':imPct(cpv(e,v)),semMov?null:imVar(cpv(e,v),cpv(eA,vA),true,true),
     'consumo + perdas ÷ vendas',true)+
   imKpi('Consumo do mês',semMov?'—':'R$ '+money(e.cmv),null,
     semMov?'':(v.vendas?imPct(e.cmv/v.vendas)+' das vendas':'custo do que foi vendido'))+
   imKpi('Perda geral',semMov?'—':imPct(perda(e)),semMov?null:imVar(perda(e),perda(eA),true,true),'ajustes + baixas ÷ consumo')+
   imKpi('Estoque em valor',(est&&est.itens)?'R$ '+money(est.valor):'—',null,
     est?(est.itens?'saldo de hoje':'nenhum item com controle de estoque'):'só no mês em andamento')+
   imKpi('Dias de estoque',diasEst!=null?diasEst.toFixed(1).replace('.',',')+' dias':'—',null,'quanto o estoque dura')+
   imKpi('Receita por funcionário',rpf!=null?'R$ '+money(rpf):'—',null,
     func?func+' funcionário(s)':'informe os funcionários abaixo')+
  '</div>'+
  (!e?'<div class="imAviso">'+sv('help',14)+' Este aparelho guarda as movimentações de estoque dos últimos '+
     (typeof DIAS_JANELA!=='undefined'?DIAS_JANELA:90)+' dias. Custos, perdas e CPV de meses mais antigos não estão aqui.</div>'
   :(semMov?'<div class="imAviso">'+sv('help',14)+' Nenhuma movimentação de estoque neste mês: sem consumo, CPV e perdas para mostrar.</div>':''))+
  '<div class="imGrid g2">'+
   '<div class="grafCard"><div class="grafH"><div><b>Perdas e ajustes do mês</b><span>o que saiu do estoque sem virar venda</span></div></div>'+
    '<table class="etTab semBusca imTab"><tbody>'+
     '<tr><td>Ajustes de contagem</td><td class="'+(e&&e.ajustes>0?'dn':'')+'">'+(e?(e.ajustes>0?'− ':'+ ')+'R$ '+money(Math.abs(e.ajustes)):'—')+'</td></tr>'+
     '<tr><td>Baixas manuais (perda, consumo interno)</td><td class="dn">'+(e?'− R$ '+money(e.baixas):'—')+'</td></tr>'+
     '<tr><td>Perda de produção</td><td class="dn">'+(e?'− R$ '+money(e.perdaProd):'—')+'</td></tr>'+
     '<tr><td><b>Total de perdas</b></td><td class="dn"><b>'+(e?'− R$ '+money(e.perdas):'—')+'</b></td></tr>'+
     '<tr><td>Compras do mês (notas de entrada)</td><td>'+(e?'R$ '+money(e.compras):'—')+'</td></tr>'+
     '<tr><td>Custo médio de produção do gelato</td><td>'+(e&&e.custoKg!=null?'R$ '+money(e.custoKg)+' / kg':'—')+'</td></tr>'+
    '</tbody></table></div>'+
   '<div class="grafCard"><div class="grafH"><div><b>Equipe e energia do mês</b><span>não passam pelo sistema: digite e clique em Atualizar</span></div></div>'+
    '<div class="imMan">'+
     '<label for="im_funcionarios">Funcionários</label>'+
     '<div class="imManL"><input id="im_funcionarios" type="number" inputmode="numeric" min="0" step="1" value="'+(func==null?'':func)+'" placeholder="ex: 4">'+
     '<button class="btnP2 ok" onclick="salvarManual(\'funcionarios\')">Atualizar</button></div>'+
     '<label for="im_energia">Energia do mês (kWh)</label>'+
     '<div class="imManL"><input id="im_energia" type="number" inputmode="decimal" min="0" step="1" value="'+(kwh==null?'':kwh)+'" placeholder="ex: 2103">'+
     '<button class="btnP2 ok" onclick="salvarManual(\'energia\')">Atualizar</button></div>'+
     '<div class="imEstado">'+E(IM._estado||(man.id?'Tudo salvo':''))+'</div>'+
    '</div></div>'+
  '</div>'+
  '<div class="grafCard"><div class="grafH"><div><b>Controles do mês</b><span>verde está em dia; vermelho pede atenção</span></div></div>'+
   '<div class="imSem4">'+
    imSemaforo('Conciliação bancária',(function(){var x=imConciliacao(IM.mes);return x==null?'sem pagamento no banco':imPct(x,0)})(),
      (function(){var x=imConciliacao(IM.mes);return x==null?null:x>=0.999})())+
    imSemaforo('Compras sem vínculo',(function(){var n=imSemVinculo(IM.mes);return n?n+' compra(s)':'Nenhuma'})(),imSemVinculo(IM.mes)===0)+
    imSemaforo('Itens zerados (stock out)',est?est.zerados+' item(ns)':'—',est?est.zerados===0:null)+
    imSemaforo('Energia',kwh!=null?String(kwh).replace('.',',')+' kWh':'não informada',null,'informado à mão')+
   '</div></div>'+
  '<div class="grafCard"><div class="grafH"><div><b>Evolução dos últimos 6 meses</b><span>a mesma leitura da planilha, montada sozinha</span></div></div>'+
   '<div class="etTabW"><table class="etTab semBusca imTab"><thead><tr><th>Mês</th><th>Vendas</th><th>Ticket</th>'+
    '<th>Clientes</th><th>Descontos</th><th>Cancelamentos</th><th>CPV</th></tr></thead><tbody>'+
   serie.slice(-6).map(function(x){
     var ee=imEstoque(x.mes,IM.suc);
     return '<tr'+(x.mes===IM.mes?' class="atual"':'')+'><td>'+imCurto(x.mes)+'</td><td>R$ '+money(x.vendas)+'</td>'+
       '<td>R$ '+money(x.ticket)+'</td><td>'+x.pedidos+'</td><td>R$ '+money(x.descontos)+'</td>'+
       '<td>R$ '+money(x.cancel)+'</td><td>'+imPct(cpv(ee,x))+'</td></tr>';}).join('')+
   '</tbody></table></div></div>';
  return h;
}
function imSemaforo(t,v,ok,nota){
  return '<div class="imS"><span>'+E(t)+'</span><b>'+E(v)+'</b>'+
    (ok===true?'<em class="pOk">em dia</em>':ok===false?'<em class="pAl">atenção</em>':'')+
    (nota?'<em class="pMao">'+E(nota)+'</em>':'')+'</div>';
}
/* ---------- tempo real: o mês em andamento se refaz sozinho ---------- */
function imImpressao(){
  var p=DB.pedidos||[],m=DB.movEst||[],l=DB.lancFin||[];
  var u=p.length?p[p.length-1]:{};
  return [p.length,u.id||'',u.fase||'',m.length,l.length,(DB.indManuais||[]).length,
    (DB.cancelamentos||[]).length].join('|');
}
function imArmarTempoReal(){
  IM._imp=imImpressao();
  if(IM._t)return;
  IM._t=setInterval(function(){
    if(typeof S==='undefined'||S.mod!=='relatorios'||S.it!=='indicadores-mes'){
      clearInterval(IM._t);IM._t=null;return;}
    if(IM.mes!==hojeISO().slice(0,7))return;            /* mês encerrado não muda */
    var a=document.activeElement;
    if(a&&/^im_/.test(a.id||''))return;                   /* não atropela quem está digitando */
    if(imImpressao()!==IM._imp)telaIndicadoresMes();
  },30000);
}
function explicaIndicadores(){
  explicaRel('Indicadores do Mês — como é feito',[
   ['Vendas, ticket, clientes','os pedidos não cancelados do mês, na unidade escolhida — a mesma conta do Faturamento'],
   ['Mix de vendas','a soma dos itens por categoria: Cascão, Copo e Potes contam como Gelato'],
   ['Descontos e cancelamentos','desconto dado nos pedidos e o total das vendas canceladas no mês'],
   ['Consumo do mês','custo do que saiu do estoque pela venda (as vendas canceladas devolvem o custo)'],
   ['Perdas','ajustes de contagem que tiraram estoque, baixas manuais e perda de produção'],
   ['CPV','consumo + perdas, dividido pelas vendas do mês'],
   ['Estoque e dias de estoque','valor do estoque de hoje e quantos dias ele dura no ritmo de consumo do mês'],
   ['Funcionários e energia','digitados na tela; a receita por funcionário é vendas ÷ funcionários']
  ],'pedidos, movimentações de estoque, lançamentos financeiros e compras sem vínculo.',
   'pedidos cancelados (entram só no indicador de cancelamentos) e outras unidades.');
}
function exportarIndicadores(){
  var serie=[];for(var k=-11;k<=0;k++)serie.push(imVendas(imMesMais(IM.mes,k),IM.suc));
  var l=[['Mes','Vendas','Pedidos','Ticket','Descontos','Cancelamentos','Gelato','Sobremesas','Bebidas','Experiencia','Consumo','Perdas','CPV %']];
  serie.forEach(function(x){
    var e=imEstoque(x.mes,IM.suc);
    l.push([imCurto(x.mes),x.vendas,x.pedidos,x.ticket,x.descontos,x.cancel,x.mix.gelato,x.mix.sobremesa,
      x.mix.bebida,x.mix.experiencia,e?e.cmv:'',e?e.perdas:'',(e&&x.vendas)?((e.cmv+e.perdas)/x.vendas*100):'']
      .map(function(c){return typeof c==='number'?String(+c.toFixed(2)).replace('.',','):c}));
  });
  baixarCSV('indicadores-'+IM.suc+'-'+IM.mes+'.csv',l);
}

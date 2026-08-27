/* ==========================================================
   BLOCO 10 — ACERTO COM ENTREGADORES
   ========================================================== */
var DIASEM=['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
var AC={de:'',ate:'',ent:'',busca:''};

function baseFin(){
  baseFormas();
  DB.entregadores=DB.entregadores||[];
  DB.acertos=DB.acertos||[];
  DB.lancamentos=DB.lancamentos||[];
  if(!DB.contas||!DB.contas.length){
    DB.contas=[
      {id:'ct_caixa',nome:'Caixa da loja',tipo:'Caixa',saldo:0},
      {id:'ct_cofre',nome:'Cofre',tipo:'Cofre',saldo:0},
      {id:'ct_banco',nome:'Banco — conta corrente',tipo:'Banco',saldo:0}
    ];
  }
}
/* toISOString devolve a data em UTC. No Brasil, das 21h em diante o UTC ja
   virou o dia seguinte — e toda venda da noite caia no dia errado, quebrando
   o fechamento de caixa e o faturamento do dia. Agora vale o horario de
   Brasilia, independente do relogio do computador da loja. */
function agoraSP(){
  try{
    var f=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',
      year:'numeric',month:'2-digit',day:'2-digit',
      hour:'2-digit',minute:'2-digit',hour12:false});
    var p={};f.formatToParts(new Date()).forEach(function(x){p[x.type]=x.value});
    return {data:p.year+'-'+p.month+'-'+p.day,hora:p.hour+':'+p.minute};
  }catch(e){
    var d=new Date();
    return {data:new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10),
            hora:('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2)};
  }
}
function hojeISO(){return agoraSP().data}
/* ==========================================================
   O DIA DA VENDA E O DIA DA LOJA, NAO O DIA DO MERIDIANO DE GREENWICH

   AQUI ESTAVA A DIFERENCA ENTRE O PDV E O FATURAMENTO.

   `pedido.data` vem de `data_venda`, que o banco entrega em UTC:
   "2026-08-26T00:43:56+00:00". Cortar os 10 primeiros caracteres da
   "2026-08-26" — o dia em Greenwich.

   Só que em Sao Paulo ainda era dia 25, as 21:43. Toda venda feita
   depois das 21:00 (horario de Brasilia) era carimbada com a data do
   DIA SEGUINTE em todos os relatorios.

   O efeito medido no banco: R$ 1.370,00 fora do lugar, sendo
   R$ 1.070,00 so das vendas de hoje. O PDV mostrava 1.070 (ele conta o
   caixa aberto, nao a data) e o Faturamento mostrava outro numero. Os
   dois liam a mesma tabela; um deles lia a data errada.

   E o pior horario possivel para uma gelateria: das 21h ate fechar e
   justamente o movimento forte.

   `diaLocal()` converte para o dia da loja antes de comparar. Aceita
   tanto a data com fuso (da nuvem) quanto a data simples "2026-08-25"
   (gravada pelo aparelho), porque as duas convivem.
   ========================================================== */
function diaLocal(v){
  var t=String(v||'');
  if(!t)return '';
  /* ja e uma data simples: nao ha fuso para converter */
  if(t.length<=10)return t.slice(0,10);
  if(!/[TZ+]|\d\d:\d\d/.test(t))return t.slice(0,10);
  var d=new Date(t);
  if(isNaN(d))return t.slice(0,10);
  try{
    return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',
      year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
  }catch(e){
    var l=new Date(d.getTime()-d.getTimezoneOffset()*60000);
    return l.toISOString().slice(0,10);
  }
}
/* atalho para o caso mais comum: o dia de um pedido */
function diasAtrasISO(n){
  var d=new Date(hojeISO()+'T12:00:00');
  d.setDate(d.getDate()-n);
  return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10);
}
function dataBR(iso){if(!iso)return '—';var p=iso.slice(0,10).split('-');return p[2]+'/'+p[1]+'/'+p[0]}
function ent(id){return (DB.entregadores||[]).find(function(x){return x.id===id})||null}

/* entregas de um entregador no período, ainda não acertadas */
function ehEntrega(p){return p&&p.tipo==='entrega'&&!p.foraAcerto}
function entregasDe(entId,de,ate,incluirAcertadas){
  return (DB.pedidos||[]).filter(function(p){
    if(!ehEntrega(p))return false;
    if(ehCancelado(p))return false;
    if(entId&&p.entregadorId!==entId)return false;
    if(!entId&&!p.entregadorId)return false;
    if(!incluirAcertadas&&p.acertoId)return false;
    var d=diaLocal(p.data);
    if(de&&d<de)return false;
    if(ate&&d>ate)return false;
    return true;
  });
}
function diariaDoDia(e,iso){
  if(!e||!e.diarias)return 0;
  var d=new Date(iso+'T12:00:00');
  return Number(e.diarias[d.getDay()])||0;
}
/* diárias dos dias em que ele efetivamente trabalhou */
function diariasPeriodo(e,lista){
  var dias={};
  lista.forEach(function(p){dias[diaLocal(p.data)]=true});
  var tot=0,det=[];
  Object.keys(dias).sort().forEach(function(d){
    var v=diariaDoDia(e,d);tot+=v;det.push({dia:d,valor:v});
  });
  return {total:tot,dias:det};
}
function cidadePedido(p){
  if(p.cidade)return p.cidade;
  var c=(DB.clientes||[]).find(function(x){return x.id===p.clienteId});
  return (c&&c.cidade)||'';
}
/* a taxa do acerto é SEMPRE a cadastrada no entregador para aquela cidade.
   Só quando não há cidade cadastrada é que usa a taxa cobrada no pedido. */
function taxaPedido(e,p){
  var cid=(cidadePedido(p)||'').trim().toLowerCase();
  if(e&&cid){
    var t=(e.taxas||[]).find(function(x){return (x.cidade||'').trim().toLowerCase()===cid});
    if(t)return Number(t.valor)||0;
  }
  if(cid){
    var g=valorCidade(cid);
    if(g)return g;
  }
  return Number(p.taxa)||0;
}
/* origem da taxa, para mostrar na tela */
function origemTaxa(e,p){
  var cid=(cidadePedido(p)||'').trim().toLowerCase();
  if(e&&cid&&(e.taxas||[]).some(function(x){return (x.cidade||'').trim().toLowerCase()===cid}))return 'cadastro';
  if(cid&&valorCidade(cid))return 'cidade';
  if(Number(p.taxa))return 'pedido';
  return 'nenhuma';
}
function resumoEntregador(e,de,ate){
  var lista=entregasDe(e.id,de,ate,false);
  var taxas=lista.reduce(function(a,p){return a+taxaPedido(e,p)},0);
  var vendas=lista.reduce(function(a,p){return a+(Number(p.total)||0)},0);
  var di=diariasPeriodo(e,lista);
  return {lista:lista,qtd:lista.length,taxas:taxas,vendas:vendas,
          diaria:di.total,diasDet:di.dias,aPagar:taxas+di.total};
}

/* ---------- TELA PRINCIPAL ---------- */
function telaAcertos(){
  baseFin();
  if(!AC.de)AC.de=diasAtrasISO(7);
  if(!AC.ate)AC.ate=hojeISO();
  var pd=entregadorPadrao();
  if(pd&&vincularPendentes(pd.id))salvar();
  var lista=(DB.entregadores||[]).filter(function(e){
    return !AC.busca||e.nome.toLowerCase().indexOf(AC.busca.toLowerCase())>=0;
  }).filter(function(e){return !AC.ent||e.id===AC.ent});

  var totQtd=0,totPagar=0;
  var cards=lista.map(function(e){
    var r=resumoEntregador(e,AC.de,AC.ate);
    totQtd+=r.qtd;totPagar+=r.aPagar;
    return '<div class="entCard">'+
    '<div class="entTopo">'+
     '<div class="av3" style="width:48px;height:48px;font-size:19px">'+E(e.nome.charAt(0).toUpperCase())+'</div>'+
     '<div class="entInfo">'+
      '<b>'+E(e.nome)+(e.padrao?' <span class="badge2 gr">padrão</span>':'')+'</b>'+
      '<span>'+E(e.tel||'sem telefone')+(e.cpf?' &nbsp;·&nbsp; CPF '+E(e.cpf):'')+
      (e.pix?' &nbsp;·&nbsp; Pix '+E(e.pix):'')+'</span>'+
     '</div>'+
     '<div class="entBtns">'+
      '<button class="btnP2" onclick="modalEntregador(\''+e.id+'\')">'+sv('edit',14)+' Editar cadastro</button>'+
      '<button class="btnP2" onclick="verEntregador(\''+e.id+'\')">'+sv('eye',14)+' Ver ficha</button>'+
      '<button class="btnP2 rdB" onclick="excluirEntregador(\''+e.id+'\')" title="Excluir">'+sv('trash',14)+'</button>'+
     '</div>'+
    '</div>'+
    '<div class="entCid"><span class="entLbl">Cidades e taxas</span>'+
     ((e.taxas||[]).length
       ? e.taxas.map(function(t){return '<span class="cidTag">'+E(t.cidade)+' &nbsp;R$ '+money(t.valor)+'</span>'}).join('')
       : '<span class="semCid">nenhuma cidade cadastrada — a taxa não será calculada</span>')+
    '</div>'+
    '<div class="entNums">'+
     '<div class="eN"><span>Entregas</span><b>'+r.qtd+'</b></div>'+
     '<div class="eN"><span>Taxas</span><b>R$ '+money(r.taxas)+'</b></div>'+
     '<div class="eN"><span>Diárias</span><b>R$ '+money(r.diaria)+'</b></div>'+
     '<div class="eN"><span>Vendas entregues</span><b>R$ '+money(r.vendas)+'</b></div>'+
     '<div class="eN pagar"><span>Total a pagar</span><b>R$ '+money(r.aPagar)+'</b></div>'+
     '<button class="btnAcertar" onclick="telaAcertoDet(\''+e.id+'\')"'+(r.qtd?'':' disabled')+'>'+
       sv('cash',16)+' '+(r.qtd?'Acertar':'Sem entregas')+'</button>'+
    '</div></div>';
  }).join('');

  $('content').innerHTML='<div class="finWrap">'+
  '<div class="finTop">'+
   '<div><h1>Acerto com Entregadores</h1>'+
   '<p>Selecione o período e o entregador para conferir e realizar o pagamento.</p></div>'+
   '<div class="finActs">'+
   '<button class="btnP2" onclick="imprimirAcertos()">'+sv('print2',14)+' Imprimir</button>'+
   '<button class="btnP2 ok" onclick="modalEntregador()">'+sv('plus',14)+' Cadastrar entregador</button></div>'+
  '</div>'+

  '<div class="filtroCard">'+
   '<div class="fl"><label>De</label><input type="date" id="acDe" value="'+AC.de+'"></div>'+
   '<div class="fl"><label>Até</label><input type="date" id="acAte" value="'+AC.ate+'"></div>'+
   '<div class="fl"><label>Entregador</label><select id="acEnt"><option value="">Todos os entregadores</option>'+
    (DB.entregadores||[]).map(function(e){return '<option value="'+e.id+'"'+(AC.ent===e.id?' selected':'')+'>'+E(e.nome)+'</option>'}).join('')+
   '</select></div>'+
   '<div class="fl gw2"><label>Buscar</label><input id="acBusca" placeholder="nome do entregador" value="'+E(AC.busca)+'"></div>'+
   '<button class="btnP2 ok" onclick="aplicarFiltroAc()">'+sv('search',14)+' Buscar</button>'+
   '<button class="btnP2" onclick="limparFiltroAc()">Limpar</button>'+
  '</div>'+

  '<div class="kpiRow">'+
   '<div class="kpi2"><span>Entregadores</span><b>'+lista.length+'</b></div>'+
   '<div class="kpi2"><span>Entregas no período</span><b>'+totQtd+'</b></div>'+
   '<div class="kpi2 dest2"><span>Total a pagar</span><b>R$ '+money(totPagar)+'</b></div>'+
  '</div>'+

  '<div class="entWrap">'+
  (lista.length?cards
   :'<div class="entVazio">'+
    (DB.entregadores.length?'Nenhum entregador encontrado com esse filtro.'
     :'<b>Nenhum entregador cadastrado</b><span>Cadastre o entregador e todas as entregas passam a ser vinculadas a ele automaticamente.</span>')+
    '</div>')+
  '</div>'+

  historicoAcertos()+
  '</div>';

  $('acDe').onchange=function(){AC.de=this.value};
  $('acAte').onchange=function(){AC.ate=this.value};
  $('acEnt').onchange=function(){AC.ent=this.value};
  $('acBusca').oninput=function(){AC.busca=this.value};
  rodape(DB.entregadores.length+' entregadores');
}
function aplicarFiltroAc(){telaAcertos();}
function limparFiltroAc(){AC={de:diasAtrasISO(7),ate:hojeISO(),ent:'',busca:''};telaAcertos();}

function pendentesSemEntregador(){
  var lista=(DB.pedidos||[]).filter(function(p){
    if(!ehEntrega(p)||ehCancelado(p)||p.acertoId)return false;
    if(p.entregadorId)return false;
    var d=diaLocal(p.data);
    if(AC.de&&d<AC.de)return false;
    if(AC.ate&&d>AC.ate)return false;
    return true;
  });
  if(!lista.length)return '';
  return '<div class="pnl2" style="border-color:#F0DCB4">'+
  '<div class="pnl2H" style="background:var(--amber-soft);color:#8A5B08">'+
  'Entregas sem entregador definido <span class="cnt2">'+lista.length+'</span></div>'+
  '<div class="pnl2B" style="padding:0">'+
  '<div style="padding:12px 14px 0;display:flex;gap:9px;align-items:center;flex-wrap:wrap">'+'<span class="hint" style="flex:1;min-width:200px">Estas entregas não entram em nenhum acerto até você informar quem entregou.</span>'+(entregadorPadrao()?'<button class="btnP2 ok" onclick="vincularTodas()">'+sv('moto',13)+' Vincular todas a '+E(entregadorPadrao().nome)+'</button>':'')+'</div>'+
  '<table class="pTable finTab"><thead><tr>'+
  '<th style="width:80px">Pedido</th><th style="width:110px">Data</th><th>Cliente</th>'+
  '<th style="width:150px">Cidade</th><th style="text-align:right;width:110px">Venda</th>'+
  '<th style="text-align:right;width:100px">Taxa</th><th style="width:150px"></th></tr></thead><tbody>'+
  lista.map(function(p){
    var cli=(DB.clientes||[]).find(function(c){return c.id===p.clienteId})||{};
    return '<tr><td><b>#'+p.numero+'</b></td><td>'+dataBR(p.data)+'</td>'+
    '<td>'+E(p.clienteNome)+'</td><td>'+E(p.cidade||cli.cidade||'—')+'</td>'+
    '<td style="text-align:right">R$ '+money(p.total)+'</td>'+
    '<td style="text-align:right">R$ '+money(taxaPedido(entregadorPadrao(),p))+'</td>'+
    '<td><button class="btnP2" onclick="atribuirEntregador(\''+p.id+'\',1)">'+sv('moto',13)+' Definir entregador</button></td></tr>';
  }).join('')+'</tbody></table></div></div>';
}

async function tirarDoAcerto(pedId,entId){
  var p=(DB.pedidos||[]).find(function(x){return x.id===pedId});
  if(!p)return;
  if(!await pergunta('Remover o pedido #'+p.numero+' deste acerto?\n\nEle deixa de contar para o entregador.'))return;
  p.entregadorId=null;
  salvar();fecharModal();telaAcertoDet(entId);
  toast('Pedido #'+p.numero+' removido do acerto.');
}

function vincularTodas(){
  var e=entregadorPadrao();
  if(!e){toast('Cadastre um entregador antes.');return;}
  var n=vincularPendentes(e.id);
  salvar();telaAcertos();
  toast(n?n+' entrega(s) vinculada(s) a '+e.nome+'.':'Nenhuma entrega pendente.');
}

function historicoAcertos(){
  var ac=(DB.acertos||[]).slice().reverse();
  if(!ac.length)return '';
  return '<div class="pnl2"><div class="pnl2H">Acertos realizados <span class="cnt2">'+ac.length+'</span></div>'+
  '<div class="pnl2B" style="padding:0"><table class="pTable finTab"><thead><tr>'+
  '<th style="width:110px">Data</th><th>Entregador</th><th style="width:170px">Período</th>'+
  '<th style="text-align:center;width:90px">Entregas</th><th style="text-align:right;width:120px">Pago</th>'+
  '<th style="width:180px">Conta</th><th style="width:60px"></th></tr></thead><tbody>'+
  ac.slice(0,15).map(function(a){
    var e=ent(a.entregadorId),c=(DB.contas||[]).find(function(x){return x.id===a.contaId});
    return '<tr><td>'+dataBR(a.data)+'</td><td><b>'+E(e?e.nome:'—')+'</b></td>'+
    '<td>'+dataBR(a.de)+' a '+dataBR(a.ate)+'</td>'+
    '<td style="text-align:center">'+(a.pedidos||[]).length+'</td>'+
    '<td style="text-align:right"><b>R$ '+money(a.pago)+'</b></td>'+
    '<td>'+E(c?c.nome:'—')+'</td>'+
    '<td><button class="rBtn" onclick="verAcerto(\''+a.id+'\')" title="Ver recibo">'+sv('eye',13)+'</button></td></tr>';
  }).join('')+'</tbody></table></div></div>';
}

function menuEntregador(ev,id){
  ev.stopPropagation();
  var e=ent(id);
  pop(ev,'<button onclick="modalEntregador(\''+id+'\');fecharPops()">'+sv('edit',15)+' Editar cadastro</button>'+
  '<button onclick="verEntregador(\''+id+'\');fecharPops()">'+sv('eye',15)+' Ver ficha completa</button>'+
  (e.padrao?'':'<button onclick="tornarPadrao(\''+id+'\');fecharPops()">'+sv('moto',15)+' Tornar entregador padrão</button>')+
  '<div class="popSep"></div>'+
  '<button class="rd" onclick="excluirEntregador(\''+id+'\');fecharPops()">'+sv('trash',15)+' Excluir entregador</button>');
}
function tornarPadrao(id){
  DB.entregadores.forEach(function(x){x.padrao=(x.id===id)});
  var n=vincularPendentes(id);
  salvar();telaAcertos();
  toast(ent(id).nome+' agora é o padrão.'+(n?' '+n+' entrega(s) vinculada(s).':''));
}
async function excluirEntregador(id){
  var e=ent(id);
  var pend=(DB.pedidos||[]).filter(function(p){return p.entregadorId===id&&!p.acertoId}).length;
  if(pend){toast('Este entregador tem '+pend+' entrega(s) sem acerto. Faça o acerto ou remova as entregas antes.');return;}
  if(!await pergunta('Excluir o entregador "'+e.nome+'"?\n\nOs acertos já realizados continuam no histórico.'))return;
  DB.entregadores=DB.entregadores.filter(function(x){return x.id!==id}); declararExclusao('entregadores',id); /* exclusao declarada: so isto autoriza apagar da nuvem (V201) */
  salvar();telaAcertos();toast('Entregador excluído.');
}
function verEntregador(id){
  var e=ent(id);
  var r=resumoEntregador(e,AC.de,AC.ate);
  var h='<div class="mdB">'+
  '<div class="acHead"><div class="av3" style="width:44px;height:44px;font-size:17px">'+E(e.nome.charAt(0).toUpperCase())+'</div>'+
  '<div><b>'+E(e.nome)+(e.padrao?' <span class="badge2 gr">padrão</span>':'')+'</b>'+
  '<span>'+E(e.tel||'sem telefone')+(e.cpf?' · CPF '+E(e.cpf):'')+'</span>'+
  (e.pix?'<span>Pix: '+E(e.pix)+'</span>':'')+'</div></div>'+
  '<div class="blk" style="margin:0 0 11px;max-width:none;padding:0;overflow:hidden">'+
  '<div class="acTit">Taxa por cidade</div><div class="acTabW"><table class="acTab"><tbody>'+
  ((e.taxas||[]).length?e.taxas.map(function(t){
    return '<tr><td>'+E(t.cidade)+'</td><td style="text-align:right;width:130px"><b>R$ '+money(t.valor)+'</b></td></tr>';
  }).join(''):'<tr><td class="hint" style="padding:16px">Nenhuma cidade cadastrada.</td></tr>')+
  '</tbody></table></div></div>'+
  '<div class="blk" style="margin:0 0 11px;max-width:none;padding:0;overflow:hidden">'+
  '<div class="acTit">Diária por dia da semana</div><div class="acTabW"><table class="acTab"><tbody>'+
  DIASEM.map(function(d,i){
    var v=(e.diarias&&e.diarias[i])||0;
    return '<tr><td>'+d+'</td><td style="text-align:right;width:130px"'+(v?'':' class="hint"')+'><b>R$ '+money(v)+'</b></td></tr>';
  }).join('')+'</tbody></table></div></div>'+
  '<div class="acKpis"><div class="acK"><span>Entregas no período</span><b>'+r.qtd+'</b></div>'+
  '<div class="acK dest3"><span>A pagar</span><b>R$ '+money(r.aPagar)+'</b></div></div></div>';
  var o=document.createElement('div');o.className='mdOv';o.id='mdOv';
  o.innerHTML='<div class="mdBox"><div class="mdH"><b>Ficha do entregador</b>'+
  '<button onclick="fecharModal()">&times;</button></div>'+h+
  '<div class="mdF"><button class="btnP2" onclick="fecharModal()">Fechar</button>'+
  '<button class="btnP2 ok" onclick="modalEntregador(\''+id+'\')">'+sv('edit',13)+' Editar cadastro</button></div></div>';
  document.body.appendChild(o);
  o.onclick=function(ev){if(ev.target===o)fecharModal();};
}

/* ---------- CADASTRO DE ENTREGADOR ---------- */
var _taxasTmp=[];
function modalEntregador(id){
  fecharModal();
  baseFin();
  var e=id?ent(id):null;
  _taxasTmp=e&&e.taxas?JSON.parse(JSON.stringify(e.taxas)):[];
  var h='<div class="mdB">'+
  '<div class="blk" style="margin:0 0 11px;max-width:none"><h3>Dados do entregador</h3>'+
  '<div class="row2"><div class="fld2"><label>Nome *</label><input id="enN" value="'+E(e?e.nome:'')+'"></div>'+
  '<div class="fld2"><label>Telefone</label><input id="enT" value="'+E(e?e.tel:'')+'" placeholder="(00) 00000-0000"></div></div>'+
  '<div class="row2"><div class="fld2" style="margin:0"><label>CPF</label><input id="enC" value="'+E(e?e.cpf:'')+'" placeholder="000.000.000-00"></div>'+
  '<div class="fld2" style="margin:0"><label>Chave Pix</label><input id="enP" value="'+E(e?e.pix:'')+'" placeholder="para pagamento"></div></div>'+
  '</div>'+
  '<div class="blk" style="margin:0 0 11px;max-width:none"><h3>Valor da diária por dia da semana <small>pode variar por dia</small></h3>'+
  '<div class="diaGrid">'+DIASEM.map(function(d,i){
    var v=(e&&e.diarias&&e.diarias[i])||0;
    return '<div class="diaFld"><label>'+d+'</label><div class="cur"><span>R$</span>'+
    '<input type="number" step="0.01" class="enD" data-d="'+i+'" value="'+v+'"></div></div>';}).join('')+
  '</div><div class="hint" style="margin-top:9px">A diária é somada apenas nos dias em que ele registrou entregas no período.</div></div>'+
  '<div class="blk" style="margin:0 0 11px;max-width:none"><h3>Vínculo com as entregas</h3>'+
  '<label class="optCard"><input type="checkbox" id="enPad" '+((e&&e.padrao)||!DB.entregadores.length?'checked':'')+'>'+
  '<span><b>Interligar este entregador às entregas</b>'+
  '<span>Ao salvar, todas as entregas que estão sem entregador passam para ele. '+
  'E as próximas vendas de entrega já vêm com ele selecionado. Você pode trocar em qualquer pedido.</span></span></label>'+
  '</div>'+
  '<div class="blk" style="margin:0;max-width:none"><h3>Taxa de entrega por cidade <small>o valor muda conforme a cidade</small></h3>'+
  '<div id="taxasBox"></div>'+
  '<button class="btnP2" onclick="addTaxa()" style="margin-top:8px">'+sv('plus',13)+' Adicionar cidade</button>'+
  '<div class="hint" style="margin-top:9px">Quando o pedido já tiver taxa lançada no PDV, ela tem prioridade sobre esta tabela.</div></div>'+
  '</div>';
  modal(e?'Editar entregador':'Cadastrar entregador',h,'Salvar',function(){
    var nome=$('enN').value.trim();
    if(!nome){toast('Informe o nome do entregador.');return false;}
    lerTaxas();
    var di={};
    var ds=document.querySelectorAll('.enD');
    for(var i=0;i<ds.length;i++)di[ds[i].getAttribute('data-d')]=parseFloat(ds[i].value)||0;
    var pad=$('enPad').checked;
    var o={nome:nome,tel:$('enT').value.trim(),cpf:$('enC').value.trim(),pix:$('enP').value.trim(),
           diarias:di,taxas:_taxasTmp.filter(function(t){return t.cidade&&t.cidade.trim()}),
           padrao:pad,ativo:true};
    var alvo;
    if(e){Object.assign(e,o);alvo=e;}
    else{o.id=uid('ent');DB.entregadores.push(o);alvo=o;}
    var n=0;
    if(pad){
      DB.entregadores.forEach(function(x){if(x.id!==alvo.id)x.padrao=false});
      n=vincularPendentes(alvo.id);
    }
    salvar();telaAcertos();
    toast('Entregador salvo.'+(n?' '+n+' entrega(s) vinculada(s) a ele.':''));
    return true;
  },'lg');
  renderTaxas();
}
function renderTaxas(){
  var b=$('taxasBox');if(!b)return;
  baseAreas();
  var cid=nomesCidadesEntrega();
  b.innerHTML=(_taxasTmp.length?_taxasTmp.map(function(t,i){
    return '<div class="opRow">'+
    (cid.length
      ?'<select class="txC">'+
       '<option value="">Selecione a cidade</option>'+
       cid.map(function(c){
         return '<option value="'+E(c)+'"'+(String(t.cidade||'').toLowerCase()===c.toLowerCase()?' selected':'')+'>'+
         E(c)+'</option>';}).join('')+
       (t.cidade&&cid.map(function(c){return c.toLowerCase()}).indexOf(String(t.cidade).toLowerCase())<0
         ?'<option value="'+E(t.cidade)+'" selected>'+E(t.cidade)+' (fora das áreas)</option>':'')+
       '</select>'
      :'<input value="'+E(t.cidade)+'" placeholder="cidade" class="txC">')+
    '<div class="cur" style="width:130px"><span>R$</span><input type="text" inputmode="decimal" autocomplete="off" placeholder="0,00" class="moeda txV" value="'+((t.valor||0)?money(t.valor):'')+'"></div>'+
    '<button onclick="remTaxa('+i+')">'+sv('trash',13)+'</button></div>';}).join('')
    :'<div class="hint">Nenhuma cidade nesta lista.</div>')+
   (cid.length
    ?'<div class="hint" style="margin-top:7px">As cidades vêm de <b>Configuração da Loja › Áreas de Entrega</b>. '+
     'Aqui você define quanto o <b>entregador recebe</b> por entrega em cada cidade — '+
     'a taxa cobrada do cliente é a das Áreas de Entrega.</div>'
    :'<div class="hint" style="margin-top:7px">Cadastre as cidades em '+
     '<b>Configuração da Loja › Áreas de Entrega</b> para escolhê-las aqui.</div>');
}
function lerTaxas(){
  var c=document.querySelectorAll('.txC'),v=document.querySelectorAll('.txV');
  _taxasTmp=[];for(var i=0;i<c.length;i++)_taxasTmp.push({cidade:c[i].value,valor:moedaValor(v[i])});
}
function addTaxa(){lerTaxas();_taxasTmp.push({cidade:'',valor:0});renderTaxas();}
function puxarCidadesAreas(){
  lerTaxas();
  baseAreas();
  var jaTem={};
  _taxasTmp.forEach(function(t){jaTem[String(t.cidade||'').toLowerCase()]=true});
  var n=0;
  nomesCidadesEntrega().forEach(function(c){
    if(jaTem[c.toLowerCase()])return;
    var a=(DB.areas||[]).find(function(x){return x.nome===c});
    _taxasTmp.push({cidade:c,valor:Number(a&&a.taxaPadrao)||0});
    n++;
  });
  renderTaxas();
  toast(n?n+' cidade(s) trazida(s) das Áreas de Entrega.':'Todas as cidades já estão na lista.');
}
function remTaxa(i){lerTaxas();_taxasTmp.splice(i,1);renderTaxas();}

function valorCidade(cidade){
  if(!cidade)return 0;
  var a=cidadesEntrega().find(function(x){return x.cidade.toLowerCase()===String(cidade).trim().toLowerCase()});
  return a?a.valor:0;
}
function entregadorPadrao(){
  return (DB.entregadores||[]).find(function(x){return x.padrao})||(DB.entregadores||[])[0]||null;
}
function taxaPorCidade(e,cidade){
  if(!e||!cidade)return 0;
  var t=(e.taxas||[]).find(function(x){return (x.cidade||'').trim().toLowerCase()===cidade.trim().toLowerCase()});
  return t?Number(t.valor)||0:0;
}
/* passa todas as entregas sem entregador para este entregador */
function vincularPendentes(entId){
  var e=ent(entId);var n=0;
  (DB.pedidos||[]).forEach(function(p){
    if(!ehEntrega(p)||ehCancelado(p)||p.acertoId||p.entregadorId)return;
    p.entregadorId=entId;n++;
    if(!p.cidade){
      var cli=(DB.clientes||[]).find(function(c){return c.id===p.clienteId})||{};
      if(cli.cidade)p.cidade=cli.cidade;
    }
  });
  return n;
}

/* histórico dia a dia do entregador, com situação de pagamento */
function historicoDias(e,de,ate){
  var todas=entregasDe(e.id,de,ate,true);
  var mapa={};
  todas.forEach(function(p){
    var d=diaLocal(p.data);
    if(!mapa[d])mapa[d]={dia:d,qtd:0,taxas:0,vendas:0,pagos:0,pend:0,acertoId:null};
    var m=mapa[d];
    m.qtd++;m.taxas+=taxaPedido(e,p);m.vendas+=Number(p.total)||0;
    if(p.acertoId){m.pagos++;m.acertoId=p.acertoId;}else m.pend++;
  });
  return Object.keys(mapa).sort().reverse().map(function(d){
    var m=mapa[d];
    m.diaria=diariaDoDia(e,d);
    m.total=m.taxas+m.diaria;
    m.situacao=m.pend===0?'pago':(m.pagos>0?'parcial':'pendente');
    return m;
  });
}
function tabelaHistorico(e){
  var hist=historicoDias(e,AC.de,AC.ate);
  if(!hist.length)return '<div class="vazio2" style="padding:30px">Nenhum movimento no período selecionado.</div>';
  var tp=0,tt=0;
  var linhas=hist.map(function(m){
    var dt=new Date(m.dia+'T12:00:00');
    if(m.situacao==='pago')tp+=m.total; else tt+=m.total;
    var tag=m.situacao==='pago'?'<span class="stPg">Pago</span>'
           :m.situacao==='parcial'?'<span class="stPc">Parcial</span>'
           :'<span class="stAp">A pagar</span>';
    return '<tr class="lin-'+m.situacao+'">'+
    '<td><b>'+dataBR(m.dia)+'</b><small>'+DIASEM[dt.getDay()]+'</small></td>'+
    '<td style="text-align:center">'+m.qtd+'</td>'+
    '<td style="text-align:right">R$ '+money(m.taxas)+'</td>'+
    '<td style="text-align:right">R$ '+money(m.diaria)+'</td>'+
    '<td style="text-align:right;color:var(--ink-3)">R$ '+money(m.vendas)+'</td>'+
    '<td style="text-align:right"><b>R$ '+money(m.total)+'</b></td>'+
    '<td style="text-align:center">'+tag+'</td>'+
    '<td>'+(m.acertoId?'<button class="rBtn" onclick="verAcerto(\''+m.acertoId+'\')" title="Ver recibo">'+sv('eye',13)+'</button>':'')+'</td></tr>';
  }).join('');
  return '<div class="acTabW" style="max-height:320px"><table class="acTab histTab"><thead><tr>'+
  '<th style="width:120px">Dia</th><th style="width:70px;text-align:center">Entregas</th>'+
  '<th style="width:100px;text-align:right">Taxas</th><th style="width:100px;text-align:right">Diária</th>'+
  '<th style="width:110px;text-align:right">Vendas</th><th style="width:110px;text-align:right">Total do dia</th>'+
  '<th style="width:92px;text-align:center">Situação</th><th style="width:44px"></th></tr></thead><tbody>'+linhas+
  '</tbody><tfoot><tr><td colspan="5"><b>Totais do período</b></td>'+
  '<td style="text-align:right"><b>R$ '+money(tp+tt)+'</b></td>'+
  '<td colspan="2" style="text-align:center;font-size:11.5px">'+
  '<span class="stPg">pago R$ '+money(tp)+'</span> <span class="stAp">a pagar R$ '+money(tt)+'</span></td>'+
  '</tr></tfoot></table></div>';
}

/* ---------- TELA DE ACERTO DO ENTREGADOR ---------- */
function telaAcertoDet(entId){
  baseFin();
  var e=ent(entId);if(!e)return;
  var r=resumoEntregador(e,AC.de,AC.ate);

  var h='<div class="mdB">'+
  '<div class="acHead">'+
   '<div class="av3" style="width:44px;height:44px;font-size:17px">'+E(e.nome.charAt(0).toUpperCase())+'</div>'+
   '<div><b>'+E(e.nome)+'</b><span>'+E(e.tel||'sem telefone')+(e.cpf?' · CPF '+E(e.cpf):'')+'</span>'+
   '<span>Período: '+dataBR(AC.de)+' a '+dataBR(AC.ate)+'</span></div>'+
  '</div>'+

  '<div class="acKpis">'+
   '<div class="acK"><span>Entregas</span><b>'+r.qtd+'</b></div>'+
   '<div class="acK"><span>Taxas</span><b>R$ '+money(r.taxas)+'</b></div>'+
   '<div class="acK"><span>Diárias</span><b>R$ '+money(r.diaria)+'</b></div>'+
   '<div class="acK"><span>Vendas</span><b>R$ '+money(r.vendas)+'</b></div>'+
   '<div class="acK dest3"><span>A pagar</span><b>R$ '+money(r.aPagar)+'</b></div>'+
  '</div>'+

  '<div class="blk" style="margin:0 0 11px;max-width:none;padding:0;overflow:hidden">'+
   '<div class="acTit">Entregas do período</div>'+
   (r.qtd?'<div class="acTabW"><table class="acTab"><thead><tr>'+
    '<th style="width:64px">Pedido</th><th style="width:92px">Data</th><th style="width:58px">Hora</th>'+
    '<th>Cliente</th><th style="width:130px">Cidade</th>'+
    '<th style="width:96px;text-align:right">Venda</th>'+
    '<th style="width:104px;text-align:right">Taxa</th><th style="width:76px"></th></tr></thead><tbody>'+
    r.lista.map(function(p){
      var cid=cidadePedido(p);
      var org=origemTaxa(e,p);
      var dica=org==='cadastro'?'taxa da tabela do entregador'
              :org==='cidade'?'taxa da cidade (outro entregador)'
              :org==='pedido'?'taxa cobrada no pedido — cidade não cadastrada'
              :'sem taxa definida';
      return '<tr><td><b>#'+p.numero+'</b></td><td>'+dataBR(p.data)+'</td><td>'+p.hora+'</td>'+
      '<td>'+E(p.clienteNome)+'</td>'+
      '<td>'+(cid?'<span class="cidTag">'+E(cid)+'</span>':'<span style="color:var(--red);font-weight:600">sem cidade</span>')+'</td>'+
      '<td style="text-align:right">R$ '+money(p.total)+'</td>'+
      '<td style="text-align:right" title="'+dica+'"><b>R$ '+money(taxaPedido(e,p))+'</b>'+
      (org==='cadastro'?'':'<span class="alertaTx">!</span>')+'</td>'+
      '<td><button class="rBtn" onclick="verPedido(\''+p.id+'\')" title="Ver cupom">'+sv('eye',13)+'</button>'+
      '<button class="rBtn rd" onclick="tirarDoAcerto(\''+p.id+'\',\''+e.id+'\')" title="Remover deste acerto">'+sv('x2',13)+'</button></td></tr>';
    }).join('')+
    '</tbody><tfoot><tr><td colspan="5"><b>Total das taxas</b>'+
    '<div class="hint" style="font-weight:400;margin-top:3px">O <b>!</b> indica taxa que não veio da tabela do entregador — confira a cidade.</div></td>'+
    '<td style="text-align:right">R$ '+money(r.vendas)+'</td>'+
    '<td style="text-align:right"><b>R$ '+money(r.taxas)+'</b></td><td></td></tr></tfoot></table></div>'
    :'<div class="vazio2" style="padding:34px">Nenhuma entrega pendente neste período.</div>')+
  '</div>'+

  '<div class="blk" style="margin:0 0 11px;max-width:none;padding:0;overflow:hidden">'+
   '<div class="acTit">Histórico dia a dia — '+dataBR(AC.de)+' a '+dataBR(AC.ate)+'</div>'+
   tabelaHistorico(e)+
  '</div>'+
  (r.diasDet.length?'<div class="blk" style="margin:0;max-width:none;padding:0;overflow:hidden">'+
   '<div class="acTit">Diárias por dia trabalhado</div>'+
   '<div class="acTabW"><table class="acTab"><tbody>'+r.diasDet.map(function(d){
     var dt=new Date(d.dia+'T12:00:00');
     return '<tr><td>'+dataBR(d.dia)+' <span style="color:var(--ink-3)">· '+DIASEM[dt.getDay()]+'</span></td>'+
     '<td style="text-align:right;width:130px"><b>R$ '+money(d.valor)+'</b></td></tr>';}).join('')+
   '<tr><td><b>Total das diárias</b></td><td style="text-align:right"><b>R$ '+money(r.diaria)+'</b></td></tr>'+
   '</tbody></table></div></div>':'')+
  '</div>';

  var o=document.createElement('div');o.className='mdOv';o.id='mdOv';
  o.innerHTML='<div class="mdBox xl"><div class="mdH"><b>Acerto do entregador</b>'+
  '<button class="btnP2" onclick="imprimirRecibo(\''+entId+'\')">'+sv('print2',13)+' Imprimir</button>'+
  '<button onclick="fecharModal()" style="margin-left:8px">&times;</button></div>'+
  h+
  '<div class="mdF"><button class="btnP2" onclick="fecharModal()">Fechar</button>'+
  '<button class="btnP2 ok" onclick="modalRealizarAcerto(\''+entId+'\')"'+(r.qtd?'':' disabled style="opacity:.45"')+'>'+
  sv('cash',14)+' Realizar acerto — R$ '+money(r.aPagar)+'</button></div></div>';
  document.body.appendChild(o);
  o.onclick=function(ev){if(ev.target===o)fecharModal();};
}

/* ---------- REALIZAR ACERTO ---------- */
function modalRealizarAcerto(entId){
  fecharModal();
  var e=ent(entId);
  var r=resumoEntregador(e,AC.de,AC.ate);
  var h='<div class="mdB">'+
  '<div class="blk" style="margin:0 0 11px;max-width:none"><h3>Resumo do acerto</h3>'+
  '<div class="linha"><span>Entregas ('+r.qtd+')</span><b>R$ '+money(r.taxas)+'</b></div>'+
  '<div class="linha"><span>Diárias</span><b>R$ '+money(r.diaria)+'</b></div>'+
  '<div class="linha"><span>Subtotal</span><b>R$ '+money(r.aPagar)+'</b></div>'+
  '<div class="row2" style="margin-top:12px">'+
  '<div class="fld2" style="margin:0"><label>Descontos (adiantamento, avaria)</label>'+
  '<div class="cur"><span>R$</span><input type="text" inputmode="decimal" autocomplete="off" placeholder="0,00" class="moeda" id="acDesc" value=""></div></div>'+
  '<div class="fld2" style="margin:0"><label>Acréscimos (ajuda de custo)</label>'+
  '<div class="cur"><span>R$</span><input type="text" inputmode="decimal" autocomplete="off" placeholder="0,00" class="moeda" id="acAcr" value=""></div></div></div>'+
  '<div class="linha tot"><span>Valor a pagar</span><span id="acTot">R$ '+money(r.aPagar)+'</span></div></div>'+

  '<div class="blk" style="margin:0 0 11px;max-width:none"><h3>Conta de saída do dinheiro</h3>'+
  '<div class="hint" style="margin-bottom:10px">O valor é debitado desta conta e lançado no financeiro como <b>Acerto com entregadores</b>.</div>'+
  '<div class="contaGrid">'+(DB.contas||[]).map(function(c,i){
    var b=c.fixa?null:banco(c.banco);
    var cor=c.fixa==='caixa'?'#0E8A46':c.fixa==='cofre'?'#5C6B80':(b?b.c:'#5C6B80');
    var sig=c.fixa==='caixa'?'CX':c.fixa==='cofre'?'CO':(b?b.s:'$');
    return '<label class="contaBox"><input type="radio" name="ctA" value="'+c.id+'"'+(i===0?' checked':'')+'>'+
    '<span class="bcoIc" style="background:'+cor+'">'+sig+'</span>'+
    '<span><b>'+E(c.nome)+'</b><small>saldo R$ '+money(saldoConta(c))+'</small></span></label>';}).join('')+
  '</div></div>'+

  '<div class="blk" style="margin:0;max-width:none">'+
  '<div class="row2"><div class="fld2" style="margin:0"><label>Data do pagamento</label>'+
  '<input id="acData" type="date" value="'+hojeISO()+'"></div>'+
  '<div class="fld2" style="margin:0"><label>Forma</label><select id="acForma">'+
  '<option>Dinheiro</option><option>Pix</option><option>Transferência</option></select></div></div>'+
  '<div class="fld2" style="margin:12px 0 0"><label>Observação</label><input id="acObs" placeholder="opcional"></div>'+
  '</div></div>';

  modal('Realizar acerto — '+e.nome,h,'Confirmar pagamento',function(){
    var desc=moedaValor('acDesc'), acr=moedaValor('acAcr');
    var pago=r.aPagar-desc+acr;
    if(pago<0){toast('O valor a pagar ficou negativo. Revise os descontos.');return false;}
    var ctSel=document.querySelector('input[name=ctA]:checked');
    if(!ctSel){toast('Selecione a conta de saída.');return false;}
    var conta=(DB.contas||[]).find(function(x){return x.id===ctSel.value});
    var ag=$('acData').value||hojeISO();

    var ac={id:uid('ac'),entregadorId:entId,de:AC.de,ate:AC.ate,
      pedidos:r.lista.map(function(p){return p.id}),
      qtd:r.qtd,taxas:r.taxas,diaria:r.diaria,vendas:r.vendas,
      descontos:desc,acrescimos:acr,pago:pago,
      contaId:conta.id,forma:$('acForma').value,obs:$('acObs').value,data:ag};
    DB.acertos.push(ac);

    r.lista.forEach(function(p){p.acertoId=ac.id});
    conta.saldo=(Number(conta.saldo)||0)-pago;

    DB.lancFin=DB.lancFin||[];
    DB.lancFin.push({id:uid('lf'),tipo:'despesa',contaId:conta.id,metodoId:'',
      descricao:'Acerto com entregador — '+e.nome+' ('+r.qtd+' entregas)',
      fornecedor:e.nome,documento:'',categoriaTxt:'Acerto com entregadores',
      valor:pago,emissao:ag,vencimento:ag,pagamento:ag,pago:true,
      ref:ac.id,origem:'acerto-entregadores'});

    salvar();
    telaAcertos();
    toast('Acerto de R$ '+money(pago)+' pago via '+conta.nome+'. Lançado no financeiro.');
    setTimeout(function(){
      pergunta('Pagamento registrado.\nImprimir o recibo para o entregador assinar?','Imprimir recibo','pergunta')
        .then(function(v){ if(v)reciboPago(ac.id); });
    },250);
    return true;
  },'lg');

  function rec(){
    var d=moedaValor('acDesc'),a=moedaValor('acAcr');
    $('acTot').textContent='R$ '+money(r.aPagar-d+a);
  }
  $('acDesc').oninput=rec;$('acAcr').oninput=rec;
}

function verAcerto(id){
  var a=(DB.acertos||[]).find(function(x){return x.id===id});
  var e=ent(a.entregadorId),c=(DB.contas||[]).find(function(x){return x.id===a.contaId});
  var h='<div class="mdB"><div class="blk" style="margin:0;max-width:none">'+
  '<h3>Recibo de acerto <small>'+dataBR(a.data)+'</small></h3>'+
  '<div class="linha"><span>Entregador</span><b>'+E(e?e.nome:'—')+'</b></div>'+
  (e&&e.cpf?'<div class="linha"><span>CPF</span><b>'+E(e.cpf)+'</b></div>':'')+
  '<div class="linha"><span>Período</span><b>'+dataBR(a.de)+' a '+dataBR(a.ate)+'</b></div>'+
  '<div class="linha"><span>Entregas</span><b>'+a.qtd+'</b></div>'+
  '<div class="linha"><span>Taxas</span><b>R$ '+money(a.taxas)+'</b></div>'+
  '<div class="linha"><span>Diárias</span><b>R$ '+money(a.diaria)+'</b></div>'+
  (a.descontos?'<div class="linha"><span>Descontos</span><b>- R$ '+money(a.descontos)+'</b></div>':'')+
  (a.acrescimos?'<div class="linha"><span>Acréscimos</span><b>+ R$ '+money(a.acrescimos)+'</b></div>':'')+
  '<div class="linha tot"><span>Valor pago</span><span>R$ '+money(a.pago)+'</span></div>'+
  '<div class="linha" style="margin-top:9px"><span>Conta</span><b>'+E(c?c.nome:'—')+' · '+E(a.forma||'')+'</b></div>'+
  (a.obs?'<div class="hint" style="margin-top:8px">'+E(a.obs)+'</div>':'')+
  '</div></div>';
  var o=document.createElement('div');o.className='mdOv';o.id='mdOv';
  o.innerHTML='<div class="mdBox"><div class="mdH"><b>Acerto realizado</b>'+
  '<button onclick="fecharModal()">&times;</button></div>'+h+
  '<div class="mdF"><button class="btnP2" onclick="fecharModal()">Fechar</button>'+
  '<button class="btnP2 ok" onclick="reciboPago(\''+id+'\')">'+sv('print2',13)+' Imprimir recibo</button></div></div>';
  document.body.appendChild(o);
  o.onclick=function(ev){if(ev.target===o)fecharModal();};
}

/* ---------- IMPRESSÃO ---------- */
function reciboPago(acId){
  var a=(DB.acertos||[]).find(function(x){return x.id===acId});
  if(!a)return;
  var e=ent(a.entregadorId),c=(DB.contas||[]).find(function(x){return x.id===a.contaId});
  var el=document.getElementById('viaImp')||document.createElement('div');
  el.id='viaImp';
  el.innerHTML=
  '<div style="text-align:center"><b>RECIBO DE PAGAMENTO</b><br>Acerto de entregas</div>'+
  '<hr>'+
  '<div>Entregador: <b>'+E(e?e.nome:'—')+'</b></div>'+
  (e&&e.cpf?'<div>CPF: '+E(e.cpf)+'</div>':'')+
  (e&&e.tel?'<div>Telefone: '+E(e.tel)+'</div>':'')+
  '<div>Período: '+dataBR(a.de)+' a '+dataBR(a.ate)+'</div>'+
  '<div>Data do pagamento: '+dataBR(a.data)+'</div>'+
  '<hr>'+
  '<div>Entregas realizadas: '+a.qtd+'</div>'+
  '<div>Total das taxas: R$ '+money(a.taxas)+'</div>'+
  '<div>Total das diárias: R$ '+money(a.diaria)+'</div>'+
  (a.descontos?'<div>Descontos: - R$ '+money(a.descontos)+'</div>':'')+
  (a.acrescimos?'<div>Acréscimos: + R$ '+money(a.acrescimos)+'</div>':'')+
  '<hr>'+
  '<div style="font-size:15px;text-align:center"><b>VALOR PAGO: R$ '+money(a.pago)+'</b></div>'+
  '<div style="text-align:center">'+E(a.forma||'')+' · '+E(c?c.nome:'')+'</div>'+
  '<hr>'+
  '<div style="font-size:11px">Declaro ter recebido a quantia acima, referente às entregas do período informado.</div>'+
  '<br><br><br>'+
  '<div style="text-align:center">_________________________________________</div>'+
  '<div style="text-align:center">'+E(e?e.nome:'')+(e&&e.cpf?'<br>CPF '+E(e.cpf):'')+'</div>'+
  '<br><div style="text-align:center;font-size:10px">JOIA · emitido em '+new Date().toLocaleString('pt-BR')+'</div>';
  document.body.appendChild(el);
  setTimeout(function(){window.print()},150);
}

function imprimirRecibo(entId){
  var e=ent(entId),r=resumoEntregador(e,AC.de,AC.ate);
  var el=document.getElementById('viaImp')||document.createElement('div');
  el.id='viaImp';
  el.innerHTML='<div style="text-align:center"><b>JOIA — ACERTO DE ENTREGAS</b><br>'+
  dataBR(AC.de)+' a '+dataBR(AC.ate)+'</div><hr>'+
  '<div>Entregador: '+E(e.nome)+'</div>'+(e.cpf?'<div>CPF: '+E(e.cpf)+'</div>':'')+
  '<div>Telefone: '+E(e.tel||'—')+'</div><hr>'+
  r.lista.map(function(p){
    return '#'+p.numero+' '+dataBR(p.data)+' '+p.hora+' — '+E(p.clienteNome)+
    ' — taxa R$ '+money(taxaPedido(e,p));}).join('<br>')+
  '<hr>Entregas: '+r.qtd+'<br>Taxas: R$ '+money(r.taxas)+'<br>Diárias: R$ '+money(r.diaria)+
  '<br><b>TOTAL A PAGAR: R$ '+money(r.aPagar)+'</b><hr>'+
  '<br><br>_______________________________<br>Assinatura do entregador';
  document.body.appendChild(el);
  setTimeout(function(){window.print()},150);
}
function imprimirAcertos(){
  var el=document.getElementById('viaImp')||document.createElement('div');
  el.id='viaImp';
  el.innerHTML='<div style="text-align:center"><b>JOIA — ACERTOS</b><br>'+dataBR(AC.de)+' a '+dataBR(AC.ate)+'</div><hr>'+
  (DB.entregadores||[]).map(function(e){
    var r=resumoEntregador(e,AC.de,AC.ate);
    return E(e.nome)+' — '+r.qtd+' entregas — R$ '+money(r.aPagar);}).join('<br>');
  document.body.appendChild(el);
  setTimeout(function(){window.print()},150);
}

/* ---------- ATRIBUIR ENTREGADOR AO PEDIDO ---------- */
function atribuirEntregador(pedId,voltarAcerto){
  baseFin();
  var p=(DB.pedidos||[]).find(function(x){return x.id===pedId});
  if(!DB.entregadores.length){toast('Cadastre um entregador antes.');return;}
  var h='<div class="mdB"><div class="blk" style="margin:0;max-width:none">'+
  '<h3>Pedido #'+p.numero+' <small>'+E(p.clienteNome)+'</small></h3>'+
  '<div class="contaGrid">'+DB.entregadores.map(function(e,i){
    return '<label class="contaBox"><input type="radio" name="entP" value="'+e.id+'"'+
    ((p.entregadorId===e.id)||(!p.entregadorId&&i===0)?' checked':'')+'>'+
    '<span><b>'+E(e.nome)+'</b><small>'+E(e.tel||'')+'</small></span></label>';}).join('')+
  '</div></div></div>';
  modal('Atribuir entregador',h,'Confirmar',function(){
    var sel=document.querySelector('input[name=entP]:checked');
    if(!sel)return false;
    p.entregadorId=sel.value;
    if(!p.cidade){
      var cli=(DB.clientes||[]).find(function(c){return c.id===p.clienteId})||{};
      if(cli.cidade)p.cidade=cli.cidade;
    }
    salvar();
    if(voltarAcerto)telaAcertos(); else renderKanban();
    toast('Entrega atribuída a '+ent(sel.value).nome+'.');
    return true;
  });
}

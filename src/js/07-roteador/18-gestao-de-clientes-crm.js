/* ==========================================================
   BLOCO 18 — GESTÃO DE CLIENTES (CRM)
   ========================================================== */
var CR={busca:'',periodo:'',bairro:'',modo:'compraram',aniv:false,ordem:'gasto'};

function baseCRM(){
  DB.clientes=DB.clientes||[];
  DB.fiadoMov=DB.fiadoMov||[];
  DB.cupons=DB.cupons||[];
  DB.cupomUsos=DB.cupomUsos||[];
  DB.clientes.forEach(function(c){
    if(c.saldoFiado===undefined)c.saldoFiado=0;
    if(c.limiteFiado===undefined)c.limiteFiado=0;
  });
}
function pedidosDoCliente(id){
  return (DB.pedidos||[]).filter(function(p){return p.clienteId===id&&!ehCancelado(p)})
    .sort(function(a,b){return (b.data||'').localeCompare(a.data||'')});
}
function statsCliente(c){
  var ps=pedidosDoCliente(c.id);
  var tot=ps.reduce(function(a,p){return a+(Number(p.total)||0)},0);
  var dias={},prods={};
  ps.forEach(function(p){
    var d=new Date(diaLocal(p.data)+'T12:00:00');
    if(!isNaN(d))dias[d.getDay()]=(dias[d.getDay()]||0)+1;
    (p.itens||[]).forEach(function(it){
      prods[it.nome]=(prods[it.nome]||0)+(Number(it.qtd)||1);
    });
  });
  var diaTop='',maxD=0;
  Object.keys(dias).forEach(function(k){if(dias[k]>maxD){maxD=dias[k];diaTop=DIASEM[k]}});
  var prodTop='',maxP=0;
  Object.keys(prods).forEach(function(k){if(prods[k]>maxP){maxP=prods[k];prodTop=k}});
  var ult=ps.length?diaLocal(ps[0].data):'';
  var dd=ult?Math.floor((new Date()-new Date(ult+'T12:00:00'))/86400000):null;
  return {ps:ps,qtd:ps.length,total:tot,ticket:ps.length?tot/ps.length:0,
          ultima:ult,diasSem:dd,diaTop:diaTop,prodTop:prodTop,prods:prods};
}
function bairrosCadastrados(){
  var m={};
  (DB.clientes||[]).forEach(function(c){if(c.bairro)m[c.bairro]=1});
  return Object.keys(m).sort();
}
function telaClientes(){
  baseCRM();
  var hoje=new Date();
  var lista=(DB.clientes||[]).map(function(c){
    var s=statsCliente(c);
    return {c:c,s:s};
  }).filter(function(x){
    var c=x.c,s=x.s;
    if(CR.busca){
      var q=CR.busca.toLowerCase(),d=soDigitos(CR.busca);
      var achou=(c.nome||'').toLowerCase().indexOf(q)>=0||
        (d&&soDigitos(c.tel).indexOf(d)>=0)||
        (c.cpf&&soDigitos(c.cpf).indexOf(d)>=0);
      if(!achou)return false;
    }
    if(CR.bairro&&c.bairro!==CR.bairro)return false;
    if(CR.aniv){
      if(!c.nascimento)return false;
      if(Number(c.nascimento.slice(5,7))!==hoje.getMonth()+1)return false;
    }
    if(CR.periodo){
      var n=Number(CR.periodo);
      if(CR.modo==='compraram'){ if(s.diasSem===null||s.diasSem>n)return false; }
      else { if(s.diasSem!==null&&s.diasSem<=n)return false; }
    }
    return true;
  }).sort(function(a,b){
    if(CR.ordem==='gasto')return b.s.total-a.s.total;
    if(CR.ordem==='pedidos')return b.s.qtd-a.s.qtd;
    if(CR.ordem==='recente')return (b.s.ultima||'').localeCompare(a.s.ultima||'');
    if(CR.ordem==='fiado')return (b.c.saldoFiado||0)-(a.c.saldoFiado||0);
    return (a.c.nome||'').localeCompare(b.c.nome||'');
  });

  var totGasto=lista.reduce(function(a,x){return a+x.s.total},0);
  var totFiado=(DB.clientes||[]).reduce(function(a,c){return a+(Number(c.saldoFiado)||0)},0);
  var ticketGeral=lista.reduce(function(a,x){return a+x.s.qtd},0);
  ticketGeral=ticketGeral?totGasto/ticketGeral:0;

  /* ==========================================================
     A LISTA DE CLIENTES FICAVA NUMA JANELINHA COM ROLAGEM PROPRIA

     Mesmo defeito da Frente de Caixa. `.finWrap` e uma coluna flexivel
     de altura fixa; o painel da lista, como item flexivel, ENCOLHE
     quando nao cabe — e o `overflow:auto` do corpo dele vira uma barra
     de rolagem minuscula dentro da pagina, com a tela vazia embaixo.
     Aqui e pior: o filtro tem cinco campos e ainda ha a faixa de
     numeros, entao sobravam duas linhas de cliente.

     `crTela` diz que nesta tela o painel NAO encolhe: ele cresce com o
     conteudo, vai de borda a borda e quem rola e a pagina inteira. A
     regra e a MESMA da Frente de Caixa, compartilhada — nao uma copia.
     ========================================================== */
  $('content').innerHTML='<div class="finWrap crTela">'+
  '<div class="finTop"><div><h1>Cadastro de Clientes</h1>'+
  '<p>Alimentado automaticamente pelas vendas do PDV. Identificação pelo telefone.</p></div>'+
  '<div class="finActs">'+
   '<button class="btnP2" onclick="exportarClientes()">'+sv('down2',14)+' Exportar</button>'+
   '<button class="btnP2 ok" onclick="fichaCliente()">'+sv('plus',14)+' Novo cliente</button></div></div>'+

  '<div class="filtroCard">'+
   '<div class="fl gw2"><label>Buscar por telefone, nome ou CPF</label>'+
    '<input id="crB" value="'+E(CR.busca)+'" placeholder="digite para filtrar"></div>'+
   '<div class="fl"><label>Situação</label><select onchange="CR.modo=this.value;telaClientes()">'+
    '<option value="compraram"'+(CR.modo==='compraram'?' selected':'')+'>Compraram nos últimos</option>'+
    '<option value="sem"'+(CR.modo==='sem'?' selected':'')+'>Sem comprar há mais de</option>'+
   '</select></div>'+
   '<div class="fl"><label>Período</label><select onchange="CR.periodo=this.value;telaClientes()">'+
    '<option value="">Todos</option>'+
    [15,30,60,90,120,180].map(function(d){
      return '<option value="'+d+'"'+(CR.periodo==String(d)?' selected':'')+'>'+d+' dias</option>'}).join('')+
   '</select></div>'+
   '<div class="fl"><label>Bairro</label><select onchange="CR.bairro=this.value;telaClientes()">'+
    '<option value="">Todos</option>'+
    bairrosCadastrados().map(function(b){
      return '<option'+(CR.bairro===b?' selected':'')+'>'+E(b)+'</option>'}).join('')+
   '</select></div>'+
   '<div class="fl"><label>Ordenar por</label><select onchange="CR.ordem=this.value;telaClientes()">'+
    '<option value="gasto"'+(CR.ordem==='gasto'?' selected':'')+'>Quem mais gastou</option>'+
    '<option value="pedidos"'+(CR.ordem==='pedidos'?' selected':'')+'>Quem mais comprou</option>'+
    '<option value="recente"'+(CR.ordem==='recente'?' selected':'')+'>Compra mais recente</option>'+
    '<option value="fiado"'+(CR.ordem==='fiado'?' selected':'')+'>Maior saldo fiado</option>'+
    '<option value="nome"'+(CR.ordem==='nome'?' selected':'')+'>Nome</option>'+
   '</select></div>'+
   '<button class="btnP2'+(CR.aniv?' ok':'')+'" onclick="CR.aniv=!CR.aniv;telaClientes()">'+
    sv('cake',13)+' Aniversariantes</button>'+
   '<button class="btnP2" onclick="limparCR()">Limpar</button>'+
  '</div>'+

  '<div class="kpiRow">'+
   '<div class="kpi2"><span>Clientes na lista</span><b>'+lista.length+'</b></div>'+
   '<div class="kpi2"><span>Consumo total</span><b>R$ '+money(totGasto)+'</b></div>'+
   '<div class="kpi2"><span>Ticket médio geral</span><b>R$ '+money(ticketGeral)+'</b></div>'+
   '<div class="kpi2'+(totFiado?' dest2':'')+'"><span>Fiado em aberto</span><b>R$ '+money(totFiado)+'</b></div>'+
  '</div>'+

  '<div class="pnl2"><div class="pnl2H">Clientes <span class="cnt2">'+lista.length+'</span></div>'+
  '<div class="pnl2B" style="padding:0">'+
  (lista.length?'<table class="pTable finTab tabCli"><thead><tr>'+
   '<th>Cliente</th><th style="width:130px">Bairro</th>'+
   '<th style="width:70px;text-align:center">Ped.</th>'+
   '<th style="width:110px;text-align:right">Consumo</th>'+
   '<th style="width:105px;text-align:right">Ticket</th>'+
   '<th style="width:120px">Última compra</th>'+
   '<th style="width:105px;text-align:right">Fiado</th>'+
   '<th style="width:56px"></th></tr></thead><tbody>'+
   lista.map(function(x){
     var c=x.c,s=x.s;
     return '<tr style="cursor:pointer" onclick="fichaCliente(\''+c.id+'\')">'+
     '<td><div class="cliNm"><div class="av3">'+E((c.nome||'?').charAt(0).toUpperCase())+'</div>'+
      '<div><b>'+E(c.nome)+'</b><small>'+E(c.tel||'sem telefone')+
      (c.nascimento?' · '+dataBR(c.nascimento).slice(0,5):'')+'</small></div></div></td>'+
     '<td>'+E(c.bairro||'—')+'</td>'+
     '<td style="text-align:center">'+s.qtd+'</td>'+
     '<td style="text-align:right"><b>R$ '+money(s.total)+'</b></td>'+
     '<td style="text-align:right">R$ '+money(s.ticket)+'</td>'+
     '<td>'+(s.ultima?dataBR(s.ultima)+'<small>há '+s.diasSem+' dias</small>':'<span style="color:var(--ink-3)">nunca comprou</span>')+'</td>'+
     '<td style="text-align:right">'+(c.saldoFiado?'<b class="vr">R$ '+money(c.saldoFiado)+'</b>':'—')+'</td>'+
     '<td><button class="rBtn" onclick="event.stopPropagation();fichaCliente(\''+c.id+'\')" title="Abrir ficha">'+
      sv('eye',12)+'</button></td></tr>';
   }).join('')+'</tbody></table>'
  :'<div class="entVazio"><b>Nenhum cliente encontrado</b>'+
   '<span>Os clientes entram sozinhos quando você identifica o telefone numa venda no PDV.</span></div>')+
  '</div></div></div>';

  $('crB').oninput=function(){CR.busca=this.value;var p=this.selectionStart;telaClientes();
    var n=$('crB');n.focus();n.setSelectionRange(p,p);};
  rodape((DB.clientes||[]).length+' clientes cadastrados');
}
function limparCR(){CR={busca:'',periodo:'',bairro:'',modo:'compraram',aniv:false,ordem:'gasto'};telaClientes();}

/* ---------- FICHA / CRM DO CLIENTE ---------- */
function fichaCliente(id){
  baseCRM();
  var c=id?DB.clientes.find(function(x){return x.id===id}):null;
  if(!c)return formCliente2();
  var s=statsCliente(c);
  var movs=(DB.fiadoMov||[]).filter(function(m){return m.clienteId===c.id})
    .sort(function(a,b){return (b.data||'').localeCompare(a.data||'')});
  var topProds=Object.keys(s.prods).sort(function(a,b){return s.prods[b]-s.prods[a]}).slice(0,6);

  var h='<div class="mdB">'+
  '<div class="acHead">'+
   '<div class="av3" style="width:46px;height:46px;font-size:18px">'+E((c.nome||'?').charAt(0).toUpperCase())+'</div>'+
   '<div style="flex:1"><b>'+E(c.nome)+'</b>'+
    '<span>'+E(c.tel||'sem telefone')+(c.cpf?' · CPF '+E(c.cpf):'')+
    (c.nascimento?' · nasc. '+dataBR(c.nascimento):'')+'</span>'+
    '<span>'+E([c.rua,c.numero,c.bairro,c.cidade].filter(Boolean).join(', ')||'sem endereço')+'</span></div>'+
   '<button class="btnP2" onclick="formCliente2(\''+c.id+'\')">'+sv('edit',13)+' Editar</button>'+
  '</div>'+

  '<div class="acKpis">'+
   '<div class="acK"><span>Pedidos</span><b>'+s.qtd+'</b></div>'+
   '<div class="acK"><span>Total consumido</span><b>R$ '+money(s.total)+'</b></div>'+
   '<div class="acK"><span>Ticket médio</span><b>R$ '+money(s.ticket)+'</b></div>'+
   '<div class="acK"><span>Última compra</span><b>'+(s.ultima?dataBR(s.ultima):'—')+'</b></div>'+
   '<div class="acK"><span>Dia preferido</span><b style="font-size:13px">'+(s.diaTop||'—')+'</b></div>'+
   '<div class="acK'+(c.saldoFiado?' dest3':'')+'"><span>Saldo fiado</span>'+
    '<b class="'+(c.saldoFiado?'vr':'')+'">R$ '+money(c.saldoFiado||0)+'</b></div>'+
  '</div>'+

  /* ==========================================================
     O CARTÃO FIDELIDADE, NA FICHA DO CLIENTE (Rafael, 25/09/2026)

     *"Como é que eu vou saber? Se eu entrar no cadastro dela, eu vou
     saber que ela resgatou, o dia que ela resgatou, a hora que ela
     resgatou, e como que eu vou saber se já começou a nova contagem?"*

     Então a ficha responde as três: em que ponto o cartão está AGORA,
     cada resgate com dia e hora, e o que já foi comprado depois do
     último — que é a contagem nova, começada.
     ========================================================== */
  (function(){
    var fid=fidelidadeDoCliente(c,lojaAtualId());
    var todos=resgatesDoCliente(c).slice().sort(function(a2,b2){
      return String(b2.em||'').localeCompare(String(a2.em||''));});
    return '<div class="blk fidBlk" style="margin:11px 0 0;max-width:none;padding:0;overflow:hidden">'+
     '<div class="acTit">Programa de fidelidade '+
      '<span style="font-weight:400;text-transform:none">'+E(sucNome(fid.sucursalId)||'esta loja')+
      ' · '+FID_META+' compras = 1 '+E((produtoDoBrinde()||{}).nome||'Cascão 1 Bola')+'</span></div>'+
     '<div class="fidFicha">'+
      '<div class="fidCx'+(fid.temBrinde?' ok':'')+'">'+
       '<div class="fidN">'+
        '<b>'+(fid.temBrinde?'Brinde disponível'
              :'Cartão em andamento · '+fid.compras+' de '+FID_META)+'</b>'+
        '<span>'+(fid.temBrinde
          ?'são '+fid.compras+' compras completas — dá para resgatar no PDV'
          :(fid.falta===FID_META?'a contagem começa na próxima compra'
            :'faltam '+fid.falta+' compra'+(fid.falta===1?'':'s')))+
         (fid.ultimo?' · contagem nova desde o resgate de '+dataBR(fid.ultimo.data)+
          ' às '+E(fid.ultimo.hora||''):'')+'</span>'+
        '<div class="fidBar">'+
         Array.apply(null,{length:FID_META}).map(function(_,i){
           return '<i'+(i<Math.min(fid.compras,FID_META)?' class="on"':'')+'></i>';}).join('')+
        '</div>'+
       '</div>'+
      '</div>'+
      (todos.length
        ?'<table class="acTab" style="margin-top:10px"><thead><tr>'+
          '<th style="width:110px">Resgatou em</th><th style="width:70px">Hora</th>'+
          '<th>Brinde</th><th style="width:150px">Loja</th><th style="width:130px">Quem entregou</th>'+
          '</tr></thead><tbody>'+
          todos.map(function(r){
            return '<tr><td><b>'+dataBR(r.data)+'</b></td><td>'+E(r.hora||'')+'</td>'+
            '<td>'+E(r.brinde||'')+'</td><td>'+E(sucNome(r.sucursalId)||'')+'</td>'+
            '<td>'+E(r.por||'')+'</td></tr>';}).join('')+
          '</tbody></table>'
        :'<div class="hint" style="padding:12px 2px 2px">Nenhum brinde resgatado até agora.</div>')+
     '</div></div>';
  })()+

  '<div class="crmCols">'+
   '<div class="blk" style="margin:0;max-width:none;padding:0;overflow:hidden">'+
    '<div class="acTit">Produtos que mais compra</div>'+
    '<div class="acTabW" style="max-height:200px">'+
    (topProds.length?'<table class="acTab"><tbody>'+topProds.map(function(p,i){
      return '<tr><td><span class="posN">'+(i+1)+'</span> '+E(p)+'</td>'+
      '<td style="text-align:right;width:70px"><b>'+s.prods[p]+'x</b></td></tr>';
    }).join('')+'</tbody></table>'
    :'<div class="hint" style="padding:18px">Sem compras registradas.</div>')+
   '</div></div>'+

   '<div class="blk" style="margin:0;max-width:none;padding:0;overflow:hidden">'+
    '<div class="acTit" style="display:flex;align-items:center;gap:8px">Conta fiado'+
     '<div style="flex:1"></div>'+
     '<button class="btnP2" onclick="ajustarLimite(\''+c.id+'\')">Limite: R$ '+money(c.limiteFiado||0)+'</button>'+
     (c.saldoFiado?'<button class="btnP2 ok" onclick="pagarFiado(\''+c.id+'\')">'+sv('cash',12)+' Receber</button>':'')+
    '</div>'+
    '<div class="acTabW" style="max-height:200px">'+
    (movs.length?'<table class="acTab"><tbody>'+movs.map(function(m){
      return '<tr><td>'+dataBR(m.data)+' <span style="color:var(--ink-3)">'+E(m.obs||(m.tipo==='debito'?'compra fiado':'pagamento'))+'</span></td>'+
      '<td style="text-align:right;width:110px" class="'+(m.tipo==='debito'?'vr':'vg')+'"><b>'+
      (m.tipo==='debito'?'+ ':'- ')+'R$ '+money(m.valor)+'</b></td></tr>';
    }).join('')+'</tbody></table>'
    :'<div class="hint" style="padding:18px">Nenhuma movimentação de fiado.</div>')+
   '</div></div>'+
  '</div>'+

  '<div class="blk" style="margin:11px 0 0;max-width:none;padding:0;overflow:hidden">'+
   '<div class="acTit">Histórico de compras <span style="font-weight:400;text-transform:none">'+s.qtd+' pedidos</span></div>'+
   '<div class="acTabW" style="max-height:260px">'+
   (s.ps.length?'<table class="acTab"><thead><tr>'+
    '<th style="width:70px">Pedido</th><th style="width:100px">Data</th><th style="width:60px">Hora</th>'+
    '<th>Itens</th><th style="width:70px">Tipo</th>'+
    '<th style="width:100px;text-align:right">Valor</th><th style="width:40px"></th></tr></thead><tbody>'+
    s.ps.map(function(p){
      return '<tr><td><b>#'+p.numero+'</b></td><td>'+dataBR(p.data)+'</td><td>'+E(p.hora||'')+'</td>'+
      '<td>'+E((p.itens||[]).map(function(i){return i.qtd+'x '+i.nome}).join(', ').slice(0,80))+'</td>'+
      '<td>'+(p.tipo==='entrega'?'Entrega':'Loja')+'</td>'+
      '<td style="text-align:right"><b>R$ '+money(p.total)+'</b></td>'+
      '<td><button class="rBtn" onclick="verPedido(\''+p.id+'\')">'+sv('eye',12)+'</button></td></tr>';
    }).join('')+'</tbody></table>'
   :'<div class="hint" style="padding:22px;text-align:center">Este cliente ainda não comprou.</div>')+
   '</div></div>'+
  (c.obs?'<div class="hint" style="margin-top:10px">Observação: '+E(c.obs)+'</div>':'')+
  '</div>';

  var o=document.createElement('div');o.className='mdOv';o.id='mdOv';
  o.innerHTML='<div class="mdBox xl"><div class="mdH"><b>Ficha do cliente</b>'+
  '<button onclick="fecharModal()">&times;</button></div>'+h+
  '<div class="mdF"><button class="btnP2" onclick="fecharModal()">Fechar</button>'+
  '<button class="btnP2 ok" onclick="formCliente2(\''+c.id+'\')">'+sv('edit',13)+' Editar cadastro</button></div></div>';
  document.body.appendChild(o);
  fecharSoForaDeVerdade(o);
}

/* ---------- CADASTRO COMPLETO ---------- */
function formCliente2(id){
  fecharModal();baseCRM();
  var c=id?DB.clientes.find(function(x){return x.id===id}):null;
  var h='<div class="mdB">'+
  '<div class="blk" style="margin:0 0 11px;max-width:none"><h3>Dados pessoais</h3>'+
  '<div class="row2"><div class="fld2"><label>Nome *</label><input id="k2N" value="'+E(c?c.nome:'')+'"></div>'+
  '<div class="fld2"><label>Telefone * <small style="color:var(--ink-3);font-weight:400">identificador</small></label>'+
  '<input id="k2T" type="tel" value="'+E(c?c.tel:'')+'" placeholder="(17) 99999-9999"></div></div>'+
  '<div class="row2"><div class="fld2" style="margin:0"><label>CPF</label><input id="k2C" value="'+E(c?c.cpf:'')+'" placeholder="000.000.000-00"></div>'+
  '<div class="fld2" style="margin:0"><label>Data de nascimento</label><input id="k2A" type="date" value="'+E(c?c.nascimento:'')+'"></div></div>'+
  '</div>'+
  '<div class="blk" style="margin:0 0 11px;max-width:none"><h3>Endereço</h3>'+
  '<div class="row2"><div class="fld2"><label>Rua</label><input id="k2R" value="'+E(c?c.rua:'')+'"></div>'+
  '<div class="fld2"><label>Número</label><input id="k2Nu" value="'+E(c?c.numero:'')+'"></div></div>'+
  '<div class="row2"><div class="fld2"><label>Bairro</label><input id="k2B" list="lstBairro" value="'+E(c?c.bairro:'')+'">'+
  '<datalist id="lstBairro">'+bairrosCadastrados().map(function(b){return '<option>'+E(b)+'</option>'}).join('')+'</datalist></div>'+
  '<div class="fld2"><label>Cidade / área de entrega</label>'+
  (cidadesEntrega().length?'<select id="k2Ci"><option value="">Selecione</option>'+
    cidadesEntrega().map(function(a){return '<option value="'+E(a.cidade)+'"'+
    (c&&(c.cidade||'').toLowerCase()===a.cidade.toLowerCase()?' selected':'')+'>'+E(a.cidade)+' — R$ '+money(a.valor)+'</option>'}).join('')+'</select>'
   :'<input id="k2Ci" value="'+E(c?c.cidade:'')+'">')+'</div></div>'+
  '<div class="fld2" style="margin:0"><label>Referência</label><input id="k2Rf" value="'+E(c?c.ref:'')+'"></div>'+
  '</div>'+
  '<div class="blk" style="margin:0;max-width:none"><h3>Conta fiado e observações</h3>'+
  '<div class="row2"><div class="fld2" style="margin:0"><label>Limite de crédito (fiado)</label>'+
  '<div class="cur"><span>R$</span><input type="text" inputmode="decimal" autocomplete="off" placeholder="0,00" class="moeda" id="k2L" value="'+((c&&c.limiteFiado)?money(c.limiteFiado):'')+'"></div>'+
  '<div class="hint">Zero significa que o cliente não pode comprar fiado.</div></div>'+
  '<div class="fld2" style="margin:0"><label>Observações</label><input id="k2O" value="'+E(c?c.obs:'')+'"></div></div>'+
  '</div></div>';
  setTimeout(function(){ligarMascaraTel($('k2T'))},30);
  modal(c?'Editar cliente':'Novo cliente',h,'Salvar',async function(){
    var nome=$('k2N').value.trim(),tel=$('k2T').value.trim();
    if(!nome){toast('Informe o nome.');return false;}
    /* o mesmo DDD obrigatório do cadastro do PDV: é o mesmo cliente,
       e um cadastro sem DDD parte o cartão fidelidade dele em dois */
    if(!telValido(tel)){
      toast('O telefone precisa do DDD — exemplo: (17) 99999-9999.');return false;}
    tel=telComDDD(tel);
    var dup=clientePorTel(tel);
    if(dup&&(!c||dup.id!==c.id)){
      if(!await pergunta('Já existe um cliente com este telefone: "'+dup.nome+'".\nAtualizar o cadastro dele?','Atualizar o cadastro'))return false;
      c=dup;
    }
    var o={nome:nome,tel:tel,cpf:$('k2C').value.trim(),nascimento:$('k2A').value,
      rua:$('k2R').value.trim(),numero:$('k2Nu').value.trim(),bairro:$('k2B').value.trim(),
      cidade:$('k2Ci').value,ref:$('k2Rf').value.trim(),
      limiteFiado:moedaValor('k2L'),obs:$('k2O').value.trim()};
    if(c)Object.assign(c,o);
    else{o.id=uid('cli');o.compras=0;o.gasto=0;o.saldoFiado=0;DB.clientes.push(o);}
    salvar();telaClientes();toast('Cliente salvo.');
    return true;
  },'lg');
}
function ajustarLimite(id){
  var c=DB.clientes.find(function(x){return x.id===id});
  var v=prompt('Limite de crédito fiado para '+c.nome+' (R$):',c.limiteFiado||0);
  if(v===null)return;
  c.limiteFiado=parseFloat(v)||0;salvar();fecharModal();fichaCliente(id);
  toast('Limite atualizado.');
}
function pagarFiado(id){
  fecharModal();
  var c=DB.clientes.find(function(x){return x.id===id});
  var h='<div class="mdB"><div class="blk" style="margin:0 0 11px;max-width:none">'+
  '<h3>'+E(c.nome)+'</h3>'+
  '<div class="linha tot"><span>Saldo devedor</span><span>R$ '+money(c.saldoFiado||0)+'</span></div></div>'+
  '<div class="blk" style="margin:0 0 11px;max-width:none">'+
  '<div class="row2"><div class="fld2" style="margin:0"><label>Valor recebido</label>'+
  '<div class="cur"><span>R$</span><input type="text" inputmode="decimal" autocomplete="off" placeholder="0,00" class="moeda" id="pfV" value="'+((c.saldoFiado||0)?money(c.saldoFiado):'')+'"></div></div>'+
  '<div class="fld2" style="margin:0"><label>Data</label><input id="pfD" type="date" value="'+hojeISO()+'"></div></div>'+
  '<div class="fld2" style="margin:12px 0 0"><label>Forma de pagamento</label><select id="pfF">'+
   (DB.formasPag||[]).filter(function(f){return f.ativa!==false&&f.tipo!=='fiado'}).map(function(f){
     return '<option value="'+f.id+'">'+E(f.nome)+'</option>'}).join('')+'</select></div></div>'+
  '<div class="blk" style="margin:0;max-width:none"><h3>Conta que recebe</h3>'+
  '<div class="contaGrid">'+(DB.contas||[]).map(function(ct,k){
    var b=ct.fixa?null:banco(ct.banco);
    var cor=ct.fixa==='caixa'?'#0E8A46':ct.fixa==='cofre'?'#5C6B80':(b?b.c:'#5C6B80');
    var sig=ct.fixa==='caixa'?'CX':ct.fixa==='cofre'?'CO':(b?b.s:'$');
    return '<label class="contaBox"><input type="radio" name="pfC" value="'+ct.id+'"'+(k===0?' checked':'')+'>'+
    '<span class="bcoIc" style="background:'+cor+'">'+sig+'</span>'+
    '<span><b>'+E(ct.nome)+'</b><small>saldo R$ '+money(saldoConta(ct))+'</small></span></label>';}).join('')+
  '</div></div></div>';
  modal('Receber fiado',h,'Confirmar recebimento',function(){
    var v=moedaValor('pfV');
    if(v<=0){toast('Informe o valor.');return false;}
    if(v>(c.saldoFiado||0)+0.01){toast('Valor maior que o saldo devedor.');return false;}
    var ct=document.querySelector('input[name=pfC]:checked');
    var dt=$('pfD').value||hojeISO();
    c.saldoFiado=+((c.saldoFiado||0)-v).toFixed(2);
    DB.fiadoMov.push({id:uid('fm'),clienteId:c.id,tipo:'credito',valor:v,data:dt,
      formaId:$('pfF').value,contaId:ct?ct.value:'',obs:'pagamento de fiado'});
    DB.lancFin=DB.lancFin||[];
    DB.lancFin.push({id:uid('lf'),tipo:'receita',contaId:ct?ct.value:'',metodoId:$('pfF').value,
      descricao:'Recebimento de fiado — '+c.nome,fornecedor:'',documento:'',
      categoriaTxt:'Recebimento de fiado',valor:v,emissao:dt,vencimento:dt,pagamento:dt,pago:true,
      origem:'fiado',ref:c.id});
    salvar();telaClientes();
    toast('R$ '+money(v)+' recebido. Lançado no financeiro.');
    return true;
  },'lg');
}
function exportarClientes(){
  baseCRM();
  var linhas=[['Nome','Telefone','CPF','Nascimento','Bairro','Cidade','Pedidos','Consumo','Ticket','Ultima compra','Fiado']];
  (DB.clientes||[]).forEach(function(c){
    var s=statsCliente(c);
    linhas.push([c.nome,c.tel||'',c.cpf||'',c.nascimento||'',c.bairro||'',c.cidade||'',
      s.qtd,String(s.total.toFixed(2)).replace('.',','),String(s.ticket.toFixed(2)).replace('.',','),
      s.ultima?dataBR(s.ultima):'',String((c.saldoFiado||0).toFixed(2)).replace('.',',')]);
  });
  var csv=linhas.map(function(r){return r.map(function(x){return '"'+String(x).replace(/"/g,'""')+'"'}).join(';')}).join('\n');
  var b=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'});
  var a=document.createElement('a');a.href=URL.createObjectURL(b);
  a.download='nexor-clientes.csv';document.body.appendChild(a);a.click();
  setTimeout(function(){a.remove()},400);
  toast('Clientes exportados.');
}

/* ==========================================================
   PROGRAMA DE FIDELIDADE (Rafael, 25/09/2026)

   *"Quando ela fizer 10 compras, ela ganha um cascão de uma bola, tipo
   um cartão fidelidade. Aí clicou em resgatar, automaticamente já dá
   baixa num cascão de uma bola da ficha técnica, e o motivo é programa
   de fidelidade."*

   As duas decisões dele, de 25/09/2026:
     - o cascão do brinde NÃO conta como compra para o próximo cartão;
     - o cartão é DE CADA LOJA: quem compra em Santa Fé junta com Santa
       Fé e resgata lá, e o estoque sai da loja que entregou.

   O que conta como compra: pedido não cancelado, daquela unidade, feito
   DEPOIS do último resgate, e com valor maior que zero — a venda que só
   entregou o brinde vale R$ 0,00 e por isso não conta, que é
   exatamente a regra que ele pediu.

   Nada aqui é um contador guardado: a contagem é lida dos pedidos toda
   vez. Contador guardado é a coisa que dessincroniza — dois caixas, um
   pedido cancelado, um download da nuvem, e o número mente. Os pedidos
   são a verdade, e o resgate é o único registro novo.
   ========================================================== */
var FID_META = 10;                       /* compras para ganhar o brinde */
var FID_BRINDE = 'cascão 1 bola';        /* o produto do brinde, pelo nome */

/* `_semAcento` já existe no módulo de movimentação e faz o mesmo: no
   escopo único do sistema, declarar de novo apagaria o de lá — foi a
   vistoria que pegou isto antes de virar defeito. */
/* o produto do brinde no cardápio desta loja. Pelo nome, sem acento e
   sem caixa: "Cascão 1 Bola", "CASCAO 1 BOLA" e "cascao 1 bola" são o
   mesmo produto para quem digitou o cardápio. */
function produtoDoBrinde(){
  var alvo=_semAcento(FID_BRINDE).trim();
  return (DB.produtos||[]).find(function(p){
    return p.ativo!==false&&_semAcento(p.nome).trim()===alvo;
  })||null;
}
function resgatesDoCliente(c,suc){
  var l=(c&&c.resgates)||[];
  if(!suc)return l.slice();
  return l.filter(function(r){return (r.sucursalId||'')===suc});
}
/* o último resgate desta loja, para saber de onde recomeça a contagem */
function ultimoResgate(c,suc){
  var l=resgatesDoCliente(c,suc).slice().sort(function(a,b){
    return String(a.em||'').localeCompare(String(b.em||''));});
  return l.length?l[l.length-1]:null;
}
function comprasDoCartao(c,suc){
  if(!c)return [];
  var ult=ultimoResgate(c,suc);
  var desde=ult?String(ult.em||''):'';
  return (DB.pedidos||[]).filter(function(p){
    if(p.clienteId!==c.id||ehCancelado(p))return false;
    if((p.sucursalId||'')!==suc)return false;
    if(!(Number(p.total)>0))return false;        /* a venda só do brinde não conta */
    return !desde||String(p.data||'')>desde;
  });
}
/* tudo o que a tela precisa saber, numa leitura só */
function fidelidadeDoCliente(c,suc){
  suc=suc||lojaAtualId();
  var ps=comprasDoCartao(c,suc);
  var n=ps.length;
  return {compras:n,meta:FID_META,falta:Math.max(0,FID_META-n),
    temBrinde:n>=FID_META,ultimo:ultimoResgate(c,suc),
    resgates:resgatesDoCliente(c,suc),sucursalId:suc};
}

/* ==========================================================
   O RESGATE

   Faz três coisas, nesta ordem, e nenhuma pela metade:
     1. dá baixa no estoque pela ficha técnica do brinde, num movimento
        com motivo PRÓPRIO — "Programa de fidelidade", que é como ele
        aparece na Movimentação de Estoque e nos relatórios;
     2. guarda o resgate no cliente, com dia, hora, loja e quem estava
        no caixa;
     3. devolve o registro, para o PDV pôr o brinde na comanda por
        R$ 0,00.

   Se a baixa não puder acontecer (produto sem ficha), o resgate NÃO é
   gravado: entregar o brinde sem tirar do estoque é criar diferença de
   inventário que ninguém explica depois.
   ========================================================== */
function motivoFidelidade(){
  baseMov();
  var m=(DB.motivosMov||[]).find(function(x){return x.id==='mv_fidelidade'});
  if(!m){
    m={id:'mv_fidelidade',nome:'Programa de fidelidade',tipo:'saida',
       sistema:true,ativo:true,lojas:[]};
    DB.motivosMov.push(m);
  }
  return m;
}
/* as linhas de estoque do brinde: a mesma conta da venda, porque é a
   mesma entrega — muda só o motivo */
function linhasDoBrinde(prod,qtd){
  var q=Number(qtd)||1;
  if(prod.insumoId){
    var ins=insumo(prod.insumoId);
    if(!ins)return [];
    var uL=prod.insumoUn||ins.unidade;
    return [{insumoId:ins.id,nome:ins.nome,unidade:uL,
      qtd:+((Number(prod.insumoQtd)||1)*q).toFixed(4),
      custo:custoNaUnidade(ins,uL),direcao:'saida',origem:'fidelidade'}];
  }
  var f=(DB.fichas||[]).find(function(x){return x.id===prod.fichaId});
  if(!f)return [];
  var porUn=(Number(f.unidadesVenda)||Number(f.rendimento)||1);
  var dest=destinoDaFicha(f);
  if(dest){
    return [{insumoId:dest.id,nome:dest.nome,unidade:f.rendUnidade||f.unidade,
      qtd:+((Number(f.rendimento)||1)/porUn*q).toFixed(4),
      custo:custoPorUnidade(f),direcao:'saida',origem:'fidelidade',fichaNome:f.nome}];
  }
  var fator=q/porUn;
  return (f.itens||[]).map(function(ci){
    var i2=insumo(ci.insumoId);
    if(!i2)return null;
    return {insumoId:i2.id,nome:i2.nome,unidade:ci.unidade,
      qtd:+((Number(ci.qtd)||0)*fator).toFixed(4),
      custo:custoNaUnidade(i2,ci.unidade),direcao:'saida',origem:'fidelidade',
      fichaId:f.id,fichaNome:f.nome};
  }).filter(Boolean);
}
/* ==========================================================
   A BAIXA SAI NA UNIDADE DO ITEM — a mesma trava da venda

   A ficha rende em GRAMA e o GELATO VENDA é guardado em QUILO. O
   aparelho converte na hora de aplicar, mas o pacote que sobe para a
   nuvem NÃO converte: o banco faz `estoque = estoque + qtd` e
   descontaria 60 quilos por um cascão. Foi assim que o saldo de Santa
   Fé foi a 779 kg negativos em 31/08/2026, pela venda.
   Aqui vale igual: o que o aparelho guarda, o que sobe e o que o banco
   aplica têm de ser a MESMA quantidade, na MESMA unidade.
   ========================================================== */
function normalizarLinhasEstoque(linhas){
  return (linhas||[]).map(function(l){
    var ins=itemEstoque(l.insumoId);
    if(!ins||!ins.unidade||!l.unidade||l.unidade===ins.unidade)return l;
    var q=convUnid(Number(l.qtd)||0,l.unidade,ins.unidade);
    if(q===null)return l;                  /* sem base comum: não arrisca */
    return Object.assign({},l,{qtd:+q.toFixed(4),unidade:ins.unidade,
      custo:custoNaUnidade(ins,ins.unidade)});
  });
}
function resgatarFidelidade(c){
  baseCRM();baseMov();
  var suc=lojaAtualId();
  var fid=fidelidadeDoCliente(c,suc);
  if(!fid.temBrinde)return {erro:'Este cliente ainda não completou as '+FID_META+' compras.'};
  var prod=produtoDoBrinde();
  if(!prod)return {erro:'O produto "Cascão 1 Bola" não está no cardápio desta loja.'};
  var linhas=normalizarLinhasEstoque(linhasDoBrinde(prod,1));
  if(!linhas.length)
    return {erro:'O "'+prod.nome+'" não tem ficha técnica ligada — sem ela o estoque não baixa.'};

  var mot=motivoFidelidade();
  var mov={id:uid('mv'),data:hojeISO(),hora:agoraHM(),motivoId:mot.id,
    identificacao:'Fidelidade · '+(c.nome||''),obs:'10 compras completas',
    linhas:linhas,origem:'fidelidade',sucursalId:suc,clienteId:c.id};
  DB.movEst.push(mov);
  aplicarMovimento(mov);

  var quem=(usuarioLogado()||{}).nome||'';
  var r={id:uid('fid'),em:new Date().toISOString(),data:hojeISO(),hora:agoraHM(),
    sucursalId:suc,por:quem,brinde:prod.nome,produtoId:prod.id,movId:mov.id,
    compras:fid.compras};
  c.resgates=(c.resgates||[]).concat([r]);
  salvar();
  return {ok:true,resgate:r,produto:prod,movimento:mov};
}
/* desfaz o resgate: devolve o brinde ao estoque e o cartão ao cliente.
   Usado quando o brinde sai da comanda antes da venda fechar — o que
   não saiu da loja não pode ter saído do estoque. */
function desfazerResgate(c,resgateId){
  if(!c||!resgateId)return false;
  var r=(c.resgates||[]).find(function(x){return x.id===resgateId});
  if(!r)return false;
  var mov=(DB.movEst||[]).find(function(m){return m.id===r.movId});
  if(mov){
    aplicarMovimento(mov,true);
    DB.movEst=(DB.movEst||[]).filter(function(m){return m.id!==r.movId});
  }
  c.resgates=(c.resgates||[]).filter(function(x){return x.id!==resgateId});
  salvar();
  return true;
}

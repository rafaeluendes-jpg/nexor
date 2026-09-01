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
  '<input id="k2T" type="tel" value="'+E(c?c.tel:'')+'" placeholder="(00) 00000-0000"></div></div>'+
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
  modal(c?'Editar cliente':'Novo cliente',h,'Salvar',async function(){
    var nome=$('k2N').value.trim(),tel=$('k2T').value.trim();
    if(!nome){toast('Informe o nome.');return false;}
    if(soDigitos(tel).length<8){toast('Informe um telefone válido — é ele que identifica o cliente.');return false;}
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

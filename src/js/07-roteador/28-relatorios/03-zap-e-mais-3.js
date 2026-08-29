/* ==========================================================
   PEDIDOS DO CARDÁPIO CHEGANDO NO PDV
   ========================================================== */
var PO={vistos:{},tocando:false};
async function buscarPedidosOnline(){
  if(!NUVEM.ligada)return;
  try{
    var r=await api('pedidos_online?situacao=eq.novo&order=criado_em.desc&limit=30');
    if(!r||!r.length)return;
    var novos=r.filter(function(p){return !PO.vistos[p.id]});
    if(!novos.length)return;
    novos.forEach(function(p){PO.vistos[p.id]=true});
    avisarPedidoNovo(novos);
  }catch(e){_quieto(e,'buscarPedidosOnline')}
}
function avisarPedidoNovo(lista){
  tocarSino();
  marcarPedidosNovos(lista.length);
  var n=lista.length;
  var el=document.getElementById('avisoPed');
  if(el)el.remove();
  var d=document.createElement('div');
  d.id='avisoPed';d.className='avisoPed';
  d.innerHTML=sv('cart',20)+
   '<div><b>'+n+' pedido'+(n>1?'s':'')+' do cardápio digital</b>'+
   '<span>'+lista.slice(0,2).map(function(p){
     return E(p.cliente_nome)+' · R$ '+money(p.total)}).join(' · ')+
   (n>2?' e mais '+(n-2):'')+'</span></div>'+
   '<button onclick="verPedidosOnline()">Ver</button>'+
   '<button class="x" onclick="this.parentNode.remove()">&times;</button>';
  document.body.appendChild(d);
  setTimeout(function(){var a=document.getElementById('avisoPed');if(a)a.remove();},25000);
}
function marcarPedidosNovos(n){
  var ic=document.querySelector('.mIco[data-m="pdv"]');
  if(!ic)return;
  var b=ic.querySelector('.selo');
  if(!b){b=document.createElement('span');b.className='selo';ic.appendChild(b);}
  b.textContent=n;
}
function limparSeloPedidos(){
  var b=document.querySelector('.mIco[data-m="pdv"] .selo');
  if(b)b.remove();
}
function tocarSino(){
  try{
    var ac=new (window.AudioContext||window.webkitAudioContext)();
    [0,0.18,0.36].forEach(function(t){
      var o=ac.createOscillator(),g=ac.createGain();
      o.connect(g);g.connect(ac.destination);
      o.frequency.value=t===0.36?1046:784;
      o.type='sine';
      g.gain.setValueAtTime(0,ac.currentTime+t);
      g.gain.linearRampToValueAtTime(.25,ac.currentTime+t+.02);
      g.gain.exponentialRampToValueAtTime(.001,ac.currentTime+t+.35);
      o.start(ac.currentTime+t);o.stop(ac.currentTime+t+.4);
    });
  }catch(e){_quieto(e,'tocarSino')}
}
/* ---------- tela dos pedidos online ---------- */
var PON={lista:[],carregando:false};
async function verPedidosOnline(){
  var a=document.getElementById('avisoPed');if(a)a.remove();
  abrir('pdv','pedidos-online');
}
/* aceita e já leva para o PDV, com o pedido no kanban */
async function aceitarEVerNoPdv(id){
  await aceitarPedidoOnline(id);
  PDV.aba='pedidos';
  abrir('pdv','pdv');
}
async function telaPedidosOnline(){
  baseMov();baseSuc();
  $('content').innerHTML='<div class="etWrap"><div class="etScroll">'+
   '<div class="etTopo">'+
    '<div><h1>Pedidos do Cardápio Digital</h1>'+
    '<p>Pedidos que chegaram pela página pública, esperando você aceitar.</p></div>'+
    '<div style="flex:1"></div>'+
    '<button class="btnP2" onclick="telaPedidosOnline()">'+sv('ref',13)+' Atualizar</button>'+
   '</div>'+
   '<div id="poBody"><div class="carregandoP">buscando pedidos...</div></div>'+
   '</div></div>';
  rodape();
  if(!NUVEM.ligada){
    $('poBody').innerHTML='<div class="mvVazio">'+sv('cloud',26)+
     '<b>Nuvem desligada</b><span>Ligue a nuvem para receber os pedidos do cardápio.</span></div>';
    return;
  }
  try{
    var r=await api('pedidos_online?order=criado_em.desc&limit=80');
    PON.lista=r||[];
    desenhaPedidosOnline();
  }catch(e){
    $('poBody').innerHTML='<div class="mvVazio">'+sv('help',26)+
     '<b>Não consegui buscar agora</b><span>'+E(e.message||'')+'</span></div>';
  }
}
var POF={periodo:'hoje',busca:''};
function filtraOnline(lista){
  var hoje=hojeISO();
  return lista.filter(function(p){
    var d=String(p.criado_em||'').slice(0,10);
    if(POF.periodo==='hoje'&&d!==hoje)return false;
    if(POF.periodo==='7'&&d<diasAtrasISO(7))return false;
    if(POF.periodo==='30'&&d<diasAtrasISO(30))return false;
    if(POF.busca){
      var q=POF.busca.toLowerCase();
      if(String(p.numero||'').indexOf(q)<0&&
         String(p.cliente_nome||'').toLowerCase().indexOf(q)<0&&
         String(p.cliente_tel||'').replace(/\D/g,'').indexOf(q.replace(/\D/g,''))<0)return false;
    }
    return true;
  });
}
function desenhaPedidosOnline(){
  var novos=PON.lista.filter(function(p){return p.situacao==='novo'});
  var resto=filtraOnline(PON.lista.filter(function(p){return p.situacao!=='novo'}));
  var _foco=document.activeElement&&document.activeElement.id==='pofB';
  var _pos=_foco?document.activeElement.selectionStart:0;
  $('poBody').innerHTML=
   '<div class="relKpis">'+
    '<div class="rk dest"><span>Aguardando você</span><b>'+novos.length+'</b></div>'+
    '<div class="rk"><span>Aceitos hoje</span><b>'+
     resto.filter(function(p){return String(p.criado_em||'').slice(0,10)===hojeISO()}).length+'</b></div>'+
    '<div class="rk"><span>Valor aguardando</span><b>R$ '+
     money(novos.reduce(function(a,p){return a+(Number(p.total)||0)},0))+'</b></div>'+
   '</div>'+
   (novos.length?'<div class="poGrade">'+novos.map(cardPedidoOnline).join('')+'</div>'
    :'<div class="mvVazio">'+sv('cart',26)+'<b>Nenhum pedido novo</b>'+
     '<span>Quando alguém pedir pelo cardápio, aparece aqui e o sistema avisa.</span></div>')+
   '<div class="kanBar" style="margin-top:6px">'+
    '<div class="kanFil">'+
     [['hoje','Hoje'],['7','7 dias'],['30','30 dias'],['tudo','Tudo']].map(function(f){
       return '<button class="'+(POF.periodo===f[0]?'on':'')+'" '+
       'onclick="POF.periodo=\''+f[0]+'\';desenhaPedidosOnline()">'+f[1]+'</button>';}).join('')+
    '</div>'+
    '<div class="kanBusca">'+sv('search',13)+
     '<input id="pofB" value="'+E(POF.busca)+'" placeholder="número, cliente ou telefone">'+
     (POF.busca?'<button onclick="POF.busca=\'\';desenhaPedidosOnline()">'+sv('x2',12)+'</button>':'')+
    '</div>'+
    '<div class="kanTot"><span><b>'+resto.length+'</b> pedido(s) no período</span>'+
     '<span class="v"><b>R$ '+money(resto.reduce(function(a,p){return a+(Number(p.total)||0)},0))+'</b></span>'+
    '</div></div>'+
   (resto.length?'<div class="etTabW plano2"><table class="etTab"><thead><tr>'+
    '<th style="width:90px">Nº</th><th style="width:130px">Quando</th><th>Cliente</th>'+
    '<th style="width:120px">Tipo</th><th style="width:120px;text-align:right">Total</th>'+
    '<th style="width:120px;text-align:center">Situação</th></tr></thead><tbody>'+
    resto.slice(0,40).map(function(p){
      return '<tr><td><b>#'+E(p.numero)+'</b></td>'+
      '<td>'+E(String(p.criado_em||'').slice(8,10)+'/'+String(p.criado_em||'').slice(5,7)+' '+
        String(p.criado_em||'').slice(11,16))+'</td>'+
      '<td>'+E(p.cliente_nome)+'<small style="display:block;color:var(--ink-3)">'+E(p.cliente_tel)+'</small></td>'+
      '<td>'+(p.tipo==='entrega'?'Entrega':'Retirada')+'</td>'+
      '<td style="text-align:right"><b>R$ '+money(p.total)+'</b></td>'+
      '<td style="text-align:center"><span class="badge2'+(p.situacao==='recusado'?' rd':'')+'">'+
       (p.situacao==='aceito'?'aceito':p.situacao==='recusado'?'recusado':E(p.situacao))+'</span>'+
       (p.tipo==='mesa'?' <span class="mesaTag">MESA '+E(p.mesa_numero)+'</span>':'')+'</td>'+
      '<td><button class="rBtn" onclick="verPedidoOnline(\''+p.id+'\')" title="Ver o pedido">'+
       sv('eye',12)+'</button></td></tr>';
    }).join('')+'</tbody></table></div>'
   :'<div class="mvVazio" style="padding:30px">'+sv('cart',22)+
    '<b>Nenhum pedido neste período</b><span>Mude o filtro acima para ver outros dias.</span></div>');
}
function verPedidoOnline(id){
  var p=PON.lista.find(function(x){return x.id===id});
  if(!p)return;
  var end=p.endereco||{};
  var itens=p.itens||[];
  var h='<div class="mdB">'+
  '<div class="acHead"><div class="av3" style="width:42px;height:42px">'+sv('cart',18)+'</div>'+
  '<div><b>Pedido #'+E(p.numero)+'</b>'+
   '<span>'+dataBR(String(p.criado_em||'').slice(0,10))+' às '+
    String(p.criado_em||'').slice(11,16)+' · '+
    (p.tipo==='entrega'?'Entrega':'Retirada')+'</span>'+
   '<span>'+E(p.cliente_nome)+' · '+E(p.cliente_tel)+'</span></div>'+
  '<div style="text-align:right"><span class="hint">Total</span>'+
   '<b style="display:block;font-size:20px;color:var(--acc-d)">R$ '+money(p.total)+'</b></div></div>'+
  (p.tipo==='entrega'?'<div class="blk" style="margin:0 0 11px;max-width:none"><h3>Entrega</h3>'+
   '<div class="linha"><span>Endereço</span><b>'+E(end.rua||'')+', '+E(end.numero||'')+'</b></div>'+
   '<div class="linha"><span>Zona</span><b>'+E(p.zona||'')+' — '+E(p.cidade||'')+'</b></div>'+
   (end.referencia?'<div class="linha"><span>Referência</span><b>'+E(end.referencia)+'</b></div>':'')+
   '</div>':'')+
  '<div class="blk" style="margin:0 0 11px;max-width:none;padding:0;overflow:hidden">'+
   '<div class="acTit">Itens</div><table class="acTab"><tbody>'+
   itens.map(function(i){
     return '<tr><td><b>'+i.qtd+'× '+E(i.nome)+'</b>'+
     ((i.opcoes||[]).length?'<small style="display:block;color:var(--ink-3)">'+
       i.opcoes.map(function(o){return E(o.nome)}).join(' · ')+'</small>':'')+
     (i.obs?'<small style="display:block;color:var(--ink-3)">obs: '+E(i.obs)+'</small>':'')+'</td>'+
     '<td style="text-align:right;width:110px"><b>R$ '+money(i.total)+'</b></td></tr>';
   }).join('')+'</tbody></table></div>'+
  '<div class="blk" style="margin:0;max-width:none"><h3>Fechamento</h3>'+
   '<div class="linha"><span>Itens</span><b>R$ '+money(p.subtotal)+'</b></div>'+
   (Number(p.taxa)?'<div class="linha"><span>Taxa de entrega</span><b>R$ '+money(p.taxa)+'</b></div>':'')+
   '<div class="linha tot"><span>Total</span><span>R$ '+money(p.total)+'</span></div>'+
   '<div class="linha"><span>Pagamento</span><b>'+E(p.forma_pagamento||'')+
    (Number(p.troco_para)?' · troco para R$ '+money(p.troco_para):'')+'</b></div>'+
   (p.observacao?'<div class="linha"><span>Observação</span><b>'+E(p.observacao)+'</b></div>':'')+
  '</div></div>';
  var o=document.createElement('div');o.className='mdOv';o.id='mdOv';
  o.innerHTML='<div class="mdBox lg"><div class="mdH"><b>Pedido do cardápio #'+E(p.numero)+'</b>'+
   '<button onclick="fecharModal()">&times;</button></div>'+h+
   '<div class="mdF"><button class="btnP2" onclick="fecharModal()">Fechar</button></div></div>';
  document.body.appendChild(o);
  fecharSoForaDeVerdade(o);
}
function cardPedidoOnline(p){
  var itens=p.itens||[];
  var quando=String(p.criado_em||'');
  var end=p.endereco||{};
  return '<div class="poCard">'+
   '<div class="poH"><b>#'+E(p.numero)+'</b>'+
    '<span class="poHora">'+quando.slice(11,16)+'</span>'+
    '<span class="badge2'+(p.tipo==='entrega'?'':' bl')+'">'+
     (p.tipo==='entrega'?'Entrega':'Retirada')+'</span></div>'+
   '<div class="poCli"><b>'+E(p.cliente_nome)+'</b>'+
    '<span>'+E(p.cliente_tel)+'</span>'+
    (p.tipo==='entrega'?'<span>'+E(end.rua||'')+', '+E(end.numero||'')+
      ' — '+E(p.zona||'')+'</span>'+
      (end.referencia?'<span class="ref">'+E(end.referencia)+'</span>':''):'')+
   '</div>'+
   '<div class="poItens">'+itens.map(function(i){
     return '<div class="poIt"><span>'+i.qtd+'×</span>'+
     '<div><b>'+E(i.nome)+'</b>'+
      ((i.opcoes||[]).length?'<small>'+i.opcoes.map(function(o){return E(o.nome)}).join(' · ')+'</small>':'')+
      (i.obs?'<small>obs: '+E(i.obs)+'</small>':'')+'</div>'+
     '<b class="v">R$ '+money(i.total)+'</b></div>';
   }).join('')+'</div>'+
   '<div class="poTot">'+
    '<div class="l"><span>Itens</span><b>R$ '+money(p.subtotal)+'</b></div>'+
    (Number(p.taxa)?'<div class="l"><span>Taxa</span><b>R$ '+money(p.taxa)+'</b></div>':'')+
    '<div class="l f"><span>Total</span><b>R$ '+money(p.total)+'</b></div>'+
    '<div class="pgL">'+sv('cash',12)+' '+E(p.forma_pagamento||'')+
     (Number(p.troco_para)?' · troco para R$ '+money(p.troco_para):'')+'</div>'+
    (p.observacao?'<div class="poObs">'+E(p.observacao)+'</div>':'')+
   '</div>'+
   '<div class="poAc">'+
    '<button class="btnP2 rdB" onclick="recusarPedidoOnline(\''+p.id+'\')">Recusar</button>'+
    '<button class="btnP2 ok" onclick="aceitarEVerNoPdv(\''+p.id+'\')">'+
     sv('check',13)+' Aceitar e abrir no PDV</button>'+
   '</div></div>';
}

/* ---------- aceitar: vira pedido do PDV e cadastra o cliente ---------- */
async function aceitarPedidoOnline(id){
  var p=PON.lista.find(function(x){return x.id===id});
  if(!p)return;
  /* Pedido de mesa nao vira venda ao ser aceito: ele engorda a comanda.
     A venda so nasce quando a conta e fechada, la no salao. */
  if(p.tipo==='mesa')return aceitarPedidoMesa(p);
  var ok=await confirmar({
    titulo:'Aceitar o pedido #'+p.numero,
    texto:E(p.cliente_nome)+' · '+(p.tipo==='entrega'?'entrega':'retirada'),
    linhas:[['Itens',String((p.itens||[]).length),''],
            ['Total','R$ '+money(p.total),''],
            ['Pagamento',String(p.forma_pagamento||'—'),'']],
    aviso:'O pedido entra no PDV, o cliente é cadastrado e o estoque é baixado.',
    ok:'Aceitar',tipo:'check'});
  if(!ok)return;

  baseMov();baseSuc();
  /* 1) cliente */
  var tel=String(p.cliente_tel||'').replace(/\D/g,'');
  var cli=(DB.clientes||[]).find(function(c){
    return String(c.tel||'').replace(/\D/g,'')===tel&&tel;});
  var end=p.endereco||{};
  if(!cli){
    cli={id:uid('cli'),nome:p.cliente_nome,tel:p.cliente_tel,
      rua:end.rua||'',numero:end.numero||'',ref:end.referencia||'',
      cidade:p.cidade||'',zonaId:p.zona_id||'',zona:p.zona||'',
      compras:0,gasto:0,origem:'cardapio'};
    DB.clientes.push(cli);
  }else{
    if(end.rua)cli.rua=end.rua;
    if(end.numero)cli.numero=end.numero;
    if(end.referencia)cli.ref=end.referencia;
    if(p.zona_id){cli.zonaId=p.zona_id;cli.zona=p.zona;}
    if(p.cidade)cli.cidade=p.cidade;
  }
  /* 2) itens, casando com os produtos cadastrados */
  var itens=(p.itens||[]).map(function(i){
    var pr=(DB.produtos||[]).find(function(x){return x.id===i.id})||
           (DB.produtos||[]).find(function(x){return x.nome===i.nome});
    return {produtoId:pr?pr.id:'',nome:i.nome,qtd:Number(i.qtd)||1,
      unitario:Number(i.unitario)||0,total:Number(i.total)||0,
      obs:i.obs||'',opcoes:(i.opcoes||[]).map(function(o){
        return {nome:o.nome,preco:Number(o.preco)||0}})};
  });
  /* 3) o pedido no PDV — já na fase inicial do fluxo de entrega */
  var ag=new Date();
  var ped={id:uid('ped'),numero:(DB.pedidos.length+1),
    tipo:(p.tipo==='entrega'?'entrega':'loja'),
    canal:'cardapio',
    fase:statusInicial(p.tipo==='entrega'?'entrega':'loja'),
    itens:itens,clienteId:cli.id,clienteNome:cli.nome,
    cidade:p.cidade||'',zonaId:p.zona_id||'',zona:p.zona||'',
    sucursalId:p.sucursal_id||'suc_matriz',
    total:Number(p.total)||0,taxa:Number(p.taxa)||0,desconto:0,
    pagamentos:[{formaId:formaPorNome(p.forma_pagamento),valor:Number(p.total)||0}],
    obs:p.observacao||'',trocoPara:Number(p.troco_para)||0,
    entregadorId:(p.tipo==='entrega'&&entregadorPadrao()?entregadorPadrao().id:null),
    data:ag.toISOString(),hora:agoraHM(),caixaId:(caixaAberto()||{}).id,
    origemOnline:p.id};
  DB.pedidos.push(ped);
  /* 4) estoque e histórico do cliente */
  try{ baixarEstoqueVenda(ped); }catch(e){_quieto(e,'aceitarPedidoOnline')}
  cli.compras=(cli.compras||0)+1;
  cli.gasto=(cli.gasto||0)+(Number(p.total)||0);
  cli.ultima=ag.toLocaleDateString('pt-BR');
  salvar();
  /* 5) marca como aceito na nuvem */
  try{
    await api('pedidos_online?id=eq.'+id,'PATCH',{situacao:'aceito',pedido_id:ped.id});
  }catch(e){_quieto(e,'aceitarPedidoOnline')}
  if(NUVEM.ligada)sincronizar();
  PON.lista=PON.lista.map(function(x){
    if(x.id===id)x.situacao='aceito';return x;});
  desenhaPedidosOnline();
  toast('Pedido #'+p.numero+' lançado no PDV.');
  enviarResumoPedido(ped,p);
}
/* confirmação com o resumo do que o cliente pediu */
async function enviarResumoPedido(ped,online){
  baseZap();
  var suc=ped.sucursalId||'suc_matriz';
  var c=cfgZapDe(suc);
  if(!c||c.ativo===false)return;
  var cli=(DB.clientes||[]).find(function(x){return x.id===ped.clienteId})||{};
  var tel=cli.tel||(online&&online.cliente_tel)||'';
  if(!tel){toast('Cliente sem telefone — não dá para avisar no WhatsApp.');return;}
  var cd=(DB.cardapio||{})[suc]||{};
  var nome=((cli.nome||(online&&online.cliente_nome)||'')).split(' ')[0];
  var linhas=(ped.itens||[]).map(function(i){
    return '• '+i.qtd+'× '+i.nome+
      ((i.opcoes||[]).length?'\n   _'+i.opcoes.map(function(o){return o.nome}).join(', ')+'_':'')+
      '\n   R$ '+money(i.total);
  }).join('\n');
  var vi=(ped.itens||[]).reduce(function(a,i){return a+(Number(i.total)||0)},0);
  var texto='*Pedido #'+ped.numero+' confirmado!* 🎉\n\n'+
    'Oi '+nome+', recebemos seu pedido:\n\n'+linhas+'\n\n'+
    '────────────────\n'+
    'Itens: R$ '+money(vi)+'\n'+
    (Number(ped.taxa)?'Entrega: R$ '+money(ped.taxa)+'\n':'')+
    '*Total: R$ '+money(ped.total)+'*\n\n'+
    'Pagamento: '+((online&&online.forma_pagamento)||'combinar')+
    (Number(ped.trocoPara)?' (troco para R$ '+money(ped.trocoPara)+')':'')+'\n'+
    (ped.tipo==='entrega'
      ? 'Entrega em: '+(cli.rua||'')+', '+(cli.numero||'')+' — '+(cli.zona||'')+'\n'+
        'Previsão: '+(cd.tempoEntrega||'a combinar')
      : 'Retirada na loja\nFica pronto em: '+(cd.tempoRetirada||'a combinar'))+
    '\n\nJá começamos a preparar. Aviso aqui quando '+
    (ped.tipo==='entrega'?'sair para entrega':'estiver pronto')+'! 🍨';
  try{
    var alvo=(await lojaConectada())||suc;
    /* destino:'cliente' obriga a sair pela Carla. A Meta recusa mensagem
       para quem nunca escreveu para o numero — e o cliente do delivery
       pede pelo site, nao pelo WhatsApp. */
    var r=await zapApi('/enviar','POST',{loja:alvo,telefone:tel,texto:texto,destino:'cliente'});
    if(r&&r.ok&&r.para)toast('Confirmação entregue a '+nome+'.');
    else if(r&&r.erro)toast('WhatsApp não enviou: '+String(r.erro).slice(0,90));
    else toast('O robô não confirmou a entrega — confira o telefone do cliente.');
  }catch(e){toast('Não consegui falar com o robô.');}
}
function formaPorNome(nome){
  baseFormas();
  var n=String(nome||'').toLowerCase();
  var f=(DB.formasPag||[]).find(function(x){
    var y=String(x.nome||'').toLowerCase();
    if(n.indexOf('pix')>=0)return y.indexOf('pix')>=0;
    if(n.indexOf('crédito')>=0||n.indexOf('credito')>=0)return y.indexOf('créd')>=0||y.indexOf('cred')>=0;
    if(n.indexOf('débito')>=0||n.indexOf('debito')>=0)return y.indexOf('déb')>=0||y.indexOf('deb')>=0;
    if(n.indexOf('dinheiro')>=0)return y.indexOf('dinheiro')>=0;
    return false;});
  return f?f.id:((DB.formasPag||[])[0]||{}).id;
}
async function aceitarPedidoMesa(p){
  baseMesas();baseComandas();
  var num=Number(p.mesa_numero)||0;
  var m=mesaPorNumero(num);
  if(!m){
    toast('A mesa '+num+' não está cadastrada. Cadastre em Configuração da Loja › Mesas.');
    return;
  }
  var nome=String(p.comanda_nome||p.cliente_nome||'').trim()||'Mesa '+num;
  var ok=await confirmar({
    titulo:'Levar para a mesa '+num,
    texto:'Comanda de '+E(nome),
    linhas:[['Itens',String((p.itens||[]).length),''],
            ['Valor','R$ '+money(p.total),''],
            ['Mesa',String(num),'']],
    aviso:'Os itens entram na comanda desta pessoa. Nada é cobrado agora — '+
     'a conta fecha no salão, quando a mesa pedir.',
    ok:'Confirmar e mandar para a cozinha',tipo:'check'});
  if(!ok)return;

  /* comanda com o mesmo nome nesta mesa: soma nela em vez de criar outra */
  var c=comandasDaMesa(m.id).find(function(x){
    return x.nome.toLowerCase()===nome.toLowerCase();});
  if(!c){
    c={id:uid('cm'),mesaId:m.id,mesaNumero:num,nome:nome,itens:[],aberta:true,
       abertaEm:new Date().toISOString(),sucursalId:m.sucursalId||''};
    DB.comandas.push(c);
  }
  (p.itens||[]).forEach(function(i){
    var x=JSON.parse(JSON.stringify(i));
    if(p.observacao&&!x.obs)x.obs=p.observacao;
    c.itens.push(x);
  });
  salvar();
  try{
    await api('pedidos_online?id=eq.'+p.id,'PATCH',{situacao:'aceito'});
  }catch(e){_quieto(e,'aceitarPedidoMesa')}
  PON.lista=PON.lista.map(function(x){if(x.id===p.id)x.situacao='aceito';return x;});
  desenhaPedidosOnline();
  toast('Lançado na comanda de '+nome+' — mesa '+num+'.');
  if(NUVEM.ligada)sincronizar();
}
async function recusarPedidoOnline(id){
  var p=PON.lista.find(function(x){return x.id===id});
  var ok=await confirmar({titulo:'Recusar o pedido #'+(p?p.numero:''),
    texto:'O cliente não será avisado automaticamente — ligue para ele.',
    ok:'Recusar',tipo:'perigo'});
  if(!ok)return;
  try{ await api('pedidos_online?id=eq.'+id,'PATCH',{situacao:'recusado'}); }catch(e){_quieto(e,'recusarPedidoOnline')}
  PON.lista=PON.lista.map(function(x){if(x.id===id)x.situacao='recusado';return x;});
  desenhaPedidosOnline();
}
/* verifica a cada 30 segundos */
setInterval(buscarPedidosOnline,30000);
setTimeout(buscarPedidosOnline,6000);

/* ==========================================================
   ROBÔ DE WHATSAPP — conexão e configuração
   ========================================================== */
var ZAP_URL='https://nexor-whatsapp.onrender.com';
/* A chave do robô NÃO fica no código nem no banco: ela é digitada uma vez
   por aparelho e guardada só aqui. Assim ela não viaja junto com o sistema
   e não aparece para quem lê o repositório. */
function zapChave(){ try{ return localStorage.getItem('nexor_zap_chave')||''; }catch(e){ return ''; } }
var ZP={suc:'',aba:'conexao',estado:{},buscando:false};

function baseZap(){
  DB.zap=DB.zap||{};
  baseSuc();
  sucAtivas().forEach(function(s){
    if(!DB.zap[s.id])DB.zap[s.id]={
      ativo:true,
      saudacao:'',textoHorario:'',textoEntrega:'',textoPagamento:'',textoEndereco:'',
      respostas:[],
      msgAceito:'Olá {nome}! Recebemos seu pedido #{numero} 🎉\n\nTotal: R$ {total}\nPrevisão: {tempo}\n\nJá estamos preparando!',
      msgPreparo:'{nome}, seu pedido #{numero} está sendo preparado com carinho 🍨',
      msgSaiu:'{nome}, seu pedido #{numero} saiu para entrega! 🛵\n\nChega em instantes no endereço informado.',
      msgEntregue:'Pedido #{numero} entregue! 😊\n\nEsperamos que goste. Se puder, responda de 1 a 5 como foi sua experiência — isso nos ajuda muito.',
      pedeAvaliacao:true,
      avisosAtivos:true,   /* as mensagens automáticas de cada fase do pedido */
      iaAtiva:true,iaNome:'Nina',iaTom:'acolhedor',iaRegras:'',iaApresenta:true
    };
  });
  return DB.zap;
}
function zapAtual(){
  baseZap();
  /* mesma regra da tela do cardapio: quem entrou por uma unidade mexe na
     unidade dele, e nao na primeira da lista */
  if(!podeTrocarUnidade()){
    var _m=lojaAtual();
    if(_m&&sucAtivas().some(function(s){return s.id===_m}))ZP.suc=_m;
  }
  if(!ZP.suc||!DB.zap[ZP.suc])
    ZP.suc=(podeTrocarUnidade()?((sucAtivas()[0]||{}).id):lojaAtual())||(sucAtivas()[0]||{}).id||'';
  return DB.zap[ZP.suc]||{};
}
async function zapApi(caminho,metodo,corpo){
  /* Quem autoriza é a sessão de quem está logado, não uma chave digitada.
     Distribuir chave para cada loja de cada cliente não se sustenta num
     sistema que vai ser vendido — e a chave compartilhada deixava qualquer
     um comandar qualquer loja. O token diz quem é e de qual loja. */
  var h={'Content-Type':'application/json'};
  if(NUVEM.ligada&&NUVEM.token)h['Authorization']='Bearer '+NUVEM.token;
  else{
    /* aparelho fora da nuvem ainda pode usar a chave fixa, se houver */
    var k=zapChave();
    if(!k)throw new Error('Entre no sistema com a nuvem ligada para comandar o robô.');
    h['x-chave']=k;
  }
  var r=await fetch(ZAP_URL+caminho,{
    method:metodo||'GET',
    headers:h,
    body:corpo?JSON.stringify(corpo):undefined
  });
  if(r.status===401)throw new Error('O robô não reconheceu sua sessão. '+
    'Saia e entre de novo no sistema.');
  if(r.status===403)throw new Error('Esta loja não pertence ao seu acesso.');
  if(r.status===429)throw new Error('Muitas mensagens seguidas — aguarde um instante.');
  var t=await r.text();
  try{ return JSON.parse(t); }catch(e){ return {erro:t}; }
}
function telaZap(dentro){
  baseMov();baseSuc();baseZap();
  /* ==========================================================
     O CAMINHO DE VOLTA NAO PODE SUMIR

     `dentro` dizia se a tela foi aberta a partir de Canais de Venda, e so
     entao aparecia o botao Canais. Mas toda troca de aba, de loja ou
     salvamento chama telaZap() sem o argumento — e o botao desaparecia.
     Quem entrava, clicava numa aba e queria voltar ficava sem saida.
     Agora a origem fica guardada em ZP.dentro.
     ========================================================== */
  if(dentro!==undefined)ZP.dentro=!!dentro;
  dentro=ZP.dentro;
  var c=zapAtual();
  $('content').innerHTML='<div class="etWrap"><div class="etScroll">'+
   '<div class="etTopo">'+
    (dentro?'<button class="btnP2" onclick="CN2.aba=\'canais\';telaCanaisIntegracao()">'+
      sv('cr2',13)+' Canais</button>':'')+
    '<div><h1>Robô do WhatsApp</h1>'+
    '<p>Atende os clientes sozinho e avisa cada etapa do pedido.</p></div>'+
    '<div style="flex:1"></div>'+
    '<button class="btnP2 ok" onclick="salvarZap()">'+sv('check',13)+' Salvar</button>'+
   '</div>'+
   '<div class="barraF">'+
    (podeTrocarUnidade()
      ? '<div class="bfCampo" style="min-width:230px"><label>Loja</label>'+
     '<select onchange="trocarLojaZap(this.value)">'+
     sucAtivas().map(function(s){
       return '<option value="'+s.id+'"'+(ZP.suc===s.id?' selected':'')+'>'+E(s.nome)+'</option>';
     }).join('')+'</select></div>'
      : '<div class="bfCampo" style="min-width:220px"><label>Configurando a loja</label>'+
        '<div style="font-weight:700;padding:6px 0">'+E(sucNome(ZP.suc))+'</div></div>')+
    '<div class="bfCampo"><label>Robô</label>'+
     '<label class="chkL" style="height:32px;margin:0"><input type="checkbox" id="zpAtivo" '+
     (c.ativo!==false?'checked':'')+'><span>responder automaticamente</span></label></div>'+
   '</div>'+
   '<div class="abasCN">'+
    [['conexao','Conexão','chat'],['ia','Atendente virtual','users'],
     ['avisos','Avisos do pedido','cart'],
     ['respostas','Respostas automáticas','book']].map(function(a){
      return '<button class="abaCN'+(ZP.aba===a[0]?' on':'')+'" onclick="trocarAbaZap(\''+a[0]+'\')">'+
      sv(a[2],14)+' '+a[1]+'</button>';}).join('')+
   '</div>'+
   (ZP.aba==='conexao'?abaConexao(c):ZP.aba==='ia'?abaIA(c):
    ZP.aba==='avisos'?abaAvisos(c):abaRespostas(c))+
   '</div>'+
   /* ==========================================================
      SALVAR PERTO DO CAMPO, E COM A LOJA ESCRITA

      A configuracao da Carla e POR LOJA. O Rafael digitou "Carla" dez
      vezes com o seletor na Matriz e foi conferir em Santa Fe — que
      continuava "Nina". Salvou todas as vezes, sempre na loja errada.
      O botao ficava la em cima, longe do campo, e nada dizia para qual
      unidade ia. Agora o nome da loja vai escrito ao lado do botao.
      ========================================================== */
   '<div class="cdSalvar">'+
    '<span id="zpSalvo">'+(ZP._salvoEm
      ?'<b style="color:#1B5E36">salvo às '+ZP._salvoEm+'</b>'
      :'As mudanças valem para <b>'+E(sucNome(ZP.suc))+'</b>.')+'</span>'+
    '<button class="btnP2 ok" onclick="salvarZap()">'+sv('check',14)+' Salvar</button></div>'+
   '</div>';
  if(ZP.aba==='conexao')verEstadoZap();
  rodape();
}
/* ---------- conexão ---------- */
function abaConexao(c){
  return '<div class="cfgDuas">'+
   '<div class="cfgCol"><div class="colH">Conectar o WhatsApp desta loja</div>'+
    '<div class="colB" style="padding:20px">'+
     '<div id="zapEstado"><div class="carregandoP">verificando...</div></div>'+
    '</div></div>'+
   '<div class="cfgCol estreita"><div class="colH">Como funciona</div>'+
    '<div class="colB" style="padding:16px">'+
     '<div class="passoZ"><b>1</b><div>Clique em <b>Conectar</b> e um QR code aparece</div></div>'+
     '<div class="passoZ"><b>2</b><div>No celular da loja, abra o WhatsApp → <b>Aparelhos conectados</b> → <b>Conectar aparelho</b></div></div>'+
     '<div class="passoZ"><b>3</b><div>Aponte para o QR na tela</div></div>'+
     '<div class="passoZ"><b>4</b><div>Pronto — o robô passa a responder por esse número</div></div>'+
     '<div class="hint" style="margin-top:14px;line-height:1.7">O celular continua funcionando normalmente. '+
     'O robô é um aparelho a mais conectado, como o WhatsApp Web.<br><br>'+
     'Se a conexão cair, é só ler o QR de novo.</div>'+
    '</div></div></div>'+
   blocoChaveZap();
}
/* ---------- quem pode comandar o robô ----------
   Não há mais chave para digitar. Quem autoriza é a sessão de quem entrou:
   o sistema manda o token, o robô pergunta ao banco de quem ele é e confere
   a loja. Um sistema vendido a várias redes não pode depender de alguém
   distribuir senha para cada loja de cada cliente. */
function blocoChaveZap(){
  var ok=!!(NUVEM.ligada&&NUVEM.token);
  var u=usuarioLogado()||{};
  return '<div class="cfgDuas" style="margin-top:14px">'+
   '<div class="cfgCol"><div class="colH">Quem pode comandar o robô</div>'+
    '<div class="colB" style="padding:20px">'+
     '<div class="ctNota'+(ok?' ctAt':'')+'" style="margin-bottom:14px">'+
      (ok?'Autorizado como <b>'+E(u.login||'')+'</b>. Nada a configurar.'
         :'<b>Este aparelho está fora da nuvem.</b> Entre no sistema com a nuvem '+
          'ligada para comandar o robô.')+
     '</div>'+
     '<div class="hint" style="line-height:1.7">O robô reconhece a sua entrada no '+
     'sistema. Não existe chave para digitar em cada computador, e cada pessoa só '+
     'comanda o WhatsApp das lojas do próprio acesso.</div>'+
    '</div></div>'+
   '<div class="cfgCol estreita"><div class="colH">Mudou na V17.6.0</div>'+
    '<div class="colB" style="padding:16px">'+
     '<div class="hint" style="line-height:1.7">Até a versão passada era preciso colar '+
     'uma chave em cada aparelho. Aquilo foi um remendo de quando ainda não havia login '+
     'de verdade.<br><br>'+
     'A chave também era <b>a mesma para todo mundo</b>: quem a tivesse comandava '+
     'qualquer loja. Agora o comando fica preso a quem mandou.</div>'+
    '</div></div></div>';
}
async function verEstadoZap(){
  var box=$('zapEstado');
  if(!box)return;
  try{
    var r=await zapApi('/estado/'+ZP.suc);
    ZP.estado[ZP.suc]=r;
    desenhaEstadoZap(r);
  }catch(e){
    box.innerHTML='<div class="zapOff">'+sv('help',22)+
     '<b>Não consegui falar com o robô</b>'+
     '<span>Confira se o servidor está no ar.</span>'+
     '<button class="btnP2" onclick="verEstadoZap()">Tentar de novo</button></div>';
  }
}
function desenhaEstadoZap(r){
  var box=$('zapEstado');
  if(!box)return;
  if(r.estado==='conectado'){
    box.innerHTML='<div class="zapOn">'+
     '<div class="zapIc">'+sv('check',26)+'</div>'+
     '<b>WhatsApp conectado</b>'+
     '<span class="zapNum">'+E(r.numero||'')+'</span>'+
     '<span class="hint">O robô está respondendo por este número.</span>'+
     '<button class="btnP2 rdB" onclick="desconectarZap()">Desconectar</button>'+
    '</div>';
    return;
  }
  if(r.qr){
    box.innerHTML='<div class="zapQr">'+
     '<b>Leia o QR com o celular da loja</b>'+
     '<img src="'+r.qr+'" alt="QR code">'+
     '<span class="hint">WhatsApp → Aparelhos conectados → Conectar aparelho</span>'+
     '<div class="zapEsperando">'+sv('ref',13)+' esperando a leitura...</div>'+
    '</div>';
    if(!ZP._loop)ZP._loop=setInterval(function(){
      if(ZP.aba!=='conexao'){clearInterval(ZP._loop);ZP._loop=null;return;}
      verEstadoZap();
    },3000);
    return;
  }
  box.innerHTML='<div class="zapOff">'+
   '<div class="zapIc off">'+sv('chat',26)+'</div>'+
   '<b>WhatsApp não conectado</b>'+
   '<span class="hint">Clique abaixo para gerar o QR code e conectar o número desta loja.</span>'+
   '<button class="btnP2 ok" onclick="conectarZap()">'+sv('chat',13)+' Conectar WhatsApp</button>'+
  '</div>';
}
async function conectarZap(){
  var box=$('zapEstado');
  if(box)box.innerHTML='<div class="carregandoP">gerando o QR code... isso leva alguns segundos</div>';
  try{
    var r=await zapApi('/conectar/'+ZP.suc,'POST',{});
    if(r&&r.erro){
      box.innerHTML='<div class="zapOff">'+sv('help',22)+
       '<b>O robô recusou a conexão</b><span class="hint">'+E(String(r.erro).slice(0,180))+'</span>'+
       '<button class="btnP2" onclick="conectarZap()">Tentar de novo</button></div>';
      return;
    }
    desenhaEstadoZap(r);
  }catch(e){
    if(box)box.innerHTML='<div class="zapOff">'+sv('help',22)+
     '<b>Não consegui conectar</b><span>'+E(e.message||'')+'</span>'+
     '<button class="btnP2" onclick="conectarZap()">Tentar de novo</button></div>';
  }
}
async function desconectarZap(){
  var ok=await confirmar({titulo:'Desconectar o WhatsApp',
    texto:'O robô para de responder por este número.',
    aviso:'Para voltar, será preciso ler o QR code de novo.',
    ok:'Desconectar',tipo:'perigo'});
  if(!ok)return;
  try{ await zapApi('/desconectar/'+ZP.suc,'POST',{}); }
  catch(e){ toast((e&&e.message)||'não consegui desconectar'); return; }
  verEstadoZap();
}

/* ---------- avisos de cada fase ---------- */
var FASES_ZAP=[
 {id:'msgAceito',  n:'Pedido aceito',      d:'assim que você aceita o pedido no PDV'},
 {id:'msgPreparo', n:'Em preparo',         d:'quando move o pedido para preparo'},
 {id:'msgSaiu',    n:'Saiu para entrega',  d:'quando o entregador sai com o pedido'},
 {id:'msgEntregue',n:'Entregue',           d:'quando marca como entregue — pede a avaliação'}
];
var TONS_IA=[
 {id:'acolhedor',n:'Acolhedor',d:'caloroso, como um atendente simpático de bairro'},
 {id:'direto',   n:'Direto',   d:'objetivo, resolve rápido, sem rodeios'},
 {id:'animado',  n:'Animado',  d:'descontraído e com energia'},
 {id:'formal',   n:'Formal',   d:'cordial e um pouco mais sério'}
];
function abaIA(c){
  var nome=c.iaNome||'Nina';
  var tom=c.iaTom||'acolhedor';
  return '<div class="cfgDuas">'+
   '<div class="cfgCol"><div class="colH">Quem atende os clientes</div>'+
    '<div class="colB" style="padding:16px">'+
     '<label class="chkL" style="margin-bottom:14px"><input type="checkbox" id="iaAtiva" '+
      (c.iaAtiva!==false?'checked':'')+'>'+
      '<span><b>Atendente virtual ligada</b>'+
      '<span>ela responde tudo, conversando com os dados reais da loja. '+
      '<b>Desligada</b>, quem atende são as respostas prontas — uma ou outra, nunca as duas '+
      'juntas, para não misturar os tons.</span></span></label>'+
     '<div class="row2">'+
      '<div class="fld2" style="margin:0"><label>Nome dela</label>'+
       '<input id="iaNome" value="'+E(nome)+'" placeholder="Nina, Sofia, Bia..." '+
       'oninput="previewIA()"></div>'+
      '<div class="fld2" style="margin:0"><label>&nbsp;</label>'+
       '<label class="chkL" style="height:38px;margin:0"><input type="checkbox" id="iaApres" '+
       (c.iaApresenta!==false?'checked':'')+'>'+
       '<span>ela se apresenta pelo nome</span></label></div>'+
     '</div>'+
     '<div class="cfgSep">Jeito de falar</div>'+
     '<div class="tomGrade">'+TONS_IA.map(function(t){
       return '<label class="tomOp'+(tom===t.id?' on':'')+'">'+
        '<input type="radio" name="iaTom" value="'+t.id+'"'+(tom===t.id?' checked':'')+
        ' onchange="previewIA()">'+
        '<b>'+t.n+'</b><span>'+E(t.d)+'</span></label>';
     }).join('')+'</div>'+
     '<div class="cfgSep">Regras da sua loja</div>'+
     '<textarea id="iaRegras" rows="7" class="areaIA" placeholder="Escreva uma regra por linha. Exemplos:'+String.fromCharCode(10)+
      '- Não fazemos bolo de sorvete'+String.fromCharCode(10)+
      '- Pedido mínimo para entrega é R$ 20'+String.fromCharCode(10)+
      '- Não parcelamos no cartão'+String.fromCharCode(10)+
      '- Todos os sabores levam leite, avise quem tem intolerância'+String.fromCharCode(10)+
      '- Se pedirem desconto, diga que não trabalhamos com desconto">'+E(c.iaRegras||'')+'</textarea>'+
     '<div class="hint">Ela segue estas regras à risca. Use para o que ela não teria como saber.</div>'+
     '<div class="cnAviso" style="margin-top:14px">'+sv('help',15)+
      '<div>Ela já conhece sozinha: os <b>sabores de hoje</b>, o <b>horário</b>, as '+
      '<b>taxas por bairro</b>, o <b>endereço</b> e as formas de pagamento — tudo vindo do sistema. '+
      'E foi instruída a nunca inventar: quando não sabe, diz que vai confirmar com a equipe.</div></div>'+
    '</div></div>'+
   '<div class="cfgCol estreita"><div class="colH">Como ela vai falar</div>'+
    '<div class="colB" style="padding:14px"><div id="prevIA">'+previewIAhtml(nome,tom)+'</div>'+
    '</div></div></div>';
}
function previewIAhtml(nome,tom){
  var ex={
   acolhedor:['Oi! Aqui é a '+nome+', da Jolô 😊','Que bom te ver por aqui! Posso ajudar com o pedido?'],
   direto:   ['Oi, aqui é a '+nome+'.','Me diga o que precisa que eu resolvo.'],
   animado:  ['Oiê! Aqui é a '+nome+' da Jolô 🍨','Bora escolher um sabor?'],
   formal:   ['Olá, boa tarde. Aqui é a '+nome+', da Jolô.','Em que posso ajudá-lo?']
  }[tom]||[];
  return ex.map(function(t){
    return '<div class="zapPrev">'+E(t)+'</div>';
  }).join('')+
  '<div class="zapPrev">Temos sim! Hoje o Chocolate Zero Açúcar e o Coco Branco estão na vitrine 🍨<br><br>'+
  'Quer que eu mande o cardápio?</div>'+
  '<div class="hint" style="margin-top:10px">Exemplos de como ela responde com este jeito.</div>';
}
function previewIA(){
  var n=($('iaNome')||{}).value||'Nina';
  var t='acolhedor';
  var rs=document.querySelectorAll('input[name="iaTom"]');
  for(var i=0;i<rs.length;i++)if(rs[i].checked)t=rs[i].value;
  var el=$('prevIA');
  if(el)el.innerHTML=previewIAhtml(n,t);
}
function abaAvisos(c){
  var lig=c.avisosAtivos!==false;
  return '<div style="padding:14px 16px">'+
   /* chave mestra: dá para calar as mensagens automáticas e deixar só a atendente */
   '<div class="chaveMestra'+(lig?'':' off')+'">'+
    '<label class="chkL" style="margin:0;flex:1"><input type="checkbox" id="zpAvisos" '+
     (lig?'checked':'')+' onchange="telaZapSalvaAba()">'+
     '<span><b>Mensagens automáticas '+(lig?'ligadas':'desligadas')+'</b>'+
     '<span>'+(lig
       ?'o sistema avisa o cliente sozinho a cada fase do pedido'
       :'o cliente não recebe aviso nenhum de fase — só a atendente virtual responde')+
     '</span></span></label>'+
   '</div>'+
   '<div class="cnAviso" style="margin:12px 0">'+sv('help',15)+
   '<div>Estas mensagens saem sozinhas quando você move o pedido no kanban. '+
   'Use <b>{nome}</b>, <b>{numero}</b>, <b>{total}</b> e <b>{tempo}</b> — o sistema troca pelos '+
   'dados reais de cada pedido.</div></div>'+
   '<div class="avisoG'+(lig?'':' apagado')+'">'+FASES_ZAP.map(function(f){
     return '<div class="avisoC">'+
      '<div class="avisoH"><b>'+E(f.n)+'</b><span>'+E(f.d)+'</span></div>'+
      '<textarea id="zp_'+f.id+'" rows="4">'+E(c[f.id]||'')+'</textarea>'+
      '<div class="avisoP" id="prev_'+f.id+'">'+previewMsg(c[f.id]||'')+'</div>'+
     '</div>';
   }).join('')+'</div>'+
   '<label class="chkL'+(lig?'':' apagado')+'" style="margin-top:12px"><input type="checkbox" id="zpAval" '+
    (c.pedeAvaliacao!==false?'checked':'')+(lig?'':' disabled')+'>'+
    '<span><b>Pedir avaliação ao entregar</b><span>o cliente responde de 1 a 5 e fica registrado</span></span></label>'+
   '</div>';
}
function previewMsg(t){
  return E(String(t||'')
    .replace(/{nome}/g,'Daisa')
    .replace(/{numero}/g,'1042')
    .replace(/{total}/g,'96,00')
    .replace(/{tempo}/g,'40 a 60 min')).replace(/\n/g,'<br>');
}
/* ---------- respostas automáticas ---------- */
function abaRespostas(c){
  var padrao=[
   ['saudacao','Saudação','a primeira mensagem quando alguém escreve','Olá! 👋 Bem-vindo.\n\nFaça seu pedido aqui: {link}'],
   ['textoHorario','Horário','quando perguntam se está aberto',''],
   ['textoEntrega','Taxa de entrega','quando perguntam sobre frete',''],
   ['textoPagamento','Pagamento','quando perguntam as formas de pagamento',''],
   ['textoEndereco','Endereço','quando perguntam onde fica','']
  ];
  return '<div style="padding:14px 16px">'+
   '<div class="cnAviso" style="margin-bottom:12px">'+sv('help',15)+
   '<div>Deixe em branco para usar a resposta padrão do sistema. '+
   'Use <b>{link}</b> para inserir o endereço do cardápio.</div></div>'+
   '<div class="cfgDuas zapResp" style="padding:0">'+
   '<div class="cfgCol"><div class="colH">Respostas prontas</div>'+
    '<div class="colB" style="padding:16px">'+
    padrao.map(function(p){
      return '<div class="fld2"><label>'+E(p[1])+' <small style="color:var(--ink-3);font-weight:400">— '+E(p[2])+'</small></label>'+
      '<textarea id="zp_'+p[0]+'" rows="3" placeholder="'+E(p[3])+'">'+E(c[p[0]]||'')+'</textarea></div>';
    }).join('')+
    '</div></div>'+
   /* ==========================================================
      O QUE ESTA CADASTRADO PRECISA SER LEGIVEL

      Eram dois campos nus, um do lado do outro, com o texto cortado em
      duas linhas. Nao dava para saber o que ja existia — o Rafael quase
      cadastrou de novo uma resposta que ja estava salva. Agora cada uma
      e um bloco numerado, com o texto inteiro a vista, dizendo em
      palavras o que cada campo significa.
      ========================================================== */
   '<div class="cfgCol"><div class="colH">Perguntas e respostas'+
     '<span class="cnt2">'+((c.respostas||[]).length)+'</span>'+
     '<div style="flex:1"></div>'+
     '<button class="btnMini" onclick="addRespZap()">'+sv('plus',11)+' nova</button></div>'+
    '<div class="colB" style="padding:14px">'+
    ((c.respostas||[]).length?c.respostas.map(function(r,k){
      return '<div class="respZ">'+
       '<div class="respZn">'+(k+1)+'</div>'+
       '<button class="rBtn rd" onclick="remResp('+k+')">'+sv('trash',11)+'</button>'+
       '<label>Quando o cliente falar em</label>'+
       '<input id="zpRc'+k+'" value="'+E(r.chaves||'')+'" placeholder="franquia, abrir uma loja, ser franqueado" '+
        'onchange="setResp('+k+',\'chaves\',this.value)">'+
       '<label>Responder</label>'+
       '<textarea id="zpRr'+k+'" rows="4" placeholder="o que a atendente deve dizer" '+
        'onchange="setResp('+k+',\'resposta\',this.value)">'+E(r.resposta||'')+'</textarea>'+
      '</div>';
    }).join('')
     :'<div class="hint">Nenhuma ainda. Clique em <b>nova</b>. Exemplo: '+
      'palavras <i>sem lactose, zero açúcar</i> respondendo sobre os sabores especiais.</div>')+
    '</div></div>'+
   '</div></div>';
}
function addRespZap(){
  var c=zapAtual();
  c.respostas=c.respostas||[];
  c.respostas.push({chaves:'',resposta:''});
  salvar();telaZap();
}
function setResp(k,campo,v){
  var c=zapAtual();
  c.respostas[k][campo]=v;
  salvar();
}
function remResp(k){
  var c=zapAtual();
  c.respostas.splice(k,1);
  salvar();telaZap();
}
/* a chave mestra mostra o efeito na hora, antes de salvar */
function telaZapSalvaAba(){
  var c=zapAtual();
  if($('zpAvisos'))c.avisosAtivos=$('zpAvisos').checked;
  FASES_ZAP.forEach(function(f){ if($('zp_'+f.id))c[f.id]=$('zp_'+f.id).value; });
  salvar();telaZap();
}
/* ---------- salvar ---------- */
/* trocar de aba ou de loja sem salvar era o caminho mais curto para
   perder o que acabou de ser digitado */
async function trocarAbaZap(a){
  try{ await salvarZap(true); }catch(e){ _quieto(e,'trocarAbaZap'); }
  ZP.aba=a; telaZap();
}
async function trocarLojaZap(id){
  try{ await salvarZap(true); }catch(e){ _quieto(e,'trocarLojaZap'); }
  ZP.suc=id; telaZap();
}
async function salvarZap(silencioso){
  var c=zapAtual();
  if($('zpAtivo'))c.ativo=$('zpAtivo').checked;
  if($('zpAvisos'))c.avisosAtivos=$('zpAvisos').checked;
  if($('zpAval'))c.pedeAvaliacao=$('zpAval').checked;
  FASES_ZAP.forEach(function(f){ if($('zp_'+f.id))c[f.id]=$('zp_'+f.id).value; });
  ['saudacao','textoHorario','textoEntrega','textoPagamento','textoEndereco'].forEach(function(k){
    if($('zp_'+k))c[k]=$('zp_'+k).value;
  });
  if($('iaAtiva'))c.iaAtiva=$('iaAtiva').checked;
  if($('iaNome'))c.iaNome=$('iaNome').value.trim();
  if($('iaApres'))c.iaApresenta=$('iaApres').checked;
  if($('iaRegras'))c.iaRegras=$('iaRegras').value;
  /* ==========================================================
     O SALVAR LE A TELA, NAO A MEMORIA

     As palavras-chave dependiam do `onchange` de cada campo ter rodado
     antes. Quem digitava e clicava direto em Salvar — ou trocava de aba
     — podia perder o que tinha acabado de escrever: a lista subia vazia
     e o banco gravava `[]`, sem erro nenhum. Foi o que aconteceu com a
     resposta sobre franquia.

     Agora o Salvar varre os campos da tela, do mesmo jeito que ja fazia
     com o nome e as regras. Linha sem palavra-chave e sem texto e
     descartada, para nao acumular linha vazia.
     ========================================================== */
  if(document.getElementById('zpRc0')||((c.respostas||[]).length)){
    var lidas=[];
    for(var ri=0;ri<200;ri++){
      var ei=document.getElementById('zpRc'+ri), et=document.getElementById('zpRr'+ri);
      if(!ei&&!et)break;
      var ch=(ei?ei.value:'').trim(), tx=(et?et.value:'').trim();
      if(ch||tx)lidas.push({chaves:ch,resposta:tx});
    }
    if(lidas.length||document.getElementById('zpRc0'))c.respostas=lidas;
  }
  var rt=document.querySelectorAll('input[name="iaTom"]');
  for(var ti=0;ti<rt.length;ti++)if(rt[ti].checked)c.iaTom=rt[ti].value;
  salvar();
  /* marca a hora, para a tela poder dizer que salvou de verdade */
  ZP._salvoEm=agoraHM();
  var elS=$('zpSalvo');
  if(elS)elS.innerHTML='<b style="color:#1B5E36">salvo às '+ZP._salvoEm+'</b>';
  /* manda para o banco, que o robô lê — inclusive para a loja conectada */
  if(NUVEM.ligada){
    try{
      var cd=(DB.cardapio||{})[ZP.suc]||{};
      var alvos=[ZP.suc];
      var conectada=await lojaConectada();
      if(conectada&&alvos.indexOf(conectada)<0)alvos.push(conectada);
      for(var ai=0;ai<alvos.length;ai++)
      /* P20: a empresa vai explicita. Desde que o banco parou de adotar
         registro orfao, gravar sem loja_id e recusado. */
      await gravarCfgZap(alvos[ai],{
        robo_ativo:c.ativo!==false,
        nome_loja:cd.titulo||sucNome(ZP.suc),
        link_cardapio:linkCardapio(alvos[ai]),
        saudacao:c.saudacao||null,texto_horario:c.textoHorario||null,
        texto_entrega:c.textoEntrega||null,texto_pagamento:c.textoPagamento||null,
        texto_endereco:c.textoEndereco||null,
        respostas:c.respostas||[],
        /* com as mensagens automáticas desligadas, o robô recebe elas vazias:
           é isso que faz o cliente não receber aviso nenhum de fase */
        msg_aceito:(c.avisosAtivos!==false?(c.msgAceito||null):null),
        msg_preparo:(c.avisosAtivos!==false?(c.msgPreparo||null):null),
        msg_saiu:(c.avisosAtivos!==false?(c.msgSaiu||null):null),
        msg_entregue:(c.avisosAtivos!==false?(c.msgEntregue||null):null),
        pede_avaliacao:(c.avisosAtivos!==false&&c.pedeAvaliacao!==false),
        /* ==========================================================
           CAMPO QUE NAO EXISTE NO BANCO DERRUBA O SALVAMENTO INTEIRO

           `avisos_ativos` nunca foi criado na tabela `whatsapp_config`.
           O banco recusa a gravacao inteira quando chega coluna
           desconhecida — "Could not find the 'avisos_ativos' column" —
           entao NADA da configuracao do robo subia: nem resposta pronta,
           nem regra, nem saudacao. O aviso na tela dizia "salvo aqui,
           mas nao subiu para o robo", e o lojista mexia na tela o dia
           inteiro sem que o robo mudasse uma virgula.

           O campo tambem nao fazia falta: o robo nunca o leu. "Avisos
           desligados" ja viaja nas quatro mensagens indo nulas e no
           `pede_avaliacao` falso, logo acima — que e como o robo
           realmente decide.
           ========================================================== */
        ia_ativa:c.iaAtiva!==false,ia_nome:c.iaNome||'Nina',
        ia_tom:c.iaTom||'acolhedor',ia_regras:c.iaRegras||null,
        ia_apresenta:c.iaApresenta!==false
      });
      if(!silencioso)toast('Configuração salva — o robô já está usando.');
      return;
    }catch(e){
      toast('Salvo aqui, mas não subiu para o robô: '+String(e.message||'').slice(0,50));
      return;
    }
  }
  if(!silencioso)toast('Configuração salva neste aparelho. Ligue a nuvem para o robô usar.');
}
/* ---------- envio automático quando o pedido muda de fase ---------- */
/* acha a configuração da loja; se o código não bater, usa a primeira */
var MSG_PADRAO={
 msgAceito:'Oi {nome}! Recebemos seu pedido *#{numero}* 🎉\n\nTotal: *R$ {total}*\nPrevisão: {tempo}\n\nJá começamos a preparar!',
 msgPreparo:'{nome}, seu pedido *#{numero}* está sendo preparado com carinho 🍨',
 msgSaiu:'{nome}, seu pedido *#{numero}* saiu para entrega! 🛵\n\nChega em instantes.',
 msgEntregue:'Pedido *#{numero}* entregue! 😊\n\nSe puder, responda de *1 a 5* como foi sua experiência. ⭐'
};
function cfgZapDe(suc){
  baseZap();
  var z=DB.zap||{};
  function completar(c){
    if(!c)return null;
    Object.keys(MSG_PADRAO).forEach(function(k){ if(!c[k])c[k]=MSG_PADRAO[k]; });
    return c;
  }
  if(z[suc])return completar(z[suc]);
  var chaves=Object.keys(z);
  if(chaves.length)return completar(z[chaves[0]]);
  return completar(Object.assign({ativo:true},MSG_PADRAO));
}
/* acha a loja que está de fato conectada no robô */
async function lojaConectada(){
  try{
    var d=await zapApi('/diagnostico');
    var s=(d.sessoes||[]).find(function(x){return x.estado==='conectado'});
    if(s)return s.loja;
  }catch(e){_quieto(e,'lojaConectada')}
  return null;
}
async function avisarCliente(ped,fase){
  if(!ped)return;
  baseZap();
  var suc=ped.sucursalId||'suc_matriz';
  var c=cfgZapDe(suc);
  if(!c){toast('Robô sem configuração — não avisei no WhatsApp.');return;}
  if(c.ativo===false)return;
  var f=String(fase||'').toLowerCase();
  var campo='';
  if(f==='aceito'||f==='aguardando'||f==='novo'||f==='recebido')campo='msgAceito';
  else if(/prepar|produ|cozinha/.test(f))campo='msgPreparo';
  else if(/saiu|rota|entrega|caminho|transporte/.test(f))campo='msgSaiu';
  else if(/entregue|conclu|finaliz/.test(f))campo='msgEntregue';
  if(!campo)return;
  var texto=c[campo];
  if(!texto)return;
  var cli=(DB.clientes||[]).find(function(x){return x.id===ped.clienteId});
  if(!cli||!cli.tel){
    if(ped.canal==='cardapio')toast('Cliente sem telefone no cadastro — não avisei no WhatsApp.');
    return;
  }
  var cd=(DB.cardapio||{})[suc]||{};
  texto=texto.replace(/{nome}/g,(cli.nome||'').split(' ')[0])
             .replace(/{numero}/g,ped.numero)
             .replace(/{total}/g,money(ped.total))
             .replace(/{tempo}/g,cd.tempoEntrega||'alguns minutos');
  try{
    var alvo=(await lojaConectada())||suc;
    var r=await zapApi('/enviar','POST',{loja:alvo,telefone:cli.tel,texto:texto,destino:'cliente'});
    /* ==========================================================
       SO DIZ "ENVIADO" SE O ROBO CONFIRMAR O NUMERO

       Antes bastava a chamada nao falhar para a tela escrever
       "enviado". O robo, por sua vez, considerava enviado qualquer
       tentativa que nao lancasse erro — e mandar para um numero que
       nao existe no WhatsApp NAO lanca erro. A loja ficava tranquila
       achando que o cliente foi avisado, e ninguem avisava ninguem.

       Agora o robo devolve o numero que confirmou. Sem numero
       confirmado, a tela diz que nao foi.
       ========================================================== */
    if(r&&r.ok&&r.para)toast('WhatsApp entregue a '+(cli.nome||'').split(' ')[0]+'.');
    else if(r&&r.erro)toast('Não enviei o WhatsApp: '+String(r.erro).slice(0,90));
    else toast('O robô não confirmou a entrega — confira o telefone do cliente.');
  }catch(e){
    toast('Não consegui falar com o robô do WhatsApp.');
  }
}

/* ==========================================================
   AVISOS AO GERENTE — abertura, fechamento e cancelamentos
   ========================================================== */
/* A assistente é um serviço da plataforma: o número é UM só, cadastrado pelo dono
   do Nexor, e liberado loja a loja. A loja não digita número nenhum. */
function baseAssPlat(){
  DB.assPlat=DB.assPlat||{numero:'',nome:'Assistente Joia',liberadas:{}};
  return DB.assPlat;
}
function assLiberada(suc){
  var a=baseAssPlat();
  return !!(a.numero&&a.liberadas&&a.liberadas[suc]);
}
function baseGerente(){
  DB.gerente=DB.gerente||{};
  baseSuc();
  sucAtivas().forEach(function(s){
    if(!DB.gerente[s.id])DB.gerente[s.id]={
      ativo:false,nome:'',tel:'',
      avisaAbertura:true,avisaFechamento:true,avisaCancelamento:true,
      avisaSangria:true,avisaDivergencia:true,
      limiteDivergencia:5,
      /* Assistente Nexor — canal próprio, separado do robô do cardápio */
      assistente:true,
      assNome:'',          /* como ela se apresenta nesta loja */
      assZap:'',           /* o número da assistente (API oficial da Meta) */
      donoNome:'',donoZap:'',   /* quem recebe e conversa com ela */
      relZap:'',           /* WhatsApp da franqueadora que recebe o relatório */
      emailRel:'',freqRel:'semanal'
    };
  });
  return DB.gerente;
}
function gerenteDe(suc){
  baseGerente();
  var g=DB.gerente||{};
  if(g[suc])return g[suc];
  var k=Object.keys(g);
  return k.length?g[k[0]]:null;
}
/* ---------- envio ---------- */
async function avisarGerente(suc,tipo,texto){
  var g=gerenteDe(suc||lojaAtualId());
  if(!g||!g.ativo||!g.tel)return;
  var quer={abertura:'avisaAbertura',fechamento:'avisaFechamento',
    cancelamento:'avisaCancelamento',sangria:'avisaSangria',
    divergencia:'avisaDivergencia'}[tipo];
  if(quer&&g[quer]===false)return;
  try{
    /* lojaConectada() procura sessão de QR. Com a Assistente na Meta não há
       sessão, e o aviso morria aqui em silêncio — o caixa fechava e nada
       chegava. O robô é quem sabe por onde mandar. */
    var alvo=suc||lojaAtualId();
    var r=await zapApi('/enviar','POST',{loja:alvo,telefone:g.tel,texto:texto});
    if(r&&r.ok)toast('Gerente avisado no WhatsApp.');
    else if(r&&r.erro)toast('Não consegui avisar o gerente: '+r.erro);
  }catch(e){
    /* engolir o erro fazia parecer que tinha dado certo */
    toast('Não consegui avisar o gerente: '+((e&&e.message)||'sem resposta'));
  }
}
function agoraBR(){
  var d=new Date();
  return d.toLocaleDateString('pt-BR')+' às '+
    String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
}
/* ---------- textos ---------- */
function msgAbertura(cx){
  return '🔓 *Caixa aberto*\n\n'+
    E(nomeLojaAtual())+'\n'+
    agoraBR()+'\n\n'+
    'Operador: '+E(cx.operador||'não informado')+'\n'+
    'Fundo de troco: *R$ '+money(cx.inicial)+'*';
}
function msgFechamento(cx,resumo){
  var linha='━━━━━━━━━━━━━━━━━\n';
  var l='🔒 *FECHAMENTO DE CAIXA*\n'+
    E(nomeLojaAtual())+'\n'+linha+
    'Abertura: '+E(cx.aberto||'')+'\n'+
    'Fechamento: '+E(cx.fechadoEm||agoraBR())+'\n'+
    'Abriu: '+E(cx.operador||'não informado')+'\n'+
    'Fechou: '+E(cx.fechadoPor||cx.operador||'não informado')+'\n'+linha+

    '*VENDAS*\n'+
    'Pedidos: '+resumo.qtd+'\n'+
    'Faturamento: *R$ '+money(resumo.total)+'*\n'+
    'Ticket médio: R$ '+money(resumo.qtd?resumo.total/resumo.qtd:0)+'\n';

  /* conferência forma a forma */
  var conf=cx.conferencia||{};
  var esp=cx.esperadoPorForma||{};
  var temConf=Object.keys(conf).length>0;
  if(temConf){
    l+='\n*CONFERÊNCIA POR FORMA*\n';
    var totS=0,totI=0;
    var listaF=(typeof FORMAS!=='undefined'&&FORMAS.length)?FORMAS:
      (typeof TIPOS_PG!=='undefined'?TIPOS_PG:[]);
    listaF.forEach(function(f){
      var e=Number(esp[f.id])||0, i=Number(conf[f.id])||0;
      if(!e&&!i)return;
      totS+=e;totI+=i;
      var d=i-e;
      l+='\n'+f.n+'\n'+
        '   sistema: R$ '+money(e)+'\n'+
        '   contado: R$ '+money(i)+'\n'+
        '   '+(Math.abs(d)<0.009?'confere ✅'
             :(d>0?'sobra R$ '+money(d)+' ⚠️':'falta R$ '+money(Math.abs(d))+' ⚠️'))+'\n';
    });
    l+='\n'+linha+
      'Total sistema: *R$ '+money(totS)+'*\n'+
      'Total contado: *R$ '+money(totI)+'*\n';
    var dg=totI-totS;
    l+='Diferença geral: *'+(Math.abs(dg)<0.009?'nenhuma ✅'
        :(dg>0?'+R$ '+money(dg)+' ⚠️':'-R$ '+money(Math.abs(dg))+' ⚠️'))+'*\n';
  }else if(resumo.formas.length){
    l+='\n*POR FORMA DE PAGAMENTO*\n';
    resumo.formas.forEach(function(f){
      l+='• '+f.nome+': R$ '+money(f.valor)+'\n';
    });
  }

  l+='\n'+linha+'*GAVETA (dinheiro)*\n'+
    'Fundo de troco: R$ '+money(cx.inicial)+'\n'+
    (resumo.suprimentos?'Suprimentos: + R$ '+money(resumo.suprimentos)+'\n':'')+
    (resumo.sangrias?'Sangrias: - R$ '+money(resumo.sangrias)+'\n':'')+
    'Esperado: *R$ '+money(resumo.esperado)+'*\n'+
    'Contado: *R$ '+money(resumo.contado)+'*\n';
  var dif=resumo.contado-resumo.esperado;
  l+=(Math.abs(dif)<0.009?'Conferido — sem diferença ✅'
      :(dif>0?'Sobra de *R$ '+money(dif)+'* ⚠️':'Falta de *R$ '+money(Math.abs(dif))+'* ⚠️'))+'\n';

  if(resumo.canceladas)
    l+='\n'+linha+'*CANCELAMENTOS*\n'+
      resumo.canceladas+' venda(s) — R$ '+money(resumo.vcanceladas)+'\n';
  if(cx.obs)l+='\nObservação: '+E(cx.obs)+'\n';
  return l;
}
function msgCancelamento(p,motivo){
  return '⚠️ *Venda cancelada*\n\n'+
    E(nomeLojaAtual())+'\n'+
    agoraBR()+'\n\n'+
    'Pedido: *#'+p.numero+'*\n'+
    'Valor: *R$ '+money(p.total)+'*\n'+
    'Cliente: '+E(p.clienteNome||'não identificado')+'\n'+
    (p.itens&&p.itens.length?'Itens: '+p.itens.map(function(i){
      return i.qtd+'× '+i.nome}).join(', ')+'\n':'')+
    (motivo?'Motivo: '+E(motivo)+'\n':'')+
    'Quem cancelou: '+E((typeof USUARIO!=='undefined'&&USUARIO&&USUARIO.nome)||
      (caixaAberto()||{}).operador||'Administrador');
}
function msgSangria(valor,motivo){
  return '💸 *Sangria de caixa*\n\n'+
    E(nomeLojaAtual())+'\n'+agoraBR()+'\n\n'+
    'Valor retirado: *R$ '+money(valor)+'*\n'+
    (motivo?'Motivo: '+E(motivo):'');
}
/* ==========================================================
   ROTINAS DA ASSISTENTE

   As cobranças automáticas: nome, pergunta, horário, dias da
   semana e quais lojas recebem.

   Quem cadastra é a MATRIZ da rede — ela conhece a operação e
   decide o que cobrar de quem. O franqueado responde, não cria.
   Por isso o bloco só aparece para quem tem acesso total.

   As rotinas vivem só na nuvem, não no localStorage: quem cobra
   é o robô, que lê direto do banco a cada dez minutos. Guardar
   uma cópia no aparelho criaria duas verdades sobre o mesmo
   horário — e o gestor receberia a cobrança errada.
   ========================================================== */

var ROT = { lista: [], carregando: false, edit: null };

var DIAS_SEM2 = [
  { n: 1, curto: 'Seg' }, { n: 2, curto: 'Ter' }, { n: 3, curto: 'Qua' },
  { n: 4, curto: 'Qui' }, { n: 5, curto: 'Sex' }, { n: 6, curto: 'Sáb' },
  { n: 0, curto: 'Dom' }
];

function rotDias(d) {
  var a = Array.isArray(d) ? d : [];
  if (!a.length) return 'nenhum dia';
  if (a.length === 7) return 'todos os dias';
  var seg = [1, 2, 3, 4, 5].every(function (x) { return a.indexOf(x) >= 0; });
  if (seg && a.length === 5) return 'de segunda a sexta';
  if (seg && a.length === 6 && a.indexOf(6) >= 0) return 'de segunda a sábado';
  return DIAS_SEM2.filter(function (x) { return a.indexOf(x.n) >= 0; })
    .map(function (x) { return x.curto; }).join(', ');
}

function rotLojas(s) {
  var a = Array.isArray(s) ? s : [];
  if (!a.length) return 'todas as lojas';
  baseSuc();
  var nomes = a.map(function (id) {
    var x = (DB.sucursais || []).find(function (y) { return y.id === id; });
    return x ? x.nome : id;
  });
  return nomes.length > 2
    ? nomes.length + ' lojas'
    : nomes.join(' e ');
}

/* ---------- buscar ---------- */
async function carregarRotinas() {
  var box = document.getElementById('rotBox');
  if (!box) return;
  if (!NUVEM.ligada) {
    box.innerHTML = '<div class="hint" style="padding:14px">Ligue a nuvem para ver as rotinas.</div>';
    return;
  }
  box.innerHTML = '<div class="carregandoP">buscando as rotinas...</div>';
  try {
    var r = await api('assistente_rotinas?loja_id=eq.' + NUVEM.loja + '&order=hora.asc');
    ROT.lista = r || [];
    desenharRotinas();
  } catch (e) {
    box.innerHTML = '<div class="avisoErro" style="margin:10px 0">' +
      'Não consegui buscar as rotinas: ' + E((e && e.message) || '') + '</div>';
  }
}

function desenharRotinas() {
  var box = document.getElementById('rotBox');
  if (!box) return;
  if (!ROT.lista.length) {
    box.innerHTML = '<div class="hint" style="padding:16px">' +
      'Nenhuma rotina cadastrada. Crie a primeira no botão acima — ' +
      'ela passa a ser cobrada no horário que você escolher.</div>';
    return;
  }
  box.innerHTML = '<table class="acTab semBusca"><thead><tr>' +
    '<th style="width:74px">Hora</th><th>Rotina</th>' +
    '<th style="width:150px">Dias</th><th style="width:130px">Lojas</th>' +
    '<th style="width:88px">Resposta</th><th style="width:74px">Situação</th>' +
    '<th style="width:104px"></th></tr></thead><tbody>' +
    ROT.lista.map(function (x) {
      return '<tr' + (x.ativa === false ? ' style="opacity:.5"' : '') + '>' +
        '<td><b>' + E(String(x.hora || '').slice(0, 5)) + '</b></td>' +
        '<td><b>' + E(x.nome || '') + '</b>' +
        '<div class="hint" style="margin:2px 0 0">' + E(x.pergunta || '') + '</div></td>' +
        '<td>' + E(rotDias(x.dias)) + '</td>' +
        '<td>' + E(rotLojas(x.sucursais)) + '</td>' +
        '<td>' + (x.tipo_resposta === 'texto' ? 'texto livre' : 'sim / não') + '</td>' +
        '<td>' + (x.ativa === false
          ? '<span class="cidTag">desligada</span>'
          : '<span class="cidTag ok">ligada</span>') + '</td>' +
        '<td style="text-align:right;white-space:nowrap">' +
        '<button class="btnMini" onclick="modalRotina(\'' + x.id + '\')">' + sv('edit', 12) + '</button> ' +
        '<button class="btnMini" onclick="excluirRotina(\'' + x.id + '\')">' + sv('trash', 12) + '</button>' +
        '</td></tr>';
    }).join('') + '</tbody></table>';
}

/* ---------- criar e editar ---------- */
function modalRotina(id) {
  baseSuc();
  var x = id ? ROT.lista.find(function (y) { return y.id === id; }) : null;
  var dias = x && Array.isArray(x.dias) ? x.dias : [1, 2, 3, 4, 5, 6];
  var sucs = x && Array.isArray(x.sucursais) ? x.sucursais : [];

  modal((x ? 'Editar rotina' : 'Nova rotina'),
    '<div class="row2">' +
     '<div class="fld2"><label>Nome da rotina *</label>' +
      '<input id="rtNome" value="' + E(x ? x.nome : '') + '" ' +
      'placeholder="ex: Checklist de abertura"></div>' +
     '<div class="fld2" style="max-width:130px"><label>Horário *</label>' +
      '<input type="time" id="rtHora" value="' + E(x ? String(x.hora || '').slice(0, 5) : '08:00') + '"></div>' +
    '</div>' +
    '<div class="fld2"><label>A pergunta que ela vai mandar *</label>' +
     '<textarea id="rtPerg" rows="2" placeholder="ex: Bom dia! Você já fez o checklist de abertura hoje?">' +
     E(x ? x.pergunta : '') + '</textarea></div>' +

    '<div class="cfgSep" style="margin:14px 0 8px">Dias da semana</div>' +
    '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:4px">' +
     DIAS_SEM2.map(function (d) {
       return '<label class="chkDia"><input type="checkbox" class="rtDia" value="' + d.n + '"' +
         (dias.indexOf(d.n) >= 0 ? ' checked' : '') + '><span>' + d.curto + '</span></label>';
     }).join('') +
    '</div>' +

    '<div class="cfgSep" style="margin:14px 0 8px">Tipo de resposta</div>' +
    '<div class="row2">' +
     '<div class="fld2"><select id="rtTipo">' +
      '<option value="sim_nao"' + (!x || x.tipo_resposta !== 'texto' ? ' selected' : '') + '>Sim ou não</option>' +
      '<option value="texto"' + (x && x.tipo_resposta === 'texto' ? ' selected' : '') + '>Texto livre</option>' +
      '</select></div>' +
     '<div class="fld2"><label class="chkL" style="margin:0;height:38px">' +
      '<input type="checkbox" id="rtAtiva"' + (!x || x.ativa !== false ? ' checked' : '') + '>' +
      '<span>Rotina ligada</span></label></div>' +
    '</div>' +
    '<div class="hint" style="margin:-4px 0 10px">Respondendo <b>não</b>, a assistente ' +
    'pergunta o motivo e guarda junto — é o motivo que explica a falha no relatório.</div>' +

    '<div class="cfgSep" style="margin:14px 0 8px">Quais lojas recebem</div>' +
    '<div class="hint" style="margin-bottom:8px">Sem marcar nenhuma, todas recebem.</div>' +
    /* uma loja por linha faria a janela passar da tela com 6 unidades */
    '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
     sucAtivas().map(function (s) {
       return '<label class="chkDia"><input type="checkbox" class="rtSuc" value="' + E(s.id) + '"' +
         (sucs.indexOf(s.id) >= 0 ? ' checked' : '') + '><span>' + E(s.nome) + '</span></label>';
     }).join('') +
    '</div>',
    'Salvar', async function () {
      var nome = $('rtNome').value.trim();
      var perg = $('rtPerg').value.trim();
      var hora = $('rtHora').value;
      if (!nome) { toast('Dê um nome à rotina.'); return false; }
      if (!perg) { toast('Escreva a pergunta que ela vai mandar.'); return false; }
      if (!hora) { toast('Escolha o horário.'); return false; }
      var dd = [].slice.call(document.querySelectorAll('.rtDia:checked'))
        .map(function (e) { return Number(e.value); });
      if (!dd.length) { toast('Marque ao menos um dia da semana.'); return false; }
      var ss = [].slice.call(document.querySelectorAll('.rtSuc:checked'))
        .map(function (e) { return e.value; });

      var corpo = {
        loja_id: NUVEM.loja, nome: nome, pergunta: perg,
        hora: hora.length === 5 ? hora + ':00' : hora,
        loja_id: NUVEM.loja,          /* P20: empresa sempre explicita */
        dias: dd, sucursais: ss,
        tipo_resposta: $('rtTipo').value,
        ativa: $('rtAtiva').checked
      };
      try {
        if (x) await api('assistente_rotinas?id=eq.' + x.id, 'PATCH', corpo);
        else await api('assistente_rotinas', 'POST', [corpo], { 'Prefer': 'return=minimal' });
        toast('Rotina salva.');
        carregarRotinas();
        return true;
      } catch (e) {
        toast('Não consegui salvar: ' + ((e && e.message) || 'erro'));
        return false;
      }
    }, 'lg');
}

async function excluirRotina(id) {
  var x = ROT.lista.find(function (y) { return y.id === id; });
  if (!x) return;
  if (!await pergunta('Excluir a rotina "' + x.nome + '"?\n\n' +
    'As respostas já gravadas continuam no histórico — só a cobrança deixa de acontecer.')) return;
  try {
    await api('assistente_rotinas?id=eq.' + id, 'DELETE', null, { 'Prefer': 'return=minimal' });
    toast('Rotina excluída.');
    carregarRotinas();
  } catch (e) { toast('Não consegui excluir: ' + ((e && e.message) || 'erro')); }
}

/* ---------- o bloco na tela ---------- */
function blocoRotinas() {
  if (!ehFranqueadora(usuarioLogado())) return '';
  return '<div class="cfgSep" style="margin:14px 16px 0">Rotinas da assistente</div>' +
   '<div style="padding:10px 16px 0">' +
    '<div class="hint" style="margin-bottom:11px">As cobranças automáticas. A assistente ' +
    'manda a pergunta no horário, nos dias marcados, e guarda a resposta com data e hora. ' +
    'Quem cadastra é a matriz — o franqueado responde.</div>' +
    '<button class="btnP2 ok" onclick="modalRotina()">' + sv('plus', 13) + ' Nova rotina</button>' +
    '<div class="acTabW" id="rotBox" style="margin-top:11px"></div>' +
   '</div>';
}

/* ---------- resumo do turno ---------- */
/* ==========================================================
   ITEM 9 — COMPROVANTE DE FECHAMENTO

   Nao existia impressao do fechamento: o operador contava, fechava, e
   nao ficava papel nenhum. Sem via impressa, qualquer conferencia
   posterior depende de abrir o sistema — e uma diferenca de caixa
   discutida dias depois vira palavra contra palavra.

   Usa a mesma bobina das outras vias (58mm ou 80mm, pelo modelo
   cadastrado). Nao imprime senha nem nada sensivel.
   ========================================================== */
/* ==========================================================
   O CUPOM DO FECHAMENTO — O MODELO DA LOJA

   Bobina termica, no desenho exato do comprovante que a rede ja usa
   ("REL. VALORES FISICOS"): cabecalho com data, hora, periodo,
   operador e caixa; um bloco Dinheiro e um bloco Cartao, cada um com
   Quant, Valor Total e subtotal; e o Total geral no rodape.

   Duas regras mandam aqui:

   1. LE DA FOTOGRAFIA, NAO RECALCULA. Um comprovante reimpresso em
      novembro precisa sair identico ao que foi assinado em agosto. Se
      recalculasse, uma venda cancelada depois mudaria o cupom antigo —
      e comprovante que muda nao prova nada.

   2. SAI SO O QUE FOI CONTADO. Uma versao anterior imprimia lado a
      lado o valor do sistema, o valor fisico e a diferenca. Isso nao e
      comprovante de contagem, e auditoria — e auditoria se ve na tela
      do fechamento e no relatorio da frente de caixa, onde da para
      investigar. No papel que a pessoa assina vai o que ela contou.

   Caixa fechado antes da V175 nao tem fotografia. Nesses casos a conta
   e refeita, e o cupom avisa que foi reconstruido.
   ========================================================== */
function linhasFechamento(cx){
  baseFormas();
  var cols=48, papel=80;
  try{ var m=modeloImp('ficha');
    if(m){ papel=papelDoModelo(m); cols=(papel===58?32:48); }
  }catch(e){}
  var s=cx.snapshot;
  var reconstruido=false;
  if(!s||!s.formas){
    reconstruido=true;
    var mv=movimentoCaixa(cx.id);
    var espOld=cx.esperadoPorForma||{};
    s=montarSnapshot(cx,mv,espOld,cx.conferencia||{});
  }
  var L=[];
  var esq=function(t,n){ t=String(t==null?'':t);
    return t.length>n?t.slice(0,n):t+new Array(n-t.length+1).join(' '); };
  var dir=function(t,n){ t=String(t==null?'':t);
    return t.length>n?t.slice(t.length-n):new Array(n-t.length+1).join(' ')+t; };
  var regra=function(c){ L.push({txt:new Array(cols+1).join(c)}); };
  var num=function(v){ return money(Math.abs(Number(v)||0)); };
  /* texto solto tambem obedece a largura da bobina */
  var texto=function(t,pq){
    String(t||'').match(new RegExp('.{1,'+cols+'}(\\s|$)','g'))
      .forEach(function(x){ L.push({txt:x.replace(/\s+$/,''),p:!!pq}); });
  };

  /* ==========================================================
     SO O QUE FOI CONTADO

     Este comprovante e o "REL. VALORES FISICOS": ele registra o
     dinheiro que a pessoa contou e conferiu, agrupado em Dinheiro e
     Cartao, com subtotal de cada grupo e o total geral. E so isso.

     Nao sai daqui o valor do sistema nem a diferenca. Comprovante de
     valores fisicos com duas colunas nao e comprovante de contagem, e
     uma auditoria — e auditoria se ve na tela do fechamento e no
     relatorio da frente de caixa, onde da para investigar. No papel
     que a pessoa assina vai o que ela contou.
     ========================================================== */
  var usada=function(f){
    return (f.fisico!==null&&Math.abs(Number(f.fisico)||0)>=0.01)||
           Math.abs(Number(f.sistema)||0)>=0.01;
  };
  var formas=(s.formas||[]).filter(usada);
  var grupos=[
    {nome:'Dinheiro',itens:formas.filter(function(f){return f.troco})},
    {nome:'Cartao',  itens:formas.filter(function(f){return !f.troco})}
  ].filter(function(g){return g.itens.length});

  /* ==========================================================
     A CONTA DA LARGURA FECHA EXATA

     rotulo + Quant + Valor Total + 2 espacos = cols. Um caractere a
     mais e a bobina corta o ultimo digito — era esse o defeito: "R$
     133," no lugar de "R$ 133,05". Na bobina estreita os cabecalhos
     encurtam para "Qt" e "Valor" em vez de espremer o nome da forma.
     ========================================================== */
  var largo=cols>=40;
  var hQt=largo?'Quant':'Qt', hVal=largo?'Valor Total':'Valor';
  var cVal=hVal.length, cQt=hQt.length;
  formas.forEach(function(f){
    var t=num(f.fisico===null?0:f.fisico); if(t.length>cVal)cVal=t.length; });
  var tt=num(s.totalFisico); if(tt.length>cVal)cVal=tt.length;
  grupos.forEach(function(g){
    var q=String(g.itens.length); if(q.length>cQt)cQt=q.length; });
  var cRot=cols-cVal-cQt-2;
  var linha=function(rot,qt,val,neg){
    L.push({txt:esq(rot,cRot)+' '+dir(qt,cQt)+' '+dir(val,cVal),n:!!neg});
  };

  /* --- cabecalho, no mesmo desenho do comprovante da loja --- */
  /* ==========================================================
     O CABECALHO E A LOJA QUE IMPRIMIU

     `s.empresa` e `cfg().nomePublico` — um nome da REDE, igual nas
     seis unidades. Quem le o comprovante precisa saber de qual loja
     ele saiu; a unidade esta em `s.loja` desde sempre, inclusive nas
     fotografias antigas. Mesma regra do cupom de venda, que imprimia
     "Alphaville" em Santa Fe do Sul.
     ========================================================== */
  L.push({txt:String(s.loja||s.empresa||'').slice(0,cols),n:true});
  L.push({txt:''});
  L.push({txt:'REL. VALORES FISICOS',n:true});
  regra('=');
  var quando=String(s.fechado||'').split(' ');
  var cab=function(a,b){
    var t=a; if(b){ t=a+'  '+b; if(t.length>cols)t=a; }
    L.push({txt:t.slice(0,cols)});
    if(b&&(a+'  '+b).length>cols)L.push({txt:String(b).slice(0,cols)});
  };
  /* o comprovante da loja escreve "Periodo: 1", nao "Periodo: Turno 1" */
  var periodo=String(s.turno||'1').replace(/^\s*turno\s*/i,'')||'1';
  cab('Data: '+(quando[0]||'-'),'Periodo: '+periodo);
  cab('Hora: '+(quando[1]||'-'),'Operador: '+(s.operadorAbriu||'-'));
  cab('Caixa: '+String(s.caixaId||'').slice(-6));
  if(s.loja&&s.loja!==s.empresa)cab('Unidade: '+s.loja);
  if(s.operadorFechou&&s.operadorFechou!==s.operadorAbriu)
    cab('Fechou: '+s.operadorFechou);
  regra('=');

  /* --- um bloco por grupo, com subtotal, como na referencia --- */
  grupos.forEach(function(g){
    L.push({txt:''});
    L.push({txt:g.nome,n:true});
    L.push({tipo:'linha'});
    linha('',hQt,hVal);
    L.push({tipo:'linha'});
    var soma=0;
    g.itens.forEach(function(f){
      var v=(f.fisico===null?0:Number(f.fisico)||0);
      soma+=v;
      linha(f.nome,'1',num(v));
    });
    L.push({tipo:'linha'});
    linha('Subtotal...',String(g.itens.length),num(soma));
  });

  L.push({txt:''});
  regra('=');
  L.push({txt:esq('Total....:',cols-cVal)+dir(num(s.totalFisico),cVal),n:true});
  if(reconstruido){
    L.push({txt:''});
    texto('* caixa anterior a V175: valores recalculados',true);
  }
  return {linhas:L,cols:cols,mm:papel};
}
function imprimirFechamento(id){
  var cx=(DB.caixas||[]).find(function(c){return c.id===id});
  if(!cx){toast('Caixa não encontrado.');return;}
  if(!cx.fechadoEm){toast('Este caixa ainda está aberto.');return;}
  var r=linhasFechamento(cx);
  imprimirPapel(r.linhas,r.cols,1,r.mm);
}
/* ==========================================================
   O COMPROVANTE DA ABERTURA

   O fechamento imprimia; a abertura, nao. E a abertura e justamente o
   momento em que alguem declara quanto dinheiro havia na gaveta antes
   de a loja vender qualquer coisa. Sem papel, o fundo de troco vira
   palavra: quem abriu, com quanto, a que horas.

   Segue o desenho do comprovante de retirada que a rede ja usa — o
   cabecalho, o titulo, o bloco com caixa/periodo/operador, o VALOR em
   destaque e a linha da assinatura. Mesma bobina, mesma conta de
   largura do fechamento.
   ========================================================== */
function linhasAbertura(cx){
  /* ==========================================================
     COMPROVANTE CURTO PEDE LETRA GRANDE

     Este comprovante tem oito informacoes. Montado em 48 colunas, como
     o fechamento, a letra saia com 1,6 mm de largura na bobina de
     80 mm — legivel na tela, pequena demais no papel termico, ainda
     mais no balcao, com pouca luz.

     Em 32 colunas o texto continua cabendo folgado e a letra cresce
     50%: e a mesma bobina, so que com menos colunas. A bobina de 58 mm
     ja usava 32 colunas e nao muda nada.
     ========================================================== */
  var papel=80;
  try{ var m=modeloImp('ficha'); if(m)papel=papelDoModelo(m); }catch(e){}
  var cols=(papel===58?24:32);
  var L=[];
  var esq=function(t,n){ t=String(t==null?'':t);
    return t.length>n?t.slice(0,n):t+new Array(n-t.length+1).join(' '); };
  var dir=function(t,n){ t=String(t==null?'':t);
    return t.length>n?t.slice(t.length-n):new Array(n-t.length+1).join(' ')+t; };
  var regra=function(c){ L.push({txt:new Array(cols+1).join(c)}); };
  /* nenhuma linha solta pode passar da largura da bobina */
  var cab=function(a,b){
    var t=b?a+'  '+b:a;
    if(t.length<=cols){ L.push({txt:t}); return; }
    L.push({txt:String(a).slice(0,cols)});
    if(b)L.push({txt:String(b).slice(0,cols)});
  };

  var quando=String(cx.aberto||'').split(' ');
  var periodo=String(cx.turno||'1').replace(/^\s*turno\s*/i,'')||'1';
  /* a unidade que abriu o caixa manda no cabecalho — nunca o nome da
     rede, que e igual nas seis lojas */
  var loja=''; try{ loja=sucNome(cx.sucursalId||lojaAtualId())||''; }catch(e){}
  var empresa=''; try{ empresa=cfg().nomePublico||nomeLojaAtual()||''; }catch(e){}

  L.push({txt:String(loja||empresa).slice(0,cols),n:true});
  L.push({txt:''});
  cab('Data: '+(quando[0]||'-'),'Periodo: '+periodo);
  cab('Hora: '+(quando[1]||'-'));
  L.push({txt:''});
  L.push({txt:'ABERTURA DE CAIXA',n:true});
  L.push({txt:''});
  regra('-');
  /* o identificador interno do caixa saia aqui como "Caixa: thoatc" —
     texto de maquina no papel que o operador assina. Loja, data, hora,
     periodo e operador ja dizem de qual caixa se trata */
  cab('Periodo: '+periodo);
  cab('Operador: '+(cx.operador||'-'));
  /* a unidade ja e o cabecalho: repeti-la aqui so gastaria papel */
  L.push({txt:''});
  var v='VALOR: '+money(Number(cx.inicial)||0);
  L.push({txt:v.slice(0,cols),n:true});
  L.push({txt:''});
  L.push({txt:'FUNDO DE TROCO'});
  regra('-');
  L.push({txt:''});
  /* a linha da assinatura ocupa o que sobra da largura, sem estourar */
  var rot='Assinatura: ';
  L.push({txt:esq(rot,Math.min(rot.length,cols))+
    new Array(Math.max(2,cols-rot.length+1)).join('_')});
  return {linhas:L,cols:cols,mm:papel};
}
function imprimirAbertura(id){
  var cx=(DB.caixas||[]).find(function(c){return c.id===id});
  if(!cx){toast('Caixa não encontrado.');return;}
  var r=linhasAbertura(cx);
  /* uma via so: comprovante de abertura nao tem para quem dar a segunda */
  imprimirPapel(r.linhas,r.cols,1,r.mm);
}
function resumoDoCaixa(cx){
  baseFormas();
  var peds=(DB.pedidos||[]).filter(function(p){return p.caixaId===cx.id});
  var ok=peds.filter(function(p){return !ehCancelado(p)});
  var canc=peds.filter(function(p){return ehCancelado(p)});
  var total=ok.reduce(function(a,p){return a+(Number(p.total)||0)},0);
  var porForma={};
  ok.forEach(function(p){
    (p.pagamentos||[]).forEach(function(g){
      /* o pagamento guarda a forma em `forma`; aqui se lia `formaId`, que
         nao existe — TODA linha caia em "Nao informado" no aviso do
         gerente. Sexta ocorrencia do mesmo tipo de erro. */
      var f=(DB.formasPag||[]).find(function(x){return x.id===(g.forma||g.formaId)});
      var n=f?f.nome:'Não informado';
      porForma[n]=(porForma[n]||0)+(Number(g.valor)||0);
    });
  });
  var movs=(cx.movimentos||[]);
  var sangrias=movs.filter(function(m){return m.tipo==='sangria'})
    .reduce(function(a,m){return a+(Number(m.valor)||0)},0);
  var supri=movs.filter(function(m){return m.tipo==='suprimento'})
    .reduce(function(a,m){return a+(Number(m.valor)||0)},0);
  var dinheiro=porForma['Dinheiro']||0;
  return {
    qtd:ok.length,total:total,
    formas:Object.keys(porForma).map(function(n){return {nome:n,valor:porForma[n]}})
      .sort(function(a,b){return b.valor-a.valor}),
    sangrias:sangrias,suprimentos:supri,
    esperado:(Number(cx.inicial)||0)+dinheiro+supri-sangrias,
    contado:Number(cx.contado)||0,
    canceladas:canc.length,
    vcanceladas:canc.reduce(function(a,p){return a+(Number(p.total)||0)},0)
  };
}
/* ---------- tela ---------- */
var GE={suc:''};
function telaGerente(){
  baseMov();baseSuc();baseGerente();
  if(!GE.suc)GE.suc=(sucAtivas()[0]||{}).id||'';
  var g=DB.gerente[GE.suc]||{};
  $('content').innerHTML='<div class="etWrap"><div class="etScroll">'+
   '<div class="etTopo">'+
    '<div><h1>Assistente Joia</h1>'+
    '<p>Ela avisa o que acontece na loja, cobra as rotinas e responde o que você '+
    'perguntar sobre venda, estoque e contas — pelo WhatsApp.</p></div>'+
    '<div style="flex:1"></div>'+
    '<button class="btnP2" onclick="testarAvisoGerente()">'+sv('chat',13)+' Enviar teste</button>'+
    '<button class="btnP2 ok" onclick="salvarGerente()">'+sv('check',13)+' Salvar</button>'+
   '</div>'+
   '<div class="barraF">'+
    '<div class="bfCampo" style="min-width:230px"><label>Loja</label>'+
     /* trocar de loja aqui jogava a tela para o topo — o `window.scrollTo(0,0)`
        que estava nesta linha. Quem estava conferindo o rodape da configuracao
        perdia o lugar a cada troca. O sistema ja guarda e devolve a rolagem
        pelo `_rolChave`; nao precisa de empurrao. */
     '<select onchange="GE.suc=this.value;telaGerente()">'+
     sucAtivas().map(function(s){
       return '<option value="'+s.id+'"'+(GE.suc===s.id?' selected':'')+'>'+E(s.nome)+'</option>';
     }).join('')+'</select></div>'+
    '<div class="bfCampo"><label>Situação</label>'+
     /* grava na hora: marcar e esquecer de salvar fazia a caixinha voltar
        sozinha, e a pessoa achava que o sistema tinha ignorado o clique */
     '<label class="chkL" style="height:32px;margin:0"><input type="checkbox" id="geAtivo" '+
     (g.ativo?'checked':'')+' onchange="ligarAvisos(this.checked)">'+
     '<span>avisos ligados</span></label></div>'+
   '</div>'+
   '<div class="cfgDuas">'+
    '<div class="cfgCol"><div class="colH">O que avisar</div>'+
     '<div class="colB" style="padding:16px">'+
      /* Nome e WhatsApp saíam duas vezes na mesma tela, aqui e na Assistente,
         para a mesma pessoa. Duas caixas para o mesmo dado divergem: alguém
         corrige uma e esquece a outra. Ficou só a de baixo. */
      '<div class="ctNota" style="margin-bottom:14px">'+
       (g.tel
        ?'Os avisos vão para <b>'+E(g.donoNome||g.nome||'o dono da loja')+'</b> — '+
         E(g.tel)+'.<br><small style="opacity:.85">Para mudar, use o campo '+
         '<b>WhatsApp do dono da loja</b>, na Assistente, aqui embaixo.</small>'
        :'<b>Nenhum WhatsApp cadastrado.</b><br><small style="opacity:.85">Preencha '+
         'o <b>WhatsApp do dono da loja</b> na Assistente, aqui embaixo, e salve.</small>')+
      '</div>'+
      '<div class="chkGrade">'+
       '<label class="chkL"><input type="checkbox" id="geAb" '+(g.avisaAbertura!==false?'checked':'')+'>'+
        '<span><b>Abertura de caixa</b><span>quem abriu, a que horas e com quanto de troco</span></span></label>'+
       '<label class="chkL"><input type="checkbox" id="geFe" '+(g.avisaFechamento!==false?'checked':'')+'>'+
        '<span><b>Fechamento de caixa</b><span>o resumo completo do turno, com as formas de pagamento</span></span></label>'+
       '<label class="chkL"><input type="checkbox" id="geCa" '+(g.avisaCancelamento!==false?'checked':'')+'>'+
        '<span><b>Venda cancelada</b><span>avisa na hora, com o valor e quem cancelou</span></span></label>'+
       '<label class="chkL"><input type="checkbox" id="geSa" '+(g.avisaSangria!==false?'checked':'')+'>'+
        '<span><b>Sangria de caixa</b><span>toda retirada de dinheiro da gaveta</span></span></label>'+
      '</div>'+
      /* Sem botão aqui, a caixinha "avisos ligados" voltava sozinha ao trocar
         de tela — a pessoa marcava e o sistema esquecia. */
      '<div style="display:flex;gap:9px;align-items:center;margin-top:14px">'+
       '<button class="btnP2 ok" onclick="salvarAssistente()">'+sv('check',13)+' Salvar</button>'+
       '<span class="hint">grava esta tela inteira</span>'+
      '</div>'+
     '</div></div>'+
    '<div class="cfgCol estreita"><div class="colH">Como o gerente recebe</div>'+
     '<div class="colB" style="padding:14px">'+
      '<div class="zapPrev">'+previewMsg2(msgAbertura({operador:'Maria',inicial:200}))+'</div>'+
      '<div class="zapPrev">'+previewMsg2('⚠️ *Venda cancelada*\\n\\n'+E(nomeLojaAtual())+'\\n'+agoraBR()+
       '\\n\\nPedido: *#1042*\\nValor: *R$ 96,00*\\nCliente: Daisa')+'</div>'+
      '<div class="hint" style="margin-top:12px">As mensagens saem pelo mesmo WhatsApp '+
      'conectado ao robô. Se ele estiver desconectado, os avisos não são enviados.</div>'+
     '</div></div>'+
   '</div>'+

   /* a assistente responde perguntas e cobra as rotinas */
   (ehPlataforma(usuarioLogado())?blocoAssPlataforma():'')+
   '<div class="cfgSep" style="margin:14px 16px 0">Assistente</div>'+
   '<div style="padding:10px 16px 0">'+
    '<label class="chkL"><input type="checkbox" id="geAss" '+
     (g.assistente!==false?'checked':'')+'>'+
     '<span><b>Responder perguntas do gestor</b><span>faturamento do dia, saldo de um '+
     'item, o que precisa comprar, boletos a vencer — e cobrar as rotinas</span></span></label>'+
    '<div class="row2" style="margin-top:12px">'+
     '<div class="fld2"><label>Nome da assistente nesta loja</label>'+
      '<input id="geAssN" value="'+E(g.assNome||'')+'" placeholder="ex: Adilson, Maria"></div>'+
     '<div class="fld2"><label>Situação</label>'+
      (assLiberada(GE.suc)
       ?'<div class="assOk">'+sv('check',14)+' Assistente conectada'+
        '<span>'+E(baseAssPlat().numero)+'</span></div>'
       :'<div class="assOff">'+sv('help',14)+' Não contratada'+
        '<span>fale com a franqueadora para liberar</span></div>')+
     '</div>'+
    '</div>'+
    '<div class="row2">'+
     '<div class="fld2"><label>Nome do dono da loja</label>'+
      '<input id="geDonoN" value="'+E(g.donoNome||'')+'" placeholder="quem conversa com ela"></div>'+
     '<div class="fld2"><label>WhatsApp do dono da loja</label>'+
      '<input id="geDonoZ" value="'+E(g.donoZap||g.tel||'')+'" placeholder="só este número recebe"></div>'+
    '</div>'+
    '<div class="cfgSep" style="margin:14px 0 0">Relatório para a franqueadora</div>'+
    '<div class="row2" style="margin-top:10px">'+
     '<div class="fld2"><label>WhatsApp da franqueadora</label>'+
      '<input id="geRelZ" value="'+E(g.relZap||'')+'" placeholder="recebe o PDF pela assistente"></div>'+
     '<div class="fld2"><label>E-mail (opcional)</label>'+
      '<input id="geEmail" value="'+E(g.emailRel||'')+'" placeholder="franqueadora@empresa.com"></div>'+
     '<div class="fld2" style="max-width:200px"><label>Enviar a cada</label>'+
      '<select id="geFreq">'+
       ['diaria|1 dia','tresdias|3 dias','quatrodias|4 dias','cincodias|5 dias',
        'semanal|7 dias','mensal|30 dias']
        .map(function(o){var p=o.split('|');
          return '<option value="'+p[0]+'"'+((g.freqRel||'semanal')===p[0]?' selected':'')+'>'+p[1]+'</option>';})
        .join('')+
      '</select></div>'+
    '</div>'+
    /* Sem botão, o que a pessoa digitava se perdia ao trocar de tela — e ela
       só descobria depois, quando a assistente não respondia. */
    '<div style="display:flex;gap:9px;align-items:center;margin:14px 0 4px">'+
     '<button class="btnP2 ok" onclick="salvarAssistente()">'+sv('check',13)+' Salvar assistente</button>'+
     '<span class="hint" id="assSalvoAviso"></span>'+
    '</div>'+
   '</div>'+

   blocoRotinas()+
   '<div class="cfgSep" style="margin:14px 16px 0">Respostas gravadas</div>'+
   '<div style="padding:8px 16px 20px">'+
    '<div class="hint" style="margin-bottom:9px">Cada pergunta que a assistente faz e cada '+
    'resposta do gestor ficam registradas aqui, com data e hora. É este registro que vai '+
    'no relatório da franqueadora.</div>'+
    '<div class="acTabW" id="assResp"></div>'+
   '</div>'+
   '</div></div>';
  carregarRespostasAss();
  carregarRotinas();
  rodape(g.tel?'assistente: '+g.tel:'sem WhatsApp cadastrado');
}
/* Grava a configuração da assistente desta loja. Fica no aparelho e sobe com
   o resto — o robô lê de whatsapp_config para saber de quem é o número que
   escreveu e para onde mandar o relatório. */
/* Um botão só para a tela inteira: confere, grava no aparelho e publica em
   whatsapp_config — é de lá que o robô lê para saber de quem é o número que
   escreveu e para onde mandar o relatório. */

function salvarAssistente(){
  baseGerente();
  if(!GE.suc){toast('Escolha a loja primeiro.');return;}
  DB.gerente[GE.suc]=DB.gerente[GE.suc]||{};

  var zapDono=soDigitos(($('geDonoZ')||{}).value);
  var zapFranq=soDigitos(($('geRelZ')||{}).value);
  if(zapDono&&zapDono.length<10){
    toast('O WhatsApp do dono parece incompleto — use DDD e número.');return;}
  if(zapFranq&&zapFranq.length<10){
    toast('O WhatsApp da franqueadora parece incompleto — use DDD e número.');return;}
  var em=(($('geEmail')||{}).value||'').trim();
  if(em&&!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)){
    toast('O e-mail não parece válido.');return;}

  salvarGerente();

  /* Redesenhar a tela ao salvar jogava a pessoa de volta ao topo no meio do
     preenchimento, e o que ela tinha marcado e ainda não salvo voltava ao
     estado antigo. A tela já reflete o que está gravado — não há o que
     redesenhar. */
  var av=document.getElementById('assSalvoAviso');
  if(av){
    av.textContent='Guardado às '+agoraHM()+'.';
    setTimeout(function(){ if(av)av.textContent=''; },4000);
  }
}
/* a caixinha de avisos grava sozinha, sem redesenhar a tela */
function ligarAvisos(lig){
  baseGerente();
  if(!GE.suc)return;
  DB.gerente[GE.suc]=DB.gerente[GE.suc]||{};
  DB.gerente[GE.suc].ativo=!!lig;
  salvar();
  publicarAssistente(GE.suc);
  toast(lig?'Avisos ligados.':'Avisos desligados.');
}
function previewMsg2(t){
  return String(t||'').replace(/\*(.+?)\*/g,'<b>$1</b>').replace(/\n/g,'<br>');
}
/* painel do dono da Joia: um número para tudo, liberado loja a loja */
function blocoAssPlataforma(){
  var a=baseAssPlat();
  baseSuc();
  return '<div class="assPlat">'+
   '<div class="assPlatH">'+sv('lock',14)+' <b>Administração da Joia</b>'+
    '<span>só você vê este bloco</span></div>'+
   '<div style="padding:13px 15px">'+
    '<div class="row2">'+
     '<div class="fld2"><label>Número da Assistente Joia</label>'+
      '<input id="apNum" value="'+E(a.numero||'')+'" placeholder="o número oficial da Meta"></div>'+
     '<div class="fld2"><label>Nome padrão</label>'+
      '<input id="apNome" value="'+E(a.nome||'Assistente Joia')+'"></div>'+
    '</div>'+
    '<div class="cfgSep" style="margin:12px 0 8px">Liberar para</div>'+
    '<div class="assLojas">'+
     (DB.sucursais||[]).filter(function(x){return x.ativa!==false}).map(function(sc){
       return '<label class="chkL"><input type="checkbox" data-suc="'+sc.id+'" '+
        (a.liberadas&&a.liberadas[sc.id]?'checked':'')+'>'+
        '<span><b>'+E(sc.nome)+'</b><span>'+E(sc.cidade||'')+'</span></span></label>';
     }).join('')+
    '</div>'+
    '<div class="avisoInfo" style="margin-top:12px">'+sv('help',15)+
     '<div><b>Serviço cobrado à parte.</b> O custo varia com a quantidade de mensagens '+
     'que a assistente envia por conta própria. Reveja antes de liberar para novas lojas.</div></div>'+
    '<button class="btnP2 ok" style="margin-top:12px" onclick="salvarAssPlat()">'+
     sv('check',13)+' Salvar liberações</button>'+
   '</div></div>';
}
async function salvarAssPlat(){
  var a=baseAssPlat();
  if($('apNum'))a.numero=$('apNum').value.trim();
  if($('apNome'))a.nome=$('apNome').value.trim()||'Assistente Joia';
  a.liberadas={};
  var cx=document.querySelectorAll('.assLojas input[data-suc]');
  for(var i=0;i<cx.length;i++)
    if(cx[i].checked)a.liberadas[cx[i].getAttribute('data-suc')]=true;
  salvar();
  /* publicarAssistente e assincrona: sem await, 'Liberações salvas' aparecia
     antes de qualquer unidade ter sido publicada de fato. */
  var sids=Object.keys(a.liberadas), falhas=[];
  for(var k=0;k<sids.length;k++){
    try{ await publicarAssistente(sids[k]); }
    catch(e){ falhas.push(sucNome(sids[k])||sids[k]); }
  }
  if(falhas.length){
    await confirmar({titulo:'Nem todas as unidades foram publicadas',
      texto:'Salvei aqui, mas estas não subiram: '+E(falhas.join(', ')),
      aviso:'Tente de novo quando a nuvem estiver ligada.',
      ok:'Entendi',cancelar:null});
  }else toast('Liberações salvas'+(sids.length?' e publicadas.':'.'));
}
/* o robô só conhece o gestor se o número chegar no banco */
/* ==========================================================
   GRAVACAO POR COLUNA — whatsapp_config
   Duas telas moram na MESMA linha desta tabela: a da Carla (robo) e a do
   Assistente. Cada uma mandava a linha inteira com merge-duplicates, e
   merge-duplicates SUBSTITUI a linha: as colunas que a tela nao conhecia
   voltavam para nulo. Resultado: configurar o Assistente e depois salvar a
   Carla apagava gestor_zap, assistente_ativa e mais cinco campos — e vice-
   versa. Nao era "a atualizacao apagou", era uma tela apagando a outra.

   Aqui o PATCH so toca nas colunas enviadas. Se a linha ainda nao existe,
   o PATCH nao acha nada e ai sim criamos com POST. */
async function gravarCfgZap(sucursalId, campos){
  if(!NUVEM.ligada||!NUVEM.loja||!sucursalId)return false;
  var r=await api('whatsapp_config?sucursal_id=eq.'+encodeURIComponent(sucursalId),
                  'PATCH',campos,{'Prefer':'return=representation'});
  if(Array.isArray(r)&&r.length)return true;
  /* linha inexistente: cria com as colunas desta tela + as chaves */
  var novo={}; for(var k in campos)novo[k]=campos[k];
  novo.loja_id=NUVEM.loja; novo.sucursal_id=sucursalId;
  novo.ref_local='wz_'+sucursalId;
  await api('whatsapp_config?on_conflict=sucursal_id','POST',[novo],
            {'Prefer':'resolution=merge-duplicates'});
  return true;
}
async function publicarAssistente(suc){
  if(!NUVEM.ligada||!NUVEM.loja)return;
  var g=(DB.gerente||{})[suc]||{};
  try{
    await gravarCfgZap(suc,{
      gestor_nome:g.donoNome||g.nome||null,
      gestor_zap:soDigitos(g.donoZap||g.tel||'')||null,
      assistente_nome:g.assNome||null,
      assistente_zap:soDigitos(g.assZap||'')||null,
      relatorio_zap:soDigitos(g.relZap||'')||null,
      relatorio_freq:g.freqRel||'semanal',
      /* Antes exigia g.ativo — a caixinha dos AVISOS DE CAIXA, lá no topo.
         São coisas independentes: a assistente ficava desligada mesmo com a
         caixinha dela marcada, e o agendador nem olhava para a loja. */
      assistente_ativa:!!(g.assistente!==false&&(g.donoZap||g.tel))
    });
    logNuvem('assistente publicada para o robô');
  }catch(e){ logNuvem('não consegui publicar a assistente: '+((e&&e.message)||''),true); }
}
/* ---------- detalhe de uma resposta e o PDF ----------
   A tabela mostra o essencial; o detalhe mostra a conversa que gerou o
   registro. É o que dá valor à trilha: não é "não fez", é "não fez porque
   faltou funcionário", com hora. */
var ASSR={lista:[]};

function verResposta(k){
  var c=ASSR.lista[k]; if(!c)return;
  var q=c.respondida_em?new Date(c.respondida_em):null;
  var e=c.enviada_em?new Date(c.enviada_em):null;
  var linha=function(r,v){
    return '<div style="display:flex;gap:10px;padding:9px 0;border-bottom:1px solid var(--line-2)">'+
      '<div style="width:130px;color:var(--ink-2);font-size:13px">'+r+'</div>'+
      '<div style="flex:1;font-size:13.5px">'+v+'</div></div>';
  };
  modal('Resposta registrada',
    linha('Rotina','<b>'+E(c.rotina_nome||'—')+'</b>')+
    linha('Data',dataBR(c.data))+
    linha('Perguntada em',e?e.toLocaleString('pt-BR').slice(0,16):'—')+
    linha('A pergunta',E(c.pergunta||'—'))+
    linha('Resposta',
      (c.feito===true?'<span class="badge2 vd">feito</span>'
      :c.feito===false?'<span class="badge2 rd">não fez</span>'
      :'<span class="badge2">sem resposta</span>')+
      (c.resposta?' <span style="opacity:.75">— '+E(c.resposta)+'</span>':''))+
    linha('Respondida em',q?q.toLocaleString('pt-BR').slice(0,16):'—')+
    (c.motivo?linha('Motivo informado','<i>"'+E(c.motivo)+'"</i>'):'')+
    linha('Telefone',E(c.telefone||'—'))+
    '<div class="hint" style="margin-top:14px">Este registro não pode ser alterado — '+
    'nem pela loja, nem pela matriz. É o que faz dele prova.</div>',
    'Fechar', function(){ return true; });
}

/* PDF pela impressão do navegador: sem biblioteca, e a pessoa escolhe
   salvar como PDF ou imprimir na hora. */
function pdfRespostas(){
  var r=ASSR.lista||[];
  if(!r.length){toast('Nada para gerar ainda.');return;}
  var sim=0,nao=0,sem=0;
  var linhas=r.map(function(c){
    if(c.feito===true)sim++; else if(c.feito===false)nao++; else sem++;
    var q=c.respondida_em?new Date(c.respondida_em):null;
    return '<tr><td>'+dataBR(c.data)+'</td><td>'+E(c.rotina_nome||'—')+'</td>'+
      '<td class="c">'+(c.feito===true?'FEITO':c.feito===false?'NÃO FEZ':'SEM RESPOSTA')+'</td>'+
      '<td>'+E(c.motivo||'')+'</td>'+
      '<td class="c">'+(q?q.toLocaleString('pt-BR').slice(0,16):'—')+'</td></tr>';
  }).join('');
  var w=window.open('','_blank');
  if(!w){toast('O navegador bloqueou a janela. Libere os pop-ups e tente de novo.');return;}
  w.document.write('<!doctype html><html><head><meta charset="utf-8">'+
   '<title>Checklist — '+E(nomeLojaAtual())+'</title><style>'+
   'body{font:13px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;color:#1a2734;margin:32px}'+
   'h1{font-size:19px;margin:0 0 3px}.sub{color:#667;margin:0 0 18px;font-size:13px}'+
   'table{width:100%;border-collapse:collapse}'+
   'th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.04em;'+
   'color:#667;border-bottom:2px solid #d8dee6;padding:7px 8px}'+
   'td{padding:7px 8px;border-bottom:1px solid #eef1f5;vertical-align:top}'+
   '.c{text-align:center}.res{margin-top:18px;padding-top:12px;border-top:2px solid #d8dee6}'+
   '.rod{margin-top:22px;color:#889;font-size:11px}'+
   '@media print{body{margin:14mm}}</style></head><body>'+
   '<h1>Relatório de checklist</h1>'+
   '<p class="sub">'+E(nomeLojaAtual())+' · gerado em '+new Date().toLocaleString('pt-BR').slice(0,16)+'</p>'+
   '<table><thead><tr><th>Data</th><th>Rotina</th><th class="c">Resposta</th>'+
   '<th>Motivo</th><th class="c">Respondida em</th></tr></thead><tbody>'+linhas+'</tbody></table>'+
   '<div class="res"><b>Resumo:</b> '+sim+' feito(s) · '+nao+' não feito(s) · '+sem+' sem resposta</div>'+
   '<p class="rod">Documento gerado pela Joia. O registro original fica no sistema, '+
   'com data e hora de cada resposta, e não pode ser alterado.</p>'+
   '</body></html>');
  w.document.close();
  setTimeout(function(){ try{w.print();}catch(e){_quieto(e,'pdfRespostas')} },400);
}

/* respostas gravadas pela assistente, para conferência e relatório */
async function carregarRespostasAss(){
  var box=document.getElementById('assResp');
  if(!box)return;
  if(!NUVEM.ligada){box.innerHTML='<div class="hint" style="padding:14px">'+
    'Ligue a nuvem para ver as respostas.</div>';return;}
  box.innerHTML='<div class="carregandoP">buscando as respostas...</div>';
  try{
    var r=await api('assistente_conversas?loja_id=eq.'+NUVEM.loja+
      '&order=enviada_em.desc&limit=200');
    if(!r||!r.length){box.innerHTML='<div class="hint" style="padding:14px">'+
      'Nenhuma resposta gravada ainda. Elas aparecem aqui assim que a assistente '+
      'começar a cobrar as rotinas.</div>';return;}
    ASSR.lista=r;
    box.innerHTML=
     '<div style="display:flex;gap:8px;align-items:center;margin-bottom:10px">'+
      '<button class="btnP2" onclick="pdfRespostas()">'+sv('file',13)+' Gerar PDF</button>'+
      '<span class="hint">'+r.length+' registro(s) — últimos primeiro</span>'+
     '</div>'+
     '<table class="acTab semBusca"><thead><tr>'+
     '<th style="width:92px">Data</th><th style="width:74px">Hora</th>'+
     '<th>Rotina</th><th style="width:96px">Resposta</th>'+
     '<th style="width:150px">Respondida em</th>'+
     '<th style="width:46px"></th></tr></thead><tbody>'+
     r.map(function(c,k){
       var q=c.respondida_em?new Date(c.respondida_em):null;
       var e=c.enviada_em?new Date(c.enviada_em):null;
       return '<tr><td>'+dataBR(c.data)+'</td>'+
        '<td>'+(e?e.toLocaleTimeString('pt-BR').slice(0,5):'—')+'</td>'+
        '<td>'+E(c.rotina_nome||'—')+
          (c.motivo?'<div class="hint" style="margin:2px 0 0">'+E(c.motivo)+'</div>':'')+'</td>'+
        '<td>'+(c.feito===true?'<span class="badge2 vd">feito</span>'
              :c.feito===false?'<span class="badge2 rd">não fez</span>'
              :'<span class="badge2">sem resposta</span>')+'</td>'+
        '<td>'+(q?q.toLocaleString('pt-BR').slice(0,16):'—')+'</td>'+
        '<td style="text-align:right"><button class="btnMini" title="ver detalhe" '+
         'onclick="verResposta('+k+')">'+sv('eye',12)+'</button></td></tr>';
     }).join('')+'</tbody></table>';
  }catch(e){
    box.innerHTML='<div class="hint" style="padding:14px">Não consegui buscar: '+
      E((e&&e.message)||'')+'</div>';
  }
}
function salvarGerente(){
  baseGerente();
  var g=DB.gerente[GE.suc];
  g.ativo=$('geAtivo')?$('geAtivo').checked:true;
  g.avisaAbertura=$('geAb').checked;
  g.avisaFechamento=$('geFe').checked;
  g.avisaCancelamento=$('geCa').checked;
  g.avisaSangria=$('geSa').checked;
  if($('geAss'))g.assistente=$('geAss').checked;
  if($('geAssN'))g.assNome=$('geAssN').value.trim();
  g.assZap=baseAssPlat().numero||'';
  if($('geDonoN')){g.donoNome=$('geDonoN').value.trim();g.nome=g.donoNome;}
  if($('geDonoZ')){g.donoZap=soDigitos($('geDonoZ').value);g.tel=g.donoZap;}
  if($('geRelZ'))g.relZap=$('geRelZ').value.trim();
  if($('geEmail'))g.emailRel=$('geEmail').value.trim();
  if($('geFreq'))g.freqRel=$('geFreq').value;
  salvar();
  publicarAssistente(GE.suc);
  if(g.ativo&&!g.tel)toast('Informe o WhatsApp para a assistente funcionar.');
  else toast('Assistente salva.');
}
async function testarAvisoGerente(){
  /* o campo saiu da tela: o número agora vem do dono da loja, na Assistente */
  var tel=soDigitos(($('geDonoZ')||{}).value)||(DB.gerente[GE.suc]||{}).tel||'';
  if(!tel){toast('Preencha o WhatsApp do dono da loja, na Assistente, e salve.');return;}
  var g=DB.gerente[GE.suc];
  g.tel=tel;g.ativo=true;salvar();
  await avisarGerente(GE.suc,'teste',
    '✅ *Teste da Joia*\n\n'+E(nomeLojaAtual())+'\n'+agoraBR()+
    '\n\nSe você recebeu esta mensagem, os avisos do caixa estão funcionando.');
}

/* ==========================================================
   OPERADORES — quem trabalha no caixa
   ========================================================== */
function baseOper(){
  DB.operadores=DB.operadores||[];
  if(!DB.operadores.length)
    DB.operadores.push({id:'op_adm',nome:'Administrador',funcao:'administrador',
      senha:'',ativo:true,sucursais:[]});
  return DB.operadores;
}
/* A função descreve o papel da pessoa na loja e é o que aparece na abertura
   de caixa e nas ordens de produção. Quem manda no que ela enxerga são as
   telas marcadas no cadastro — a função não dá nem tira permissão. */
/* ==========================================================
   ITENS 10, 11 e 12 — UMA FONTE SO DE AUTORIZACAO DO CAIXA

   Antes existiam DUAS listas paralelas:

   - abertura e fechamento liam `DB.operadores` (so operadores);
   - cancelamento lia `operAtivos()` (usuarios + operadores).

   Quem estava cadastrado como usuario nao aparecia para abrir caixa;
   quem estava como operador nao aparecia igual nos dois lugares. E a
   mesma pessoa podia ter senha num lugar e nao no outro.

   Pior: SANGRIA E SUPRIMENTO nao pediam senha nenhuma. Tirar dinheiro
   da gaveta exigia apenas digitar um nome num campo de texto livre —
   qualquer nome, inclusive o de outra pessoa. Retirada de dinheiro sem
   assinatura e o buraco mais serio deste modulo.

   Agora toda acao do caixa passa por `autorizar(acao)`, que usa
   `operAtivos()` — a lista unica — e confere a permissao da funcao.

   PERMISSOES (item 12), por funcao:
   - abrir/fechar caixa ......... caixa, gerente, administrador
   - sangria/suprimento ......... gerente, administrador
   - cancelar venda ............. gerente, administrador
   Atendente e producao vendem, mas nao mexem em dinheiro nem cancelam.
   ========================================================== */
/* ==========================================================
   DECISAO DO RAFAEL: QUEM TEM SENHA PODE

   A primeira versao amarrava cada acao a um cargo — so gerente fazia
   sangria, so gerente cancelava. Numa loja de gelato com duas ou tres
   pessoas por turno isso trava a operacao: o gerente nao esta no balcao
   as 21h de um sabado, e a venda para.

   A regra passa a ser: QUALQUER operador pode, desde que tenha senha
   de autorizacao cadastrada e a digite. O que assina a operacao e a
   senha, nao o cargo.

   Consequencia que fica registrada: com todos podendo tudo, a senha
   vira o unico controle. Quem nao deve autorizar sangria simplesmente
   nao recebe senha — e o cadastro em Operadores do Caixa passa a ser a
   ferramenta de controle. Se um dia a rede crescer e for preciso
   separar por cargo de novo, basta voltar a listar os cargos aqui.
   ========================================================== */
var PERM_CAIXA={};   /* vazio = sem restricao por cargo */
/* acoes que exigem senha cadastrada para serem autorizadas */
var EXIGE_SENHA=['sangria','suprimento','cancelar','fechar'];
var NOME_ACAO={abrir:'abrir o caixa',fechar:'fechar o caixa',
  sangria:'fazer sangria',suprimento:'lançar suprimento',cancelar:'cancelar venda'};

/* ==========================================================
   ITEM 2 — A SENHA VIRA HASH, E A CONFERENCIA SAI DO NAVEGADOR

   Ate aqui a senha do operador ficava em texto puro no banco e era
   comparada no navegador (`sn === op.senha`). Guardar hash sozinho nao
   resolveria nada: se a comparacao continua no navegador, o dado
   precisa chegar ate ele — e quem abre o console ve.

   Agora sao duas mudancas juntas:
   - o banco guarda BCRYPT (tabela `operador_senhas`, fechada por RLS:
     nenhuma consulta do cliente le aquela tabela);
   - a conferencia acontece NO BANCO (`senha_operador_conferir`), que
     devolve apenas sim ou nao.

   O navegador nunca ve o hash nem a senha de ninguem. Ele so sabe QUEM
   tem senha cadastrada, para desenhar o campo — e isso vem de uma
   funcao que devolve so a lista de identificadores.

   Sem rede o aparelho nao consegue conferir. Nesse caso a acao e
   recusada com a razao dita na tela, em vez de liberar por omissao:
   liberar sem conferir e o mesmo buraco de antes.
   ========================================================== */
var _quemTemSenha=null;
/* ==========================================================
   "A SENHA DO OPERADOR SUMIU DEPOIS DA ATUALIZACAO" (itens 8 e 26)

   A senha NUNCA some: ela vive como hash no banco e nao depende de
   arquivo, build ou navegador. O que some e a LISTA de quem tem senha.

   `carregarQuemTemSenha` engolia qualquer erro num `catch` silencioso e
   deixava `_quemTemSenha` como estava — nulo. Ai `temSenhaCadastrada`
   caia no `!!op.senha`, que e SEMPRE falso de proposito (o cadastro
   local nao guarda senha, por seguranca).

   Resultado na tela: todo mundo aparece sem senha, `operadoresPara`
   devolve lista vazia e o sistema diz "Ninguem com senha de autorizacao
   cadastrada" — a sangria, o cancelamento e o fechamento ficam
   impossiveis. Parece que a atualizacao apagou as senhas. Nao apagou:
   a consulta falhou e ninguem foi avisado.

   Erro silencioso em operacao critica e proibido (item 26). Agora:

   1. a falha e registrada e a tela avisa;
   2. `_quemTemSenha` distingue tres estados — nunca carregou (null),
      falhou (false) e carregou (lista);
   3. quando falhou, a mensagem diz o motivo real em vez de mentir que
      nao ha senha cadastrada;
   4. uma nova tentativa e feita antes de bloquear a operacao.
   ========================================================== */
async function carregarQuemTemSenha(){
  if(!NUVEM.ligada)return null;
  try{
    /* manda a loja junto: a funcao tenta pela sessao primeiro, e usa este
       valor se a sessao nao souber dizer */
    var r=await api('rpc/senha_operador_quem_tem','POST',{p_loja:NUVEM.loja||null});
    _quemTemSenha=Array.isArray(r)?r:(r||[]);
    _falhouQuemTemSenha=false;
  }catch(e){
    _quieto(e,'carregarQuemTemSenha');
    _falhouQuemTemSenha=true;
    /* nao zera o que ja tinha: lista velha e melhor que lista nenhuma */
    if(!Array.isArray(_quemTemSenha))_quemTemSenha=null;
  }
  return _quemTemSenha;
}
var _falhouQuemTemSenha=false;
/* ==========================================================
   UMA FONTE SO PARA A SENHA DE AUTORIZACAO (GL-04)

   Duas telas cadastram gente que assina no balcao, e cada uma tinha o
   SEU bloco de codigo para gravar a senha: `telaOperadores` (quem so
   assina, sem login) e `Usuarios e Permissoes` (quem tambem entra no
   sistema). As duas telas continuam — os papeis sao diferentes de
   verdade e juntar seria pior.

   O que nao pode continuar e a LOGICA em dois lugares. Dois blocos
   parecidos divergem: um ganha uma trava, o outro nao; um recarrega a
   lista depois de gravar, o outro esquece. Foi assim que nasceram
   metade dos defeitos deste arquivo.

   Daqui em diante as duas telas chamam esta funcao. Se a regra mudar —
   tamanho minimo, registro de auditoria, politica de troca — muda aqui,
   uma vez.

   A senha nunca fica no cadastro: vai para `operador_senhas` como hash
   bcrypt e nunca volta ao navegador.
   ========================================================== */
async function definirSenhaOperador(ref, senha, ondeVoltar){
  if(!ref)return {ok:false, msg:'Não consegui identificar quem recebe a senha.'};
  if(!senha)return {ok:true, msg:''};              /* campo vazio = manter a atual */
  if(String(senha).length<4)
    return {ok:false, msg:'A senha de autorização precisa ter ao menos 4 dígitos.'};
  if(!NUVEM.ligada)
    return {ok:false, msg:'Sem conexão: a senha só pode ser cadastrada online.'};
  try{
    await api('rpc/senha_operador_definir','POST',
      {op_ref:ref, senha:senha, p_loja:NUVEM.loja||null});
    await carregarQuemTemSenha();
    return {ok:true, msg:'Senha de autorização cadastrada.'};
  }catch(e){
    _quieto(e,'definirSenhaOperador');
    return {ok:false, msg:'Não consegui gravar a senha de autorização.'};
  }
}
/* ==========================================================
   POR QUE NAO HA NINGUEM NA LISTA? (item 27)

   Tres motivos diferentes davam a MESMA mensagem: "cadastre em
   Operadores do Caixa". Duas dessas vezes a mensagem estava errada e
   mandava a loja procurar solucao no lugar errado, no meio do
   expediente.

   Agora cada motivo tem a sua frase, e a lista de senhas ganha uma
   segunda chance antes de o sistema desistir.
   ========================================================== */
async function motivoSemOperador(oque){
  if(!NUVEM.ligada)
    return 'Sem conexão com a nuvem — não dá para conferir quem tem '+oque+'. '+
           'Verifique a internet e tente de novo.';
  if(!listaDeSenhasOk()){
    await carregarQuemTemSenha();          /* segunda chance */
    if(!listaDeSenhasOk())
      return 'Não consegui carregar a lista de autorizações. '+
             'As senhas continuam cadastradas no banco — é a consulta que falhou. '+
             'Tente de novo em alguns segundos.';
  }
  if(!operAtivos().length)
    return 'Nenhum usuário ativo nesta unidade. Cadastre em Usuários e Permissões.';
  return 'Ninguém com '+oque+'. Cadastre em Operadores do Caixa.';
}
/* a lista de quem tem senha esta confiavel? */
function listaDeSenhasOk(){ return Array.isArray(_quemTemSenha); }
function temSenhaCadastrada(op){
  if(!op)return false;
  if(Array.isArray(_quemTemSenha))return _quemTemSenha.indexOf(op.id)>=0;
  return !!op.senha;           /* aparelho ainda sem a lista: usa o que tem */
}
async function conferirSenhaNoBanco(opId,senha){
  if(!NUVEM.ligada)return {erro:'sem conexão com a nuvem'};
  try{
    var r=await api('rpc/senha_operador_conferir','POST',
      {op_ref:opId,senha:senha||'',p_loja:NUVEM.loja||null});
    var d=(r&&r.length)?r[0]:r;
    /* cinco erros seguidos bloqueiam por cinco minutos: e o que impede
       alguem de ficar testando senha, agora que a conferencia nao depende
       mais da sessao estar perfeita */
    if(d&&d.bloqueado){
      var q=d.ate?new Date(d.ate).toLocaleTimeString('pt-BR').slice(0,5):'';
      return {erro:'muitas tentativas — tente de novo'+(q?' às '+q:' em 5 minutos')};
    }
    return {confere:!!(d&&d.confere), tem:!!(d&&d.tem_senha)};
  }catch(e){
    _quieto(e,'conferirSenhaNoBanco');
    /* diz o motivo REAL. A mensagem generica "sem conexão" mandava a loja
       procurar problema de internet quando o defeito era outro. */
    var m=String((e&&(e.message||e.hint))||'').slice(0,90);
    return {erro:m||'não consegui conferir a senha'};
  }
}
/* ==========================================================
   A EXIGENCIA DE SENHA NAO PODE VIRAR PORTA TRANCADA

   29/08/2026: a loja de Santa Fe do Sul nao conseguia fechar o caixa.
   Nao era nuvem, nao era sessao. Fechar caixa exige senha de operador
   cadastrada — e no banco da Jolo NENHUM operador tem senha. Resultado:
   `operadoresPara('fechar')` devolvia lista VAZIA, o campo "Operador que
   fecha" so tinha "Selecione", e o clique em Confirmar morria com
   "Selecione quem esta autorizando". Sem saida, e sem dizer o porque.

   No log do servidor da para ver o tamanho do beco: 15 aberturas do
   modal de fechamento numa hora e ZERO conferencias de senha.

   A exigencia existe por um bom motivo — retirada de dinheiro sem
   assinatura foi um buraco real. Mas quando NINGUEM na loja tem senha,
   exigir assinatura nao protege nada: so impede a loja de fechar o
   caixa, com o dinheiro na gaveta.

   Entao: se ALGUEM ja tem senha, a regra continua inteira — quem nao
   tem, nao assina. Se NINGUEM tem, a operacao passa, identificada por
   quem a fez (fica gravada em `fechadoPor`), e o sistema cobra o
   cadastro das senhas na propria tela.
   ========================================================== */
function alguemTemSenha(){
  try{
    if(Array.isArray(_quemTemSenha))return _quemTemSenha.length>0;
    return (operAtivos()||[]).some(function(o){return !!o.senha});
  }catch(e){ return false; }
}
function podeFazer(op,acao){
  if(!op)return false;
  var lista=PERM_CAIXA[acao];
  if(lista&&lista.length&&lista.indexOf(op.funcao||'atendente')<0)return false;
  /* mexer em dinheiro e cancelar exigem senha cadastrada: sem senha nao ha
     como assinar a operacao, e retirada sem assinatura foi o buraco do item 10 */
  if(EXIGE_SENHA.indexOf(acao)>=0 && !temSenhaCadastrada(op) && alguemTemSenha())
    return false;
  return true;
}
/* quem pode aparecer na lista daquela acao */
function operadoresPara(acao){
  return operAtivos().filter(function(o){return podeFazer(o,acao)});
}
/* confere operador + senha + permissao. Devolve o operador ou null. */
async function autorizar(acao,id,senhaDigitada){
  var op=operAtivos().find(function(o){return o.id===id});
  if(!op){toast('Selecione quem está autorizando.');return null;}
  if(!podeFazer(op,acao)){
    toast(temSenhaCadastrada(op)
      ? op.nome+' não tem permissão para '+(NOME_ACAO[acao]||acao)+'.'
      : op.nome+' não tem senha de autorização — cadastre em Operadores do Caixa.');
    return null;}
  if(!temSenhaCadastrada(op))return op;      /* acao que nao exige senha */
  if(!senhaDigitada){toast('Digite a senha de '+op.nome+'.');return null;}
  var r=await conferirSenhaNoBanco(op.id,senhaDigitada);
  if(r.erro){
    toast(r.erro+' — '+(NOME_ACAO[acao]||acao)+' não autorizado.');
    return null;
  }
  if(!r.confere){toast('Senha incorreta.');return null;}
  return op;
}
var FUNCOES=[
 {id:'administrador',n:'Administrador',d:'acesso total ao sistema'},
 {id:'gerente',      n:'Gerente',      d:'acompanha a loja, vê relatórios e fecha caixa'},
 {id:'caixa',        n:'Operador de caixa',d:'abre e fecha caixa, lança vendas'},
 {id:'atendente',    n:'Atendente',    d:'lança vendas na frente de caixa'},
 {id:'producao',     n:'Produção',     d:'produz as fichas, lança perdas e movimenta estoque'},
 {id:'estoquista',   n:'Estoque',      d:'recebe nota, faz contagem e cuida do estoque'},
 {id:'financeiro',   n:'Financeiro',   d:'lança contas, concilia e acompanha o caixa'},
 {id:'entregador',   n:'Entregador',   d:'vê os pedidos de entrega'}
];
/* Quem abre o caixa vem de Usuários e Permissões, não de uma lista à parte.
   Duas telas cadastrando gente divergem: alguém cria numa, edita na outra,
   e ninguém sabe qual vale. Os operadores antigos continuam aparecendo até
   serem migrados, para não quebrar caixa já aberto. */
function operAtivos(){
  baseUsr();
  var dosUsuarios=(DB.usuarios||[]).filter(function(u){
    if(u.ativo===false)return false;
    if(String(u.login||'').toLowerCase()===ADM_MESTRE)return false;
    return true;
  }).map(function(u){
    /* ==========================================================
       A SENHA DO USUARIO NUNCA CHEGAVA NA TELA DE CANCELAMENTO

       Aqui se lia `u.senhaCaixa`, campo que NAO EXISTE: a tabela
       `usuarios_sistema` guarda `senha` (a mesma do login), e a descida
       monta o usuario com `senha`. Como `senhaCaixa` vinha sempre vazio,
       `op.senha` ficava vazio, a conferencia era pulada por completo — e
       a pessoa nao tinha como usar a senha que lhe foi designada.

       `funcao` tambem nao existe em usuarios_sistema; quem manda na
       rede e o par tudo/mestre. Traduzido aqui para o rotulo da tela.

       Quinta ocorrencia da mesma familia (V135, V136, V143, cardapio):
       campo com nome diferente entre quem grava e quem le, falhando em
       silencio.
       ========================================================== */
    /* a senha que vale aqui e a de AUTORIZACAO. A de entrar mora no
       servico de login, criptografada, e o navegador nao a enxerga. */
    return {id:u.id,nome:u.nome,
      funcao:(u.mestre?'administrador':(u.tudo?'gerente':'caixa')),
      /* `senha` aqui e so um sinal de que existe senha; o valor mora no cofre */
      senha:'',ativo:true,sucursais:u.sucursais||[],deUsuario:true};
  });
  var antigos=baseOper().filter(function(o){
    if(o.ativo===false)return false;
    /* já migrado? não repete */
    return !dosUsuarios.some(function(u){
      return String(u.nome||'').toLowerCase()===String(o.nome||'').toLowerCase();});
  });
  /* ==========================================================
     ENTRE DOIS DE MESMO NOME, VALE QUEM TEM SENHA

     Se a mesma pessoa existe como usuario (para entrar no sistema) e
     como operador (para assinar no balcao), a versao de usuario vencia
     por vir primeiro na lista. E comum o usuario estar sem senha de
     autorizacao e o operador ter — resultado: o nome aparecia, mas a
     assinatura ficava sem senha, valendo qualquer coisa.

     Agora, para nomes repetidos, a senha do operador preenche a lacuna
     do usuario. Nao se troca o registro, so se aproveita a senha.
     ========================================================== */
  var porNome={};
  baseOper().forEach(function(o){
    if(o.ativo===false||!o.senha)return;
    porNome[String(o.nome||'').toLowerCase()]=o.senha;
  });
  dosUsuarios.forEach(function(u){
    if(u.senha)return;
    var sn=porNome[String(u.nome||'').toLowerCase()];
    if(sn)u.senha=sn;
  });
  return dosUsuarios.concat(antigos);
}
function nomeFuncao(id){var f=FUNCOES.find(function(x){return x.id===id});return f?f.n:id}

function telaOperadores(){
  baseMov();baseSuc();baseOper();
  $('content').innerHTML='<div class="etWrap"><div class="etScroll">'+
   '<div class="etTopo">'+
    '<div><h1>Operadores do Caixa</h1>'+
    '<p>Quem trabalha na loja e precisa assinar abertura de caixa e cancelamento. '+
    '<b>Não entra no sistema</b> — por isso não pede e-mail nem senha de acesso, '+
    'só nome e uma senha curta para autorizar.</p></div>'+
    '<div style="flex:1"></div>'+
    '<button class="btnP2 ok" onclick="formOperador()">'+sv('plus',14)+' Cadastrar operador</button>'+
   '</div>'+
   '<div class="etTabW plano2">'+
   '<table class="etTab semBusca"><thead><tr>'+
    '<th style="width:38px"></th><th>Nome</th>'+
    '<th style="width:190px">Função</th>'+
    '<th style="width:150px">Senha do caixa</th>'+
    '<th style="width:100px;text-align:center">Situação</th>'+
    '<th style="width:90px"></th></tr></thead><tbody>'+
   DB.operadores.map(function(o){
     var turnos=(DB.caixas||[]).filter(function(c){return c.operador===o.nome}).length;
     return '<tr>'+
     '<td><div class="avOp">'+E((o.nome||'?').charAt(0).toUpperCase())+'</div></td>'+
     '<td><b>'+E(o.nome)+'</b>'+
      '<small style="display:block;color:var(--ink-3)">'+turnos+' turno(s) no caixa</small></td>'+
     '<td><span class="funcTag '+E(o.funcao)+'">'+E(nomeFuncao(o.funcao))+'</span></td>'+
     '<td>'+(o.senha?'<span class="hint">•••• definida</span>':'<span class="hint">sem senha</span>')+'</td>'+
     '<td style="text-align:center">'+(o.ativo!==false
       ?'<span class="badge2">Ativo</span>':'<span class="badge2 rd">Inativo</span>')+'</td>'+
     '<td><div class="rowAct">'+
      '<button class="rBtn" onclick="formOperador(\''+o.id+'\')">'+sv('edit',12)+'</button>'+
      (o.id==='op_adm'?'':'<button class="rBtn rd" onclick="excluirOperador(\''+o.id+'\')">'+sv('trash',12)+'</button>')+
     '</div></td></tr>';
   }).join('')+'</tbody></table></div>'+
   '<div class="hint" style="padding:14px 16px">A senha é usada para abrir e fechar o caixa. '+
   'Deixe em branco se a loja não usa senha.</div>'+
   '</div></div>';
  rodape(DB.operadores.length+' operadores');
}
function formOperador(id){
  baseOper();
  var o=id?DB.operadores.find(function(x){return x.id===id}):null;
  modal(o?'Editar operador':'Cadastrar operador',
  '<div class="mdB">'+
   '<div class="row2">'+
    '<div class="fld2" style="margin:0"><label>Nome *</label>'+
     '<input id="opNome" value="'+E(o?o.nome:'')+'" placeholder="como aparece no caixa"></div>'+
    '<div class="fld2" style="margin:0"><label>Senha para autorizar</label>'+
     '<input id="opSenha" type="password" value="" autocomplete="new-password" '+
     'placeholder="'+(o&&temSenhaCadastrada(o)?'já cadastrada — digite para trocar':'4 a 6 dígitos')+'"></div>'+
   '</div>'+
   '<div class="fld2"><label>Função *</label>'+
    '<div class="tipoEsc">'+FUNCOES.map(function(f){
      var sel=(o?o.funcao:'atendente')===f.id;
      return '<label class="tipoOp'+(sel?' on':'')+'">'+
       '<input type="radio" name="opFunc" value="'+f.id+'"'+(sel?' checked':'')+'>'+
       '<b>'+f.n+'</b><span>'+f.d+'</span></label>';
    }).join('')+'</div></div>'+
   '<label class="chkL"><input type="checkbox" id="opAtivo" '+(!o||o.ativo!==false?'checked':'')+'>'+
    '<span>Operador ativo — aparece na lista ao abrir o caixa</span></label>'+
  '</div>','Salvar',async function(){
    var nome=$('opNome').value.trim();
    if(!nome){toast('Informe o nome.');return false;}
    var func='atendente';
    var rs=document.querySelectorAll('input[name="opFunc"]');
    for(var i=0;i<rs.length;i++)if(rs[i].checked)func=rs[i].value;
    var sn=$('opSenha').value.trim();
    if(sn&&sn.length<4){toast('A senha para autorizar precisa ter ao menos 4 dígitos.');return false;}
    /* ==========================================================
       A SENHA VAI PARA O COFRE, NAO PARA O CADASTRO

       `senha:''` de proposito: o cadastro do operador guarda nome,
       funcao e situacao. A senha vira hash no banco e nunca mais volta
       para ca. Deixar uma copia aqui — mesmo por engano, mesmo "so por
       enquanto" — reabre exatamente o buraco que estamos fechando.
       ========================================================== */
    var dados={nome:nome,funcao:func,senha:'',ativo:$('opAtivo').checked};
    var _refOp=id||null;
    if(o)Object.assign(o,dados);
    else { var novo=Object.assign({id:uid('op'),sucursais:[]},dados);
           DB.operadores.push(novo); _refOp=novo.id; }
    salvar();
    /* a senha sobe separada, pela funcao unica (GL-04) */
    var rs=await definirSenhaOperador(_refOp, sn);
    toast(sn ? ('Operador salvo. '+rs.msg) : 'Operador salvo.');
    telaOperadores();
    return true;
  },'lg');
}
async function excluirOperador(id){
  var o=DB.operadores.find(function(x){return x.id===id});
  var turnos=(DB.caixas||[]).filter(function(c){return c.operador===(o||{}).nome}).length;
  if(turnos){
    await confirmar({titulo:'Não dá para excluir',
      texto:E((o||{}).nome)+' já trabalhou em '+turnos+' turno(s).',
      aviso:'Desative o operador em vez de excluir — o histórico continua correto.',
      ok:'Entendi',cancelar:null,tipo:'info'});
    return;
  }
  var ok=await confirmar({titulo:'Excluir '+E((o||{}).nome),ok:'Excluir',tipo:'perigo'});
  if(!ok)return;
  DB.operadores=DB.operadores.filter(function(x){return x.id!==id});
  salvar();telaOperadores();
}

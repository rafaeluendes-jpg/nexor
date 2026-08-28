/* ==========================================================
   TRANSFERENCIA ENTRE UNIDADES
   A matriz manda base para Jales; Jales devolve o que sobrou. Como o
   saldo agora e de cada unidade, mover mercadoria precisa TIRAR de uma
   e POR na outra — e nao apenas anotar.

   A transferencia fica em ABERTO ate o destino confirmar. Baixar na
   origem e creditar no destino no mesmo instante esconderia o que se
   perde no caminho, que e justamente o que a franqueadora quer ver.
   ========================================================== */
var TR={aba:'enviar',de:'',ate:'',destino:'',itens:[],busca:'',obs:''};

function baseTransf(){
  DB.transf=DB.transf||[];
  /* motivos proprios: sem eles o movimento apareceria sem explicacao no
     historico de estoque */
  baseMov();
  [['mv_transf_saida','Transferência enviada','saida'],
   ['mv_transf_entrada','Transferência recebida','entrada']].forEach(function(m){
    if(!(DB.motivosMov||[]).some(function(x){return x.id===m[0]}))
      DB.motivosMov.push({id:m[0],nome:m[1],tipo:m[2],sistema:true,ativo:true,sucursais:[]});
  });
  return DB.transf;
}
function proxNumTransf(){
  baseTransf();
  var max=0;
  DB.transf.forEach(function(t){if((t.numero||0)>max)max=t.numero||0});
  return max+1;
}
function transfDaUnidade(suc,tipo){
  baseTransf();
  suc=suc||lojaAtualId();
  return DB.transf.filter(function(t){
    if(tipo==='saida')return t.origemSuc===suc;
    if(tipo==='entrada')return t.destinoSuc===suc;
    return t.origemSuc===suc||t.destinoSuc===suc;
  }).sort(function(a,b){return String(b.enviadaEm||'').localeCompare(String(a.enviadaEm||''))});
}
function pendentesParaMim(){
  return transfDaUnidade(lojaAtualId(),'entrada')
    .filter(function(t){return t.situacao==='enviada'});
}
/* os itens que a unidade tem em estoque, para escolher o que mandar */
function itensTransferiveis(){
  var suc=lojaAtualId();
  var l=[];
  (DB.insumos||[]).forEach(function(i){
    if(i.ativo===false)return;
    var q=saldoUn(i.id,suc);
    l.push({id:i.id,tipo:'insumo',nome:i.nome,unidade:i.unidade,
      saldo:q,custo:custoMedioUn(i.id,suc)||Number(i.custo)||0});
  });
  (DB.fichas||[]).forEach(function(f){
    var q=saldoUn(f.id,suc);
    if(!q)return;                       /* ficha so aparece se tiver saldo */
    l.push({id:f.id,tipo:'ficha',nome:f.nome,unidade:f.unidade||'un',
      saldo:q,custo:custoMedioUn(f.id,suc)||0});
  });
  return l.sort(function(a,b){return a.nome.localeCompare(b.nome)});
}
function itemTransf(id){
  return TR.itens.find(function(x){return x.id===id})||null;
}
function porItemTransf(it){
  var ja=itemTransf(it.id);
  if(ja)return;
  TR.itens.push({id:it.id,tipo:it.tipo,nome:it.nome,unidade:it.unidade,
    qtd:0,custo:it.custo,saldo:it.saldo});
  telaTransferencia();
}
function tirarItemTransf(id){
  TR.itens=TR.itens.filter(function(x){return x.id!==id});
  telaTransferencia();
}
function qtdItemTransf(id,v){
  var it=itemTransf(id);if(!it)return;
  it.qtd=Math.max(0,Number(v)||0);
}
function totalTransf(l){
  return (l||TR.itens).reduce(function(a,i){
    return a+((Number(i.qtd)||0)*(Number(i.custo)||0));},0);
}

/* ---------- enviar ---------- */
async function enviarTransferencia(){
  var suc=lojaAtualId();
  if(!TR.destino){toast('Escolha a unidade de destino.');return;}
  if(TR.destino===suc){toast('Origem e destino são a mesma unidade.');return;}
  var itens=TR.itens.filter(function(i){return (Number(i.qtd)||0)>0});
  if(!itens.length){toast('Informe a quantidade de ao menos um item.');return;}

  /* nao deixa mandar o que nao tem: o saldo ficaria negativo na origem */
  var faltando=itens.filter(function(i){return i.qtd>saldoUn(i.id,suc)+0.0001});
  if(faltando.length){
    await confirmar({titulo:'Quantidade acima do estoque',
      texto:faltando.length+' item(ns) sem saldo suficiente',
      linhas:faltando.map(function(i){
        return [i.nome,'tem '+saldoUn(i.id,suc)+' '+i.unidade,'quer mandar '+i.qtd];}),
      aviso:'Ajuste as quantidades ou faça uma contagem de estoque antes.',
      ok:'Entendi',cancelar:null});
    return;
  }
  var tot=totalTransf(itens);
  var ok=await confirmar({
    titulo:'Enviar para '+sucNome(TR.destino),
    texto:itens.length+' item(ns) · R$ '+money(tot),
    linhas:itens.slice(0,8).map(function(i){
      return [i.nome,i.qtd+' '+i.unidade,'R$ '+money(i.qtd*i.custo)];}),
    aviso:'O estoque sai de '+sucNome(suc)+' agora. Ele só entra em '+
      sucNome(TR.destino)+' quando alguém de lá confirmar o recebimento — '+
      'assim, o que se perder no caminho aparece.',
    ok:'Enviar',tipo:'check'});
  if(!ok)return;

  baseTransf();baseMov();
  var t={id:uid('tr'),numero:proxNumTransf(),
    origemSuc:suc,destinoSuc:TR.destino,situacao:'enviada',
    itens:itens.map(function(i){
      return {id:i.id,tipo:i.tipo,nome:i.nome,unidade:i.unidade,
        qtd:Number(i.qtd),custo:Number(i.custo)||0};}),
    valorTotal:tot,obs:TR.obs||'',
    enviadaEm:new Date().toISOString(),
    enviadaPor:(usuarioLogado()||{}).nome||'',
    data:hojeISO()};
  DB.transf.push(t);

  /* baixa na origem, com motivo proprio para aparecer no historico */
  var mov={id:uid('mv'),sucursalId:suc,data:hojeISO(),hora:agoraHM(),
    motivoId:'mv_transf_saida',identificacao:'Transferência #'+t.numero+' → '+sucNome(TR.destino),
    obs:TR.obs||'',origem:'transferencia',
    linhas:t.itens.map(function(i){
      return {insumoId:i.id,nome:i.nome,unidade:i.unidade,qtd:i.qtd,
        custo:i.custo,direcao:'saida',origem:'transferencia'};})};
  DB.movEst.push(mov);
  aplicarMovimento(mov);

  TR.itens=[];TR.obs='';TR.destino='';
  salvar();telaTransferencia();
  toast('Transferência #'+t.numero+' enviada para '+sucNome(t.destinoSuc)+'.');
  if(NUVEM.ligada)sincronizar();
}

/* ---------- receber ---------- */
async function receberTransferencia(id){
  var t=baseTransf().find(function(x){return x.id===id});
  if(!t||t.situacao!=='enviada')return;
  if(t.destinoSuc!==lojaAtualId()){
    toast('Só a unidade de destino confirma o recebimento.');return;}

  var h='<div class="mdB">'+
   '<div class="hint">Confira o que chegou. Se veio diferente, corrija a quantidade — '+
   'a diferença fica registrada.</div>'+
   '<table class="pTable" style="margin-top:11px"><thead><tr><th>Item</th>'+
   '<th style="width:110px;text-align:right">Enviado</th>'+
   '<th style="width:130px">Chegou</th></tr></thead><tbody>'+
   t.itens.map(function(i,k){
     return '<tr><td><b>'+E(i.nome)+'</b></td>'+
      '<td style="text-align:right">'+i.qtd+' '+E(i.unidade)+'</td>'+
      '<td><input type="number" step="0.001" class="trRec" data-k="'+k+'" '+
      'value="'+i.qtd+'" style="width:100%"></td></tr>';
   }).join('')+'</tbody></table></div>';

  modal('Receber transferência #'+t.numero,h,'Confirmar recebimento',function(){
    var rec=[],dif=false;
    document.querySelectorAll('.trRec').forEach(function(c){
      var k=+c.getAttribute('data-k'), q=Number(c.value)||0;
      var o=Object.assign({},t.itens[k]);
      o.qtdRecebida=q;
      if(Math.abs(q-o.qtd)>0.0001)dif=true;
      rec.push(o);
    });
    var entrar=rec.filter(function(i){return i.qtdRecebida>0});
    if(!entrar.length){toast('Informe ao menos um item recebido.');return false;}

    baseMov();
    var mov={id:uid('mv'),sucursalId:t.destinoSuc,data:hojeISO(),hora:agoraHM(),
      motivoId:'mv_transf_entrada',
      identificacao:'Transferência #'+t.numero+' ← '+sucNome(t.origemSuc),
      origem:'transferencia',
      linhas:entrar.map(function(i){
        return {insumoId:i.id,nome:i.nome,unidade:i.unidade,qtd:i.qtdRecebida,
          custo:i.custo,direcao:'entrada',origem:'transferencia'};})};
    DB.movEst.push(mov);
    aplicarMovimento(mov);

    t.situacao='recebida';
    t.itens=rec;
    t.recebidaEm=new Date().toISOString();
    t.recebidaPor=(usuarioLogado()||{}).nome||'';
    t.divergencia=dif;
    salvar();telaTransferencia();
    toast(dif?'Recebida com divergência — está registrada.':'Transferência recebida.');
    if(NUVEM.ligada)sincronizar();
    return true;
  });
}
async function cancelarTransferencia(id){
  var t=baseTransf().find(function(x){return x.id===id});
  if(!t||t.situacao!=='enviada')return;
  if(t.origemSuc!==lojaAtualId()&&!ehMatriz()){
    toast('Só quem enviou pode cancelar.');return;}
  var ok=await confirmar({titulo:'Cancelar a transferência #'+t.numero,
    texto:t.itens.length+' item(ns) voltam para '+sucNome(t.origemSuc),
    aviso:'O estoque volta para a unidade de origem. Use quando o envio foi feito '+
     'por engano — se a mercadoria já saiu fisicamente, prefira receber com a '+
     'quantidade certa.',
    ok:'Cancelar transferência',tipo:'perigo'});
  if(!ok)return;
  baseMov();
  var mov={id:uid('mv'),sucursalId:t.origemSuc,data:hojeISO(),hora:agoraHM(),
    motivoId:'mv_transf_entrada',
    identificacao:'Estorno da transferência #'+t.numero,origem:'transferencia',
    linhas:t.itens.map(function(i){
      return {insumoId:i.id,nome:i.nome,unidade:i.unidade,qtd:i.qtd,
        custo:i.custo,direcao:'entrada',origem:'transferencia'};})};
  DB.movEst.push(mov);
  aplicarMovimento(mov);
  t.situacao='cancelada';
  salvar();telaTransferencia();
  toast('Transferência cancelada — estoque devolvido.');
  if(NUVEM.ligada)sincronizar();
}

/* ---------- a tela ---------- */
function telaTransferencia(){
  var suc=lojaAtualId();
  var outras=sucAtivas().filter(function(s){return s.id!==suc});
  var pend=pendentesParaMim();
  var saidas=transfDaUnidade(suc,'saida');
  var entradas=transfDaUnidade(suc,'entrada');

  if(!outras.length){
    $('content').innerHTML='<div class="construWrap"><div class="construBox">'+
     '<div class="construIc">'+sv('troca',30)+'</div><b>Só existe uma unidade</b>'+
     '<p>A transferência serve para mover mercadoria entre unidades da mesma rede. '+
     'Cadastre outra em Configuração da Loja › Sucursais da Franquia.</p></div></div>';
    rodape('uma unidade');return;
  }

  $('content').innerHTML='<div class="etWrap"><div class="etScroll">'+
   '<div class="etTopo"><div><h1>Transferência de Mercadoria</h1>'+
   '<p>Move estoque de <b>'+E(sucNome(suc))+'</b> para outra unidade da rede. '+
   'Sai daqui na hora do envio e entra lá quando o destino confirmar.</p></div>'+
   '<button class="infoBt" onclick="explicaTransf()">'+sv('help',15)+'</button></div>'+

   (pend.length?'<div class="trPend">'+sv('box',17)+
     '<div><b>'+pend.length+' transferência(s) chegando para '+E(sucNome(suc))+'</b>'+
     'Confirme o recebimento para o estoque entrar.</div>'+
     '<button class="btnP2 ok" onclick="TR.aba=\'receber\';telaTransferencia()">Ver</button>'+
    '</div>':'')+

   '<div class="trAbas">'+
    [['enviar','Enviar',saidas.filter(function(t){return t.situacao==='enviada'}).length],
     ['receber','Receber',pend.length],
     ['historico','Histórico',saidas.length+entradas.length]].map(function(a){
      return '<button class="trAba'+(TR.aba===a[0]?' on':'')+'" '+
       'onclick="TR.aba=\''+a[0]+'\';telaTransferencia()">'+E(a[1])+
       (a[2]?'<span>'+a[2]+'</span>':'')+'</button>';
    }).join('')+'</div>'+

   (TR.aba==='enviar'?abaEnviar(outras)
    :TR.aba==='receber'?abaReceber(pend)
    :abaHistorico(saidas,entradas))+
   '</div></div>';
  rodape(pend.length?(pend.length+' a receber'):'nenhuma pendência');
}
function abaEnviar(outras){
  var q=(TR.busca||'').toLowerCase();
  var disp=itensTransferiveis().filter(function(i){
    if(itemTransf(i.id))return false;
    return !q||i.nome.toLowerCase().indexOf(q)>=0;
  }).slice(0,40);
  return '<div class="trDuas">'+
   '<div>'+
    '<div class="trBox"><div class="trT">Para qual unidade</div>'+
     '<div class="trDest">'+outras.map(function(s){
       return '<button class="trD'+(TR.destino===s.id?' on':'')+'" '+
        'onclick="TR.destino=\''+s.id+'\';telaTransferencia()">'+
        '<b>'+E(s.nome)+'</b>'+(s.matriz?'<span>matriz</span>':'')+'</button>';
     }).join('')+'</div></div>'+
    '<div class="trBox"><div class="trT">O que enviar</div>'+
     '<input class="trBusca" value="'+E(TR.busca)+'" placeholder="buscar ingrediente ou ficha" '+
     'oninput="TR.busca=this.value;clearTimeout(window._trT);'+
     'window._trT=setTimeout(telaTransferencia,300)">'+
     '<div class="trLista">'+(disp.length?disp.map(function(i){
       return '<button class="trIt'+(i.saldo<=0?' zero':'')+'" onclick=\'porItemTransf('+
        JSON.stringify(i).replace(/'/g,"&#39;")+')\'>'+
        '<div class="trItN"><b>'+E(i.nome)+'</b>'+
        '<span>'+(i.tipo==='ficha'?'ficha · ':'')+'tem '+i.saldo+' '+E(i.unidade)+'</span></div>'+
        sv('plu',14)+'</button>';
     }).join(''):'<div class="hint" style="padding:14px">Nada encontrado.</div>')+'</div>'+
    '</div>'+
   '</div>'+
   '<div>'+
    '<div class="trBox trCarga"><div class="trT">Carga '+
     (TR.destino?'para '+E(sucNome(TR.destino)):'')+'</div>'+
     (TR.itens.length?'<table class="pTable"><thead><tr><th>Item</th>'+
       '<th style="width:120px">Quantidade</th><th style="width:96px;text-align:right">Valor</th>'+
       '<th style="width:40px"></th></tr></thead><tbody>'+
       TR.itens.map(function(i){
         return '<tr><td><b>'+E(i.nome)+'</b><small>tem '+i.saldo+' '+E(i.unidade)+'</small></td>'+
          '<td><div class="cur"><input type="number" step="0.001" value="'+(i.qtd||'')+'" '+
           'onchange="qtdItemTransf(\''+i.id+'\',this.value);telaTransferencia()"><span>'+
           E(i.unidade)+'</span></div></td>'+
          '<td style="text-align:right">R$ '+money((i.qtd||0)*(i.custo||0))+'</td>'+
          '<td><button class="rBtn rd" onclick="tirarItemTransf(\''+i.id+'\')">'+
           sv('trash',11)+'</button></td></tr>';
       }).join('')+'</tbody></table>'+
       '<div class="trTot"><span>Valor da carga</span><b>R$ '+money(totalTransf())+'</b></div>'+
       '<div class="fld2" style="margin-top:11px"><label>Observação</label>'+
        '<input value="'+E(TR.obs)+'" onchange="TR.obs=this.value" '+
        'placeholder="quem levou, placa do carro..."></div>'+
       '<button class="btnP2 ok" style="width:100%;justify-content:center;margin-top:12px" '+
        'onclick="enviarTransferencia()">'+sv('troca',14)+' Enviar transferência</button>'
      :'<div class="entVazio"><b>Nenhum item na carga</b>'+
       '<span>Escolha ao lado o que vai ser enviado.</span></div>')+
    '</div>'+
   '</div>'+
  '</div>';
}
function abaReceber(pend){
  if(!pend.length)
    return '<div class="entVazio"><b>Nada chegando</b>'+
     '<span>Quando outra unidade enviar mercadoria, ela aparece aqui.</span></div>';
  return '<div class="trCards">'+pend.map(function(t){
    return '<div class="trCard">'+
     '<div class="trCardH"><b>#'+t.numero+'</b>'+
      '<span>de '+E(sucNome(t.origemSuc))+'</span>'+
      '<i>'+dataBR(diaLocal(t.data))+'</i></div>'+
     '<div class="trCardI">'+t.itens.slice(0,5).map(function(i){
       return '<div><span>'+E(i.nome)+'</span><b>'+i.qtd+' '+E(i.unidade)+'</b></div>';
     }).join('')+(t.itens.length>5?'<div class="mais">+ '+(t.itens.length-5)+' itens</div>':'')+'</div>'+
     (t.obs?'<div class="trObs">'+E(t.obs)+'</div>':'')+
     '<div class="trCardF"><span>R$ '+money(t.valorTotal)+'</span>'+
      '<button class="btnP2 ok" onclick="receberTransferencia(\''+t.id+'\')">'+
      sv('check',13)+' Conferir e receber</button></div>'+
    '</div>';
  }).join('')+'</div>';
}
function abaHistorico(saidas,entradas){
  var todas=saidas.concat(entradas.filter(function(t){
    return saidas.indexOf(t)<0;}));
  todas.sort(function(a,b){return String(b.enviadaEm||'').localeCompare(String(a.enviadaEm||''))});
  if(!todas.length)
    return '<div class="entVazio"><b>Nenhuma transferência</b>'+
     '<span>O histórico aparece aqui depois do primeiro envio.</span></div>';
  var suc=lojaAtualId();
  return '<div class="pnl2"><div class="pnl2B" style="padding:0">'+
   '<table class="pTable"><thead><tr><th style="width:62px">Nº</th><th style="width:96px">Data</th>'+
   '<th>Trajeto</th><th style="width:78px;text-align:center">Itens</th>'+
   '<th style="width:110px;text-align:right">Valor</th>'+
   '<th style="width:150px">Situação</th><th style="width:110px"></th></tr></thead><tbody>'+
   todas.slice(0,100).map(function(t){
     var saiu=(t.origemSuc===suc);
     var cor=t.situacao==='recebida'?(t.divergencia?'#B4542F':'#0E8A46')
            :t.situacao==='cancelada'?'#C94141':'#8A8578';
     return '<tr><td><b>#'+t.numero+'</b></td>'+
      '<td>'+dataBR(diaLocal(t.data))+'</td>'+
      '<td>'+(saiu?sv('up3',11):sv('dn',11))+' '+
       E(sucNome(t.origemSuc))+' → '+E(sucNome(t.destinoSuc))+'</td>'+
      '<td style="text-align:center">'+(t.itens||[]).length+'</td>'+
      '<td style="text-align:right">R$ '+money(t.valorTotal)+'</td>'+
      '<td><span style="color:'+cor+';font-weight:600">'+
       (t.situacao==='recebida'?(t.divergencia?'recebida c/ diferença':'recebida')
        :t.situacao==='cancelada'?'cancelada':'a caminho')+'</span></td>'+
      '<td>'+(t.situacao==='enviada'&&saiu
        ?'<button class="rBtn rd" onclick="cancelarTransferencia(\''+t.id+'\')" '+
         'title="Cancelar">'+sv('x2',12)+'</button>':'')+'</td></tr>';
   }).join('')+'</tbody></table></div></div>';
}
function explicaTransf(){
  confirmar({titulo:'Como a transferência funciona',texto:'Entre unidades da rede',
   linhas:[['No envio','o estoque SAI da unidade de origem',''],
           ['A caminho','fica em aberto, sem estar em lugar nenhum',''],
           ['No recebimento','o estoque ENTRA na unidade de destino',''],
           ['Se chegar menos','a diferença fica registrada','']],
   aviso:'O estoque não entra no destino automaticamente de propósito: creditar sem alguém '+
    'conferir esconderia o que se perde no caminho — e é isso que a franqueadora precisa ver. '+
    'O custo do item viaja junto, então a unidade que recebe herda o custo de quem comprou.',
   ok:'Entendi',cancelar:null}).then(function(){});
}

/* ==========================================================
   MODO OFFLINE
   O Nexor sempre grava no aparelho primeiro e sobe depois — a venda
   nunca dependeu da internet. O que faltava era a pessoa SABER em que
   estado esta, e ter onde conferir o que ainda nao subiu.

   Nao existe "PDV de contingencia" separado de proposito: duas listas
   de venda dariam duas numeracoes e estoque baixado duas vezes. E o
   mesmo PDV, com a rede sendo um detalhe.
   ========================================================== */
var NET={online:true,caiuEm:null,voltouEm:null};

function estaOnline(){
  return (typeof navigator!=='undefined'&&navigator.onLine!==false);
}
function pintarRede(){
  var el=document.getElementById('netTag');
  if(!el){
    var hdr=document.getElementById('hdr');
    if(!hdr)return;
    el=document.createElement('span');
    el.id='netTag';el.className='netTag';
    var rt=document.getElementById('rtTag');
    if(rt&&rt.parentNode)rt.parentNode.insertBefore(el,rt);
    else hdr.appendChild(el);
  }
  var pend=pendentesDeEnvio();
  if(NET.online){
    el.className='netTag'+(pend?' pend':'');
    el.innerHTML=pend?(sv('cloud',13)+' '+pend+' a enviar'):'';
    el.onclick=pend?function(){abrir('tecnico','sincronizacao')}:null;
    el.style.display=pend?'':'none';
  }else{
    el.className='netTag off';
    el.innerHTML=sv('cloud',13)+' SEM INTERNET — vendendo normal';
    el.style.display='';
    el.onclick=function(){abrir('tecnico','sincronizacao')};
  }
}
/* quanta coisa ainda nao subiu */
function pendentesDeEnvio(){
  if(!NUVEM.ligada)return 0;
  if(!NUVEM.sujo&&!DB._sujo)return 0;
  var n=0;
  try{
    MAPA.forEach(function(m){ n+=((DB[m.col]||[]).length?1:0); });
  }catch(e){_quieto(e,'pendentesDeEnvio')}
  return NUVEM.sujo||DB._sujo?1:0;   /* 1 = ha algo pendente */
}
function caiuARede(){
  if(!NET.online)return;
  NET.online=false;NET.caiuEm=new Date().toISOString();
  pintarRede();
  avisoRede('A internet caiu. <b>Pode continuar vendendo normalmente</b> — tudo fica '+
    'guardado neste aparelho e sobe sozinho quando a conexão voltar.','off');
  logNuvem('internet caiu — operando no aparelho');
}
function voltouARede(){
  if(NET.online)return;
  NET.online=true;NET.voltouEm=new Date().toISOString();
  pintarRede();
  logNuvem('internet voltou — enviando pendências');
  /* quantas vendas sairam enquanto estava fora, para poder confirmar no fim:
     aviso que some sem dizer se deu certo nao serve para nada */
  var desde=NET.caiuEm||'';
  var offline=(DB.pedidos||[]).filter(function(p){
    return desde&&String(p.data||'')>=desde;}).length;
  avisoRede('Internet de volta. Enviando'+
    (offline?' <b>'+offline+' venda'+(offline>1?'s':'')+'</b> feita'+(offline>1?'s':'')+
     ' sem conexão':' o que ficou para trás')+'...','on',true);
  setTimeout(async function(){
    if(!NUVEM.ligada){
      avisoRede('Internet de volta, mas a nuvem está desligada. '+
        'Entre em <b>Banco de dados</b> para enviar.','off');
      return;
    }
    try{
      await sincronizar();
      if(NUVEM.sujo||DB._sujo){
        avisoRede('A conexão voltou, mas <b>ainda ficou coisa para enviar</b>. '+
          'Abra Administração &rsaquo; Sincronização e toque em Enviar agora.','off');
      }else{
        avisoRede('Pronto — '+(offline?offline+' venda'+(offline>1?'s':'')+' enviada'+
          (offline>1?'s':''):'tudo enviado')+'. <b>Está tudo no sistema, normal.</b>','on');
      }
    }catch(e){
      avisoRede('A conexão voltou, mas o envio falhou: '+
        E((e&&e.message)||'tente de novo em Sincronização')+'. '+
        '<b>Nada foi perdido</b> — está tudo guardado no aparelho.','off');
    }
    pintarRede();
  },1200);
}
function avisoRede(txt,tipo,segurar){
  var v=document.getElementById('avisoNet');
  if(v)v.remove();
  var d=document.createElement('div');
  d.id='avisoNet';d.className='avisoNet '+tipo;
  d.innerHTML=sv('cloud',18)+'<div>'+txt+'</div>'+
   '<button onclick="this.parentNode.remove()">&times;</button>';
  document.body.appendChild(d);
  /* "enviando..." fica ate a resposta chegar; o resultado some sozinho.
     Aviso vermelho NAO some: exige que a pessoa veja e feche. */
  if(tipo==='on'&&!segurar)
    setTimeout(function(){
      var x=document.getElementById('avisoNet');
      if(x&&x.className.indexOf('on')>=0)x.remove();
    },8000);
}
(function vigiarRede(){
  try{
    NET.online=estaOnline();
    window.addEventListener('offline',caiuARede);
    window.addEventListener('online',voltouARede);
    /* navigator.onLine mente em algumas redes de loja: confere de verdade */
    setInterval(async function(){
      /* o sino tambem se atualiza aqui, e ANTES da guarda da nuvem: pedido
         mudado neste aparelho avisa mesmo com a nuvem desligada */
      try{pintarSino()}catch(e){_quieto(e,'vigiarRede')}
      if(!NUVEM.ligada)return;
      var vivo=estaOnline();
      if(vivo&&!NET.online)voltouARede();
      if(!vivo&&NET.online)caiuARede();
      pintarRede();
    },15000);
  }catch(e){_quieto(e,'avisoRede')}
})();

/* ---------- a tela de conferência ---------- */
function telaSincronizacao(){
  var pend=(NUVEM.sujo||DB._sujo);
  var ultimo=NUVEM.ultimoEnvio||'—';
  var contas={};
  try{ MAPA.forEach(function(m){ contas[m.col]=(DB[m.col]||[]).length; }); }catch(e){_quieto(e,'telaSincronizacao')}
  var vendasHoje=(DB.pedidos||[]).filter(function(p){
    return diaLocal(p.data)===hojeISO();}).length;

  $('content').innerHTML='<div class="etWrap"><div class="etScroll">'+
   '<div class="etTopo"><div><h1>Sincronização</h1>'+
   '<p>O Nexor grava tudo no aparelho primeiro. A nuvem recebe depois — por isso a '+
   'venda nunca para quando a internet cai.</p></div>'+
   '<button class="infoBt" onclick="explicaOffline()">'+sv('help',15)+'</button></div>'+

   '<div class="syBox '+(NET.online?'on':'off')+'">'+
    sv('cloud',26)+
    '<div><b>'+(NET.online?'Conectado':'Sem internet — modo offline')+'</b>'+
    '<span>'+(NET.online
      ?(pend?'Há alterações esperando para subir.':'Tudo enviado para a nuvem.')
      :'Continue vendendo. Nada se perde: tudo está guardado neste aparelho e sobe '+
       'sozinho quando a conexão voltar.')+'</span></div>'+
    (NET.online&&pend?'<button class="btnP2 ok" onclick="enviarAgora()">'+
      sv('cloud',14)+' Enviar agora</button>':'')+
   '</div>'+

   '<div class="syGrade">'+
    '<div class="syC"><span>Situação da nuvem</span><b>'+
      (NUVEM.ligada?(pend?'pendente':'em dia'):'desligada')+'</b></div>'+
    '<div class="syC"><span>Último envio</span><b>'+E(ultimo)+'</b></div>'+
    '<div class="syC"><span>Vendas de hoje neste aparelho</span><b>'+vendasHoje+'</b></div>'+
    '<div class="syC"><span>Cópia local</span><b>'+
      (localStorage.getItem('nexor_dados')?
        Math.round(localStorage.getItem('nexor_dados').length/1024)+' KB':'—')+'</b></div>'+
   '</div>'+

   (NET.caiuEm?'<div class="syHist">'+sv('clock',14)+
     '<div>Última queda: <b>'+E(String(NET.caiuEm).slice(11,16))+'</b>'+
     (NET.voltouEm?' · voltou às <b>'+E(String(NET.voltouEm).slice(11,16))+'</b>':
      ' — ainda fora')+'</div></div>':'')+

   '<div class="pnl2"><div class="pnl2H">O que está guardado neste aparelho</div>'+
   '<div class="pnl2B" style="padding:0">'+
   '<table class="pTable"><thead><tr><th>Tipo</th>'+
   '<th style="width:120px;text-align:right">Registros</th></tr></thead><tbody>'+
   Object.keys(contas).filter(function(k){return contas[k]>0})
    .sort(function(a,b){return contas[b]-contas[a]})
    .map(function(k){
      return '<tr><td>'+E(nomeAmigavel(k))+'</td>'+
       '<td style="text-align:right"><b>'+contas[k]+'</b></td></tr>';
    }).join('')+
   '</tbody></table></div></div>'+
   '</div></div>';
  rodape(NET.online?'conectado':'modo offline');
}
function nomeAmigavel(col){
  var m={pedidos:'Vendas',produtos:'Produtos',insumos:'Ingredientes',clientes:'Clientes',
   lancFin:'Lançamentos financeiros',movEst:'Movimentações de estoque',caixas:'Caixas',
   fichas:'Fichas técnicas',notas:'Notas de entrada',comandas:'Comandas de mesa',
   mesas:'Mesas',cupons_f:'Cupons fiscais',cancelamentos:'Cancelamentos',
   ordensProd:'Ordens de produção',contagens:'Contagens de estoque'};
  return m[col]||col;
}
async function enviarAgora(){
  if(!NUVEM.ligada){toast('A nuvem está desligada.');return;}
  if(!NET.online){toast('Sem internet — o envio acontece sozinho quando voltar.');return;}
  toast('Enviando...');
  try{ await sincronizar(); }catch(e){_quieto(e,'enviarAgora')}
  telaSincronizacao();
}
function explicaOffline(){
  confirmar({titulo:'Como a Joia funciona sem internet',texto:'Modo offline',
   linhas:[['A venda','é gravada no aparelho, não na nuvem',''],
           ['O estoque','baixa na hora, normalmente',''],
           ['O financeiro','lança na hora, normalmente',''],
           ['A nuvem','recebe tudo quando a conexão voltar',''],
           ['Você precisa fazer','nada — é automático','']],
   aviso:'Não existe um PDV separado para quando a internet cai, e isso é de propósito: '+
    'duas listas de venda dariam duas numerações e estoque baixado duas vezes. '+
    'É o mesmo PDV — a internet é só um detalhe.',
   ok:'Entendi',cancelar:null}).then(function(){});
}

/* ==========================================================
   FISCAL — NFC-e (modelo 65)
   Sao Paulo tornou a NFC-e obrigatoria em janeiro de 2026.
   O Nexor nao fala com a SEFAZ direto: quem assina, transmite e
   acompanha rejeicao e um provedor homologado. Assim, quando o
   leiaute muda — e mudou agora, com IBS/CBS da reforma — quem
   atualiza e o provedor, nao nos.
   ========================================================== */
var PROVEDORES=[
 {id:'focus',     n:'Focus NFe',   url:'https://api.focusnfe.com.br'},
 {id:'tecnospeed',n:'TecnoSpeed / PlugNotas', url:'https://api.plugnotas.com.br'},
 {id:'webmania',  n:'WebmaniaBR',  url:'https://api.webmaniabr.com'},
 {id:'nfeio',     n:'NFe.io',      url:'https://api.nfe.io'},
 {id:'outro',     n:'Outro provedor', url:''}
];
var MODOS_FISCAIS=[
 {id:'sempre',   n:'Sempre fiscal', d:'toda venda da frente de caixa emite cupom automaticamente'},
 {id:'opcional', n:'Sob demanda',   d:'o operador escolhe se emite, venda a venda'},
 {id:'desligado',n:'Desligado',     d:'nenhum cupom é emitido'}
];
var ORIGENS_FISCAIS=[
 {id:'0',n:'0 — Nacional'},{id:'1',n:'1 — Estrangeira, importação direta'},
 {id:'2',n:'2 — Estrangeira, mercado interno'},{id:'3',n:'3 — Nacional, +40% importado'},
 {id:'4',n:'4 — Nacional, processos produtivos básicos'},
 {id:'5',n:'5 — Nacional, até 40% importado'},{id:'6',n:'6 — Estrangeira, sem similar nacional'},
 {id:'7',n:'7 — Estrangeira, mercado interno sem similar'},{id:'8',n:'8 — Nacional, +70% importado'}
];
function fiscalCfg(){
  var c=cfg();
  c.fiscal=c.fiscal||{};
  var f=c.fiscal;
  if(f.modo===undefined)f.modo='desligado';
  if(f.ambiente===undefined)f.ambiente='homologacao';
  if(f.serie===undefined)f.serie=1;
  if(f.serieCont===undefined)f.serieCont=9;
  if(f.regime===undefined)f.regime='simples';
  if(f.cfop===undefined)f.cfop='5102';
  if(f.csosn===undefined)f.csosn='102';
  if(f.origem===undefined)f.origem='0';
  return f;
}
function fiscalLigado(){
  var f=fiscalCfg();
  return f.modo!=='desligado'&&!!f.provedor&&!!f.token;
}
/* o que ainda falta para poder emitir de verdade */
function pendenciasFiscais(){
  var f=fiscalCfg(),p=[];
  if(!f.provedor)p.push('escolher o provedor e colar o token da API');
  if(!f.token)p.push('token da API não informado');
  if(!f.cnpj)p.push('CNPJ do emitente');
  if(!f.ie)p.push('Inscrição Estadual');
  if(!f.cscId||!f.csc)p.push('CSC (ID e código) — sem ele o QR Code do cupom não é válido');
  if(!f.certValidade)p.push('validade do certificado digital A1');
  var semNCM=(DB.produtos||[]).filter(function(x){
    return x.ativo!==false&&!(x.ncm||f.ncm);}).length;
  if(semNCM)p.push(semNCM+' produto(s) ativos sem NCM — a SEFAZ rejeita sem isso');
  return p;
}
function telaFiscalCfg(){
  var f=fiscalCfg();
  var pend=pendenciasFiscais();
  var vencCert=f.certValidade?Math.ceil((new Date(f.certValidade)-new Date())/86400000):null;
  $('content').innerHTML='<div class="etWrap"><div class="etScroll">'+
   '<div class="etTopo"><div><h1>Configuração Fiscal</h1>'+
   '<p>NFC-e — o cupom fiscal eletrônico do consumidor. Em São Paulo passou a ser '+
   'obrigatória em janeiro de 2026 para todo o varejo.</p></div>'+
   '<button class="infoBt" onclick="explicaFiscal()">'+sv('help',15)+'</button></div>'+

   (pend.length?'<div class="fscPend">'+sv('help',16)+'<div><b>Falta para poder emitir</b>'+
     '<ul>'+pend.map(function(x){return '<li>'+E(x)+'</li>'}).join('')+'</ul></div></div>':
     '<div class="fscOk">'+sv('nike',16)+' Configuração completa — pronto para emitir.</div>')+

   '<div class="cfgDuas">'+
    '<div class="cfgCol"><div class="colH">Como o sistema emite</div>'+
     '<div class="fld2"><label>Modo</label><select id="fsModo" onchange="salvarFiscal()">'+
      MODOS_FISCAIS.map(function(m){
        return '<option value="'+m.id+'"'+(f.modo===m.id?' selected':'')+'>'+E(m.n)+' — '+E(m.d)+'</option>';
      }).join('')+'</select></div>'+
     '<div class="fld2"><label>Ambiente</label><select id="fsAmb" onchange="salvarFiscal()">'+
      '<option value="homologacao"'+(f.ambiente==='homologacao'?' selected':'')+'>Homologação (teste — sem valor fiscal)</option>'+
      '<option value="producao"'+(f.ambiente==='producao'?' selected':'')+'>Produção (vale para a Receita)</option>'+
      '</select><div class="hint">Teste em homologação até acertar tudo. Cupom de homologação '+
      'não vale como documento fiscal.</div></div>'+
     '<div class="row2">'+
      '<div class="fld2"><label>Série normal</label><input id="fsSerie" type="number" min="1" value="'+(f.serie||1)+'" onchange="salvarFiscal()"></div>'+
      '<div class="fld2"><label>Série de contingência</label><input id="fsSerieC" type="number" min="1" value="'+(f.serieCont||9)+'" onchange="salvarFiscal()"></div>'+
     '</div>'+
     '<div class="hint">A lei exige série <b>diferente</b> para as notas emitidas quando a '+
     'SEFAZ está fora do ar. Elas são transmitidas em até 24 horas.</div>'+
    '</div>'+

    '<div class="cfgCol"><div class="colH">Provedor da API</div>'+
     '<div class="fld2"><label>Empresa que transmite para a SEFAZ</label>'+
      '<select id="fsProv" onchange="salvarFiscal()">'+
      '<option value="">— escolha —</option>'+
      PROVEDORES.map(function(p){
        return '<option value="'+p.id+'"'+(f.provedor===p.id?' selected':'')+'>'+E(p.n)+'</option>';
      }).join('')+'</select></div>'+
     '<div class="fld2"><label>Endereço da API</label>'+
      '<input id="fsUrl" value="'+E(f.url||'')+'" placeholder="https://..." onchange="salvarFiscal()"></div>'+
     '<div class="fld2"><label>Token / chave da API</label>'+
      /* a chave gravada NAO volta para a tela: mostra so que existe. Quem
         precisa trocar digita a nova por cima. Assim ela nao fica no HTML,
         onde qualquer extensao do navegador ou captura de tela a leria. */
      '<input id="fsTok" type="password" value="" autocomplete="new-password" '+
      'placeholder="'+(f.token?'chave já cadastrada — digite para substituir'
                             :'cole a chave que o provedor entregou')+'" '+
      'onchange="salvarFiscal()">'+
      '<div class="hint">'+(f.token
        ?'Uma chave já está guardada. Ela não é exibida de volta, por segurança.'
        :'Fica guardada só nesta loja, e só o administrador enxerga esta tela.')+
      '</div></div>'+
    '</div>'+
   '</div>'+

   '<div class="cfgDuas">'+
    '<div class="cfgCol"><div class="colH">Emitente</div>'+
     '<div class="row2">'+
      '<div class="fld2"><label>CNPJ</label><input id="fsCnpj" value="'+E(f.cnpj||'')+'" onchange="salvarFiscal()"></div>'+
      '<div class="fld2"><label>Inscrição Estadual</label><input id="fsIe" value="'+E(f.ie||'')+'" onchange="salvarFiscal()"></div>'+
     '</div>'+
     '<div class="fld2"><label>Razão social</label><input id="fsRz" value="'+E(f.razao||'')+'" onchange="salvarFiscal()"></div>'+
     '<div class="fld2"><label>Regime tributário</label><select id="fsReg" onchange="salvarFiscal()">'+
      '<option value="simples"'+(f.regime==='simples'?' selected':'')+'>Simples Nacional</option>'+
      '<option value="presumido"'+(f.regime==='presumido'?' selected':'')+'>Lucro Presumido</option>'+
      '<option value="real"'+(f.regime==='real'?' selected':'')+'>Lucro Real</option>'+
      '</select><div class="hint">No Simples o produto usa <b>CSOSN</b>; nos demais, <b>CST</b>.</div></div>'+
    '</div>'+
    '<div class="cfgCol"><div class="colH">Segurança do QR Code (CSC)</div>'+
     '<div class="fld2"><label>ID do CSC</label><input id="fsCscId" value="'+E(f.cscId||'')+'" onchange="salvarFiscal()"></div>'+
     '<div class="fld2"><label>Código CSC</label><input id="fsCsc" type="password" value="'+E(f.csc||'')+'" onchange="salvarFiscal()">'+
      '<div class="hint">Gerado no portal da SEFAZ do seu estado, um par para homologação e '+
      'outro para produção. Sem ele o QR Code impresso no cupom não é aceito.</div></div>'+
     '<div class="fld2"><label>Validade do certificado digital A1</label>'+
      '<input id="fsCert" type="date" value="'+E(f.certValidade||'')+'" onchange="salvarFiscal()">'+
      (vencCert!==null?'<div class="blAviso '+(vencCert<0?'ruim':(vencCert<30?'':'ok'))+'">'+
        (vencCert<0?('venceu há '+Math.abs(vencCert)+' dias — a emissão para'):
         vencCert<30?('vence em '+vencCert+' dias — providencie a renovação'):
         ('válido por mais '+vencCert+' dias'))+'</div>':'')+
      '<div class="hint">O certificado fica no provedor. Aqui guardamos só a data, '+
      'para avisar antes de vencer — certificado vencido para a loja.</div></div>'+
    '</div>'+
   '</div>'+

   '<div class="cfgDuas"><div class="cfgCol" style="grid-column:1/-1">'+
    '<div class="colH">Padrões dos produtos</div>'+
    '<div class="hint" style="margin-bottom:9px">Usado quando o produto não tem o dado próprio. '+
    'Evita cadastrar item por item.</div>'+
    '<div class="row2">'+
     '<div class="fld2"><label>NCM padrão</label><input id="fsNcm" value="'+E(f.ncm||'')+'" placeholder="ex: 21050010 (sorvetes)" onchange="salvarFiscal()"></div>'+
     '<div class="fld2"><label>CFOP padrão</label><input id="fsCfop" value="'+E(f.cfop||'5102')+'" onchange="salvarFiscal()"></div>'+
    '</div>'+
    '<div class="row2">'+
     '<div class="fld2"><label>'+(f.regime==='simples'?'CSOSN':'CST')+' padrão</label>'+
      '<input id="fsCst" value="'+E(f.regime==='simples'?(f.csosn||'102'):(f.cst||'00'))+'" onchange="salvarFiscal()"></div>'+
     '<div class="fld2"><label>Origem padrão</label><select id="fsOrig" onchange="salvarFiscal()">'+
      ORIGENS_FISCAIS.map(function(o){
        return '<option value="'+o.id+'"'+(f.origem===o.id?' selected':'')+'>'+E(o.n)+'</option>';
      }).join('')+'</select></div>'+
    '</div>'+
   '</div></div>'+
   '</div></div>';
  rodape(fiscalLigado()?'fiscal ligado — '+(f.ambiente==='producao'?'PRODUÇÃO':'homologação'):'fiscal desligado');
}
function salvarFiscal(){
  var f=fiscalCfg();
  function v(id){var e=$(id);return e?e.value:undefined;}
  f.modo=v('fsModo');f.ambiente=v('fsAmb');
  f.serie=parseInt(v('fsSerie'),10)||1;f.serieCont=parseInt(v('fsSerieC'),10)||9;
  var prov=v('fsProv');
  if(prov!==f.provedor){
    f.provedor=prov;
    var p=PROVEDORES.find(function(x){return x.id===prov});
    if(p&&p.url&&!v('fsUrl'))f.url=p.url;   /* preenche o endereço conhecido */
  }
  if(v('fsUrl')!==undefined&&v('fsUrl')!=='')f.url=v('fsUrl');
  /* o campo volta VAZIO de proposito (a chave nao e exibida de volta).
     Vazio portanto significa "nao mexi", nao "apague". Sem esta linha, abrir
     a tela e salvar qualquer outro campo zeraria a chave e a emissao de nota
     pararia sem ninguem entender por que. */
  var tk=v('fsTok'); if(tk!==undefined&&tk!=='')f.token=tk;
  f.cnpj=v('fsCnpj');f.ie=v('fsIe');f.razao=v('fsRz');
  f.regime=v('fsReg');f.cscId=v('fsCscId');f.csc=v('fsCsc');
  f.certValidade=v('fsCert');f.ncm=v('fsNcm');f.cfop=v('fsCfop');f.origem=v('fsOrig');
  if(f.regime==='simples')f.csosn=v('fsCst'); else f.cst=v('fsCst');
  salvar();telaFiscalCfg();
  if(NUVEM.ligada)sincronizar();
}
function explicaFiscal(){
  confirmar({titulo:'O que a lei exige',texto:'NFC-e — modelo 65',
   linhas:[['Certificado digital','e-CNPJ A1, instalado no provedor',''],
           ['Credenciamento','na SEFAZ do seu estado',''],
           ['CSC','ID + código, gerados no portal da SEFAZ',''],
           ['Série','uma para normal, outra para contingência',''],
           ['NCM por produto','sem ele a SEFAZ rejeita',''],
           ['Impressora','comum serve — não precisa ser fiscal','']],
   aviso:'A Joia não fala com a SEFAZ direto. Quem assina e transmite é o provedor '+
    'homologado — assim, quando o leiaute muda (como agora, com IBS e CBS da reforma '+
    'tributária), quem atualiza é ele. Nada aqui substitui seu contador.',
   ok:'Entendi',cancelar:null}).then(function(){});
}

/* ==========================================================
   CUPONS GERADOS
   O espelho do que foi para a Receita. Enquanto o provedor nao
   estiver ligado, a tela ja registra a venda como cupom pendente:
   assim, no dia em que ligar, o historico nao comeca do zero.
   ========================================================== */
var CFI={de:'',ate:'',tipoPeriodo:'venda',status:'',statusVenda:'',origem:'',
         pag:'',consumidor:'',doc:'',num:'',sel:{}};
var STATUS_CUPOM=[
 {id:'autorizado',  n:'Autorizado',   cor:'#0E8A46'},
 {id:'pendente',    n:'Pendente',     cor:'#8A8578'},
 {id:'contingencia',n:'Contingência', cor:'#B4542F'},
 {id:'rejeitado',   n:'Rejeitado',    cor:'#C94141'},
 {id:'cancelado',   n:'Cancelado',    cor:'#C94141'},
 {id:'agrupado',    n:'Em NF-e agrupada',cor:'#1F5F8B'}
];
function nomeStatusCupom(id){
  var s=STATUS_CUPOM.find(function(x){return x.id===id});
  return s?s.n:(id||'—');
}
function corStatusCupom(id){
  var s=STATUS_CUPOM.find(function(x){return x.id===id});
  return s?s.cor:'#8A8578';
}
function baseCuponsFiscais(){DB.cupons_f=DB.cupons_f||[];return DB.cupons_f;}
/* a venda e o cupom podem ser de dias diferentes: emitir depois é permitido,
   e quem concilia com a contabilidade precisa escolher por qual data filtra */
function dataDoCupom(c){
  return diaLocal(CFI.tipoPeriodo==='emissao'?(c.emitidoEm||c.data):c.data);
}
function situacaoVenda(c){
  var p=(DB.pedidos||[]).find(function(x){return x.id===c.pedidoId});
  if(!p)return 'concluida';
  if(ehCancelado(p))return 'cancelada';
  if(ehFinalizado(p))return 'concluida';
  return 'aberta';
}
function filtrarCupons(){
  baseCuponsFiscais();
  var q=(CFI.consumidor||'').toLowerCase(), qp=(CFI.pag||'').toLowerCase();
  var qd=soDigitos(CFI.doc||'');
  return DB.cupons_f.filter(function(c){
    var d=dataDoCupom(c);
    if(CFI.de&&d<CFI.de)return false;
    if(CFI.ate&&d>CFI.ate)return false;
    if(CFI.status&&c.status!==CFI.status)return false;
    if(CFI.statusVenda&&situacaoVenda(c)!==CFI.statusVenda)return false;
    if(CFI.origem&&c.origem!==CFI.origem)return false;
    if(CFI.num&&String(c.numero||'').indexOf(CFI.num)<0)return false;
    if(qd&&soDigitos(c.doc||'').indexOf(qd)<0)return false;
    if(q&&(c.consumidor||'').toLowerCase().indexOf(q)<0)return false;
    if(qp&&(c.pagamento||'').toLowerCase().indexOf(qp)<0)return false;
    return true;
  }).sort(function(a,b){
    return (b.data+' '+(b.hora||'')).localeCompare(a.data+' '+(a.hora||''));
  });
}
function telaCuponsFiscais(){
  baseCuponsFiscais();
  if(!CFI.de){var d=new Date();
    CFI.de=new Date(d.getFullYear(),d.getMonth(),1).toISOString().slice(0,10);
    CFI.ate=hojeISO();}
  var lst=filtrarCupons();
  var aut=lst.filter(function(c){return c.status==='autorizado'});
  var canc=lst.filter(function(c){return c.status==='cancelado'});
  var pendEnv=lst.filter(function(c){return c.status==='pendente'||c.status==='contingencia'});
  var tot=aut.reduce(function(a,c){return a+(Number(c.total)||0)},0);
  var f=fiscalCfg();
  var selN=Object.keys(CFI.sel).filter(function(k){return CFI.sel[k]}).length;
  var selV=lst.filter(function(c){return CFI.sel[c.id]})
              .reduce(function(a,c){return a+(Number(c.total)||0)},0);

  $('content').innerHTML='<div class="finWrap">'+
  '<div class="finTop"><div><h1>Cupons Gerados</h1>'+
  '<p>Tudo que passou pela frente de caixa e o que foi para a Receita.</p></div>'+
  '<div class="finActs">'+
   '<button class="infoBt" onclick="explicaCupons()">'+sv('help',15)+'</button>'+
   '<button class="btnP2" onclick="exportarCupons()">'+sv('file',14)+' Exportar</button>'+
  '</div></div>'+

  (f.modo==='desligado'
   ?'<div class="fscPend">'+sv('help',16)+'<div><b>Emissão desligada</b>'+
     'As vendas ficam registradas aqui como pendentes, mas nada é enviado à Receita. '+
     'Ligue em <b>Configuração Fiscal</b>.</div></div>'
   :(f.ambiente==='homologacao'
     ?'<div class="fscPend">'+sv('help',16)+'<div><b>Ambiente de teste</b>'+
       'Os cupons daqui não têm valor fiscal. Troque para Produção quando estiver pronto.</div></div>'
     :''))+

  '<div class="filtroCard">'+
   '<div class="fl"><label>Data inicial</label><input type="date" id="cfDe" value="'+CFI.de+'"></div>'+
   '<div class="fl"><label>Data final</label><input type="date" id="cfAte" value="'+CFI.ate+'"></div>'+
   '<div class="fl"><label>Tipo de período</label><select id="cfTp">'+
    '<option value="venda"'+(CFI.tipoPeriodo==='venda'?' selected':'')+'>Data da venda</option>'+
    '<option value="emissao"'+(CFI.tipoPeriodo==='emissao'?' selected':'')+'>Data de emissão do cupom</option>'+
    '</select></div>'+
   '<div class="fl"><label>Destinatário (CPF ou CNPJ)</label>'+
    '<input id="cfDoc" value="'+E(CFI.doc)+'" placeholder="CPF ou CNPJ"></div>'+
   '<div class="fl"><label>Número do cupom</label><input id="cfNum" value="'+E(CFI.num)+'"></div>'+
   '<div class="fl"><label>Status da nota</label><select id="cfSt"><option value="">Todos</option>'+
    STATUS_CUPOM.map(function(s){
      return '<option value="'+s.id+'"'+(CFI.status===s.id?' selected':'')+'>'+E(s.n)+'</option>';
    }).join('')+'</select></div>'+
   '<div class="fl"><label>Status da venda</label><select id="cfSv"><option value="">Todos</option>'+
    [['concluida','Concluída'],['cancelada','Cancelada'],['aberta','Em andamento']].map(function(o){
      return '<option value="'+o[0]+'"'+(CFI.statusVenda===o[0]?' selected':'')+'>'+o[1]+'</option>';
    }).join('')+'</select></div>'+
   '<div class="fl"><label>Origem</label><select id="cfOr"><option value="">Todas</option>'+
    ['salao','entrega','mesa','online'].map(function(o){
      return '<option value="'+o+'"'+(CFI.origem===o?' selected':'')+'>'+
        (o==='salao'?'Salão':o==='entrega'?'Entrega':o==='mesa'?'Mesa':'Online')+'</option>';
    }).join('')+'</select></div>'+
   '<button class="btnP2 ok" onclick="buscarCupons()">'+sv('search',14)+' Buscar</button>'+
  '</div>'+

  '<div class="cfTotais">'+
   '<div><span>Qtde total de notas emitidas</span><b>'+aut.length+'</b></div>'+
   '<div><span>Valor total de notas emitidas</span><b>R$ '+money(tot)+'</b></div>'+
   '<div><span>Cancelamentos no período</span><b>'+canc.length+'</b></div>'+
   '<div><span>Pendentes de envio</span><b>'+pendEnv.length+'</b></div>'+
  '</div>'+
  '<div class="hint" style="margin:-6px 0 12px">As datas de emissão do cupom e da venda '+
  'podem ser diferentes quando a emissão não é feita junto com o lançamento da venda.</div>'+

  (selN?'<div class="cfSel">'+sv('nike',15)+
    '<div><b>'+selN+' cupom(ns) selecionado(s)</b> — R$ '+money(selV)+'</div>'+
    '<button class="btnP2" onclick="CFI.sel={};telaCuponsFiscais()">Limpar</button>'+
    '<button class="btnP2 ok" onclick="converterAgrupada()">Converter em NF-e agrupada</button>'+
   '</div>':'')+

  '<div class="pnl2"><div class="pnl2H">Cupons <span class="cnt2">'+lst.length+'</span></div>'+
  '<div class="pnl2B" style="padding:0">'+
  (lst.length?'<table class="pTable finTab"><thead><tr>'+
   '<th style="width:34px"></th>'+
   '<th style="width:88px">Pedido</th>'+
   '<th style="width:135px">Data da venda</th>'+
   '<th style="width:74px">Cupom</th>'+
   '<th style="width:74px">NF-e</th>'+
   '<th>Consumidor</th>'+
   '<th style="width:140px">Pagamento</th>'+
   '<th style="width:112px">Status</th>'+
   '<th style="width:86px;text-align:right">Entrega</th>'+
   '<th style="width:86px;text-align:right">Desconto</th>'+
   '<th style="width:100px;text-align:right">Total</th>'+
   '<th style="width:92px"></th></tr></thead>'+
   /* busca dentro da coluna, como na tela que o Rafael usa hoje */
   '<tbody><tr class="cfBusca">'+
    '<td></td><td></td><td></td><td></td><td></td>'+
    '<td><input id="cfCons" value="'+E(CFI.consumidor)+'" placeholder="buscar consumidor" '+
     'onkeydown="if(event.key===\'Enter\')buscarCupons()"></td>'+
    '<td><input id="cfPag" value="'+E(CFI.pag)+'" placeholder="dinheiro, pix..." '+
     'onkeydown="if(event.key===\'Enter\')buscarCupons()"></td>'+
    '<td colspan="5"></td></tr>'+
   lst.map(function(c){
     var sv2=situacaoVenda(c);
     return '<tr'+(sv2==='cancelada'?' class="cfCanc"':'')+'>'+
      '<td><label class="flagBox"><input type="checkbox" '+(CFI.sel[c.id]?'checked':'')+
       ' onchange="CFI.sel[\''+c.id+'\']=this.checked;telaCuponsFiscais()"></label></td>'+
      '<td><b>'+E(c.origem==='salao'?'Salão':c.origem==='entrega'?'Entrega':
        c.origem==='mesa'?'Mesa':'Online')+'</b>'+
       (c.pedidoNumero?'<small>#'+c.pedidoNumero+'</small>':'')+'</td>'+
      '<td>'+dataBR(diaLocal(c.data))+(c.hora?', '+E(c.hora):'')+'</td>'+
      '<td>'+(c.numero||'—')+'</td>'+
      '<td>'+(c.nfeAgrupada?'<span class="cfNfe">agrupada</span>':'—')+'</td>'+
      '<td>'+E(c.consumidor||'Consumidor não identificado')+
       (c.doc?'<small>'+E(c.doc)+'</small>':'')+'</td>'+
      '<td>'+E(c.pagamento||'—')+'</td>'+
      '<td><span style="color:'+corStatusCupom(c.status)+';font-weight:600">'+
       E(nomeStatusCupom(c.status))+'</span>'+
       (sv2==='cancelada'?'<small>venda cancelada</small>':'')+'</td>'+
      '<td style="text-align:right">'+(c.entrega?'R$ '+money(c.entrega):'—')+'</td>'+
      '<td style="text-align:right">'+(c.desconto?'R$ '+money(c.desconto):'—')+'</td>'+
      '<td style="text-align:right"><b>R$ '+money(c.total)+'</b></td>'+
      '<td><div class="rowAct">'+
       '<button class="rBtn" onclick="imprimirCupom(\''+c.id+'\')" title="Imprimir">'+sv('print2',12)+'</button>'+
       (c.status==='autorizado'
        ?'<button class="rBtn rd" onclick="cancelarCupom(\''+c.id+'\')" title="Cancelar na SEFAZ">'+sv('x',12)+'</button>'
        :'')+
       '<button class="rBtn" onclick="verCupom(\''+c.id+'\')" title="Ver">'+sv('eye',12)+'</button>'+
      '</div></td>'+
     '</tr>';
   }).join('')+'</tbody></table>'
  :'<div class="entVazio"><b>Nenhum cupom no período</b>'+
   '<span>As vendas da frente de caixa aparecem aqui assim que acontecerem.</span></div>')+
  '</div></div></div>';
  rodape(lst.length+' cupons · '+aut.length+' autorizados');
}
function buscarCupons(){
  function v(id){var e=$(id);return e?e.value:''}
  CFI.de=v('cfDe');CFI.ate=v('cfAte');CFI.num=v('cfNum').trim();
  CFI.tipoPeriodo=v('cfTp');CFI.doc=v('cfDoc').trim();
  CFI.status=v('cfSt');CFI.statusVenda=v('cfSv');CFI.origem=v('cfOr');
  CFI.consumidor=v('cfCons').trim();CFI.pag=v('cfPag').trim();
  telaCuponsFiscais();
}
function verCupom(id){
  var c=baseCuponsFiscais().find(function(x){return x.id===id});
  if(!c)return;
  modal('Cupom '+(c.numero||'—'),
  '<div class="mdB">'+
   '<div class="linha"><span>Situação</span><b style="color:'+corStatusCupom(c.status)+'">'+
    E(nomeStatusCupom(c.status))+'</b></div>'+
   '<div class="linha"><span>Venda</span><b>#'+(c.pedidoNumero||'—')+' · '+
    dataBR(diaLocal(c.data))+' '+E(c.hora||'')+'</b></div>'+
   '<div class="linha"><span>Origem</span><b>'+E(c.origem||'—')+'</b></div>'+
   '<div class="linha"><span>Consumidor</span><b>'+E(c.consumidor||'não identificado')+
    (c.doc?' ('+E(c.doc)+')':'')+'</b></div>'+
   '<div class="linha"><span>Pagamento</span><b>'+E(c.pagamento||'—')+'</b></div>'+
   '<div class="linha tot"><span>TOTAL</span><b>R$ '+money(c.total)+'</b></div>'+
   (c.chave?'<div class="cbLinha"><span>'+E(c.chave)+'</span></div>'+
     '<div class="hint">Chave de acesso — 44 dígitos</div>':'')+
   (c.motivo?'<div class="fscPend" style="margin-top:10px">'+sv('help',14)+
     '<div><b>'+E(nomeStatusCupom(c.status))+'</b>'+E(c.motivo)+'</div></div>':'')+
  '</div>','Fechar',function(){return true;});
}
/* imprimir e cancelar dependem do provedor; enquanto ele nao esta ligado,
   e melhor dizer isso do que fingir que funcionou */
function imprimirCupom(id){
  var c=baseCuponsFiscais().find(function(x){return x.id===id});
  if(!c)return;
  if(c.status!=='autorizado'){
    toast('Só cupom autorizado tem DANFE para imprimir. Este está '+
      nomeStatusCupom(c.status).toLowerCase()+'.');
    return;
  }
  if(c.danfeUrl){window.open(c.danfeUrl,'_blank');return;}
  toast('O provedor ainda não devolveu o DANFE deste cupom.');
}
async function cancelarCupom(id){
  var c=baseCuponsFiscais().find(function(x){return x.id===id});
  if(!c)return;
  if(c.status!=='autorizado'){toast('Só dá para cancelar cupom autorizado.');return;}
  var ok=await confirmar({
    titulo:'Cancelar o cupom '+(c.numero||''),
    texto:'R$ '+money(c.total)+' — '+dataBR(diaLocal(c.data)),
    aviso:'O cancelamento vai para a SEFAZ e tem prazo curto, que varia por estado '+
     '(em geral 30 minutos após a autorização). Passado o prazo, o caminho é a nota '+
     'de devolução — fale com seu contador.',
    ok:'Cancelar na SEFAZ',tipo:'perigo'});
  if(!ok)return;
  if(!fiscalLigado()){
    toast('O provedor fiscal não está ligado — nada foi enviado à SEFAZ.');
    return;
  }
  toast('Cancelamento ainda não implementado: falta ligar a API do provedor.');
}
function explicaCupons(){
  confirmar({titulo:'Como esta tela funciona',texto:'Cupons Gerados',
   linhas:[['Pendente','venda registrada, ainda não enviada à Receita',''],
           ['Autorizado','a SEFAZ aceitou — o cupom vale',''],
           ['Contingência','emitido com a SEFAZ fora do ar, será transmitido depois',''],
           ['Rejeitado','a SEFAZ recusou — o motivo aparece ao abrir',''],
           ['Em NF-e agrupada','entrou numa nota única do período','']],
   aviso:'Agrupar vendas numa NF-e única no fim do mês tem regra própria e varia por '+
    'estado. Confirme com seu contador antes de usar em produção — o sistema faz o que '+
    'você mandar, mas quem responde pela escrituração é você.',
   ok:'Entendi',cancelar:null}).then(function(){});
}
async function converterAgrupada(){
  var lst=filtrarCupons().filter(function(c){return CFI.sel[c.id]});
  if(!lst.length)return;
  var tot=lst.reduce(function(a,c){return a+(Number(c.total)||0)},0);
  var jaAut=lst.filter(function(c){return c.status==='autorizado'}).length;
  var ok=await confirmar({
    titulo:'Converter em NF-e agrupada',
    texto:lst.length+' cupons — R$ '+money(tot),
    aviso:(jaAut?('ATENÇÃO: '+jaAut+' desses cupons já estão autorizados na SEFAZ. '+
      'Incluir nota já emitida numa NF-e agrupada gera dupla escrituração. ')
      :'')+
     'Esta operação depende do provedor estar ligado e das regras do seu estado. '+
     'Confirme com seu contador.',
    ok:'Marcar para agrupar',tipo:'perigo'});
  if(!ok)return;
  var ref=uid('nfa');
  lst.forEach(function(c){c.status='agrupado';c.nfeAgrupada=ref;});
  CFI.sel={};salvar();telaCuponsFiscais();
  toast(lst.length+' cupons marcados para a NF-e agrupada.');
  if(NUVEM.ligada)sincronizar();
}
function exportarCupons(){
  var lst=filtrarCupons();
  if(!lst.length){toast('Nada para exportar.');return;}
  var l=[['Data da venda','Hora','Pedido','Origem','Cupom','NF-e agrupada','Chave de acesso',
          'Consumidor','Documento','Pagamento','Status da nota','Status da venda',
          'Entrega','Desconto','Total']];
  lst.forEach(function(c){
    l.push([dataBR(diaLocal(c.data)),c.hora||'',c.pedidoNumero||'',c.origem||'',
      c.numero||'',c.nfeAgrupada||'',c.chave||'',c.consumidor||'',c.doc||'',c.pagamento||'',
      nomeStatusCupom(c.status),situacaoVenda(c),
      String(c.entrega||0).replace('.',','),String(c.desconto||0).replace('.',','),
      String(c.total||0).replace('.',',')]);
  });
  baixarCSV(l,'cupons-fiscais');
}
/* toda venda vira um registro aqui, mesmo com a emissao desligada */
function registrarCupom(ped){
  baseCuponsFiscais();
  var f=fiscalCfg();
  var origem=ped.canal==='mesa'?'mesa':(ped.tipo==='entrega'?'entrega':
             (ped.origem==='online'?'online':'salao'));
  DB.cupons_f.push({
    id:uid('cf'),pedidoId:ped.id,pedidoNumero:ped.numero,origem:origem,
    data:String(ped.data||hojeISO()).slice(0,10),hora:ped.hora||agoraHM(),
    consumidor:(ped.cliente&&ped.cliente.nome)||ped.clienteNome||'',
    doc:(ped.cliente&&ped.cliente.cpf)||'',
    pagamento:(ped.pagamentos||[]).map(function(p){return p.nome||p.metodo||''})
      .filter(Boolean).join(', '),
    total:Number(ped.total)||0,desconto:Number(ped.desconto)||0,
    entrega:Number(ped.taxa)||0,
    status:'pendente',ambiente:f.ambiente,serie:f.serie
  });
}

/* ==========================================================
   MESAS — cadastro e QR Code
   Cada mesa tem um QR proprio. O cliente aponta a camera, cai no
   cardapio digital ja sabendo em que mesa esta, e o pedido chega
   marcado. O garcom nao precisa anotar de que mesa veio.
   ========================================================== */
var MS={sel:{}};
function baseMesas(){DB.mesas=DB.mesas||[];return DB.mesas;}
function mesasAtivas(){
  baseMesas();
  return DB.mesas.filter(function(m){return m.ativa!==false})
    .sort(function(a,b){return (a.numero||0)-(b.numero||0)});
}
function mesaPorNumero(n){
  baseMesas();
  return DB.mesas.find(function(m){return String(m.numero)===String(n)})||null;
}
/* o endereco que o QR carrega */
function linkMesa(m){
  var suc=m.sucursalId||(sucAtivas()[0]||{}).id||'';
  return 'https://rafaeluendes-jpg.github.io/delivery/?mesa='+encodeURIComponent(m.numero)+
         (suc?'&loja='+encodeURIComponent(suc):'');
}
/* A biblioteca do QR e carregada so quando a tela abre. Sobe uma vez e
   fica; nas outras visitas nao ha espera. */
/* O gerador agora e nosso e mora dentro do arquivo: a loja imprime o QR
   da mesa sem internet e sem depender de servidor de terceiro. */
function qrSVG(txt,px){
  var m=QRN.gerar(txt),n=m.length,q=4,t=n+q*2,e=[];
  for(var r=0;r<n;r++)for(var c=0;c<n;c++)
    if(m[r][c])e.push('M'+(c+q)+' '+(r+q)+'h1v1h-1z');
  return '<svg xmlns="http://www.w3.org/2000/svg" width="'+px+'" height="'+px+'" '+
   'viewBox="0 0 '+t+' '+t+'" shape-rendering="crispEdges">'+
   '<rect width="'+t+'" height="'+t+'" fill="#fff"/>'+
   '<path d="'+e.join('')+'" fill="#1B2419"/></svg>';
}
/* Uma fonte so era frágil: se o unpkg estivesse fora do ar ou bloqueado na
   rede da loja, o QR simplesmente nao aparecia e ninguem sabia por que.
   Agora tenta a segunda, e o erro aparece na tela em vez de sumir. */

function pintarQRs(){
  baseMesas();
  var av=$('msAviso');
  if(av)av.innerHTML='';
  DB.mesas.forEach(function(m){
    var cx=document.getElementById('qr_'+m.id);
    if(!cx)return;
    try{ cx.innerHTML=qrSVG(linkMesa(m),120); }
    catch(e){ cx.innerHTML='<span class="hint">'+E((e&&e.message)||'erro no QR')+'</span>'; }
  });
}
function telaMesas(){
  baseMesas();
  var lst=DB.mesas.slice().sort(function(a,b){return (a.numero||0)-(b.numero||0)});
  $('content').innerHTML='<div class="etWrap"><div class="etScroll">'+
   '<div class="etTopo">'+
    '<div><h1>Mesas</h1>'+
    '<p>Cada mesa ganha um QR Code próprio. O cliente aponta a câmera, o cardápio '+
    'abre já sabendo a mesa, e o pedido chega marcado no PDV.</p></div>'+
    '<button class="infoBt" onclick="explicaMesas()">'+sv('help',15)+'</button>'+
   '</div>'+
   '<div class="msBarra">'+
    '<div class="msGrupo"><b>Cadastrar</b>'+
     '<input type="number" id="msQtd" min="1" max="200" placeholder="Quantidade">'+
     '<button class="btnP2 ok" onclick="criarMesas()">Cadastrar mesas</button>'+
     '<button class="btnP2" onclick="criarUmaMesa()">Cadastrar apenas uma</button>'+
    '</div>'+
    '<div class="msGrupo"><b>Imprimir QR Code</b>'+
     '<button class="btnP2 ok" onclick="imprimirQR(false)">Imprimir todos</button>'+
     '<button class="btnP2" onclick="imprimirQR(true)">Imprimir selecionados</button>'+
    '</div>'+
   '</div>'+
   '<div class="msCfg">'+
    '<b>Taxa de serviço</b>'+
    '<label class="chkMini"><input type="checkbox" id="msTaxa" '+
     (cfgMesa().taxaServico?'checked':'')+' onchange="salvarCfgMesa()">'+
     '<span>Cobrar taxa de serviço na conta da mesa</span></label>'+
    '<div class="msPct"><input type="number" id="msPct" min="0" max="30" step="0.5" '+
     'value="'+(cfgMesa().taxaPct||10)+'" onchange="salvarCfgMesa()"><i>%</i></div>'+
    '<span class="hint">A taxa aparece na hora de fechar a conta e pode ser retirada '+
    'ali mesmo, se o cliente não quiser pagar.</span>'+
   '</div>'+
   '<div id="msAviso"></div>'+
   '<div class="msGrade">'+(lst.length?lst.map(function(m){
     return '<div class="msCard'+(m.ativa===false?' off':'')+'">'+
      '<div class="msH">'+
       '<label class="flagBox"><input type="checkbox" '+(MS.sel[m.id]?'checked':'')+
        ' onchange="MS.sel[\''+m.id+'\']=this.checked"></label>'+
       '<b>'+E(m.nome||m.numero)+'</b>'+
       '<div class="msAc">'+
        '<button class="rBtn" onclick="formMesa(\''+m.id+'\')" title="Editar">'+sv('edit',11)+'</button>'+
        '<button class="rBtn rd" onclick="excluirMesa(\''+m.id+'\')" title="Excluir">'+sv('trash',11)+'</button>'+
       '</div></div>'+
      '<div class="msQR" id="qr_'+m.id+'"></div>'+
      '<div class="msLink" onclick="copiarLinkMesa(\''+m.id+'\')" title="clique para copiar">'+
       sv('copy',10)+' copiar link</div>'+
      '<label class="chkMini msSw"><input type="checkbox" '+(m.ativa!==false?'checked':'')+
       ' onchange="togMesa(\''+m.id+'\')"><span>Mesa ativa</span></label>'+
     '</div>';
   }).join(''):'<div class="entVazio" style="grid-column:1/-1"><b>Nenhuma mesa cadastrada</b>'+
     '<span>Informe a quantidade acima e clique em Cadastrar mesas.</span></div>')+
   '</div>'+
   '</div></div>';
  rodape(lst.length+' mesas · '+mesasAtivas().length+' ativas');
  pintarQRs();
}
function salvarCfgMesa(){
  var cm=cfgMesa();
  cm.taxaServico=$('msTaxa').checked;
  cm.taxaPct=parseFloat($('msPct').value)||0;
  salvar();
  toast(cm.taxaServico?('Taxa de serviço de '+cm.taxaPct+'% ligada.'):'Taxa de serviço desligada.');
  if(NUVEM.ligada)sincronizar();
}
/* nem sempre da para escanear: o link tambem serve para testar no navegador */
function copiarLinkMesa(id){
  var m=(DB.mesas||[]).find(function(x){return x.id===id});
  if(!m)return;
  try{
    navigator.clipboard.writeText(linkMesa(m));
    toast('Link da mesa '+m.numero+' copiado — cole no navegador para testar.');
  }catch(e){ toast(linkMesa(m)); }
}
function explicaMesas(){
  confirmar({titulo:'Como a mesa funciona',texto:'Mesas e QR Code',
   linhas:[['O QR leva para','o cardápio digital, com a mesa já marcada',''],
           ['O pedido chega em','PDV › Mesas, na mesa certa',''],
           ['A conta','vai somando até você fechar',''],
           ['Ao fechar','cai no pagamento do PDV, como qualquer venda','']],
   aviso:'Desativar a mesa tira ela do salão e o QR dela para de aceitar pedido. '+
    'Mesa com conta aberta não pode ser excluída.',
   ok:'Entendi',cancelar:null}).then(function(){});
}
/* A numeracao vinha de DB.pedidos.length+1 — a CONTAGEM da lista. Com duas
   lojas na rede, as duas geravam o mesmo numero no mesmo dia, porque a lista
   traz os pedidos de todas as sucursais. E excluir um pedido fazia o numero
   voltar atras. Agora e o maior numero DAQUELA loja, mais um. */
/* "24/08/2026 13:01" -> data de verdade, no fuso de Brasilia.
   Devolve null quando o texto nao existe ou nao tem esse formato. */
function dataDoTexto(t){
  var m=/^(\d{2})\/(\d{2})\/(\d{4})[ T]+(\d{2}):(\d{2})/.exec(String(t||'').trim());
  if(!m)return null;
  return m[3]+'-'+m[2]+'-'+m[1]+'T'+m[4]+':'+m[5]+':00-03:00';
}
function proxNumPedido(){
  var suc=lojaAtualId?lojaAtualId():'';
  var max=0,maxGeral=0;
  (DB.pedidos||[]).forEach(function(p){
    var n2=Number(p.numero)||0;
    if(n2>maxGeral)maxGeral=n2;
    if(suc&&(p.sucursalId||'suc_matriz')!==suc)return;
    if(n2>max)max=n2;
  });
  /* ==========================================================
     NUMERO REPETIDO E PIOR DO QUE NUMERO FORA DE ORDEM

     A conta olhava so as vendas da unidade aberta. Venda gravada sem
     unidade — por defeito ou por versao antiga — ficava de fora, e o
     numero parava de andar: sete vendas com o mesmo 317, e a tela
     mostrando uma so. Agora, se houver numero maior em qualquer venda,
     ele e respeitado. Prefere-se um salto na sequencia a duas vendas
     com o mesmo numero.
     ========================================================== */
  return Math.max(max,maxGeral)+1;
}
/* Clique duplo no botao de pagamento gerava DUAS vendas iguais: estoque
   baixado duas vezes e faturamento contado duas vezes. A trava solta
   sozinha depois de 8 segundos, para nunca deixar o caixa preso. */
var _fechandoVenda=false;
function travarFecharVenda(){
  if(_fechandoVenda)return false;
  _fechandoVenda=true;
  setTimeout(function(){_fechandoVenda=false},8000);
  return true;
}
function liberarFecharVenda(){_fechandoVenda=false;}
/* ==========================================================
   TRAVA GENERICA DE DUPLO TOQUE (item 30)

   A venda ja tinha a sua (`travarFecharVenda`). Fechar caixa, sangria,
   suprimento e cancelamento nao tinham nenhuma: em tela de toque, o
   duplo toque acidental e comum, e uma sangria de R$ 200 tocada duas
   vezes vira R$ 400 fora da gaveta.

   Isto e a PRIMEIRA barreira, nao a unica. As travas do banco
   (`ref_local` unico, `tg_pagamento_nao_duplica`,
   `tg_caixa_fechado_trava_movimento`) continuam valendo, porque
   confiar so no botao seria confiar no navegador — e o robo, a
   sincronizacao e o cardapio nao passam por botao nenhum.
   ========================================================== */
var _emCurso={};
function travarOperacao(chave,segundos){
  if(_emCurso[chave])return false;
  _emCurso[chave]=true;
  setTimeout(function(){delete _emCurso[chave]},(segundos||8)*1000);
  return true;
}
function liberarOperacao(chave){ delete _emCurso[chave]; }
function proximoNumeroMesa(){
  baseMesas();
  var max=0;
  DB.mesas.forEach(function(m){if((m.numero||0)>max)max=m.numero||0});
  return max+1;
}
function criarMesas(){
  var q=parseInt(($('msQtd')||{}).value,10)||0;
  if(q<1){toast('Informe quantas mesas quer cadastrar.');return;}
  if(q>200){toast('No máximo 200 de uma vez.');return;}
  baseMesas();
  var n=proximoNumeroMesa();
  for(var i=0;i<q;i++){
    DB.mesas.push({id:uid('ms'),numero:n+i,nome:String(n+i),lugares:4,ativa:true,
      sucursalId:(sucAtivas()[0]||{}).id||''});
  }
  $('msQtd').value='';
  salvar();telaMesas();toast(q+' mesa(s) cadastrada(s).');
  if(NUVEM.ligada)sincronizar();
}
function criarUmaMesa(){formMesa();}
function formMesa(id){
  baseMesas();
  var m=id?DB.mesas.find(function(x){return x.id===id}):null;
  var sucs=sucAtivas();
  modal(m?'Editar mesa':'Cadastrar mesa',
  '<div class="mdB">'+
   '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'+
    '<div class="fld2"><label>Número da mesa *</label>'+
     '<input id="msNum" type="number" min="1" value="'+(m?m.numero:proximoNumeroMesa())+'"></div>'+
    '<div class="fld2"><label>Lugares</label>'+
     '<input id="msLug" type="number" min="1" value="'+(m?m.lugares||4:4)+'"></div>'+
   '</div>'+
   '<div class="fld2"><label>Nome na tela</label>'+
    '<input id="msNome" value="'+E(m?m.nome||'':'')+'" placeholder="Mesa 1, Varanda, Balcão...">'+
    '<div class="hint">Deixe em branco para usar o número.</div></div>'+
   (sucs.length>1?'<div class="fld2"><label>Unidade</label><select id="msSuc">'+
     sucs.map(function(s){
       return '<option value="'+E(s.id)+'"'+((m&&m.sucursalId)===s.id?' selected':'')+'>'+E(s.nome)+'</option>';
     }).join('')+'</select></div>':'')+
  '</div>','Salvar',function(){
    var num=parseInt($('msNum').value,10)||0;
    if(num<1){toast('Informe o número da mesa.');return false;}
    var rep=DB.mesas.some(function(x){return x.numero===num&&(!m||x.id!==m.id)});
    if(rep){toast('Já existe a mesa '+num+'.');return false;}
    var o={numero:num,lugares:parseInt($('msLug').value,10)||4,
      nome:$('msNome').value.trim()||String(num),
      sucursalId:($('msSuc')?$('msSuc').value:(m?m.sucursalId:(sucs[0]||{}).id))||''};
    if(m)Object.assign(m,o);
    else DB.mesas.push(Object.assign({id:uid('ms'),ativa:true},o));
    salvar();telaMesas();toast(m?'Mesa atualizada.':'Mesa cadastrada.');
    if(NUVEM.ligada)sincronizar();
    return true;
  });
}
function togMesa(id){
  var m=(DB.mesas||[]).find(function(x){return x.id===id});
  if(!m)return;
  m.ativa=(m.ativa===false);
  salvar();
  var c=document.getElementById('qr_'+id);
  if(c&&c.parentNode&&c.parentNode.parentNode)
    c.parentNode.parentNode.classList.toggle('off',m.ativa===false);
  rodape((DB.mesas||[]).length+' mesas · '+mesasAtivas().length+' ativas');
  if(NUVEM.ligada)sincronizar();
}
async function excluirMesa(id){
  var m=(DB.mesas||[]).find(function(x){return x.id===id});
  if(!m)return;
  var abertos=(DB.pedidos||[]).filter(function(p){
    return p.mesaId===id&&!ehFinalizado(p)&&!ehCancelado(p);}).length;
  if(abertos){
    toast('A mesa '+m.numero+' tem conta aberta. Feche a conta antes de excluir.');
    return;
  }
  var ok=await confirmar({titulo:'Excluir a mesa '+E(m.nome||m.numero),
    texto:'O QR Code dela para de funcionar',
    aviso:'Quem já imprimiu esse QR e colou na mesa vai precisar trocar. '+
     'Se for só para tirar de uso, desative em vez de excluir.',
    ok:'Excluir',tipo:'perigo'});
  if(!ok)return;
  DB.mesas=DB.mesas.filter(function(x){return x.id!==id}); declararExclusao('mesas',id); /* exclusao declarada: so isto autoriza apagar da nuvem (V201) */
  delete MS.sel[id];
  salvar();telaMesas();toast('Mesa excluída.');
  if(NUVEM.ligada)sincronizar();
}
function imprimirQR(soSelecionadas){
  baseMesas();
  var lst=DB.mesas.slice().sort(function(a,b){return (a.numero||0)-(b.numero||0)});
  if(soSelecionadas)lst=lst.filter(function(m){return MS.sel[m.id]});
  if(!lst.length){toast(soSelecionadas?'Nenhuma mesa selecionada.':'Nenhuma mesa cadastrada.');return;}
  var loja=(sucAtivas()[0]||{}).nome||'';
  var partes=[];
  for(var i=0;i<lst.length;i++){
    partes.push('<div class="qrPg"><div class="qrCx">'+
      '<div class="qrLoja">'+E(loja)+'</div>'+
      '<div class="qrIm">'+qrSVG(linkMesa(lst[i]),340)+'</div>'+
      '<div class="qrMesa">MESA '+E(lst[i].nome||lst[i].numero)+'</div>'+
      '<div class="qrTx">Aponte a câmera e faça seu pedido</div>'+
      '</div></div>');
  }
  var el=document.getElementById('viaImp')||document.createElement('div');
  el.id='viaImp';el.innerHTML=partes.join('');
  document.body.appendChild(el);
  var st=document.getElementById('impCSS')||document.createElement('style');
  st.id='impCSS';
  st.textContent='@media print{@page{size:A4;margin:12mm}'+
   'body>*{display:none!important}#viaImp{display:block!important}'+
   '.qrPg{page-break-after:always;display:flex;align-items:center;justify-content:center;height:250mm}'+
   '.qrCx{text-align:center;border:2px solid #111;border-radius:14px;padding:26px 34px}'+
   '.qrCx .qrIm svg{width:74mm;height:74mm}'+
   '.qrLoja{font:600 15pt sans-serif;margin-bottom:10px}'+
   '.qrMesa{font:700 30pt sans-serif;margin-top:10px;letter-spacing:.04em}'+
   '.qrTx{font:12pt sans-serif;margin-top:6px;color:#444}}';
  document.head.appendChild(st);
  setTimeout(function(){window.print()},350);
}


/* ==========================================================
   COMANDAS DA MESA
   A conta e da mesa, mas cada pessoa tem a comanda dela dentro.
   Dois casais na mesa 1: abre "Joao" e "Rodrigo" e o que cada um
   pede nao se mistura. Na hora de pagar, ou junta tudo num
   pagamento so, ou cada um paga a sua.
   ========================================================== */
/* ==========================================================
   MODOS DE VENDA
   Nem toda loja vende do mesmo jeito. A Jolô nao tem mesa; uma
   lanchonete tem. Em vez de a mesa aparecer para todo mundo, cada
   loja liga o que usa — e o que esta desligado some do PDV, do menu
   e dos relatorios, em vez de ficar ali atrapalhando.
   ========================================================== */
var MODOS=[
 {id:'balcao', n:'Frente de caixa', d:'venda no balcão, o cliente leva na hora'},
 {id:'entrega',n:'Entrega',         d:'delivery com endereço e taxa'},
 {id:'mesa',   n:'Mesa',            d:'comanda por mesa, QR Code e taxa de serviço'}
];
function modos(){
  var c=cfg();
  c.modos=c.modos||{};
  /* balcão e entrega já eram como o sistema funcionava: continuam ligados.
     Mesa nasce DESLIGADA — quem não usa não deve nem ver que existe. */
  if(c.modos.balcao===undefined)c.modos.balcao=true;
  if(c.modos.entrega===undefined)c.modos.entrega=true;
  if(c.modos.mesa===undefined)c.modos.mesa=false;
  return c.modos;
}
function modoAtivo(id){
  if(id==='mesa'&&!recursoContratado('loja','mesas'))return false;  /* fechado no contrato */
  return modos()[id]!==false&&!!modos()[id];
}
function cfgMesa(){
  var c=cfg();
  c.mesa=c.mesa||{};
  if(c.mesa.taxaServico===undefined)c.mesa.taxaServico=false;
  if(c.mesa.taxaPct===undefined)c.mesa.taxaPct=10;
  return c.mesa;
}
function baseComandas(){DB.comandas=DB.comandas||[];return DB.comandas;}
function comandasDaMesa(mesaId){
  baseComandas();
  return DB.comandas.filter(function(c){return c.mesaId===mesaId&&c.aberta!==false});
}
function totalComanda(c){
  return (c.itens||[]).reduce(function(a,i){return a+(Number(i.total)||0)},0);
}
function totalMesa(mesaId){
  return comandasDaMesa(mesaId).reduce(function(a,c){return a+totalComanda(c)},0);
}
function mesaOcupada(mesaId){return comandasDaMesa(mesaId).length>0;}
function comandaPorId(id){
  baseComandas();
  return DB.comandas.find(function(c){return c.id===id})||null;
}
function taxaSobre(v){
  var cm=cfgMesa();
  if(!cm.taxaServico)return 0;
  return +(v*(Number(cm.taxaPct)||0)/100).toFixed(2);
}

/* ---------- o salão ---------- */
function renderMesas(){
  baseMesas();baseComandas();
  var lst=mesasAtivas();
  if(!lst.length){
    $('pdvBody').innerHTML='<div class="vazio2" style="padding:40px">'+
     'Nenhuma mesa cadastrada. Vá em <b>Configuração da Loja › Mesas e QR Code</b>.</div>';
    return;
  }
  var h='<div class="salaoWrap"><div class="salaoGrade">'+lst.map(function(m){
    var cs=comandasDaMesa(m.id);
    var tot=totalMesa(m.id);
    return '<div class="mesaBox'+(cs.length?' ocupada':'')+'" onclick="abrirMesa(\''+m.id+'\')">'+
     '<div class="mesaN">'+E(m.nome||m.numero)+'</div>'+
     (cs.length
      ?'<div class="mesaC">'+cs.slice(0,3).map(function(c){return E(c.nome)}).join(' · ')+
        (cs.length>3?' +'+(cs.length-3):'')+'</div>'+
       '<div class="mesaV">R$ '+money(tot)+'</div>'
      :'<div class="mesaLivre">livre</div>')+
    '</div>';
  }).join('')+'</div></div>';
  $('pdvBody').innerHTML=h;
}
function abrirMesa(id){
  var m=(DB.mesas||[]).find(function(x){return x.id===id});
  if(!m)return;
  var cs=comandasDaMesa(id);
  var sub=totalMesa(id);
  var tx=taxaSobre(sub);
  var h='<div class="mdB">'+
   (cs.length?'<div class="cmdLista">'+cs.map(function(c){
     var t=totalComanda(c);
     return '<div class="cmdIt">'+
      '<div class="cmdN"><b>'+E(c.nome)+'</b>'+
       '<span>'+(c.itens||[]).reduce(function(a,i){return a+(Number(i.qtd)||0)},0)+' itens</span></div>'+
      '<div class="cmdV">R$ '+money(t)+'</div>'+
      '<div class="cmdAc">'+
       '<button class="btnP2" onclick="lancarNaComanda(\''+c.id+'\')">'+sv('plus',12)+' Lançar</button>'+
       '<button class="btnP2" onclick="verComanda(\''+c.id+'\')" title="Ver itens">'+sv('eye',12)+'</button>'+
       '<button class="btnP2" onclick="renomearComanda(\''+c.id+'\')" title="Trocar o nome">'+sv('edit',12)+'</button>'+
       '<button class="btnP2 rd" onclick="excluirComanda(\''+c.id+'\')" title="Excluir comanda">'+sv('trash',12)+'</button>'+
       '<button class="btnP2 ok" onclick="fecharComanda(\''+c.id+'\')">Pagar</button>'+
      '</div></div>';
   }).join('')+'</div>'
   :'<div class="entVazio"><b>Mesa livre</b><span>Abra uma comanda para começar.</span></div>')+
   '<button class="btnP2" style="width:100%;justify-content:center;margin-top:10px" '+
    'onclick="novaComanda(\''+id+'\')">'+sv('plus',13)+' Nova comanda nesta mesa</button>'+
   (cs.length?'<button class="btnP2 rd" style="width:100%;justify-content:center;margin-top:7px" '+
     'onclick="liberarMesa(\''+id+'\')">'+sv('trash',13)+' Liberar mesa sem cobrar</button>':'')+
   (cs.length?'<div class="cmdTot">'+
     '<div class="linha"><span>Soma das comandas</span><b>R$ '+money(sub)+'</b></div>'+
     (tx?'<div class="linha"><span>Taxa de serviço ('+cfgMesa().taxaPct+'%)</span><b>R$ '+money(tx)+'</b></div>':'')+
     '<div class="linha tot"><span>TOTAL DA MESA</span><b>R$ '+money(sub+tx)+'</b></div>'+
    '</div>'+
    (cs.length>1?'<button class="btnPag" style="width:100%;justify-content:center;margin-top:10px" '+
      'onclick="fecharMesaUnificada(\''+id+'\')">'+sv('cash',15)+' Unificar pagamento das '+cs.length+' comandas</button>':'')
   :'')+
  '</div>';
  var ov=document.createElement('div');ov.className='mdOv';ov.id='mdOv';
  ov.innerHTML='<div class="mdBox lg"><div class="mdH"><b>Mesa '+E(m.nome||m.numero)+'</b>'+
   '<button onclick="fecharModal()">&times;</button></div>'+h+
   '<div class="mdF"><button class="btnP2" onclick="fecharModal()">Fechar</button></div></div>';
  document.body.appendChild(ov);
  fecharSoForaDeVerdade(ov);
}
function novaComanda(mesaId){
  var m=(DB.mesas||[]).find(function(x){return x.id===mesaId});
  if(!m)return;
  fecharModal();
  modal('Nova comanda na mesa '+E(m.nome||m.numero),
  '<div class="mdB"><div class="fld2"><label>Nome de quem vai consumir *</label>'+
   '<input id="cmNome" placeholder="João, Rodrigo, Casal 1..." autocomplete="off">'+
   '<div class="hint">É por este nome que os itens ficam separados dentro da mesa.</div>'+
   '</div></div>','Abrir comanda',function(){
    var nome=$('cmNome').value.trim();
    if(!nome){toast('Informe o nome.');return false;}
    var rep=comandasDaMesa(mesaId).some(function(c){
      return c.nome.toLowerCase()===nome.toLowerCase();});
    if(rep){toast('Já existe uma comanda com este nome nesta mesa.');return false;}
    baseComandas();
    DB.comandas.push({id:uid('cm'),mesaId:mesaId,mesaNumero:m.numero,nome:nome,
      itens:[],aberta:true,abertaEm:new Date().toISOString(),
      sucursalId:m.sucursalId||''});
    salvar();
    if(PDV.aba==='mesas')renderMesas();
    toast('Comanda de '+nome+' aberta.');
    setTimeout(function(){abrirMesa(mesaId)},120);
    if(NUVEM.ligada)sincronizar();
    return true;
  });
  setTimeout(function(){var i=$('cmNome');if(i)i.focus();},80);
}
/* leva para a aba de venda, marcando que o que for lançado vai para esta comanda */
function lancarNaComanda(id){
  var c=comandaPorId(id);if(!c)return;
  PDV.comandaId=id;PDV.comanda=[];PDV.aba='venda';PDV.tipo='loja';
  fecharModal();telaPDV();
  toast('Lançando para '+c.nome+' — mesa '+c.mesaNumero+'.');
}
function sairDaComanda(){
  PDV.comandaId=null;PDV.comanda=[];
  telaPDV();
}
/* manda o que está na tela para a comanda, sem cobrar nada ainda */
function enviarParaComanda(){
  var c=comandaPorId(PDV.comandaId);
  if(!c){toast('Comanda não encontrada.');return;}
  if(!PDV.comanda.length){toast('Nenhum item para lançar.');return;}
  c.itens=(c.itens||[]).concat(JSON.parse(JSON.stringify(PDV.comanda)));
  PDV.comanda=[];
  salvar();
  toast('Lançado na comanda de '+c.nome+'.');
  renderVenda();
  if(NUVEM.ligada)sincronizar();
}
function verComanda(id){
  var c=comandaPorId(id);if(!c)return;
  var tot=totalComanda(c);
  fecharModal();
  modal('Comanda de '+E(c.nome),
  '<div class="mdB">'+
   ((c.itens||[]).length?'<div class="cvItens">'+c.itens.map(function(i,k){
     return '<div><span>'+i.qtd+'× '+E(i.nome)+'</span>'+
      '<b>R$ '+money(i.total)+'</b>'+
      '<button class="rBtn rd" onclick="tirarDaComanda(\''+id+'\','+k+')" title="Remover">'+
      sv('trash',11)+'</button></div>';
   }).join('')+'</div>'
   :'<div class="entVazio"><b>Comanda vazia</b><span>Nada lançado ainda.</span></div>')+
   '<div class="cmdTot"><div class="linha tot"><span>TOTAL</span><b>R$ '+money(tot)+'</b></div></div>'+
  '</div>','Voltar à mesa',function(){
    setTimeout(function(){abrirMesa(c.mesaId)},80);return true;});
}
function tirarDaComanda(id,k){
  var c=comandaPorId(id);if(!c)return;
  c.itens.splice(k,1);
  salvar();fecharModal();
  setTimeout(function(){verComanda(id)},60);
  if(NUVEM.ligada)sincronizar();
}

/* ---------- desfazer ----------
   Nem toda comanda termina em venda: teste, nome errado, cliente que
   desistiu. Sem uma saida, a mesa ficava ocupada para sempre. */
function renomearComanda(id){
  var c=comandaPorId(id);if(!c)return;
  var mesaId=c.mesaId;
  fecharModal();
  modal('Trocar o nome da comanda',
  '<div class="mdB"><div class="fld2"><label>Nome</label>'+
   '<input id="cmNv" value="'+E(c.nome)+'" autocomplete="off"></div></div>','Salvar',function(){
    var nv=$('cmNv').value.trim();
    if(!nv){toast('Informe o nome.');return false;}
    var rep=comandasDaMesa(mesaId).some(function(x){
      return x.id!==id&&x.nome.toLowerCase()===nv.toLowerCase();});
    if(rep){toast('Já existe uma comanda com este nome nesta mesa.');return false;}
    c.nome=nv;salvar();
    setTimeout(function(){abrirMesa(mesaId)},80);
    toast('Nome alterado.');
    if(NUVEM.ligada)sincronizar();
    return true;
  });
}
async function excluirComanda(id){
  var c=comandaPorId(id);if(!c)return;
  var mesaId=c.mesaId;
  var qtd=(c.itens||[]).length, tot=totalComanda(c);
  fecharModal();
  var ok=await confirmar({
    titulo:'Excluir a comanda de '+E(c.nome),
    texto:qtd?(qtd+' item(ns) — R$ '+money(tot)):'comanda vazia',
    aviso:qtd?('Os itens somem e NADA é cobrado. Isso não é uma venda cancelada: '+
      'é como se a comanda nunca tivesse existido. Se o cliente consumiu, '+
      'feche pagando em vez de excluir.')
     :'A comanda está vazia — pode excluir à vontade.',
    ok:'Excluir',tipo:'perigo'});
  if(!ok)return;
  DB.comandas=DB.comandas.filter(function(x){return x.id!==id});
  if(PDV.comandaId===id)PDV.comandaId=null;
  salvar();
  if(comandasDaMesa(mesaId).length)setTimeout(function(){abrirMesa(mesaId)},80);
  else if(PDV.aba==='mesas')renderMesas();
  toast('Comanda excluída — nada foi cobrado.');
  if(NUVEM.ligada)sincronizar();
}
async function liberarMesa(mesaId){
  var m=(DB.mesas||[]).find(function(x){return x.id===mesaId})||{};
  var cs=comandasDaMesa(mesaId);
  if(!cs.length)return;
  var tot=totalMesa(mesaId);
  fecharModal();
  var ok=await confirmar({
    titulo:'Liberar a mesa '+E(m.nome||m.numero),
    texto:cs.length+' comanda(s) — R$ '+money(tot),
    linhas:cs.map(function(c){
      return [c.nome,(c.itens||[]).length+' itens','R$ '+money(totalComanda(c))];}),
    aviso:'Todas as comandas desta mesa somem e NADA é cobrado. Use quando a mesa '+
     'foi aberta por engano ou em teste. Se houve consumo de verdade, feche pagando.',
    ok:'Liberar sem cobrar',tipo:'perigo'});
  if(!ok)return;
  var ids={};cs.forEach(function(c){ids[c.id]=true});
  DB.comandas=DB.comandas.filter(function(x){return !ids[x.id]});
  if(ids[PDV.comandaId])PDV.comandaId=null;
  salvar();
  if(PDV.aba==='mesas')renderMesas();
  toast('Mesa '+(m.nome||m.numero)+' liberada.');
  if(NUVEM.ligada)sincronizar();
}

/* ---------- fechar a conta ----------
   Fechar comanda vira venda. Como o consumo ja aconteceu, ela nasce
   concluida: nao passa por preparacao nem por entrega. */
function fecharComanda(id){
  var c=comandaPorId(id);if(!c)return;
  if(!(c.itens||[]).length){toast('A comanda de '+c.nome+' está vazia.');return;}
  fecharModal();
  pagarComandas([c],'Mesa '+c.mesaNumero+' — '+c.nome);
}
function fecharMesaUnificada(mesaId){
  var cs=comandasDaMesa(mesaId).filter(function(c){return (c.itens||[]).length});
  if(!cs.length){toast('Nenhuma comanda com itens nesta mesa.');return;}
  var m=(DB.mesas||[]).find(function(x){return x.id===mesaId})||{};
  fecharModal();
  pagarComandas(cs,'Mesa '+(m.nome||m.numero)+' — '+cs.length+' comandas');
}
/* junta os itens das comandas escolhidas e manda para o pagamento normal */
function pagarComandas(cs,titulo){
  if(!caixaAberto()){toast('Abra a frente de caixa antes de fechar a conta.');return;}
  var itens=[];
  cs.forEach(function(c){
    (c.itens||[]).forEach(function(i){
      var x=JSON.parse(JSON.stringify(i));
      if(cs.length>1)x.comanda=c.nome;   /* pagamento unificado: quem pediu o que */
      itens.push(x);
    });
  });
  var sub=itens.reduce(function(a,i){return a+(Number(i.total)||0)},0);
  MESA_PAG={comandas:cs.map(function(c){return c.id}),itens:itens,
    sub:sub,taxa:taxaSobre(sub),titulo:titulo,
    mesaId:cs[0].mesaId,mesaNumero:cs[0].mesaNumero,
    nome:cs.length===1?cs[0].nome:''};
  telaPagarMesa();
}
var MESA_PAG=null;
function telaPagarMesa(){
  var P=MESA_PAG;if(!P)return;
  var cm=cfgMesa();
  var total=P.sub+P.taxa;
  modal(P.titulo,
  '<div class="mdB">'+
   '<div class="cvItens">'+P.itens.map(function(i){
     return '<div><span>'+i.qtd+'× '+E(i.nome)+(i.comanda?' <em class="cmdTag">'+E(i.comanda)+'</em>':'')+
      '</span><b>R$ '+money(i.total)+'</b></div>';
   }).join('')+'</div>'+
   '<div class="cmdTot">'+
    '<div class="linha"><span>Consumo</span><b>R$ '+money(P.sub)+'</b></div>'+
    (cm.taxaServico
     ?'<div class="linha"><span><label class="chkMini" style="margin:0">'+
       '<input type="checkbox" id="pmTaxa" checked onchange="MESA_PAG.taxa=this.checked?taxaSobre(MESA_PAG.sub):0;fecharModal();telaPagarMesa()">'+
       '<span>Taxa de serviço '+cm.taxaPct+'%</span></label></span>'+
       '<b>R$ '+money(P.taxa)+'</b></div>':'')+
    '<div class="linha tot"><span>TOTAL</span><b>R$ '+money(total)+'</b></div>'+
   '</div>'+
   '<div class="hint" style="margin-top:10px">Ao confirmar, a venda entra concluída — '+
   'não passa pelo preparo, porque o cliente já consumiu.</div>'+
  '</div>','Ir para o pagamento',function(){
    PDV.comanda=P.itens.map(function(i){return JSON.parse(JSON.stringify(i))});
    PDV.tipo='loja';PDV.mesaPag=true;
    setTimeout(irPagamento,120);
    return true;
  });
}
/* chamado depois que o pagamento da mesa e confirmado */
function concluirMesa(ped){
  var P=MESA_PAG;if(!P)return;
  ped.mesaId=P.mesaId;ped.mesa=P.mesaNumero;
  ped.comandaNome=P.nome||'';
  /* se o operador tirou ou mudou a taxa na tela de pagamento, vale o que ele fez */
  ped.taxaServico=Number(ped.taxa)||0;
  ped.canal='mesa';
  baseComandas();
  P.comandas.forEach(function(cid){
    var c=comandaPorId(cid);
    if(!c)return;
    c.aberta=false;c.fechadaEm=new Date().toISOString();c.pedidoRef=ped.id;
  });
  MESA_PAG=null;PDV.mesaPag=false;PDV.comandaId=null;
  salvar();
  PDV.aba='mesas';telaPDV();
  if(NUVEM.ligada)sincronizar();
}

/* ==========================================================
   LAYOUT DO MENU — só o dono da Joia
   A ordem dos modulos e das telas dentro deles estava escrita no
   codigo. Agora ela vem de uma linha unica no banco, valida para
   todas as redes: o que for salvo aqui muda o menu de todo mundo.
   Em vez de cada tela consultar a ordem, o proprio MOD e reordenado
   assim que o layout chega — quem desenha o menu nao precisa saber
   que isso existe.
   ========================================================== */
function aplicarLayoutMenu(){
  var L=DB._layoutMenu;
  if(!L)return;
  if(L.mods&&L.mods.length){
    var pos={};L.mods.forEach(function(id,i){pos[id]=i});
    /* modulo que nao esta na lista salva vai para o fim, sem sumir */
    MOD.sort(function(a,b){
      var pa=(pos[a.id]===undefined)?999:pos[a.id];
      var pb=(pos[b.id]===undefined)?999:pos[b.id];
      return pa-pb;
    });
  }
  if(L.itens){
    MOD.forEach(function(m){
      var ord=L.itens[m.id];
      if(!ord||!ord.length)return;
      var p={};ord.forEach(function(id,i){p[id]=i});
      m.it.sort(function(a,b){
        var pa=(p[a.id]===undefined)?999:p[a.id];
        var pb=(p[b.id]===undefined)?999:p[b.id];
        return pa-pb;
      });
    });
  }
}
async function baixarLayoutMenu(){
  if(!NUVEM.ligada||!NUVEM.cli)return;
  try{
    var r=await NUVEM.cli.from('menu_layout').select('mods,itens').eq('id',1).maybeSingle();
    if(r.error||!r.data)return;
    DB._layoutMenu={mods:r.data.mods||[],itens:r.data.itens||{}};
    aplicarLayoutMenu();
    gravarLocal();
    try{faixa()}catch(e){_quieto(e,'baixarLayoutMenu')}
  }catch(e){_quieto(e,'baixarLayoutMenu')}
}
var LM={mod:null};
function telaLayoutMenu(){
  if(!ehPlataforma()){
    $('content').innerHTML='<div class="construWrap"><div class="construBox">'+
     '<div class="construIc">'+sv('lock',30)+'</div><b>Tela do dono da Joia</b>'+
     '<p>Só a plataforma configura o layout do menu.</p></div></div>';
    rodape('sem permissão');return;
  }
  $('content').innerHTML='<div class="etWrap"><div class="etScroll">'+
   '<div class="etTopo">'+
    '<div><h1>Layout do Menu</h1>'+
    '<p>A ordem em que os módulos e as telas aparecem para <b>todos os clientes</b>. '+
    'Suba o que é mais usado. Nada some daqui — para tirar uma tela de um cliente, '+
    'use Clientes Joia &rsaquo; Telas liberadas.</p></div>'+
    '<div style="flex:1"></div>'+
    '<button class="btnP2 ok" onclick="salvarLayoutMenu()">'+sv('nike',14)+' Salvar e publicar</button>'+
   '</div>'+
   '<div id="lmBox">'+listaLayoutHTML()+'</div>'+
   '</div></div>';
  rodape(MOD.length+' módulos');
}
function listaLayoutHTML(){
  return '<div class="lmLista">'+MOD.map(function(m,i){
    var ab=(LM.mod===m.id);
    return '<div class="lmMod'+(ab?' on':'')+'">'+
     '<div class="lmH" onclick="LM.mod=(LM.mod===\''+m.id+'\'?null:\''+m.id+'\');redesenharLayout()">'+
      '<span class="lmIc">'+svMod(m.id,m.ic||'gear2',15)+'</span>'+
      '<div class="lmN"><b>'+E(m.n)+'</b><span>'+(m.it||[]).length+' telas</span></div>'+
      '<div class="lmAc" onclick="event.stopPropagation()">'+
       (i>0?'<button class="rBtn" onclick="moverMod('+i+',-1)" title="Subir">'+sv('cima',12)+'</button>':'')+
       (i<MOD.length-1?'<button class="rBtn" onclick="moverMod('+i+',1)" title="Descer">'+sv('baixo',12)+'</button>':'')+
      '</div>'+
      '<span class="lmSeta">'+sv(ab?'cima':'baixo',13)+'</span>'+
     '</div>'+
     (ab?'<div class="lmItens">'+(m.it||[]).map(function(t,j){
       return '<div class="lmIt">'+
        '<span>'+E(t.n)+'</span>'+
        '<div class="lmAc">'+
         (j>0?'<button class="rBtn" onclick="moverItem(\''+m.id+'\','+j+',-1)" title="Subir">'+sv('cima',11)+'</button>':'')+
         (j<m.it.length-1?'<button class="rBtn" onclick="moverItem(\''+m.id+'\','+j+',1)" title="Descer">'+sv('baixo',11)+'</button>':'')+
        '</div></div>';
     }).join('')+'</div>':'')+
    '</div>';
  }).join('')+'</div>';
}
function redesenharLayout(){
  var b=$('lmBox');
  if(!b){telaLayoutMenu();return;}
  b.innerHTML=listaLayoutHTML();
}
function moverMod(i,d){
  if(i+d<0||i+d>=MOD.length)return;
  var t=MOD[i];MOD[i]=MOD[i+d];MOD[i+d]=t;
  redesenharLayout();faixa();
}
function moverItem(mid,j,d){
  var m=M(mid);if(!m)return;
  if(j+d<0||j+d>=m.it.length)return;
  var t=m.it[j];m.it[j]=m.it[j+d];m.it[j+d]=t;
  redesenharLayout();
}
async function salvarLayoutMenu(){
  if(!ehPlataforma()){toast('Só o dono da Joia pode publicar o layout.');return;}
  var mods=MOD.map(function(m){return m.id});
  var itens={};
  MOD.forEach(function(m){itens[m.id]=(m.it||[]).map(function(t){return t.id})});
  DB._layoutMenu={mods:mods,itens:itens};
  gravarLocal();
  if(!NUVEM.ligada||!NUVEM.cli){
    toast('Layout guardado neste aparelho. Ligue a nuvem para publicar.');
    return;
  }
  try{
    var r=await NUVEM.cli.from('menu_layout')
      .update({mods:mods,itens:itens,atualizado_em:new Date().toISOString()}).eq('id',1);
    if(r.error)throw r.error;
    toast('Layout publicado — vale para todas as redes.');
  }catch(e){
    toast('Não consegui publicar: '+((e&&e.message)||'falha'));
  }
}

/* ==========================================================
   STATUS DE VENDA — as colunas do Kanban viraram cadastro
   Antes as fases eram uma lista fixa dentro do codigo e o resto do
   sistema perguntava pelo NOME da fase ("e igual a cancelado?").
   Com status que o cliente cria, o nome deixa de servir: o que vale
   e o PAPEL — o que aquele status faz. Cancelado estorna estoque e
   sai do faturamento; finalizado conta a venda. O nome pode ser
   qualquer um.
   ========================================================== */
var PAPEIS=[
 {id:'aguardando',n:'Aguardando',   d:'pedido novo, ainda nao comecou'},
 {id:'producao',  n:'Producao',     d:'esta sendo preparado'},
 {id:'pronto',    n:'Pronto',       d:'aguardando retirada no balcao'},
 {id:'entrega',   n:'Em entrega',   d:'saiu com o entregador'},
 {id:'finalizado',n:'Finalizado',   d:'venda concluida — entra no faturamento'},
 {id:'cancelado', n:'Cancelado',    d:'estorna o estoque e sai do faturamento'}
];
function nomePapel(id){var p=PAPEIS.find(function(x){return x.id===id});return p?p.n:id;}

function baseStatus(){
  DB.statusVenda=DB.statusVenda||[];
  if(DB.statusVenda.length)return DB.statusVenda;
  if(DB._semeado&&DB._semeado.statusVenda)return DB.statusVenda;
  if(NUVEM.ligada&&!DB._baixouUmaVez)return DB.statusVenda;
  DB._semeado=DB._semeado||{}; DB._semeado.statusVenda=true;
  if(!DB.statusVenda.length){
    /* nasce com o que ja existia, e com os MESMOS identificadores — assim os
       pedidos gravados antes continuam apontando para o status certo */
    var ativas=(cfg().fases||['aguardando','preparo','saiu','entregue','cancelado']);
    [['aguardando','Aguardando preparacao','aguardando','#8A8578'],
     ['preparo','Em preparacao','producao','#C9922F'],
     ['pronto','Pronto para retirada','pronto','#1F5F8B'],
     ['saiu','Saiu para entrega','entrega','#1F5F8B'],
     ['entregue','Entregue / Concluido','finalizado','#0E8A46'],
     ['cancelado','Cancelado','cancelado','#B4542F']]
     .forEach(function(x,i){
       DB.statusVenda.push({id:x[0],nome:x[1],papel:x[2],cor:x[3],ordem:i,
         ativo:ativas.indexOf(x[0])>=0,minutos:0,som:false,confPag:false});
     });
  }
  return DB.statusVenda;
}
function statusVenda(id){
  baseStatus();
  return DB.statusVenda.find(function(x){return x.id===id})||null;
}
function statusAtivos(){
  baseStatus();
  return DB.statusVenda.filter(function(x){return x.ativo!==false})
    .sort(function(a,b){return (a.ordem||0)-(b.ordem||0)});
}
/* O papel de um pedido. Se o status foi apagado, o proprio identificador
   antigo ainda diz o que era — pedido velho nunca fica orfao. */
function papelDaFase(fase){
  var st=statusVenda(fase);
  if(st)return st.papel;
  if(fase==='cancelado')return 'cancelado';
  if(fase==='entregue')return 'finalizado';
  if(fase==='saiu')return 'entrega';
  if(fase==='pronto')return 'pronto';
  if(fase==='preparo')return 'producao';
  return 'aguardando';
}
function ehCancelado(p){return papelDaFase(p&&p.fase)==='cancelado';}
function ehFinalizado(p){return papelDaFase(p&&p.fase)==='finalizado';}
/* qual status usar quando o sistema precisa escolher sozinho */
function statusDoPapel(papel){
  var l=statusAtivos().filter(function(x){return x.papel===papel});
  return l.length?l[0].id:null;
}
function statusInicial(tipo){
  /* venda de balcao nasce concluida; entrega comeca no inicio da fila */
  if(tipo!=='entrega'){
    return statusDoPapel('finalizado')||statusDoPapel('pronto')||(statusAtivos()[0]||{}).id||'entregue';
  }
  var l=statusAtivos().filter(function(x){return x.papel!=='cancelado'});
  return l.length?l[0].id:'aguardando';
}

var PDV={aba:'venda',tipo:'loja',cat:null,comanda:[],cliente:null,busca:''};

function cfg(){
  DB.config=DB.config||{};
  var c=DB.config;
  if(c.lojaAberta===undefined)c.lojaAberta=true;
  if(c.tempoEntrega===undefined)c.tempoEntrega=30;
  if(c.tempoRetirada===undefined)c.tempoRetirada=20;
  /* ==========================================================
     ITEM 4 — O FECHAMENTO NASCE CEGO

     `caixaCego` comecava DESLIGADO. Com ele desligado a tela mostra,
     antes de o operador contar, quanto o sistema espera em cada forma —
     e conferencia com o gabarito na frente nao e conferencia: quem
     confere ajusta o que conta ao numero que esta vendo, sem ma
     intencao, so por vies. Diferenca de caixa deixa de existir no papel
     e passa a existir so na gaveta.

     Agora e REGRA, nao preferencia (V203). O comentario antigo dizia
     que dava para desligar em Configuracao — nao dava: `toggleCego` era
     a unica coisa que invertia o valor, e ninguem a chamava. A tela que
     ele descrevia nunca existiu.

     A Jolo opera cego, e a decisao e essa: quem fecha o caixa conta a
     gaveta sem ver o que o sistema espera. O numero continua inteiro
     nos relatorios, que sao a tela do dono — nunca a do operador.
     ========================================================== */
  c.caixaCego = true;
  if(!c.layout)c.layout='normal';
  if(!c.fases)c.fases=['aguardando','preparo','saiu','entregue','cancelado'];
  if(c.taxaPadrao===undefined)c.taxaPadrao=5;
  return c;
}
/* ==========================================================
   A TELA DE PEDIDOS NAO PODE FICAR EM BRANCO

   baseStatus() nao semeia as colunas quando o aparelho esta ligado na
   nuvem e ainda nao baixou — trava certa, para o padrao nao subir por
   cima do que a loja configurou (foi o defeito da V137).

   So que hoje o Supabase esta instavel: o download falhou, o
   `_baixouUmaVez` nunca ficou verdadeiro, e a lista de colunas ficou
   VAZIA. Resultado: kanban sem coluna nenhuma — a tela verde vazia que
   o Rafael viu, com 326 pedidos no rodape e nada aparecendo.

   Agora, se nao houver coluna, a tela usa a lista padrao SO PARA
   DESENHAR. Ela nao entra no DB e nao sobe para lugar nenhum: some
   sozinha quando as colunas de verdade chegarem.
   ========================================================== */
var FASES_SOCORRO=[
  {id:'aguardando',n:'Aguardando preparação',papel:'aguardando',cor:'#8A8578'},
  {id:'preparo',   n:'Em preparação',        papel:'producao',  cor:'#C9922F'},
  {id:'pronto',    n:'Pronto para retirada', papel:'pronto',    cor:'#1F5F8B'},
  {id:'saiu',      n:'Saiu para entrega',    papel:'entrega',   cor:'#1F5F8B'},
  {id:'entregue',  n:'Entregue / Concluído', papel:'finalizado',cor:'#0E8A46'},
  {id:'cancelado', n:'Cancelado',            papel:'cancelado', cor:'#B4542F'}
];
function fasesAtivas(){
  var l=statusAtivos().map(function(x){return {id:x.id,n:x.nome,cor:x.cor,
    minutos:x.minutos,som:x.som,confPag:x.confPag,papel:x.papel};});
  if(l.length)return l;
  return FASES_SOCORRO.map(function(x){
    return {id:x.id,n:x.n,cor:x.cor,minutos:0,som:false,confPag:false,papel:x.papel};});
}
/* ==========================================================
   ITEM 6 — FECHAR O CAIXA PRECISA ENCERRAR O PDV

   Ao confirmar o fechamento, o codigo chamava `telaPDV()` e mais nada.
   Redesenhar a tela nao apaga o que esta na memoria: a comanda em
   andamento, o cliente escolhido, a mesa em pagamento, os pagamentos
   montados, o cupom aplicado e o troco pendente continuavam todos la.

   Na pratica: o operador fechava o caixa e o pedido anterior seguia na
   tela. Bastava tocar em Finalizar para nascer uma venda NOVA, sem
   caixa aberto — venda orfa, que nao entra em fechamento nenhum e some
   do controle.

   Esta funcao apaga tudo o que pertence ao turno que acabou. Nao toca
   em dado gravado: comanda, cliente e pagamentos aqui sao rascunho de
   tela, e a venda ja finalizada esta em DB.pedidos.
   ========================================================== */
function encerrarSessaoPDV(){
  PDV.comanda=[];
  PDV.cliente=null;
  PDV.tipo='loja';
  PDV.aba='venda';
  PDV.cat=null;
  PDV.busca='';
  PDV.comandaId=null;
  PDV.mesaPag=false;
  MESA_PAG=null;
  _pagos=[]; _totPag=0; _cupomAtivo=null; _cidadeVenda=''; _trocoVenda=0;
  try{ if(typeof _tpDesc!=='undefined')_tpDesc='rs'; }catch(e){}
  /* fecha qualquer janela aberta por cima (pagamento, comanda, mesa) */
  try{ fecharModal(); }catch(e){}
}
function caixaAberto(){
  DB.caixas=DB.caixas||[];
  var minha=lojaAtualId();
  /* caixa e da unidade. Sem esse filtro, um caixa aberto no Alphaville
     valia como caixa aberto em Santa Fe. Caixa antigo, gravado antes de
     existir a coluna, nao tem unidade: vale para quem estiver olhando,
     senao a loja fica sem caixa do nada. */
  return DB.caixas.find(function(c){
    if(c.fechadoEm)return false;
    if(!c.sucursalId)return true;
    return c.sucursalId===minha;
  })||null;
}
/* o caixa aberto e de hoje? gelato fecha as 22:30 — caixa de outro dia e
   esquecimento, nao turno que atravessa a noite */
function caixaDeOutroDia(cx){
  if(!cx||!cx.aberto)return false;
  var d=String(cx.aberto).slice(0,10);
  var hoje=new Date().toLocaleDateString('pt-BR');
  return !!d && d!==hoje;
}
function agoraHM(){return agoraSP().hora}

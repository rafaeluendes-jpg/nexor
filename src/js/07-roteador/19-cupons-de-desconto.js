/* ==========================================================
   BLOCO 19 — CUPONS DE DESCONTO
   ========================================================== */
var CP={aba:'ativos'};
function nomeCanal(id){var c=CANAIS.find(function(x){return x.id===id});return c?c.n:id}
function baseCupons(){DB.cupons=DB.cupons||[];DB.cupomUsos=DB.cupomUsos||[];}
function cupomPorCodigo(cod){
  baseCupons();
  var c=String(cod||'').trim().toUpperCase();
  return DB.cupons.find(function(x){return x.codigo===c})||null;
}
function usosDoCupom(id){return (DB.cupomUsos||[]).filter(function(u){return u.cupomId===id})}
function cupomValido(cp,total,formaId,canal){
  if(!cp)return {ok:false,msg:'Cupom não encontrado.'};
  if(cp.ativo===false)return {ok:false,msg:'Cupom inativo.'};
  var hoje=hojeISO();
  if(cp.de&&hoje<cp.de)return {ok:false,msg:'Cupom ainda não está valendo.'};
  if(cp.ate&&hoje>cp.ate)return {ok:false,msg:'Cupom vencido em '+dataBR(cp.ate)+'.'};
  if(cp.horaDe&&cp.horaAte){var hm=agoraHM();
    if(hm<cp.horaDe||hm>cp.horaAte)return {ok:false,msg:'Cupom só vale das '+cp.horaDe+' às '+cp.horaAte+'.'};}
  if(cp.quantidade&&usosDoCupom(cp.id).length>=cp.quantidade)return {ok:false,msg:'Cupom esgotado.'};
  if(cp.minimo&&total<cp.minimo)return {ok:false,msg:'Pedido mínimo de R$ '+money(cp.minimo)+'.'};
  if((cp.formas||[]).length&&formaId&&cp.formas.indexOf(formaId)<0)
    return {ok:false,msg:'Cupom não vale para esta forma de pagamento.'};
  if(canal&&(cp.canais||[]).length&&cp.canais.indexOf(canal)<0)
    return {ok:false,msg:'Este cupom vale apenas em: '+(cp.canais||[]).map(nomeCanal).join(', ')+'.'};
  return {ok:true};
}
function valorCupom(cp,total){
  if(!cp)return 0;
  var v=cp.tipo==='percentual'?total*(Number(cp.valor)||0)/100:(Number(cp.valor)||0);
  if(cp.tetoDesconto&&v>cp.tetoDesconto)v=cp.tetoDesconto;
  if(v>total)v=total;
  return +v.toFixed(2);
}
function telaCupons(){
  baseCupons();
  var lista=(DB.cupons||[]).slice().reverse();
  var usos=(DB.cupomUsos||[]).slice().reverse();

  $('content').innerHTML='<div class="finWrap">'+
  '<div class="finTop"><div><h1>Cupons de Desconto</h1>'+
  '<p>Descontos aplicados na tela de pagamento do PDV.</p></div>'+
  '<div class="finActs"><button class="btnP2 ok" onclick="modalCupom()">'+sv('plus',14)+' Novo cupom</button></div></div>'+

  '<div class="lfTabs" style="border-radius:6px 6px 0 0;border:1px solid var(--line);border-bottom:none">'+
   '<button class="lfTab'+(CP.aba==='ativos'?' on':'')+'" onclick="CP.aba=\'ativos\';telaCupons()">Cupons'+
    '<span class="lfN">'+lista.length+'</span></button>'+
   '<button class="lfTab'+(CP.aba==='usados'?' on':'')+'" onclick="CP.aba=\'usados\';telaCupons()">Utilizados'+
    '<span class="lfN">'+usos.length+'</span></button>'+
  '</div>'+
  '<div class="pnl2" style="border-radius:0 0 6px 6px">'+
  '<div class="pnl2B" style="padding:0">'+
  (CP.aba==='ativos'
   ?(lista.length?'<table class="pTable finTab"><thead><tr>'+
     '<th style="width:150px">Código</th><th style="width:120px">Tipo</th>'+
     '<th style="width:105px;text-align:right">Desconto</th>'+
     '<th style="width:105px;text-align:right">Mínimo</th>'+
     '<th style="width:160px">Validade</th>'+
     '<th style="width:210px">Onde aplica</th>'+
     '<th style="width:120px">Usos</th>'+
     '<th style="width:100px;text-align:center">Situação</th>'+
     '<th style="width:170px"></th></tr></thead><tbody>'+
     lista.map(function(cp){
       var u=usosDoCupom(cp.id).length;
       var venc=cp.ate&&hojeISO()>cp.ate;
       var esg=cp.quantidade&&u>=cp.quantidade;
       return '<tr>'+
       '<td><span class="codCup">'+E(cp.codigo)+'</span></td>'+
       '<td>'+(cp.tipo==='percentual'?'Porcentagem':'Valor fixo')+'</td>'+
       '<td style="text-align:right"><b>'+(cp.tipo==='percentual'?
         (Number(cp.valor)||0).toFixed(2).replace('.',',')+'%':'R$ '+money(cp.valor))+'</b></td>'+
       '<td style="text-align:right">'+(cp.minimo?'R$ '+money(cp.minimo):'—')+'</td>'+
       '<td>'+(cp.de?dataBR(cp.de):'—')+' a '+(cp.ate?dataBR(cp.ate):'—')+
        (cp.horaDe?'<small>'+cp.horaDe+' às '+cp.horaAte+'</small>':'')+'</td>'+
       '<td>'+((cp.canais||[]).length?
         (cp.canais.length===CANAIS.length?'<span class="cidTag">todos os canais</span>'
          :cp.canais.map(function(k){return '<span class="cidTag">'+E(nomeCanal(k))+'</span>'}).join(' '))
         :'<span class="semCid">nenhum canal</span>')+'</td>'+
       '<td>'+(function(){
         var q=Number(cp.quantidade)||0;
         if(!q)return '<div class="cupUso"><b>'+u+'</b><span>sem limite</span></div>';
         var pc=Math.min(100,Math.round(u/q*100));
         return '<div class="cupUso"><b>'+u+' <i>de '+q+'</i></b>'+
           '<span class="cupBar"><i style="width:'+pc+'%"'+
           (pc>=100?' class="cheio"':'')+'></i></span></div>';
       })()+'</td>'+
       '<td style="text-align:center">'+
        (cp.ativo===false?'<span class="badge2 rd">Inativo</span>'
         :venc?'<span class="badge2 rd">Vencido</span>'
         :esg?'<span class="badge2 rd">Esgotado</span>'
         :'<span class="badge2 gr">Ativo</span>')+'</td>'+
       '<td><div class="rowAct">'+
        '<button class="rBtn" onclick="copiarCupom(\''+cp.id+'\')" title="Copiar código e link">'+sv('copy',12)+'</button>'+
        '<button class="rBtn" onclick="modalCupom(\''+cp.id+'\')" title="Editar">'+sv('edit',12)+'</button>'+
        '<button class="rBtn rd" onclick="excluirCupom(\''+cp.id+'\')" title="Excluir">'+sv('trash',12)+'</button>'+
       '</div></td></tr>';
     }).join('')+'</tbody></table>'
    :'<div class="entVazio"><b>Nenhum cupom cadastrado</b>'+
     '<span>Crie um cupom e ele passa a ser aceito na tela de pagamento do PDV.</span></div>')
   :(usos.length?'<table class="pTable finTab"><thead><tr>'+
     '<th style="width:150px">Código</th><th style="width:110px">Data</th>'+
     '<th>Cliente</th><th style="width:90px">Pedido</th>'+
     '<th style="width:120px;text-align:right">Desconto</th>'+
     '<th style="width:120px;text-align:right">Valor do pedido</th></tr></thead><tbody>'+
     usos.map(function(u){
       var cp=(DB.cupons||[]).find(function(x){return x.id===u.cupomId});
       return '<tr><td><span class="codCup">'+E(cp?cp.codigo:'—')+'</span></td>'+
       '<td>'+dataBR(u.data)+'</td><td>'+E(u.clienteNome||'Consumidor')+'</td>'+
       '<td>#'+(u.numero||'—')+'</td>'+
       '<td style="text-align:right"><b class="vr">- R$ '+money(u.valor)+'</b></td>'+
       '<td style="text-align:right">R$ '+money(u.totalPedido||0)+'</td></tr>';
     }).join('')+'</tbody></table>'
    :'<div class="entVazio"><b>Nenhum cupom utilizado ainda</b>'+
     '<span>Quando um cupom for aplicado no PDV, o registro aparece aqui.</span></div>'))+
  '</div></div></div>';
  rodape(lista.length+' cupons · '+usos.length+' utilizações');
}
function modalCupom(id){
  baseCupons();
  var cp=id?DB.cupons.find(function(x){return x.id===id}):null;
  var h='<div class="mdB">'+
  '<div class="blk" style="margin:0 0 11px;max-width:none"><h3>Cupom de desconto</h3>'+
  '<div class="row2">'+
  '<div class="fld2"><label>Código *</label><input id="cuC" value="'+E(cp?cp.codigo:'')+'" '+
   'placeholder="ex: BEMVINDO10" style="text-transform:uppercase;font-weight:700;letter-spacing:.05em"></div>'+
  '<div class="fld2"><label>Situação</label><select id="cuA">'+
   '<option value="1"'+(!cp||cp.ativo!==false?' selected':'')+'>Ativo</option>'+
   '<option value="0"'+(cp&&cp.ativo===false?' selected':'')+'>Inativo</option></select></div></div>'+
  '<div class="row3">'+
  '<div class="fld2"><label>Tipo de desconto</label><select id="cuT" onchange="trocaTipoCupom()">'+
   '<option value="valor"'+(!cp||cp.tipo==='valor'?' selected':'')+'>Valor fixo (R$)</option>'+
   '<option value="percentual"'+(cp&&cp.tipo==='percentual'?' selected':'')+'>Porcentagem (%)</option></select></div>'+
  '<div class="fld2"><label>Valor do desconto *</label><div class="cur"><span id="cuS">'+
   ((cp&&cp.tipo==='percentual')?'%':'R$')+'</span><input id="cuV" type="number" step="0.01" value="'+(cp?cp.valor:'')+'"></div></div>'+
  '<div class="fld2"><label>Desconto máximo</label><div class="cur"><span>R$</span>'+
   '<input id="cuTe" type="number" step="0.01" value="'+(cp&&cp.tetoDesconto?cp.tetoDesconto:'')+'" placeholder="opcional"></div></div>'+
  '</div>'+
  '<div class="fld2" style="margin:0"><label>Pedido mínimo</label><div class="cur"><span>R$</span>'+
   '<input id="cuM" type="number" step="0.01" value="'+(cp?(cp.minimo||0):0)+'"></div></div>'+
  '</div>'+
  '<div class="blk" style="margin:0 0 11px;max-width:none"><h3>Validade e limites</h3>'+
  '<div class="row2">'+
  '<div class="fld2"><label>Válido de</label><input id="cuDe" type="date" value="'+(cp?cp.de:hojeISO())+'"></div>'+
  '<div class="fld2"><label>Válido até</label><input id="cuAt" type="date" value="'+(cp?cp.ate:'')+'"></div></div>'+
  '<div class="row3">'+
  '<div class="fld2"><label>Horário de início</label><input id="cuHd" type="time" value="'+(cp?(cp.horaDe||''):'')+'"></div>'+
  '<div class="fld2"><label>Horário de término</label><input id="cuHa" type="time" value="'+(cp?(cp.horaAte||''):'')+'"></div>'+
  '<div class="fld2"><label>Quantidade de cupons</label><input id="cuQ" type="number" value="'+(cp?(cp.quantidade||0):0)+'" placeholder="0 = ilimitado"></div>'+
  '</div>'+
  '<div class="fld2" style="margin:0"><label>Limite por cliente</label>'+
   '<input id="cuLc" type="number" value="'+(cp?(cp.limiteCliente||0):0)+'" placeholder="0 = sem limite"></div>'+
  '</div>'+
  '<div class="blk" style="margin:0 0 11px;max-width:none"><h3>Onde aplicar este cupom *</h3>'+
  '<div class="hint" style="margin-bottom:10px">O cupom só é aceito nos canais marcados.</div>'+
  '<div class="contaGrid">'+CANAIS.map(function(ca){
    var marc=cp?((cp.canais||[]).indexOf(ca.id)>=0):true;
    return '<label class="contaBox"><input type="checkbox" class="cuCa" value="'+ca.id+'"'+(marc?' checked':'')+'>'+
    '<span><b>'+ca.n+'</b><small>'+ca.d+'</small></span></label>';}).join('')+
  '</div></div>'+
  '<div class="blk" style="margin:0;max-width:none"><h3>Formas de pagamento aceitas <small>vazio = todas</small></h3>'+
  '<div class="contaGrid">'+(DB.formasPag||[]).filter(function(f){return f.ativa!==false}).map(function(f){
    return '<label class="contaBox"><input type="checkbox" class="cuF" value="'+f.id+'"'+
    (cp&&(cp.formas||[]).indexOf(f.id)>=0?' checked':'')+'>'+
    '<span><b>'+E(f.nome)+'</b></span></label>';}).join('')+'</div></div></div>';
  modal(cp?'Editar cupom':'Novo cupom',h,'Salvar',function(){
    var cod=$('cuC').value.trim().toUpperCase();
    if(cod.length<3){toast('O código precisa de pelo menos 3 caracteres.');return false;}
    var outro=cupomPorCodigo(cod);
    if(outro&&(!cp||outro.id!==cp.id)){toast('Já existe um cupom com este código.');return false;}
    var v=parseFloat($('cuV').value)||0;
    if(v<=0){toast('Informe o valor do desconto.');return false;}
    var fs=[];
    var cks=document.querySelectorAll('.cuF');
    for(var i=0;i<cks.length;i++)if(cks[i].checked)fs.push(cks[i].value);
    var cns=[];
    var ck2=document.querySelectorAll('.cuCa');
    for(var j=0;j<ck2.length;j++)if(ck2[j].checked)cns.push(ck2[j].value);
    if(!cns.length){toast('Marque ao menos um canal em "Onde aplicar este cupom".');return false;}
    var o={codigo:cod,tipo:$('cuT').value,valor:v,
      tetoDesconto:parseFloat($('cuTe').value)||0,minimo:parseFloat($('cuM').value)||0,
      de:$('cuDe').value,ate:$('cuAt').value,horaDe:$('cuHd').value,horaAte:$('cuHa').value,
      quantidade:parseInt($('cuQ').value)||0,limiteCliente:parseInt($('cuLc').value)||0,
      formas:fs,canais:cns,ativo:$('cuA').value==='1'};
    if(cp)Object.assign(cp,o);
    else{o.id=uid('cup');DB.cupons.push(o);}
    salvar();telaCupons();toast('Cupom salvo.');
    return true;
  },'lg');
  $('cuC').oninput=function(){this.value=this.value.toUpperCase()};
}
function trocaTipoCupom(){
  var t=$('cuT').value;
  $('cuS').textContent=t==='percentual'?'%':'R$';
}
function copiarCupom(id){
  var cp=DB.cupons.find(function(x){return x.id===id});
  var txt=cp.codigo+' — '+(cp.tipo==='percentual'?
    (Number(cp.valor)||0)+'% de desconto':'R$ '+money(cp.valor)+' de desconto')+
    (cp.minimo?' em pedidos acima de R$ '+money(cp.minimo):'')+
    (cp.ate?' · válido até '+dataBR(cp.ate):'');
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(txt).then(function(){toast('Cupom copiado para enviar ao cliente.')},
      function(){prompt('Copie o texto:',txt)});
  }else prompt('Copie o texto:',txt);
}
async function excluirCupom(id){
  var cp=DB.cupons.find(function(x){return x.id===id});
  var u=usosDoCupom(id).length;
  if(u){toast('Este cupom já foi usado '+u+' vez(es). Inative em vez de excluir.');return;}
  if(!await pergunta('Excluir o cupom "'+cp.codigo+'"?'))return;
  DB.cupons=DB.cupons.filter(function(x){return x.id!==id}); declararExclusao('cupons',id); /* exclusao declarada: so isto autoriza apagar da nuvem (V201) */
  salvar();telaCupons();toast('Cupom excluído.');
}

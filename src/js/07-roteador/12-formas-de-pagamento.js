/* ==========================================================
   BLOCO 12 — FORMAS DE PAGAMENTO
   ========================================================== */
/* ==========================================================
   A FORMA DE UM PAGAMENTO TEM DOIS NOMES NO HISTORICO

   `forma` e o nome certo, e o que o PDV sempre gravou. Mas ha registro
   antigo com `formaId`: o pedido do cardapio digital gravou assim ate a
   V256, e a descida da nuvem preenche os dois desde a V136.

   Ler so um dos dois foi a causa de tres defeitos diferentes — venda
   "sem forma" no fechamento, "nao informado" no relatorio, e venda
   subindo para a nuvem com o vinculo vazio.

   Esta funcao e a unica porta de leitura. Quem grava usa `forma`, um
   nome so; quem le passa por aqui e aceita os dois, para o que ja esta
   gravado tambem sarar sem mexer em dado nenhum.
   ========================================================== */
function formaDoPagamento(pg){
  if(!pg)return '';
  return pg.forma||pg.formaId||'';
}
function tipoPg(id){return TIPOS_PG.find(function(t){return t.id===id})||TIPOS_PG[6]}
function corTipo(t){
  return t==='dinheiro'?'#0E8A46':t==='debito'?'#2C6FD1':t==='credito'?'#7B5FD4'
        :t==='pix'?'#00A08B':t==='voucher'?'#E08A2E':t==='fiado'?'#C94141':'#5C6B80';
}
/* ==========================================================
   A TELA VAZIA QUE ASSUSTOU O DONO — 04/09/2026

   O Rafael e o socio abriram Formas de Pagamento e viram "Nenhuma forma
   cadastrada", zerado. As 5 formas — com as taxas reais da loja (debito
   0,73%, credito 2,73%) — estavam INTEIRAS na nuvem o tempo todo; so nao
   estavam na lista deste aparelho naquele instante.

   A V299 parou de semear formas de fabrica quando a nuvem ja conhece as
   formas (para nao repor taxa de fabrica por cima da real, que foi a
   regressao dos lancamentos). O efeito colateral: se o download ainda nao
   encheu DB.formasPag, a tela ficava CEGA em vez de esperar.

   Aqui a tela se cura: lista vazia com a nuvem ligada = puxa as formas
   reais da nuvem (onde elas estao salvas) e redesenha. Nunca repoe fabrica
   por cima de taxa real, porque quem enche e o download, nao a semente. */
var _fpAutoPuxou=false;
function telaFormasPag(){
  baseCat();baseFormas();
  var lista=(DB.formasPag||[]).slice().sort(function(a,b){return (a.ordem||0)-(b.ordem||0)});
  if(lista.length){ _fpAutoPuxou=false; }
  else if(typeof NUVEM!=='undefined'&&NUVEM.ligada&&!_fpAutoPuxou&&typeof baixarDaNuvem==='function'){
    _fpAutoPuxou=true;
    baixarDaNuvem(true).then(function(){
      /* redesenha só se a pessoa ainda está nesta tela — a rota atual é
         S.mod/S.it (mid/iid são parâmetros do roteador, não existem aqui) */
      if(typeof S!=='undefined'&&S.mod==='financeira'&&S.it==='formas-pagamento')telaFormasPag();
    }).catch(function(){});
  }
  var _puxando=!lista.length&&typeof NUVEM!=='undefined'&&NUVEM.ligada;
  var ativas=lista.filter(function(f){return f.ativa!==false}).length;
  $('content').innerHTML='<div class="finWrap">'+
  '<div class="finTop"><div><h1>Formas de Pagamento</h1>'+
  '<p>Cadastre cartões, Pix e demais formas, com taxa e a conta onde o dinheiro cai. '+
  'Elas aparecem na frente de caixa e no fechamento.</p></div>'+
  '<div class="finActs"><button class="btnP2 ok" onclick="modalForma()">'+sv('plus',14)+' Nova forma de pagamento</button></div></div>'+
  '<div class="kpiRow">'+
   '<div class="kpi2"><span>Cadastradas</span><b>'+lista.length+'</b></div>'+
   '<div class="kpi2"><span>Ativas no PDV</span><b>'+ativas+'</b></div>'+
   '<div class="kpi2"><span>Contas vinculadas</span><b>'+lista.filter(function(f){return f.contaId}).length+'</b></div>'+
  '</div>'+
  '<div class="entWrap">'+
  (lista.length?lista.map(function(f,i){
    var t=tipoPg(f.tipo),c=(DB.contas||[]).find(function(x){return x.id===f.contaId});
    return '<div class="fpCard'+(f.ativa===false?' off':'')+'">'+
     '<div class="fpOrd">'+
      '<button class="ordBtn" onclick="moverForma(\''+f.id+'\',-1)"'+(i===0?' disabled':'')+'>'+sv('up3',12)+'</button>'+
      '<span>'+(i+1)+'</span>'+
      '<button class="ordBtn" onclick="moverForma(\''+f.id+'\',1)"'+(i===lista.length-1?' disabled':'')+'>'+sv('dn',12)+'</button>'+
     '</div>'+
     '<div class="fpIco" style="background:'+corTipo(f.tipo)+'">'+sv(f.tipo==='pix'?'qr':'cash',18)+'</div>'+
     '<div class="fpInfo">'+
      '<b>'+E(f.nome)+(f.bandeira&&f.bandeira!=='—'?' <span class="bandTag">'+E(f.bandeira)+'</span>':'')+'</b>'+
      '<span>'+E(t.n)+(t.troco?' · com troco':' · sem troco')+(f.online?' · aceita online':'')+'</span>'+
     '</div>'+
     '<div class="fpTx"><span>Taxa</span><b>'+(f.taxaPct?Number(f.taxaPct).toFixed(2).replace('.',',')+'%':'—')+
      (f.taxaFixa?' + R$ '+money(f.taxaFixa):'')+'</b></div>'+
     '<div class="fpTx"><span>Recebimento</span><b>'+(Number(f.dias)?'em '+f.dias+' dia'+(f.dias>1?'s':''):'na hora')+'</b></div>'+
     '<div class="fpTx wide"><span>Cai na conta</span><b>'+(c?E(c.nome):'<span class="semCid">não definida</span>')+'</b></div>'+
     '<div class="fpSw">'+
      '<button class="sw'+(f.ativa!==false?' on':'')+'" onclick="toggleForma(\''+f.id+'\')"></button>'+
      '<span class="swLb'+(f.ativa!==false?' on':'')+'">'+(f.ativa!==false?'Ativa':'Inativa')+'</span>'+
     '</div>'+
     '<div class="fpBtns">'+
      '<button class="btnP2" onclick="modalForma(\''+f.id+'\')">'+sv('edit',13)+' Editar</button>'+
      '<button class="btnP2 rdB" onclick="excluirForma(\''+f.id+'\')">'+sv('trash',13)+'</button>'+
     '</div>'+
    '</div>';
  }).join('')
  :(_puxando
     ?'<div class="entVazio"><b>Carregando as formas da nuvem…</b><span>As suas formas e taxas estão salvas na nuvem. Aguarde um instante.</span></div>'
     :'<div class="entVazio"><b>Nenhuma forma cadastrada</b><span>Cadastre Dinheiro, Pix e os cartões que você aceita.</span></div>'))+
  '</div>'+
  '<div class="avisoCfg">'+sv('help',16)+
  '<div>A <b>ordem</b> define como as formas aparecem na tela de pagamento do PDV. '+
  'A <b>taxa</b> e o <b>prazo de recebimento</b> serão usados na conciliação bancária e no cálculo do valor líquido.</div></div>'+
  '</div>';
  rodape(lista.length+' formas de pagamento');
}
function toggleForma(id){
  var f=formaPag(id);f.ativa=f.ativa===false;
  syncFormas();salvar();telaFormasPag();
  toast('Forma '+(f.ativa?'ativada':'inativada')+' no PDV.');
}
function moverForma(id,d){
  var lista=(DB.formasPag||[]).slice().sort(function(a,b){return (a.ordem||0)-(b.ordem||0)});
  var i=lista.findIndex(function(x){return x.id===id});
  var j=i+d;
  if(j<0||j>=lista.length)return;
  var tmp=lista[i];lista[i]=lista[j];lista[j]=tmp;
  lista.forEach(function(x,k){x.ordem=k});
  syncFormas();salvar();telaFormasPag();
}
async function excluirForma(id){
  var f=formaPag(id);
  var usos=(DB.pedidos||[]).filter(function(p){return (p.pagamentos||[]).some(function(x){return formaDoPagamento(x)===id})}).length;
  if(usos){toast('Esta forma já foi usada em '+usos+' pedido(s). Inative em vez de excluir.');return;}
  if(!await pergunta('Excluir a forma "'+f.nome+'"?'))return;
  DB.formasPag=DB.formasPag.filter(function(x){return x.id!==id}); declararExclusao('formasPag',id); /* exclusao declarada: so isto autoriza apagar da nuvem (V201) */
  syncFormas();salvar();telaFormasPag();toast('Forma excluída.');
}
function modalForma(id){
  baseCat();
  var f=id?formaPag(id):null;
  var contas=(DB.contas||[]);
  var h='<div class="mdB">'+
  '<div class="blk" style="margin:0 0 11px;max-width:none"><h3>Informações básicas</h3>'+
  '<div class="row2">'+
  '<div class="fld2"><label>Descrição *</label><input id="fpN" value="'+E(f?f.nome:'')+'" placeholder="ex: Crédito Mastercard"></div>'+
  '<div class="fld2"><label>Tipo</label><select id="fpT">'+
   TIPOS_PG.map(function(t){return '<option value="'+t.id+'"'+(f&&f.tipo===t.id?' selected':'')+'>'+t.n+'</option>'}).join('')+
  '</select></div></div>'+
  '<div class="row2">'+
  '<div class="fld2" style="margin:0"><label>Bandeira do cartão</label><select id="fpB">'+
   BANDEIRAS.map(function(b){return '<option'+(f&&f.bandeira===b?' selected':'')+'>'+b+'</option>'}).join('')+
  '</select></div>'+
  '<div class="fld2" style="margin:0"><label>Situação</label><select id="fpA">'+
  '<option value="1"'+(!f||f.ativa!==false?' selected':'')+'>Ativa — aparece no PDV</option>'+
  '<option value="0"'+(f&&f.ativa===false?' selected':'')+'>Inativa</option></select></div></div>'+
  '<label class="chkL" style="margin-top:10px"><input type="checkbox" id="fpO" '+(f&&f.online?'checked':'')+'>'+
  '<span>Aceita pagamento online (pedido online e cardápio digital)</span></label>'+
  '</div>'+

  '<div class="blk" style="margin:0 0 11px;max-width:none"><h3>Taxas e prazo</h3>'+
  '<div class="row3">'+
  '<div class="fld2"><label>Taxa por transação (%)</label>'+
  '<div class="cur"><span>%</span><input id="fpTx" type="number" step="0.01" value="'+(f?(f.taxaPct||0):0)+'"></div></div>'+
  '<div class="fld2"><label>Taxa fixa por transação</label>'+
  '<div class="cur"><span>R$</span><input type="text" inputmode="decimal" autocomplete="off" placeholder="0,00" class="moeda" id="fpTf" value="'+((f&&f.taxaFixa)?money(f.taxaFixa):'')+'"></div></div>'+
  '<div class="fld2"><label>Dias para recebimento</label><input id="fpD" type="number" value="'+(f?(f.dias||0):0)+'"></div>'+
  '</div>'+
  '<div class="hint">Ex.: crédito com 3,49% e recebimento em 30 dias. Em dinheiro e Pix, deixe 0.</div></div>'+

  '<div class="blk" style="margin:0;max-width:none"><h3>Conta que recebe o dinheiro</h3>'+
  '<div class="hint" style="margin-bottom:10px">O valor desta forma entra nesta conta. O dinheiro em espécie normalmente cai no Caixa da loja.</div>'+
  '<div class="contaGrid">'+
   '<label class="contaBox"><input type="radio" name="fpC" value=""'+(!f||!f.contaId?' checked':'')+'>'+
   '<span class="bcoIc" style="background:#9AA7B8">—</span><span><b>Não definir agora</b><small>escolher depois</small></span></label>'+
   contas.map(function(c){
     var b=c.fixa?null:banco(c.banco);
     var cor=c.fixa==='caixa'?'#0E8A46':c.fixa==='cofre'?'#5C6B80':(b?b.c:'#5C6B80');
     var sig=c.fixa==='caixa'?'CX':c.fixa==='cofre'?'CO':(b?b.s:'$');
     return '<label class="contaBox"><input type="radio" name="fpC" value="'+c.id+'"'+(f&&f.contaId===c.id?' checked':'')+'>'+
     '<span class="bcoIc" style="background:'+cor+'">'+sig+'</span>'+
     '<span><b>'+E(c.nome)+'</b><small>saldo R$ '+money(saldoConta(c))+'</small></span></label>';}).join('')+
  '</div></div></div>';

  modal(f?'Editar forma de pagamento':'Nova forma de pagamento',h,'Salvar',function(){
    var nome=$('fpN').value.trim();
    if(nome.length<2){toast('A descrição precisa de pelo menos 2 caracteres.');return false;}
    var ct=document.querySelector('input[name=fpC]:checked');
    var o={nome:nome,tipo:$('fpT').value,bandeira:$('fpB').value,
      taxaPct:parseFloat($('fpTx').value)||0,taxaFixa:moedaValor('fpTf'),
      dias:parseInt($('fpD').value)||0,contaId:ct?ct.value:'',
      ativa:$('fpA').value==='1',online:$('fpO').checked};
    if(f)Object.assign(f,o);
    else{o.id=uid('fp');o.ordem=(DB.formasPag||[]).length;DB.formasPag.push(o);}
    syncFormas();salvar();telaFormasPag();toast('Forma de pagamento salva.');
    return true;
  },'lg');
}

/* ==========================================================
   OPERAÇÃO EM LOTE NO FINANCEIRO (Rafael, 05/10/2026)

   *"Eu preciso criar uma operação em lote. Tem que ter um número do
   lote, para a gente colocar a data que está sendo feita."* — e, depois
   de ver as telas-modelo: *"pode estar fazendo, isso precisa funcionar,
   não pode quebrar nada."*

   O que é: vários lançamentos em aberto, pagos (ou recebidos) JUNTOS,
   na mesma data, da mesma conta e pela mesma forma — como UMA operação.
   A operação ganha um número que carrega o dia em que foi feita
   (`20261005-01` = primeiro lote de 05/10/2026 desta unidade).

   Para que serve:
     - o banco que paga vários boletos juntos mostra UM débito no
       extrato; o lote tem esse valor, e a conciliação é feita de uma vez;
     - saber depois o que foi pago junto;
     - errou? desfaz o lote inteiro, e fica registrado quem, quando e
       por quê.

   As regras (as do documento PROPOSTA_OPERACAO_EM_LOTE.md):
     - entra só o que está em aberto, não conciliado, da mesma unidade e
       do mesmo lado (só a pagar ou só a receber);
     - a categoria do plano de contas continua obrigatória;
     - um lançamento só sai do lote desfazendo o lote: pagar de novo,
       desmarcar, editar e excluir um só ficam travados;
     - lote conciliado não se desfaz — primeiro desconcilia;
     - o lote nunca é apagado; desfeito, ele fica na lista como Desfeito.

   "Marcar pago" com vários selecionados continua igual, sem lote.
   ========================================================== */
var LT={mes:'',sit:'',tipo:''};
function baseLotes(){ DB.lotesFin=DB.lotesFin||[]; return DB.lotesFin; }
function loteDoLanc(l){
  if(!l||!l.loteRef)return null;
  return baseLotes().find(function(x){return x.id===l.loteRef})||null;
}
/* está num lote que vale — desfazer limpa a marca do lançamento */
function noLote(l){ return !!(l&&l.loteRef); }
function avisoNoLote(l){
  toast('Este lançamento está no lote '+(l.loteNum||'')+
    '. Para mexer nele, desfaça o lote em Lançamentos › Lotes.');
}
/* o número nasce com a data em que o lote é feito: AAAAMMDD-NN, a
   sequência é do dia e da unidade, e um número nunca volta a ser usado
   (o lote desfeito continua na lista e continua contando) */
function numeroDoLote(dia,suc){
  var pre=String(dia||hojeISO()).replace(/-/g,'');
  var usados={};
  baseLotes().forEach(function(x){
    if((x.sucursalId||'')===(suc||''))usados[String(x.numero||'')]=true;
  });
  var n=1,num;
  do{ num=pre+'-'+(n<10?'0':'')+n; n++; }while(usados[num]);
  return num;
}
function itensDoLote(lt){
  return ((lt&&lt.itens)||[]).map(function(it){
    return (DB.lancFin||[]).find(function(x){return x.id===it.id})||null;
  }).filter(Boolean);
}
function situacaoDoLote(lt){
  if(!lt)return '';
  if(lt.desfeito)return 'desf';
  var ls=itensDoLote(lt).filter(function(l){return l.loteRef===lt.id});
  if(ls.length&&ls.every(function(l){return l.conciliado}))return 'conc';
  return 'pago';
}
var SIT_LOTE={pago:'Pago — falta conciliar',conc:'Conciliado',desf:'Desfeito'};

/* ---------- 1. CRIAR O LOTE ---------- */
function abrirLote(){
  baseLanc();baseLotes();
  var c=document.querySelectorAll('.chkLF:checked');
  var ls=[];
  for(var i=0;i<c.length;i++){
    var id=c[i].getAttribute('data-id');
    var l=DB.lancFin.find(function(x){return x.id===id});
    if(l)ls.push(l);
  }
  if(ls.length<2){toast('Selecione na lista pelo menos dois lançamentos em aberto.');return;}
  var fora=ls.filter(function(l){return l.pago||l.conciliado||noLote(l)||l.tipo==='transferencia'});
  ls=ls.filter(function(l){return fora.indexOf(l)<0});
  if(ls.length<2){
    toast('O lote é feito com lançamentos em aberto. '+
      (fora.length?fora.length+' dos selecionados já estão pagos, conciliados ou são transferência.':''));
    return;
  }
  var tipos={};ls.forEach(function(l){tipos[l.tipo]=true});
  if(Object.keys(tipos).length>1){
    toast('Um lote é só de contas a pagar ou só de contas a receber. Separe a seleção.');return;
  }
  var sucs={};ls.forEach(function(l){sucs[l.sucursalRef||'']=true});
  if(Object.keys(sucs).length>1){
    toast('Um lote é de uma unidade só. Os selecionados são de unidades diferentes.');return;
  }
  modalLote(ls,fora.length);
}
function modalLote(ls,deFora){
  var pagar=ls[0].tipo==='despesa';
  var suc=ls[0].sucursalRef||lojaAtualId()||'';
  var hoje=hojeISO();
  var num=numeroDoLote(hoje,suc);
  var quem=(usuarioLogado()||{}).nome||'';
  var contas=(DB.contas||[]);
  var formas=(DB.formasPag||[]).filter(function(f){return f.ativa!==false});
  var cSel=ls[0].contaId||(contas.length===1?contas[0].id:'');
  var mSel=ls[0].metodoId||(formas.length===1?formas[0].id:'');
  var h='<div class="mdB">'+
   '<div class="ltCab"><div><div class="ltL">Número do lote</div><div class="ltN" id="ltNum">'+E(num)+'</div></div>'+
    '<div><div class="ltL">Criado em</div><b>'+dataBR(hoje)+' · '+agoraHM()+'</b></div>'+
    (quem?'<div><div class="ltL">Por</div><b>'+E(quem)+'</b></div>':'')+
    '<div class="ltSp"></div><small>o número nasce sozinho:<br>data de hoje + sequência do dia</small></div>'+
   (deFora?'<div class="avisoPg">'+sv('help',12)+' <span>'+deFora+
     ' dos selecionados ficaram de fora: já estavam pagos, conciliados ou são transferência.</span></div>':'')+
   '<div class="blk" style="margin:0 0 11px;max-width:none"><h3>'+(pagar?'Pagar em lote':'Receber em lote')+'</h3>'+
    '<div class="row2"><div class="fld2"><label>'+(pagar?'Data do pagamento':'Data do recebimento')+' *</label>'+
     '<input id="ltD" type="date" value="'+hoje+'"></div>'+
     '<div class="fld2"><label>'+(pagar?'Conta de saída':'Conta de entrada')+' *</label>'+
     '<select id="ltC" onchange="recalcLote()"><option value="">Selecione uma opção</option>'+
      contas.map(function(c){return '<option value="'+c.id+'"'+(cSel===c.id?' selected':'')+'>'+
        E(c.nome)+' · saldo R$ '+money(saldoConta(c))+'</option>'}).join('')+
     '</select></div></div>'+
    '<div class="row2"><div class="fld2" style="margin:0"><label>Forma de pagamento *</label>'+
     '<select id="ltM"><option value="">Selecione uma opção</option>'+
      formas.map(function(f){return '<option value="'+f.id+'"'+(mSel===f.id?' selected':'')+'>'+
        E(f.nome)+'</option>'}).join('')+
     '</select></div>'+
     '<div class="fld2" style="margin:0"><label>Observação do lote</label>'+
     '<input id="ltO" placeholder="ex.: fornecedores da semana"></div></div></div>'+
   '<div class="blk" style="margin:0;max-width:none"><h3>'+ls.length+' lançamentos neste lote</h3>'+
    '<div class="ltTabW"><table class="pTable"><thead><tr><th>Fornecedor / descrição</th>'+
     '<th class="ltSoPc" style="width:96px">Vencimento</th>'+
     '<th style="width:112px;text-align:right">Valor</th>'+
     (pagar?'<th style="width:112px;text-align:right">Juros/multa</th>':'')+'</tr></thead><tbody>'+
    ls.map(function(l){
      return '<tr><td><b>'+E(l.fornecedor||l.descricao||'—')+'</b>'+
       '<div class="ltSub">'+E(l.fornecedor?(l.descricao||''):'')+(l.documento?' · '+E(l.documento):'')+'</div></td>'+
       '<td class="ltSoPc">'+dataBR(l.vencimento)+'</td>'+
       '<td style="text-align:right;white-space:nowrap">R$ '+money(valorBoleto(l))+'</td>'+
       (pagar?'<td style="text-align:right"><input class="ltJ" data-id="'+l.id+'" type="number" step="0.01" min="0" '+
         'placeholder="0,00" value="'+(encargos(l)||'')+'" oninput="recalcLote()"></td>':'')+'</tr>';
    }).join('')+'</tbody></table></div>'+
    '<div class="ltTot"><span>Total do lote</span><b id="ltTot"></b></div>'+
    '<div class="ltAviso" id="ltAviso"></div></div></div>';
  _ltLancs=ls;
  modal('Nova operação em lote',h,'Confirmar lote',function(){return confirmarLote(ls,suc);},'lg');
  recalcLote();
}
var _ltLancs=[];
function jurosDoLote(id){
  var el=document.querySelector('.ltJ[data-id="'+id+'"]');
  return el?(parseFloat(el.value)||0):0;
}
function totalDoLote(){
  return (_ltLancs||[]).reduce(function(a,l){return a+valorBoleto(l)+jurosDoLote(l.id)},0);
}
function recalcLote(){
  var tot=totalDoLote();
  var pagar=(_ltLancs[0]||{}).tipo==='despesa';
  var el=$('ltTot');if(el)el.textContent='R$ '+money(tot);
  var av=$('ltAviso');if(!av)return;
  var c=(DB.contas||[]).find(function(x){return x.id===($('ltC')||{}).value});
  if(!c){av.innerHTML='Escolha a conta para ver como fica o saldo.';return;}
  var s=saldoConta(c),depois=pagar?s-tot:s+tot;
  av.innerHTML=(pagar?'Sai do ':'Entra no ')+'<b>'+E(c.nome)+'</b>. O saldo passa de R$ '+money(s)+
    ' para <b>R$ '+money(depois)+'</b>. No extrato do banco, procure '+
    (pagar?'um pagamento':'um crédito')+' de <b>R$ '+money(tot)+'</b>: é ele que concilia o lote inteiro.';
}
function confirmarLote(ls,suc){
  var c=$('ltC').value,m=$('ltM').value,d=$('ltD').value||hojeISO();
  if(!c){toast('Selecione a conta.');return false;}
  if(!m){toast('Selecione a forma de pagamento.');return false;}
  /* a mesma trava do pagamento comum: sem categoria não paga */
  var semClas=ls.filter(function(l){return lancSemCategoria(l)});
  if(semClas.length){
    toast(semClas.length+' lançamento(s) sem categoria do plano de contas. Classifique antes de fazer o lote: '+
      (semClas[0].descricao||'sem descrição'));
    return false;
  }
  var juros={},neg=false;
  ls.forEach(function(l){var j=jurosDoLote(l.id);if(j<0)neg=true;juros[l.id]=j;});
  if(neg){toast('Juros e multa não podem ser negativos.');return false;}
  /* alguém pagou um deles enquanto a janela estava aberta? */
  var mudou=ls.filter(function(l){return l.pago||l.conciliado||noLote(l)});
  if(mudou.length){toast('Um dos lançamentos já foi pago em outro lugar. Feche e selecione de novo.');return false;}
  var hoje=hojeISO();
  var lt={id:uid('lt'),numero:numeroDoLote(hoje,suc),tipo:ls[0].tipo==='despesa'?'pagar':'receber',
    data:d,contaId:c,metodoId:m,obs:($('ltO').value||'').trim(),
    criadoEm:new Date().toISOString(),criadoPor:(usuarioLogado()||{}).nome||'',
    sucursalId:suc,desfeito:false,itens:[]};
  ls.forEach(function(l){
    /* o "antes" de cada um: é ele que o desfazer devolve, campo a campo */
    var antes={pago:!!l.pago,pagamento:l.pagamento||'',contaId:l.contaId||'',metodoId:l.metodoId||'',
      valor:Number(l.valor)||0,juros:Number(l.juros)||0,multa:Number(l.multa)||0,
      valorOriginal:(l.valorOriginal===undefined||l.valorOriginal===null)?null:Number(l.valorOriginal)};
    var j=juros[l.id]||0;
    l.pago=true;l.contaId=c;l.metodoId=m;l.pagamento=d;
    if(j>0||antes.valorOriginal!==null||antes.juros||antes.multa){
      var base=valorBoleto(l);
      l.valorOriginal=base;l.juros=j;l.multa=0;
      l.valor=+(base+j).toFixed(2);
    }
    l.loteRef=lt.id;l.loteNum=lt.numero;
    lt.itens.push({id:l.id,descricao:l.descricao||'',fornecedor:l.fornecedor||'',documento:l.documento||'',
      vencimento:l.vencimento||'',valor:Number(l.valor)||0,antes:antes});
  });
  lt.qtd=lt.itens.length;
  lt.total=+lt.itens.reduce(function(a,it){return a+it.valor},0).toFixed(2);
  baseLotes().push(lt);
  salvar();telaLancamentos();
  toast('Lote '+lt.numero+' feito — '+lt.qtd+' lançamentos, R$ '+money(lt.total)+'.');
  /* "Tudo salvo" só depois que a nuvem confirmou */
  setTimeout(function(){ conferirLancNaNuvem(ls.map(function(l){return l.id})); },300);
  return true;
}

/* ---------- 2. A TELA DOS LOTES ---------- */
function abrirLotes(){ LF.aba='lotes'; telaLotes(); }
function voltarDosLotes(){ LF.aba=''; telaLancamentos(); }
function mesDoLote(){
  if(!LT.mes)LT.mes=hojeISO().slice(0,7);
  return LT.mes;
}
function moverMesLote(dir){
  var p=mesDoLote().split('-'),a=Number(p[0]),m=Number(p[1])+dir;
  if(m<1){m=12;a--;} if(m>12){m=1;a++;}
  LT.mes=a+'-'+(m<10?'0':'')+m; telaLotes();
}
function rotuloMesLote(){
  var nomes=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  var p=mesDoLote().split('-');
  return nomes[Number(p[1])-1]+' de '+p[0];
}
function lotesDaTela(){
  var mes=mesDoLote();
  return baseLotes().filter(function(x){
    if(!daUnidadeAberta({sucursalId:x.sucursalId}))return false;
    if(String(x.criadoEm||x.data||'').slice(0,7)!==mes&&String(x.data||'').slice(0,7)!==mes)return false;
    if(LT.tipo&&x.tipo!==LT.tipo)return false;
    if(LT.sit&&situacaoDoLote(x)!==LT.sit)return false;
    return true;
  }).sort(function(a,b){return String(b.criadoEm||'').localeCompare(String(a.criadoEm||''))});
}
function setLT(k,v){ LT[k]=v; telaLotes(); }
function telaLotes(){
  baseLanc();baseLotes();
  var lista=lotesDaTela();
  var chip=function(k,v,rot){return '<button class="'+(LT[k]===v?'on':'')+'" onclick="setLT(\''+k+'\',\''+v+'\')">'+rot+'</button>';};
  $('content').innerHTML='<div class="lfWrap"><div class="lfScroll">'+
   '<div class="lfTopo"><h1>Operações em lote</h1>'+
    '<div class="lfPeriodo"><div class="lfNav">'+
     '<button onclick="moverMesLote(-1)">'+sv('cr2',16)+'</button><span>'+rotuloMesLote()+'</span>'+
     '<button onclick="moverMesLote(1)">'+sv('cr',16)+'</button></div></div>'+
    '<div class="lfTopBtns"><button class="btnP2" onclick="voltarDosLotes()">'+sv('cr2',14)+' Voltar aos lançamentos</button></div>'+
   '</div>'+
   '<div class="lfFiltros">'+
    '<div class="fGrupo"><label>Situação</label><div class="chips">'+
     chip('sit','','Todos')+chip('sit','pago','Falta conciliar')+chip('sit','conc','Conciliados')+chip('sit','desf','Desfeitos')+
    '</div></div>'+
    '<div class="fGrupo"><label>Tipo</label><div class="chips">'+
     chip('tipo','','Todos')+chip('tipo','pagar','Pagar')+chip('tipo','receber','Receber')+
    '</div></div>'+
   '</div>'+
   '<div class="lfTabW plano">'+
   (lista.length?'<table class="lfTab2 ltLista"><thead><tr><th style="width:132px">Nº do lote</th>'+
    '<th style="width:140px">Criado em</th><th>Conta / observação</th><th style="width:80px">Tipo</th>'+
    '<th style="width:96px">Forma</th><th style="width:60px;text-align:center">Itens</th>'+
    '<th style="width:132px;text-align:right">Total</th><th style="width:170px">Situação</th>'+
    '<th style="width:96px">Feito por</th><th style="width:60px;text-align:center">Ver</th></tr></thead><tbody>'+
    lista.map(function(x){
      var s=situacaoDoLote(x),rec=x.tipo==='receber';
      return '<tr class="'+(s==='desf'?'ltDesf':'')+'" onclick="verLote(\''+x.id+'\')" style="cursor:pointer">'+
       '<td><span class="loteTag">'+sv('folder',10)+' '+E(x.numero)+'</span></td>'+
       '<td>'+dataBR(String(x.criadoEm||'').slice(0,10))+' '+horaDe(x.criadoEm)+'</td>'+
       '<td><div class="lfDesc">'+iconeConta(x.contaId)+'<div><b>'+E(contaNome(x.contaId))+'</b>'+
        '<small>'+E(x.desfeito?('desfeito em '+dataBR(String(x.desfeitoEm||'').slice(0,10))+' por '+(x.desfeitoPor||'—')+' — '+(x.motivo||'')):(x.obs||'pago em '+dataBR(x.data)))+'</small></div></div></td>'+
       '<td>'+(rec?'Receber':'Pagar')+'</td><td>'+E(metodoNome(x.metodoId))+'</td>'+
       '<td style="text-align:center">'+(x.qtd||(x.itens||[]).length)+'</td>'+
       '<td style="text-align:right"><b class="'+(rec?'vg':'vr')+'">'+(rec?'':'- ')+'R$ '+money(x.total)+'</b></td>'+
       '<td><span class="ltSit '+s+'">'+SIT_LOTE[s]+'</span></td>'+
       '<td>'+E(x.criadoPor||'—')+'</td>'+
       '<td style="text-align:center"><button class="rBtn" title="Ver o lote">'+sv('search',12)+'</button></td></tr>';
    }).join('')+'</tbody></table>'
   :'<div class="lfVazio"><b>Nenhum lote em '+rotuloMesLote().toLowerCase()+'</b>'+
    'Para fazer um lote, marque os lançamentos em aberto na lista e clique em <b>Operação em lote</b>.</div>')+
   '</div></div></div>';
  rodape(lista.length+' lote(s) em '+rotuloMesLote().toLowerCase());
}
function horaDe(iso){
  if(!iso)return '';
  try{ var d=new Date(iso); if(isNaN(d))return '';
    return (d.getHours()<10?'0':'')+d.getHours()+':'+(d.getMinutes()<10?'0':'')+d.getMinutes(); }
  catch(e){ return ''; }
}

/* ---------- 3. O LOTE ABERTO ---------- */
function verLote(id){
  var lt=baseLotes().find(function(x){return x.id===id});
  if(!lt){toast('Este lote ainda não chegou neste aparelho.');return;}
  var s=situacaoDoLote(lt),rec=lt.tipo==='receber';
  var ls=itensDoLote(lt);
  var algumConc=ls.some(function(l){return l.conciliado&&l.loteRef===lt.id});
  var h='<div class="mdB">'+
   '<div class="ltCab"><div><div class="ltL">Lote</div><div class="ltN">'+E(lt.numero)+'</div></div>'+
    '<div><div class="ltL">'+(rec?'Recebido em':'Pago em')+'</div><b>'+dataBR(lt.data)+'</b></div>'+
    '<div><div class="ltL">Conta</div><b>'+E(contaNome(lt.contaId))+'</b></div>'+
    '<div><div class="ltL">Forma</div><b>'+E(metodoNome(lt.metodoId))+'</b></div>'+
    '<div class="ltSp"></div><span class="ltSit '+s+'">'+SIT_LOTE[s]+'</span></div>'+
   '<div class="hint" style="margin:-2px 0 10px">Criado por <b>'+E(lt.criadoPor||'—')+'</b> em '+
    dataBR(String(lt.criadoEm||'').slice(0,10))+' às '+horaDe(lt.criadoEm)+(lt.obs?' · '+E(lt.obs):'')+
    (lt.desfeito?'<br><b>Desfeito</b> por '+E(lt.desfeitoPor||'—')+' em '+dataBR(String(lt.desfeitoEm||'').slice(0,10))+
      ' às '+horaDe(lt.desfeitoEm)+' — '+E(lt.motivo||''):'')+'</div>'+
   '<div class="ltTabW"><table class="pTable"><thead><tr><th>Fornecedor / descrição</th>'+
    '<th class="ltSoPc" style="width:96px">Vencimento</th><th class="ltSoPc" style="width:96px">Conciliado</th>'+
    '<th style="width:112px;text-align:right">'+(rec?'Recebido':'Pago')+'</th></tr></thead><tbody>'+
   (lt.itens||[]).map(function(it){
     var l=ls.find(function(x){return x.id===it.id});
     return '<tr><td><b>'+E(it.fornecedor||it.descricao||'—')+'</b>'+
      '<div class="ltSub">'+E(it.fornecedor?it.descricao:'')+(it.documento?' · '+E(it.documento):'')+'</div></td>'+
      '<td class="ltSoPc">'+dataBR(it.vencimento)+'</td>'+
      '<td class="ltSoPc">'+(l&&l.conciliado&&!lt.desfeito?'sim':'—')+'</td>'+
      '<td style="text-align:right;white-space:nowrap"><b class="'+(rec?'vg':'vr')+'">'+(rec?'':'- ')+'R$ '+money(it.valor)+'</b></td></tr>';
   }).join('')+'</tbody></table></div>'+
   '<div class="ltTot"><span>Total do lote</span><b class="'+(rec?'vg':'vr')+'">'+(rec?'':'- ')+'R$ '+money(lt.total)+'</b></div>'+
   '<div class="ltBtns"><button class="btn" onclick="imprimirLote(\''+lt.id+'\')">'+sv('print2',14)+' Imprimir comprovante do lote</button>'+
    (s==='pago'?'<button class="btn" onclick="conciliarLote(\''+lt.id+'\')">'+sv('nike',14)+' Conciliar o lote inteiro</button>':'')+
    (!lt.desfeito&&!algumConc?'<button class="btn ltBtnDesf" onclick="desfazerLote(\''+lt.id+'\')">'+sv('x2',12)+' Desfazer o lote</button>':'')+
   '</div>'+
   (!lt.desfeito&&algumConc?'<div class="ltAviso">Lote com lançamento conciliado não se desfaz. '+
     'Para desfazer, desconcilie primeiro na Conciliação Bancária.</div>':'')+
   '</div>';
  modal('Lote '+lt.numero,h,'Fechar',function(){return true;},'lg');
}
function conciliarLote(id){
  var lt=baseLotes().find(function(x){return x.id===id});
  if(!lt||lt.desfeito)return;
  var n=0;
  itensDoLote(lt).forEach(function(l){
    if(l.loteRef!==lt.id||!l.pago||l.conciliado)return;
    l.conciliado=true;l.dataConc=hojeISO();n++;
  });
  if(!n){toast('Todos os lançamentos deste lote já estão conciliados.');return;}
  salvar();fecharModal();
  if(LF.aba==='lotes')telaLotes();else telaLancamentos();
  toast('Lote '+lt.numero+' conciliado — '+n+' lançamento(s). Eles ficam travados nos lançamentos.');
}
async function desfazerLote(id){
  var lt=baseLotes().find(function(x){return x.id===id});
  if(!lt||lt.desfeito)return;
  var ls=itensDoLote(lt).filter(function(l){return l.loteRef===lt.id});
  if(ls.some(function(l){return l.conciliado})){
    toast('Lote com lançamento conciliado não se desfaz. Desconcilie primeiro.');return;
  }
  fecharModal();
  var h='<div class="mdB"><div class="blk" style="margin:0;max-width:none">'+
   '<div class="hint" style="margin-bottom:10px">Os '+ls.length+' lançamentos do lote '+E(lt.numero)+
    ' voltam a ficar como estavam antes dele ('+(lt.tipo==='receber'?'a receber':'em aberto')+
    '), e o dinheiro volta para '+E(contaNome(lt.contaId))+'. O lote fica na lista como Desfeito.</div>'+
   '<div class="fld2" style="margin:0"><label>Motivo *</label>'+
    '<input id="ltMot" placeholder="ex.: saiu da conta errada"></div></div></div>';
  modal('Desfazer o lote '+lt.numero+'?',h,'Desfazer o lote',function(){
    var mot=($('ltMot').value||'').trim();
    if(mot.length<3){toast('Escreva o motivo — ele fica registrado no lote.');return false;}
    ls.forEach(function(l){
      var it=(lt.itens||[]).find(function(x){return x.id===l.id});
      var a=(it&&it.antes)||{};
      l.pago=!!a.pago;l.pagamento=a.pagamento||'';l.contaId=a.contaId||'';l.metodoId=a.metodoId||'';
      if(a.valor!==undefined)l.valor=Number(a.valor)||0;
      l.juros=Number(a.juros)||0;l.multa=Number(a.multa)||0;
      if(a.valorOriginal===null||a.valorOriginal===undefined)delete l.valorOriginal;
      else l.valorOriginal=Number(a.valorOriginal)||0;
      /* nulo (e não ausente): é ele que limpa o lote na nuvem */
      l.loteRef=null;l.loteNum=null;
    });
    lt.desfeito=true;lt.desfeitoEm=new Date().toISOString();
    lt.desfeitoPor=(usuarioLogado()||{}).nome||'';lt.motivo=mot;
    salvar();
    if(LF.aba==='lotes')telaLotes();else telaLancamentos();
    toast('Lote '+lt.numero+' desfeito — '+ls.length+' lançamento(s) voltaram como estavam.');
    setTimeout(function(){ conferirLancNaNuvem(ls.map(function(l){return l.id})); },300);
    return true;
  });
}
function imprimirLote(id){
  var lt=baseLotes().find(function(x){return x.id===id});
  if(!lt)return;
  var rec=lt.tipo==='receber';
  var el=document.getElementById('viaImp')||document.createElement('div');
  el.id='viaImp';
  el.innerHTML='<div style="text-align:center"><b>JOIA — '+(rec?'RECEBIMENTO':'PAGAMENTO')+' EM LOTE</b><br>'+
   'Lote '+E(lt.numero)+'</div><hr>'+
   (rec?'Recebido':'Pago')+' em '+dataBR(lt.data)+'<br>Conta: '+E(contaNome(lt.contaId))+
   '<br>Forma: '+E(metodoNome(lt.metodoId))+'<br>Feito por: '+E(lt.criadoPor||'—')+
   (lt.obs?'<br>'+E(lt.obs):'')+(lt.desfeito?'<br><b>LOTE DESFEITO</b> — '+E(lt.motivo||''):'')+'<hr>'+
   (lt.itens||[]).map(function(it){
     return E(it.fornecedor||it.descricao||'—')+(it.documento?' ('+E(it.documento)+')':'')+
       ' — R$ '+money(it.valor);
   }).join('<br>')+
   '<hr><b>'+(lt.qtd||(lt.itens||[]).length)+' lançamentos · Total R$ '+money(lt.total)+'</b>';
  document.body.appendChild(el);
  setTimeout(function(){window.print()},150);
}
/* a etiqueta na linha da lista: o número, e o clique abre o lote */
function etiquetaLote(l){
  if(!noLote(l))return '';
  return ' <button type="button" class="loteTag" onclick="event.stopPropagation();verLote(\''+l.loteRef+'\')" '+
    'title="Ver o lote">'+sv('folder',10)+' Lote '+E(l.loteNum||'')+'</button>';
}
/* o filtro "Lote" da lista: os lotes que valem, desta unidade */
function opcoesFiltroLote(){
  var ls=baseLotes().filter(function(x){return !x.desfeito&&daUnidadeAberta({sucursalId:x.sucursalId})})
    .sort(function(a,b){return String(b.criadoEm||'').localeCompare(String(a.criadoEm||''))}).slice(0,60);
  return '<option value="">Todos</option>'+ls.map(function(x){
    return '<option value="'+x.id+'"'+(LF.lote===x.id?' selected':'')+'>'+E(x.numero)+'</option>';}).join('');
}

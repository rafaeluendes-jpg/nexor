/* ==========================================================
   BLOCO 15 — CONCILIAÇÃO BANCÁRIA
   ========================================================== */
var CB={conta:'',de:'',ate:'',marcadas:{},sel:''};
function telaConciliacao(){
  baseLanc();
  if(!CB.de){var d=new Date();
    CB.de=new Date(d.getFullYear(),d.getMonth(),1).toISOString().slice(0,10);
    CB.ate=new Date(d.getFullYear(),d.getMonth()+1,0).toISOString().slice(0,10);}
  if(!CB.conta&&(DB.contas||[]).length)CB.conta=DB.contas[0].id;
  var conta=(DB.contas||[]).find(function(c){return c.id===CB.conta});
  var movs=(DB.lancFin||[]).filter(function(l){
    if(l.contaId!==CB.conta&&l.contaDestinoId!==CB.conta)return false;
    if(!l.pago)return false;
    var d=l.pagamento||l.vencimento;
    return d>=CB.de&&d<=CB.ate;
  }).sort(function(a,b){return (a.pagamento||'').localeCompare(b.pagamento||'')});

  function sinal(l){
    if(l.tipo==='transferencia')return l.contaDestinoId===CB.conta?1:-1;
    return l.tipo==='receita'?1:-1;
  }
  var antes=(DB.lancFin||[]).filter(function(l){
    if(l.contaId!==CB.conta&&l.contaDestinoId!==CB.conta)return false;
    if(!l.pago)return false;
    return (l.pagamento||l.vencimento)<CB.de;
  }).reduce(function(a,l){return a+sinal(l)*l.valor},0);
  var saldoIni=(conta?Number(conta.saldoInicial)||0:0)+antes;
  var cred=movs.filter(function(l){return sinal(l)>0}).reduce(function(a,l){return a+l.valor},0);
  var deb=movs.filter(function(l){return sinal(l)<0}).reduce(function(a,l){return a+l.valor},0);
  var naoC=movs.filter(function(l){return !l.conciliado});
  var ncC=naoC.filter(function(l){return sinal(l)>0}).reduce(function(a,l){return a+l.valor},0);
  var ncD=naoC.filter(function(l){return sinal(l)<0}).reduce(function(a,l){return a+l.valor},0);
  var jaConc=movs.filter(function(l){return l.conciliado}).length;
  var saldo=saldoIni;
  var marcadas=Object.keys(CB.marcadas).filter(function(k){return CB.marcadas[k]}).length;

  $('content').innerHTML='<div class="cbWrap">'+
   '<div class="cbBar">'+
    '<button class="btnP2" id="btEd" onclick="editarMovSel()">'+sv('edit',14)+' Editar lançamento</button>'+
    '<div class="tSep2"></div>'+
    '<button class="btnP2" onclick="exportarConc()">'+sv('down2',14)+' Exportar Excel</button>'+
    '<button class="btnP2" onclick="telaConciliacao()">'+sv('ref',14)+' Atualizar</button>'+
    '<div style="flex:1"></div>'+
    '<div class="cbProg"><span>'+jaConc+' de '+movs.length+' conciliados</span>'+
     '<div class="cbBarra"><i style="width:'+(movs.length?(jaConc/movs.length*100):0)+'%"></i></div></div>'+
   '</div>'+
   '<div class="cbBody">'+
    '<aside class="cbPane">'+
     '<div class="cbPaneH">Filtros</div>'+
     '<div class="cbPaneB">'+
      '<div class="cbSecT">Sucursal</div>'+
      '<div class="cbLista">'+
       (DB.lojasFin||[{id:'lj_matriz',nome:'Matriz'}]).map(function(l,i){
         return '<div class="cbItem'+(i===0?' on':'')+'">'+sv('folder',14)+' '+E(l.nome)+'</div>'}).join('')+
      '</div>'+
      '<div class="cbSecT">Conta de capital</div>'+
      '<div class="cbLista">'+(DB.contas||[]).map(function(c){
        var b=c.fixa?null:banco(c.banco);
        var cor=c.fixa==='caixa'?'#0E8A46':c.fixa==='cofre'?'#5C6B80':(b?b.c:'#5C6B80');
        var sig=c.fixa==='caixa'?'CX':c.fixa==='cofre'?'CO':(b?b.s:'$');
        return '<div class="cbItem'+(CB.conta===c.id?' on':'')+'" onclick="CB.conta=\''+c.id+'\';CB.marcadas={};CB.sel=\'\';telaConciliacao()">'+
        '<span class="ctMini" style="background:'+cor+'">'+sig+'</span> '+E(c.nome)+'</div>';}).join('')+
      '</div>'+
      '<div class="cbSecT">Período</div>'+
      '<div class="cbData"><label>Data inicial</label><input type="date" id="cbDe" value="'+CB.de+'"></div>'+
      '<div class="cbData"><label>Data final</label><input type="date" id="cbAte" value="'+CB.ate+'"></div>'+
      '<div class="cbAtalhos">'+
       '<button onclick="perCB(0)">Este mês</button>'+
       '<button onclick="perCB(-1)">Mês anterior</button>'+
       '<button onclick="perCB(-3)">3 meses</button>'+
      '</div>'+
      '<button class="btnP2 ok" style="width:100%;justify-content:center;margin-top:12px" onclick="aplicarCB()">'+
       sv('search',13)+' Aplicar</button>'+
     '</div>'+
    '</aside>'+

    '<div class="cbMain">'+
     '<div class="cbTit">Extrato bancário conciliado — '+E(conta?conta.nome:'—')+
      '<span class="cbPer">'+dataBR(CB.de)+' a '+dataBR(CB.ate)+'</span></div>'+
     '<div class="cbResumo">'+
      '<div class="cbBox"><div class="cbL">Saldo inicial</div><div class="cbR">R$ '+money(saldoIni)+'</div></div>'+
      '<div class="cbBox"><div class="cbL">Créditos</div><div class="cbR vg">R$ '+money(cred)+'</div></div>'+
      '<div class="cbBox"><div class="cbL">Débitos</div><div class="cbR vr">- R$ '+money(deb)+'</div></div>'+
      '<div class="cbBox dest"><div class="cbL">Saldo final</div><div class="cbR">R$ '+money(saldoIni+cred-deb)+'</div></div>'+
      '<div class="cbBox alt2"><div class="cbL">Não conciliados</div>'+
       '<div class="cbR"><span class="vg">R$ '+money(ncC)+'</span> <span class="vr">- R$ '+money(ncD)+'</span></div></div>'+
     '</div>'+
     '<div class="cbTabW">'+
     (movs.length?'<table class="cbTab"><thead><tr>'+
      '<th style="width:38px"></th>'+
      '<th style="width:100px">Data</th><th>Movimento</th>'+
      '<th style="width:118px;text-align:right">Valor do boleto</th>'+
      '<th style="width:126px;text-align:right">Valor pago</th>'+
      '<th style="width:126px;text-align:right">Saldo</th>'+
      '<th style="width:120px;text-align:center">Conciliado</th></tr></thead><tbody>'+
      movs.map(function(l){
        var v=sinal(l)*l.valor;saldo+=v;
        var marc=CB.marcadas[l.id]!==undefined?CB.marcadas[l.id]:!!l.conciliado;
        return '<tr class="'+(l.conciliado?'conc':'')+(CB.sel===l.id?' sel2':'')+'" onclick="CB.sel=\''+l.id+'\';telaConciliacao()">'+
        '<td><input type="radio" name="cbSel" class="chk" '+(CB.sel===l.id?'checked':'')+'></td>'+
        '<td>'+dataBR(l.pagamento||l.vencimento)+'</td>'+
        '<td><b>'+E(l.descricao)+'</b>'+
         ((l.documento||l.metodoId)?'<small>'+(l.documento?'Doc.: '+E(l.documento):'')+
          (l.documento&&l.metodoId?' · ':'')+(l.metodoId?E(metodoNome(l.metodoId)):'')+'</small>':'')+'</td>'+
        '<td style="text-align:right"><span class="vBol">'+(v<0?'- ':'')+
         'R$ '+money(valorBoleto(l))+'</span></td>'+
        '<td style="text-align:right"><b class="'+(v<0?'vr':'vg')+'">'+(v<0?'- ':'')+
         'R$ '+money(Math.abs(v))+'</b>'+
         (encargos(l)>0?'<small class="vEnc">+ R$ '+money(encargos(l))+' juros/multa</small>':'')+
        '</td>'+
        '<td style="text-align:right">R$ '+money(saldo)+'</td>'+
        '<td style="text-align:center" onclick="event.stopPropagation()">'+
         (l.conciliado
           ?'<span class="okConc" title="conciliado em '+dataBR(l.dataConc)+'">'+sv('nike',18)+'</span>'+
            '<button class="rBtn rd" style="margin-left:7px" onclick="desconciliar(\''+l.id+'\')" title="Desconciliar">'+sv('x2',12)+'</button>'
           :'<input type="checkbox" class="chk cbChk" data-id="'+l.id+'"'+(marc?' checked':'')+
            ' onchange="CB.marcadas[\''+l.id+'\']=this.checked;atualizaCB()">')+
        '</td></tr>';
      }).join('')+
      '<tr class="cbFim"><td colspan="5"><b>Saldo em '+dataBR(CB.ate)+'</b></td>'+
      '<td style="text-align:right"><b>R$ '+money(saldo)+'</b></td><td></td></tr>'+
      '</tbody></table>'
     :'<div class="lfVazio"><b>Nenhum movimento nesta conta e período</b>'+
      'Os lançamentos pagos aparecem aqui automaticamente.</div>')+
     '</div>'+
     '<div class="cbFoot">'+
      '<span id="cbCont">'+(marcadas?marcadas+' marcado(s) para conciliar':'marque os movimentos que já apareceram no banco')+'</span>'+
      '<button class="btnConf" onclick="conciliarSelecionadas()">'+sv('nike',16)+' Confirmar conciliação</button>'+
     '</div>'+
    '</div>'+
   '</div></div>';
  rodape(jaConc+' de '+movs.length+' conciliados');
}
function atualizaCB(){
  var n=Object.keys(CB.marcadas).filter(function(k){return CB.marcadas[k]}).length;
  var el=$('cbCont');
  if(el)el.textContent=n?n+' marcado(s) para conciliar':'marque os movimentos que já apareceram no banco';
}
function perCB(n){
  var d=new Date();
  var a=new Date(d.getFullYear(),d.getMonth()+ (n<0?n:0),1);
  var b=new Date(d.getFullYear(),d.getMonth()+ (n<0?n+1:1),0);
  if(n===-3){a=new Date(d.getFullYear(),d.getMonth()-2,1);b=new Date(d.getFullYear(),d.getMonth()+1,0);}
  CB.de=a.toISOString().slice(0,10);CB.ate=b.toISOString().slice(0,10);
  CB.marcadas={};telaConciliacao();
}
function aplicarCB(){CB.de=$('cbDe').value;CB.ate=$('cbAte').value;CB.marcadas={};telaConciliacao();}
function editarMovSel(){
  if(!CB.sel){toast('Selecione um movimento na lista.');return;}
  var l=DB.lancFin.find(function(x){return x.id===CB.sel});
  if(!l)return;
  if(l.conciliado){toast('Movimento conciliado — desconcilie antes de editar.');return;}
  modalLancCB(l.id);
}
/* Do boleto para a nota SEM sair da tela: a nota abre por cima do lançamento
   e, ao fechar, você continua exatamente onde estava. */
/* Acha a nota deste lançamento por três caminhos, porque o vínculo direto
   pode ter se perdido em versões antigas: pelo ref, pela lista de lançamentos
   guardada na nota, e por fornecedor + número do documento. */
/* copia o codigo do jeito que o banco pede: so numeros */
function copiarBoleto(id){
  var l=(DB.lancFin||[]).find(function(x){return x.id===id});
  if(!l||!l.codigoBarras)return;
  try{ navigator.clipboard.writeText(l.codigoBarras);
    toast('Código de barras copiado.'); }
  catch(e){ toast(l.codigoBarras); }
}
function notaDoLanc(l){
  if(!l)return null;
  var ns=DB.notas||[];
  var n=null;
  if(l.ref)n=ns.find(function(x){return x.id===l.ref})||null;
  if(!n)n=ns.find(function(x){return (x.lancIds||[]).indexOf(l.id)>=0})||null;
  if(!n&&l.documento){
    var num=String(l.documento).replace(/[^0-9]/g,'');
    if(num)n=ns.find(function(x){
      return String(x.numero||'').replace(/[^0-9]/g,'')===num&&
        (!l.fornecedorId||x.fornecedorId===l.fornecedorId);
    })||null;
  }
  if(n&&!l.ref){l.ref=n.id;l.origem=l.origem||'nota-entrada';}   /* religa e não perde de novo */
  return n;
}
function abrirNotaDoLanc(id){
  var n=(DB.notas||[]).find(function(x){return x.id===id});
  if(!n){toast('A nota de entrada não foi encontrada.');return;}
  var v=document.getElementById('mdOv2');if(v)v.remove();
  /* a nota se desenha sozinha numa camada 'mdOv'. Escondemos o nome do lançamento
     por um instante para a nota nascer separada e virar a camada de cima. */
  var base=document.getElementById('mdOv');
  if(base)base.id='mdOvBase';
  try{ verNota(id); }catch(e){_quieto(e,'abrirNotaDoLanc')}
  var nova=document.getElementById('mdOv');
  if(base)base.id='mdOv';
  if(!nova||nova===base){toast('Não consegui abrir a nota.');return;}
  /* clonar tira os cliques de fora que fechariam o lançamento de trás */
  var lim=nova.cloneNode(true);
  nova.parentNode.replaceChild(lim,nova);
  lim.id='mdOv2';lim.className='mdOv notaOv';
  var bts=lim.querySelectorAll('[onclick]');
  for(var i=0;i<bts.length;i++){
    var oc=bts[i].getAttribute('onclick')||'';
    if(oc.indexOf('fecharModal')>=0)bts[i].setAttribute('onclick','fecharNotaSobre()');
    if(oc.indexOf('excluirNota')>=0)bts[i].remove();   /* aqui a nota é só consulta */
  }
  lim.addEventListener('mousedown',function(e){ if(e.target===lim)fecharNotaSobre(); });
}
function fecharNotaSobre(){var o=document.getElementById('mdOv2');if(o)o.remove();}
function modalLancCB(id){
  var voltar=telaConciliacao;
  var antes=telaLancamentos;
  telaLancamentos=function(){voltar();telaLancamentos=antes;};
  modalLanc(id,null,{deCB:true});
}
function conciliarSelecionadas(){
  var n=0;
  Object.keys(CB.marcadas).forEach(function(id){
    var l=DB.lancFin.find(function(x){return x.id===id});
    if(!l)return;
    if(CB.marcadas[id]&&!l.conciliado){l.conciliado=true;l.dataConc=hojeISO();n++;}
  });
  if(!n){toast('Marque ao menos um movimento.');return;}
  CB.marcadas={};salvar();telaConciliacao();
  toast(n+' movimento(s) conciliado(s). Eles ficam travados nos lançamentos.');
}
async function desconciliar(id){
  var l=DB.lancFin.find(function(x){return x.id===id});
  if(!await pergunta('Desconciliar "'+l.descricao+'"?\n\nEle volta a ficar editável nos lançamentos financeiros.'))return;
  l.conciliado=false;l.dataConc='';
  salvar();telaConciliacao();toast('Movimento desconciliado.');
}
function exportarConc(){
  var conta=(DB.contas||[]).find(function(c){return c.id===CB.conta});
  var movs=(DB.lancFin||[]).filter(function(l){
    return (l.contaId===CB.conta||l.contaDestinoId===CB.conta)&&l.pago&&
      (l.pagamento||l.vencimento)>=CB.de&&(l.pagamento||l.vencimento)<=CB.ate;});
  var linhas=[['Data','Movimento','Documento','Valor','Conciliado']];
  movs.forEach(function(l){
    var neg=l.tipo==='despesa'||(l.tipo==='transferencia'&&l.contaId===CB.conta);
    linhas.push([dataBR(l.pagamento||l.vencimento),l.descricao,l.documento||'',
      (neg?'-':'')+String(l.valor).replace('.',','),l.conciliado?'Sim':'Nao']);
  });
  var csv=linhas.map(function(r){return r.map(function(c){return '"'+String(c).replace(/"/g,'""')+'"'}).join(';')}).join('\n');
  var b=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'});
  var a=document.createElement('a');a.href=URL.createObjectURL(b);
  a.download='conciliacao-'+(conta?conta.nome:'conta')+'-'+CB.de+'.csv';
  document.body.appendChild(a);a.click();setTimeout(function(){a.remove()},400);
  toast('Extrato exportado.');
}

/* ==========================================================
   BLOCO 14 — FLUXO DE CAIXA
   ========================================================== */
var MESES=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
var MESC=['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];
var FX={ano:new Date().getFullYear(),conta:'',previsto:false,de:0,ate:11,abertas:{}};

function grupoDoLanc(l){
  if(l.categoriaTxt)return l.categoriaTxt;
  var p=pastaDaSub(l.categoriaId);
  return p||'Sem categoria';
}
function subDoLanc(l){
  if(l.categoriaTxt)return '';
  var nome=nomeCategoria(l.categoriaId);
  var i=nome.indexOf(' › ');
  return i>=0?nome.slice(i+3):'';
}
function lancDoMes(m){
  return (DB.lancFin||[]).filter(function(l){
    if(FX.conta&&l.contaId!==FX.conta&&l.contaDestinoId!==FX.conta)return false;
    if(!FX.previsto&&!l.pago)return false;
    var d=(l.pago&&l.pagamento)?l.pagamento:(l.vencimento||l.emissao||'');
    if(!d)return false;
    var dt=new Date(d+'T12:00:00');
    return dt.getFullYear()===FX.ano&&dt.getMonth()===m;
  });
}
function montaFluxo(){
  var rec={},des={},transE=[],transS=[];
  for(var m=0;m<12;m++){transE[m]=0;transS[m]=0;}
  for(var m2=0;m2<12;m2++){
    lancDoMes(m2).forEach(function(l){
      if(l.tipo==='transferencia'){
        if(l.contaDestinoId===FX.conta||!FX.conta)transE[m2]+=l.valor;
        if(l.contaId===FX.conta||!FX.conta)transS[m2]+=l.valor;
        return;
      }
      var alvo=l.tipo==='receita'?rec:des;
      var g=grupoDoLanc(l),sb=subDoLanc(l)||'(sem subcategoria)';
      alvo[g]=alvo[g]||{tot:[],subs:{}};
      alvo[g].tot[m2]=(alvo[g].tot[m2]||0)+l.valor;
      alvo[g].subs[sb]=alvo[g].subs[sb]||[];
      alvo[g].subs[sb][m2]=(alvo[g].subs[sb][m2]||0)+l.valor;
    });
  }
  return {rec:rec,des:des,transE:transE,transS:transS};
}
function telaFluxo(){
  baseLanc();
  var f=montaFluxo();
  var mesesVis=[];for(var m=FX.de;m<=FX.ate;m++)mesesVis.push(m);
  var totR=[],totD=[],saldoAnt=[],saldoFim=[],totCx=[],totT=[];
  var acumulado=(DB.contas||[]).filter(function(c){return !FX.conta||c.id===FX.conta})
    .reduce(function(a,c){return a+(Number(c.saldoInicial)||0)},0);
  for(var i=0;i<12;i++){
    totR[i]=Object.keys(f.rec).reduce(function(a,k){return a+(f.rec[k].tot[i]||0)},0);
    totD[i]=Object.keys(f.des).reduce(function(a,k){return a+(f.des[k].tot[i]||0)},0);
    totCx[i]=totR[i]-totD[i];
    totT[i]=f.transE[i]-f.transS[i];
    saldoAnt[i]=acumulado;
    acumulado=acumulado+totCx[i]+totT[i];
    saldoFim[i]=acumulado;
  }
  function linhaVals(arr,cls,neg){
    return mesesVis.map(function(m){
      var v=arr[m]||0;
      return '<td class="fxV '+(cls||'')+'">'+(neg&&v?'-':'')+money(Math.abs(v))+'</td>';
    }).join('');
  }
  function blocoGrupos(obj,tipo){
    var ks=Object.keys(obj).sort();
    if(!ks.length)return '<tr><td class="fxN vazio2" colspan="'+(mesesVis.length+1)+'" style="padding:16px">nenhum lançamento no período</td></tr>';
    return ks.map(function(k){
      var g=obj[k],ab=!!FX.abertas[tipo+k];
      var subs=Object.keys(g.subs).sort();
      var h='<tr class="fxG'+(ab?' ab':'')+'" onclick="toggleFx(\''+tipo+'\',\''+E(k).replace(/'/g,'')+'\')">'+
      '<td class="fxN"><span class="fxSeta">'+sv('tri',9)+'</span>'+
      '<span class="fxBar" style="background:'+(tipo==='r'?'#00A08B':'#C94141')+'"></span>'+E(k)+'</td>'+
      linhaVals(g.tot,tipo==='r'?'vg':'vr',tipo==='d')+'</tr>';
      if(ab)subs.forEach(function(sb){
        h+='<tr class="fxS"><td class="fxN sub">'+E(sb)+'</td>'+
        linhaVals(g.subs[sb],tipo==='r'?'vg':'vr',tipo==='d')+'</tr>';
      });
      return h;
    }).join('');
  }
  $('content').innerHTML='<div class="fxWrap">'+
   '<div class="fxTopo">'+
    '<div><h1>Fluxo de Caixa</h1><p>Entradas e saídas por categoria, mês a mês.</p></div>'+
    '<div class="fxFiltros">'+
     '<div class="f2" style="min-width:150px"><label>Conta</label><select onchange="FX.conta=this.value;telaFluxo()">'+
      '<option value="">Todas as contas</option>'+
      (DB.contas||[]).map(function(c){return '<option value="'+c.id+'"'+(FX.conta===c.id?' selected':'')+'>'+E(c.nome)+'</option>'}).join('')+
     '</select></div>'+
     '<div class="f2" style="min-width:100px"><label>Ano</label><select onchange="FX.ano=+this.value;telaFluxo()">'+
      [FX.ano-2,FX.ano-1,FX.ano,FX.ano+1].filter(function(v,i,a){return a.indexOf(v)===i}).map(function(y){
        return '<option'+(FX.ano===y?' selected':'')+'>'+y+'</option>'}).join('')+
     '</select></div>'+
     '<div class="f2" style="min-width:120px"><label>De</label><select onchange="FX.de=+this.value;telaFluxo()">'+
      MESES.map(function(n,i){return '<option value="'+i+'"'+(FX.de===i?' selected':'')+'>'+n+'</option>'}).join('')+'</select></div>'+
     '<div class="f2" style="min-width:120px"><label>Até</label><select onchange="FX.ate=+this.value;telaFluxo()">'+
      MESES.map(function(n,i){return '<option value="'+i+'"'+(FX.ate===i?' selected':'')+'>'+n+'</option>'}).join('')+'</select></div>'+
     '<div class="fxPrev"><span>Exibir previsto</span>'+
      '<button class="sw'+(FX.previsto?' on':'')+'" onclick="FX.previsto=!FX.previsto;telaFluxo()"></button></div>'+
     '<button class="btnP2" onclick="exportarFluxo()">'+sv('down2',14)+' Exportar</button>'+
    '</div>'+
   '</div>'+
   '<div class="fxTabW"><table class="fxTab"><thead><tr><th class="fxN"></th>'+
    mesesVis.map(function(m){return '<th class="fxV">'+MESES[m].toUpperCase()+'</th>'}).join('')+
   '</tr></thead><tbody>'+
    '<tr class="fxSaldo"><td class="fxN"><span class="fxTag sl">SALDO</span> Saldo anterior</td>'+
     linhaVals(saldoAnt,'')+'</tr>'+
    '<tr class="fxTit"><td class="fxN"><span class="fxTag rc">RECEITAS</span></td>'+
     mesesVis.map(function(){return '<td></td>'}).join('')+'</tr>'+
    blocoGrupos(f.rec,'r')+
    '<tr class="fxTot"><td class="fxN">Total de receitas</td>'+linhaVals(totR,'vg')+'</tr>'+
    '<tr class="fxTit"><td class="fxN"><span class="fxTag ds">DESPESAS</span></td>'+
     mesesVis.map(function(){return '<td></td>'}).join('')+'</tr>'+
    blocoGrupos(f.des,'d')+
    '<tr class="fxTot"><td class="fxN">Total de despesas</td>'+linhaVals(totD,'vr',true)+'</tr>'+
    '<tr class="fxCx"><td class="fxN">Total de caixa</td>'+
     mesesVis.map(function(m){var v=totCx[m]||0;
       return '<td class="fxV '+(v<0?'vr':'vg')+'">'+(v<0?'-':'')+money(Math.abs(v))+'</td>'}).join('')+'</tr>'+
    '<tr class="fxTit"><td class="fxN"><span class="fxTag tr">TRANSFERÊNCIAS</span></td>'+
     mesesVis.map(function(){return '<td></td>'}).join('')+'</tr>'+
    '<tr class="fxS"><td class="fxN sub">Entradas</td>'+linhaVals(f.transE,'vg')+'</tr>'+
    '<tr class="fxS"><td class="fxN sub">Saídas</td>'+linhaVals(f.transS,'vr',true)+'</tr>'+
    '<tr class="fxTot"><td class="fxN">Total de transferências</td>'+
     mesesVis.map(function(m){var v=totT[m]||0;
       return '<td class="fxV '+(v<0?'vr':'vg')+'">'+(v<0?'-':'')+money(Math.abs(v))+'</td>'}).join('')+'</tr>'+
    '<tr class="fxFim"><td class="fxN">Saldo final de caixa</td>'+
     mesesVis.map(function(m){var v=saldoFim[m]||0;
       return '<td class="fxV '+(v<0?'vr':'vg')+'">'+(v<0?'-':'')+money(Math.abs(v))+'</td>'}).join('')+'</tr>'+
   '</tbody></table></div></div>';
  rodape(FX.previsto?'incluindo lançamentos previstos':'somente lançamentos pagos');
}
function toggleFx(t,k){FX.abertas[t+k]=!FX.abertas[t+k];telaFluxo();}
function exportarFluxo(){
  var f=montaFluxo();
  var linhas=[['Categoria'].concat(MESES.slice(FX.de,FX.ate+1))];
  ['rec','des'].forEach(function(tp){
    Object.keys(f[tp]).sort().forEach(function(k){
      var r=[k];for(var m=FX.de;m<=FX.ate;m++)r.push(String(f[tp][k].tot[m]||0).replace('.',','));
      linhas.push(r);
    });
  });
  var csv=linhas.map(function(r){return r.map(function(c){return '"'+c+'"'}).join(';')}).join('\n');
  var b=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'});
  var a=document.createElement('a');a.href=URL.createObjectURL(b);
  a.download='nexor-fluxo-'+FX.ano+'.csv';document.body.appendChild(a);a.click();
  setTimeout(function(){a.remove()},400);
  toast('Fluxo exportado.');
}

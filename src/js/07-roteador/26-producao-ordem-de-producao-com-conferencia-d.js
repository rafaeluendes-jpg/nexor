/* ==========================================================
   BLOCO 26 — PRODUÇÃO (ordem de produção com conferência de peso)
   ========================================================== */
var OP={aba:'hist',de:'',ate:'',itens:[],resp:'',obs:'',data:'',busca:'',verReceita:null,todos:false};

function baseProd(){
  baseMov();
  DB.ordensProd=DB.ordensProd||[];
}
function proxNumOP(){
  var n=(DB.ordensProd||[]).reduce(function(a,x){return Math.max(a,Number(x.numero)||0)},0);
  return String(n+1).padStart(4,'0');
}
/* fichas que podem ser produzidas */
/* ==========================================================
   NA PRODUCAO, O SABOR VEM PRIMEIRO

   "Todos os sabores" jogava as 42 bases junto com os 44 sabores, numa
   lista unica em ordem alfabetica — e como quase toda base comeca com
   "BASE", elas tomavam a tela inteira. Quem vai produzir procura ABACAXI
   GELATO, nao BASE ABACAXI.

   As bases continuam aqui, porque a matriz produz base de verdade
   (acucar, dextrose, leite em po, embalagem). Elas so deixaram de vir
   na frente: a lista agora sai agrupada pelo subgrupo da ficha, com os
   sabores em cima e a materia-prima embaixo.
   ========================================================== */
var ORDEM_PRODUCAO=['fs_artesanal','fs_sorbet','fs_zero_acucar',
                    'fs_recheio','fs_cascao','fs_base_gelato'];
function ordemSubProd(f){
  var i=ORDEM_PRODUCAO.indexOf(f&&f.subgrupoId);
  return i<0?ORDEM_PRODUCAO.length:i;
}
function nomeSubProd(f){
  var sg=subFicha(f&&f.subgrupoId);
  return sg?sg.nome:'Sem subgrupo';
}
function fichasProduziveis(){
  baseProd();
  return (DB.fichas||[]).filter(function(f){
    if(!(f.itens||[]).length)return false;              /* sem receita não produz */
    if(f.naProducao===false)return false;               /* desligada nesta tela */
    var c=catFicha(f.categoriaId);
    return !!(c&&/produz/i.test(c.nome||''));           /* só o grupo Produzido */
  }).sort(function(a,b){
    var d=ordemSubProd(a)-ordemSubProd(b);
    if(d)return d;
    return (a.nome||'').localeCompare(b.nome||'');
  });
}
/* o que uma receita inteira gera, já na unidade do destino */
function previstoDestino(f){
  var d=destinoDaFicha(f);
  var qtdRec=Number(f.rendimento)||0;
  if(!d)return {qtd:qtdRec,unidade:f.rendUnidade||f.unidade,destino:null};
  return {qtd:qtdNoDestino(f,qtdRec),unidade:d.unidade,destino:d};
}

/* ---------- TELA ---------- */
function telaProducao(){
  baseProd();
  if(OP.aba==='nova')return telaOPNova();
  if(!OP.de){var d=new Date();
    OP.de=new Date(d.getFullYear(),d.getMonth(),1).toISOString().slice(0,10);
    OP.ate=hojeISO();}
  var lista=(DB.ordensProd||[]).filter(function(o){
    return (!OP.de||o.data>=OP.de)&&(!OP.ate||o.data<=OP.ate);
  }).sort(function(a,b){return (b.data+b.hora).localeCompare(a.data+a.hora)});
  var prev=lista.reduce(function(a,o){return a+(Number(o.previsto)||0)},0);
  var real=lista.reduce(function(a,o){return a+(Number(o.real)||0)},0);

  $('content').innerHTML='<div class="etWrap"><div class="etScroll">'+
   '<div class="etTopo">'+
    '<div><h1>Produção</h1><p>Ordens de produção com conferência de peso e baixa automática.</p></div>'+
    '<div class="etTot">'+
     '<div class="etT"><span>Ordens</span><b>'+lista.length+'</b></div>'+
     '<div class="etT"><span>Previsto</span><b>'+fmtQt(prev)+' kg</b></div>'+
     '<div class="etT"><span>Produzido</span><b>'+fmtQt(real)+' kg</b></div>'+
     '<div class="etT dest"><span>Diferença</span><b class="'+((real-prev)>=0?'vg':'vr')+'">'+
      ((real-prev)>=0?'+':'')+fmtQt(real-prev)+' kg</b></div>'+
    '</div>'+
    '<button class="btnP2 ok" onclick="novaOP()">'+sv('plus',14)+' Nova ordem de produção</button>'+
   '</div>'+
   '<div class="etFiltros">'+
    '<div class="f2" style="max-width:150px"><label>De</label><input type="date" id="opDe" value="'+OP.de+'"></div>'+
    '<div class="f2" style="max-width:150px"><label>Até</label><input type="date" id="opAte" value="'+OP.ate+'"></div>'+
    '<button class="btnP2 ok" onclick="OP.de=$(\'opDe\').value;OP.ate=$(\'opAte\').value;telaProducao()">'+
     sv('search',13)+' Buscar</button>'+
   '</div>'+
   '<div class="etTabW plano2">'+
   (lista.length?'<table class="etTab semBusca"><thead><tr>'+
    '<th style="width:80px">Nº</th><th style="width:120px">Data</th>'+
    '<th style="width:80px;text-align:center">Sabores</th>'+
    '<th>Responsável</th>'+
    '<th style="width:110px;text-align:right">Previsto</th>'+
    '<th style="width:110px;text-align:right">Produzido</th>'+
    '<th style="width:120px;text-align:right">Diferença</th>'+
    '<th style="width:90px"></th></tr></thead><tbody>'+
    lista.map(function(o){
      var dif=Number(o.diferenca)||0;
      return '<tr style="cursor:pointer" onclick="verOP(\''+o.id+'\')">'+
      '<td><b>'+E(o.numero)+'</b></td>'+
      '<td>'+dataBR(o.data)+'<small>'+E(o.hora||'')+'</small></td>'+
      '<td style="text-align:center">'+(o.itens||[]).length+'</td>'+
      '<td>'+E(o.resp||'—')+'</td>'+
      '<td style="text-align:right">'+fmtQt(o.previsto)+' kg</td>'+
      '<td style="text-align:right"><b>'+fmtQt(o.real)+' kg</b></td>'+
      '<td style="text-align:right"><b class="'+(dif>=0?'vg':'vr')+'">'+
       (dif>0?'+':'')+fmtQt(dif)+' kg</b></td>'+
      '<td onclick="event.stopPropagation()"><div class="rowAct">'+
       '<button class="rBtn" onclick="verOP(\''+o.id+'\')" title="Ver">'+sv('eye',12)+'</button>'+
       '<button class="rBtn" onclick="imprimirOP(\''+o.id+'\')" title="Imprimir">'+sv('print2',12)+'</button>'+
       '<button class="rBtn rd" onclick="excluirOP(\''+o.id+'\')" title="Excluir ordem">'+sv('trash',12)+'</button>'+
      '</div></td></tr>';
    }).join('')+'</tbody></table>'
   :'<div class="mvVazio">'+sv('box',26)+'<b>Nenhuma ordem de produção</b>'+
    '<span>Clique em <b>Nova ordem de produção</b> para começar.</span></div>')+
   '</div></div></div>';
  rodape(lista.length+' ordens no período');
}
function novaOP(){
  OP.aba='nova';OP.itens=[];OP.resp='';OP.obs='';OP.data=hojeISO();OP.busca='';OP.verReceita=null;
  telaProducao();
}
function voltarOP(){OP.aba='hist';telaProducao();}

/* ---------- NOVA ORDEM ---------- */
function telaOPNova(){
  var q=(OP.busca||'').toLowerCase();
  var achadas=[];
  if(OP.todos)achadas=fichasProduziveis();
  else if(q.length>=2)achadas=fichasProduziveis().filter(function(f){
    return (f.nome||'').toLowerCase().indexOf(q)>=0||String(f.codigo||'').indexOf(q)>=0;
  }).slice(0,12);

  var tot=totaisOP();

  $('content').innerHTML='<div class="etWrap">'+
   '<div class="etTopo" style="flex:none">'+
    '<button class="btnP2" onclick="voltarOP()">'+sv('cr2',13)+' Voltar</button>'+
    '<div><h1>Nova ordem de produção</h1>'+
    '<p>Escolha os sabores, pese as cubas e clique em Produzir.</p></div>'+
    '<div class="etTot" id="opTotais">'+htmlTotaisOP(tot)+'</div>'+
    '<button class="btnP2 ok" onclick="confirmarProducao()">'+sv('check',14)+' Produzir</button>'+
   '</div>'+
   '<div class="etFiltros" style="flex:none">'+
    '<div class="f2" style="max-width:150px"><label>Data</label>'+
     '<input type="date" id="opData" value="'+OP.data+'" onchange="OP.data=this.value"></div>'+
    '<div class="f2" style="max-width:200px"><label>Responsável</label>'+
     '<input id="opResp" value="'+E(OP.resp)+'" placeholder="quem produziu"></div>'+
    '<div class="f2 gw2"><label>Adicionar sabor</label>'+
     '<div class="pickRow">'+
      '<input id="opBusca" value="'+E(OP.busca)+'" placeholder="digite o sabor ou clique na seta" autocomplete="off">'+
      '<button class="btnP2" onclick="OP.todos=!OP.todos;telaProducao()" title="Ver todos os sabores">'+
      sv(OP.todos?'up2':'dn',13)+'</button></div></div>'+
   '</div>'+
   (achadas.length?'<div class="opSug">'+
     (OP.todos?'<div class="opSugT">Todos os sabores — clique para adicionar'+
       '<button class="arvB" onclick="OP.todos=false;telaProducao()">'+sv('x2',12)+'</button></div>':'')+
     (function(){
      var atual=null;
      return achadas.map(function(f){
       var pd=previstoDestino(f);
       var cab='';
       /* na busca a lista e curta e vem misturada; so o "ver todos" separa */
       if(OP.todos){
         var sub=nomeSubProd(f);
         if(sub!==atual){atual=sub;cab='<div class="opSugG">'+E(sub)+'</div>';}
       }
       /* "gera 4,8 kg de BELGA GELATO" dentro do botao BELGA GELATO nao
          informa nada e dobrava a largura de cada item */
       var mesmo=pd.destino&&String(pd.destino.nome||'').toLowerCase().trim()===String(f.nome||'').toLowerCase().trim();
       return cab+'<button class="opSugIt" onclick="addSaborOP(\''+f.id+'\')">'+
       '<b>'+E(f.nome)+'</b><span>gera '+fmtQt(pd.qtd)+' '+un(pd.unidade).ab+
       (pd.destino&&!mesmo?' de '+E(pd.destino.nome):'')+'</span></button>';
      }).join('');
     })()+'</div>':'')+
   '<div class="etTabW">'+
   (OP.itens.length?'<table class="etTab opTab"><thead><tr>'+
    '<th style="width:34px"></th><th>Sabor</th>'+
    '<th style="width:120px;text-align:right">Previsto</th>'+
    '<th style="width:96px;text-align:right">Cuba 1</th>'+
    '<th style="width:96px;text-align:right">Cuba 2</th>'+
    '<th style="width:96px;text-align:right">Cuba 3</th>'+
    '<th style="width:104px;text-align:right">Total real</th>'+
    '<th style="width:118px;text-align:right">Perda / ganho</th>'+
    '<th style="width:44px"></th></tr></thead><tbody>'+
    OP.itens.map(function(it,k){
      var f=(DB.fichas||[]).find(function(x){return x.id===it.fichaId})||{};
      var tot=somaCubas(it);
      var dif=tot?(tot-(Number(it.previsto)||0)):0;
      return '<tr id="lop-'+k+'">'+
      '<td><button class="xDel" onclick="remSaborOP('+k+')">'+sv('x2',10)+'</button></td>'+
      '<td><button class="opNome" onclick="verReceitaOP('+k+')">'+E(it.nome)+
       '<span class="opVerRec">'+sv('book',11)+' modo de preparo'+
       (it.destinoNome?' · gera '+E(it.destinoNome):'')+'</span></button></td>'+
      '<td style="text-align:right">'+fmtQt(it.previsto)+' '+un(it.unidade).ab+'</td>'+
      [0,1,2].map(function(c){
        return '<td><input class="opCuba" data-k="'+k+'" data-c="'+c+'" type="number" step="0.001" '+
        'value="'+(it.cubas[c]||'')+'" placeholder="—"></td>';}).join('')+
      '<td style="text-align:right" class="opTot"><b>'+(tot?fmtQt(tot)+' '+un(it.unidade).ab:'—')+'</b></td>'+
      '<td style="text-align:right" class="opDif">'+(tot
        ?'<b class="'+(dif>=0?'vg':'vr')+'">'+(dif>0?'+':'')+fmtQt(dif)+' '+un(it.unidade).ab+'</b>'
        :'<span style="color:var(--ink-3)">—</span>')+'</td>'+
      '<td></td></tr>'+
      '';
    }).join('')+'</tbody>'+
    '<tfoot id="opRodape">'+htmlRodapeOP(tot)+'</tfoot></table>'
   :'<div class="mvVazio">'+sv('box',26)+'<b>Nenhum sabor na ordem</b>'+
    '<span>Use o campo <b>Adicionar sabor</b> acima para montar a produção do dia.</span></div>')+
   '</div>'+
   '<div class="opRod">'+
    '<div class="f2" style="flex:1"><label>Observação</label>'+
     '<input id="opObs" value="'+E(OP.obs)+'" placeholder="observação da produção"></div>'+
   '</div></div>';
  ligarOP();
}
/* soma separada por unidade: kg com kg, unidade com unidade */
function totaisOP(){
  var por={};
  (OP.itens||[]).forEach(function(it){
    var u=it.unidade||'kg';
    por[u]=por[u]||{prev:0,real:0};
    por[u].prev+=Number(it.previsto)||0;
    por[u].real+=somaCubas(it);
  });
  return por;
}
function htmlTotaisOP(t){
  var ks=Object.keys(t);
  if(!ks.length)return '<div class="etT"><span>Previsto</span><b>—</b></div>';
  return ks.map(function(u){
    var d=t[u].real-t[u].prev;
    return '<div class="etT"><span>Previsto ('+un(u).ab+')</span><b>'+fmtQt(t[u].prev)+'</b></div>'+
    '<div class="etT"><span>Produzido</span><b>'+fmtQt(t[u].real)+'</b></div>'+
    '<div class="etT dest"><span>Diferença</span><b class="'+(d>=0?'vg':'vr')+'">'+
     (d>0?'+':'')+fmtQt(d)+' '+un(u).ab+'</b></div>';
  }).join('');
}
function htmlRodapeOP(t){
  return Object.keys(t).map(function(u){
    var d=t[u].real-t[u].prev;
    return '<tr><td colspan="2"><b>Total em '+un(u).n.toLowerCase()+'</b></td>'+
    '<td style="text-align:right"><b>'+fmtQt(t[u].prev)+' '+un(u).ab+'</b></td>'+
    '<td colspan="3"></td>'+
    '<td style="text-align:right"><b>'+fmtQt(t[u].real)+' '+un(u).ab+'</b></td>'+
    '<td style="text-align:right"><b class="'+(d>=0?'vg':'vr')+'">'+
     (d>0?'+':'')+fmtQt(d)+' '+un(u).ab+'</b></td><td></td></tr>';
  }).join('');
}
function somaCubas(it){
  return (it.cubas||[]).reduce(function(a,c){return a+(parseFloat(c)||0)},0);
}
function ligarOP(){
  var b=$('opBusca');
  if(b){
    b.oninput=function(){OP.busca=this.value;var p=this.selectionStart;telaProducao();
      var n=$('opBusca');if(n){n.focus();n.setSelectionRange(p,p);}};
  }
  var r=$('opResp'); if(r)r.oninput=function(){OP.resp=this.value};
  var o=$('opObs');  if(o)o.oninput=function(){OP.obs=this.value};
  var cs=document.querySelectorAll('.opCuba');
  for(var i=0;i<cs.length;i++){
    cs[i].oninput=function(){
      var k=this.getAttribute('data-k'),c=this.getAttribute('data-c');
      OP.itens[k].cubas[c]=this.value;
      atualizaLinhaOP(k);
    };
    cs[i].onkeydown=function(e){
      if(e.key==='Enter'){
        e.preventDefault();
        var todos=document.querySelectorAll('.opCuba');
        for(var z=0;z<todos.length;z++)if(todos[z]===this&&todos[z+1]){todos[z+1].focus();todos[z+1].select();break;}
      }
    };
  }
}
function atualizaLinhaOP(k){
  var it=OP.itens[k];
  var tr=document.getElementById('lop-'+k);
  if(!tr)return;
  var tot=somaCubas(it);
  var dif=tot?(tot-(Number(it.previsto)||0)):0;
  var ct=tr.querySelector('.opTot'),cd=tr.querySelector('.opDif');
  if(ct)ct.innerHTML='<b>'+(tot?fmtQt(tot)+' '+un(it.unidade).ab:'—')+'</b>';
  if(cd)cd.innerHTML=tot?('<b class="'+(dif>=0?'vg':'vr')+'">'+(dif>0?'+':'')+fmtQt(dif)+' '+un(it.unidade).ab+'</b>')
    :'<span style="color:var(--ink-3)">—</span>';
  atualizaTotaisOP();
}
function atualizaTotaisOP(){
  var t=totaisOP();
  var box=document.getElementById('opTotais');
  if(box)box.innerHTML=htmlTotaisOP(t);
  var tf=document.getElementById('opRodape');
  if(tf)tf.innerHTML=htmlRodapeOP(t);
}
function addSaborOP(fid){
  var f=(DB.fichas||[]).find(function(x){return x.id===fid});
  if(!f)return;
  var p=previstoDestino(f);
  OP.itens.push({fichaId:f.id,nome:f.nome,previsto:p.qtd,unidade:p.unidade,
    destinoNome:p.destino?p.destino.nome:'',qtdReceita:Number(f.rendimento)||0,
    unReceita:f.rendUnidade||f.unidade,cubas:['','','']});
  OP.busca='';OP.todos=false;
  telaProducao();
}
function remSaborOP(k){OP.itens.splice(k,1);if(OP.verReceita===k)OP.verReceita=null;telaProducao();}
/* ==========================================================
   MODO DE PREPARO EM JANELA, NAO DENTRO DA TABELA
   A receita era uma linha expandida DENTRO da tabela de producao: fonte de
   12px, altura travada em 340px, e ainda por cima dentro de uma area que ja
   rolava — com o cabecalho fixo comendo espaco. Quem esta na cozinha, com a
   maquina ligada, precisa ler de longe e sem procurar.
   Agora abre em janela propria: texto grande, passo a passo separado por
   linha, e os ingredientes ja na QUANTIDADE DA PRODUCAO do dia (a ficha
   rende X, a ordem pede Y — quem produz nao deveria ter de fazer essa regra
   de tres de cabeca).
   ========================================================== */
function verReceitaOP(k){
  var it=(OP.itens||[])[k]; if(!it)return;
  var f=(DB.fichas||[]).find(function(x){return x.id===it.fichaId})||{};
  var rend=Number(f.rendimento)||0;
  var prev=Number(it.previsto)||0;
  var fator=(rend>0&&prev>0)?(prev/rend):1;
  var passos=String(f.receita||'').split(/\r?\n/).filter(function(l){return l.trim()!==''});

  var ings=(f.itens||[]).map(function(ci){
    var i2=itemComp(ci.insumoId)||{};
    var q=(Number(ci.qtd)||0)*fator;
    return '<li><b>'+fmtQt(q)+' '+un(ci.unidade).ab+'</b><span>'+E(i2.nome||'')+'</span></li>';
  }).join('');

  /* ==========================================================
     A RECEITA APARECE COMO FOI ESCRITA

     Antes o sistema pegava TODA linha nao vazia e jogava numa lista
     numerada. Resultado: "INGREDIENTES:" virava o passo 2 e "PASSO A
     PASSO:" virava o passo 5 — titulos contados como instrucao, e a
     numeracao propria de quem escreveu ganhando uma segunda por cima.
     Quem digitou a receita ja decidiu a ordem, os marcadores e os
     titulos. O sistema nao tem o que melhorar nisso: exibe como esta,
     em fonte grande, respeitando as quebras de linha.
     ========================================================== */
  var receita=String(f.receita||'');

  var h='<div class="recJan">'+
   '<div class="recH"><div><b>'+E(it.nome)+'</b>'+
    '<span>'+fmtQt(prev)+' '+un(it.unidade).ab+
    (fator!==1&&rend?' · receita rende '+fmtQt(rend)+' '+un(f.unidade||it.unidade).ab:'')+
    '</span></div>'+
    '<button class="recX" onclick="fecharRecOP()">'+sv('x2',16)+'</button></div>'+
   '<div class="recCorpo">'+
    '<div class="recCol">'+
     '<div class="recLado">'+
      (ings?'<div class="recIng"><h4>Ingredientes'+
        (fator!==1?' <em>já na quantidade desta produção</em>':'')+'</h4><ul>'+ings+'</ul></div>':'')+
      (f.foto?'<div class="recFoto"><img src="'+f.foto+'" alt=""></div>':'')+
     '</div>'+
     '<div class="recPasso"><h4>Modo de preparo</h4>'+
      (receita.trim()
        ? '<div class="recTxt">'+E(receita)+'</div>'
        : '<p class="recVaz">Esta ficha ainda não tem o modo de preparo cadastrado.</p>')+
     '</div>'+
    '</div>'+
   '</div></div>';
  var ov=document.createElement('div');
  ov.className='mdOv recOv'; ov.id='recOv'; ov.innerHTML=h;
  ov.onclick=function(e){ if(e.target===ov)fecharRecOP(); };
  document.body.appendChild(ov);
}
function fecharRecOP(){ var o=document.getElementById('recOv'); if(o)o.remove(); }

/* ---------- PRODUZIR ---------- */
async function confirmarProducao(){
  baseProd();
  if(!OP.itens.length){toast('Adicione ao menos um sabor.');return;}
  /* antes de qualquer coisa: da para produzir tudo com o estoque que existe? */
  var _prevItens=OP.itens.map(function(it){
    return {tipo:'ficha',refId:it.fichaId,
      qtd:Number(it.qtdReceita)||Number(it.previsto)||0,
      unidade:it.unReceita||it.unidade,custo:0};
  });
  var _falta=faltaEstoque(montarLinhas(_prevItens,'producao'));
  if(_falta.length){
    alert(avisoFalta(_falta,'esta ordem de produção'));
    return;
  }
  var semPeso=OP.itens.filter(function(it){return !somaCubas(it)});
  if(semPeso.length){
    var seguir=await confirmar({
      titulo:'Sabores sem peso informado',
      texto:semPeso.length+' sabor(es) estão sem a pesagem das cubas.',
      aviso:'Eles serão produzidos pelo peso previsto, sem registrar perda ou ganho.',
      ok:'Continuar',tipo:'pergunta'});
    if(!seguir)return;
  }

  var tt=totaisOP();
  var prev=0,real=0,dif=0;
  var linhasRes=Object.keys(tt).map(function(u){
    var d=tt[u].real-tt[u].prev;
    prev+=tt[u].prev;real+=tt[u].real;dif+=d;
    return 'Previsto '+fmtQt(tt[u].prev)+' '+un(u).ab+
      ' · Produzido '+fmtQt(tt[u].real)+' '+un(u).ab+
      (Math.abs(d)>0.0001?(d>0?'  (ganho de ':'  (perda de ')+fmtQt(Math.abs(d))+' '+un(u).ab+')':'');
  }).join('\n');
  dif=+dif.toFixed(3);

  var linhasC=[];
  Object.keys(tt).forEach(function(u){
    var d3=tt[u].real-tt[u].prev;
    linhasC.push(['Previsto',fmtQt(tt[u].prev)+' '+un(u).ab,'']);
    linhasC.push(['Produzido',fmtQt(tt[u].real)+' '+un(u).ab,'']);
    if(Math.abs(d3)>0.0001)
      linhasC.push([d3>0?'Ganho':'Perda',(d3>0?'+':'')+fmtQt(d3)+' '+un(u).ab,d3>0?'vg':'vr']);
  });
  var destinos={};
  OP.itens.forEach(function(it){ if(it.destinoNome)destinos[it.destinoNome]=true; });
  var nomesD=Object.keys(destinos);
  var ok=await confirmar({
    titulo:'Confirmar a produção',
    texto:OP.itens.length+' item(ns) nesta ordem. Os ingredientes das receitas serão baixados '+
      'do estoque'+(nomesD.length?' e o produto acabado entrará em '+nomesD.join(', '):'')+'.',
    linhas:linhasC,
    aviso:(function(){
      var d4=Object.keys(tt).map(function(u){return tt[u].real-tt[u].prev;})
        .reduce(function(a,b){return a+Math.abs(b)},0);
      return d4>0.0001?'A diferença entre o previsto e o pesado será lançada como '+
        '<b>perda</b> ou <b>ganho de produção</b> na movimentação de estoque.':'';
    })(),
    ok:'Produzir',tipo:'check'
  });
  if(!ok)return;

  /* 1) a produção em si — baixa ingredientes e gera o destino, pelo previsto */
  var itensMov=OP.itens.map(function(it){
    return {tipo:'ficha',refId:it.fichaId,
      qtd:Number(it.qtdReceita)||Number(it.previsto)||0,
      unidade:it.unReceita||it.unidade,custo:0};
  });
  var linhas=montarLinhas(itensMov,'producao');
  var mv=null;
  if(linhas.length){
    mv={id:uid('mv'),data:OP.data||hojeISO(),hora:agoraHM(),motivoId:motivoProduzir(),
      identificacao:'OP '+proxNumOP(),obs:OP.resp||'',linhas:linhas,origem:'producao'};
    DB.movEst.push(mv);
    aplicarMovimento(mv);
  }

  /* 2) a diferença por sabor vira perda ou ganho no destino */
  var ajuste=[];
  OP.itens.forEach(function(it){
    var tot=somaCubas(it);
    if(!tot)return;
    var d=+(tot-(Number(it.previsto)||0)).toFixed(4);
    if(Math.abs(d)<0.0001)return;
    var f=(DB.fichas||[]).find(function(x){return x.id===it.fichaId});
    var dest=f?destinoDaFicha(f):null;
    if(!dest)return;
    ajuste.push({insumoId:dest.id,nome:dest.nome,unidade:it.unidade,qtd:Math.abs(d),
      custo:custoDoItem(dest),direcao:(d>0?'entrada':'saida'),
      origem:'producao-ajuste',fichaNome:it.nome});
  });
  if(ajuste.length){
    var perdas=ajuste.filter(function(l){return l.direcao==='saida'});
    var ganhos=ajuste.filter(function(l){return l.direcao==='entrada'});
    [[perdas,'mv_perdaprod'],[ganhos,'mv_ganhoprod']].forEach(function(par){
      if(!par[0].length)return;
      var m2={id:uid('mv'),data:OP.data||hojeISO(),hora:agoraHM(),motivoId:par[1],
        identificacao:'OP '+proxNumOP(),obs:'diferença de pesagem',linhas:par[0],origem:'producao'};
      DB.movEst.push(m2);
      aplicarMovimento(m2);
    });
  }

  /* 3) grava a ordem */
  var op={id:uid('op'),numero:proxNumOP(),data:OP.data||hojeISO(),hora:agoraHM(),
    resp:OP.resp||'',obs:OP.obs||'',previsto:+prev.toFixed(3),real:+real.toFixed(3),
    diferenca:dif,movId:mv?mv.id:'',
    itens:OP.itens.map(function(it){
      var tot=somaCubas(it);
      return {fichaId:it.fichaId,nome:it.nome,previsto:Number(it.previsto)||0,
        cubas:(it.cubas||[]).map(function(c){return parseFloat(c)||0}),
        real:+tot.toFixed(3),diferenca:tot?+(tot-(Number(it.previsto)||0)).toFixed(3):0};
    })};
  DB.ordensProd.push(op);
  salvar();
  OP.aba='hist';OP.itens=[];
  telaProducao();
  toast('Produção registrada — ordem '+op.numero+'.');
  setTimeout(function(){verOP(op.id)},400);
}
function motivoProduzir(){
  var m=(DB.motivosMov||[]).find(function(x){return x.tipo==='producao'&&x.ativo!==false});
  if(m)return m.id;
  DB.motivosMov.push({id:'mv_prod',nome:'Produzir',tipo:'producao',sistema:true,ativo:true,lojas:[]});
  return 'mv_prod';
}

/* ---------- VER E IMPRIMIR ---------- */
function verOP(id){
  var o=(DB.ordensProd||[]).find(function(x){return x.id===id});
  if(!o)return;
  var h='<div class="mdB">'+
  '<div class="acKpis">'+
   '<div class="acK"><span>Sabores</span><b>'+(o.itens||[]).length+'</b></div>'+
   '<div class="acK"><span>Previsto</span><b>'+fmtQt(o.previsto)+' kg</b></div>'+
   '<div class="acK"><span>Produzido</span><b>'+fmtQt(o.real)+' kg</b></div>'+
   '<div class="acK dest3"><span>Diferença</span><b class="'+((o.diferenca||0)>=0?'vg':'vr')+'">'+
    ((o.diferenca||0)>0?'+':'')+fmtQt(o.diferenca)+' kg</b></div>'+
  '</div>'+
  '<div class="blk" style="margin:0;max-width:none;padding:0;overflow:hidden">'+
   '<div class="acTit">Ordem '+E(o.numero)+' · '+dataBR(o.data)+' '+E(o.hora||'')+
    (o.resp?' · '+E(o.resp):'')+'</div>'+
   '<div class="acTabW" style="max-height:340px"><table class="acTab"><thead><tr>'+
    '<th>Sabor</th><th style="width:96px;text-align:right">Previsto</th>'+
    '<th style="width:160px;text-align:right">Cubas</th>'+
    '<th style="width:96px;text-align:right">Real</th>'+
    '<th style="width:110px;text-align:right">Diferença</th></tr></thead><tbody>'+
    (o.itens||[]).map(function(it){
      return '<tr><td><b>'+E(it.nome)+'</b></td>'+
      '<td style="text-align:right">'+fmtQt(it.previsto)+' kg</td>'+
      '<td style="text-align:right;color:var(--ink-3)">'+
       (it.cubas||[]).filter(function(c){return c}).map(function(c){return fmtQt(c)}).join(' + ')+'</td>'+
      '<td style="text-align:right"><b>'+fmtQt(it.real)+' kg</b></td>'+
      '<td style="text-align:right"><b class="'+((it.diferenca||0)>=0?'vg':'vr')+'">'+
       ((it.diferenca||0)>0?'+':'')+fmtQt(it.diferenca)+' kg</b></td></tr>';
    }).join('')+'</tbody></table></div></div>'+
   (o.obs?'<div class="hint" style="margin-top:10px">Obs.: '+E(o.obs)+'</div>':'')+
  '</div>';
  var ov=document.createElement('div');ov.className='mdOv';ov.id='mdOv';
  ov.innerHTML='<div class="mdBox xl"><div class="mdH"><b>Ordem de produção</b>'+
   '<button onclick="fecharModal()">&times;</button></div>'+h+
   '<div class="mdF"><button class="btnP2" onclick="fecharModal()">Fechar</button>'+
   '<button class="btnP2 ok" onclick="imprimirOP(\''+o.id+'\')">'+sv('print2',13)+' Imprimir / PDF</button></div></div>';
  document.body.appendChild(ov);
  fecharSoForaDeVerdade(ov);
}
/* ==========================================================
   EXCLUIR UMA ORDEM DE PRODUCAO
   A ordem nao e so um registro: ela JA MEXEU no estoque. Produzir consome
   os ingredientes da ficha e da entrada no item produzido, e a diferenca de
   pesagem gera um segundo movimento de perda ou ganho.
   Apagar so a ordem deixaria o estoque com uma producao que ninguem mais
   consegue explicar — e o Estoque Total e a Movimentacao de Mercadoria
   continuariam mostrando o resultado dela para sempre.
   Por isso aqui se desfaz na ordem inversa: primeiro os movimentos (com
   aplicarMovimento(m,true), que devolve o que foi tirado e tira o que foi
   posto), depois a ordem.
   Os movimentos da ordem sao dois tipos: o principal, guardado em movId, e
   os de ajuste de pesagem, que carregam a identificacao "OP <numero>".
   ========================================================== */
async function excluirOP(id){
  var o=(DB.ordensProd||[]).find(function(x){return x.id===id});
  if(!o)return;
  var marca='OP '+o.numero;
  var movs=(DB.movEst||[]).filter(function(m){
    return (o.movId&&m.id===o.movId)||
           (m.origem==='producao'&&String(m.identificacao||'')===marca);
  });
  var ok=await confirmar({
    titulo:'Excluir a ordem '+o.numero+'?',
    texto:'O estoque volta ao que era antes desta produção.',
    linhas:[['Produzido',fmtQt(o.real)+' kg',''],
            ['Movimentos a desfazer',String(movs.length),''],
            ['Depois disso','não tem como refazer pela tela','']],
    aviso:'Os ingredientes consumidos <b>voltam ao estoque</b> e o que foi '+
          'produzido <b>sai</b>. Se já houve venda do que foi produzido, o '+
          'saldo pode ficar negativo — confira antes.',
    ok:'Excluir ordem', tipo:'perigo'
  });
  if(!ok)return;
  movs.forEach(function(m){
    try{ aplicarMovimento(m,true); }catch(e){ _quieto(e,'excluirOP'); }
  });
  var ids={}; movs.forEach(function(m){ids[m.id]=true});
  DB.movEst=(DB.movEst||[]).filter(function(m){return !ids[m.id]});
  DB.ordensProd=(DB.ordensProd||[]).filter(function(x){return x.id!==id});
  salvar(); telaProducao();
  toast('Ordem '+o.numero+' excluída. Estoque desfeito ('+movs.length+' movimento(s)).');
}
function imprimirOP(id){
  var o=(DB.ordensProd||[]).find(function(x){return x.id===id});
  if(!o)return;
  var el=document.getElementById('viaImp')||document.createElement('div');
  el.id='viaImp';
  el.innerHTML=
  '<div style="text-align:center;border-bottom:2px solid #000;padding-bottom:6px;margin-bottom:10px">'+
   '<b style="font-size:16px">ORDEM DE PRODUÇÃO Nº '+E(o.numero)+'</b><br>'+
   '<span style="font-size:12px">'+dataBR(o.data)+' '+E(o.hora||'')+
   (o.resp?' · Responsável: '+E(o.resp):'')+'</span></div>'+
  '<table style="width:100%;font-size:11px;border-collapse:collapse">'+
   '<tr style="border-bottom:1px solid #000"><th align="left">Sabor</th>'+
   '<th align="right">Previsto</th><th align="right">Cubas</th>'+
   '<th align="right">Real</th><th align="right">Dif.</th></tr>'+
   (o.itens||[]).map(function(it){
     return '<tr><td>'+E(it.nome)+'</td>'+
     '<td align="right">'+fmtQt(it.previsto)+' kg</td>'+
     '<td align="right">'+(it.cubas||[]).filter(function(c){return c}).map(function(c){return fmtQt(c)}).join(' + ')+'</td>'+
     '<td align="right">'+fmtQt(it.real)+' kg</td>'+
     '<td align="right">'+((it.diferenca||0)>0?'+':'')+fmtQt(it.diferenca)+'</td></tr>';
   }).join('')+
   '<tr style="border-top:1px solid #000"><td><b>TOTAL</b></td>'+
   '<td align="right"><b>'+fmtQt(o.previsto)+' kg</b></td><td></td>'+
   '<td align="right"><b>'+fmtQt(o.real)+' kg</b></td>'+
   '<td align="right"><b>'+((o.diferenca||0)>0?'+':'')+fmtQt(o.diferenca)+'</b></td></tr>'+
  '</table>'+
  (o.obs?'<div style="font-size:11px;margin-top:8px"><b>Obs.:</b> '+E(o.obs)+'</div>':'')+
  '<div style="margin-top:26px;font-size:11px">Conferido por: ____________________________</div>';
  document.body.appendChild(el);
  setTimeout(function(){window.print()},200);
}

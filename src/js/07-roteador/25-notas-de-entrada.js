/* ==========================================================
   BLOCO 25 — NOTAS DE ENTRADA
   ========================================================== */
var NT={de:'',ate:'',fornec:'',busca:''};
var _nota=null;

function baseNotas(){
  baseMov();baseForn();baseCat();baseFormas();
  DB.lancFin=DB.lancFin||[];
  DB.notas=DB.notas||[];
  if(!DB.motivosMov.some(function(m){return m.id==='mv_nota'}))
    DB.motivosMov.push({id:'mv_nota',nome:'Entrada por nota fiscal',tipo:'entrada',
      sistema:true,ativo:true,lojas:[]});
}
function proxNumNota(){
  var n=(DB.notas||[]).reduce(function(a,x){return Math.max(a,Number(x.numero)||0)},0);
  return String(n+1);
}

/* ---------- TELA / RELATÓRIO ---------- */
function telaNotas(){
  baseNotas();
  if(!NT.de){var d=new Date();
    NT.de=new Date(d.getFullYear(),d.getMonth(),1).toISOString().slice(0,10);
    NT.ate=hojeISO();}
  var lista=(DB.notas||[]).filter(function(n){
    if(NT.de&&n.data<NT.de)return false;
    if(NT.ate&&n.data>NT.ate)return false;
    if(NT.fornec&&n.fornecedorId!==NT.fornec)return false;
    if(NT.busca){
      var q=NT.busca.toLowerCase();
      if((n.fornecedorNome||'').toLowerCase().indexOf(q)<0&&String(n.numero||'').indexOf(q)<0)return false;
    }
    return true;
  }).sort(function(a,b){return (b.data+b.hora).localeCompare(a.data+a.hora)});
  var total=lista.reduce(function(a,n){return a+(Number(n.valorTotal)||0)},0);
  var itens=lista.reduce(function(a,n){return a+(n.itens||[]).length},0);

  $('content').innerHTML='<div class="ntWrap">'+
   '<div class="ntTopo">'+
    '<button class="btnMais" onclick="novaNota()">'+sv('plus',20)+'</button>'+
    '<h1>Notas de Entrada</h1>'+
    '<div style="flex:1"></div>'+
    '<button class="btnP2" onclick="exportarNotas()">'+sv('down2',13)+' Exportar</button>'+
   '</div>'+
   '<div class="ntBody">'+
    '<aside class="ntPane">'+
     '<div class="ftPaneH">Filtros</div>'+
     '<div class="ftPaneB">'+
      '<div class="cbData"><label>Data inicial</label><input type="date" id="ntDe" value="'+NT.de+'"></div>'+
      '<div class="cbData"><label>Data final</label><input type="date" id="ntAte" value="'+NT.ate+'"></div>'+
      '<div class="cbData"><label>Fornecedor</label><select id="ntF">'+
       '<option value="">Todos</option>'+
       (DB.fornec||[]).map(function(f){return '<option value="'+f.id+'"'+(NT.fornec===f.id?' selected':'')+'>'+E(f.empresa)+'</option>'}).join('')+
      '</select></div>'+
      '<div class="cbData"><label>Buscar</label><input id="ntB" value="'+E(NT.busca)+'" placeholder="fornecedor ou nº"></div>'+
      '<div class="cbAtalhos">'+
       '<button onclick="perNota(0)">Este mês</button>'+
       '<button onclick="perNota(-1)">Mês anterior</button>'+
       '<button onclick="perNota(-3)">3 meses</button>'+
      '</div>'+
      '<button class="btnP2 ok" style="width:100%;justify-content:center;margin-top:12px" onclick="buscarNotas()">Ok</button>'+
      '<div class="ntResumo">'+
       '<div><span>Notas</span><b>'+lista.length+'</b></div>'+
       '<div><span>Itens</span><b>'+itens+'</b></div>'+
       '<div class="dest5"><span>Total comprado</span><b>R$ '+money(total)+'</b></div>'+
      '</div>'+
     '</div></aside>'+
    '<div class="ntMain">'+
     '<div class="ntTabW">'+
     (lista.length?'<table class="etTab semBusca"><thead><tr>'+
      '<th style="width:80px">Nº</th><th style="width:104px">Data</th>'+
      '<th>Fornecedor</th>'+
      '<th style="width:80px;text-align:center">Itens</th>'+
      '<th style="width:130px;text-align:right">Mercadorias</th>'+
      '<th style="width:130px;text-align:right">Total da nota</th>'+
      '<th style="width:120px">Pagamento</th>'+
      '<th style="width:90px"></th></tr></thead><tbody>'+
      lista.map(function(n){
        return '<tr style="cursor:pointer" onclick="verNota(\''+n.id+'\')">'+
        '<td><b>'+E(n.numero)+'</b></td>'+
        '<td>'+dataBR(n.data)+'<small>'+E(n.hora||'')+'</small></td>'+
        '<td><b>'+E(n.fornecedorNome||'—')+'</b></td>'+
        '<td style="text-align:center">'+(n.itens||[]).length+'</td>'+
        '<td style="text-align:right">R$ '+money(n.valorMercadorias)+'</td>'+
        '<td style="text-align:right"><b>R$ '+money(n.valorTotal)+'</b></td>'+
        '<td>'+E((n.pagamento&&n.pagamento.tipo)||'—')+
         (n.pagamento&&n.pagamento.parcelas>1?' '+n.pagamento.parcelas+'x':'')+'</td>'+
        '<td onclick="event.stopPropagation()"><div class="rowAct">'+
         '<button class="rBtn" onclick="verNota(\''+n.id+'\')" title="Ver">'+sv('eye',12)+'</button>'+
         '<button class="rBtn rd" onclick="excluirNota(\''+n.id+'\')" title="Excluir">'+sv('trash',12)+'</button>'+
        '</div></td></tr>';
      }).join('')+'</tbody>'+
      '<tfoot><tr><td colspan="5"><b>'+lista.length+' nota(s)</b></td>'+
      '<td style="text-align:right"><b>R$ '+money(total)+'</b></td><td colspan="2"></td></tr></tfoot></table>'
     :'<div class="mvVazio">'+sv('box',26)+'<b>Nenhuma nota no período</b>'+
      '<span>Clique no <b>+</b> para lançar uma nota de entrada.</span></div>')+
     '</div></div></div></div>';
  $('ntB').oninput=function(){NT.busca=this.value};
  $('ntB').onkeydown=function(e){if(e.key==='Enter')buscarNotas()};
  rodape(lista.length+' notas no período');
}
function buscarNotas(){
  NT.de=$('ntDe').value;NT.ate=$('ntAte').value;NT.fornec=$('ntF').value;telaNotas();
}
function perNota(n){
  var d=new Date();
  var a=new Date(d.getFullYear(),d.getMonth()+(n<0?n:0),1);
  var b=new Date(d.getFullYear(),d.getMonth()+(n<0?n+1:1),0);
  if(n===-3){a=new Date(d.getFullYear(),d.getMonth()-2,1);b=new Date(d.getFullYear(),d.getMonth()+1,0);}
  NT.de=a.toISOString().slice(0,10);NT.ate=b.toISOString().slice(0,10);telaNotas();
}

/* ---------- JANELA DE LANÇAMENTO ---------- */
function novaNota(){
  baseNotas();
  _nota={id:null,numero:proxNumNota(),fornecedorId:'',fornecedorNome:'',
    data:hojeISO(),hora:agoraHM(),itens:[],obs:''};
  desenhaNota();
}
function desenhaNota(){
  var n=_nota;
  var merc=(n.itens||[]).reduce(function(a,i){return a+(Number(i.total)||0)},0);
  var h='<div class="ntMod">'+
   '<div class="ntH"><div><b>Itens de Compra</b><span>Nota de entrada · '+E(nomeLojaAtual())+'</span></div>'+
    '<button onclick="fecharNota()">&times;</button></div>'+
   '<div class="ntCab">'+
    '<div class="f2" style="flex:2;min-width:220px"><label>Fornecedor *</label>'+
     '<div class="pickRow"><select id="ntFor">'+
      '<option value="">Selecione o fornecedor</option>'+
      (DB.fornec||[]).map(function(f){return '<option value="'+f.id+'"'+(n.fornecedorId===f.id?' selected':'')+'>'+E(f.empresa)+'</option>'}).join('')+
     '</select><button class="btnP2" onclick="modalForn()" title="Cadastrar">'+sv('plus',12)+'</button></div></div>'+
    '<div class="f2" style="max-width:120px"><label>Nº da nota</label><input id="ntNum" value="'+E(n.numero)+'"></div>'+
    '<div class="f2" style="max-width:150px"><label>Data</label><input type="date" id="ntData" value="'+n.data+'"></div>'+
   '</div>'+
   '<div class="ntLinha">'+
    '<div class="f2 ntMercBox" style="flex:2;min-width:210px"><label>Mercadoria</label>'+
     '<div class="pickRow">'+
      '<input id="ntItNome" placeholder="digite o nome ou código" autocomplete="off" '+
       'value="'+E(_itemSel?_itemSel.nome:'')+'">'+
      '<button class="btnP2" onclick="abrirSelMerc()">'+sv('search',12)+'</button></div>'+
     '<div class="ntSug" id="ntSug" style="display:none"></div></div>'+
    '<div class="f2" style="max-width:96px"><label>Un.</label>'+
     '<input id="ntItUn" value="'+(_itemSel?un(_itemSel.unidade).ab:'')+'" disabled style="background:var(--alt)"></div>'+
    '<div class="f2" style="max-width:110px"><label>Qtd.</label>'+
     '<input id="ntItQt" type="number" step="0.001" value=""></div>'+
    '<div class="f2" style="max-width:120px"><label>Valor un.</label>'+
     /* ==========================================================
        ESTE CAMPO NAO USA O COMPONENTE DE DINHEIRO — DE PROPOSITO

        O custo de insumo tem QUATRO casas decimais (`step="0.0001"`).
        Farinha a R$ 0,0043 o grama e valor normal aqui, e e este numero
        que alimenta a media ponderada do custo — que por sua vez
        alimenta a ficha tecnica e o CMV.

        `moedaFmt` arredonda para duas casas. Passar este campo pelo
        componente truncaria R$ 0,0043 para R$ 0,00 e o custo do insumo
        iria a zero em silencio — exatamente o tipo de estrago que este
        arquivo ja documentou dez vezes.

        Quando o componente ganhar casas configuraveis, este campo
        migra. Ate la, fica como esta e o motivo fica escrito.
        ========================================================== */
     '<div class="cur"><span>R$</span><input id="ntItVl" type="number" step="0.0001" value="'+
      (_itemSel?custoAtual(_itemSel):'')+'"></div></div>'+
    '<div class="f2" style="max-width:110px"><label>Desconto</label>'+
     '<div class="cur"><span>R$</span><input type="text" inputmode="decimal" autocomplete="off" placeholder="0,00" class="moeda" id="ntItDs" value=""></div></div>'+
    '<div class="f2" style="max-width:130px"><label>Total</label>'+
     '<div class="cur"><span>R$</span><input id="ntItTt" value="0,00" disabled style="background:var(--alt)"></div></div>'+
    '<button class="btnP2 ok" style="height:30px" onclick="addItemNota()">Ok</button>'+
   '</div>'+
   '<div class="ntItens">'+
    '<table class="fmTab"><thead><tr>'+
     '<th style="width:30px"></th><th style="width:80px">Código</th><th>Mercadoria</th>'+
     '<th style="width:96px;text-align:right">QTD</th>'+
     '<th style="width:70px">Un.</th>'+
     '<th style="width:110px;text-align:right">Valor un.</th>'+
     '<th style="width:96px;text-align:right">Desc.</th>'+
     '<th style="width:110px;text-align:right">Valor item</th>'+
     '<th style="width:96px">NCM</th></tr></thead><tbody>'+
    ((n.itens||[]).length?n.itens.map(function(it,k){
      var i2=insumo(it.insumoId)||{};
      return '<tr><td><button class="xDel" onclick="remItemNota('+k+')">'+sv('x2',10)+'</button></td>'+
      '<td>'+E(i2.codigo||'—')+'</td><td><b>'+E(it.nome)+'</b></td>'+
      '<td style="text-align:right">'+fmtQt(it.qtd)+'</td>'+
      '<td>'+un(it.unidade).ab+'</td>'+
      '<td style="text-align:right">'+money(it.valorUn)+'</td>'+
      '<td style="text-align:right">'+(it.desconto?money(it.desconto):'—')+'</td>'+
      '<td style="text-align:right"><b>'+money(it.total)+'</b></td>'+
      '<td>'+E(it.ncm||'—')+'</td></tr>';
    }).join('')
    :'<tr><td colspan="9" class="fmVazio">'+sv('box',22)+'<b>Nenhum item lançado</b>'+
     '<span>Busque a mercadoria acima, informe quantidade e valor e clique em Ok.</span></td></tr>')+
    '</tbody></table></div>'+
   '<div class="ntRod">'+
    '<span class="ntDica">'+sv('help',13)+' A entrada no estoque segue o cadastro de cada item '+
    '(campo <b>Controla estoque</b> no ingrediente).</span>'+
    '<div style="flex:1"></div>'+
    '<div class="ntTot"><span>Valor mercadorias</span><b>R$ '+money(merc)+'</b></div>'+
    '<div class="ntTot dest6"><span>Valor total da nota</span><b>R$ '+money(merc)+'</b></div>'+
   '</div>'+
   '<div class="ntF"><button class="btnP2" onclick="fecharNota()">Cancelar</button>'+
    '<button class="btnP2 ok" onclick="confirmarNota()">Confirmar</button></div>'+
  '</div>';
  var o=document.getElementById('mdOv');if(o)o.remove();
  var ov=document.createElement('div');ov.className='mdOv ntOv';ov.id='mdOv';
  ov.innerHTML=h;
  document.body.appendChild(ov);
  ligarLinhaNota();
}
var _itemSel=null;
/* ---- digitar o nome da mercadoria direto na linha ---- */
function sugereMerc(txt){
  var cx=$('ntSug');if(!cx)return;
  var q=String(txt||'').trim().toLowerCase();
  if(_itemSel&&(_itemSel.nome||'').toLowerCase()!==q){_itemSel=null;pintaLinhaMerc();}
  if(q.length<1){cx.style.display='none';cx.innerHTML='';return;}
  var lista=(DB.insumos||[]).filter(function(i){
    return (i.nome||'').toLowerCase().indexOf(q)>=0||String(i.codigo||'').indexOf(q)>=0;
  }).sort(function(a,b){return (a.nome||'').localeCompare(b.nome||'')}).slice(0,14);
  if(!lista.length){
    cx.innerHTML='<div class="sgVaz">nenhuma mercadoria com esse nome</div>';
    cx.style.display='block';return;
  }
  cx.innerHTML=lista.map(function(i,k){
    return '<div class="sgIt'+(k===0?' on':'')+'" onmousedown="escolherMercTexto(\''+i.id+'\')">'+
      '<b>'+E(i.nome)+'</b><span>'+E(i.codigo||'')+' · '+un(i.unidade).ab+
      ' · R$ '+money(custoAtual(i))+'</span></div>';
  }).join('');
  cx.style.display='block';
}
function escolherMercTexto(id){
  _itemSel=insumo(id);
  var cx=$('ntSug');if(cx){cx.style.display='none';cx.innerHTML='';}
  var nm=$('ntItNome');if(nm)nm.value=_itemSel?_itemSel.nome:'';
  pintaLinhaMerc();
  var q=$('ntItQt');if(q)q.focus();
}
function pintaLinhaMerc(){
  var u=$('ntItUn');if(u)u.value=_itemSel?un(_itemSel.unidade).ab:'';
  var v=$('ntItVl');
  if(v&&_itemSel&&!(parseFloat(v.value)>0))v.value=custoAtual(_itemSel)||'';
  var t=$('ntItTt');
  if(t){var q=parseFloat(($('ntItQt')||{}).value)||0,vl=parseFloat((v||{}).value)||0,
    d=moedaValor('ntItDs');t.value=money(Math.max(0,q*vl-d));}
}
function navSug(e){
  var cx=$('ntSug');
  if(!cx||cx.style.display==='none')return false;
  var its=cx.querySelectorAll('.sgIt');
  if(!its.length)return false;
  var at=-1;for(var k=0;k<its.length;k++)if(its[k].classList.contains('on'))at=k;
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){
    e.preventDefault();
    var nx=(e.key==='ArrowDown')?Math.min(its.length-1,at+1):Math.max(0,at-1);
    for(var j=0;j<its.length;j++)its[j].classList.remove('on');
    its[nx].classList.add('on');its[nx].scrollIntoView({block:'nearest'});
    return true;
  }
  if(e.key==='Enter'&&at>=0){e.preventDefault();its[at].dispatchEvent(new Event('mousedown'));return true;}
  if(e.key==='Escape'){cx.style.display='none';return true;}
  return false;
}
function ligarLinhaNota(){
  function calc(){
    var q=parseFloat($('ntItQt').value)||0;
    var v=parseFloat($('ntItVl').value)||0;
    var d=moedaValor('ntItDs');
    $('ntItTt').value=money(Math.max(0,q*v-d));
  }
  ['ntItQt','ntItVl','ntItDs'].forEach(function(k){
    var el=$(k);if(el){el.oninput=calc;el.onkeydown=function(e){if(e.key==='Enter')addItemNota()};}
  });
  var nm=$('ntItNome');
  if(nm){
    nm.oninput=function(){sugereMerc(this.value)};
    nm.onkeydown=function(e){
      if(navSug(e))return;
      if(e.key==='Enter'){e.preventDefault();if(_itemSel){var q=$('ntItQt');if(q)q.focus();}}
    };
    nm.onfocus=function(){if(this.value&&!_itemSel)sugereMerc(this.value)};
    nm.onblur=function(){setTimeout(function(){var c=$('ntSug');if(c)c.style.display='none'},200)};
  }
  calc();
}
function guardarCabNota(){
  if($('ntFor')){
    _nota.fornecedorId=$('ntFor').value;
    var f=(DB.fornec||[]).find(function(x){return x.id===_nota.fornecedorId});
    _nota.fornecedorNome=f?f.empresa:'';
  }
  if($('ntNum'))_nota.numero=$('ntNum').value;
  if($('ntData'))_nota.data=$('ntData').value;
  _nota.receber=true;
}
/* janela de seleção de mercadoria */
var _selBusca='';
function abrirSelMerc(){
  guardarCabNota();
  _selBusca='';
  desenhaSelMerc();
}
function desenhaSelMerc(){
  var q=_selBusca.toLowerCase();
  var lista=(DB.insumos||[]).filter(function(i){
    return !q||(i.nome||'').toLowerCase().indexOf(q)>=0||String(i.codigo||'').indexOf(q)>=0;
  }).sort(function(a,b){return (a.nome||'').localeCompare(b.nome||'')});
  var h='<div class="selMerc">'+
   '<div class="smH"><b>Selecionar Mercadoria</b>'+
    '<button onclick="fecharSelMerc()">&times;</button></div>'+
   '<div class="smBusca">'+
    '<div class="f2" style="flex:1"><label>Localizar</label>'+
     '<input id="smB" value="'+E(_selBusca)+'" placeholder="nome ou código"></div>'+
    '<span class="smQt">'+lista.length+' resultado(s)</span>'+
    '<button class="btnP2" onclick="modalInsumo()">'+sv('plus',12)+' Novo</button>'+
   '</div>'+
   '<div class="smLista"><table class="smTab"><thead><tr>'+
    '<th style="width:80px">Código</th><th>Nome</th>'+
    '<th style="width:130px">Grupo</th><th style="width:70px">Un.</th>'+
    '<th style="width:100px;text-align:right">Custo</th></tr></thead><tbody>'+
    (lista.length?lista.map(function(i){
      var g=grupoIng(i.grupoId);
      return '<tr ondblclick="escolherMerc(\''+i.id+'\')" onclick="marcaMerc(this,\''+i.id+'\')">'+
      '<td>'+E(i.codigo)+'</td><td><b>'+E(i.nome)+'</b></td>'+
      '<td>'+E(g?g.nome:'—')+'</td><td>'+un(i.unidade).ab+'</td>'+
      '<td style="text-align:right">'+money(custoAtual(i))+'</td></tr>';
    }).join('')
    :'<tr><td colspan="5" class="semIns">nenhuma mercadoria encontrada</td></tr>')+
   '</tbody></table></div>'+
   '<div class="smF"><button class="btnP2" onclick="fecharSelMerc()">Cancelar</button>'+
    '<button class="btnP2 ok" onclick="escolherMerc(_mercMarcada)">Selecionar</button></div>'+
  '</div>';
  var o=document.getElementById('mdOv2');if(o)o.remove();
  var ov=document.createElement('div');ov.className='mdOv smOv';ov.id='mdOv2';
  ov.innerHTML=h;
  document.body.appendChild(ov);
  var b=$('smB');
  if(b){
    /* so a lista e repintada: o campo nunca e recriado, entao nao perde letra */
    b.oninput=function(){_selBusca=this.value;pintaSelMerc()};
    b.onkeydown=function(e){if(e.key==='Enter'&&_mercMarcada)escolherMerc(_mercMarcada)};
    setTimeout(function(){b.focus()},40);
  }
}
function pintaSelMerc(){
  var q=_selBusca.toLowerCase();
  var lista=(DB.insumos||[]).filter(function(i){
    return !q||(i.nome||'').toLowerCase().indexOf(q)>=0||String(i.codigo||'').indexOf(q)>=0;
  }).sort(function(a,b){return (a.nome||'').localeCompare(b.nome||'')});
  var tb=document.querySelector('.smTab tbody');
  if(tb)tb.innerHTML=(lista.length?lista.map(function(i){
      var g=grupoIng(i.grupoId);
      return '<tr ondblclick="escolherMerc(\''+i.id+'\')" onclick="marcaMerc(this,\''+i.id+'\')">'+
      '<td>'+E(i.codigo)+'</td><td><b>'+E(i.nome)+'</b></td>'+
      '<td>'+E(g?g.nome:'—')+'</td><td>'+un(i.unidade).ab+'</td>'+
      '<td style="text-align:right">'+money(custoAtual(i))+'</td></tr>';
    }).join('')
    :'<tr><td colspan="5" class="semIns">nenhuma mercadoria encontrada</td></tr>');
  var qt=document.querySelector('.smQt');
  if(qt)qt.textContent=lista.length+' resultado(s)';
}
var _mercMarcada='';
function marcaMerc(tr,id){
  _mercMarcada=id;
  var rs=document.querySelectorAll('.smTab tbody tr');
  for(var i=0;i<rs.length;i++)rs[i].classList.remove('sel2');
  tr.classList.add('sel2');
}
function fecharSelMerc(){var o=document.getElementById('mdOv2');if(o)o.remove();}
function escolherMerc(id){
  if(!id){toast('Selecione uma mercadoria.');return;}
  _itemSel=insumo(id);
  _mercMarcada='';
  fecharSelMerc();
  desenhaNota();
  setTimeout(function(){var q=$('ntItQt');if(q){q.focus();}},60);
}
function addItemNota(){
  guardarCabNota();
  if(!_itemSel){toast('Selecione a mercadoria.');return;}
  var q=parseFloat($('ntItQt').value)||0;
  if(q<=0){toast('Informe a quantidade.');return;}
  var v=parseFloat($('ntItVl').value)||0;
  if(v<=0){toast('Informe o valor unitário.');return;}
  var d=moedaValor('ntItDs');
  _nota.itens.push({insumoId:_itemSel.id,nome:_itemSel.nome,unidade:_itemSel.unidade,
    qtd:q,valorUn:v,desconto:d,total:+(q*v-d).toFixed(2),ncm:_itemSel.ncm||''});
  _itemSel=null;
  desenhaNota();
  setTimeout(function(){var nm=$('ntItNome');if(nm){nm.value='';nm.focus();}},50);
}
function remItemNota(k){guardarCabNota();_nota.itens.splice(k,1);desenhaNota();}
function fecharNota(){
  var o=document.getElementById('mdOv');if(o)o.remove();
  _nota=null;_itemSel=null;
  telaNotas();
}
function confirmarNota(){
  guardarCabNota();
  var n=_nota;
  if(!n.fornecedorId){toast('Selecione o fornecedor.');return;}
  if(!(n.itens||[]).length){toast('Lance ao menos um item.');return;}
  n.valorMercadorias=+(n.itens.reduce(function(a,i){return a+i.total},0)).toFixed(2);
  n.valorTotal=n.valorMercadorias;
  abrirFinanceiroNota();
}

/* ---------- FINANCEIRO DA NOTA ---------- */
function abrirFinanceiroNota(){
  var n=_nota;
  var o=document.getElementById('mdOv');if(o)o.remove();
  modalLanc(null,'despesa',{
    titulo:'Lançamento da nota '+n.numero,
    botao:'Confirmar e lançar',
    descricao:'NF '+n.numero+' — '+n.fornecedorNome,
    valor:n.valorTotal,
    emissao:n.data,
    vencimento:n.data,
    documento:'NF '+n.numero,
    soDespesa:true,
    fornecedorId:n.fornecedorId,
    contaId:(DB.contas&&DB.contas[0])?DB.contas[0].id:'',
    apos:function(criados){finalizarNota(criados)}
  });
}
function finalizarNota(lancs){
  var n=_nota;
  if(!n){telaNotas();return;}
  n.id=uid('nf');n.hora=agoraHM();
  n.receber=n.receber!==false;
  n.lancIds=(lancs||[]).map(function(l){return l.id});
  var prim=(lancs||[])[0]||{};
  n.pagamento={tipo:(lancs&&lancs.length>1)?'Parcelado':(prim.pago?'À vista':'A prazo'),
    parcelas:(lancs||[]).length,contaId:prim.contaId||'',
    metodoId:prim.metodoId||'',categoriaId:prim.categoriaId||''};

  /* entrada no estoque */
  if(n.receber){
    var linhas=n.itens.filter(function(it){
      var i2=insumo(it.insumoId);
      return i2&&i2.controlaEstoque!==false;      /* respeita o cadastro do ingrediente */
    }).map(function(it){
      return {insumoId:it.insumoId,nome:it.nome,unidade:it.unidade,qtd:it.qtd,
        custo:+(it.total/it.qtd).toFixed(6),direcao:'entrada',origem:'nota'};
    });
    if(linhas.length){
      var mov={id:uid('mv'),data:n.data,hora:n.hora,motivoId:'mv_nota',
        identificacao:'NF '+n.numero,obs:n.fornecedorNome,linhas:linhas,
        origem:'nota',notaId:n.id};
      DB.movEst.push(mov);
      aplicarMovimento(mov);
      n.movId=mov.id;
    }
    n.itens.forEach(function(it){
      var i2=insumo(it.insumoId);
      if(!i2)return;
      i2.compras=i2.compras||[];
      i2.compras.push({data:n.data,qtd:it.qtd,valor:+(it.total/it.qtd).toFixed(6),notaId:n.id});
      i2.custoUltima=+(it.total/it.qtd).toFixed(6);
    });
  }
  /* amarra os lançamentos à nota */
  (lancs||[]).forEach(function(l){
    l.origem='nota-entrada';l.ref=n.id;
    l.fornecedor=n.fornecedorNome;l.fornecedorId=n.fornecedorId;
  });

  DB.notas.push(n);
  salvar();
  var o=document.getElementById('mdOv');if(o)o.remove();
  _nota=null;_itemSel=null;
  telaNotas();
  toast('Nota lançada — estoque '+(n.receber?'atualizado':'não movimentado')+
    ' e '+(lancs||[]).length+' lançamento(s) no financeiro.');
  setTimeout(function(){vincularFornecedor(n)},600);
}

/* ao lancar a nota, os itens passam a pertencer aquele fornecedor */
async function vincularFornecedor(n){
  try{
    if(!n||!n.fornecedorId)return;
    var novos=(n.itens||[]).map(function(it){return insumo(it.insumoId)})
      .filter(function(i){return i&&i.fornecedorId!==n.fornecedorId});
    if(!novos.length)return;
    var troca=novos.filter(function(i){return i.fornecedorId});
    var ok=await confirmar({
      titulo:'Vincular a '+n.fornecedorNome,
      texto:novos.length+' item(ns) desta nota ainda não pertencem a este fornecedor.',
      linhas:novos.slice(0,12).map(function(i){
        var at=i.fornecedorId?(fornecedor(i.fornecedorId)||{}).empresa:'';
        return [i.nome,(at?'hoje: '+at:'sem fornecedor'),''];}),
      aviso:(troca.length?'<b>'+troca.length+'</b> item(ns) já tinham outro fornecedor e '+
        'serão trocados.<br>':'')+
        'Depois de vincular, eles aparecem na aba <b>Insumos deste fornecedor</b>, no cadastro dele.',
      ok:'Vincular',cancelar:'Agora não',tipo:'check'});
    if(!ok)return;
    novos.forEach(function(i){i.fornecedorId=n.fornecedorId});
    salvar();
    toast(novos.length+' insumo(s) vinculado(s) a '+n.fornecedorNome+'.');
  }catch(e){_quieto(e,'vincularFornecedor')}
}

/* ---------- VER / EXCLUIR ---------- */
function verNota(id){
  var n=(DB.notas||[]).find(function(x){return x.id===id});
  if(!n)return;
  var lanc=(DB.lancFin||[]).filter(function(l){return l.ref===n.id&&l.origem==='nota-entrada'});
  var h='<div class="mdB">'+
  '<div class="acHead"><div class="av3" style="width:42px;height:42px">'+sv('box',18)+'</div>'+
  '<div><b>Nota '+E(n.numero)+' · '+E(n.fornecedorNome)+'</b>'+
  '<span>'+dataBR(n.data)+' '+E(n.hora||'')+' · '+(n.itens||[]).length+' itens</span>'+
  '<span>'+E((n.pagamento&&n.pagamento.tipo)||'')+
   (n.pagamento&&n.pagamento.parcelas>1?' em '+n.pagamento.parcelas+'x':'')+'</span></div>'+
  '<div style="text-align:right"><span class="hint">Total</span>'+
  '<b style="display:block;font-size:20px;color:var(--acc-d)">R$ '+money(n.valorTotal)+'</b></div></div>'+
  '<div class="blk" style="margin:0 0 11px;max-width:none;padding:0;overflow:hidden">'+
   '<div class="acTit">Mercadorias</div>'+
   '<div class="acTabW" style="max-height:280px"><table class="acTab"><thead><tr>'+
    '<th>Mercadoria</th><th style="width:100px;text-align:right">Qtd</th>'+
    '<th style="width:110px;text-align:right">Valor un.</th>'+
    '<th style="width:110px;text-align:right">Total</th></tr></thead><tbody>'+
    (n.itens||[]).map(function(it){
      return '<tr><td><b>'+E(it.nome)+'</b></td>'+
      '<td style="text-align:right">'+fmtQt(it.qtd)+' '+un(it.unidade).ab+'</td>'+
      '<td style="text-align:right">'+money(it.valorUn)+'</td>'+
      '<td style="text-align:right"><b>'+money(it.total)+'</b></td></tr>';
    }).join('')+'</tbody></table></div></div>'+
  (lanc.length?'<div class="blk" style="margin:0;max-width:none;padding:0;overflow:hidden">'+
   '<div class="acTit">Lançamentos no financeiro</div><table class="acTab"><tbody>'+
   lanc.map(function(l){
     return '<tr><td>'+E(l.descricao)+'<small style="display:block;color:var(--ink-3)">'+
     'vence '+dataBR(l.vencimento)+' · '+(l.pago?'pago':'em aberto')+'</small></td>'+
     '<td style="text-align:right;width:130px"><b>R$ '+money(l.valor)+'</b></td></tr>';
   }).join('')+'</tbody></table></div>':'')+
  '</div>';
  var o=document.createElement('div');o.className='mdOv';o.id='mdOv';
  o.innerHTML='<div class="mdBox xl"><div class="mdH"><b>Nota de entrada</b>'+
  '<button onclick="fecharModal()">&times;</button></div>'+h+
  '<div class="mdF"><button class="btnP2" onclick="fecharModal()">Fechar</button>'+
  '<button class="btnP2 rdB" onclick="excluirNota(\''+n.id+'\')">'+sv('trash',13)+' Excluir nota</button></div></div>';
  document.body.appendChild(o);
  fecharSoForaDeVerdade(o);
}
async function excluirNota(id){
  var n=(DB.notas||[]).find(function(x){return x.id===id});
  if(!n)return;
  var pagos=(DB.lancFin||[]).filter(function(l){return l.ref===n.id&&l.conciliado}).length;
  if(pagos){toast('Esta nota tem lançamento conciliado no banco. Desconcilie antes de excluir.');return;}
  var ok=await confirmar({titulo:'Excluir a nota '+n.numero,
    texto:'Fornecedor: '+n.fornecedorNome,
    linhas:[['Valor da nota','R$ '+money(n.valorTotal),''],
            ['Itens',String((n.itens||[]).length),'']],
    aviso:'Os lançamentos financeiros desta nota serão removidos junto.'+
     '<label class="chkL" style="margin-top:10px;display:flex">'+
      '<input type="checkbox" id="cfAjEst" checked>'+
      '<span><b>Ajustar o estoque</b><small style="display:block;color:var(--ink-3)">'+
      'devolve o que esta nota tinha lançado — ex.: o 1 kg de açúcar que entrou por ela sai do saldo</small></span></label>',
    ok:'Excluir nota',tipo:'perigo'});
  if(!ok)return;
  var ajusta=window._cfAjEst!==false;
  if(ajusta){
    var mov=(DB.movEst||[]).find(function(m){return m.id===n.movId});
    if(mov){aplicarMovimento(mov,true);DB.movEst=DB.movEst.filter(function(m){return m.id!==n.movId});}
    (n.itens||[]).forEach(function(it){
      var i2=insumo(it.insumoId);
      if(i2&&i2.compras)i2.compras=i2.compras.filter(function(c){return c.notaId!==n.id});
    });
  }
  DB.lancFin=(DB.lancFin||[]).filter(function(l){return !(l.ref===n.id&&l.origem==='nota-entrada')});
  DB.notas=DB.notas.filter(function(x){return x.id!==id});
  salvar();fecharModal();telaNotas();
  toast('Nota excluída'+(ajusta?', estoque ajustado':', estoque mantido')+' e financeiro limpo.');
}
function exportarNotas(){
  baseNotas();
  var l=[['Numero','Data','Fornecedor','Mercadoria','Qtd','Unidade','Valor un','Desconto','Total']];
  (DB.notas||[]).forEach(function(n){
    if(NT.de&&n.data<NT.de)return;
    if(NT.ate&&n.data>NT.ate)return;
    (n.itens||[]).forEach(function(it){
      l.push([n.numero,dataBR(n.data),n.fornecedorNome,it.nome,
        String(it.qtd).replace('.',','),un(it.unidade).ab,
        String(it.valorUn).replace('.',','),String(it.desconto||0).replace('.',','),
        String(it.total).replace('.',',')]);
    });
  });
  var csv=l.map(function(r){return r.map(function(c){return '"'+String(c).replace(/"/g,'""')+'"'}).join(';')}).join('\n');
  var b=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'});
  var a=document.createElement('a');a.href=URL.createObjectURL(b);
  a.download='nexor-notas-entrada.csv';document.body.appendChild(a);a.click();
  setTimeout(function(){a.remove()},400);
  toast('Notas exportadas.');
}

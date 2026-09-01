/* ==========================================================
   BLOCO 23 — ESTOQUE TOTAL E CONTAGEM
   ========================================================== */
var ET={busca:'',grupo:'',tipo:'',ordem:'valor',dir:'desc',data:''};
/* ==========================================================
   ESTOQUE NO FIM DE UM DIA
   Nao existe foto guardada de cada dia, e nao precisa: existe o razao de
   movimentos, com data. O saldo de uma data e o saldo de HOJE desfazendo
   tudo o que se moveu DEPOIS dela.

   Por que isso da certo com contagem no meio: a contagem nao grava o total
   contado — grava a DIFERENCA entre o contado e o que havia, como entrada
   ou saida. Entao ela e um movimento comum e entra na mesma conta. Se
   gravasse o total, esta reconstrucao estaria errada e eu teria de tratar
   contagem como marco. Conferido no codigo que finaliza a contagem.

   O que esta conta NAO faz, e precisa ficar dito: o VALOR usa o custo medio
   de hoje, nao o daquele dia. Reconstruir custo medio para tras exige
   refazer a media ponderada compra a compra, o que e outra obra. Quantidade
   e exata; valor e "quantidade daquele dia ao custo de hoje".
   ========================================================== */
function saldoNaData(itemId, dataISO, suc){
  var atual=saldoUn(itemId,suc||lojaAtualId());
  if(!dataISO)return atual;
  var item=itemEstoque(itemId);
  if(!item)return atual;
  var alvo=suc||lojaAtualId();
  (DB.movEst||[]).forEach(function(m){
    var d=String(m.data||'');
    if(!d||d<=dataISO)return;                       /* aconteceu ate a data: fica */
    if((m.sucursalId||lojaAtualId())!==alvo)return; /* outra loja */
    (m.linhas||[]).forEach(function(l){
      if(l.insumoId!==itemId)return;
      var q=convUnid(l.qtd,l.unidade,item.unidade);
      if(q===null)q=Number(l.qtd)||0;
      atual -= (l.direcao==='entrada'?1:-1)*q;      /* desfaz */
    });
  });
  return atual;
}
/* colunas ordenaveis do Estoque Total: rotulo, alinhamento e sentido inicial */
var COLS_ET=[
 {k:'codigo', n:'Código',        w:'96px',  dir:'asc'},
 {k:'nome',   n:'Ingrediente',   w:'',      dir:'asc'},
 {k:'grupo',  n:'Grupo',         w:'140px', dir:'asc'},
 {k:'minimo', n:'Mínimo',        w:'110px', dir:'desc', num:true},
 {k:'qtd',    n:'Quantidade',    w:'120px', dir:'desc', num:true},
 {k:'custo',  n:'Preço médio',   w:'120px', dir:'desc', num:true},
 {k:'ultima', n:'Última compra', w:'120px', dir:'desc', num:true},
 {k:'valor',  n:'Valor total',   w:'130px', dir:'desc', num:true}
];
function colET(k){return COLS_ET.find(function(c){return c.k===k})||COLS_ET[7]}
/* clicar na coluna ordena; clicar de novo inverte */
function ordEst(k){
  if(ET.ordem===k)ET.dir=(ET.dir==='asc'?'desc':'asc');
  else{ET.ordem=k;ET.dir=colET(k).dir;}
  telaEstoqueTotal();
}
function nomeGrupoItem(i){
  var g=ehFicha(i)?catFicha(i.categoriaId):grupoIng(i.grupoId);
  return g?g.nome:'';
}
function filtroET(){return !!(ET.busca||ET.grupo||ET.tipo)}
function limparET(){ET={busca:'',grupo:'',tipo:'',ordem:'valor',dir:'desc'};telaEstoqueTotal();}
function ordenaEstoque(a,b){
  var k=ET.ordem||'valor',d=(ET.dir==='asc'?1:-1),r=0;
  function t(x){return String(x==null?'':x)}
  if(k==='codigo')      r=t(a.codigo).localeCompare(t(b.codigo),'pt',{numeric:true});
  else if(k==='nome')   r=t(a.nome).localeCompare(t(b.nome),'pt');
  else if(k==='grupo')  r=nomeGrupoItem(a).localeCompare(nomeGrupoItem(b),'pt');
  else if(k==='minimo') r=(Number(a.estoqueMin)||0)-(Number(b.estoqueMin)||0);
  else if(k==='qtd')    r=(Number(a.estoqueAtual)||0)-(Number(b.estoqueAtual)||0);
  else if(k==='custo')  r=custoDoItem(a)-custoDoItem(b);
  else if(k==='ultima') r=(Number(a.custoUltima)||0)-(Number(b.custoUltima)||0);
  else                  r=valorItem(a)-valorItem(b);
  if(r)return r*d;
  return t(a.nome).localeCompare(t(b.nome),'pt');   /* empate: sempre pelo nome */
}
/* a mesma lista que a tela mostra — usada tambem na exportacao */
function listaEstoque(){
  return itensEstoque().filter(function(i){
    if(ET.grupo&&i.grupoId!==ET.grupo)return false;
    if(ET.tipo==='ficha'&&!i.gelatoVenda&&!i.deFicha)return false;
    if(ET.tipo==='insumo'&&(i.gelatoVenda||i.deFicha))return false;
    var _sa=ET.data?saldoNaData(i.id,ET.data):Number(i.estoqueAtual);
    i._saldoData=_sa;                 /* a tela desenha este, nao o de hoje */
    if(ET.tipo==='baixo'&&!(_sa<=Number(i.estoqueMin)))return false;
    if(ET.tipo==='zerado'&&_sa>0)return false;
    if(ET.busca){
      var q=ET.busca.toLowerCase();
      if((i.nome||'').toLowerCase().indexOf(q)<0&&String(i.codigo||'').indexOf(q)<0)return false;
    }
    return true;
  }).sort(ordenaEstoque);
}
function itensEstoque(){
  /* baseMov() ja foi chamada por quem montou a tela. Chamar de novo aqui
     fazia a preparacao inteira rodar 3x por abertura: telaEstoqueTotal
     chama baseMov, depois itensEstoque (baseMov de novo) e depois
     listaEstoque, que chama itensEstoque (baseMov pela terceira vez). */
  if(!DB._baseMovOk)baseMov();
  var lista=[];
  /* todos os insumos que controlam estoque */
  (DB.insumos||[]).forEach(function(i){
    if(i.controlaEstoque===false)return;
    lista.push(i);
  });
  /* todas as fichas técnicas estocáveis: bases, massas, cascão, gelato venda... */
  (DB.fichas||[]).forEach(function(f){
    if(f.estocavel===false)return;
    if(f.estoqueAtual===undefined)f.estoqueAtual=0;
    if(!f.unidade)f.unidade='un';
    lista.push(f);
  });
  return lista;
}
/* é ficha técnica? */
function ehFicha(x){return !!(x&&x.itens!==undefined&&x.rendimento!==undefined)}
/* qtd da data escolhida (ou de hoje, quando nao ha data) */
function qtdItemET(i){
  return Number(ET.data&&i._saldoData!==undefined?i._saldoData:i.estoqueAtual)||0;
}
function valorItem(i){return qtdItemET(i)*custoDoItem(i)}

/* ---------- ESTOQUE TOTAL ---------- */
/* olhinho do estoque: abre o cadastro do item, seja insumo ou ficha */
function abrirCadastroItem(id){
  var f=(DB.fichas||[]).find(function(x){return x.id===id});
  if(f){abrir('estoque','ficha-tecnica');setTimeout(function(){
    try{abrirFicha(f.id)}catch(e){toast('Abra a ficha "'+f.nome+'" na lista.')}},350);return;}
  var i=insumo(id);
  if(i){modalInsumo(i.id);return;}
  toast('Item não encontrado.');
}
function telaEstoqueTotal(){
  baseMov();
  /* o saldo mostrado aqui vem de estoque_unidade; reaplica antes de desenhar
     para a tela nunca exibir o zero que ficou escrito antes do download */
  try{ espelharEstoque(); }catch(e){ _quieto(e,'telaEstoqueTotal'); }
  var todos=itensEstoque();
  var lista=listaEstoque();
  /* ==========================================================
     A TELA APARECE ANTES DE DESENHAR TUDO
     Medido com os dados reais (250 insumos): o JavaScript leva ~115 ms, mas
     o HTML tem 114 KB e 2.000 celulas — e e o NAVEGADOR desenhando isso que
     custa os segundos. Nao adianta otimizar conta: a conta ja e rapida.
     Agora saem 60 linhas de imediato e o resto entra conforme a rolagem.
     Os totais continuam somando a lista INTEIRA — o numero no topo nao muda,
     so o desenho e que e parcelado.
     ========================================================== */
  var LOTE=60;
  if(ET._mostrar===undefined||ET._chave!==(ET.busca+'|'+ET.grupo+'|'+ET.tipo+'|'+ET.ordem+'|'+ET.dir)){
    ET._mostrar=LOTE;
    ET._chave=ET.busca+'|'+ET.grupo+'|'+ET.tipo+'|'+ET.ordem+'|'+ET.dir;
  }
  var visiveis=lista.slice(0, ET._mostrar);
  var total=lista.reduce(function(a,i){return a+valorItem(i)},0);
  var totalGeral=todos.reduce(function(a,i){return a+valorItem(i)},0);
  var abaixo=todos.filter(function(i){return Number(i.estoqueAtual)<=Number(i.estoqueMin)}).length;
  var qFiltro=lista.reduce(function(a,i){return a+qtdItemET(i)},0);
  var pct=totalGeral?((total/totalGeral)*100):0;
  var temFiltro=filtroET();

  $('content').innerHTML='<div class="etWrap">'+
   '<div class="etScroll">'+
   '<div class="etTopo">'+
    '<div><h1>Estoque Total</h1><p>Posição atual de todos os itens, atualizada por movimentações e vendas.</p></div>'+
    '<div class="etTot">'+
     '<div class="etT dest"><span>Valor total em estoque</span><b>R$ '+money(totalGeral)+'</b></div>'+
     /* fixo na tela: sem filtro ele mostra o total, com filtro mostra o recorte */
     '<div class="etT filtro"><span>Valor do filtro</span><b>R$ '+money(total)+'</b>'+
      '<small>'+(temFiltro
        ?lista.length+' de '+todos.length+' itens'
        :'todos os '+todos.length+' itens')+'</small></div>'+
     '<div class="etT"><span>Itens</span><b>'+todos.length+'</b></div>'+
     '<div class="etT"><span>Abaixo do mínimo</span><b class="'+(abaixo?'vr':'vg')+'">'+abaixo+'</b></div>'+
    '</div>'+
    '<button class="btnP2" onclick="exportarEstoque()">'+sv('down2',13)+' Exportar</button>'+
   '</div>'+
   '<div class="etFiltros">'+
    '<div class="f2" style="max-width:170px"><label>Estoque no fim do dia</label>'+
     '<input type="date" id="etData" max="'+hojeISO()+'" value="'+E(ET.data||'')+'" '+
     'onchange="ET.data=this.value;ET._mostrar=undefined;telaEstoqueTotal()"></div>'+
    (ET.data?'<div class="f2" style="max-width:120px"><label>&nbsp;</label>'+
     '<button class="btnP2" onclick="ET.data=\'\';ET._mostrar=undefined;telaEstoqueTotal()">'+
     'voltar para hoje</button></div>':'')+
    '<div class="f2 gw2"><label>Buscar</label><input id="etB" value="'+E(ET.busca)+'" placeholder="nome ou código"></div>'+
    '<div class="f2"><label>Grupo</label><select onchange="ET.grupo=this.value;telaEstoqueTotal()">'+
     '<option value="">Todos</option>'+
     (DB.gruposIng||[]).map(function(g){return '<option value="'+g.id+'"'+(ET.grupo===g.id?' selected':'')+'>'+E(g.nome)+'</option>'}).join('')+
    '</select></div>'+
    '<div class="f2"><label>Exibir</label><select onchange="ET.tipo=this.value;telaEstoqueTotal()">'+
     '<option value="">Todos os itens</option>'+
     '<option value="insumo"'+(ET.tipo==='insumo'?' selected':'')+'>Somente insumos</option>'+
     '<option value="ficha"'+(ET.tipo==='ficha'?' selected':'')+'>Produtos de produção</option>'+
     '<option value="baixo"'+(ET.tipo==='baixo'?' selected':'')+'>Abaixo do mínimo</option>'+
     '<option value="zerado"'+(ET.tipo==='zerado'?' selected':'')+'>Zerados ou negativos</option>'+
    '</select></div>'+
    '<div class="f2"><label>Ordenar <small style="color:var(--ink-3)">(ou clique na coluna)</small></label>'+
     '<select onchange="ET.ordem=this.value;ET.dir=colET(this.value).dir;telaEstoqueTotal()">'+
     COLS_ET.map(function(c){return '<option value="'+c.k+'"'+(ET.ordem===c.k?' selected':'')+'>'+
       E(c.n)+'</option>'}).join('')+
    '</select></div>'+
    '<div class="f2" style="max-width:150px"><label>Sentido</label>'+
     '<select onchange="ET.dir=this.value;telaEstoqueTotal()">'+
     '<option value="desc"'+(ET.dir==='desc'?' selected':'')+'>Maior para menor</option>'+
     '<option value="asc"'+(ET.dir==='asc'?' selected':'')+'>Menor para maior</option>'+
    '</select></div>'+
    '<button class="btnP2" onclick="limparET()">Limpar</button>'+
    '<button class="btnP2" title="Códigos 1, 2, 3... na ordem alfabética" '+
     'onclick="pedirRenumerar()">'+sv('ref',12)+' Renumerar códigos</button>'+
   '</div>'+
   '<div class="etTabW plano2">'+
   (lista.length?'<table class="etTab semBusca"><thead><tr>'+
    COLS_ET.map(function(c){
      var on=(ET.ordem===c.k);
      var seta=on?(ET.dir==='asc'?'&#9650;':'&#9660;'):'&#8693;';
      return '<th class="ordCol'+(on?' on':'')+(c.num?' dir':'')+'"'+
       (c.w?' style="width:'+c.w+'"':'')+
       ' onclick="ordEst(\''+c.k+'\')" title="Ordenar por '+c.n+'">'+
       '<span>'+c.n+'<i class="ordSeta">'+seta+'</i></span></th>';
    }).join('')+'</tr></thead><tbody>'+
    visiveis.map(function(i){
      var eFicha=(i.itens!==undefined&&i.rendimento!==undefined);
      var g=eFicha?catFicha(i.categoriaId):grupoIng(i.grupoId);
      var q=qtdItemET(i);
      var baixo=q<=Number(i.estoqueMin||0);
      var eF=(i.itens!==undefined&&i.rendimento!==undefined);
      return '<tr class="'+(q<0?'neg':baixo?'baixo':'')+'">'+
      '<td>'+E(i.codigo)+
       '<button class="rBtn" style="margin-left:4px" title="ver o cadastro deste item" '+
       'onclick="abrirCadastroItem(\''+i.id+'\')">'+sv('eye',12)+'</button></td>'+
      '<td><b>'+E(i.nome)+'</b>'+
       (i.itens!==undefined&&i.rendimento!==undefined?'<span class="tagFicha">ficha</span>':'')+
       (i.gelatoVenda?'<span class="cidTag" style="margin-left:6px">produção</span>':'')+'</td>'+
      '<td>'+E(g?g.nome:'—')+'</td>'+
      '<td style="text-align:right">'+fmtQt(i.estoqueMin)+' '+un(i.unidade).ab+'</td>'+
      '<td style="text-align:right"><b class="'+(q<0?'vr':baixo?'vr':'')+'">'+fmtQt(q)+' '+un(i.unidade).ab+'</b>'+
       (baixo?'<span class="atrTag">baixo</span>':'')+'</td>'+
      '<td style="text-align:right">'+money(custoDoItem(i))+'<small>/'+un(i.unidade).ab+'</small></td>'+
      '<td style="text-align:right">'+money(i.custoUltima||0)+'</td>'+
      '<td style="text-align:right"><b>R$ '+money(valorItem(i))+'</b></td></tr>';
    }).join('')+'</tbody>'+
    '<tfoot><tr><td colspan="7"><b>Total do filtro — '+lista.length+' de '+todos.length+' itens</b>'+
      (visiveis.length<lista.length
        ? '<small style="margin-left:8px;color:var(--ink-3)">mostrando '+visiveis.length+
          ' — role para ver o restante</small>'
        : '')+'</td>'+
    '<td style="text-align:right"><b>R$ '+money(total)+'</b></td></tr>'+
    (temFiltro?'<tr class="sub2"><td colspan="7">Estoque inteiro — '+todos.length+' itens</td>'+
     '<td style="text-align:right">R$ '+money(totalGeral)+'</td></tr>':'')+
    '</tfoot></table>'
   :'<div class="mvVazio">'+sv('box',26)+'<b>Nenhum item encontrado</b>'+
    '<span>Cadastre ingredientes em <b>Ingredientes e Insumos</b>.</span></div>')+
   '</div></div>';
  /* ==========================================================
     BUSCA COM ESPERA
     Cada tecla redesenhava a tabela inteira. Digitar "chocolate" eram 9
     redesenhos de 250 linhas — a tela travava enquanto a pessoa escrevia.
     Agora espera 220 ms depois da ultima tecla. O campo continua respondendo
     na hora; so a tabela e que aguarda.
     ========================================================== */
  $('etB').oninput=function(){
    ET.busca=this.value;
    var p=this.selectionStart;
    clearTimeout(window._etTimer);
    window._etTimer=setTimeout(function(){
      telaEstoqueTotal();
      var n2=$('etB'); if(n2){n2.focus();n2.setSelectionRange(p,p);}
    },220);
  };
  /* ---- carrega mais linhas conforme a rolagem ---- */
  (function(){
    var cx=document.querySelector('.etScroll');
    if(!cx)return;
    cx.onscroll=function(){
      if(ET._mostrar>=lista.length)return;
      if(cx.scrollTop+cx.clientHeight < cx.scrollHeight-400)return;
      if(window._etCarregando)return;
      window._etCarregando=true;
      ET._mostrar=Math.min(ET._mostrar+LOTE, lista.length);
      var pos=cx.scrollTop;
      telaEstoqueTotal();
      var cx2=document.querySelector('.etScroll');
      if(cx2)cx2.scrollTop=pos;
      window._etCarregando=false;
    };
  })();;
  rodape('estoque total R$ '+money(totalGeral));
}
function exportarEstoque(){
  baseMov();
  /* exporta exatamente o que esta na tela: mesmo filtro, mesma ordem */
  var lista=listaEstoque();
  var todos=itensEstoque();
  var l=[['Codigo','Ingrediente','Grupo','Unidade','Minimo','Quantidade','Preco medio','Ultima compra','Valor total']];
  lista.forEach(function(i){
    l.push([i.codigo,i.nome,nomeGrupoItem(i),un(i.unidade).ab,i.estoqueMin,i.estoqueAtual,
      String(custoDoItem(i)).replace('.',','),String(i.custoUltima||0).replace('.',','),
      String(valorItem(i).toFixed(2)).replace('.',',')]);
  });
  l.push([]);
  l.push(['Total do filtro',lista.length+' itens','','','','','','',
    String(lista.reduce(function(a,i){return a+valorItem(i)},0).toFixed(2)).replace('.',',')]);
  l.push(['Total do estoque',todos.length+' itens','','','','','','',
    String(todos.reduce(function(a,i){return a+valorItem(i)},0).toFixed(2)).replace('.',',')]);
  var csv=l.map(function(r){return r.map(function(c){return '"'+String(c).replace(/"/g,'""')+'"'}).join(';')}).join('\n');
  var b=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'});
  var a=document.createElement('a');a.href=URL.createObjectURL(b);
  a.download='nexor-estoque-total.csv';document.body.appendChild(a);a.click();
  setTimeout(function(){a.remove()},400);
  toast('Estoque exportado.');
}

/* ---------- CONTAGEM DE ESTOQUE ---------- */
/* ==========================================================
   CUSTO CORRIGIDO NA CONTAGEM

   Regra geral do sistema: custo de insumo nao se digita — sai da nota de
   entrada pela media ponderada. A contagem e a excecao legitima: quem
   esta com o produto na mao vendo a etiqueta enxerga o preco de hoje.

   O custo digitado aqui NAO altera nada na hora. Fica guardado em
   CT2.custo, entra na conta da diferenca na tela, e so e gravado no
   insumo quando a contagem e finalizada — junto do ajuste de estoque e
   registrado no historico da contagem, para depois se saber de onde
   veio aquele preco.
   ========================================================== */
var CT2={aba:'hist',busca:'',grupo:'',cont:{},custo:{},de:'',ate:'',data:''};
/* ==========================================================
   A CONTAGEM E DO FIM DAQUELE DIA

   A loja conta de manha, antes de abrir, o que sobrou da noite
   anterior. Se a contagem valer pelo dia de HOJE, ela esta errada assim
   que a primeira venda sair: "tinha 2 copos" vira mentira depois de
   vender os 2.

   Entao a contagem tem data propria, e ela quer dizer sempre a mesma
   coisa: ESTE e o estoque no fim daquele dia, depois de toda a venda.

   A conta e em dois passos, e os dois importam:

     1. a diferenca e achada contra o saldo DAQUELE DIA
        (`saldoNaData` desfaz os movimentos posteriores);
     2. a diferenca e aplicada ao estoque de HOJE.

   Assim o que a loja vendeu entre a data da contagem e agora continua
   valendo. Contar "2 copos em 31/08" e ter vendido 2 no dia 01 termina
   com zero hoje — e nao com 2, que e o que aconteceria se a contagem
   escrevesse o numero por cima do saldo de agora.

   Esta funcao e a UNICA porta: a folha, o rodape, o resumo, o
   "preencher com o sistema" e o fechamento perguntam todos aqui. Duas
   contas do "saldo do sistema" divergiriam no primeiro dia em que
   alguem mexesse numa delas.
   ========================================================== */
function dataDaContagem(){
  var d=CT2.data||hojeISO();
  return (d>hojeISO())?hojeISO():d;      /* contagem do futuro nao existe */
}
function contagemRetroativa(){ return dataDaContagem()!==hojeISO(); }
function sistemaNaContagem(i){
  if(!i)return 0;
  if(!contagemRetroativa())return Number(i.estoqueAtual)||0;
  try{ return Number(saldoNaData(i.id,dataDaContagem(),lojaAtualId()))||0; }
  catch(e){ _quieto(e,'sistemaNaContagem'); return Number(i.estoqueAtual)||0; }
}
/* custo que vale na tela: o digitado, se houver; senao o do cadastro */
function custoCont(i){
  if(!i)return 0;
  var v=CT2.custo[i.id];
  if(v!==undefined&&v!==''&&isFinite(parseFloat(v)))return parseFloat(v);
  return custoAtual(i);
}
function telaContagem(){
  baseMov();
  /* ==========================================================
     A CONTAGEM PRECISA LER O SALDO DESTA UNIDADE

     O saldo real mora em estoque_unidade, uma linha por item POR
     UNIDADE; `i.estoqueAtual` e `i.custo` sao apenas o espelho da
     unidade aberta, preenchido por espelharEstoque(). A tela de Estoque
     chamava; a de Contagem, nao. Entao ela mostrava o que tivesse
     sobrado do ultimo espelho — na pratica, o saldo da matriz mesmo com
     Santa Fe selecionada, e em outra aba o espelho nem tinha sido
     refeito. Contar com o numero da unidade errada estraga o ajuste.
     ========================================================== */
  try{ espelharEstoque(); }catch(e){ _quieto(e,'telaContagem'); }
  if(CT2.aba==='nova')return telaContagemNova();
  if(!CT2.de){var d=new Date();
    CT2.de=new Date(d.getFullYear(),d.getMonth(),1).toISOString().slice(0,10);
    CT2.ate=hojeISO();}
  /* inventario e de UMA loja: o historico nunca mistura. A matriz ve o
     dela; contagem antiga, sem carimbo, fica com a matriz. */
  var _suc=lojaAtualId();
  var lista=(DB.contagens||[]).filter(function(c){
    var s=c.sucursalId||c.loja||'';
    if(s?(s!==_suc):!ehSucMatriz(_suc))return false;
    return (!CT2.de||c.data>=CT2.de)&&(!CT2.ate||c.data<=CT2.ate);
  }).sort(function(a,b){return (b.data+b.hora).localeCompare(a.data+a.hora)});
  var tGanho=lista.reduce(function(a,c){return a+(Number(c.ganho)||0)},0);
  var tPerda=lista.reduce(function(a,c){return a+Math.abs(Number(c.perda)||0)},0);

  $('content').innerHTML='<div class="etWrap"><div class="etScroll">'+
   '<div class="etTopo">'+
    '<div><h1>Contagem de Estoque</h1><p>Histórico das contagens e o resultado de cada uma.</p></div>'+
    '<div class="etTot">'+
     '<div class="etT"><span>Contagens</span><b>'+lista.length+'</b></div>'+
     '<div class="etT"><span>Sobra no período</span><b class="vg">R$ '+money(tGanho)+'</b></div>'+
     '<div class="etT"><span>Perda no período</span><b class="vr">R$ '+money(tPerda)+'</b></div>'+
     '<div class="etT dest"><span>Resultado</span><b class="'+((tGanho-tPerda)>=0?'vg':'vr')+'">R$ '+money(tGanho-tPerda)+'</b></div>'+
    '</div>'+
    '<button class="btnP2 ok" onclick="novaContagem()">'+sv('plus',14)+' Realizar nova contagem</button>'+
   '</div>'+
   '<div class="etFiltros">'+
    '<div class="f2" style="max-width:150px"><label>De</label><input type="date" id="ctDe" value="'+CT2.de+'"></div>'+
    '<div class="f2" style="max-width:150px"><label>Até</label><input type="date" id="ctAte" value="'+CT2.ate+'"></div>'+
    '<button class="btnP2 ok" onclick="filtrarContagens()">'+sv('search',13)+' Buscar</button>'+
    '<button class="btnP2" onclick="mesAtualCT()">Este mês</button>'+
    '<button class="btnP2" onclick="verTodasContagens()">Todas</button>'+
   '</div>'+
   '<div class="etTabW plano2">'+
   (lista.length?'<table class="etTab semBusca"><thead><tr>'+
    '<th style="width:140px">Data</th><th style="width:100px;text-align:center">Itens</th>'+
    '<th style="width:110px;text-align:center">Divergências</th>'+
    '<th style="width:150px;text-align:right">Sobra</th>'+
    '<th style="width:150px;text-align:right">Perda</th>'+
    '<th style="width:140px;text-align:right">Resultado</th>'+
    '<th></th><th style="width:70px"></th></tr></thead><tbody>'+
    lista.map(function(c){
      var dif=(c.itens||[]).filter(function(x){return Math.abs(x.diferenca)>0.0001}).length;
      var nS=(c.itens||[]).filter(function(x){return x.diferenca>0.0001}).length;
      var nP=(c.itens||[]).filter(function(x){return x.diferenca<-0.0001}).length;
      return '<tr><td><b>'+dataBR(c.data)+'</b><small>'+E(c.hora||'')+
       (c.retroativa&&c.lancadaEm?' · lançada em '+dataBR(c.lancadaEm):'')+'</small></td>'+
      '<td style="text-align:center">'+(c.itens||[]).length+'</td>'+
      '<td style="text-align:center">'+dif+'</td>'+
      '<td style="text-align:right"><b class="vg">R$ '+money(c.ganho)+'</b>'+
       (nS?' <button class="rBtn" onclick="verDivergencias(\''+c.id+'\',\'sobra\')" title="Ver o que sobrou">'+sv('eye',11)+'</button>':'')+'</td>'+
      '<td style="text-align:right"><b class="vr">R$ '+money(Math.abs(c.perda))+'</b>'+
       (nP?' <button class="rBtn" onclick="verDivergencias(\''+c.id+'\',\'perda\')" title="Ver o que faltou">'+sv('eye',11)+'</button>':'')+'</td>'+
      '<td style="text-align:right"><b class="'+(c.resultado>=0?'vg':'vr')+'">R$ '+money(c.resultado)+'</b></td>'+
      '<td></td>'+
      '<td><div class="rowAct">'+
       '<button class="rBtn" onclick="verContagem(\''+c.id+'\')" title="Ver tudo">'+sv('eye',12)+'</button>'+
       '<button class="rBtn" onclick="exportarContagem(\''+c.id+'\')" title="Exportar">'+sv('down2',12)+'</button>'+
      '</div></td></tr>';
    }).join('')+'</tbody></table>'
   :'<div class="mvVazio">'+sv('box',26)+'<b>Nenhuma contagem no período</b>'+
    '<span>Clique em <b>Realizar nova contagem</b> para começar.</span></div>')+
   '</div></div></div>';
  rodape(lista.length+' contagens no período');
}
function filtrarContagens(){CT2.de=$('ctDe').value;CT2.ate=$('ctAte').value;telaContagem();}
function mesAtualCT(){
  var d=new Date();
  CT2.de=new Date(d.getFullYear(),d.getMonth(),1).toISOString().slice(0,10);
  CT2.ate=hojeISO();telaContagem();
}
function verTodasContagens(){CT2.de='';CT2.ate='';telaContagem();}
function voltarContagem(){CT2.aba='hist';telaContagem();}
function novaContagem(){
  CT2.aba='nova';CT2.cont={};CT2.custo={};CT2.busca='';CT2.grupo='';
  CT2.data=hojeISO();
  telaContagem();
}
/* trocar a data muda o saldo com que TUDO na folha compara */
function mudarDataContagem(v){
  CT2.data=v||hojeISO();
  if(CT2.data>hojeISO()){CT2.data=hojeISO();toast('A contagem não pode ser de um dia que ainda não chegou.');}
  telaContagem();
}
/* ==========================================================
   ONTEM E O DIA ANTERIOR DA LOJA, NAO O DE GREENWICH

   A primeira versao deste botao fazia `new Date()`, tirava um dia e
   cortava o `toISOString()`. Entre 21h e a meia-noite em Santa Fe do
   Sul ja e o dia seguinte em Greenwich — entao "ontem" devolvia HOJE,
   e a contagem que a loja faz depois de fechar (o caixa fecha 22:30)
   nasceria com a data errada, calada.

   A rolagem do relogio pegou isso na bateria, as 21h. Agora o dia sai
   do proprio `hojeISO()`, que ja e o dia da loja, e a subtracao e feita
   ao meio-dia — hora que nenhum fuso empurra para o dia vizinho.
   ========================================================== */
function diaAnteriorDaLoja(){
  var h=hojeISO();
  var d=new Date(h+'T12:00:00');
  d.setDate(d.getDate()-1);
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+
         String(d.getDate()).padStart(2,'0');
}
function contagemDeOntem(){ mudarDataContagem(diaAnteriorDaLoja()); }
function verDivergencias(id,tipo){
  var c=(DB.contagens||[]).find(function(x){return x.id===id});
  if(!c)return;
  var itens=(c.itens||[]).filter(function(x){
    return tipo==='sobra'?x.diferenca>0.0001:x.diferenca<-0.0001;
  }).sort(function(a,b){return Math.abs(b.valor)-Math.abs(a.valor)});
  var tot=itens.reduce(function(a,x){return a+Math.abs(x.valor)},0);
  var h='<div class="mdB">'+
  '<div class="acHead"><div class="av3" style="width:40px;height:40px;background:'+
   (tipo==='sobra'?'var(--acc-soft);color:var(--acc-d)':'var(--red-soft);color:var(--red)')+'">'+
   sv(tipo==='sobra'?'up3':'dn',18)+'</div>'+
  '<div><b>'+(tipo==='sobra'?'Itens que sobraram':'Itens que faltaram')+'</b>'+
  '<span>Contagem de '+dataBR(c.data)+' · '+itens.length+' item(ns) · total R$ '+money(tot)+'</span></div></div>'+
  '<div class="blk" style="margin:0;max-width:none;padding:0;overflow:hidden">'+
   '<div class="acTabW" style="max-height:360px"><table class="acTab"><thead><tr>'+
    '<th>Ingrediente</th><th style="width:110px;text-align:right">No sistema</th>'+
    '<th style="width:110px;text-align:right">Contado</th>'+
    '<th style="width:110px;text-align:right">Diferença</th>'+
    '<th style="width:120px;text-align:right">Valor</th></tr></thead><tbody>'+
    itens.map(function(x){
      return '<tr><td><b>'+E(x.nome)+'</b></td>'+
      '<td style="text-align:right">'+fmtQt(x.sistema)+' '+un(x.unidade).ab+'</td>'+
      '<td style="text-align:right">'+fmtQt(x.conferido)+' '+un(x.unidade).ab+'</td>'+
      '<td style="text-align:right"><b class="'+(x.diferenca>0?'vg':'vr')+'">'+
       (x.diferenca>0?'+':'')+fmtQt(x.diferenca)+' '+un(x.unidade).ab+'</b></td>'+
      '<td style="text-align:right"><b class="'+(x.valor>0?'vg':'vr')+'">R$ '+money(Math.abs(x.valor))+'</b></td></tr>';
    }).join('')+'</tbody>'+
    '<tfoot><tr><td colspan="4"><b>Total</b></td>'+
    '<td style="text-align:right"><b class="'+(tipo==='sobra'?'vg':'vr')+'">R$ '+money(tot)+'</b></td></tr></tfoot>'+
    '</table></div></div></div>';
  var o=document.createElement('div');o.className='mdOv';o.id='mdOv';
  o.innerHTML='<div class="mdBox lg"><div class="mdH"><b>'+(tipo==='sobra'?'Sobras':'Perdas')+'</b>'+
  '<button onclick="fecharModal()">&times;</button></div>'+h+
  '<div class="mdF"><button class="btnP2" onclick="fecharModal()">Fechar</button></div></div>';
  document.body.appendChild(o);
  fecharSoForaDeVerdade(o);
}

/* ---------- folha de contagem ---------- */
function telaContagemNova(){
  var lista=itensEstoque().filter(function(i){
    if(CT2.grupo&&i.grupoId!==CT2.grupo)return false;
    if(CT2.busca){
      var q=CT2.busca.toLowerCase();
      if((i.nome||'').toLowerCase().indexOf(q)<0&&String(i.codigo||'').indexOf(q)<0)return false;
    }
    return true;
  }).sort(function(a,b){return (a.nome||'').localeCompare(b.nome||'')});

  $('content').innerHTML='<div class="etWrap ctCheia">'+
   '<div class="etTopo" style="flex:none">'+
    '<button class="btnP2" onclick="voltarContagem()">'+sv('cr2',13)+' Voltar</button>'+
    '<div><h1>Nova contagem</h1><p>'+
     (contagemRetroativa()
      ?'Contagem de <b>'+dataBR(dataDaContagem())+'</b> — o que sobrou no fim daquele dia, '+
       'depois de toda a venda. As vendas de depois continuam valendo.'
      :'Informe a quantidade contada. O sistema calcula a diferença.')+'</p></div>'+
    '<div class="etTot" id="ctResumo">'+resumoContagem(lista)+'</div>'+
    '<button class="btnP2 ok" onclick="fecharContagem()">'+sv('check',13)+' Finalizar contagem</button>'+
   '</div>'+
   '<div class="etFiltros" style="flex:none">'+
    '<div class="f2" style="max-width:172px"><label>Data da contagem</label>'+
     '<input type="date" id="ctData" max="'+hojeISO()+'" value="'+dataDaContagem()+'" '+
     'onchange="mudarDataContagem(this.value)"></div>'+
    (contagemRetroativa()?'':'<button class="btnP2" onclick="contagemDeOntem()">Ontem</button>')+
    '<div class="f2 gw2"><label>Buscar</label><input id="ctB" value="'+E(CT2.busca)+'" placeholder="nome ou código"></div>'+
    '<div class="f2"><label>Grupo</label><select onchange="CT2.grupo=this.value;telaContagem()">'+
     '<option value="">Todos</option>'+
     (DB.gruposIng||[]).map(function(g){return '<option value="'+g.id+'"'+(CT2.grupo===g.id?' selected':'')+'>'+E(g.nome)+'</option>'}).join('')+
    '</select></div>'+
    '<button class="btnP2" onclick="preencherContagem()">Preencher com o sistema</button>'+
    '<button class="btnP2" onclick="CT2.cont={};CT2.custo={};telaContagem()">Limpar</button>'+
   '</div>'+
   '<div class="etTabW">'+
   (lista.length?'<table class="etTab ctTab"><thead><tr>'+
    '<th style="width:82px">Código</th><th>Ingrediente</th>'+
    '<th style="width:130px">Grupo</th>'+
    '<th style="width:118px;text-align:right">'+
     (contagemRetroativa()?'Qtd. em '+dataBR(dataDaContagem()):'Qtd. no sistema')+'</th>'+
    '<th style="width:130px;text-align:right">Qtd. conferida</th>'+
    '<th style="width:120px;text-align:right">Diferença</th>'+
    '<th style="width:118px">Custo médio</th>'+
    '<th style="width:130px;text-align:right">Valor da diferença</th></tr></thead><tbody>'+
    lista.map(function(i){return linhaContagem(i)}).join('')+'</tbody>'+
    '<tfoot><tr><td colspan="5"><b>Resultado da contagem</b></td>'+
    '<td colspan="2" style="text-align:right" id="ctRod">—</td>'+
    '<td style="text-align:right" id="ctRes">—</td></tr></tfoot></table>'
   :'<div class="mvVazio">'+sv('box',26)+'<b>Nenhum item para contar</b></div>')+
   '</div></div>';
  if($('ctB'))$('ctB').oninput=function(){CT2.busca=this.value;var p=this.selectionStart;telaContagem();
    var n2=$('ctB');if(n2){n2.focus();n2.setSelectionRange(p,p);}};
  ligarContagem();
  atualizaContagem();
}
function linhaContagem(i){
  var g=grupoIng(i.grupoId);
  var sis=sistemaNaContagem(i);
  var c=CT2.cont[i.id];
  var tem=(c!==undefined&&c!=='');
  var d=tem?((parseFloat(c)||0)-sis):0;
  var v=d*custoCont(i);
  return '<tr id="lc-'+i.id+'" class="'+(tem?(Math.abs(d)<0.0001?'ok4':(d>0?'mais':'menos')):'')+'">'+
  '<td>'+E(i.codigo)+'</td><td><b>'+E(i.nome)+'</b></td>'+
  '<td>'+E(g?g.nome:'—')+'</td>'+
  '<td style="text-align:right">'+fmtQt(sis)+' '+un(i.unidade).ab+'</td>'+
  '<td><input class="ctIn" data-id="'+i.id+'" type="number" step="0.001" value="'+(tem?c:'')+'" placeholder="—"></td>'+
  '<td style="text-align:right" class="cDif2">'+(tem
    ?'<b class="'+(d>0?'vg':d<0?'vr':'')+'">'+(d>0?'+':'')+fmtQt(d)+' '+un(i.unidade).ab+'</b>'
    :'<span style="color:var(--ink-3)">—</span>')+'</td>'+
  '<td><input class="ctCu" data-id="'+i.id+'" type="number" step="0.0001" min="0" '+
   'value="'+(CT2.custo[i.id]!==undefined?CT2.custo[i.id]:'')+'" placeholder="'+money(custoAtual(i))+'"></td>'+
  '<td style="text-align:right" class="cVal2">'+(tem
    ?'<b class="'+(v>0?'vg':v<0?'vr':'')+'">'+(v>0?'+ ':v<0?'- ':'')+'R$ '+money(Math.abs(v))+'</b>'
    :'<span style="color:var(--ink-3)">—</span>')+'</td></tr>';
}
function resumoContagem(lista){
  var perda=0,ganho=0,conf=0;
  (lista||itensEstoque()).forEach(function(i){
    var c=CT2.cont[i.id];
    if(c===undefined||c==='')return;
    conf++;
    var d=(parseFloat(c)||0)-sistemaNaContagem(i);
    var v=d*custoCont(i);
    if(d<0)perda+=v; else ganho+=v;
  });
  return '<div class="etT"><span>Conferidos</span><b>'+conf+'</b></div>'+
   '<div class="etT"><span>Sobra</span><b class="vg">R$ '+money(ganho)+'</b></div>'+
   '<div class="etT"><span>Perda</span><b class="vr">R$ '+money(Math.abs(perda))+'</b></div>'+
   '<div class="etT dest"><span>Resultado</span><b class="'+((ganho+perda)>=0?'vg':'vr')+'">R$ '+money(ganho+perda)+'</b></div>';
}
/* atualiza só a linha, sem redesenhar a tela */
function atualizaLinhaCont(id){
  var i=itemEstoque(id);if(!i)return;
  var tr=document.getElementById('lc-'+id);if(!tr)return;
  var sis=sistemaNaContagem(i);
  var c=CT2.cont[id];
  var tem=(c!==undefined&&c!=='');
  var d=tem?((parseFloat(c)||0)-sis):0;
  var v=d*custoCont(i);
  tr.className=tem?(Math.abs(d)<0.0001?'ok4':(d>0?'mais':'menos')):'';
  var cd=tr.querySelector('.cDif2'),cv=tr.querySelector('.cVal2');
  if(cd)cd.innerHTML=tem?('<b class="'+(d>0?'vg':d<0?'vr':'')+'">'+(d>0?'+':'')+fmtQt(d)+' '+un(i.unidade).ab+'</b>')
    :'<span style="color:var(--ink-3)">—</span>';
  if(cv)cv.innerHTML=tem?('<b class="'+(v>0?'vg':v<0?'vr':'')+'">'+(v>0?'+ ':v<0?'- ':'')+'R$ '+money(Math.abs(v))+'</b>')
    :'<span style="color:var(--ink-3)">—</span>';
  atualizaContagem();
}
function atualizaContagem(){
  var box=$('ctResumo');
  if(box)box.innerHTML=resumoContagem(itensEstoque());
  var perda=0,ganho=0;
  itensEstoque().forEach(function(i){
    var c=CT2.cont[i.id];
    if(c===undefined||c==='')return;
    var d=(parseFloat(c)||0)-sistemaNaContagem(i);
    var v=d*custoCont(i);
    if(d<0)perda+=v; else ganho+=v;
  });
  var r=$('ctRod'),t=$('ctRes');
  if(r)r.innerHTML='Sobra R$ '+money(ganho)+' · Perda R$ '+money(Math.abs(perda));
  if(t)t.innerHTML='<b class="'+((ganho+perda)>=0?'vg':'vr')+'">R$ '+money(ganho+perda)+'</b>';
}
function ligarContagem(){
  var cus=document.querySelectorAll('.ctCu');
  for(var j=0;j<cus.length;j++){
    cus[j].oninput=function(){
      var id=this.getAttribute('data-id');
      if(this.value==='')delete CT2.custo[id]; else CT2.custo[id]=this.value;
      atualizaLinhaCont(id);
    };
  }
  var ins=document.querySelectorAll('.ctIn');
  for(var i=0;i<ins.length;i++){
    ins[i].oninput=function(){
      CT2.cont[this.getAttribute('data-id')]=this.value;
      atualizaLinhaCont(this.getAttribute('data-id'));
    };
    ins[i].onkeydown=function(e){
      if(e.key==='Enter'){
        e.preventDefault();
        var todos=document.querySelectorAll('.ctIn');
        for(var k=0;k<todos.length;k++)if(todos[k]===this&&todos[k+1]){
          todos[k+1].focus();todos[k+1].select();break;}
      }
    };
  }
}
function preencherContagem(){
  itensEstoque().forEach(function(i){CT2.cont[i.id]=String(sistemaNaContagem(i))});
  telaContagem();
  toast('Preenchido com o estoque do sistema — ajuste o que estiver diferente.');
}
async function fecharContagem(){
  baseMov();
  var linhas=[],det=[],precos=[],perda=0,ganho=0;
  itensEstoque().forEach(function(i){
    var c=CT2.cont[i.id];
    if(c===undefined||c==='')return;
    var sis=sistemaNaContagem(i);
    var conf=parseFloat(c)||0;
    var d=+(conf-sis).toFixed(4);
    var cAnt=custoAtual(i), cNovo=custoCont(i);
    var mudouCusto=Math.abs(cNovo-cAnt)>0.00005;
    var v=d*cNovo;
    det.push({insumoId:i.id,nome:i.nome,unidade:i.unidade,sistema:sis,conferido:conf,
      diferenca:d,custo:cNovo,custoAnterior:cAnt,custoCorrigido:mudouCusto,valor:arred(v)});
    if(mudouCusto)precos.push({item:i,de:cAnt,para:cNovo});
    if(d<0)perda+=v; else ganho+=v;
    if(Math.abs(d)<0.0001)return;
    linhas.push({insumoId:i.id,nome:i.nome,unidade:i.unidade,qtd:Math.abs(d),
      custo:cNovo,direcao:(d>0?'entrada':'saida'),origem:'contagem',
      sistema:sis,conferido:conf,diferenca:d});
  });
  if(!det.length){toast('Informe a quantidade conferida de ao menos um item.');return;}
  /* mexer em preco atinge toda ficha que usa o item: avisar antes, com nome e valor */
  var avisoPreco='';
  if(precos.length){
    avisoPreco='\n\nCUSTO CORRIGIDO em '+precos.length+' item(ns):\n'+
      precos.slice(0,8).map(function(p2){
        return '· '+p2.item.nome+': R$ '+money(p2.de)+' → R$ '+money(p2.para);
      }).join('\n')+
      (precos.length>8?'\n· e mais '+(precos.length-8)+'...':'')+
      '\n\nO novo custo passa a valer em todas as fichas técnicas que usam esses itens.';
  }
  var _dt=dataDaContagem();
  var _retro=contagemRetroativa();
  if(!await pergunta('Finalizar a contagem?\n\n'+
    'Data da contagem: '+dataBR(_dt)+
    (_retro?' (fim do dia, depois de toda a venda)':' (hoje)')+'\n\n'+
    det.length+' item(ns) conferido(s), '+linhas.length+' com diferença.\n'+
    'Sobra R$ '+money(ganho)+' · Perda R$ '+money(Math.abs(perda))+'\n\n'+
    (_retro
      ?'A diferença foi achada contra o estoque de '+dataBR(_dt)+' e será aplicada ao '+
       'estoque de hoje — o que a loja vendeu depois daquele dia continua valendo.\n\n'
      :'')+
    'O estoque será ajustado e o lançamento vai para a movimentação.'+avisoPreco))return;
  /* grava o custo antes do ajuste, para a movimentacao ja usar o valor novo */
  precos.forEach(function(p2){
    p2.item.custo=p2.para;
    p2.item.custoUltima=p2.para;
    p2.item.modoCusto='manual';
  });
  /* ==========================================================
     O AJUSTE LEVA A DATA DA CONTAGEM, NAO A DE HOJE

     `saldoNaData` desfaz os movimentos POSTERIORES a data pedida. Se o
     ajuste ficasse com a data de hoje, ele seria desfeito junto — e uma
     segunda contagem do mesmo dia mostraria a mesma divergencia de
     novo, como se o primeiro ajuste nunca tivesse acontecido.

     Com a data da contagem, o saldo daquele dia passa a ser exatamente
     o que foi contado, e o de hoje ja nasce corrigido.
     ========================================================== */
  var mov={id:uid('mv'),data:_dt,hora:agoraHM(),motivoId:'mv_cont',
    identificacao:'Contagem '+dataBR(_dt),
    obs:det.length+' itens conferidos'+(_retro?' · lançada em '+dataBR(hojeISO()):''),
    linhas:linhas,origem:'contagem'};
  DB.movEst.push(mov);
  aplicarMovimento(mov);
  DB.contagens.push({id:uid('ct'),data:_dt,hora:agoraHM(),
    lancadaEm:hojeISO(),retroativa:_retro,movId:mov.id,
    itens:det,perda:+perda.toFixed(2),ganho:+ganho.toFixed(2),
    resultado:+(ganho+perda).toFixed(2),loja:lojaAtual(),sucursalId:lojaAtualId(),
    precos:precos.map(function(p2){return {insumoId:p2.item.id,nome:p2.item.nome,de:p2.de,para:p2.para}})});
  CT2.cont={};CT2.custo={};CT2.data='';CT2.aba='hist';salvar();telaContagem();
  toast('Contagem de '+dataBR(_dt)+' finalizada. Estoque ajustado'+
    (precos.length?', '+precos.length+' custo(s) atualizado(s)':'')+' e lançado na movimentação.');
}
function verContagem(id){
  var c=(DB.contagens||[]).find(function(x){return x.id===id});
  if(!c)return;
  var h='<div class="mdB">'+
  '<div class="acKpis">'+
   '<div class="acK"><span>Itens conferidos</span><b>'+(c.itens||[]).length+'</b></div>'+
   '<div class="acK"><span>Sobra</span><b class="vg">R$ '+money(c.ganho)+'</b></div>'+
   '<div class="acK"><span>Perda</span><b class="vr">R$ '+money(Math.abs(c.perda))+'</b></div>'+
   '<div class="acK dest3"><span>Resultado</span><b>R$ '+money(c.resultado)+'</b></div>'+
  '</div>'+
  '<div class="blk" style="margin:0;max-width:none;padding:0;overflow:hidden">'+
   '<div class="acTit">Itens conferidos — '+dataBR(c.data)+' '+E(c.hora||'')+'</div>'+
   '<div class="acTabW" style="max-height:340px"><table class="acTab"><thead><tr>'+
    '<th>Ingrediente</th><th style="width:110px;text-align:right">No sistema</th>'+
    '<th style="width:110px;text-align:right">Conferido</th>'+
    '<th style="width:110px;text-align:right">Diferença</th>'+
    '<th style="width:120px;text-align:right">Valor</th></tr></thead><tbody>'+
    (c.itens||[]).map(function(x){
      return '<tr><td>'+E(x.nome)+
      (x.custoCorrigido?'<br><small style="color:var(--acc-d)">custo corrigido: R$ '+
        money(x.custoAnterior)+' → R$ '+money(x.custo)+'</small>':'')+'</td>'+
      '<td style="text-align:right">'+fmtQt(x.sistema)+' '+un(x.unidade).ab+'</td>'+
      '<td style="text-align:right">'+fmtQt(x.conferido)+' '+un(x.unidade).ab+'</td>'+
      '<td style="text-align:right"><b class="'+(x.diferenca>0?'vg':x.diferenca<0?'vr':'')+'">'+
       (x.diferenca>0?'+':'')+fmtQt(x.diferenca)+'</b></td>'+
      '<td style="text-align:right" class="'+(x.valor>0?'vg':x.valor<0?'vr':'')+'">'+
       (x.valor>0?'+ ':x.valor<0?'- ':'')+'R$ '+money(Math.abs(x.valor))+'</td></tr>';
    }).join('')+'</tbody></table></div></div></div>';
  var o=document.createElement('div');o.className='mdOv';o.id='mdOv';
  o.innerHTML='<div class="mdBox xl"><div class="mdH"><b>Contagem de estoque</b>'+
  '<button onclick="fecharModal()">&times;</button></div>'+h+
  '<div class="mdF"><button class="btnP2" onclick="fecharModal()">Fechar</button>'+
  '<button class="btnP2 ok" onclick="exportarContagem(\''+c.id+'\')">'+sv('down2',13)+' Exportar</button></div></div>';
  document.body.appendChild(o);
  fecharSoForaDeVerdade(o);
}
function exportarContagem(id){
  var c=(DB.contagens||[]).find(function(x){return x.id===id});
  if(!c)return;
  /* a data da contagem abre o arquivo: sem ela, quem recebe o csv nao
     sabe se aquele estoque e o do fim do dia 31 ou o do dia 01 */
  var l=[['Contagem de',dataBR(c.data)+
    (c.retroativa&&c.lancadaEm?' (lancada em '+dataBR(c.lancadaEm)+')':'')],[],
    ['Ingrediente','Unidade','No sistema','Conferido','Diferenca','Custo','Valor']];
  (c.itens||[]).forEach(function(x){
    l.push([x.nome,un(x.unidade).ab,x.sistema,x.conferido,x.diferenca,
      String(x.custo).replace('.',','),String(x.valor).replace('.',',')]);
  });
  l.push([]);l.push(['Sobra',String(c.ganho).replace('.',',')]);
  l.push(['Perda',String(Math.abs(c.perda)).replace('.',',')]);
  l.push(['Resultado',String(c.resultado).replace('.',',')]);
  var csv=l.map(function(r){return r.map(function(x){return '"'+String(x).replace(/"/g,'""')+'"'}).join(';')}).join('\n');
  var b=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'});
  var a=document.createElement('a');a.href=URL.createObjectURL(b);
  a.download='nexor-contagem-'+c.data+'.csv';document.body.appendChild(a);a.click();
  setTimeout(function(){a.remove()},400);
  toast('Contagem exportada.');
}

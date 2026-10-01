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
/* ==========================================================
   O QUE ESTA VENCENDO (RDS 14)

   O razao de lotes existe para responder duas perguntas, e as duas so
   valem se alguem for avisado: o que ja venceu, e o que vence nos
   proximos dias. Um relatorio que a pessoa precisa lembrar de abrir nao
   evita perda nenhuma — por isso o aviso fica na tela do estoque, que e
   onde quem cuida disso passa.

   O prazo de sete dias e o da reposicao semanal da gelateria: e o
   tempo que alguem ainda tem para usar, promover ou devolver.
   ========================================================== */
var DIAS_AVISO_VALIDADE=7;
function lotesDaUnidade(){
  var suc=lojaAtualId();
  return (DB.lotes||[]).filter(function(l){
    if(!l||!l.validade)return false;
    if(!suc)return true;
    try{ if(ehSucMatriz(suc))return true; }catch(e){}
    return (l.sucursalId||suc)===suc;
  });
}
function lotesPorValidade(){
  var hoje=hojeISO();
  var limite=new Date(); limite.setDate(limite.getDate()+DIAS_AVISO_VALIDADE);
  var ate=limite.toISOString().slice(0,10);
  var venc=[],perto=[];
  lotesDaUnidade().forEach(function(l){
    var v=String(l.validade).slice(0,10);
    if(v<hoje)venc.push(l); else if(v<=ate)perto.push(l);
  });
  var ord=function(a,b){return String(a.validade).localeCompare(String(b.validade))};
  return {vencidos:venc.sort(ord),vencendo:perto.sort(ord)};
}
function avisoValidade(){
  var r;
  try{ r=lotesPorValidade(); }catch(e){ _quieto(e,'avisoValidade'); return ''; }
  if(!r.vencidos.length&&!r.vencendo.length)return '';
  var linha=function(l){
    return E(l.itemNome||l.itemRef)+(l.lote?' · lote '+E(l.lote):'')+
      ' · '+fmtQt(Number(l.quantidade)||0)+' '+E(un(l.unidade).ab)+
      ' · vence '+dataBR(String(l.validade).slice(0,10));
  };
  var partes=[];
  if(r.vencidos.length)partes.push('<b>'+r.vencidos.length+' lote(s) vencido(s)</b>');
  if(r.vencendo.length)partes.push('<b>'+r.vencendo.length+' vence(m) em até '+
    DIAS_AVISO_VALIDADE+' dias</b>');
  return '<div class="imAviso">'+sv('help',14)+'<div>'+partes.join(' · ')+'.<br>'+
    r.vencidos.concat(r.vencendo).slice(0,6).map(linha).join('<br>')+
    ((r.vencidos.length+r.vencendo.length)>6
      ? '<br><small>e mais '+((r.vencidos.length+r.vencendo.length)-6)+'…</small>' : '')+
    '<br><small>O Joia ainda não baixa o lote mais antigo sozinho (FEFO): '+
    'o saldo não é por lote. Este aviso diz o que olhar.</small>'+
    '</div></div>';
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
   avisoValidade()+
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
var CT2={aba:'hist',busca:'',grupo:'',cont:{},custo:{},de:'',ate:'',data:'',
  _auto:false,_retomado:'',editando:''};
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
/* ==========================================================
   ATE ONDE DA PARA VOLTAR NO TEMPO (Rafael, 17/09/2026)

   `saldoNaData` acha o saldo de um dia DESFAZENDO, um a um, os
   movimentos que vieram depois dele. Isso so funciona enquanto este
   aparelho TEM esses movimentos: o download traz uma janela de
   `DIAS_JANELA` dias. Pedir um dia anterior a essa janela devolve um
   numero incompleto — e, calado, ele viraria a "diferenca" de uma
   contagem, com ajuste de estoque e tudo.

   Numero que pode estar errado precisa dizer que pode estar errado. A
   tela avisa, e a finalizacao pergunta de novo antes de gravar.
   ========================================================== */
function limiteContagemRetroativa(){
  var dias=(typeof DIAS_JANELA!=='undefined'&&DIAS_JANELA)?DIAS_JANELA:90;
  try{ return diasAtrasISO(dias); }catch(e){ return ''; }
}
function contagemForaDaJanela(){
  var lim=limiteContagemRetroativa();
  return !!(lim&&dataDaContagem()<lim);
}
function sistemaNaContagem(i){
  if(!i)return 0;
  /* na edição, o item que já estava na contagem compara com o sistema
     de ANTES dela — é essa a diferença que o relatório mostra */
  var o=(CT2.editando&&typeof itemOriginalDaEdicao==='function')?itemOriginalDaEdicao(i.id):null;
  if(o)return Number(o.sistema)||0;
  if(!contagemRetroativa())return Number(i.estoqueAtual)||0;
  try{ return Number(saldoNaData(i.id,dataDaContagem(),lojaAtualId()))||0; }
  catch(e){ _quieto(e,'sistemaNaContagem'); return Number(i.estoqueAtual)||0; }
}
/* custo que vale na tela: o digitado, se houver; na edição, o que a
   contagem usou; senão o do cadastro */
function custoCont(i){
  if(!i)return 0;
  var v=CT2.custo[i.id];
  var q=qtdContada(v);
  if(typeof q==='number'&&!isNaN(q))return q;
  var o=(CT2.editando&&typeof itemOriginalDaEdicao==='function')?itemOriginalDaEdicao(i.id):null;
  if(o&&isFinite(Number(o.custo)))return Number(o.custo);
  return custoAtual(i);
}
/* ==========================================================
   O NÚMERO DIGITADO NA CONTAGEM (Rafael, 30/09/2026 — véspera da
   contagem que abre o mês)

   O campo era `type="number"`. Em navegador em português, "1,5"
   digitado ali vira campo VAZIO para o sistema — e a linha contada
   voltava a não contada, calada. Pior ainda seria o contrário: texto
   torto virando zero e zero virando perda.

   Agora o campo aceita o jeito de quem conta — 1,5 · 1.5 · 1.250,5 — e
   devolve três respostas diferentes, nunca misturadas:
     null  → não contado (campo vazio)
     NaN   → digitado errado (a linha fica vermelha e a finalização trava)
     número → contado
   ========================================================== */
function qtdContada(v){
  if(v===undefined||v===null)return null;
  var s=String(v).replace(/\s/g,'');
  if(s==='')return null;
  if(s.indexOf(',')>=0)s=s.replace(/\./g,'').replace(',','.');
  if(!/^(\d+(\.\d*)?|\.\d+)$/.test(s))return NaN;
  return parseFloat(s);
}
function contadoOk(v){ var q=qtdContada(v); return typeof q==='number'&&!isNaN(q); }
function contadoErrado(v){ var q=qtdContada(v); return typeof q==='number'&&isNaN(q); }
/* o número no formato que a conta usa ("1,5" → "1.5"); vazio fica vazio */
function normCont(v){ var q=qtdContada(v); return (typeof q==='number'&&!isNaN(q))?String(q):(v==null?'':String(v)); }
/* o item como estava na contagem que está sendo editada (ou null) */
function itemOriginalDaEdicao(id){
  if(!CT2.editando)return null;
  var c=(DB.contagens||[]).find(function(x){return x.id===CT2.editando});
  if(!c)return null;
  return (c.itens||[]).find(function(x){return x.insumoId===id})||null;
}
/* ==========================================================
   SAIR DA TELA NAO PODE PERDER A CONTAGEM

   O Rafael, em 01/09/2026: "se eu estiver fazendo a contagem e estiver
   na metade e eu sair da tela, tudo que eu digitei precisa ficar la. So
   apagar quando eu clicar em finalizar a contagem."

   Desde a V278 o que ele digita ja e guardado no aparelho a cada tecla.
   Faltava a outra metade: ENCONTRAR a folha depois. Quem saia da
   contagem — clicando em Voltar, indo para outro modulo, ou fechando o
   navegador — voltava para o HISTORICO, uma lista de contagens
   finalizadas, sem nada dizendo que havia uma folha pela metade
   esperando. Do lado de quem esta contando, isso e identico a ter
   perdido: a tela nao mostra o trabalho dele em lugar nenhum.

   Agora, enquanto houver folha em andamento, o historico abre com ela
   anunciada em cima, dizendo quantos itens ja foram digitados e desde
   quando, com o botao de continuar do lado. A folha so some quando ele
   clicar em Finalizar — ou quando ele mesmo mandar comecar do zero.
   ========================================================== */
function faixaContagemEmAndamento(){
  var r=(typeof lerRascunhoContagem==='function')?lerRascunhoContagem():null;
  if(!r)return '';
  var n=Object.keys(r.cont||{}).filter(function(k){
    return String(r.cont[k]||'').trim()!==''; }).length;
  if(!n)return '';
  var q=new Date(r.quando);
  var quando=isNaN(q)?'':' desde as '+q.toLocaleTimeString('pt-BR').slice(0,5);
  return '<div class="cmdFaixa cmdAlerta" style="flex:none">'+sv('help',14)+
   '<div><b>'+(r.editando?'Você tem uma edição de contagem em andamento.':'Você tem uma contagem em andamento.')+
   '</b> '+n+' item(ns) já digitado(s)'+quando+
   (r.data?', para o dia '+dataBR(r.data):'')+
   '. Ela fica guardada aqui até você finalizar.</div>'+
   '<button class="btnP2 ok" onclick="novaContagem()">Continuar a contagem</button>'+
   '<button class="btnP2" onclick="descartarRascunhoContagem()">Descartar</button></div>';
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
  /* ==========================================================
     NO DIA 1o DO MES A CONTAGEM DE ONTEM SUMIA DA TELA

     O historico abre filtrando do dia 1o do mes ate hoje. Em 01/09/2026
     isso vira "de 01/09 ate 01/09" — e a contagem de 31/08, lancada
     naquela manha, nao aparecia em lugar nenhum. Ela estava gravada,
     ajustou o estoque, entrou na movimentacao; so nao estava na lista.
     Quem conta de manha e lanca como o dia anterior — que e o jeito que
     a loja trabalha — encontra a tela vazia todo comeco de mes e conclui
     que o sistema perdeu a contagem.

     A regra agora tem uma segunda metade: se o mes ainda nao tem
     contagem nenhuma, o periodo automatico nao esconde nada — mostra
     todas. Quando ha contagem no mes, a tela continua exatamente como
     era. O periodo escolhido A MAO nunca e mexido: quem filtrou quis
     aquilo, mesmo que de vazio.

     A data tambem passou a sair do dia DA LOJA (`hojeISO`) em vez de
     `toISOString`, que devolve o dia de Greenwich e vira o dia seguinte
     depois das 21h em Sao Paulo.
     ========================================================== */
  if(!CT2.de){
    var _h=hojeISO();
    CT2.de=_h.slice(0,8)+'01';
    CT2.ate=_h;
    CT2._auto=true;
  }
  /* inventario e de UMA loja: o historico nunca mistura. A matriz ve o
     dela; contagem antiga, sem carimbo, fica com a matriz. */
  var _suc=lojaAtualId();
  var lista=(DB.contagens||[]).filter(function(c){
    var s=c.sucursalId||c.loja||'';
    if(s?(s!==_suc):!ehSucMatriz(_suc))return false;
    return (!CT2.de||c.data>=CT2.de)&&(!CT2.ate||c.data<=CT2.ate);
  }).sort(function(a,b){return (b.data+b.hora).localeCompare(a.data+a.hora)});
  /* periodo automatico que esconderia tudo nao serve para nada */
  if(!lista.length&&CT2._auto&&(DB.contagens||[]).length){
    CT2.de='';CT2.ate='';
    lista=(DB.contagens||[]).filter(function(c){
      var s2=c.sucursalId||c.loja||'';
      return s2?(s2===_suc):ehSucMatriz(_suc);
    }).sort(function(a,b){return (b.data+b.hora).localeCompare(a.data+a.hora)});
  }
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
    '<button class="btnP2 ok" onclick="novaContagem()">'+sv('plus',14)+
      (lerRascunhoContagem()?' Continuar a contagem':' Realizar nova contagem')+'</button>'+
   '</div>'+
   faixaContagemEmAndamento()+
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
      var nEd=edicoesDaContagem(c).length;
      return '<tr class="ctLinhaHist" onclick="if(!event.target.closest(\'button\'))verContagem(\''+c.id+'\')">'+
       '<td><b>'+dataBR(c.data)+'</b><small>'+E(c.hora||'')+
       (c.retroativa&&c.lancadaEm?' · lançada em '+dataBR(c.lancadaEm):'')+
       (nEd?' · corrigida':'')+'</small></td>'+
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
function filtrarContagens(){
  CT2.de=$('ctDe').value;CT2.ate=$('ctAte').value;CT2._auto=false;telaContagem();}
function mesAtualCT(){
  var _h=hojeISO();
  CT2.de=_h.slice(0,8)+'01';
  CT2.ate=_h;CT2._auto=false;telaContagem();
}
function verTodasContagens(){CT2.de='';CT2.ate='';CT2._auto=false;telaContagem();}
function voltarContagem(){CT2.aba='hist';telaContagem();}
/* ==========================================================
   A FOLHA DA CONTAGEM SO EXISTIA NA MEMORIA DA PAGINA

   O Rafael, no meio do inventario em 01/09/2026: "se eu atualizar, tudo
   que eu preenchi eu vou perder, nao e isso?" Era isso mesmo. O que ele
   digitava ficava em `CT2.cont`, uma variavel da pagina; `salvar()` so
   era chamado no fim, ao finalizar. Recarregar, fechar sem querer, a
   maquina reiniciar, o navegador matar a aba por memoria — qualquer um
   desses apagava um inventario de duzentos e cinquenta itens contados a
   mao, sem aviso e sem volta. Foi so a sorte que impediu isso de
   acontecer antes.

   Agora cada numero digitado e guardado no aparelho na hora. E um
   RASCUNHO: mora numa chave propria do navegador, nao entra no `DB` e
   nao sobe para a nuvem — contagem pela metade nao e dado, e nao pode
   virar ajuste de estoque em lugar nenhum. Ao finalizar, o rascunho e
   apagado; o que vale dali em diante e a contagem gravada.

   O rascunho e de UMA unidade: quem abre a contagem em Jales nao recebe
   a folha que ficou pela metade em Santa Fe.
   ========================================================== */
var _CHAVE_RASCUNHO='nexor_contagem_rascunho', _tRascunho=null;
/* grava NA HORA, a cada tecla: a folha inteira cabe em poucos KB e a
   escrita leva menos de um milissegundo. A versão com espera de 250 ms
   perdia o último número de quem digitava e já fechava a aba. */
function guardarRascunhoContagem(){
  clearTimeout(_tRascunho);
  try{
    localStorage.setItem(_CHAVE_RASCUNHO,JSON.stringify({
      suc:lojaAtualId(),data:CT2.data||'',
      cont:CT2.cont||{},custo:CT2.custo||{},
      editando:CT2.editando||'',
      quando:new Date().toISOString()}));
  }catch(e){ _quieto(e,'guardarRascunhoContagem'); }
}
function lerRascunhoContagem(){
  try{
    var r=JSON.parse(localStorage.getItem(_CHAVE_RASCUNHO)||'null');
    if(!r||!r.cont||!Object.keys(r.cont).length)return null;
    if(r.suc&&r.suc!==lojaAtualId())return null;
    return r;
  }catch(e){ return null; }
}
function limparRascunhoContagem(){
  clearTimeout(_tRascunho);
  try{ localStorage.removeItem(_CHAVE_RASCUNHO); }catch(e){ _quieto(e,'limparRascunhoContagem'); }
}
/* ==========================================================
   O UNICO BOTAO QUE APAGA A FOLHA TEM DE PERGUNTAR

   "So apagar quando eu clicar em finalizar a contagem" — entao o botao
   que apaga sem finalizar nao pode fazer isso num clique so. Antes,
   "Limpar" zerava uma folha de duzentos itens contados a mao na hora,
   sem pergunta e sem volta. Com a folha vazia ele continua limpando
   direto: nao ha o que perder.
   ========================================================== */
async function descartarRascunhoContagem(){
  var n=Object.keys(CT2.cont||{}).filter(function(k){
    return String(CT2.cont[k]||'').trim()!==''; }).length;
  var r=lerRascunhoContagem();
  if(!n&&r)n=Object.keys(r.cont||{}).filter(function(k){
    return String(r.cont[k]||'').trim()!==''; }).length;
  if(n){
    var ok=await confirmar({
      titulo:'Apagar a contagem que está em andamento?',
      texto:'Você já digitou '+n+' item(ns). Apagar aqui não finaliza nada: '+
        'a contagem some e o estoque NÃO é ajustado.',
      aviso:'Não dá para desfazer. Se quiser guardar o que contou, feche esta '+
        'janela e clique em "Finalizar contagem".',
      ok:'Apagar mesmo assim',cancelar:'Voltar para a contagem',tipo:'perigo'});
    if(!ok)return;
  }
  limparRascunhoContagem();
  CT2.cont={};CT2.custo={};CT2._retomado='';CT2.editando='';
  CT2.data=hojeISO();
  telaContagem();
  toast(n?'Folha apagada. A contagem começa do zero.':'Folha limpa.');
}
function novaContagem(){
  CT2.aba='nova';CT2.busca='';CT2.grupo='';
  /* folha que ficou pela metade volta inteira, em vez de virar pó */
  var r=lerRascunhoContagem();
  if(r){
    CT2.cont=r.cont;CT2.custo=r.custo||{};
    CT2.data=r.data||hojeISO();
    CT2._retomado=r.quando||'';
    /* edição pela metade volta como edição — nunca como contagem nova */
    CT2.editando=(r.editando&&(DB.contagens||[]).some(function(x){return x.id===r.editando}))?r.editando:'';
  }else{
    CT2.cont={};CT2.custo={};CT2.data=hojeISO();CT2._retomado='';CT2.editando='';
  }
  telaContagem();
}
/* a folha sai do aparelho só quando ele sai: fechar a aba ou trocar de
   app no celular grava o que estiver na tela, mesmo no meio da tecla */
if(typeof window!=='undefined'&&window.addEventListener){
  var _gravarAoSair=function(){
    if(CT2&&CT2.aba==='nova'&&Object.keys(CT2.cont||{}).length)guardarRascunhoContagem();
  };
  window.addEventListener('pagehide',_gravarAoSair);
  document.addEventListener('visibilitychange',function(){
    if(document.visibilityState==='hidden')_gravarAoSair(); });
}
/* trocar a data muda o saldo com que TUDO na folha compara */
function mudarDataContagem(v){
  CT2.data=v||hojeISO();
  if(CT2.data>hojeISO()){CT2.data=hojeISO();toast('A contagem não pode ser de um dia que ainda não chegou.');}
  guardarRascunhoContagem();   /* a data escolhida faz parte da folha */
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

  var _ed=CT2.editando?(DB.contagens||[]).find(function(x){return x.id===CT2.editando}):null;
  $('content').innerHTML='<div class="etWrap ctCheia">'+
   '<div class="etTopo" style="flex:none">'+
    '<button class="btnP2" onclick="voltarContagem()">'+sv('cr2',13)+' Voltar</button>'+
    '<div><h1>'+(_ed?'Editar a contagem de '+dataBR(_ed.data):'Nova contagem')+'</h1><p>'+
     (_ed
      ?'Corrija só o que estiver errado. A correção vale para o dia '+dataBR(_ed.data)+
       ', ajusta o estoque pela diferença e fica anotada na contagem. Apagar um número não tira o item da contagem.'
      :contagemRetroativa()
      ?'Contagem de <b>'+dataBR(dataDaContagem())+'</b> — o que sobrou no fim daquele dia, '+
       'depois de toda a venda. As vendas de depois continuam valendo.'
      :'Informe a quantidade contada. O sistema calcula a diferença.')+'</p></div>'+
    '<div class="etTot" id="ctResumo">'+resumoContagem(lista)+'</div>'+
    '<button class="btnP2 ok" id="ctFinalizar" onclick="fecharContagem()">'+sv('check',13)+
      (_ed?' Salvar a correção':' Finalizar contagem')+'</button>'+
   '</div>'+
   /* a folha retomada precisa se anunciar: numero que aparece sozinho na
      tela, sem ninguem entender de onde veio, e pior do que folha vazia */
   (CT2._retomado
     ?'<div class="cmdFaixa" style="flex:none">'+sv('check',14)+
      '<div>Retomei a contagem que você tinha começado'+
      (function(){var d=new Date(CT2._retomado);
        return isNaN(d)?'':', de '+d.toLocaleTimeString('pt-BR').slice(0,5);})()+
      ' — os números que você já tinha digitado estão aqui.</div>'+
      '<button class="btnP2" onclick="descartarRascunhoContagem()">'+(_ed?'Desistir da correção':'Começar do zero')+'</button></div>'
     :'')+
   (contagemForaDaJanela()
     ?'<div class="cmdFaixa cmdAlerta" style="flex:none">'+sv('help',14)+
      '<div>Este aparelho guarda as movimentações dos últimos '+
      ((typeof DIAS_JANELA!=='undefined'&&DIAS_JANELA)?DIAS_JANELA:90)+' dias (desde '+
      dataBR(limiteContagemRetroativa())+'). Para um dia anterior a esse, a '+
      '<b>quantidade do sistema pode estar incompleta</b> — confira antes de finalizar.</div></div>'
     :'')+
   '<div class="etFiltros" style="flex:none">'+
    '<div class="f2" style="max-width:172px"><label>Data da contagem</label>'+
     '<input type="date" id="ctData" max="'+hojeISO()+'" value="'+dataDaContagem()+'" '+
     (_ed?'disabled title="A correção vale para o dia da contagem"':'onchange="mudarDataContagem(this.value)"')+'></div>'+
    (contagemRetroativa()||_ed?'':'<button class="btnP2" onclick="contagemDeOntem()">Ontem</button>')+
    '<div class="f2 gw2"><label>Buscar</label><input id="ctB" value="'+E(CT2.busca)+'" placeholder="nome ou código"></div>'+
    '<div class="f2"><label>Grupo</label><select onchange="CT2.grupo=this.value;telaContagem()">'+
     '<option value="">Todos</option>'+
     (DB.gruposIng||[]).map(function(g){return '<option value="'+g.id+'"'+(CT2.grupo===g.id?' selected':'')+'>'+E(g.nome)+'</option>'}).join('')+
    '</select></div>'+
    (_ed?'':'<button class="btnP2" onclick="preencherContagem()">Preencher com o sistema</button>')+
    '<button class="btnP2" onclick="descartarRascunhoContagem()">'+(_ed?'Desistir da correção':'Limpar')+'</button>'+
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
/* ==========================================================
   A LINHA CONTADA FICA VERDE — SEMPRE

   Quem conta duzentos itens precisa ver, rolando a folha, o que já
   contou. Antes a linha só mudava de cor pela DIFERENÇA: igual ao
   sistema ficava quase branca, e parecia não contada. Agora toda linha
   contada ganha a marca verde na borda e no campo; a cor do fundo
   continua dizendo se sobrou ou faltou. Número digitado errado deixa a
   linha vermelha e segura a finalização.
   ========================================================== */
function classeLinhaCont(tem,errado,d){
  if(errado)return 'invalido';
  if(!tem)return '';
  return 'contado '+(Math.abs(d)<0.0001?'ok4':(d>0?'mais':'menos'));
}
function linhaContagem(i){
  var g=grupoIng(i.grupoId);
  var sis=sistemaNaContagem(i);
  var c=CT2.cont[i.id];
  var tem=contadoOk(c), errado=contadoErrado(c);
  var d=tem?(qtdContada(c)-sis):0;
  var v=d*custoCont(i);
  return '<tr id="lc-'+i.id+'" class="'+classeLinhaCont(tem,errado,d)+'">'+
  '<td>'+E(i.codigo)+'</td><td><b>'+E(i.nome)+'</b></td>'+
  '<td>'+E(g?g.nome:'—')+'</td>'+
  '<td style="text-align:right">'+fmtQt(sis)+' '+un(i.unidade).ab+'</td>'+
  '<td><input class="ctIn" data-id="'+i.id+'" type="text" inputmode="decimal" autocomplete="off" '+
   'value="'+(c!==undefined&&c!==null?E(String(c)):'')+'" placeholder="—"></td>'+
  '<td style="text-align:right" class="cDif2">'+difContHtml(i,tem,errado,d)+'</td>'+
  '<td><input class="ctCu" data-id="'+i.id+'" type="text" inputmode="decimal" autocomplete="off" '+
   'value="'+(CT2.custo[i.id]!==undefined?E(String(CT2.custo[i.id])):'')+'" placeholder="'+money(custoCont(i))+'"></td>'+
  '<td style="text-align:right" class="cVal2">'+valContHtml(tem,v)+'</td></tr>';
}
function difContHtml(i,tem,errado,d){
  if(errado)return '<b class="vr">número inválido</b>';
  if(!tem)return '<span style="color:var(--ink-3)">—</span>';
  return '<b class="'+(d>0?'vg':d<0?'vr':'')+'">'+(d>0?'+':'')+fmtQt(d)+' '+un(i.unidade).ab+'</b>';
}
function valContHtml(tem,v){
  if(!tem)return '<span style="color:var(--ink-3)">—</span>';
  return '<b class="'+(v>0?'vg':v<0?'vr':'')+'">'+(v>0?'+ ':v<0?'- ':'')+'R$ '+money(Math.abs(v))+'</b>';
}
/* uma só conta de sobra e perda para o topo, o rodapé e a finalização */
function somaContagem(lista){
  var perda=0,ganho=0,conf=0,errados=0;
  (lista||itensEstoque()).forEach(function(i){
    if(contadoErrado(CT2.cont[i.id])){errados++;return;}
    var c=normCont(CT2.cont[i.id]);
    if(!contadoOk(c))return;
    conf++;
    var d=(parseFloat(c)||0)-sistemaNaContagem(i);
    var v=d*custoCont(i);
    if(d<0)perda+=v; else ganho+=v;
  });
  return {perda:perda,ganho:ganho,conf:conf,errados:errados};
}
function resumoContagem(lista){
  var s=somaContagem(lista);
  return '<div class="etT"><span>Conferidos</span><b>'+s.conf+'</b></div>'+
   '<div class="etT"><span>Sobra</span><b class="vg">R$ '+money(s.ganho)+'</b></div>'+
   '<div class="etT"><span>Perda</span><b class="vr">R$ '+money(Math.abs(s.perda))+'</b></div>'+
   '<div class="etT dest"><span>Resultado</span><b class="'+((s.ganho+s.perda)>=0?'vg':'vr')+'">R$ '+money(s.ganho+s.perda)+'</b></div>';
}
/* atualiza só a linha, sem redesenhar a tela (o cursor não sai do lugar) */
function atualizaLinhaCont(id){
  var i=itemEstoque(id);if(!i)return;
  var tr=document.getElementById('lc-'+id);if(!tr)return;
  var sis=sistemaNaContagem(i);
  var c=CT2.cont[id];
  var tem=contadoOk(c), errado=contadoErrado(c);
  var d=tem?(qtdContada(c)-sis):0;
  var v=d*custoCont(i);
  tr.className=classeLinhaCont(tem,errado,d);
  var cd=tr.querySelector('.cDif2'),cv=tr.querySelector('.cVal2');
  if(cd)cd.innerHTML=difContHtml(i,tem,errado,d);
  if(cv)cv.innerHTML=valContHtml(tem,v);
  atualizaContagem();
}
function atualizaContagem(){
  var box=$('ctResumo');
  if(box)box.innerHTML=resumoContagem(itensEstoque());
  /* o rodapé soma de novo, pela mesma porta (sistemaNaContagem) */
  var perda=0,ganho=0;
  itensEstoque().forEach(function(i){
    var c=normCont(CT2.cont[i.id]);
    if(!contadoOk(c))return;
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
      guardarRascunhoContagem();
    };
  }
  var ins=document.querySelectorAll('.ctIn');
  for(var i=0;i<ins.length;i++){
    ins[i].oninput=function(){
      var id=this.getAttribute('data-id');
      /* primeiro guarda, depois desenha. Campo vazio fica "não contado" */
      CT2.cont[this.getAttribute('data-id')]=this.value;
      guardarRascunhoContagem();
      atualizaLinhaCont(id);
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
/* preenche SÓ o que ainda está em branco: o que alguém já contou a mão
   nunca é trocado pelo número do sistema */
function preencherContagem(){
  var n=0;
  itensEstoque().forEach(function(i){
    var c=CT2.cont[i.id];
    if(c!==undefined&&String(c).trim()!=='')return;
    CT2.cont[i.id]=String(sistemaNaContagem(i));n++;
  });
  guardarRascunhoContagem();
  telaContagem();
  toast(n?'Preenchidos '+n+' item(ns) em branco com o estoque do sistema — o que você já tinha digitado ficou como estava.'
         :'Todos os itens já tinham quantidade: nada foi trocado.');
}
/* ==========================================================
   FINALIZAR UMA VEZ SÓ

   Dois cliques rápidos em "Finalizar" abriam duas perguntas; confirmar
   as duas gravava a contagem DUAS vezes e ajustava o estoque em dobro.
   A trava vale do clique até a gravação terminar.
   ========================================================== */
var _finalizandoContagem=false;
/* item digitado errado não pode ser ignorado calado nem virar zero */
function avisoContagemErrada(){
  var errados=itensEstoque().filter(function(i){return contadoErrado(CT2.cont[i.id])});
  if(!errados.length)return false;
  toast('Corrija '+errados.length+' quantidade(s) digitada(s) errado (em vermelho): '+
    errados.slice(0,3).map(function(i){return i.nome}).join(', ')+(errados.length>3?'…':''));
  var tr=document.getElementById('lc-'+errados[0].id);
  if(tr){tr.scrollIntoView({block:'center'});var inp=tr.querySelector('.ctIn');if(inp)inp.focus();}
  return true;
}
async function fecharContagem(){
  /* fechar a contagem ajusta saldo E custo de uma vez: e a acao mais
     pesada do estoque, e ate agora qualquer um com a tela fazia (RDS 20) */
  if(!exigirAcao('estoque/contagem-estoque:inventariar'))return;
  if(_finalizandoContagem)return;
  _finalizandoContagem=true;
  if(CT2.editando){
    try{ return await salvarEdicaoContagem(); }finally{ _finalizandoContagem=false; }
  }
  try{
    if(avisoContagemErrada())return;
    baseMov();
    var linhas=[],det=[],precos=[],perda=0,ganho=0;
    itensEstoque().forEach(function(i){
      var c=normCont(CT2.cont[i.id]);
      if(!contadoOk(c))return;
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
      (contagemForaDaJanela()
        ?'ATENÇÃO: este aparelho só tem as movimentações desde '+
         dataBR(limiteContagemRetroativa())+'. A quantidade do sistema nesse dia pode '+
         'estar incompleta.\n\n'
        :'')+
      'O estoque será ajustado e o lançamento vai para a movimentação.'+avisoPreco))return;
    /* grava o custo antes do ajuste, para a movimentacao ja usar o valor novo */
    var _quemC=null; try{ _quemC=usuarioLogado(); }catch(e){}
    precos.forEach(function(p2){
      /* ==========================================================
         `modoCusto='manual'` NAO FAZIA NADA

         Isto era gravado aqui e `normModo()` convertia de volta para
         'media' na leitura seguinte: a contagem achava que tinha fixado o
         custo e o sistema descartava a intencao, em silencio. Campo que
         se escreve e que ninguem le e o comeco do proximo defeito.

         O valor em si fica, e continua ficando — o custo do item passa a
         ser o digitado ate a proxima entrada. O que faltava era o RASTRO:
         quem mudou, quando, e de quanto para quanto (RDS 15).
         ========================================================== */
      p2.item.custoAjustadoDe=Number(p2.item.custo)||0;
      p2.item.custo=p2.para;
      p2.item.custoUltima=p2.para;
      p2.item.custoAjustadoEm=new Date().toISOString();
      p2.item.custoAjustadoPor=(_quemC&&_quemC.nome)||'';
      p2.item.custoAjustadoOrigem='contagem de estoque';
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
    CT2.cont={};CT2.custo={};CT2.data='';CT2._retomado='';CT2.aba='hist';
    limparRascunhoContagem();       /* a contagem foi gravada: o rascunho acabou */
    salvar();telaContagem();
    toast('Contagem de '+dataBR(_dt)+' finalizada. Estoque ajustado'+
      (precos.length?', '+precos.length+' custo(s) atualizado(s)':'')+' e lançado na movimentação.');
  }finally{ _finalizandoContagem=false; }
}
/* ==========================================================
   EDITAR A CONTAGEM (Rafael, 30/09/2026)

   "Clicou no relatório daquela contagem, tem o botão editar; editar
   naquele mesmo dia, e ficar anotado que foi feita uma modificação tal
   dia, e o que foi."

   Como a correção funciona, e por que ela é segura:
     · ela vale para o DIA da contagem — a data não muda;
     · a folha abre com o que foi contado; só o que for trocado vira
       correção. Item que não estava na contagem pode entrar;
     · o estoque recebe só a DIFERENÇA entre o número novo e o antigo,
       num movimento próprio ("Correção da contagem DD/MM"), com a data
       da contagem. Nada é apagado nem reescrito por cima;
     · cada item corrigido guarda em `edicoes` quando, quem, de quanto
       para quanto e o movimento que ajustou o estoque. O relatório
       mostra isso;
     · só a contagem MAIS RECENTE da unidade pode ser corrigida. Mexer
       numa contagem antiga depois de uma mais nova mudaria o saldo que
       a mais nova usou — e a conta dela deixaria de fechar.
   ========================================================== */
function contagemMaisRecente(c){
  if(!c)return false;
  var s=c.sucursalId||c.loja||'';
  return !(DB.contagens||[]).some(function(x){
    if(x.id===c.id)return false;
    var s2=x.sucursalId||x.loja||'';
    if(s2!==s)return false;
    return (x.data+' '+(x.hora||'')) > (c.data+' '+(c.hora||''));
  });
}
function podeEditarContagem(c){
  if(!c)return 'Contagem não encontrada.';
  if((c.sucursalId||c.loja||'')!==lojaAtualId())return 'Esta contagem é de outra unidade.';
  if(!contagemMaisRecente(c))return 'Só a contagem mais recente da unidade pode ser corrigida: já existe uma contagem depois desta.';
  return '';
}
function editarContagem(id){
  var c=(DB.contagens||[]).find(function(x){return x.id===id});
  var nao=podeEditarContagem(c);
  if(nao){toast(nao);return;}
  if(!exigirAcao('estoque/contagem-estoque:inventariar'))return;
  var r=lerRascunhoContagem();
  if(r&&r.editando!==id&&Object.keys(r.cont||{}).length){
    toast('Há uma contagem em andamento neste aparelho. Finalize ou descarte antes de corrigir outra.');
    return;
  }
  fecharModal();
  CT2.aba='nova';CT2.busca='';CT2.grupo='';
  CT2.editando=id;CT2.data=c.data;
  if(r&&r.editando===id){
    CT2.cont=r.cont;CT2.custo=r.custo||{};CT2._retomado=r.quando||'';
  }else{
    CT2.cont={};CT2.custo={};CT2._retomado='';
    (c.itens||[]).forEach(function(x){ CT2.cont[x.insumoId]=String(x.conferido); });
    guardarRascunhoContagem();
  }
  telaContagem();
}
async function salvarEdicaoContagem(){
  if(!exigirAcao('estoque/contagem-estoque:inventariar'))return;
  var c=(DB.contagens||[]).find(function(x){return x.id===CT2.editando});
  var nao=podeEditarContagem(c);
  if(nao){toast(nao);return;}
  if(avisoContagemErrada())return;
  baseMov();
  var quem=null; try{ quem=usuarioLogado(); }catch(e){}
  var agora=new Date().toISOString(), porQuem=(quem&&quem.nome)||'';
  var linhas=[], mudancas=[], precos=[];
  itensEstoque().forEach(function(i){
    var cRaw=CT2.cont[i.id];
    var orig=(c.itens||[]).find(function(x){return x.insumoId===i.id})||null;
    /* campo em branco = continua como estava (o original não some) */
    if(!contadoOk(cRaw))return;
    var novo=qtdContada(cRaw);
    var cAnt=custoAtual(i), cNovo=custoCont(i);
    var mudouCusto=CT2.custo[i.id]!==undefined&&contadoOk(CT2.custo[i.id])&&Math.abs(cNovo-cAnt)>0.00005;
    var antes=orig?Number(orig.conferido)||0:null;
    var mudouQtd=orig?Math.abs(novo-antes)>0.00005:true;
    if(!mudouQtd&&!mudouCusto)return;
    /* o estoque recebe só a diferença entre o número novo e o que valia */
    var sisOrig=orig?Number(orig.sistema)||0:sistemaNaContagem(i);
    var base=orig?antes:sisOrig;
    var delta=+(novo-base).toFixed(4);
    if(Math.abs(delta)>=0.0001){
      linhas.push({insumoId:i.id,nome:i.nome,unidade:i.unidade,qtd:Math.abs(delta),
        custo:cNovo,direcao:(delta>0?'entrada':'saida'),origem:'contagem',
        sistema:base,conferido:novo,diferenca:delta,correcao:true});
    }
    if(mudouCusto)precos.push({item:i,de:cAnt,para:cNovo});
    mudancas.push({i:i,orig:orig,novo:novo,antes:antes,sisOrig:sisOrig,custo:cNovo,
      custoAntes:orig?Number(orig.custo)||0:cAnt,mudouCusto:mudouCusto,mudouQtd:mudouQtd});
  });
  if(!mudancas.length){toast('Nada mudou na contagem: nenhuma correção para salvar.');return;}
  var ok=await pergunta('Salvar a correção da contagem de '+dataBR(c.data)+'?\n\n'+
    mudancas.slice(0,10).map(function(m){
      return '· '+m.i.nome+': '+(m.orig?fmtQt(m.antes):'não contado')+' → '+fmtQt(m.novo)+' '+un(m.i.unidade).ab+
        (m.mudouCusto?' (custo R$ '+money(m.custoAntes)+' → R$ '+money(m.custo)+')':'');
    }).join('\n')+(mudancas.length>10?'\n· e mais '+(mudancas.length-10)+'...':'')+
    '\n\nO estoque recebe só a diferença, com a data de '+dataBR(c.data)+
    ', e a correção fica anotada na contagem com a data de hoje e o seu nome.');
  if(!ok)return;
  precos.forEach(function(p2){
    p2.item.custoAjustadoDe=Number(p2.item.custo)||0;
    p2.item.custo=p2.para;p2.item.custoUltima=p2.para;
    p2.item.custoAjustadoEm=agora;p2.item.custoAjustadoPor=porQuem;
    p2.item.custoAjustadoOrigem='correção da contagem de estoque';
  });
  var mov=null;
  if(linhas.length){
    mov={id:uid('mv'),data:c.data,hora:agoraHM(),motivoId:'mv_cont',
      identificacao:'Correção da contagem '+dataBR(c.data),
      obs:linhas.length+' item(ns) corrigido(s) em '+dataBR(hojeISO())+(porQuem?' por '+porQuem:''),
      linhas:linhas,origem:'contagem'};
    DB.movEst.push(mov);
    aplicarMovimento(mov);
  }
  var itens=(c.itens||[]).slice();
  mudancas.forEach(function(m){
    var reg={em:agora,por:porQuem,de:m.orig?m.antes:null,para:m.novo,
      custoDe:m.mudouCusto?m.custoAntes:undefined,custoPara:m.mudouCusto?m.custo:undefined,
      movId:mov?mov.id:''};
    var dif=+(m.novo-m.sisOrig).toFixed(4);
    var novoItem={insumoId:m.i.id,nome:m.i.nome,unidade:m.i.unidade,sistema:m.sisOrig,
      conferido:m.novo,diferenca:dif,custo:m.custo,
      custoAnterior:m.orig?m.orig.custoAnterior:custoAtual(m.i),
      custoCorrigido:(m.orig&&m.orig.custoCorrigido)||m.mudouCusto,
      valor:arred(dif*m.custo),
      edicoes:((m.orig&&m.orig.edicoes)||[]).concat([reg])};
    var k=itens.findIndex(function(x){return x.insumoId===m.i.id});
    if(k>=0)itens[k]=Object.assign({},itens[k],novoItem); else itens.push(novoItem);
  });
  var perda=0,ganho=0;
  itens.forEach(function(x){var v=Number(x.valor)||0; if(v<0)perda+=v; else ganho+=v;});
  c.itens=itens;
  c.perda=+perda.toFixed(2);c.ganho=+ganho.toFixed(2);c.resultado=+(ganho+perda).toFixed(2);
  if(precos.length)c.precos=(c.precos||[]).concat(precos.map(function(p2){
    return {insumoId:p2.item.id,nome:p2.item.nome,de:p2.de,para:p2.para,em:agora}}));
  CT2.cont={};CT2.custo={};CT2.data='';CT2._retomado='';CT2.editando='';CT2.aba='hist';
  limparRascunhoContagem();
  salvar();telaContagem();
  toast('Correção salva: '+mudancas.length+' item(ns) na contagem de '+dataBR(c.data)+
    (mov?', estoque ajustado pela diferença':'')+'.');
}
/* todas as correções de uma contagem, da mais nova para a mais antiga */
function edicoesDaContagem(c){
  var l=[];
  (c.itens||[]).forEach(function(x){
    (x.edicoes||[]).forEach(function(e){ l.push({nome:x.nome,unidade:x.unidade,e:e}); });
  });
  return l.sort(function(a,b){return String(b.e.em).localeCompare(String(a.e.em))});
}
function verContagem(id){
  var c=(DB.contagens||[]).find(function(x){return x.id===id});
  if(!c)return;
  var eds=edicoesDaContagem(c);
  var naoEdita=podeEditarContagem(c);
  var h='<div class="mdB">'+
  (c.retroativa&&c.lancadaEm?'<div class="cmdFaixa" style="margin-bottom:10px">'+sv('help',14)+
    '<div>Contagem do fim do dia <b>'+dataBR(c.data)+'</b>, lançada em '+dataBR(c.lancadaEm)+'.</div></div>':'')+
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
    }).join('')+'</tbody></table></div></div>'+
  /* o que foi corrigido depois, com data, nome e de quanto para quanto */
  (eds.length?'<div class="blk" style="margin:12px 0 0;max-width:none;padding:0;overflow:hidden">'+
    '<div class="acTit">Correções feitas nesta contagem</div>'+
    '<div class="acTabW" style="max-height:200px"><table class="acTab"><thead><tr>'+
    '<th style="width:140px">Quando</th><th>Quem</th><th>Ingrediente</th>'+
    '<th style="width:170px;text-align:right">De → para</th></tr></thead><tbody>'+
    eds.map(function(x){
      var q=new Date(x.e.em);
      return '<tr><td>'+(isNaN(q)?'':q.toLocaleDateString('pt-BR')+' '+q.toLocaleTimeString('pt-BR').slice(0,5))+'</td>'+
       '<td>'+E(x.e.por||'—')+'</td><td>'+E(x.nome)+'</td>'+
       '<td style="text-align:right">'+(x.e.de===null||x.e.de===undefined?'não contado':fmtQt(x.e.de))+
        ' → <b>'+fmtQt(x.e.para)+'</b> '+un(x.unidade).ab+
        (x.e.custoPara!==undefined?'<br><small>custo R$ '+money(x.e.custoDe)+' → R$ '+money(x.e.custoPara)+'</small>':'')+'</td></tr>';
    }).join('')+'</tbody></table></div></div>':'')+
  '</div>';
  var o=document.createElement('div');o.className='mdOv';o.id='mdOv';
  o.innerHTML='<div class="mdBox xl"><div class="mdH"><b>Contagem de estoque — '+dataBR(c.data)+'</b>'+
  '<button onclick="fecharModal()">&times;</button></div>'+h+
  '<div class="mdF"><button class="btnP2" onclick="fecharModal()">Fechar</button>'+
  ((c.itens||[]).some(function(x){return x.diferenca<-0.0001})
    ?'<button class="btnP2" onclick="fecharModal();verDivergencias(\''+c.id+'\',\'perda\')">Ver perdas</button>':'')+
  ((c.itens||[]).some(function(x){return x.diferenca>0.0001})
    ?'<button class="btnP2" onclick="fecharModal();verDivergencias(\''+c.id+'\',\'sobra\')">Ver sobras</button>':'')+
  (naoEdita
    ?'<button class="btnP2" disabled title="'+E(naoEdita)+'">'+sv('edit',13)+' Editar</button>'
    :'<button class="btnP2" onclick="editarContagem(\''+c.id+'\')">'+sv('edit',13)+' Editar</button>')+
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

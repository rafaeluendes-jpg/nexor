/* ==========================================================
   BLOCO 20 — BASE DO ESTOQUE (unidades, grupos, insumos)
   ========================================================== */
var UNID=[
 {id:'kg',n:'Quilo',ab:'kg',base:'peso',f:1000},
 {id:'g', n:'Grama',ab:'g', base:'peso',f:1},
 {id:'l', n:'Litro',ab:'L', base:'vol', f:1000},
 {id:'ml',n:'Mililitro',ab:'ml',base:'vol',f:1},
 {id:'un',n:'Unidade',ab:'un',base:'un',f:1},
 {id:'dz',n:'Dúzia',ab:'dz',base:'un',f:12},
 {id:'cx',n:'Caixa',ab:'cx',base:'un',f:1},
 {id:'pc',n:'Pacote',ab:'pc',base:'un',f:1},
 {id:'fd',n:'Fardo',ab:'fd',base:'un',f:1}
];
/* ==========================================================
   UNIDADE DE MEDIDA — CONSULTA POR MAPA, NAO POR VARREDURA
   unidades() montava um array NOVO a cada chamada (UNID.concat), e un()
   varria esse array item a item. Na tela Estoque Total, un() e chamada 3x
   por linha: com 290 itens sao 870 arrays criados e 870 varreduras — so
   para ler a sigla "kg".
   Agora o mapa e montado uma vez e refeito apenas quando a loja cadastra
   uma unidade nova.
   ========================================================== */
var _mapaUnid=null, _mapaUnidL=null, _mapaUnidN=-1;
function unidades(){
  DB.unidExtra=DB.unidExtra||[];
  if(_mapaUnidL!==DB.unidExtra||_mapaUnidN!==DB.unidExtra.length){
    _listaUnid=UNID.concat(DB.unidExtra);
    _mapaUnid={};
    _listaUnid.forEach(function(u){_mapaUnid[u.id]=u});
    _mapaUnidL=DB.unidExtra; _mapaUnidN=DB.unidExtra.length;
  }
  return _listaUnid;
}
var _listaUnid=null;
function un(id){
  unidades();
  /* ==========================================================
     A SIGLA GRAVADA PODE NAO BATER NA CAIXA
     A lista embutida usa 'l' minusculo para litro, mas no banco ha insumos
     gravados com 'L' maiusculo — a sigla oficial do litro. Sem esta segunda
     tentativa, un('L') nao achava nada e caia no padrao UNID[4], que e
     "Unidade". O efeito era silencioso e caro: a agua virava item de
     contagem, a janela da ficha so oferecia unidades de contagem (por isso
     litro, quilo e grama nao apareciam), e a conversao ml<->L parava de
     funcionar sem erro nenhum na tela.
     ========================================================== */
  if(_mapaUnid[id])return _mapaUnid[id];
  var k=String(id==null?'':id).trim().toLowerCase();
  return _mapaUnid[k]||UNID[4];
}
function convUnid(qtd,de,para){
  var a=un(de),b=un(para);
  if(a.base!==b.base)return null;
  return qtd*a.f/b.f;
}
function baseEstoque(){
  DB.unidExtra=DB.unidExtra||[];
  DB.gruposIng=DB.gruposIng||[
    {id:'gi_ins',nome:'Insumos',compoeCMV:true,subs:[]},
    {id:'gi_emb',nome:'Embalagens',compoeCMV:true,subs:[]},
    {id:'gi_lim',nome:'Limpeza',compoeCMV:false,subs:[]}
  ];
  DB.insumos=DB.insumos||[];
  /* ==========================================================
     O CODIGO SEGUINTE E CALCULADO UMA VEZ, NAO A CADA ITEM
     proxCodInsumo() varre TODOS os insumos e TODAS as fichas para achar o
     maior codigo. Chamada dentro do laco, com 250 insumos sem codigo, isso
     vira 62.500 comparacoes. Agora acha o maior uma vez e so incrementa.
     Medido: 26x mais rapido com 290 itens.
     ========================================================== */
  var _prox=0;
  (DB.insumos||[]).forEach(function(x){var v=Number(x.codigo)||0;if(v>_prox)_prox=v});
  (DB.fichas||[]).forEach(function(x){var v=Number(x.codigo)||0;if(v>_prox)_prox=v});
  DB.insumos.forEach(function(i){
    if(!i.codigo)i.codigo=String(++_prox);
    if(i.controlaEstoque===undefined)i.controlaEstoque=true;
    if(i.compoeCMV===undefined)i.compoeCMV=true;
    if(i.estoqueMin===undefined)i.estoqueMin=0;
    if(i.estoqueMax===undefined)i.estoqueMax=0;
    if(i.validade===undefined)i.validade='';
    if(i.unidadeVenda===undefined)i.unidadeVenda='';
    if(i.permiteVenda===undefined)i.permiteVenda=false;
    if(i.estoqueAtual===undefined)i.estoqueAtual=0;
    if(i.fator===undefined)i.fator=1;
    if(i.compras===undefined)i.compras=[];
    i.modoCusto=normModo(i.modoCusto);        /* manual/media30 -> media */
  });
  DB.fichas=DB.fichas||[];
  DB.fichaCats=DB.fichaCats||[{id:'fc_prod',nome:'Produzido'},{id:'fc_venda',nome:'Vendas'}];
  DB.lojasFin=DB.lojasFin||[{id:'lj_matriz',nome:'Matriz'}];
}
/* Insumo e ficha dividem a MESMA numeração — é a mesma lista do estoque.
   O próximo código é sempre o maior existente + 1, então cadastrar algo novo
   não mexe no número de ninguém. */
function proxCodItem(){
  var mx=0;
  (DB.insumos||[]).forEach(function(x){var v=Number(x.codigo)||0;if(v>mx)mx=v});
  (DB.fichas||[]).forEach(function(x){var v=Number(x.codigo)||0;if(v>mx)mx=v});
  return String(mx+1);
}
function proxCodInsumo(){return proxCodItem()}
/* Renumera tudo de 1 em diante, na ordem alfabética do nome, misturando
   insumos e fichas numa lista só — a mesma ordem que o estoque mostra. */
function renumerarCodigos(){
  var todos=[];
  (DB.insumos||[]).forEach(function(x){todos.push(x)});
  (DB.fichas||[]).forEach(function(x){todos.push(x)});
  todos.sort(function(a,b){
    return String(a.nome||'').localeCompare(String(b.nome||''),'pt',{sensitivity:'base'});
  });
  todos.forEach(function(x,i){x.codigo=String(i+1)});
  return todos.length;
}
/* Os códigos antigos vinham de dois contadores separados: o de ingrediente
   começava em 700000 só para não colidir com o de ficha, que começava em 1.
   Não havia razão além dessa — e ela deixou de existir quando as duas listas
   passaram a dividir a mesma numeração. Este acerto roda UMA vez. */
/* acerto de uma vez: o espelho do cardápio chegou a guardar dois formatos de
   identificador ao mesmo tempo. Zera a marca para ela nascer certa. */
function arrumarEspelhoCardapio(){
  if(DB._espelhoOk)return;
  try{ if(DB._snap)delete DB._snap.cardapioL; }catch(e){_quieto(e,'arrumarEspelhoCardapio')}
  DB._espelhoOk=true;
}
function arrumarCodigos(){
  if(DB._codOk)return;
  var q=(DB.insumos||[]).length+(DB.fichas||[]).length;
  if(!q)return;
  renumerarCodigos();
  DB._codOk=true;
  try{ salvar(); }catch(e){ try{gravarLocal()}catch(e2){_quieto(e2,'arrumarCodigos')} }
  try{ logNuvem(q+' códigos arrumados: 1 a '+q+' em ordem alfabética'); }catch(e){_quieto(e,'arrumarCodigos')}
}
async function pedirRenumerar(){
  var q=(DB.insumos||[]).length+(DB.fichas||[]).length;
  var ok=await confirmar({
    titulo:'Renumerar os códigos',
    texto:'Os '+q+' itens do estoque — ingredientes e fichas juntos — passam a ter '+
      'código 1, 2, 3... na ordem alfabética do nome.',
    aviso:'Os códigos atuais serão substituídos. Os que você cadastrar depois seguem '+
      'a sequência (o próximo número livre), sem mexer nos já existentes.<br>'+
      '<b>Se você usa os códigos de hoje em etiqueta, planilha ou nota, anote antes.</b>',
    ok:'Renumerar agora',tipo:'perigo'});
  if(!ok)return;
  var q2=renumerarCodigos();
  DB._codOk=true;
  salvar();
  if(typeof telaEstoqueTotal==='function'&&S.it==='posicao-estoque')telaEstoqueTotal();
  else if(S.mod&&S.it)abrir(S.mod,S.it);
  toast(q2+' itens renumerados em ordem alfabética.');
}
/* mesma correcao de un(): grupoIng e chamada uma vez por linha da tabela */
var _mapaGrp=null, _mapaGrpL=null, _mapaGrpN=-1;
function grupoIng(id){
  var lst=DB.gruposIng||[];
  if(_mapaGrpL!==lst||_mapaGrpN!==lst.length){
    _mapaGrp={}; lst.forEach(function(g){_mapaGrp[g.id]=g});
    _mapaGrpL=lst; _mapaGrpN=lst.length;
  }
  return _mapaGrp[id]||null;
}
/* insumo() e o pior caso: chamada uma vez por INGREDIENTE de cada ficha
   quando o sistema calcula custo. Com 250 insumos e 40 fichas de 8 itens,
   sao 320 varreduras de 250 posicoes a cada recalculo. */
var _mapaIns=null, _mapaInsL=null, _mapaInsN=-1;
function insumo(id){
  var lst=DB.insumos||[];
  /* refaz quando a lista MUDA DE IDENTIDADE (o download troca o array inteiro)
     ou muda de tamanho. Comparar so o tamanho deixava passar o caso em que a
     nuvem devolve outra lista com a mesma quantidade — e a tela mostrava
     dado velho. Peguei isso num teste antes de publicar. */
  if(_mapaInsL!==lst||_mapaInsN!==lst.length){
    _mapaIns={}; lst.forEach(function(i){_mapaIns[i.id]=i});
    _mapaInsL=lst; _mapaInsN=lst.length;
  }
  return _mapaIns[id]||null;
}
/* quem altera a lista de insumos avisa, para o mapa ser refeito */
/* ----------------------------------------------------------
   CUSTO MEDIO PONDERADO  (padrao do sistema)

   custo medio = (valor do estoque que ja tenho + valor da compra)
                 -------------------------------------------------
                 (quantidade em estoque    + quantidade da compra)

   Fica guardado em ins.custo e so muda quando ENTRA mercadoria.
   Baixa nunca recalcula custo: usa o que ja esta gravado.
   ---------------------------------------------------------- */
function custoMedioPond(i){
  if(!i)return 0;
  var c=Number(i.custo)||0;
  if(c>0)return c;
  return Number(i.custoUltima)||0;
}
/* compatibilidade: chamadas antigas continuam valendo */
var MODOS_CUSTO=[
 {id:'media',  n:'Custo médio'},
 {id:'ultima', n:'Custo da última compra'}
];
/* registros antigos: manual e media30 viram custo médio */
function normModo(m){
  m=m||'media';
  if(m==='ultima')return 'ultima';
  return 'media';
}
function nomeModoCusto(id){
  var m=MODOS_CUSTO.find(function(x){return x.id===normModo(id)});
  return m?m.n:'Custo médio';
}
function custoPorModo(i,modo){
  if(!i)return 0;
  if(normModo(modo)==='ultima')return Number(i.custoUltima)||custoMedioPond(i);
  return custoMedioPond(i);
}
function custoAtual(i){
  if(!i)return 0;
  var v=custoPorModo(i,normModo(i.modoCusto));
  if(!v)v=Number(i.custo)||Number(i.custoUltima)||0;
  return v;
}
/* item sem compra ainda nao tem custo: quem define e a primeira nota de entrada */
function semCompra(i){
  if(!i)return true;
  if((i.compras||[]).length)return false;
  return !(Number(i.custoUltima)>0)&&!(Number(i.custo)>0);
}

/* ==========================================================
   INGREDIENTES E INSUMOS
   ========================================================== */
var IN={busca:'',grupo:'',so:''};
function telaInsumos(){
  baseEstoque();
  var lista=(DB.insumos||[]).filter(function(i){
    if(IN.grupo&&i.grupoId!==IN.grupo)return false;
    if(IN.so==='baixo'&&!(i.controlaEstoque&&Number(i.estoqueAtual)<=Number(i.estoqueMin)))return false;
    if(IN.so==='cmv'&&!i.compoeCMV)return false;
    if(IN.busca){
      var q=IN.busca.toLowerCase();
      if((i.nome||'').toLowerCase().indexOf(q)<0&&String(i.codigo||'').indexOf(q)<0)return false;
    }
    return true;
  }).sort(function(a,b){return (a.nome||'').localeCompare(b.nome||'')});
  var valorTotal=lista.reduce(function(a,i){return a+(Number(i.estoqueAtual)||0)*custoAtual(i)},0);
  var abaixo=(DB.insumos||[]).filter(function(i){
    return i.controlaEstoque&&Number(i.estoqueAtual)<=Number(i.estoqueMin)}).length;

  /* ==========================================================
     MESMA CASCA DA MOVIMENTACAO DE MERCADORIA
     A tela era feita de cartoes brancos flutuando sobre um fundo cinza:
     um para o titulo, um para os filtros, outro para a lista. Com 250
     ingredientes isso vira moldura em volta do que interessa.
     Agora e a casca de tela cheia: titulo fixo, filtros fixos numa faixa,
     e a lista de fora a fora com a rolagem so nela.
     ========================================================== */
  $('content').innerHTML='<div class="mvWrap">'+
  '<div class="mvTopo"><div style="flex:1"><h1>Ingredientes e Insumos</h1></div>'+
  '<div class="finActs">'+
   '<button class="btnP2" onclick="modalUnidades()">'+sv('gear2',13)+' Unidades</button>'+
   '<button class="btnP2" onclick="exportarInsumos()">'+sv('down2',13)+' Exportar</button>'+
   '<button class="btnP2 ok" onclick="modalInsumo()">'+sv('plus',14)+' Novo ingrediente</button></div></div>'+

  /* ==========================================================
     O FILTRO CONTINUA SENDO filtroCard
     Troquei por mvFiltros e os campos perderam a forma: os rotulos e as
     caixas daqui sao .fl, e mvFiltros e feito para .f2. Casca e uma coisa,
     campo e outra — trocar a casca nao pode trocar o estilo do que esta
     dentro. A classe emCheia so tira as bordas arredondadas, para a faixa
     encostar de lado a lado.
     ========================================================== */
  '<div class="filtroCard emCheia">'+
   '<div class="fl gw2"><label>Buscar</label><input id="inB" value="'+E(IN.busca)+'" placeholder="nome ou código"></div>'+
   '<div class="fl"><label>Grupo</label><select onchange="IN.grupo=this.value;telaInsumos()">'+
    '<option value="">Todos os grupos</option>'+
    (DB.gruposIng||[]).map(function(g){return '<option value="'+g.id+'"'+(IN.grupo===g.id?' selected':'')+'>'+E(g.nome)+'</option>'}).join('')+
   '</select></div>'+
   '<div class="fl"><label>Exibir</label><select onchange="IN.so=this.value;telaInsumos()">'+
    '<option value="">Todos</option>'+
    '<option value="baixo"'+(IN.so==='baixo'?' selected':'')+'>Abaixo do mínimo</option>'+
    '<option value="cmv"'+(IN.so==='cmv'?' selected':'')+'>Compõem CMV</option>'+
   '</select></div>'+
   '<button class="btnP2" onclick="IN={busca:\'\',grupo:\'\',so:\'\'};telaInsumos()">Limpar</button>'+
   '<div style="flex:1"></div>'+
   '<div class="fcResumo">'+
    '<div><span>Itens</span><b>'+lista.length+'</b></div>'+
    '<div><span>Valor em estoque</span><b>R$ '+money(valorTotal)+'</b></div>'+
    '<div><span>Abaixo do mínimo</span><b class="'+(abaixo?'vr':'vg')+'">'+abaixo+'</b></div>'+
   '</div>'+
  '</div>'+

  '<div class="mvTabW">'+
  (lista.length?'<table class="pTable finTab tabIns"><thead><tr>'+
   '<th style="width:82px">Código</th><th>Descrição</th>'+
   '<th style="width:110px">Un. consumo</th>'+
   '<th style="width:150px">Grupo</th>'+
   '<th style="width:92px;text-align:right">Mínimo</th>'+
   '<th style="width:92px;text-align:right">Atual</th>'+
   '<th style="width:118px;text-align:right">Custo médio</th>'+
   '<th style="width:110px;text-align:center">Controles</th>'+
   '<th style="width:80px"></th></tr></thead><tbody>'+
   lista.map(function(i){
     var g=grupoIng(i.grupoId);
     var baixo=i.controlaEstoque&&Number(i.estoqueAtual)<=Number(i.estoqueMin);
     return '<tr>'+
     '<td><b>'+E(i.codigo)+'</b></td>'+
     '<td><b>'+E(i.nome)+'</b>'+(i.descricao?'<small>'+E(i.descricao)+'</small>':'')+'</td>'+
     '<td>'+E(un(i.unidade).n)+'</td>'+
     '<td>'+(g?'<span class="cidTag">'+E(g.nome)+'</span>':'—')+'</td>'+
     '<td style="text-align:right">'+(i.controlaEstoque?fmtQt(i.estoqueMin)+' '+un(i.unidade).ab:'—')+'</td>'+
     '<td style="text-align:right">'+(i.controlaEstoque?
       '<b class="'+(baixo?'vr':'')+'">'+fmtQt(i.estoqueAtual)+' '+un(i.unidade).ab+'</b>'+
       (baixo?'<span class="atrTag">baixo</span>':''):'—')+'</td>'+
     '<td style="text-align:right"><b>R$ '+money(custoAtual(i))+'</b>'+
      '<small>'+(semCompra(i)?'sem compra ainda':E(nomeModoCusto(i.modoCusto).replace('Custo ','')))+
      ' · por '+un(i.unidade).ab+'</small></td>'+
     '<td style="text-align:center">'+
      (i.controlaEstoque?'<span class="miniTag ok2" title="controla estoque">EST</span>':'')+
      (i.compoeCMV?'<span class="miniTag cm" title="compõe CMV">CMV</span>':'')+'</td>'+
     '<td><div class="rowAct">'+
      '<button class="rBtn" onclick="modalInsumo(\''+i.id+'\')" title="Editar">'+sv('edit',12)+'</button>'+
      '<button class="rBtn rd" onclick="excluirInsumo(\''+i.id+'\')" title="Excluir">'+sv('trash',12)+'</button>'+
     '</div></td></tr>';
   }).join('')+'</tbody></table>'
  :'<div class="entVazio"><b>Nenhum ingrediente cadastrado</b>'+
   '<span>Cadastre os insumos aqui — eles aparecem automaticamente na ficha técnica.</span></div>')+
  /* No fim so restam dois abertos: mvTabW (a lista) e mvWrap (a casca).
     mvTopo, finActs e mvFiltros ja se fecham acima. Contei pela estrutura,
     nao comparando com a versao antiga — ela tinha um cartao a mais. */
  '</div></div>';
  $('inB').oninput=function(){IN.busca=this.value;var p=this.selectionStart;telaInsumos();
    var n=$('inB');n.focus();n.setSelectionRange(p,p);};
  rodape((DB.insumos||[]).length+' ingredientes cadastrados');
}
function fmtQt(v){
  var n2=Number(v)||0;
  return n2%1===0?String(n2):n2.toFixed(3).replace(/0+$/,'').replace(/\.$/,'').replace('.',',');
}
function modalInsumo(id,copia){
  baseEstoque();
  var i=id?insumo(id):null;
  _insEditando=i;
  var subs=[];
  (DB.catfin||[]).forEach(function(p){(p.itens||[]).forEach(function(it){
    subs.push({id:it.id,nome:p.nome+' › '+it.nome});});});
  var g0=i?grupoIng(i.grupoId):null;
  _insEditando=i||null;

  var h='<div class="mdB">'+
  '<div class="blk" style="margin:0 0 11px;max-width:none"><h3>Identificação</h3>'+
  '<div class="row3">'+
   '<div class="fld2" style="grid-column:span 2"><label>Descrição *</label>'+
    '<input id="isN" value="'+E(i&&!copia?i.nome:(i?i.nome+' (cópia)':''))+'" placeholder="ex: Abacaxi fruta"></div>'+
   '<div class="fld2"><label>Código</label><input id="isC" value="'+E(i&&!copia?i.codigo:proxCodInsumo())+'"></div>'+
  '</div>'+
  '<div class="row3">'+
   '<div class="fld2"><label>Unidade de consumo *</label>'+
    '<div class="pickRow"><select id="isU">'+
     unidades().map(function(u){return '<option value="'+u.id+'"'+(i&&i.unidade===u.id?' selected':'')+'>'+u.n+' ('+u.ab+')</option>'}).join('')+
    '</select><button class="btnP2" onclick="modalUnidades()" title="Cadastrar unidade">'+sv('plus',12)+'</button></div></div>'+
   '<div class="fld2"><label>Grupo *</label><select id="isG">'+
    '<option value="">Selecione</option>'+
    (DB.gruposIng||[]).map(function(g){return '<option value="'+g.id+'"'+(i&&i.grupoId===g.id?' selected':'')+'>'+E(g.nome)+
      (g.compoeCMV===false?' (sem CMV)':'')+'</option>'}).join('')+
   '</select></div>'+
  '</div>'+
  '<div class="fld2" style="margin:0"><label>Categoria financeira</label>'+
   '<button class="selArv" id="isCfB" type="button" onclick="abreCatIns()">'+
   '<span>'+E(i&&i.catFinId?nomeCatFin(i.catFinId):'Não vincular')+'</span>'+sv('dn',12)+'</button>'+
   '<input type="hidden" id="isCf" value="'+E(i?i.catFinId:'')+'">'+
   '<div class="arvIn" id="isCfArv" style="display:none"></div>'+
   '<div class="hint">Usada quando este item entrar por nota de compra.</div></div>'+
  '</div>'+

  '<div class="blk" style="margin:0 0 11px;max-width:none"><h3>Controles</h3>'+
  '<div class="row2">'+
   '<label class="optCard"><input type="checkbox" id="isCe" '+(!i||i.controlaEstoque!==false?'checked':'')+'>'+
   '<span><b>Controla estoque</b><span>entra pela nota de entrada e sai nas vendas e produções. '+
   'Desmarcado, o item aparece na nota mas não movimenta estoque.</span></span></label>'+
   '<label class="optCard"><input type="checkbox" id="isCm" '+(!i||i.compoeCMV!==false?'checked':'')+'>'+
   '<span><b>Compõe CMV</b><span>entra no custo da mercadoria vendida nos relatórios</span></span></label>'+
  '</div>'+
  '<div class="row3" style="margin-top:12px">'+
   '<div class="fld2"><label>Estoque mínimo</label><input id="isMi" type="number" step="0.001" value="'+(i?(i.estoqueMin||0):0)+'">'+
    '<div class="hint">Abaixo disso o item é sinalizado.</div></div>'+
   '<div class="fld2"><label>Estoque máximo</label><input id="isMx" type="number" step="0.001" value="'+(i?(i.estoqueMax||0):0)+'">'+
    '<div class="hint">Quanto vale a pena manter em casa.</div></div>'+
   '<div class="fld2"><label>Validade</label><input id="isVal" type="date" value="'+E(i&&i.validade?String(i.validade).slice(0,10):'')+'">'+
    '<div class="hint">Do lote em estoque.</div></div>'+
   '<div class="fld2"><label>Unidade de venda</label><select id="isUV">'+
    '<option value="">igual à de estoque</option>'+
    unidades().map(function(u){return '<option value="'+u.id+'"'+
      ((i&&i.unidadeVenda)===u.id?' selected':'')+'>'+E(u.n)+'</option>'}).join('')+
    '</select></div>'+
   '<div class="fld2" style="justify-content:flex-end"><label>&nbsp;</label>'+
    '<label class="chkL"><input type="checkbox" id="isPV"'+((i&&i.permiteVenda)?' checked':'')+'>'+
    '<span>Item vendável</span></label></div>'+
   '<div class="fld2"><label>Estoque atual</label>'+
    '<input id="isAt" type="number" step="0.001" readonly style="background:var(--alt)" '+
     'value="'+(i&&!copia?(i.estoqueAtual||0):0)+'">'+
    '<div class="hint">Só muda por <b>nota de entrada</b>, <b>movimentação de estoque</b> '+
    '(com motivo) ou <b>contagem de estoque</b>.</div></div>'+
   '<div class="fld2"><label>Fator de conversão</label><input id="isFa" type="number" step="0.001" value="'+(i?(i.fator||1):1)+'">'+
    '<div class="hint">Multiplicador da unidade de compra.</div></div>'+
  '</div></div>'+

  '<div class="blk" style="margin:0 0 11px;max-width:none"><h3>Custo</h3>'+
  '<div class="row2">'+
   '<div class="fld2" style="margin:0"><label>Cálculo do custo</label>'+
    '<select id="isModo" onchange="mudaModoCusto()">'+
     MODOS_CUSTO.map(function(m){return '<option value="'+m.id+'"'+
       (normModo(i&&i.modoCusto)===m.id?' selected':'')+'>'+m.n+'</option>'}).join('')+
    '</select></div>'+
   '<div class="fld2" style="margin:0"><label id="isLbCusto">'+
    nomeModoCusto(i&&i.modoCusto)+'</label>'+
    '<div class="cur"><span>R$</span>'+
    '<input id="isV" type="number" step="0.0001" value="'+(i?custoPorModo(i,normModo(i.modoCusto)):'')+'"'+
    ' readonly style="background:var(--alt)"></div></div>'+
  '</div>'+
  '<div class="cstMini">'+
   '<span>Custo médio <b>R$ '+(i?money(custoMedioPond(i)):'0,00')+'</b></span>'+
   '<span>Última compra <b>R$ '+(i?money(i.custoUltima||0):'0,00')+'</b></span>'+
   (i?'<span class="dest">Em estoque <b>R$ '+money((Number(i.estoqueAtual)||0)*custoAtual(i))+'</b></span>':'')+
  '</div>'+
  '<div class="hint" style="margin-top:8px">'+
   (semCompra(i)
    ?'Este item ainda não tem custo. Ele entra com o valor da <b>primeira nota de entrada</b> e, das próximas em diante, passa a ser a média ponderada.'
    :'Custo médio = <b>(estoque × custo médio + quantidade comprada × valor da compra) ÷ (estoque + quantidade comprada)</b>. '+
     'É recalculado a cada nota de entrada e não se digita à mão.')+'</div>'+
  '</div>'+
  '<div class="blk" style="margin:0;max-width:none"><h3>Complemento</h3>'+
  '<div class="row2">'+
   '<div class="fld2" style="margin:0"><label>Fornecedor habitual</label><select id="isF">'+
    '<option value="">—</option>'+
    (DB.fornec||[]).map(function(fo){return '<option value="'+fo.id+'"'+(i&&i.fornecedorId===fo.id?' selected':'')+'>'+E(fo.empresa)+'</option>'}).join('')+
   '</select></div>'+
   '<div class="fld2" style="margin:0"><label>Descrição complementar</label>'+
    '<input id="isD" value="'+E(i?i.descricao:'')+'" placeholder="marca, tipo, observação"></div>'+
  '</div></div>'+
  blocoUnidades(copia?null:i,'insUn')+
  '</div>';

  var titulo=i?(copia?'Novo ingrediente (cópia)':'Editar ingrediente'):'Novo ingrediente';
  var o2=document.getElementById('mdOv');if(o2)o2.remove();
  var ov=document.createElement('div');ov.className='mdOv';ov.id='mdOv';
  ov.innerHTML='<div class="mdBox lg"><div class="mdH"><b>'+titulo+'</b>'+
   '<button onclick="fecharModal()">&times;</button></div>'+h+
   '<div class="mdF"><button class="btnP2" onclick="fecharModal()">Cancelar</button>'+
   '<button class="btnP2" onclick="salvarInsumo(\''+(i&&!copia?i.id:'')+'\',1)">Salvar e criar cópia</button>'+
   '<button class="btnP2 ok" onclick="salvarInsumo(\''+(i&&!copia?i.id:'')+'\',0)">Salvar</button></div></div>';
  document.body.appendChild(ov);
  fecharSoForaDeVerdade(ov);
}
function nomeCatFin(subId){
  var achou='';
  (DB.catfin||[]).forEach(function(p){(p.itens||[]).forEach(function(it){
    if(it.id===subId)achou=p.nome+' \u203A '+it.nome;})});
  return achou||'Não vincular';
}
var _catInsAbertas={};
function abreCatIns(){
  var box=document.getElementById('isCfArv');
  if(!box)return;
  if(box.style.display!=='none'){box.style.display='none';return;}
  box.style.display='';
  desenhaCatIns();
}
function desenhaCatIns(){
  var box=document.getElementById('isCfArv');
  if(!box)return;
  var atual=(document.getElementById('isCf')||{}).value||'';
  var h='<div class="arvInB">'+
   '<div class="arvInIt'+(!atual?' on':'')+'" onclick="escolheCatIns(\'\')">'+
    sv('x2',12)+' Não vincular</div>';
  (DB.catfin||[]).forEach(function(p){
    var ab=!!_catInsAbertas[p.id];
    h+='<div class="arvInG">'+
     '<div class="arvInP" onclick="togglePastaIns(\''+p.id+'\')">'+
      '<span class="ftSeta'+(ab?' ab':'')+'">'+sv('tri',9)+'</span>'+
      sv(ab?'folderOpen':'folder',13)+' <span class="arvInNm">'+E(p.nome)+'</span>'+
      '<span class="apQt">'+(p.itens||[]).length+'</span></div>'+
     (ab?'<div class="arvInF">'+((p.itens||[]).length?p.itens.map(function(it){
       return '<div class="arvInIt sub'+(atual===it.id?' on':'')+'" onclick="escolheCatIns(\''+it.id+'\')">'+
       sv('file2',12)+' '+E(it.nome)+'</div>';}).join('')
       :'<div class="hint" style="padding:5px 26px">sem itens</div>')+'</div>':'')+
    '</div>';
  });
  if(!lista.length)
    h+='<div class="hint" style="padding:12px">Nenhuma categoria de '+
      (tpSel==='receita'?'receita':'despesa')+'. Cadastre em Financeiro \u203A Categorias Financeiras.</div>';
  h+='</div>';
  box.innerHTML=h;
}
function togglePastaIns(id){_catInsAbertas[id]=!_catInsAbertas[id];desenhaCatIns();}
function escolheCatIns(id){
  var inp=document.getElementById('isCf');
  if(inp)inp.value=id||'';
  var b=document.querySelector('#isCfB span');
  if(b)b.textContent=id?nomeCatFin(id):'Não vincular';
  var box=document.getElementById('isCfArv');
  if(box)box.style.display='none';
}
function mudaModoCusto(){
  var modo=normModo($('isModo').value);
  var i=_insEditando;
  $('isLbCusto').textContent=nomeModoCusto(modo);
  var inp=$('isV');
  inp.value=i?custoPorModo(i,modo):0;
  inp.readOnly=true;
  inp.style.background='var(--alt)';
}
var _insEditando=null;
function salvarInsumo(id,copia){
  baseEstoque();
  var alvoPrev=id?insumo(id):null;
  var alvoUlt=alvoPrev?alvoPrev.custoUltima:undefined;
  var nome=$('isN').value.trim();
  if(!nome){toast('Informe a descrição.');return;}
  if(!$('isG').value){toast('Selecione o grupo.');return;}
  var o={nome:nome,codigo:$('isC').value.trim()||proxCodInsumo(),unidade:$('isU').value,
    grupoId:$('isG').value,catFinId:$('isCf').value,
    controlaEstoque:$('isCe').checked,compoeCMV:$('isCm').checked,
    estoqueMin:parseFloat($('isMi').value)||0,
    estoqueMax:parseFloat(($('isMx')||{}).value)||0,
    validade:(($('isVal')||{}).value||''),
    unidadeVenda:(($('isUV')||{}).value||''),
    permiteVenda:!!($('isPV')&&$('isPV').checked),
    /* estoque nao entra pelo cadastro: so nota, movimentacao com motivo ou contagem */
    estoqueAtual:(alvoPrev?Number(alvoPrev.estoqueAtual)||0:0),
    fator:parseFloat($('isFa').value)||1,
    modoCusto:normModo($('isModo').value),
    /* custo e custo da ultima compra vem das notas de entrada, nunca da tela */
    custo:(alvoPrev?Number(alvoPrev.custo)||0:0),
    custoUltima:(alvoUlt!==undefined?alvoUlt:0),
    fornecedorId:$('isF').value,descricao:$('isD').value.trim()};
  var alvo=alvoPrev;
  if(alvo)Object.assign(alvo,o);
  else{o.id=uid('ins');o.compras=[];DB.insumos.push(o);alvo=o;}
  lerUnidades('insUn',alvo);       /* quem enxerga este item */
  salvar();
  fecharModal();
  if(copia)setTimeout(function(){modalInsumo(alvo.id,1)},120);
  else{
    if($('compBox'))telaComposicao(_fichaAberta); else telaInsumos();
  }
  toast('Ingrediente salvo.');
}
async function excluirInsumo(id){
  var usos=(DB.fichas||[]).filter(function(f){
    return (f.itens||[]).some(function(it){return it.insumoId===id})});
  if(usos.length){toast('Este item está em '+usos.length+' ficha(s): '+usos.map(function(f){return f.nome}).slice(0,3).join(', ')+'.');return;}
  var i=insumo(id);
  if(!await pergunta('Excluir "'+i.nome+'"?'))return;
  /* mesma razao da ficha: insumos tambem nao espelha exclusao, entao apagar
     so aqui fazia o ingrediente voltar no download seguinte */
  if(NUVEM.ligada&&NUVEM.loja){
    try{
      await api('insumos?loja_id=eq.'+NUVEM.loja+
                '&ref_local=eq.'+encodeURIComponent(id),'DELETE');
    }catch(e){
      painelErro('Não consegui excluir na nuvem.',detalheErro(e));
      return;
    }
  }
  DB.insumos=DB.insumos.filter(function(x){return x.id!==id}); declararExclusao('insumos',id); /* exclusao declarada: so isto autoriza apagar da nuvem (V201) */
  try{ if(DB._uuid&&DB._uuid.insumos)delete DB._uuid.insumos[id]; }
  catch(e2){ _quieto(e2,'excluirInsumo'); }
  salvar();telaInsumos();toast('Ingrediente excluído.');
}
function exportarInsumos(){
  baseEstoque();
  var l=[['Codigo','Descricao','Unidade','Grupo','Minimo','Atual','Custo','Valor total','Controla estoque','Compoe CMV']];
  (DB.insumos||[]).forEach(function(i){
    var g=grupoIng(i.grupoId);
    l.push([i.codigo,i.nome,un(i.unidade).n,g?g.nome:'',i.estoqueMin,i.estoqueAtual,
      String(custoAtual(i)).replace('.',','),
      String(arred((Number(i.estoqueAtual)||0)*custoAtual(i)).toFixed(2)).replace('.',','),
      i.controlaEstoque?'Sim':'Nao',i.compoeCMV?'Sim':'Nao']);
  });
  var csv=l.map(function(r){return r.map(function(c){return '"'+String(c).replace(/"/g,'""')+'"'}).join(';')}).join('\n');
  var b=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'});
  var a=document.createElement('a');a.href=URL.createObjectURL(b);
  a.download='nexor-ingredientes.csv';document.body.appendChild(a);a.click();
  setTimeout(function(){a.remove()},400);
  toast('Ingredientes exportados.');
}

/* ---------- UNIDADES DE CONSUMO ---------- */
function modalUnidades(){
  baseEstoque();
  var h='<div class="mdB">'+
  '<div class="blk" style="margin:0 0 11px;max-width:none"><h3>Unidades do sistema</h3>'+
  '<div class="uniGrid">'+UNID.map(function(u){
    return '<div class="uniIt fixa"><b>'+E(u.n)+'</b><span>'+E(u.ab)+'</span></div>'}).join('')+'</div>'+
  '<div class="hint" style="margin-top:9px">Essas não podem ser removidas — são a base das conversões.</div></div>'+
  '<div class="blk" style="margin:0;max-width:none"><h3>Unidades criadas por você</h3>'+
  '<div id="uniLista">'+
   ((DB.unidExtra||[]).length?'<div class="uniGrid">'+DB.unidExtra.map(function(u,k){
     return '<div class="uniIt"><b>'+E(u.n)+'</b><span>'+E(u.ab)+'</span>'+
     '<button class="arvB rd" onclick="remUnidade('+k+')">'+sv('trash',11)+'</button></div>'}).join('')+'</div>'
    :'<div class="hint">Nenhuma unidade criada.</div>')+
  '</div>'+
  '<div class="row3" style="margin-top:12px">'+
   '<div class="fld2"><label>Nome</label><input id="uN" placeholder="ex: Bandeja"></div>'+
   '<div class="fld2"><label>Sigla</label><input id="uA" placeholder="ex: bdj" maxlength="5"></div>'+
   '<div class="fld2"><label>Equivale a</label><select id="uB">'+
    '<option value="un">Unidade (contável)</option>'+
    '<option value="peso">Peso</option><option value="vol">Volume</option></select></div>'+
  '</div>'+
  '<div class="fld2" style="margin:0"><label>Fator em relação à base <small>(g para peso, ml para volume, 1 para unidade)</small></label>'+
   '<input id="uF" type="number" step="0.001" value="1"></div>'+
  '<button class="btnP2 ok" style="margin-top:10px" onclick="addUnidade()">'+sv('plus',13)+' Adicionar unidade</button>'+
  '</div></div>';
  modal('Unidades de consumo',h,'Fechar',function(){return true},'lg');
}
function addUnidade(){
  var n2=$('uN').value.trim(),a=$('uA').value.trim();
  if(!n2||!a){toast('Informe nome e sigla.');return;}
  DB.unidExtra=DB.unidExtra||[];
  DB.unidExtra.push({id:'u_'+a.toLowerCase().replace(/\W/g,''),n:n2,ab:a,
    base:$('uB').value,f:parseFloat($('uF').value)||1});
  salvar();fecharModal();modalUnidades();toast('Unidade criada.');
}
function remUnidade(k){
  var u=DB.unidExtra[k];
  var uso=(DB.insumos||[]).filter(function(i){return i.unidade===u.id}).length;
  if(uso){toast('Esta unidade está em uso em '+uso+' item(ns).');return;}
  DB.unidExtra.splice(k,1);salvar();fecharModal();modalUnidades();
}

/* ==========================================================
   GRUPO DE INGREDIENTES
   ========================================================== */
function telaGruposIng(){
  baseEstoque();
  var lista=(DB.gruposIng||[]).slice().sort(function(a,b){return (a.nome||'').localeCompare(b.nome||'')});
  $('content').innerHTML='<div class="finWrap">'+
  '<div class="finTop"><div><h1>Grupo de Ingredientes</h1>'+
  '<p>Organiza os insumos e define o que entra no cálculo do CMV.</p></div>'+
  '<div class="finActs"><button class="btnP2 ok" onclick="modalGrupoIng()">'+sv('plus',14)+' Novo grupo</button></div></div>'+
  '<div class="pnl2"><div class="pnl2H">Grupos <span class="cnt2">'+lista.length+'</span></div>'+
  '<div class="pnl2B" style="padding:0">'+
  (lista.length?'<table class="pTable finTab"><thead><tr>'+
   '<th>Descrição do grupo</th>'+
   '<th style="width:130px;text-align:center">Compõe CMV</th>'+
   '<th style="width:110px;text-align:center">Ingredientes</th>'+
   '<th style="width:110px"></th></tr></thead><tbody>'+
   lista.map(function(g){
     var q=(DB.insumos||[]).filter(function(i){return i.grupoId===g.id}).length;
     return '<tr><td><b>'+E(g.nome)+'</b></td>'+
     '<td style="text-align:center">'+(g.compoeCMV!==false
       ?'<span class="miniTag cm">SIM</span>':'<span class="miniTag off2">NÃO</span>')+'</td>'+
     '<td style="text-align:center">'+q+'</td>'+
     '<td><div class="rowAct">'+
      '<button class="rBtn" onclick="modalGrupoIng(\''+g.id+'\')" title="Editar">'+sv('edit',12)+'</button>'+
      '<button class="rBtn rd" onclick="excluirGrupoIng(\''+g.id+'\')" title="Excluir">'+sv('trash',12)+'</button>'+
     '</div></td></tr>';
   }).join('')+'</tbody></table>'
  :'<div class="entVazio"><b>Nenhum grupo cadastrado</b>'+
   '<span>Crie grupos como Insumos, Gelato ou Embalagens e marque quais compõem o CMV.</span></div>')+
  '</div></div></div>';
  rodape(lista.length+' grupos de ingredientes');
}
function modalGrupoIng(id){
  baseEstoque();
  var g=id?grupoIng(id):null;
  var h='<div class="mdB"><div class="blk" style="margin:0;max-width:none">'+
  '<div class="fld2"><label>Descrição do grupo *</label>'+
  '<input id="giN" value="'+E(g?g.nome:'')+'" placeholder="ex: Insumos, Gelato, Embalagens"></div>'+
  '<label class="optCard"><input type="checkbox" id="giC" '+(!g||g.compoeCMV!==false?'checked':'')+'>'+
  '<span><b>Compõe CMV</b><span>os itens deste grupo entram no custo da mercadoria vendida. '+
  'Desmarque para grupos como limpeza e escritório.</span></span></label>'+
  '</div>'+
  /* ==========================================================
     O GRUPO NASCIA SEM LIBERACAO E A UNIDADE NUNCA VIA

     Desde a V109 vale a regra: cadastro sem marcacao de unidade fica
     SO na matriz. Todos os formularios de cadastro ganharam o bloco
     "Quem enxerga este item" — menos este.

     Efeito: todo grupo de ingredientes criado aqui nascia com
     `sucursais` ausente. `liberadoNa()` le lista vazia como "ninguem",
     e a unidade abria a Ficha Tecnica sem grupo nenhum. Pior: nem pela
     tela de Liberacao por Unidade dava para consertar, porque salvar o
     grupo por aqui apagava de novo — `g.nome` e `g.compoeCMV` eram
     reatribuidos e `sucursais` nao era preservado.

     Era isso que fazia a liberacao "nao pegar": ela pegava, e o proximo
     salvamento do grupo desfazia.
     ========================================================== */
  blocoUnidades(g,'gi')+
  '</div>';
  modal(g?'Editar grupo':'Novo grupo de ingredientes',h,'Salvar',function(){
    var nome=$('giN').value.trim();
    if(!nome){toast('Informe a descrição.');return false;}
    /* ==========================================================
       DOIS GRUPOS COM O MESMO NOME, SO QUE UM COM ACENTO

       Foi assim que a Movimentacao de Estoque chegou a 33 grupos com
       dez repetidos: "Cascao" e "Cascão", "Zero Acucar" e "Zero
       Açucar", "Material de Escritorio" e "Material de Escritório",
       "Gelato_Venda", "Gelato Venda" e "Gelato_Vendas". Na lista sao
       duas linhas iguais; os ingredientes ficam todos numa e a outra
       fica vazia, e quem filtra pela vazia conclui que o sistema perdeu
       o estoque.

       A comparacao ignora maiuscula, espaco sobrando e acento — que e
       exatamente o que difere os pares que apareceram. E a mesma conta
       que `conferirCadastro` ja usava para categoria e produto.
       ========================================================== */
    var _cmp=function(x){ return String(x||'').trim().toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g,''); };
    var _igual=(DB.gruposIng||[]).find(function(x){
      return x&&(!g||x.id!==g.id)&&_cmp(x.nome)===_cmp(nome); });
    if(_igual){
      toast('Já existe o grupo "'+_igual.nome+'". Use ele em vez de criar outro igual.');
      return false;
    }
    var alvo;
    if(g){ g.nome=nome; g.compoeCMV=$('giC').checked; alvo=g; }
    else { alvo={id:uid('gi'),nome:nome,compoeCMV:$('giC').checked,sucursais:[]};
           DB.gruposIng.push(alvo); }
    /* le o bloco de unidades; se o bloco nao estiver na tela (loja unica
       ou usuario que nao e matriz), `lerUnidades` nao mexe no que existe */
    lerUnidades('gi',alvo);
    salvar();telaGruposIng();toast('Grupo salvo.');return true;
  },'sm2');
}
async function excluirGrupoIng(id){
  var q=(DB.insumos||[]).filter(function(i){return i.grupoId===id}).length;
  if(q){toast('Este grupo tem '+q+' ingrediente(s). Mova-os antes de excluir.');return;}
  var g=grupoIng(id);
  if(!await pergunta('Excluir o grupo "'+g.nome+'"?'))return;
  DB.gruposIng=DB.gruposIng.filter(function(x){return x.id!==id}); declararExclusao('gruposIng',id); /* exclusao declarada: so isto autoriza apagar da nuvem (V201) */
  salvar();telaGruposIng();toast('Grupo excluído.');
}

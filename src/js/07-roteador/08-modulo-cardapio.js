/* ==========================================================
   BLOCO 8 — MÓDULO CARDÁPIO
   ========================================================== */
function telaCardapio(){
  $('content').innerHTML='<div class="cardWrap">'+
  '<div class="card" id="colCat"></div><div class="card" id="colProd"></div></div>';
  renderCategorias();renderProdutos();
  rodape(DB.categorias.length+' categorias · '+DB.produtos.length+' produtos');
}

/* ---------- COLUNA CATEGORIAS ---------- */
function renderCategorias(){
  var q=(S.buscaCat||'').toLowerCase();
  var lista=DB.categorias.slice().sort(function(a,b){return a.ordem-b.ordem})
    .filter(function(c){return !q||c.nome.toLowerCase().indexOf(q)>=0});
  var h='<div class="cardH"><h2>Categorias</h2><div class="acts">'+
  '<button class="btn b2" onclick="formCategoria()">'+sv('plus',14)+' Cadastrar categoria</button></div></div>'+
  '<div class="srch"><span class="si">'+sv('search',15)+'</span>'+
  '<input id="bCat" placeholder="Pesquise por categoria" value="'+E(S.buscaCat)+'"></div>'+
  '<div class="cardB" id="listaCat">'+
  '<div class="catAll'+(S.cat==='todos'?' on':' off')+'" onclick="selCat(\'todos\')">Todos os produtos</div>';
  if(!lista.length)h+='<div class="vazio"><b>Nenhuma categoria</b>Cadastre a primeira categoria para organizar seus produtos.</div>';
  lista.forEach(function(c){
    /* ==========================================================
       ARRASTAR NAO FUNCIONA EM TELA DE TOQUE

       A ordem das categorias so podia ser mudada arrastando. O
       computador da loja e touch, e o arrasto do navegador nao responde
       ao dedo — entao a ordem nunca mudava, e o cardapio continuava
       abrindo pelas bebidas. As setas resolvem no toque e no mouse.
       ========================================================== */
    var _iC=lista.indexOf(c);
    h+='<div class="catRow'+(S.cat===c.id?' on':'')+'" draggable="true" data-id="'+c.id+'" onclick="selCat(\''+c.id+'\')">'+
    '<span class="ordBt">'+
      '<button title="subir"'+(_iC===0?' disabled':'')+
       ' onclick="event.stopPropagation();moverCat(\''+c.id+'\',-1)">▲</button>'+
      '<button title="descer"'+(_iC===lista.length-1?' disabled':'')+
       ' onclick="event.stopPropagation();moverCat(\''+c.id+'\',1)">▼</button>'+
    '</span>'+
    (c.cor?'<span style="width:9px;height:9px;border-radius:50%;background:'+c.cor+';flex:none"></span>':'')+
    '<span class="nm">'+E(c.nome)+'</span>'+
    '<button class="sw'+(c.ativo!==false?' on':'')+'" onclick="event.stopPropagation();toggleCat(\''+c.id+'\')"></button>'+
    '<span class="swLb'+(c.ativo!==false?' on':'')+'">'+(c.ativo!==false?'Ativo':'Inativo')+'</span>'+
    '<button class="dots" data-pop="1" onclick="event.stopPropagation();menuCat(event,\''+c.id+'\')">'+sv('dots',16)+'</button>'+
    '</div>';
  });
  h+='</div>';
  $('colCat').innerHTML=h;
  $('bCat').oninput=function(){S.buscaCat=this.value;renderCategorias();};
  ativarArrasto('#listaCat .catRow',function(de,para){reordenar(DB.categorias,de,para);salvar();renderCategorias();});
}
function moverCat(id,passo){
  var l=DB.categorias.slice().sort(function(a,b){return a.ordem-b.ordem});
  var i=l.findIndex(function(x){return x.id===id});
  var j=i+passo;
  if(i<0||j<0||j>=l.length)return;
  var t=l[i]; l[i]=l[j]; l[j]=t;
  l.forEach(function(x,k){x.ordem=k});
  salvar();
  if(NUVEM.ligada)agendarSync();
  semPular(renderCategorias);
  toast('Ordem: '+l.map(function(x){return x.nome}).join(' → '));
}
/* ==========================================================
   A TELA SUBIA PORQUE O CONTEUDO ENCOLHIA (V197)

   Nao ha `scrollTo` nenhum aqui — procurei tres vezes e nao existe.
   O que acontece e mais simples e por isso passou despercebido:

   selecionar uma categoria filtra a lista de produtos de 42 para um ou
   dois. A altura do conteudo despenca, o container fica menor que a
   rolagem atual, e o navegador PUXA a rolagem para caber. Do lado de
   quem usa, "a tela subiu sozinha".

   Por isso so acontecia clicando numa categoria la embaixo: e onde a
   diferenca de altura e grande. E por isso nenhum teste de
   `window.scrollTo` pegou — o culpado e o layout, nao o codigo.

   Duas correcoes, as duas pequenas:

   1. o painel de produtos guarda uma altura minima antes de trocar o
      conteudo, para o container nao encolher no meio do clique;
   2. depois de redesenhar, a categoria clicada e trazida de volta ao
      campo de visao com `block:'nearest'` — que so mexe se ela tiver
      saido da tela.
   ========================================================== */
function selCat(id){
  S.cat=id;
  var cx=document.querySelector('.etScroll');
  var alvo=document.querySelector('.catRow[data-id="'+id+'"]')||
           document.querySelector('.catAll');
  var pos=cx?cx.scrollTop:0;
  var prod=document.getElementById('colProd');
  /* segura a altura para o conteudo nao despencar durante a troca */
  if(prod&&prod.offsetHeight)prod.style.minHeight=prod.offsetHeight+'px';
  renderCategorias();renderProdutos();
  try{
    if(cx&&pos)cx.scrollTop=pos;                 /* devolve o lugar */
    var novo=document.querySelector('.catRow[data-id="'+id+'"]')||
             document.querySelector('.catAll');
    if(novo&&novo.scrollIntoView)novo.scrollIntoView({block:'nearest'});
  }catch(e){ _quieto(e,'selCat'); }
  /* a altura travada sai depois do desenho, senao a tela fica com um
     vazio grande embaixo quando a categoria tem poucos produtos */
  setTimeout(function(){
    var p2=document.getElementById('colProd');
    if(p2)p2.style.minHeight='';
  },400);
}
function toggleCat(id){
  var c=DB.categorias.find(function(x){return x.id===id});
  c.ativo=c.ativo===false;salvar();renderCategorias();
  toast('Categoria '+(c.ativo?'ativada':'inativada')+'.');
}
function menuCat(ev,id){
  fecharPops();
  var c=DB.categorias.find(function(x){return x.id===id});
  pop(ev,'<button onclick="formCategoria(\''+id+'\');fecharPops()">'+sv('edit',15)+' Editar categoria</button>'+
  '<div class="popSep"></div>'+
  '<button class="rd" onclick="excluirCat(\''+id+'\');fecharPops()">'+sv('trash',15)+' Excluir categoria</button>');
}
async function excluirCat(id){
  var qtd=DB.produtos.filter(function(p){return p.categoriaId===id}).length;
  if(qtd){toast('Esta categoria tem '+qtd+' produto(s). Mova-os antes de excluir.');return;}
  var c=DB.categorias.find(function(x){return x.id===id});
  if(!await pergunta('Excluir a categoria "'+c.nome+'"?'))return;
  DB.categorias=DB.categorias.filter(function(x){return x.id!==id}); declararExclusao('categorias',id); /* exclusao declarada: so isto autoriza apagar da nuvem (V201) */
  if(S.cat===id)S.cat='todos';
  salvar();renderCategorias();renderProdutos();toast('Categoria excluída.');
}

/* ---------- FORMULARIO DE CATEGORIA ---------- */
function formCategoria(id){
  var c=id?DB.categorias.find(function(x){return x.id===id}):null;
  var tmp={cor:c?c.cor:'',imagem:c?c.imagem:''};
  var corpo='<div class="mdTabs">'+
  '<button class="fpTab on" data-t="b" onclick="abaCat(this,\'b\')">Dados básicos</button>'+
  '<button class="fpTab" data-t="o" onclick="abaCat(this,\'o\')">Dados opcionais da categoria</button></div>'+
  '<div class="mdB">'+
  '<div id="catB">'+
    '<div class="fld2"><label>Nome da categoria *</label><input id="cNome" value="'+E(c?c.nome:'')+'" placeholder="Ex.: Bebidas"></div>'+
    '<div class="fld2"><label>Onde imprimir</label><select id="cImp">'+
      IMPRESSAO.map(function(x){return '<option'+(c&&c.impressao===x?' selected':'')+'>'+x+'</option>'}).join('')+'</select></div>'+
    '<div class="fld2"><label>Tipo de imposto</label><select id="cImp2">'+
      '<option value="">Selecione um tipo de imposto</option>'+
      IMPOSTOS.map(function(x){return '<option'+(c&&c.imposto===x?' selected':'')+'>'+x+'</option>'}).join('')+'</select></div>'+
  '</div>'+
  '<div id="catO" class="hide">'+
    '<div class="fld2"><label>Cor da categoria</label><div class="cores" id="coresBox">'+
      CORES.map(function(x){return '<button type="button" class="corBtn'+(tmp.cor===x?' on':'')+'" style="background:'+x+'" data-c="'+x+'"></button>'}).join('')+
      '<button type="button" class="corBtn'+(!tmp.cor?' on':'')+'" style="background:#fff;border:1px dashed #ccc" data-c=""></button>'+
      '</div><div class="hint">A cor ajuda a identificar a categoria na frente de caixa.</div></div>'+
    '<div class="fld2"><label>Imagem da categoria</label><div class="fotoBox">'+
      '<div class="fotoPrev" id="catPrev">'+(tmp.imagem?'<img src="'+tmp.imagem+'">':sv('img',24))+'</div>'+
      '<div><input type="file" id="catFile" accept="image/*" style="font-size:12px">'+
      '<div class="hint">Formato JPG ou PNG, até 1 MB.</div></div></div></div>'+
  '</div>'+
  /* mesmo defeito do grupo de ingredientes: nascia sem liberacao e a
     unidade abria o cardapio sem categoria nenhuma */
  blocoUnidades(c,'catUn')+'</div>';
  modal((c?'Editar categoria':'Cadastrar categoria'),corpo,'Salvar',function(){
    var nome=$('cNome').value.trim();
    if(!nome){toast('Informe o nome da categoria.');return false;}
    var alvo;
    if(c){c.nome=nome;c.impressao=$('cImp').value;c.imposto=$('cImp2').value;
      c.cor=tmp.cor;c.imagem=tmp.imagem;alvo=c;}
    else{
      alvo={id:uid('cat'),nome:nome,impressao:$('cImp').value,imposto:$('cImp2').value,
        cor:tmp.cor,imagem:tmp.imagem,ativo:true,ordem:DB.categorias.length,sucursais:[]};
      DB.categorias.push(alvo);
    }
    lerUnidades('catUn',alvo);
    salvar();renderCategorias();renderProdutos();
    /* mesma regra do produto: só diz salvo quando a nuvem confirma */
    confirmarNaNuvem('categorias',alvo.id,c?'Categoria atualizada':'Categoria');
    return true;
  });
  var cb=document.querySelectorAll('#coresBox .corBtn');
  for(var i=0;i<cb.length;i++)cb[i].onclick=function(){
    tmp.cor=this.getAttribute('data-c');
    for(var j=0;j<cb.length;j++)cb[j].classList.remove('on');
    this.classList.add('on');};
  $('catFile').onchange=function(){lerImagem(this,function(d){tmp.imagem=d;$('catPrev').innerHTML='<img src="'+d+'">';});};
}
function abaCat(btn,t){
  var tabs=btn.parentNode.querySelectorAll('.fpTab');
  for(var i=0;i<tabs.length;i++)tabs[i].classList.toggle('on',tabs[i]===btn);
  $('catB').classList.toggle('hide',t!=='b');
  $('catO').classList.toggle('hide',t!=='o');
}
/* ==========================================================
   FOTO DE PRODUTO: REDUZIR, NAO RECUSAR

   Antes, arquivo acima de 1 MB era simplesmente rejeitado. So que
   celular nenhum tira foto abaixo disso — qualquer camera decente
   entrega 3 a 8 MB. Na pratica a tela dizia "escolha uma foto pior",
   e quem estava cadastrando o cardapio nao tinha como obedecer.

   O tamanho do ARQUIVO nunca foi o problema: o que pesa no banco e na
   sincronizacao e a imagem depois de convertida. Entao ela entra do
   tamanho que vier e sai daqui com no maximo 1200px de largura em
   JPEG — o mesmo tratamento que o fundo do totem e o logo do cardapio
   ja recebiam. Foto de 8 MB vira algo em torno de 200 KB, com
   qualidade de sobra para a tela do PDV e do cardapio digital.
   ========================================================== */
function lerImagem(input,cb){
  var f=input.files&&input.files[0];if(!f)return;
  if(!/^image\//.test(f.type||'')){toast('Esse arquivo não é uma imagem.');return;}
  toast('Preparando a foto...');
  var r=new FileReader();
  r.onload=function(){
    var im=new Image();
    im.onload=function(){
      try{
        var L=520, esc=Math.min(1,L/(im.width||L));
        var c=document.createElement('canvas');
        c.width=Math.max(1,Math.round((im.width||L)*esc));
        c.height=Math.max(1,Math.round((im.height||L)*esc));
        c.getContext('2d').drawImage(im,0,0,c.width,c.height);
        var url=c.toDataURL('image/jpeg',0.72);
        /* ainda pesada: aperta ate caber com folga na memoria do navegador */
        if(url.length>90000)url=c.toDataURL('image/jpeg',0.6);
        if(url.length>90000)url=c.toDataURL('image/jpeg',0.45);
        cb(url);
        toast('Foto aplicada — '+Math.round(url.length/1024)+' KB.');
      }catch(e){
        _quieto(e,'lerImagem');
        toast('Não consegui preparar essa imagem.');
      }
    };
    im.onerror=function(){toast('Não consegui ler essa imagem.')};
    im.src=String(r.result||'');
  };
  r.onerror=function(){toast('Não consegui abrir o arquivo.')};
  r.readAsDataURL(f);
}

/* ---------- COLUNA PRODUTOS ---------- */
function renderProdutos(){
  var q=(S.buscaProd||'').toLowerCase();
  var cat=S.cat==='todos'?null:DB.categorias.find(function(x){return x.id===S.cat});
  var lista=DB.produtos.slice().sort(function(a,b){return a.ordem-b.ordem})
    .filter(function(p){return S.cat==='todos'||p.categoriaId===S.cat})
    .filter(function(p){return !q||p.nome.toLowerCase().indexOf(q)>=0||String(p.codigo||'').toLowerCase().indexOf(q)>=0});

  var h='<div class="cardH"><h2>'+(cat?E(cat.nome):'Todos os produtos')+'</h2><div class="acts">'+
  '<button class="btn b2" onclick="formProduto()">'+sv('plus',14)+' Cadastrar outros produtos</button>'+
  /* "Editar opções" nao dizia que ali se cadastra e edita TODO grupo —
     sabores, bordas, coberturas — num lugar so. O Rafael pediu essa tela
     sem saber que ela ja existia atras desse nome. */
  '<button class="btn" onclick="abrirGrupos()">'+sv('list',14)+' Grupos de opções'+
   ((DB.grupos||[]).length?' <span class="cnt2">'+DB.grupos.length+'</span>':'')+
  '</button></div></div>'+
  '<div class="srch"><span class="si">'+sv('search',15)+'</span>'+
  '<input id="bProd" placeholder="Pesquise por produto" value="'+E(S.buscaProd)+'"></div>'+
  '<div class="cardB" id="listaProd">';

  if(!lista.length){
    h+='<div class="vazio"><b>Nenhum produto '+(cat?'nesta categoria':'cadastrado')+'</b>'+
    'Use <b>Cadastrar outros produtos</b> para incluir o primeiro item do cardápio.</div>';
  }else{
    h+='<table class="pTable"><thead><tr><th>Produto</th><th style="width:130px">Preço</th>'+
    '<th style="width:250px">Disponível em</th><th style="width:130px">Status</th><th style="width:50px"></th></tr></thead><tbody>';
    lista.forEach(function(p){
      var c2=DB.categorias.find(function(x){return x.id===p.categoriaId});
      h+='<tr draggable="true" data-id="'+p.id+'">'+
      '<td><div class="pNome"><span class="grip">⠿</span><span class="txt"><b>'+E(p.nome)+'</b>'+
      '<small>'+(c2?E(c2.nome):'sem categoria')+(p.codigo?' · cód. '+E(p.codigo):'')+'</small></span></div></td>'+
      '<td><div class="cur" style="width:118px"><span>R$</span><input type="text" inputmode="decimal" autocomplete="off" placeholder="0,00" class="moeda pPreco" value="'+((p.preco||0)?money(p.preco):'')+'" onchange="mudarPreco(\''+p.id+'\',this.value)"></div></td>'+
      '<td><button class="dispBtn" data-pop="1" onclick="menuCanais(event,\''+p.id+'\')"><span>'+resumoCanais(p)+'</span>'+sv('dn',13)+'</button></td>'+
      '<td><div style="display:flex;align-items:center;gap:8px">'+
      '<button class="sw'+(p.ativo!==false?' on':'')+'" onclick="toggleProd(\''+p.id+'\')"></button>'+
      '<span class="swLb'+(p.ativo!==false?' on':'')+'">'+(p.ativo!==false?'Ativo':'Inativo')+'</span></div></td>'+
      '<td><button class="dots" data-pop="1" onclick="menuProd(event,\''+p.id+'\')">'+sv('dots',16)+'</button></td>'+
      '</tr>';
    });
    h+='</tbody></table>';
  }
  h+='</div>';
  $('colProd').innerHTML=h;
  $('bProd').oninput=function(){S.buscaProd=this.value;renderProdutos();};
  ativarArrasto('#listaProd tbody tr',function(de,para){reordenar(DB.produtos,de,para);salvar();renderProdutos();
    toast('Ordem atualizada — vale também para a frente de caixa.');});
}
function resumoCanais(p){
  var d=p.disponivel||{};
  var on=CANAIS.filter(function(c){return d[c.id]});
  if(on.length===CANAIS.length)return 'Todos os canais';
  /* Dizia "Nenhum canal selecionado", e o produto aparecia em todo lugar.
     A tela contava o contrário do que o sistema fazia. */
  if(!on.length)return 'Todos — nada marcado ainda';
  return on.map(function(c){return c.n}).join(', ');
}
function mudarPreco(id,v){
  var p=DB.produtos.find(function(x){return x.id===id});
  p.preco=moedaLer(v);salvar();
  toast('Preço atualizado em todos os canais.');
}
function toggleProd(id){
  var p=DB.produtos.find(function(x){return x.id===id});
  p.ativo=p.ativo===false;salvar();renderProdutos();
  toast('Produto '+(p.ativo?'ativado':'inativado')+'.');
}
function menuCanais(ev,id){
  ev.stopPropagation();
  var p=DB.produtos.find(function(x){return x.id===id});
  p.disponivel=p.disponivel||{};
  var h=CANAIS.map(function(c){
    return '<label><input type="checkbox" data-c="'+c.id+'"'+(p.disponivel[c.id]?' checked':'')+'>'+c.n+'</label>';}).join('');
  var el=pop(ev,h);
  var cks=el.querySelectorAll('input');
  for(var i=0;i<cks.length;i++)cks[i].onchange=function(){
    p.disponivel[this.getAttribute('data-c')]=this.checked;salvar();renderProdutos();};
}
function menuProd(ev,id){
  ev.stopPropagation();
  pop(ev,'<button onclick="formProduto(\''+id+'\');fecharPops()">'+sv('edit',15)+' Editar produto</button>'+
  '<button onclick="vincularFicha(\''+id+'\');fecharPops()">'+sv('link',15)+' Vincular ficha técnica</button>'+
  '<button onclick="duplicarProd(\''+id+'\');fecharPops()">'+sv('copy',15)+' Duplicar</button>'+
  '<div class="popSep"></div>'+
  '<button class="rd" onclick="excluirProd(\''+id+'\');fecharPops()">'+sv('trash',15)+' Excluir</button>');
}
function duplicarProd(id){
  var p=DB.produtos.find(function(x){return x.id===id});
  var n=JSON.parse(JSON.stringify(p));
  n.id=uid('prod');n.nome=p.nome+' (cópia)';n.ordem=DB.produtos.length;
  DB.produtos.push(n);salvar();renderProdutos();toast('Produto duplicado.');
}
async function excluirProd(id){
  var p=DB.produtos.find(function(x){return x.id===id});
  if(!await pergunta('Excluir o produto "'+p.nome+'"?'))return;
  DB.produtos=DB.produtos.filter(function(x){return x.id!==id}); declararExclusao('produtos',id); /* exclusao declarada: so isto autoriza apagar da nuvem (V201) */
  salvar();renderProdutos();toast('Produto excluído.');
}

/* ---------- VINCULAR FICHA TECNICA ---------- */
function vincularFicha(id){
  baseFicha();
  var p=DB.produtos.find(function(x){return x.id===id});
  var fichas=(DB.fichas||[]).slice().sort(function(a,b){return (a.nome||'').localeCompare(b.nome||'')});
  var insu=(DB.insumos||[]).slice().sort(function(a,b){return (a.nome||'').localeCompare(b.nome||'')});
  var h='<div class="mdB">'+
  '<div class="blk" style="margin:0 0 11px;max-width:none"><h3>'+E(p.nome)+
   ' <small>preço R$ '+money(p.preco)+'</small></h3>'+
  '<label class="optCard"><input type="checkbox" id="fVinc" '+(p.vinculaEstoque?'checked':'')+'>'+
  '<span><b>Vincular ao estoque</b><span>ao vender este produto, os ingredientes são baixados automaticamente</span></span></label>'+
  '</div>'+
  '<div class="blk" style="margin:0 0 11px;max-width:none"><h3>Como este produto baixa o estoque</h3>'+
  '<div class="row2">'+
   '<label class="optCard"><input type="radio" name="fMod" value="ficha" '+(!p.insumoId?'checked':'')+' onchange="trocaModoVinc()">'+
   '<span><b>Por ficha técnica</b><span>produto produzido — baixa cada ingrediente da receita</span></span></label>'+
   '<label class="optCard"><input type="radio" name="fMod" value="insumo" '+(p.insumoId?'checked':'')+' onchange="trocaModoVinc()">'+
   '<span><b>Por ingrediente único</b><span>revenda — baixa direto um item do estoque</span></span></label>'+
  '</div></div>'+
  '<div class="blk" style="margin:0;max-width:none" id="boxFicha" style2="">'+
   '<h3>Ficha técnica</h3>'+
   '<div class="fld2"><label>Localizar ficha</label>'+
    '<input id="fBusca" placeholder="digite o nome da ficha" autocomplete="off"></div>'+
   '<div id="fLista" class="pickList2"></div>'+
   '<div id="fSel" class="fichaSel"></div>'+
   '<div class="hint" style="margin-top:9px">Cadastre novas fichas em <b>Gestão de Estoque › Ficha Técnica</b>.</div>'+
  '</div>'+
  '<div class="blk" style="margin:0;max-width:none;display:none" id="boxIns">'+
   '<h3>Ingrediente</h3>'+
   '<div class="fld2" style="margin:0"><label>Item do estoque</label><select id="fIng">'+
    '<option value="">Selecione o ingrediente</option>'+
    insu.map(function(i){return '<option value="'+i.id+'"'+(p.insumoId===i.id?' selected':'')+'>'+
      E(i.nome)+' — R$ '+money(custoAtual(i))+' / '+un(i.unidade).ab+'</option>'}).join('')+
   '</select></div>'+
   '<div class="row2" style="margin-top:11px">'+
    '<div class="fld2" style="margin:0"><label>Quantidade baixada por venda</label>'+
     '<input id="fQtd" type="number" step="0.001" value="'+(p.insumoQtd||1)+'"></div>'+
    '<div class="fld2" style="margin:0"><label>Unidade</label><select id="fUn">'+
     unidades().map(function(u){return '<option value="'+u.id+'"'+(p.insumoUn===u.id?' selected':'')+'>'+u.n+'</option>'}).join('')+
    '</select></div></div>'+
  '</div></div>';

  modal('Vincular ficha técnica',h,'Salvar',function(){
    var modo=(document.querySelector('input[name=fMod]:checked')||{}).value||'ficha';
    p.vinculaEstoque=$('fVinc').checked;
    if(modo==='ficha'){
      p.fichaId=_fichaEscolhida||null;p.insumoId=null;
    }else{
      p.insumoId=$('fIng').value||null;p.fichaId=null;
      p.insumoQtd=parseFloat($('fQtd').value)||1;
      p.insumoUn=$('fUn').value;
    }
    salvar();telaCardapio();
    toast(p.vinculaEstoque?'Vínculo salvo — este produto passa a baixar estoque.':'Vínculo salvo.');
    return true;
  },'lg');

  _fichaEscolhida=p.fichaId||null;
  function lista(q){
    var r=fichas.filter(function(f){
      if(!q)return true;
      return (f.nome||'').toLowerCase().indexOf(q)>=0||String(f.codigo||'').indexOf(q)>=0;
    }).slice(0,30);
    $('fLista').innerHTML=r.length?('<table class="fkTab"><tbody>'+r.map(function(f){
      return '<tr class="'+(_fichaEscolhida===f.id?'on':'')+'" onclick="escolheFicha(\''+f.id+'\')">'+
      '<td class="fkCod">'+E(f.codigo)+'</td>'+
      '<td class="fkNm">'+E(f.nome)+'</td>'+
      '<td class="fkIng">'+(f.itens||[]).length+' ing.</td>'+
      '<td class="fkCus">R$ '+money(custoPorVenda(f))+'</td>'+
      '<td class="fkOk">'+(_fichaEscolhida===f.id?sv('check',12):'')+'</td></tr>';
    }).join('')+'</tbody></table>'):'<div class="hint" style="padding:10px">Nenhuma ficha encontrada.</div>';
    mostraSel();
  }
  function mostraSel(){
    var f=fichas.find(function(x){return x.id===_fichaEscolhida});
    $('fSel').innerHTML=f?'<div class="fsBox">'+sv('check',14)+
      '<div><b>'+E(f.nome)+'</b><span>custo R$ '+money(custoPorVenda(f))+' por unidade de venda'+
      (p.preco?' · CMV '+((custoPorVenda(f)/p.preco)*100).toFixed(1).replace('.',',')+'%':'')+'</span></div>'+
      '<button class="arvB rd" onclick="escolheFicha(\'\')">'+sv('x2',12)+'</button></div>':'';
  }
  window.escolheFicha=function(fid){_fichaEscolhida=fid||null;lista(($('fBusca').value||'').toLowerCase().trim());};
  $('fBusca').oninput=function(){lista(this.value.toLowerCase().trim())};
  lista('');
  trocaModoVinc();
}
var _fichaEscolhida=null;
function trocaModoVinc(){
  var modo=(document.querySelector('input[name=fMod]:checked')||{}).value||'ficha';
  var bf=$('boxFicha'),bi=$('boxIns');
  if(bf)bf.style.display=modo==='ficha'?'':'none';
  if(bi)bi.style.display=modo==='insumo'?'':'none';
}

/* ---------- ARRASTAR PARA REORDENAR ---------- */
var _dragId=null;
function ativarArrasto(sel,onSolta){
  var els=document.querySelectorAll(sel);
  for(var i=0;i<els.length;i++){
    els[i].ondragstart=function(e){_dragId=this.getAttribute('data-id');this.classList.add('drag');
      e.dataTransfer.effectAllowed='move';};
    els[i].ondragend=function(){this.classList.remove('drag');
      var o=document.querySelectorAll('.over');for(var j=0;j<o.length;j++)o[j].classList.remove('over');};
    els[i].ondragover=function(e){e.preventDefault();this.classList.add('over');};
    els[i].ondragleave=function(){this.classList.remove('over');};
    els[i].ondrop=function(e){e.preventDefault();e.stopPropagation();
      this.classList.remove('over');
      var alvo=this.getAttribute('data-id');
      if(_dragId&&alvo&&_dragId!==alvo)onSolta(_dragId,alvo);
      _dragId=null;};
  }
}
function reordenar(arr,idDe,idPara){
  arr.sort(function(a,b){return a.ordem-b.ordem});
  var de=arr.findIndex(function(x){return x.id===idDe});
  var para=arr.findIndex(function(x){return x.id===idPara});
  if(de<0||para<0)return;
  var item=arr.splice(de,1)[0];
  arr.splice(para,0,item);
  arr.forEach(function(x,i){x.ordem=i});
}

/* ---------- FORMULARIO DE PRODUTO (pagina cheia) ---------- */
var _prod=null,_abaProd='dados';
function formProduto(id){
  var p=id?JSON.parse(JSON.stringify(DB.produtos.find(function(x){return x.id===id}))):{
    id:null,nome:'',preco:0,pesado:false,variacao:false,categoriaId:S.cat!=='todos'?S.cat:(DB.categorias[0]?DB.categorias[0].id:''),
    /* ==========================================================
       O PRODUTO NASCIA COM CANAIS QUE NAO EXISTEM (V200)

       O padrao era {delivery, salao, online, digital}. Os canais reais
       do sistema, em `CANAIS`, sao: pdv, delivery, cardapio, mesa,
       totem. `salao`, `online` e `digital` nao existem em lugar nenhum
       — sobraram de uma versao antiga.

       Efeito: produto novo nascia com `pdv` AUSENTE. Como
       `disponivelNo()` so devolve "todos" quando NENHUM canal esta
       marcado, e aqui havia tres marcados (todos invalidos), o produto
       ficava invisivel na frente de caixa desde o instante em que era
       criado. E no cardapio digital aparecia so por causa do
       `d.online` legado.

       Agora nasce marcado nos canais que existem.
       ========================================================== */
    disponivel:{pdv:true,delivery:true,cardapio:true},codigo:'',imagem:'',ativo:true,
    nomeOnline:'',detalhes:'',grupos:[],promocoes:[{ativo:false,canal:'online',preco:0,dias:[],de:'',ate:''},
    {ativo:false,canal:'digital',preco:0,dias:[],de:'',ate:''}]};
  _prod=p;_abaProd='dados';
  desenhaFormProduto(!!id);
}
function desenhaFormProduto(edit){
  $('content').innerHTML='<div class="formPage">'+
  '<div class="fpHead"><h1>'+(edit?'Editar produto':'Cadastrar produto')+'</h1></div>'+
  '<div class="fpTabs">'+
  '<button class="fpTab'+(_abaProd==='dados'?' on':'')+'" onclick="abaProd(\'dados\')">Dados do produto</button>'+
  '<button class="fpTab'+(_abaProd==='opcoes'?' on':'')+'" onclick="abaProd(\'opcoes\')">Opções</button>'+
  '<button class="fpTab'+(_abaProd==='disp'?' on':'')+'" onclick="abaProd(\'disp\')">Disponibilidade e detalhes</button>'+
  '</div><div class="fpBody" id="fpBody"></div>'+
  '<div class="fpFoot">'+
  '<button class="btn" onclick="telaCardapio()">Cancelar</button>'+
  '<button class="btn" onclick="salvarProduto(\'copia\')">Salvar e criar uma cópia</button>'+
  '<button class="btn" onclick="salvarProduto(\'novo\')">Salvar e cadastrar novo</button>'+
  '<button class="btn p" onclick="salvarProduto(\'sair\')">Salvar</button>'+
  '</div></div>';
  renderAbaProd();
}
function abaProd(a){lerFormProduto();_abaProd=a;desenhaFormProduto(!!_prod.id);}
function renderAbaProd(){
  if(_abaProd==='dados')return abaDados();
  if(_abaProd==='opcoes')return abaOpcoes();
  return abaDisp();
}
function abaDados(){
  var p=_prod;
  var cats=DB.categorias.map(function(c){return '<option value="'+c.id+'"'+(p.categoriaId===c.id?' selected':'')+'>'+E(c.nome)+'</option>'}).join('');
  $('fpBody').innerHTML='<div class="blk"><h3>Dados do produto</h3>'+
  '<div class="row2">'+
  '<div class="fld2"><label>Nome do produto *</label><input id="pNome" value="'+E(p.nome)+'" placeholder="Insira o nome deste produto"></div>'+
  '<div class="fld2"><label>Preço de venda</label><div class="cur"><span>R$</span><input type="text" inputmode="decimal" autocomplete="off" placeholder="0,00" class="moeda" id="pPreco" value="'+((p.preco||0)?money(p.preco):'')+'"></div></div>'+
  '</div>'+
  '<label class="chkL"><input type="checkbox" id="pPesado" '+(p.pesado?'checked':'')+'>'+
  '<span>Este produto é pesado em balança ou vendido em meia porção</span></label>'+
  '<div class="fld2" style="margin-top:14px"><label>Produto possui variação de tamanho?</label>'+
  '<label class="radL"><input type="radio" name="pvar" value="nao" '+(!p.variacao?'checked':'')+'> Não</label>'+
  '<label class="radL"><input type="radio" name="pvar" value="sim" '+(p.variacao?'checked':'')+'> Sim</label></div>'+
  '<div class="fld2"><label>Categoria *</label><select id="pCat">'+
  (cats||'<option value="">— cadastre uma categoria primeiro —</option>')+'</select></div>'+
  '</div>'+
  (fiscalCfg().modo!=='desligado'
   ?'<div class="blk"><h3>Dados fiscais</h3>'+
    '<div class="hint" style="margin:-4px 0 10px">Em branco, vale o padrão da '+
    '<b>Configuração Fiscal</b>. O NCM é o único que a SEFAZ não perdoa.</div>'+
    '<div class="row2">'+
     '<div class="fld2"><label>NCM</label><input id="pdNcm" value="'+E(p?(p.ncm||''):'')+
      '" placeholder="'+E(fiscalCfg().ncm||'8 dígitos')+'"></div>'+
     '<div class="fld2"><label>CFOP</label><input id="pdCfop" value="'+E(p?(p.cfop||''):'')+
      '" placeholder="'+E(fiscalCfg().cfop||'5102')+'"></div>'+
    '</div>'+
    '<div class="row2">'+
     '<div class="fld2"><label>'+(fiscalCfg().regime==='simples'?'CSOSN':'CST')+'</label>'+
      '<input id="pdCst" value="'+E(p?(fiscalCfg().regime==='simples'?(p.csosn||''):(p.cst||'')):'')+
      '" placeholder="'+E(fiscalCfg().regime==='simples'?(fiscalCfg().csosn||'102'):(fiscalCfg().cst||'00'))+'"></div>'+
     '<div class="fld2"><label>Código de barras (GTIN)</label>'+
      '<input id="pdGtin" value="'+E(p?(p.gtin||''):'')+'" placeholder="opcional"></div>'+
    '</div>'+
   '</div>':'')+
  blocoUnidades(p,'pdUn')+
  '<div class="blk"><h3>Onde o produto está disponível?</h3>'+
  '<div class="hint" style="margin:-4px 0 10px">É daqui que sai o cardápio digital: '+
  'marque Delivery, Pedido online ou Cardápio digital e o item aparece lá sozinho. '+
  'Sem nenhuma marcação, o produto aparece em todos os canais.</div>'+
  '<div class="canais">'+
  CANAIS.map(function(c){return '<label class="chkL"><input type="checkbox" class="pCan" data-c="'+c.id+'"'+
    ((p.disponivel||{})[c.id]?' checked':'')+'><span>'+c.n+'</span></label>'}).join('')+
  '</div></div>'+
  '<div class="blk"><h3>Identificação e imagem</h3><div class="row2">'+
  '<div class="fld2"><label>Código do produto</label><input id="pCod" value="'+E(p.codigo)+'" placeholder="opcional">'+
  '<div class="hint">Usado para integração e busca rápida na frente de caixa.</div></div>'+
  '<div class="fld2"><label>Foto do produto</label><div class="fotoBox">'+
  '<div class="fotoPrev" id="pPrev">'+(p.imagem?'<img src="'+p.imagem+'">':sv('img',24))+'</div>'+
  '<input type="file" id="pFile" accept="image/*" style="font-size:12px"></div></div>'+
  '</div></div>';
  $('pFile').onchange=function(){lerImagem(this,function(d){_prod.imagem=d;$('pPrev').innerHTML='<img src="'+d+'">';});};
}
function abaOpcoes(){
  var p=_prod;
  var h='<div class="blk"><h3>Grupos de opções <small>sabores, adicionais, bordas, tamanhos</small></h3>'+
  '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">'+
  '<button class="btn b2" onclick="formGrupo()">'+sv('plus',14)+' Criar novo grupo</button>'+
  '<button class="btn" onclick="abaProd(\'opcoes\')">'+sv('ref',14)+' Atualizar lista</button></div>';
  if(!DB.grupos.length){
    h+='<div class="vazio" style="padding:30px"><b>Nenhum grupo cadastrado</b>'+
    'Crie um grupo (ex.: Bordas, Sabores) para usar neste e em outros produtos.</div>';
  }else{
    h+='<div class="hint" style="margin-bottom:9px">Marque os grupos que este produto usa. Os grupos ficam salvos e podem ser reaproveitados em outros produtos.</div>'+
    '<div class="pickList">'+
    DB.grupos.map(function(g){
      return '<label><input type="checkbox" class="pGrp" value="'+g.id+'"'+((p.grupos||[]).indexOf(g.id)>=0?' checked':'')+'>'+
      '<span><b>'+E(g.nome)+'</b>'+(g.forcado?' <span class="tagF">pergunta forçada</span>':'')+
      '<div style="font-size:11px;color:var(--ink-3)">mín '+(g.min||0)+' · máx '+((g.max==null?1:Number(g.max)))+' · '+
      (g.opcoes||[]).length+' opções</div></span>'+
      '<small><button class="btn sm" onclick="event.preventDefault();formGrupo(\''+g.id+'\')">editar</button></small></label>';
    }).join('')+'</div>';
  }
  h+='</div>';

  var marcados=(p.grupos||[]).map(function(id){return DB.grupos.find(function(g){return g.id===id})}).filter(Boolean);
  if(marcados.length){
    h+='<div class="blk"><h3>Prévia do que o caixa vai perguntar</h3>';
    marcados.forEach(function(g){
      h+='<div class="grpCard"><div class="grpTop"><b>'+E(g.nome)+'</b>'+
      (g.forcado?'<span class="tagF">obrigatório perguntar</span>':'')+
      '<span class="grpMeta">mín '+(g.min||0)+' · máx '+((g.max==null?1:Number(g.max)))+'</span></div>'+
      '<div class="grpOps">'+((g.opcoes||[]).length?g.opcoes.map(function(o){
        return '<span class="opChip">'+E(o.nome)+(o.preco?' +R$ '+money(o.preco):'')+'</span>'}).join(''):
        '<span class="grpMeta">sem opções cadastradas</span>')+'</div></div>';
    });
    h+='<div class="hint">Os grupos marcados como <b>pergunta forçada</b> aparecem automaticamente na frente de caixa antes de fechar o item — o caixa é obrigado a perguntar ao cliente.</div></div>';
  }
  $('fpBody').innerHTML=h;
}
function abaDisp(){
  var p=_prod;
  var h='<div class="blk"><h3>Informações do produto</h3>'+
  '<div class="hint" style="margin-bottom:14px">Você pode dar ao produto um nome diferente nas plataformas de venda online. Se não preencher, será usado o mesmo nome do sistema.</div>'+
  '<div class="row2">'+
  '<div class="fld2"><label>Nome no sistema</label><input value="'+E(p.nome)+'" disabled style="background:var(--alt)"></div>'+
  '<div class="fld2"><label>Nome nas plataformas online</label><input id="pNomeOn" value="'+E(p.nomeOnline)+'" placeholder="opcional"></div>'+
  '</div>'+
  '<div class="fld2"><label>Detalhes</label><textarea id="pDet" maxlength="400" placeholder="Fale um pouco mais sobre este item">'+E(p.detalhes)+'</textarea>'+
  '<div class="hint" id="contDet">'+(p.detalhes||'').length+'/400</div></div></div>'+
  '<div class="blk"><h3>Promoções <small>preço promocional por canal, dia e horário</small></h3>';
  (p.promocoes||[]).forEach(function(pr,i){
    var canal=CANAIS.find(function(c){return c.id===pr.canal});
    h+='<div class="promo" style="margin-bottom:11px">'+
    '<div class="promoRow">'+
    '<div><label style="font-size:12.5px;font-weight:600;color:var(--ink-2);display:block;margin-bottom:6px">Ativar</label>'+
    '<button class="sw'+(pr.ativo?' on':'')+'" onclick="togglePromo('+i+')"></button></div>'+
    '<div class="fld2" style="margin:0"><label>Canal</label><input value="'+(canal?canal.n:pr.canal)+'" disabled style="background:#fff"></div>'+
    '<div class="fld2" style="margin:0"><label>Preço original</label><input value="R$ '+money(p.preco)+'" disabled style="background:#fff"></div>'+
    '<div class="fld2" style="margin:0"><label>Preço promocional</label>'+
    '<div class="cur"><span>R$</span><input type="text" inputmode="decimal" autocomplete="off" placeholder="0,00" class="moeda prPreco" data-i="'+i+'" value="'+((pr.preco||0)?money(pr.preco):'')+'"></div></div>'+
    '</div>'+
    '<div class="fld2" style="margin-bottom:9px"><label>Dias da semana</label><div class="dias">'+
    DIAS.map(function(d,di){return '<button class="diaBtn'+((pr.dias||[]).indexOf(di)>=0?' on':'')+'" onclick="toggleDia('+i+','+di+')">'+d+'</button>'}).join('')+
    '</div></div>'+
    '<div class="row3"><div class="fld2" style="margin:0"><label>Das</label><input class="prDe" data-i="'+i+'" type="time" value="'+(pr.de||'')+'"></div>'+
    '<div class="fld2" style="margin:0"><label>Às</label><input class="prAte" data-i="'+i+'" type="time" value="'+(pr.ate||'')+'"></div><div></div></div>'+
    '</div>';
  });
  h+='<div class="hint">A promoção entra e sai sozinha no horário e nos dias marcados, e vale também na frente de caixa.</div></div>';
  $('fpBody').innerHTML=h;
  var td=$('pDet');
  if(td)td.oninput=function(){$('contDet').textContent=this.value.length+'/400';};
}
function togglePromo(i){lerFormProduto();_prod.promocoes[i].ativo=!_prod.promocoes[i].ativo;renderAbaProd();}
function toggleDia(i,d){
  lerFormProduto();
  var arr=_prod.promocoes[i].dias||[];
  var k=arr.indexOf(d);
  if(k>=0)arr.splice(k,1);else arr.push(d);
  _prod.promocoes[i].dias=arr;renderAbaProd();
}
function lerFormProduto(){
  var p=_prod;if(!p)return;
  if($('pNome'))p.nome=$('pNome').value;
  if($('pPreco'))p.preco=moedaValor('pPreco');
  if($('pPesado'))p.pesado=$('pPesado').checked;
  var rv=document.querySelector('input[name=pvar]:checked');
  if(rv)p.variacao=rv.value==='sim';
  if($('pCat'))p.categoriaId=$('pCat').value;
  if($('pCod'))p.codigo=$('pCod').value;
  var cans=document.querySelectorAll('.pCan');
  if(cans.length){p.disponivel={};for(var i=0;i<cans.length;i++)p.disponivel[cans[i].getAttribute('data-c')]=cans[i].checked;}
  var gs=document.querySelectorAll('.pGrp');
  if(gs.length){p.grupos=[];for(var j=0;j<gs.length;j++)if(gs[j].checked)p.grupos.push(gs[j].value);}
  if($('pNomeOn'))p.nomeOnline=$('pNomeOn').value;
  if($('pDet'))p.detalhes=$('pDet').value;
  /* fiscais: só existem na tela quando o fiscal está ligado */
  lerUnidades('pdUn',p);           /* quem enxerga este produto */
  if($('pdNcm'))p.ncm=soDigitos($('pdNcm').value);
  if($('pdCfop'))p.cfop=soDigitos($('pdCfop').value);
  if($('pdGtin'))p.gtin=soDigitos($('pdGtin').value);
  if($('pdCst')){
    if(fiscalCfg().regime==='simples')p.csosn=soDigitos($('pdCst').value);
    else p.cst=soDigitos($('pdCst').value);
  }
  var pp=document.querySelectorAll('.prPreco');
  for(var k=0;k<pp.length;k++)p.promocoes[pp[k].getAttribute('data-i')].preco=moedaValor(pp[k]);
  var pd=document.querySelectorAll('.prDe');
  for(var m=0;m<pd.length;m++)p.promocoes[pd[m].getAttribute('data-i')].de=pd[m].value;
  var pa=document.querySelectorAll('.prAte');
  for(var n=0;n<pa.length;n++)p.promocoes[pa[n].getAttribute('data-i')].ate=pa[n].value;
}
/* ==========================================================
   A PROVA DE QUE SUBIU

   Serve para qualquer cadastro. Espera a sincronizacao, olha o mapa de
   identificadores e diz a verdade: ou confirma, ou explica por que nao
   confirmou e o que fica acontecendo.

   Nunca desfaz o que a pessoa fez — o registro continua no aparelho e
   sobe sozinho quando der. O que muda e ela SABER.
   ========================================================== */
async function confirmarNaNuvem(col,id,rotulo){
  var subiu=function(){
    try{ return !!(DB._uuid&&DB._uuid[col]&&DB._uuid[col][id]); }catch(e){ return false; }
  };
  if(!NUVEM.ligada){
    toast(rotulo+' salvo neste aparelho. Sobe assim que a internet voltar.');
    return false;
  }
  if(subiu()){ toast(rotulo+' salvo.'); return true; }
  toast(rotulo+' salvo — enviando…');
  try{ await sincronizar(); }catch(e){ _quieto(e,'confirmarNaNuvem'); }
  /* ==========================================================
     ESPERAR DE VERDADE, E NAO SO PEDIR

     AQUI ESTAVA O ALARME FALSO.

     `sincronizar()` comeca com uma guarda: se ja existe um envio em
     andamento, ela marca `pendente`, escreve "envio adiado" e RETORNA NA
     HORA — sem enviar nada. Entao este `await` acima voltava em 1
     milissegundo, o mapa de identificadores ainda nao tinha o registro, e
     a tela abria "ainda nao chegou a nuvem".

     Medido: o aviso aparecia com 1 ms de espera, e o produto chegava na
     nuvem no envio seguinte, poucos segundos depois. Estava certo o
     tempo todo — quem desistia era a tela.

     E, com fila grande, essa era a situacao NORMAL: o aparelho do Rafael
     tinha 1.510 alteracoes esperando, entao sempre havia um envio em
     andamento e o aviso aparecia em toda gravacao.

     Agora, se ha envio em andamento ou pendente, espera-se ele terminar,
     olhando o mapa de tempos em tempos. So se passar do teto e que se
     avisa — e ai com o texto certo.
     ========================================================== */
  var _ate=Date.now()+30000;
  while(!subiu()&&Date.now()<_ate&&(NUVEM.sincronizando||NUVEM.pendente)){
    await new Promise(function(r){setTimeout(r,400)});
  }
  if(subiu()){ toast(rotulo+' salvo e enviado.'); return true; }
  /* ainda na fila, mas o envio esta trabalhando: isso nao e falha */
  if(NUVEM.sincronizando||NUVEM.pendente){
    await confirmar({titulo:rotulo+' salvo — ainda subindo',
      texto:'Está guardado neste aparelho e a fila de envio está grande. '+
        'Ele sobe sozinho em alguns minutos, sem você precisar fazer nada.',
      aviso:'Não feche o sistema até o rodapé parar de dizer "Sincronizando". '+
        'Se quiser acompanhar: Sistema › Diagnóstico › Fila de envio.',
      ok:'Entendi',cancelar:null});
    return false;
  }
  /* nao subiu: diz por que, com o que o motor souber */
  var motivo='';
  try{
    var f=auditarFila();
    if(f.PERMISSAO.some(function(x){return x.id===id}))motivo='o banco recusou por permissão';
    else if(f.TENANT_DESCONHECIDO.some(function(x){return x.id===id}))motivo='o registro ficou sem empresa';
    else if((NUVEM.erros||[]).length)motivo=NUVEM.erros[0].motivo||'a nuvem recusou';
    else if((FALHAS||[]).length)motivo=String(FALHAS[0].msg||'').slice(0,80);
  }catch(e){}
  await confirmar({titulo:rotulo+' ainda não chegou à nuvem',
    texto:'Está guardado neste aparelho e vai continuar tentando sozinho. '+
      'Mas ainda não está no banco — se você fechar em outro computador, não vai ver.',
    aviso:(motivo?'Motivo: '+E(motivo)+'<br>':'')+
      'Veja em Sistema › Diagnóstico › Fila de envio e mande para o suporte.',
    ok:'Entendi',cancelar:null});
  return false;
}
/* ==========================================================
   "SALVO" PASSA A SIGNIFICAR "ESTA NA NUVEM" (V200)

   Ate aqui o botao dizia "Produto salvo." assim que gravava no
   aparelho, e o envio ficava agendado para depois. Quando o envio
   falhava — por qualquer motivo — ninguem ficava sabendo. O produto
   sumia na proxima sincronizacao e a pessoa jurava que tinha salvado.

   Foi exatamente isso que aconteceu: NENHUM produto chegou ao banco
   desde 20/08, e a tela dizia "salvo" toda vez.

   Agora o sistema espera a nuvem confirmar e olha o mapa de
   identificadores: se o produto recebeu um id de la, esta salvo de
   verdade. Se nao recebeu, a pessoa e avisada na hora, com o motivo, e
   o produto continua no aparelho aguardando — nada se perde.

   `DB._uuid.produtos[id]` so e preenchido quando a nuvem devolve o
   registro. E a unica prova que vale.
   ========================================================== */
async function salvarProduto(depois){
  lerFormProduto();
  var p=_prod;
  if(!p.nome.trim()){toast('Informe o nome do produto.');abaProd('dados');return;}
  if(!p.categoriaId){toast('Selecione uma categoria. Cadastre uma se ainda não houver.');abaProd('dados');return;}
  if(p.id){
    var i=DB.produtos.findIndex(function(x){return x.id===p.id});
    /* findIndex devolve -1 quando o produto sumiu da lista entre abrir o
       formulario e salvar. `DB.produtos[-1]=p` nao insere nada: cria uma
       propriedade solta e o produto evapora. Agora ele volta para a lista. */
    if(i>=0)DB.produtos[i]=p; else DB.produtos.push(p);
  }else{
    p.id=uid('prod');p.ordem=DB.produtos.length;DB.produtos.push(p);
  }
  salvar();
  await confirmarNaNuvem('produtos',p.id,'Produto');
  if(depois==='sair')return telaCardapio();
  if(depois==='copia'){
    var c=JSON.parse(JSON.stringify(p));c.id=null;c.nome=p.nome+' (cópia)';
    _prod=c;_abaProd='dados';return desenhaFormProduto(false);
  }
  if(depois==='novo'){return formProduto();}
}

/* ---------- GRUPOS DE OPÇÕES ---------- */
var _grp=null,_gops=[];
function abrirGrupos(){
  var h='<div class="mdB"><div style="margin-bottom:12px"><button class="btn b2" onclick="formGrupo()">'+
  sv('plus',14)+' Criar novo grupo</button></div>';
  if(!DB.grupos.length)h+='<div class="vazio" style="padding:30px"><b>Nenhum grupo cadastrado</b>Grupos servem para sabores, adicionais e bordas.</div>';
  DB.grupos.forEach(function(g){
    var canT={pdv:'só caixa',cardapio:'só cardápio',totem:'só totem'};
    var qProd=(DB.produtos||[]).filter(function(pp){return (pp.grupos||[]).indexOf(g.id)>=0}).length;
    h+='<div class="grpCard"><div class="grpTop"><b>'+E(g.nome)+'</b>'+
    (g.forcado?'<span class="tagF">pergunta forçada</span>':'')+
    ((g.canais||[]).length&&g.canais.length<3
      ?'<span class="tagC">'+g.canais.map(function(c){return canT[c]||c}).join(' e ')+'</span>':'')+
    '<span class="grpMeta">mín '+(g.min||0)+' · máx '+((g.max==null?1:Number(g.max)))+
      ' · em '+qProd+' produto'+(qProd===1?'':'s')+'</span>'+
    '<button class="btn sm" onclick="formGrupo(\''+g.id+'\')">'+sv('edit',13)+'</button>'+
    '<button class="btn sm" onclick="excluirGrupo(\''+g.id+'\')">'+sv('trash',13)+'</button></div>'+
    /* mostrar a ficha de cada opcao evita ter de abrir o grupo so para
       conferir se a baixa de estoque foi vinculada */
    '<div class="grpOps">'+((g.opcoes||[]).length?g.opcoes.map(function(o){
      var fn=nomeFichaDe(o.fichaId);
      return '<span class="opChip'+(fn?' comF':'')+'">'+E(o.nome)+
        (o.preco?' +R$ '+money(o.preco):'')+
        (fn?'<i>'+E(fn)+'</i>':'<i class="sem">sem ficha</i>')+'</span>'}).join(''):
      '<span class="grpMeta">sem opções</span>')+'</div></div>';
  });
  h+='</div>';
  modal('Grupos de opções',h,'Fechar',function(){return true;},'lg');
}
function formGrupo(id){
  var m=$('mdOv');if(m)m.remove();
  var g=id?DB.grupos.find(function(x){return x.id===id}):null;
  _grp=g;_gops=g?JSON.parse(JSON.stringify(g.opcoes||[])):[];
  var corpo='<div class="mdB">'+
  '<div class="blk" style="margin:0 0 12px;max-width:none">'+
  '<div class="fld2"><label>Nome do grupo *</label><input id="gNome" value="'+E(g?g.nome:'')+'" placeholder="Ex.: Bordas, Sabores, Adicionais"></div>'+
  '<div class="row3">'+
  '<div class="fld2"><label>Mínimo de escolhas</label><input id="gMin" type="number" value="'+(g?(g.min||0):0)+'"></div>'+
  '<div class="fld2"><label>Máximo de escolhas</label><input id="gMax" type="number" value="'+(g?((g.max==null?1:Number(g.max))):1)+'"></div>'+
  '<div class="fld2"><label>&nbsp;</label><label class="chkL"><input type="checkbox" id="gForc" '+(g&&g.forcado?'checked':'')+'>'+
  '<span>Pergunta forçada</span></label></div></div>'+
  '<div class="hint">Com <b>pergunta forçada</b>, ao lançar o produto na frente de caixa o sistema abre estas opções antes de fechar o item — o caixa é obrigado a perguntar (ex.: "aceita borda?").</div>'+
  '<div class="hint">O grupo aparece <b>desmarcado</b> em todos os produtos. Ele só vale onde você marcar, no cadastro do produto.</div>'+
  '<div class="fld2" style="margin-top:10px"><label>Onde perguntar</label>'+
   '<div class="canaisG">'+
   [['pdv','Frente de caixa'],['cardapio','Cardápio digital'],['totem','Totem']]
     .map(function(c){
       var lig=!g||!g.canais||!g.canais.length||g.canais.indexOf(c[0])>=0;
       return '<label class="chkL"><input type="checkbox" class="gCanal" value="'+c[0]+'"'+
        (lig?' checked':'')+'><span>'+c[1]+'</span></label>';}).join('')+
   '</div>'+
   '<div class="hint">Desmarque onde a pergunta não faz sentido. O sabor do pote, '+
   'por exemplo: no cardápio o cliente escolhe sozinho; na frente de caixa quem '+
   'atende já ouviu o sabor, e marcar de novo só atrasa a fila.</div></div>'+
  '</div>'+
  '<div class="blk" style="margin:0 0 12px;max-width:none"><h3>Opções deste grupo</h3><div id="gopsBox"></div>'+
  '<button class="btn" onclick="addOp()" style="margin-top:6px">'+sv('plus',13)+' Adicionar opção</button></div>'+
  /* ==========================================================
     FALTAVA O BLOCO DE QUEM ENXERGA (V187)

     Este cadastro esta na lista de liberaveis desde a V109, mas o
     formulario nunca teve o bloco. Sem ele, grupo criado aqui nascia
     sem `sucursais`, e a unidade abria o produto e via
     "Nenhum grupo cadastrado".

     E o `Object.assign(g,obj)` abaixo, que nao carregava `sucursais`,
     APAGAVA a liberacao feita na tela de Liberacao por Unidade toda vez
     que alguem editasse o grupo. Liberar funcionava; editar desfazia.
     ========================================================== */
  blocoUnidades(g,'grpUn')+'</div>';
  modal((g?'Editar grupo de opções':'Criar grupo de opções'),corpo,'Salvar',function(){
    var nome=$('gNome').value.trim();
    if(!nome){toast('Informe o nome do grupo.');return false;}
    lerOps();
    var cn=[],cs=document.querySelectorAll('.gCanal');
    for(var ci=0;ci<cs.length;ci++)if(cs[ci].checked)cn.push(cs[ci].value);
    /* os tres marcados = vale em todos: guarda vazio, que e o padrao */
    if(cn.length===3)cn=[];
    /* nenhum marcado nao pode virar "todos": avisa e nao salva */
    if(!cn.length&&cs.length&&Array.prototype.every.call(cs,function(c){return !c.checked})){
      toast('Escolha ao menos um lugar onde a pergunta aparece.');return false;
    }
    var obj={nome:nome,min:parseInt($('gMin').value)||0,max:parseInt($('gMax').value)||1,
      forcado:$('gForc').checked,canais:cn,
      opcoes:_gops.filter(function(o){return o.nome&&o.nome.trim()})};
    var alvo;
    if(g){Object.assign(g,obj);alvo=g;}      /* `sucursais` fica fora de obj: nao se apaga */
    else{obj.id=uid('grp');obj.sucursais=[];DB.grupos.push(obj);alvo=obj;}
    lerUnidades('grpUn',alvo);
    salvar();
    toast(g?'Grupo atualizado.':'Grupo criado.');
    if(_prod)return renderAbaProd(),true;
    renderProdutos();return true;
  });
  renderOps();
}
function nomeFichaDe(id){
  if(!id)return '';
  var f=(DB.fichas||[]).find(function(x){return x.id===id});
  return f?f.nome:'';
}
function fichaPeloNome(txt){
  var t=String(txt||'').trim().toLowerCase();
  if(!t)return '';
  var f=(DB.fichas||[]).find(function(x){return String(x.nome||'').trim().toLowerCase()===t});
  return f?f.id:'';
}
function renderOps(){
  var b=$('gopsBox');if(!b)return;
  /* a lista de sugestoes fica fora das linhas, uma so para todas */
  if(!document.getElementById('listaFichasOp')){
    var dl=document.createElement('datalist');
    dl.id='listaFichasOp';
    dl.innerHTML=(DB.fichas||[]).slice()
      .sort(function(a,b2){return (a.nome||'').localeCompare(b2.nome||'')})
      .map(function(f){return '<option value="'+E(f.nome)+'">'}).join('');
    document.body.appendChild(dl);
  }
  b.innerHTML=_gops.length?_gops.map(function(o,i){
    /* ==========================================================
       A OPCAO PRECISA DIZER O QUE SAI DO ESTOQUE

       Borda de Nutella, cobertura, Ovomaltine: o cliente escolhe e o
       insumo some do pote, mas nao saia do sistema — a baixa da venda
       so olhava o produto. Com a ficha escolhida aqui, a escolha passa a
       consumir o que ela consome de verdade.
       ========================================================== */
    return '<div class="opRow2">'+
    '<input value="'+E(o.nome)+'" placeholder="nome da opção" class="goN">'+
    '<div class="cur" style="width:118px"><span>R$</span><input type="text" inputmode="decimal" autocomplete="off" placeholder="0,00" class="moeda goP" value="'+((o.preco||0)?money(o.preco):'')+'"></div>'+
    /* ==========================================================
       LISTA DE 139 FICHAS NAO CABE NUM SELECT

       Com um <select>, digitar nao filtra: o navegador pula para a
       primeira ficha que comeca com aquela letra, e cada tecla pula de
       novo. Quem digitava "borda" ia parar em B, O, R, D, A — cinco
       fichas diferentes, sem conseguir apagar nem corrigir.

       Agora e um campo de texto com sugestao: digita parte do nome e a
       lista filtra. O vinculo e resolvido pelo nome na hora de salvar.
       ========================================================== */
    '<input class="goF" list="listaFichasOp" placeholder="digite para achar a ficha" '+
      'value="'+E(nomeFichaDe(o.fichaId))+'">'+
    '<button onclick="remOp('+i+')">'+sv('trash',13)+'</button></div>';}).join('')
    :'<div class="hint">Nenhuma opção. Exemplo: Borda de Nutella, Borda de Chocolate.</div>';
}
function lerOps(){
  var n=document.querySelectorAll('.goN'),p=document.querySelectorAll('.goP'),
      f=document.querySelectorAll('.goF');
  var antes=_gops.slice();
  _gops=[];
  for(var i=0;i<n.length;i++){
    var txt=f[i]?f[i].value:'';
    var fid=fichaPeloNome(txt);
    /* digitou algo que nao e ficha: avisa em vez de descartar em silencio */
    if(txt.trim()&&!fid)toast('Não achei a ficha "'+txt.trim()+'" — a opção ficou sem baixa de estoque.');
    _gops.push({
      id:(antes[i]&&antes[i].id)||undefined,
      nome:n[i].value,preco:moedaValor(p[i]),
      fichaId:fid});
  }
}
function addOp(){lerOps();_gops.push({nome:'',preco:0});renderOps();}
function remOp(i){lerOps();_gops.splice(i,1);renderOps();}
async function excluirGrupo(id){
  var g=DB.grupos.find(function(x){return x.id===id});
  if(!await pergunta('Excluir o grupo "'+g.nome+'"?'))return;
  DB.grupos=DB.grupos.filter(function(x){return x.id!==id}); declararExclusao('grupos',id); /* exclusao declarada: so isto autoriza apagar da nuvem (V201) */
  DB.produtos.forEach(function(p){p.grupos=(p.grupos||[]).filter(function(x){return x!==id})});
  salvar();var m=$('mdOv');if(m)m.remove();abrirGrupos();toast('Grupo excluído.');
}



/* ---------- CÓPIA DE SEGURANÇA ---------- */
function exportarDados(){
  try{
    var pacote={sistema:'JOIA',versao:1,quando:new Date().toISOString(),dados:DB};
    var txt=JSON.stringify(pacote,null,1);
    var blob=new Blob([txt],{type:'application/json'});
    var a=document.createElement('a');
    var d=new Date();
    a.href=URL.createObjectURL(blob);
    a.download='nexor-dados-'+d.getFullYear()+('0'+(d.getMonth()+1)).slice(-2)+('0'+d.getDate()).slice(-2)+'.json';
    document.body.appendChild(a);a.click();
    setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},400);
    toast('Cópia baixada. Guarde este arquivo.');
  }catch(e){toast('Não foi possível gerar a cópia.');}
}
async function importarDados(input){
  var f=input.files&&input.files[0];
  if(!f)return;
  var r=new FileReader();
  r.onload=async function(){
    try{
      var p=JSON.parse(r.result);
      var d=p.dados||p;
      if(!d||(!d.produtos&&!d.categorias))throw new Error('formato');
      if(!await pergunta('Isso substitui os dados atuais deste aparelho pelos do arquivo. Continuar?'))return;
      DB=d;
      DB.categorias=DB.categorias||[];DB.produtos=DB.produtos||[];
      DB.grupos=DB.grupos||[];DB.fichas=DB.fichas||[];
      DB.clientes=DB.clientes||[];DB.pedidos=DB.pedidos||[];DB.caixas=DB.caixas||[];
  baseFormas();
      gravarLocal();
      fecharModal();
      abrir('cardapio','cfg-cardapio');
      toast('Dados restaurados: '+DB.produtos.length+' produtos, '+DB.categorias.length+' categorias.');
    }catch(e){
      toast('Arquivo inválido. Use uma cópia gerada pela própria Joia.');
    }
  };
  r.readAsText(f);
  input.value='';
}



/* ==========================================================
   TEMPO REAL — escuta o banco e atualiza a tela sozinho
   ========================================================== */
var RT={canal:null,ligado:false,pausa:false,ultimoAviso:0,recarga:null};

function ligarTempoReal(){
  if(!NUVEM.ligada||!NUVEM.cli||RT.ligado)return;
  try{
    /* o canal precisa do token do usuário, senão a segurança por loja bloqueia os avisos */
    if(NUVEM.token&&NUVEM.cli.realtime&&NUVEM.cli.realtime.setAuth)
      NUVEM.cli.realtime.setAuth(NUVEM.token);
    RT.canal=NUVEM.cli.channel('nexor-loja-'+NUVEM.loja)
      .on('postgres_changes',{event:'*',schema:'public'},function(msg){
        if(RT.pausa)return;                       /* mudança feita por mim */
        /* O canal escutava as 63 tabelas. O robô do WhatsApp e a Assistente
           escrevem sozinhos o tempo todo — cada gravação deles derrubava e
           redesenhava a tela de quem estava trabalhando. Só interessa o que
           o sistema realmente mostra. */
        if(!tabelaDeTela(msg&&msg.table))return;
        /* ==========================================================
           NAO REAGIR AO PROPRIO BARULHO
           O canal avisa QUALQUER gravacao na empresa — inclusive as minhas.
           Eu enviava, o aviso voltava, eu baixava tudo, o download marcava
           dado, o dado gerava novo envio. A pausa de 4 s nao dava conta:
           o aviso do Supabase chega com atraso variavel, as vezes muito
           depois.
           Agora comparo o carimbo do registro que mudou com o meu proprio
           envio: se fui eu, ignoro.
           ========================================================== */
        try{
          var _q=(msg&&msg.new)||{};
          /* Tabela FILHA — item de ficha, opcao, movimento — nao tem loja_id:
             quem isola e o pai. Sem loja_id a comparacao abaixo nunca batia,
             entao a minha propria gravacao de ingrediente voltava como aviso
             e disparava um download por cima do que eu acabara de digitar. */
          var _semLoja=!_q.loja_id;
          if((_semLoja||(NUVEM.loja&&_q.loja_id===NUVEM.loja))&&
             Date.now()-(_ultimoEnvio||0)<15000)return;
        }catch(e){ _quieto(e,'tempoReal'); }
        agendarRecarga(msg&&msg.table);
      })
      .subscribe(function(st){
        RT.ligado=(st==='SUBSCRIBED');
        pintaTempoReal();
        if(st==='CHANNEL_ERROR'||st==='TIMED_OUT'||st==='CLOSED'){
          clearTimeout(RT._religa);
          RT._religa=setTimeout(function(){
            if(NUVEM.ligada){desligarTempoReal();ligarTempoReal();}
          },5000);
        }
      });
  }catch(e){console.error('tempo real',e);}
}
function desligarTempoReal(){
  try{ if(RT.canal&&NUVEM.cli)NUVEM.cli.removeChannel(RT.canal); }catch(e){_quieto(e,'desligarTempoReal')}
  RT.canal=null;RT.ligado=false;pintaTempoReal();
}
/* As tabelas que alimentam alguma tela. O resto — conversa de WhatsApp,
   sessão do robô, contador de versão, fila da assistente — muda sozinho e
   não tem nada a ver com o que está desenhado. */
var _TABS_TELA=null;
function tabelaDeTela(tab){
  if(!tab)return false;
  if(!_TABS_TELA){
    _TABS_TELA={};
    MAPA.forEach(function(m){
      _TABS_TELA[m.tab]=true;
      (m.filhos||[]).forEach(function(f){_TABS_TELA[f.tab]=true});
    });
    ['config_loja','cardapio_config','pedidos_online'].forEach(function(t){_TABS_TELA[t]=true});
  }
  return !!_TABS_TELA[tab];
}
/* junta várias mudanças seguidas numa só recarga */
function agendarRecarga(tabela){
  clearTimeout(RT.recarga);
  RT.recarga=setTimeout(async function(){
    try{
      /* ==========================================================
         AQUI NASCIA UM LACO
         A regra de nao baixar com coisa pendente esta certa. Errado era
         chamar agendarSync() daqui: o envio ja foi agendado por salvar().
         Quando alguma tabela falhava, a marca de pendente nunca saia, e
         entao: tempo real -> agendarSync -> envio -> o envio mexe na nuvem
         -> tempo real de novo -> agendarSync... sem parar.
         Com o envio custando centenas de milissegundos, isso e exatamente
         a tela congelando ~750 ms uma vez por segundo, sem parar, que
         aparece no diagnostico.
         Agora: se ha coisa pendente, apenas nao baixa. Quem envia e o
         agendamento normal, uma vez, depois de 2,5 s de silencio.
         ========================================================== */
      if(NUVEM.sujo||DB._sujo){ return; }
      /* ==========================================================
         FICHA ABERTA NA TELA NAO E TROCADA POR BAIXO

         ocupado() so impedia o REDESENHO — o download ja tinha acontecido e
         DB.fichas ja tinha sido substituido. Quem estava montando a
         composicao via o ingrediente sumir enquanto digitava.
         Com a janela da composicao aberta, nao se baixa nada. Ao fechar,
         a sincronizacao normal volta a rodar.
         ========================================================== */
      if(typeof _fichaAberta!=='undefined'&&_fichaAberta){
        logNuvem('download adiado: ficha aberta na tela');
        return;
      }
      statusNuvem('baixando');
      var antes=retratoDB();
      await baixarDaNuvem();
      statusNuvem('ok');
      /* Baixar não é motivo para redesenhar. Antes a tela era refeita a cada
         recarga, mesmo quando voltava exatamente o que já estava aqui — era
         a tremida que não parava. */
      try{espelharEstoque()}catch(e){_quieto(e,'agendarRecarga')}   /* o download troca os saldos */
      if(retratoDB()===antes){marcaNovidade(false);return;}
      /* se você está no meio de algo, a tela NÃO é trocada.
         Fica um aviso discreto e a atualização acontece quando você terminar. */
      if(ocupado()){
        RT.pendenteTela=true;
        marcaNovidade(true);
      }else{
        if(S.mod&&S.it)abrir(S.mod,S.it);
        marcaNovidade(false);
      }
    }catch(e){statusNuvem('erro','ao baixar: '+((e&&e.message)||''));}
  },1200);
}
/* está no meio de alguma coisa? então não mexemos na tela */
function ocupado(){
  if(document.getElementById('mdOv'))return true;      /* janela aberta */
  if(document.getElementById('mdOv2'))return true;
  var a=document.activeElement;
  if(a&&/^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName))return true;  /* digitando */
  if(typeof PDV!=='undefined'&&PDV.comanda&&PDV.comanda.length)return true; /* venda em andamento */
  /* A tela se refazia de 2 em 2 segundos e meio sem perguntar nada: fechava
     menu aberto, jogava a rolagem para o topo e desfazia a categoria escolhida
     no PDV. Atualizar sozinho so vale quando a pessoa nao esta no meio de algo. */
  if(document.querySelector('.popMenu'))return true;            /* menu suspenso aberto */
  if(document.getElementById('sucMenu'))return true;            /* seletor de loja aberto */
  var rol=document.querySelector('.etScroll');
  if(rol&&rol.scrollTop>8)return true;                          /* leu ate o meio da tela */
  if((window.scrollY||0)>8)return true;
  return false;
}
/* avisa que tem novidade, sem atrapalhar */
function marcaNovidade(tem){
  var el=document.getElementById('rtTag');
  if(el)el.classList.toggle('novo',!!tem);
}
/* quando você termina, a tela se atualiza sozinha */
function aplicarPendente(){
  if(!RT.pendenteTela||ocupado())return;
  RT.pendenteTela=false;marcaNovidade(false);
  if(S.mod&&S.it)abrir(S.mod,S.it);
}
setInterval(function(){ if(RT.pendenteTela)aplicarPendente(); },2500);
function pintaTempoReal(){
  var el=document.getElementById('rtTag');
  if(!el)return;
  el.className='rtTag'+(RT.ligado?' on':'');
  el.title=RT.ligado?'Tempo real ligado — mudanças em outros aparelhos aparecem aqui'
                    :'Tempo real desligado';
}
/* enquanto eu gravo, não reajo aos meus próprios avisos */
function pausaTempoReal(ms){
  RT.pausa=true;
  clearTimeout(RT._t);
  RT._t=setTimeout(function(){RT.pausa=false},ms||2500);
}

/* ao voltar para a aba, busca o que mudou enquanto estava fora */
document.addEventListener('visibilitychange',function(){
  if(document.visibilityState==='visible'&&NUVEM.ligada){
    if(!RT.ligado)ligarTempoReal();
    agendarRecarga('volta');
  }
});

/* ==========================================================
   CONFERÊNCIA PERIÓDICA
   O aviso instantâneo (tempo real) e um websocket: wifi da loja,
   proxy, roteador ou o navegador em segundo plano derrubam ele sem
   dizer nada, e o aparelho fica olhando para dados velhos por horas.
   Aqui o aparelho confere sozinho a cada 45 segundos. Assim dois
   computadores se encontram em menos de um minuto mesmo quando o
   aviso instantaneo nao chega.
   ========================================================== */
/* retrato barato do que esta na tela, para so redesenhar quando muda mesmo */
var _COLS_NOME=['motivosMov','gruposIng','fichaCats','contas','formasPag','catfin',
                'fornec','unidExtra','lojasFin'];
function retratoDB(){
  var r='';
  try{
    MAPA.forEach(function(m){ r+=m.col+':'+((DB[m.col]||[]).length)+';'; });
    _COLS_NOME.forEach(function(c){
      r+=c+'='+((DB[c]||[]).map(function(x){return (x&&x.nome)||''}).join('|'))+';';
    });
    /* status muda de nome, ordem e liga/desliga — e isso reordena o Kanban */
    r+='sv='+((DB.statusVenda||[]).map(function(x){
      return x.id+x.ordem+(x.ativo!==false?'1':'0')+x.papel;}).join('|'))+';';
  }catch(e){_quieto(e,'retratoDB')}
  return r;
}
var _puxadasPresas=0;
async function conferirNuvemAgora(){
  if(!NUVEM.ligada||NUVEM.sincronizando||RT.pausa)return;
  if(document.hidden)return;
  if(ocupado())return;                       /* no meio de um lançamento: nao mexe */
  if(NUVEM.sujo){
    /* ha coisa daqui esperando subir. Tenta subir; se travar, avisa em vez de
       ficar em silencio achando que esta tudo certo. */
    _puxadasPresas++;
    try{ await sincronizar(); }catch(e){_quieto(e,'conferirNuvemAgora')}
    if(NUVEM.sujo&&_puxadasPresas>=3)avisoEnvioPreso();
    return;
  }
  _puxadasPresas=0;
  var antes=retratoDB();
  try{ await baixarDaNuvem(); }catch(e){ return; }
  if(retratoDB()===antes)return;             /* nada mudou: nao pisca a tela */
  logNuvem('conferência periódica trouxe novidades');
  if(ocupado()){ RT.pendenteTela=true; marcaNovidade(true); }
  else if(S.mod&&S.it){ abrir(S.mod,S.it); marcaNovidade(false); }
}
setInterval(conferirNuvemAgora,45000);

/* ==========================================================
   CONFERÊNCIA RÁPIDA — a cada 6 segundos
   O banco guarda um contador por loja que muda a cada gravação.
   Consultar esse número é uma linha só: custa quase nada e pode
   ser feito de 6 em 6 segundos. O banco inteiro só é baixado
   quando o número muda de verdade.
   ========================================================== */
var _versaoLoja=null,_verOcupado=false;
/* ==========================================================
   AUDITORIA — ENCERRAMENTO POR INATIVIDADE
   Um PDV fica ligado o dia inteiro. Se o operador sai e alguem senta na
   maquina, entra na sessao dele. Depois de 8 horas sem NENHUMA acao
   (clique, tecla, toque), a sessao e encerrada e a tela volta para o login.
   Oito horas porque o turno de uma loja e mais curto que isso: quem esta
   trabalhando nunca e interrompido; quem esqueceu aberto de um dia para o
   outro, sim.
   O tempo e guardado no aparelho, nao no token — reabrir o navegador no dia
   seguinte tambem cai na regra.
   ========================================================== */
var INATIVIDADE_H=8;
function marcarAtividade(){
  try{ localStorage.setItem('nexor_visto', String(Date.now())); }
  catch(e){_quieto(e,'marcarAtividade')}
}
function inativoDemais(){
  try{
    var t=parseInt(localStorage.getItem('nexor_visto')||'0',10);
    if(!t)return false;
    return (Date.now()-t) > INATIVIDADE_H*3600*1000;
  }catch(e){ return false; }
}
(function vigiarInatividade(){
  ['click','keydown','touchstart','pointerdown'].forEach(function(ev){
    document.addEventListener(ev, marcarAtividade, {passive:true, capture:true});
  });
  marcarAtividade();
  setInterval(function(){
    if(!NUVEM.ligada)return;
    if(inativoDemais()){
      registrarFalha('sessao','inatividade',
        'sessão encerrada após '+INATIVIDADE_H+' h sem uso',{situacao:'encerrada'});
      try{ if(NUVEM.cli)NUVEM.cli.auth.signOut(); }catch(e){_quieto(e,'vigiarInatividade')}
      try{ localStorage.removeItem('nexor_visto'); }catch(e){_quieto(e,'inativoDemais')}
      location.reload();
    }
  }, 60000);
})();

/* ==========================================================
   AUDITORIA — ENCERRAR TODAS AS SESSOES
   Aparelho perdido, funcionario desligado, suspeita de senha vazada: um
   comando so tira a conta de todos os lugares, inclusive celulares que a
   pessoa levou embora.
   ========================================================== */
async function encerrarTodasAsSessoes(){
  if(!await pergunta('Encerrar sua conta em TODOS os aparelhos?\n\n'+
     'Você e qualquer outro dispositivo com esta conta aberta voltarão para a '+
     'tela de login. Use isto se perdeu um aparelho ou desconfia da senha.'))return;
  try{
    if(NUVEM.cli&&NUVEM.cli.auth&&NUVEM.cli.auth.signOut)
      await NUVEM.cli.auth.signOut({scope:'global'});
    try{ localStorage.removeItem('nexor_visto'); }catch(e){_quieto(e,'encerrarTodasAsSessoes')}
    toast('Todas as sessões foram encerradas.');
    setTimeout(function(){location.reload()},900);
  }catch(e){
    painelErro('Não consegui encerrar as sessões.',detalheErro(e));
  }
}
async function conferirVersaoLoja(){
  if(!NUVEM.ligada||_verOcupado||NUVEM.sincronizando||RT.pausa)return;
  /* envio pendente significa que o contador vai mudar por minha causa —
     baixar agora e baixar o que eu mesmo acabei de mandar */
  if(NUVEM.sujo||DB._sujo||_baixando)return;
  /* O dono da plataforma nao tem loja. Sem esta linha, o relogio de 6 em 6
     segundos pedia 'loja_id=eq.null' e o banco recusava — enchendo o Console
     de erro vermelho e escondendo o defeito de verdade que se procurava. */
  if(NUVEM.plataforma||!NUVEM.loja)return;
  if(document.hidden)return;
  _verOcupado=true;
  try{
    var r=await api('loja_versao?loja_id=eq.'+NUVEM.loja+'&select=versao');
    var v=(r&&r[0])?Number(r[0].versao):null;
    if(v===null){_verOcupado=false;return;}
    if(_versaoLoja===null){_versaoLoja=v;_verOcupado=false;return;}
    if(v===_versaoLoja){_verOcupado=false;return;}
    _versaoLoja=v;
    if(NUVEM.sujo||ocupado()){         /* guarda para quando der */
      RT.pendenteTela=true;marcaNovidade(true);_verOcupado=false;return;
    }
    var antes=retratoDB();
    await baixarDaNuvem();
    if(retratoDB()!==antes){
      logNuvem('novidade de outro aparelho — tela atualizada');
      if(ocupado()){RT.pendenteTela=true;marcaNovidade(true);}
      else if(S.mod&&S.it){abrir(S.mod,S.it);marcaNovidade(false);}
    }
  }catch(e){_quieto(e,'conferirVersaoLoja')}
  _verOcupado=false;
}
setInterval(conferirVersaoLoja,6000);
/* depois de eu mesmo enviar, acompanho o contador para não baixar à toa */
/* ==========================================================
   O LACO QUE CONGELAVA A TELA
   Medido no aparelho: congelamentos de 750 ms, um por segundo, sem parar —
   e no meio deles requisicoes de /insumos (1.234 ms) e /estoque_unidade
   (888 ms). Nao era a tela de estoque: era o sistema baixando a base
   inteira em laco.
   O ciclo:
     1. o sistema envia algo        -> o banco incrementa o contador da loja
     2. o relogio de 6 s ve o contador diferente do que tinha guardado
     3. conclui "outro aparelho mexeu" e BAIXA TUDO (insumos, estoque...)
     4. o download grava no aparelho, o que marca dado sujo
     5. dado sujo agenda um envio -> volta ao passo 1
   marcarVersaoAtual existia para evitar isso, mas era ASSINCRONA: pedia o
   contador e seguia. O relogio disparava antes da resposta chegar, ainda com
   o numero velho na memoria, e o ciclo comecava.
   Agora: o proprio envio ja sabe qual contador gerou; a marca e feita na
   hora, sem ida a rede. E o relogio nao baixa nada enquanto houver envio
   pendente ou download em andamento.
   ========================================================== */
async function marcarVersaoAtual(){
  if(NUVEM.plataforma||!NUVEM.loja)return;
  try{
    var r=await api('loja_versao?loja_id=eq.'+NUVEM.loja+'&select=versao');
    if(r&&r[0])_versaoLoja=Number(r[0].versao);
  }catch(e){ _quieto(e,'marcarVersaoAtual'); }
}
/* diz exatamente qual tabela o banco recusou e por quê */
/* ==========================================================
   O OPERADOR NAO PRECISA SABER QUE EXISTEM TABELAS
   Esta funcao abria uma faixa larga no rodape dizendo "1 tabela(s) nao
   subiram agora — mesmo motivo em todas: sem permissao para cancelamentos".
   Quem esta atendendo um cliente nao sabe o que e tabela, nem sincronizacao,
   nem permissao de escrita — e nao pode fazer nada a respeito.
   Agora:
     - falta de permissao e dado invalido nem chegam aqui (saem da fila antes)
     - falha temporaria vira o indicador discreto do rodape
     - sessao vencida, que EXIGE acao do operador, continua avisando
   O detalhe tecnico completo vai para Administracao > Diagnostico do Sistema.
   ========================================================== */
function avisoTabelaComErro(erros){
  try{
    var el=document.getElementById('avisoTab');
    if(el)el.remove();
    if(!erros||!erros.length)return;

    erros.forEach(function(x){
      registrarFalha('sincronizacao',x.tab,x.msg||'falha ao enviar',
        {situacao:'na fila, será tentado de novo'});
      logNuvem('não subiu — '+x.tab+': '+x.msg,true);
    });

    /* Sessao vencida e a UNICA que o operador precisa ver: so ele pode
       resolver, entrando de novo. Sem isso, ele lancaria a tarde inteira
       sem nada subir. */
    var todasSessao=erros.length>2&&erros.every(function(x){
      return /row-level security|JWT|sess/i.test(x.msg||'');});
    if(todasSessao){
      el=document.createElement('div');
      el.id='avisoTab';el.className='avisoGrav sinc';
      el.innerHTML='<div><b>Sua sessão expirou</b>'+
        '<span>Nada foi perdido — o que você lançou está guardado neste aparelho '+
        'e sobe assim que você entrar de novo.</span></div>'+
        '<button class="btnP2 ok" onclick="sair()">Entrar de novo</button>';
      barraAvisos().appendChild(el);
      return;
    }
    /* o resto e falha temporaria: o rodape ja mostra o estado, e a fila
       reenviara sozinha. Nada na tela. */
    estadoNuvem(NUVEM.ligada?'online':'offline');
  }catch(e){_quieto(e,'avisoTabelaComErro')}
}
function avisoEnvioPreso(){
  try{
    if(document.getElementById('avisoEnvio'))return;
    var el=document.createElement('div');
    el.id='avisoEnvio';el.className='avisoGrav sinc';
    el.innerHTML='<div><b>Este aparelho está com envio travado</b>'+
      '<span>Há coisa lançada aqui que não está subindo para a nuvem, e por isso ele '+
      'também não recebe o que os outros lançam. Abra o Diagnóstico para ver onde parou.</span></div>'+
      '<button onclick="painelNuvem()">Abrir diagnóstico</button>'+
      '<button class="x" onclick="this.parentNode.remove()">&times;</button>';
    barraAvisos().appendChild(el);
  }catch(e){_quieto(e,'avisoEnvioPreso')}
}

/* ---------- DIAGNÓSTICO DA CONEXÃO ---------- */
async function testarConexao(){
  var box=$('diagBox');if(!box)return;
  var passos=[];
  function pinta(){
    box.innerHTML='<div class="diagLista">'+passos.map(function(p){
      return '<div class="diagIt '+p.st+'">'+
      '<span class="diagIc">'+(p.st==='ok'?sv('check',12):p.st==='err'?sv('x2',12):sv('ref',12))+'</span>'+
      '<div><b>'+E(p.t)+'</b>'+(p.d?'<small>'+E(p.d)+'</small>':'')+'</div></div>';
    }).join('')+'</div>';
  }
  function passo(t){passos.push({t:t,st:'ir',d:''});pinta();return passos[passos.length-1];}
  function ok(p,d){p.st='ok';p.d=d||'';pinta();}
  function err(p,d){p.st='err';p.d=d||'';pinta();}

  var p1=passo('Acesso à internet');
  try{
    var r0=await fetch(NUVEM.url+'/rest/v1/',{headers:{'apikey':NUVEM.chave}});
    ok(p1,'servidor respondeu ('+r0.status+')');
  }catch(e){
    err(p1,'bloqueado — '+((e&&e.message)||'sem resposta'));
    var p0=passo('Diagnóstico');
    err(p0,'Provável bloqueio por o sistema estar rodando como arquivo baixado (file://). '+
      'Publicando na internet, isso se resolve.');
    return;
  }
  var p2=passo('Leitura de uma tabela');
  try{
    var r1=await fetch(NUVEM.url+'/rest/v1/lojas?select=id,nome&limit=1',
      {headers:{'apikey':NUVEM.chave}});
    var t1=await r1.text();
    if(r1.ok)ok(p2,'tabela acessível (resposta com '+t1.length+' caracteres)');
    else err(p2,'HTTP '+r1.status+' — '+t1.slice(0,120));
  }catch(e){err(p2,(e&&e.message)||'falhou');}

  var p3=passo('Estrutura do banco');
  try{
    var r2=await fetch(NUVEM.url+'/rest/v1/lancamentos_financeiros?select=id&limit=1',
      {headers:{'apikey':NUVEM.chave}});
    if(r2.status===200||r2.status===401||r2.status===403)ok(p3,'tabelas dos módulos existem');
    else err(p3,'HTTP '+r2.status);
  }catch(e){err(p3,(e&&e.message)||'falhou');}

  var p4=passo('Login');
  if(NUVEM.ligada)ok(p4,'conectado como '+(NUVEM.perfil?NUVEM.perfil.nome:'usuário'));
  else{p4.st='ir';p4.d='ainda não conectado — use "Ligar a nuvem" abaixo';pinta();}
}

/* ---------- PAINEL DO BANCO DE DADOS ---------- */
function painelNuvem(){
  var ligada=NUVEM.ligada;
  var corpo='<div class="mdB">'+
  '<div class="blk" style="margin:0 0 12px;max-width:none">'+
  '<h3>Teste de conexão</h3>'+
  '<div class="hint" style="margin-bottom:10px">Verifica se este aparelho consegue falar com o banco antes de ligar a nuvem.</div>'+
  '<button class="btnP2 ok" onclick="testarConexao()">'+sv('ref',14)+' Testar conexão com o banco</button>'+
  '<div id="diagBox" style="margin-top:12px"></div>'+
  '</div>'+
  '<div class="blk" style="margin:0 0 12px;max-width:none">'+
  '<h3>O que será sincronizado</h3>'+
  '<div class="hint" style="margin-bottom:10px">Cada item abaixo tem tabela própria no banco. '+
  'Ao ligar a nuvem, tudo é enviado e passa a ser gravado nos dois lugares.</div>'+
  '<div class="syncGrid">'+MAPA.map(function(m){
    var q=(DB[m.col]||[]).length;
    return '<div class="syncIt'+(q?' tem':'')+'"><span>'+E(m.tab.replace(/_/g,' '))+'</span><b>'+q+'</b></div>';
  }).join('')+'</div>'+
  (NUVEM.ultima?'<div class="hint" style="margin-top:10px">Última sincronização: '+
    NUVEM.ultima.toLocaleString('pt-BR')+'</div>':'')+
  '</div>'+
  '<div class="blk" style="margin:0 0 12px;max-width:none">'+
  '<h3>Cópia de segurança</h3>'+
  '<div class="hint" style="margin-bottom:12px">Enquanto o sistema for um arquivo baixado, cada nova versão começa vazia. '+
  'Baixe uma cópia dos seus dados aqui e restaure na versão nova — assim você não perde o que cadastrou.</div>'+
  '<div style="display:flex;gap:8px;flex-wrap:wrap">'+
  '<button class="btnP2" onclick="exportarDados()">'+sv('down2',14)+' Baixar cópia dos dados</button>'+
  '<button class="btnP2" onclick="document.getElementById(\'impFile\').click()">'+sv('up2',14)+' Restaurar de um arquivo</button>'+
  '<input type="file" id="impFile" accept=".json,application/json" style="display:none" onchange="importarDados(this)">'+
  '</div>'+
  '<div class="hint" style="margin-top:10px">Resumo atual: '+
  (DB.categorias||[]).length+' categorias · '+(DB.produtos||[]).length+' produtos · '+
  (DB.grupos||[]).length+' grupos · '+((DB.clientes||[]).length)+' clientes · '+((DB.pedidos||[]).length)+' pedidos</div>'+
  '</div>'+
  '<div class="blk" style="margin:0 0 12px;max-width:none">'+
  '<h3>Onde os dados estão sendo guardados</h3>'+
  '<div style="display:flex;gap:12px;align-items:flex-start;padding:12px;border:1px solid var(--line-2);border-radius:9px;background:'+(ligada?'var(--acc-soft)':'var(--alt)')+'">'+
  '<div style="width:34px;height:34px;border-radius:9px;flex:none;display:flex;align-items:center;justify-content:center;background:#fff;border:1px solid var(--line);color:'+(ligada?'var(--acc-d)':'var(--ink-3)')+'">'+sv('cloud',18)+'</div>'+
  '<div><b style="font-size:13.5px;display:block">'+(ligada?'Nuvem ligada':'Somente neste aparelho')+'</b>'+
  '<span style="font-size:12.5px;color:var(--ink-2)">'+
  (ligada?'Tudo que você cadastra é gravado aqui e replicado no banco na nuvem. Outras lojas e aparelhos enxergam os mesmos dados.'
        :'Os dados ficam apenas neste computador. Serve para desenvolvermos e testarmos sem depender de internet.')+
  '</span></div></div></div>'+

  (ligada?
   '<div class="blk" style="margin:0;max-width:none"><h3>Conexão ativa</h3>'+
   '<div class="fld2"><label>Usuário</label><input value="'+E(NUVEM.perfil?NUVEM.perfil.nome:'')+'" disabled style="background:var(--alt)"></div>'+
   '<div style="display:flex;gap:8px;flex-wrap:wrap">'+
   '<button class="btn" onclick="sincronizar();toast(\'Enviando...\')">'+sv('ref',14)+' Sincronizar agora</button>'+
   '<button class="btn" onclick="puxarNuvem()">'+sv('cloud',14)+' Baixar dados da nuvem</button>'+
   '<button class="btn" onclick="verDiagnostico()">'+sv('list',14)+' Diagnóstico da sincronização</button>'+
   '<div class="verBox">Versão instalada neste aparelho: <b>'+VERSAO+'</b></div>'+
   '<button class="btn" onclick="desconectarNuvem();fecharModal();rodape();toast(\'Nuvem desligada.\')">Desligar nuvem</button>'+
   '</div></div>'
   :
   '<div class="blk" style="margin:0;max-width:none"><h3>Ligar o banco de dados na nuvem</h3>'+
   '<div class="hint" style="margin-bottom:12px">O banco já está criado e pronto. Ao ligar, o que você já cadastrou aqui é enviado para lá.</div>'+
   '<div class="row2">'+
   '<div class="fld2"><label>E-mail</label><input id="nvE" type="email" placeholder="seu@email.com"></div>'+
   '<div class="fld2"><label>Senha</label><input id="nvS" type="password" placeholder="senha"></div>'+
   '</div><div id="nvErr" style="color:var(--red);font-size:12.5px;min-height:18px"></div>'+
   '<button class="btn p" onclick="ligarNuvem()">'+sv('cloud',14)+' Ligar e enviar meus dados</button>'+
   '</div>')+
  '</div>';
  modal('Banco de dados',corpo,'Fechar',function(){return true},'lg');
}
/* a nuvem já tem cadastro desta loja? */
async function nuvemTemDados(){
  try{
    var l=NUVEM.loja;
    var alvos=['categorias','produtos','categorias_financeiras','insumos','fichas_tecnicas','clientes'];
    for(var i=0;i<alvos.length;i++){
      var r=await api(alvos[i]+'?loja_id=eq.'+l+'&select=id&limit=1');
      if(r&&r.length)return true;
    }
    return false;
  }catch(e){return false}
}
async function ligarNuvem(){
  var e=$('nvE').value.trim(),s2=$('nvS').value;
  $('nvErr').textContent='';
  try{
    await conectarNuvem(e,s2);
    fecharModal();rodape();
    /* se a nuvem já tem dados, este aparelho RECEBE em vez de enviar
       (evita duplicar os cadastros padrão de um aparelho novo) */
    var nuvemTem=await nuvemTemDados();
    if(nuvemTem){
      toast('Nuvem ligada. Trazendo os dados...');
      statusNuvem('baixando');
      await baixarDaNuvem();
      statusNuvem('ok');
      if(S.mod&&S.it)abrir(S.mod,S.it);
      toast('Este aparelho recebeu os dados da nuvem.');
    }else{
      toast('Nuvem ligada. Enviando seus dados...');
      await sincronizar();
      toast('Dados enviados para a nuvem.');
    }
  }catch(err){
    var m=(err&&err.message)||'Falha ao conectar.';
    if(m.indexOf('Invalid login credentials')>=0)m='E-mail ou senha incorretos.';
    if(/Failed to fetch|NetworkError/i.test(m))m='Sem conexão com o servidor. Verifique a internet.';
    $('nvErr').textContent=m;
  }
}
function verDiagnostico(){
  var l=NUVEM.log||[];
  var h='<div class="mdB"><div class="blk" style="margin:0;max-width:none">'+
   '<div class="linha"><span>Situação</span><b>'+(NUVEM.sujo?'há mudanças esperando envio':'tudo enviado')+'</b></div>'+
   '<div class="linha"><span>Última sincronização</span><b>'+
     (NUVEM.ultima?NUVEM.ultima.toLocaleString('pt-BR'):'nunca')+'</b></div>'+
   '<div class="linha"><span>Loja</span><b>'+E(NUVEM.loja||'—')+'</b></div>'+
   '</div>'+
   '<div class="blk" style="margin:11px 0 0;max-width:none;padding:0;overflow:hidden">'+
   '<div class="acTit">O que aconteceu</div>'+
   '<div class="acTabW" style="max-height:320px"><table class="acTab"><tbody>'+
   (l.length?l.map(function(x){
     return '<tr><td style="width:82px;color:var(--ink-3)">'+x.h+'</td>'+
     '<td'+(x.e?' style="color:var(--red);font-weight:600"':'')+'>'+E(x.t)+'</td></tr>';
   }).join(''):'<tr><td>Nada registrado ainda. Faça um cadastro e volte aqui.</td></tr>')+
   '</tbody></table></div></div></div>';
  var o=document.createElement('div');o.className='mdOv';o.id='mdOv';
  o.innerHTML='<div class="mdBox lg"><div class="mdH"><b>Diagnóstico da sincronização</b>'+
   '<button onclick="fecharModal()">&times;</button></div>'+h+
   '<div class="mdF"><button class="btnP2" onclick="fecharModal()">Fechar</button>'+
   '<button class="btnP2 ok" onclick="copiarDiagnostico()">Copiar</button></div></div>';
  document.body.appendChild(o);
  fecharSoForaDeVerdade(o);
}
function copiarDiagnostico(){
  var t=(NUVEM.log||[]).map(function(x){return x.h+'  '+(x.e?'[ERRO] ':'')+x.t}).join('\n');
  /* as falhas que nao quebram nada tambem entram: sao as mais dificeis de
     achar justamente porque ninguem percebe que aconteceram */
  if(FALHAS.length){
    t+='\n\n--- falhas silenciosas ('+FALHAS.length+') ---\n'+
      FALHAS.slice(0,40).map(function(f){
        return f.h+'  '+f.onde+': '+f.msg;
      }).join('\n');
  }
  t='JOIA — diagnóstico\nVersão: '+VERSAO+'\nLoja: '+(NUVEM.loja||'-')+
    '\nCargo: '+((NUVEM.perfil||{}).cargo||'-')+
    '\nConexão: '+CONEXAO+'\nPendente: '+(NUVEM.sujo?'sim':'nao')+'\n\n'+_relatorioLentidao()+'\n'+t;
  try{navigator.clipboard.writeText(t);toast('Diagnóstico copiado. Cole no chat.');}
  catch(e){prompt('Copie o texto abaixo:',t);}
}
async function puxarNuvem(){
  if(!await pergunta('Isso substitui o que está neste aparelho pelos dados da nuvem. Continuar?'))return;
  try{await baixarDaNuvem(true);fecharModal();telaCardapio();toast('Dados baixados da nuvem.');}
  catch(e){toast('Erro ao baixar: '+((e&&e.message)||''));}
}

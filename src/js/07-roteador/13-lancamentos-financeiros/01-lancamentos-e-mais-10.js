/* ==========================================================
   BLOCO 13 — LANÇAMENTOS FINANCEIROS
   ========================================================== */
var LF={base:'vencimento',de:'',ate:'',tipo:'todas',sit:'todas',
        conta:'',metodo:'',categoria:'',subcat:'',subcatNome:'',desc:'',forn:'',rotulo:'Esta semana'};

function baseLanc(){
  baseCat();baseFormas();
  DB.lancFin=DB.lancFin||[];
  /* a lista de fornecedores do sistema e DB.fornec (sobe para a tabela
     fornecedores). DB.fornecedores era um segundo balde, criado aqui e na
     importacao de nota: quem nascia nele nao aparecia na tela de cadastro
     nem subia para a nuvem. */
  DB.fornec=DB.fornec||[];
  migrarLanc();
}
/* traz para o novo formato o que já existia */
function migrarLanc(){
  if(DB.contasPagar&&DB.contasPagar.length){
    DB.contasPagar.forEach(function(c){
      (c.parcelas||[]).forEach(function(pc,i){
        DB.lancFin.push({id:uid('lf'),tipo:'despesa',contaId:pc.contaId||'',metodoId:pc.formaId||'',
          descricao:(c.fornecedor||'Lançamento')+((c.parcelas.length>1)?' ('+(i+1)+'/'+c.parcelas.length+')':''),
          fornecedor:c.fornecedor||'',documento:c.documento||'',categoriaId:c.categoriaId||'',
          valor:Number(pc.valor)||0,emissao:c.dataRef||hojeISO(),vencimento:pc.vencimento||hojeISO(),
          pagamento:pc.pago?(pc.dataMov||hojeISO()):'',pago:!!pc.pago,obs:c.obs||''});
      });
    });
    DB.contasPagar=[];
    salvar();
  }
  if(DB.lancamentos&&DB.lancamentos.length){
    DB.lancamentos.forEach(function(l){
      if(l.migrado)return;
      DB.lancFin.push({id:uid('lf'),tipo:l.tipo==='entrada'?'receita':'despesa',contaId:l.contaId||'',
        metodoId:'',descricao:l.descricao,fornecedor:'',documento:'',categoriaId:'',categoriaTxt:l.categoria,
        valor:Number(l.valor)||0,emissao:(l.data||hojeISO()).slice(0,10),vencimento:(l.data||hojeISO()).slice(0,10),
        pagamento:(l.data||hojeISO()).slice(0,10),pago:true,origem:l.origem||''});
      l.migrado=true;
    });
  }
}
function catTexto(l){
  if(l.categoriaTxt)return l.categoriaTxt;
  return l.categoriaId?nomeCategoria(l.categoriaId):'—';
}
function nomeCategoria(subId){
  var achou='—';
  (DB.catfin||[]).forEach(function(p){
    (p.itens||[]).forEach(function(it){if(it.id===subId)achou=p.nome+' › '+it.nome});
  });
  return achou;
}
function metodoNome(id){var f=formaPag(id);return f?f.nome:'—'}
function contaNome(id){var c=(DB.contas||[]).find(function(x){return x.id===id});return c?c.nome:'—'}
function iconeConta(id){
  var c=(DB.contas||[]).find(function(x){return x.id===id});
  if(!id)return '<span class="ctMini" style="background:#C7D0DA" title="banco definido no pagamento">–</span>';
  if(!c)return '<span class="ctMini" style="background:#B7C4D2">?</span>';
  var b=c.fixa?null:banco(c.banco);
  var cor=c.fixa==='caixa'?'#0E8A46':c.fixa==='cofre'?'#5C6B80':(b?b.c:'#5C6B80');
  var sig=c.fixa==='caixa'?'CX':c.fixa==='cofre'?'CO':(b?b.s:'$');
  return '<span class="ctMini" style="background:'+cor+'">'+sig+'</span>';
}
function dataDoFiltro(l){
  if(LF.base==='movimentacao')return l.pagamento||l.vencimento||'';
  if(LF.base==='referencia')return l.emissao||'';
  return l.vencimento||'';
}
function filtrarLanc(){
  return (DB.lancFin||[]).filter(function(l){
    if(LF.tipo==='pagar'&&l.tipo!=='despesa')return false;
    if(LF.tipo==='receber'&&l.tipo!=='receita')return false;
    if(LF.sit==='pagas'&&!l.pago)return false;
    if(LF.sit==='naopagas'&&l.pago)return false;
    if(LF.conta&&l.contaId!==LF.conta&&l.contaDestinoId!==LF.conta)return false;
    if(LF.metodo&&l.metodoId!==LF.metodo)return false;
    if(LF.categoria&&pastaDaSub(l.categoriaId)!==LF.categoria)return false;
    if(LF.subcat&&l.categoriaId!==LF.subcat)return false;
    if(LF.desc&&(l.descricao||'').toLowerCase().indexOf(LF.desc.toLowerCase())<0)return false;
    if(LF.forn){
      var q=LF.forn.toLowerCase();
      if(((l.fornecedor||'')+' '+(l.documento||'')).toLowerCase().indexOf(q)<0)return false;
    }
    var d=dataDoFiltro(l);
    if(LF.de&&d&&d<LF.de)return false;
    if(LF.ate&&d&&d>LF.ate)return false;
    return true;
  }).sort(function(a,b){return (dataDoFiltro(b)||'').localeCompare(dataDoFiltro(a)||'')});
}
function pastaDaSub(subId){
  var achou='';
  (DB.catfin||[]).forEach(function(p){
    (p.itens||[]).forEach(function(it){if(it.id===subId)achou=p.nome});
  });
  return achou;
}

/* ---------- PERÍODOS ---------- */
function periodo(qual){
  var d=new Date(),a,b;
  if(qual==='hoje'){a=b=d;LF.rotulo='Hoje';}
  else if(qual==='semana'){a=new Date(d);a.setDate(d.getDate()-d.getDay());b=new Date(a);b.setDate(a.getDate()+6);LF.rotulo='Esta semana';}
  else if(qual==='mes'){a=new Date(d.getFullYear(),d.getMonth(),1);b=new Date(d.getFullYear(),d.getMonth()+1,0);LF.rotulo='Este mês';}
  LF.de=a.toISOString().slice(0,10);LF.ate=b.toISOString().slice(0,10);
  telaLancamentos();
}
function moverPeriodo(dir){
  var a=new Date(LF.de+'T12:00:00'),b=new Date(LF.ate+'T12:00:00');
  var dias=Math.round((b-a)/86400000)+1;
  a.setDate(a.getDate()+dir*dias);b.setDate(b.getDate()+dir*dias);
  LF.de=a.toISOString().slice(0,10);LF.ate=b.toISOString().slice(0,10);
  LF.rotulo='Personalizado';
  telaLancamentos();
}
function rotuloPeriodo(){
  var m=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  var a=new Date(LF.de+'T12:00:00'),b=new Date(LF.ate+'T12:00:00');
  if(LF.de===LF.ate)return a.getDate()+' de '+m[a.getMonth()];
  return a.getDate()+' de '+m[a.getMonth()]+' a '+b.getDate()+' de '+m[b.getMonth()];
}

/* ---------- TELA ---------- */
function telaLancamentos(){
  baseLanc();
  if(!LF.de){var d=new Date();var a=new Date(d);a.setDate(d.getDate()-d.getDay());
    var b=new Date(a);b.setDate(a.getDate()+6);
    LF.de=a.toISOString().slice(0,10);LF.ate=b.toISOString().slice(0,10);}
  var lista=filtrarLanc();
  var desp=lista.filter(function(l){return l.tipo==='despesa'});
  var rec=lista.filter(function(l){return l.tipo==='receita'});
  var totD=desp.reduce(function(a,l){return a+l.valor},0);
  var totR=rec.reduce(function(a,l){return a+l.valor},0);
  var aPagar=desp.filter(function(l){return !l.pago}).reduce(function(a,l){return a+l.valor},0);

  $('content').innerHTML='<div class="lfWrap">'+
   '<div class="lfScroll" id="lfScroll">'+
   '<div class="lfTopo">'+
    '<button class="btnMais" data-pop="1" onclick="menuNovo(event)">'+sv('plus',22)+'</button>'+
    '<h1>Lançamentos Financeiros</h1>'+
    '<div class="lfPeriodo">'+
     '<select id="lfBase" class="lfBaseSel" onchange="LF.base=this.value;telaLancamentos()">'+
      '<option value="vencimento"'+(LF.base==='vencimento'?' selected':'')+'>DATA DE VENCIMENTO</option>'+
      '<option value="movimentacao"'+(LF.base==='movimentacao'?' selected':'')+'>DATA DE MOVIMENTAÇÃO</option>'+
      '<option value="referencia"'+(LF.base==='referencia'?' selected':'')+'>DATA DE REFERÊNCIA</option>'+
     '</select>'+
     '<div class="lfNav">'+
      '<button onclick="moverPeriodo(-1)">'+sv('cr2',16)+'</button>'+
      '<span>'+rotuloPeriodo()+'</span>'+
      '<button onclick="moverPeriodo(1)">'+sv('cr',16)+'</button>'+
     '</div>'+
     '<div class="lfAtalhos">'+
      '<button class="'+(LF.rotulo==='Hoje'?'on':'')+'" onclick="periodo(\'hoje\')">HOJE</button>'+
      '<button class="'+(LF.rotulo==='Esta semana'?'on':'')+'" onclick="periodo(\'semana\')">ESTA SEMANA</button>'+
      '<button class="'+(LF.rotulo==='Este mês'?'on':'')+'" onclick="periodo(\'mes\')">ESTE MÊS</button>'+
      '<button class="'+(LF.rotulo==='Personalizado'?'on':'')+'" onclick="periodoCustom()">PERSONALIZADO</button>'+
     '</div>'+
    '</div>'+
    '<div class="lfTopBtns">'+
     '<button class="btnP2" onclick="telaLancamentos()">'+sv('ref',14)+' Atualizar</button>'+
     '<button class="btnP2" onclick="imprimirLanc()">'+sv('print2',14)+' Imprimir</button>'+
     '<button class="btnP2" onclick="exportarLanc()">'+sv('down2',14)+' Exportar</button>'+
     '<button class="btnP2" onclick="abrir(\'financeira\',\'formas-pagamento\')">'+sv('cash',14)+' Métodos</button>'+
    '</div>'+
    '<div class="selInfo" id="selInfo"><span>0 selecionados</span><b>R$ 0,00</b></div>'+
   '</div>'+

   '<div class="lfFiltros">'+
    '<div class="fGrupo"><label>Tipo</label><div class="chips">'+
     '<button class="'+(LF.tipo==='pagar'?'on':'')+'" onclick="setLF(\'tipo\',\'pagar\')">Contas a pagar</button>'+
     '<button class="'+(LF.tipo==='receber'?'on':'')+'" onclick="setLF(\'tipo\',\'receber\')">Contas a receber</button>'+
     '<button class="'+(LF.tipo==='todas'?'on':'')+'" onclick="setLF(\'tipo\',\'todas\')">Todas</button>'+
    '</div></div>'+
    '<div class="fGrupo"><label>Situação</label><div class="chips">'+
     '<button class="'+(LF.sit==='pagas'?'on':'')+'" onclick="setLF(\'sit\',\'pagas\')">Pagas</button>'+
     '<button class="'+(LF.sit==='naopagas'?'on':'')+'" onclick="setLF(\'sit\',\'naopagas\')">Não pagas</button>'+
     '<button class="'+(LF.sit==='todas'?'on':'')+'" onclick="setLF(\'sit\',\'todas\')">Todas</button>'+
    '</div></div>'+
   '</div>'+

   '<div class="lfFiltros2">'+
    '<div class="f2"><label>Conta</label><select onchange="LF.conta=this.value;telaLancamentos()">'+
     '<option value="">Todas as contas</option>'+
     (DB.contas||[]).map(function(c){return '<option value="'+c.id+'"'+(LF.conta===c.id?' selected':'')+'>'+E(c.nome)+'</option>'}).join('')+
    '</select></div>'+
    '<div class="f2"><label>Método de pagamento</label><select onchange="LF.metodo=this.value;telaLancamentos()">'+
     '<option value="">Todos</option>'+
     (DB.formasPag||[]).map(function(f){return '<option value="'+f.id+'"'+(LF.metodo===f.id?' selected':'')+'>'+E(f.nome)+'</option>'}).join('')+
    '</select></div>'+
    '<div class="f2"><label>Categoria</label>'+
     '<button class="selArv" data-pop="1" onclick="menuCatFiltro(event)">'+
     '<span>'+E(LF.categoria||LF.subcatNome||'Todas')+'</span>'+sv('dn',13)+'</button></div>'+
    '<div class="f2"><label>Descrição</label><input id="lfD" value="'+E(LF.desc)+'" placeholder="buscar..."></div>'+
    '<div class="f2"><label>Fornecedor ou documento</label><input id="lfF" value="'+E(LF.forn)+'" placeholder="buscar..."></div>'+
    '<button class="btnLimpar" onclick="limparLF()">Limpar</button>'+
   '</div>'+

   '<div class="lfTabW plano">'+
   (lista.length?'<table class="lfTab2"><thead><tr>'+
    '<th style="width:34px"><input type="checkbox" class="chk" onclick="selTodasLF(this)"></th>'+
    '<th style="width:106px">Vencimento</th><th style="width:100px">Emissão</th><th style="width:104px">Pagamento</th>'+
    '<th>Conta / Descrição</th><th style="width:150px">Método</th><th style="width:180px">Categoria</th>'+
    '<th style="width:118px;text-align:right">Valor do boleto</th>'+
    '<th style="width:126px;text-align:right">Valor pago</th>'+
    '<th style="width:110px;text-align:center">Ações</th></tr></thead><tbody>'+
    lista.map(function(l){
      var neg=l.tipo==='despesa';
      var atras=neg&&!l.pago&&l.vencimento&&l.vencimento<hojeISO();
      return '<tr class="'+(atras?'atras':'')+'">'+
      '<td><input type="checkbox" class="chkLF" data-id="'+l.id+'"></td>'+
      '<td>'+dataBR(l.vencimento)+(atras?'<span class="atrTag">atrasado</span>':'')+'</td>'+
      '<td>'+dataBR(l.emissao)+'</td>'+
      '<td>'+(l.pagamento?dataBR(l.pagamento):'—')+'</td>'+
      '<td><div class="lfDesc">'+iconeConta(l.contaId)+
       '<div><b>'+E(l.descricao||'—')+'</b>'+
       (l.tipo==='transferencia'?'<small>transferência → '+E(contaNome(l.contaDestinoId))+'</small>'
        :(l.fornecedor?'<small>'+E(l.fornecedor)+(l.documento?' · doc '+E(l.documento):'')+'</small>':''))+
       '</div></div></td>'+
      '<td>'+E(l.metodoId?metodoNome(l.metodoId):'—')+'</td>'+
      '<td><span class="grpTag">'+E(catTexto(l))+'</span>'+(l.conciliado?'<span class="concTag" title="conciliado no banco">'+sv('nike',14)+'</span>':'')+'</td>'+
      '<td style="text-align:right"><span class="vBol">'+(neg?'- ':'')+'R$ '+money(valorBoleto(l))+'</span></td>'+
      '<td style="text-align:right">'+
       (l.pago
        ?'<b class="'+(neg?'vr':'vg')+'">'+(neg?'- ':'')+'R$ '+money(valorPago(l))+'</b>'+
          (encargos(l)>0
           ?'<small class="vEnc">+ R$ '+money(encargos(l))+' juros/multa</small>':'')
        :'<span class="vNp">em aberto</span>')+
      '</td>'+
      '<td><div class="acoesLf">'+
       '<button class="joia '+(l.pago?'on':'')+'" onclick="togglePago(\''+l.id+'\')" title="'+(l.pago?'Pago':'Não pago')+'">'+
        sv(l.pago?'up4':'dn4',14)+'</button>'+
       /* o codigo de barras ja e digitado no cadastro (campo lnCB) e sobe
          para a nuvem como codigo_barras. `copiarBoleto` existia para
          devolve-lo para a area de transferencia na hora de pagar, e
          nunca foi chamada: o dado era guardado e nao tinha como sair.
          O botao so aparece na linha que tem codigo. */
       (l.codigoBarras
        ?'<button class="rBtn" onclick="copiarBoleto(\''+l.id+'\')" title="Copiar código de barras">'+
          sv('copy',12)+'</button>':'')+
       '<button class="rBtn" onclick="modalLanc(\''+l.id+'\')" title="Editar">'+sv('edit',12)+'</button>'+
       '<button class="rBtn rd" onclick="excluirLanc(\''+l.id+'\')" title="Excluir">'+sv('trash',12)+'</button>'+
      '</div></td></tr>';
    }).join('')+'</tbody></table>'
   :'<div class="lfVazio"><b>Nenhum lançamento no período</b>'+
    'Use o botão <b>+</b> para incluir despesa, receita ou transferência entre contas.</div>')+
   /* ==========================================================
      O RODAPE DAS CONTAS EXISTIA E NAO ERA DESENHADO (V204)

      `rodapeCaixa()` monta o rodape com o saldo: uma conta so quando ha
      filtro de conta, ou a lista de todas com o total no meio quando nao
      ha. O CSS dele (.lfRodape, .lfRodape.centro, .rcUm, .rcTot) esta na
      folha desde sempre — estilo escrito para uma coisa que nunca era
      posta na tela.
      ========================================================== */
   rodapeCaixa()+
   '</div></div>';

  ligarSelecao();
  $('lfD').oninput=function(){LF.desc=this.value;var p=this.selectionStart;telaLancamentos();
    var n=$('lfD');n.focus();n.setSelectionRange(p,p);};
  $('lfF').oninput=function(){LF.forn=this.value;var p=this.selectionStart;telaLancamentos();
    var n=$('lfF');n.focus();n.setSelectionRange(p,p);};
  rodape(lista.length+' lançamentos no período');
}
function rodapeCaixa(){
  var contas=(DB.contas||[]);
  if(LF.conta){
    var c=contas.find(function(x){return x.id===LF.conta});
    if(!c)return '';
    var b=c.fixa?null:banco(c.banco);
    var cor=c.fixa==='caixa'?'#0E8A46':c.fixa==='cofre'?'#5C6B80':(b?b.c:'#5C6B80');
    var sig=c.fixa==='caixa'?'CX':c.fixa==='cofre'?'CO':(b?b.s:'$');
    return '<div class="lfRodape centro"><div class="rcUm">'+
    '<span class="ctMini" style="background:'+cor+'">'+sig+'</span>'+
    '<div><span>Saldo da conta selecionada</span><b>'+E(c.nome)+'</b></div></div>'+
    '<div class="rcTot central"><span>Saldo em '+E(c.nome)+'</span><b>R$ '+money(saldoConta(c))+'</b></div>'+
    '<button class="btnP2" onclick="LF.conta=\'\';telaLancamentos()">Ver todas</button></div>';
  }
  var total=contas.reduce(function(a,c){return a+saldoConta(c)},0);
  return '<div class="lfRodape centro">'+
   '<div class="rcLista">'+contas.map(function(c){
     var b=c.fixa?null:banco(c.banco);
     var cor=c.fixa==='caixa'?'#0E8A46':c.fixa==='cofre'?'#5C6B80':(b?b.c:'#5C6B80');
     var sig=c.fixa==='caixa'?'CX':c.fixa==='cofre'?'CO':(b?b.s:'$');
     return '<div class="rcItem" onclick="LF.conta=\''+c.id+'\';telaLancamentos()">'+
     '<span class="ctMini" style="background:'+cor+'">'+sig+'</span>'+
     '<div><span>'+E(c.nome)+'</span><b>R$ '+money(saldoConta(c))+'</b></div></div>';
   }).join('')+'</div>'+
   '<div class="rcTot central"><span>Total em caixa e contas</span><b>R$ '+money(total)+'</b></div>'+
  '</div>';
}
function setLF(k,v){LF[k]=v;telaLancamentos();}
function menuCatFiltro(ev){
  ev.stopPropagation();
  var h='<div class="arvPop">'+
   '<button class="apLinha" onclick="LF.categoria=\'\';LF.subcat=\'\';LF.subcatNome=\'\';fecharPops();telaLancamentos()">'+
    sv('folder',14)+' Todas as categorias</button>';
  (DB.catfin||[]).forEach(function(p){
    var ab=!!(CF.abertas&&CF.abertas['f_'+p.id]);
    h+='<div class="apGrupo">'+
     '<button class="apPasta'+(LF.categoria===p.nome?' on':'')+'" onclick="event.stopPropagation();togglePastaFiltro(\''+p.id+'\',\''+E(p.nome).replace(/'/g,"")+'\')">'+
      '<span class="apSeta'+(ab?' ab':'')+'">'+sv('tri',10)+'</span>'+
      sv(ab?'folderOpen':'folder',14)+' <span class="apNm">'+E(p.nome)+'</span>'+
      '<span class="apQt">'+(p.itens||[]).length+'</span></button>'+
     (ab?'<div class="apFilhos">'+(p.itens||[]).map(function(it){
        return '<button class="apItem'+(LF.subcat===it.id?' on':'')+'" onclick="event.stopPropagation();escolheSubFiltro(\''+it.id+'\')">'+
        sv('file2',12)+' '+E(it.nome)+'</button>';}).join('')+'</div>':'')+
    '</div>';
  });
  if(!(DB.catfin||[]).length)h+='<div class="hint" style="padding:14px">Nenhuma categoria cadastrada.</div>';
  h+='</div>';
  pop(ev,h);
}
function togglePastaFiltro(id,nome){
  CF.abertas=CF.abertas||{};
  CF.abertas['f_'+id]=!CF.abertas['f_'+id];
  LF.categoria=nome;LF.subcat='';LF.subcatNome='';
  var ev={stopPropagation:function(){},currentTarget:document.querySelector('.selArv')};
  fecharPops();menuCatFiltro(ev);
  telaLancFiltro();
}
function escolheSubFiltro(id){
  LF.subcat=id;LF.subcatNome=nomeCategoria(id);LF.categoria='';
  fecharPops();telaLancamentos();
}
function telaLancFiltro(){
  var t=document.querySelector('.selArv span');
  if(t)t.textContent=LF.categoria||LF.subcatNome||'Todas';
}
function limparLF(){
  LF.tipo='todas';LF.sit='todas';LF.conta='';LF.metodo='';LF.categoria='';LF.subcat='';LF.subcatNome='';LF.desc='';LF.forn='';
  telaLancamentos();
}
function periodoCustom(){
  var h='<div class="mdB"><div class="blk" style="margin:0;max-width:none"><div class="row2">'+
  '<div class="fld2"><label>De</label><input id="pcDe" type="date" value="'+LF.de+'"></div>'+
  '<div class="fld2"><label>Até</label><input id="pcAte" type="date" value="'+LF.ate+'"></div></div></div></div>';
  modal('Período personalizado',h,'Aplicar',function(){
    LF.de=$('pcDe').value;LF.ate=$('pcAte').value;LF.rotulo='Personalizado';
    telaLancamentos();return true;
  },'sm2');
}
function ligarSelecao(){
  var c=document.querySelectorAll('.chkLF');
  for(var i=0;i<c.length;i++)c[i].onchange=atualizaSelecao;
  atualizaSelecao();
}
function atualizaSelecao(){
  var c=document.querySelectorAll('.chkLF:checked');
  var box=$('selInfo');if(!box)return;
  if(!c.length){box.classList.remove('on');box.innerHTML='<span>nenhum selecionado</span>';return;}
  var tot=0,det=0,rec=0;
  for(var i=0;i<c.length;i++){
    var l=DB.lancFin.find(function(x){return x.id===c[i].getAttribute('data-id')});
    if(!l)continue;
    if(l.tipo==='despesa'){det+=l.valor;tot-=l.valor;}
    else{rec+=l.valor;tot+=l.valor;}
  }
  box.classList.add('on');
  /* ==========================================================
     A SELECAO EM LOTE EXISTIA INTEIRA, MENOS O BOTAO (V204)

     Tudo ja estava construido: a caixinha por linha, o "marcar todas",
     esta barra com a soma do que foi selecionado, e `modalPagamento`
     aceitando uma LISTA — ela escreve "N lançamentos selecionados",
     soma o total e ainda avisa quantos conciliados ficaram de fora.

     Faltava so o caminho entre uma coisa e outra. `mudarPago(v)` e
     exatamente essa ponte, e era uma das 42 funcoes que ninguem
     chamava: junta os marcados e manda para `modalPagamento` quando e
     para pagar, ou desmarca o pago quando nao e.

     Sem os botoes, quem selecionava via a soma aparecer e nao tinha o
     que fazer com ela.
     ========================================================== */
  box.innerHTML='<span>'+c.length+' selecionado'+(c.length>1?'s':'')+'</span>'+
   '<b class="'+(tot<0?'vr':'vg')+'">R$ '+money(Math.abs(tot))+'</b>'+
   (det&&rec?'<small>despesas R$ '+money(det)+' · receitas R$ '+money(rec)+'</small>':'')+
   '<div class="selAcoes">'+
    '<button class="ok" onclick="mudarPago(true)">'+sv('cash',12)+' Marcar pago</button>'+
    '<button onclick="mudarPago(false)">Desmarcar</button>'+
   '</div>';
}
function selTodasLF(el){
  var c=document.querySelectorAll('.chkLF');
  for(var i=0;i<c.length;i++)c[i].checked=el.checked;
  atualizaSelecao();
}
function togglePago(id){
  var l=DB.lancFin.find(function(x){return x.id===id});
  if(!l)return;
  if(l.conciliado){toast('Movimento conciliado. Desconcilie na Conciliação Bancária para alterar.');return;}
  /* pagar pede banco e forma no meio da tela; despagar e direto */
  if(!l.pago){modalPagamento([id]);return;}
  l.pago=false;l.pagamento='';
  salvar();telaLancamentos();
  toast('Marcado como não pago.');
}
function mudarPago(v){
  var c=document.querySelectorAll('.chkLF:checked');
  if(!c.length){toast('Selecione os lançamentos na lista.');return;}
  var ids=[];
  for(var i=0;i<c.length;i++)ids.push(c[i].getAttribute('data-id'));
  if(v){modalPagamento(ids);return;}
  var n=0;
  ids.forEach(function(id){
    var l=DB.lancFin.find(function(x){return x.id===id});
    if(!l||l.conciliado)return;
    l.pago=false;l.pagamento='';n++;
  });
  salvar();telaLancamentos();
  toast(n+' lançamento(s) marcado(s) como não pago.');
}
/* Dois valores diferentes que nao podem ser confundidos:
   o do boleto (o que foi combinado) e o que realmente saiu do banco. */
function valorBoleto(l){
  if(!l)return 0;
  return (l.valorOriginal!==undefined&&l.valorOriginal!==null)
    ?Number(l.valorOriginal)||0:Number(l.valor)||0;
}
function encargos(l){
  if(!l)return 0;
  return (Number(l.juros)||0)+(Number(l.multa)||0);
}
function valorPago(l){return Number(l.valor)||0}   /* ja inclui juros e multa */
var _pgBase=0,_pgTipo='despesa';
/* mostra na hora quanto vai sair da conta com juros e multa somados */
function recalcPagamento(){
  var el=document.getElementById('pgTotal');
  if(!el)return;
  var j=$('pgJ')?(parseFloat($('pgJ').value)||0):0;
  var mu=$('pgMu')?(parseFloat($('pgMu').value)||0):0;
  var tot=_pgBase+j+mu;
  el.innerHTML='<div><span>Valor da conta</span><b>R$ '+money(_pgBase)+'</b></div>'+
   ((j+mu)>0?'<div><span>Juros e multa</span><b class="vr">+ R$ '+money(j+mu)+'</b></div>':'')+
   '<div class="tot"><span>Total a pagar</span>'+
    '<b class="'+(_pgTipo==='despesa'?'vr':'vg')+'">R$ '+money(tot)+'</b></div>';
}
/* ---------- CONFIRMAÇÃO DE PAGAMENTO ----------
   O banco e a forma de pagamento se escolhem aqui, na hora de dar baixa,
   e não no cadastro do lançamento. */
function modalPagamento(ids){
  baseLanc();
  var ls=(ids||[]).map(function(id){return DB.lancFin.find(function(x){return x.id===id})})
    .filter(function(l){return !!l});
  var travados=ls.filter(function(l){return l.conciliado}).length;
  ls=ls.filter(function(l){return !l.conciliado});
  if(!ls.length){
    toast(travados?'Movimento conciliado. Desconcilie na Conciliação Bancária para alterar.'
                  :'Nada para pagar.');
    return;
  }
  var prim=ls[0];
  var tot=ls.reduce(function(a,l){return a+(l.tipo==='despesa'?-1:1)*(Number(l.valor)||0)},0);
  var contas=(DB.contas||[]);
  var formas=(DB.formasPag||[]).filter(function(f){return f.ativa!==false});
  var cSel=prim.contaId||(contas.length===1?contas[0].id:'');
  var mSel=prim.metodoId||(formas.length===1?formas[0].id:'');
  var h='<div class="mdB"><div class="blk" style="margin:0;max-width:none">'+
   '<div class="pgTopo">'+
    '<div class="pgIc">'+sv('cash',18)+'</div>'+
    '<div class="pgTx"><b>'+E(ls.length>1?ls.length+' lançamentos selecionados':(prim.descricao||'—'))+'</b>'+
     (ls.length===1&&(prim.fornecedor||prim.documento)
      ?'<small>'+E(prim.fornecedor||'')+(prim.documento?' · doc '+E(prim.documento):'')+'</small>'
      :'<small>vencimento '+dataBR(prim.vencimento)+'</small>')+'</div>'+
    '<div class="pgVal '+(tot<0?'vr':'vg')+'">'+(tot<0?'- ':'')+'R$ '+money(Math.abs(tot))+'</div>'+
   '</div>'+
   (travados?'<div class="avisoPg">'+sv('help',12)+' <span>'+travados+
     ' movimento(s) conciliado(s) ficaram de fora.</span></div>':'')+
   '<div class="row2" style="margin-top:14px">'+
    '<div class="fld2"><label>Banco / conta *</label><select id="pgC">'+
     '<option value="">Selecione uma opção</option>'+
     contas.map(function(c){return '<option value="'+c.id+'"'+(cSel===c.id?' selected':'')+'>'+
       E(c.nome)+'</option>'}).join('')+
    '</select></div>'+
    '<div class="fld2"><label>Forma de pagamento *</label>'+
     '<select id="pgM"><option value="">Selecione uma opção</option>'+
     formas.map(function(f){return '<option value="'+f.id+'"'+(mSel===f.id?' selected':'')+'>'+
       E(f.nome)+'</option>'}).join('')+
    '</select></div>'+
   '</div>'+
   '<div class="row3" style="margin-top:2px">'+
    '<div class="fld2"><label>Dia do pagamento</label>'+
     '<input id="pgD" type="date" value="'+(prim.pagamento||hojeISO())+'"></div>'+
    (ls.length===1
     ?'<div class="fld2"><label>Juros (R$)</label>'+
       '<input id="pgJ" type="number" step="0.01" min="0" value="'+(Number(prim.juros)||0||'')+'" '+
       'placeholder="0,00" oninput="recalcPagamento()"></div>'+
      '<div class="fld2"><label>Multa (R$)</label>'+
       '<input id="pgMu" type="number" step="0.01" min="0" value="'+(Number(prim.multa)||0||'')+'" '+
       'placeholder="0,00" oninput="recalcPagamento()"></div>'
     :'<div class="fld2"></div><div class="fld2"></div>')+
   '</div>'+
   (ls.length===1
    ?'<div class="pgTotal" id="pgTotal"></div>'
    :'')+
   '</div></div>';
  /* base do cálculo: o valor de antes de qualquer juros já lançado */
  _pgBase=(prim.valorOriginal!==undefined?Number(prim.valorOriginal):Number(prim.valor))||0;
  _pgTipo=prim.tipo;
  modal(ls.length>1?'Dar baixa em '+ls.length+' lançamentos':'Confirmar pagamento',
    h,'Confirmar pagamento',function(){
    var c=$('pgC').value,m=$('pgM').value;
    if(!c){toast('Selecione o banco / conta.');return false;}
    if(!m){toast('Selecione a forma de pagamento.');return false;}
    var d=$('pgD').value||hojeISO();
    var j=$('pgJ')?(parseFloat($('pgJ').value)||0):0;
    var mu=$('pgMu')?(parseFloat($('pgMu').value)||0):0;
    if(j<0||mu<0){toast('Juros e multa não podem ser negativos.');return false;}
    ls.forEach(function(l){
      l.pago=true;l.contaId=c;l.metodoId=m;l.pagamento=d;
      if($('pgJ')){
        /* o valor do lançamento passa a ser o que realmente saiu da conta,
           para que fluxo de caixa, DRE e conciliação batam com o extrato */
        if(l.valorOriginal===undefined)l.valorOriginal=Number(l.valor)||0;
        l.juros=j;l.multa=mu;
        l.valor=+((Number(l.valorOriginal)||0)+j+mu).toFixed(2);
      }
    });
    salvar();telaLancamentos();
    toast((ls.length>1?ls.length+' lançamentos pagos':'Pago R$ '+money(ls[0].valor))+' — '+
      contaNome(c)+' · '+metodoNome(m)+((j+mu)>0?' · com juros/multa':'')+'.');
    return true;
  });
  setTimeout(recalcPagamento,60);
}
async function excluirLanc(id){
  var l=DB.lancFin.find(function(x){return x.id===id});
  if(l.conciliado){toast('Movimento conciliado — não pode ser excluído. Desconcilie primeiro.');return;}
  /* lancamento de nota de entrada cuja nota ainda existe:
     nao some — vai para Compras sem Vinculo, com quem e quando */
  var nota=(l.origem==='nota-entrada'&&l.ref)
    ?(DB.notas||[]).find(function(x){return x.id===l.ref}):null;
  if(nota){
    if(!await pergunta('Este boleto pertence à nota '+nota.numero+' ('+nota.fornecedorNome+'), que continua lançada.\n\n'+
      'Ele será REMOVIDO do financeiro e registrado em\n'+
      'Gestão Financeira › Compras sem Vínculo — com data, hora e usuário.\n\n'+
      'Para excluir a compra inteira, exclua a NOTA em Notas de Entrada.\n\nContinuar?'))return;
    arquivarSemVinculo(l,nota);
    DB.lancFin=DB.lancFin.filter(function(x){return x.id!==id});
    salvar();telaLancamentos();
    toast('Boleto movido para Compras sem Vínculo.');
    return;
  }
  if(!await pergunta('Excluir "'+(l.descricao||'lançamento')+'"?'))return;
  DB.lancFin=DB.lancFin.filter(function(x){return x.id!==id});
  salvar();telaLancamentos();toast('Lançamento excluído.');
}
function arquivarSemVinculo(l,nota){
  DB.comprasSemVinc=DB.comprasSemVinc||[];
  var u=usuarioLogado();
  DB.comprasSemVinc.push({id:uid('csv'),
    notaId:nota?nota.id:(l.ref||''),notaNumero:nota?nota.numero:'',
    fornecedor:nota?nota.fornecedorNome:(l.fornecedor||''),
    descricao:l.descricao||'',documento:l.documento||'',
    valor:Number(l.valor)||0,vencimento:l.vencimento||'',
    itens:nota?(nota.itens||[]).map(function(it){
      return {nome:it.nome,qtd:it.qtd,unidade:it.unidade,total:it.total}}):[],
    excluidoPor:u?u.nome:'—',excluidoEm:new Date().toISOString(),
    lanc:{tipo:l.tipo,contaId:l.contaId,metodoId:l.metodoId,categoriaId:l.categoriaId,
      pago:!!l.pago,emissao:l.emissao,pagamento:l.pagamento||null}});
}

/* ==========================================================
   COMPRAS SEM VINCULO
   Boletos de nota de entrada excluidos sem excluir a nota.
   ========================================================== */
var CSV={de:'',ate:''};
function telaSemVinculo(){
  DB.comprasSemVinc=DB.comprasSemVinc||[];
  if(!CSV.de){CSV.de=diasAtrasISO(90);CSV.ate=hojeISO();}
  var lista=(DB.comprasSemVinc||[]).filter(function(c){
    var d=(c.excluidoEm||'').slice(0,10);
    if(CSV.de&&d<CSV.de)return false;
    if(CSV.ate&&d>CSV.ate)return false;
    return true;
  }).sort(function(a,b){return (b.excluidoEm||'').localeCompare(a.excluidoEm||'')});
  var tot=lista.reduce(function(a,c){return a+(Number(c.valor)||0)},0);
  $('content').innerHTML='<div class="mvWrap telaCheia">'+
   '<div class="mvTopo"><h1>Compras sem Vínculo</h1><div style="flex:1"></div></div>'+
   '<div class="mvCorpo">'+
   '<p style="margin:0 0 12px;color:var(--ink-3);font-size:13px">Boletos de nota de entrada que foram excluídos do financeiro '+
    '<b>sem excluir a nota</b>. A compra existe no estoque, mas ficou sem a conta a pagar.</p>'+
   '<div style="display:flex;gap:10px;align-items:flex-end;margin:0 0 12px;flex-wrap:wrap">'+
    '<div class="f2" style="max-width:150px"><label>De</label>'+
     '<input type="date" id="csvDe" value="'+CSV.de+'"></div>'+
    '<div class="f2" style="max-width:150px"><label>Até</label>'+
     '<input type="date" id="csvAte" value="'+CSV.ate+'"></div>'+
    '<button class="btnP2" style="height:30px;align-self:flex-end" onclick="filtraSemVinc()">Aplicar</button>'+
    '<div style="flex:1"></div>'+
    '<div class="ntTot dest6" style="align-self:flex-end"><span>'+lista.length+
     ' boleto(s) · total</span><b>R$ '+money(tot)+'</b></div>'+
   '</div>'+
   (lista.length
    ?'<div class="blk" style="max-width:none;padding:0;overflow:hidden">'+
     '<table class="fmTab"><thead><tr>'+
      '<th style="width:130px">Excluído em</th><th style="width:150px">Por</th>'+
      '<th style="width:90px">Nota</th><th>Fornecedor</th><th>Descrição</th>'+
      '<th style="width:110px">Vencimento</th>'+
      '<th style="width:120px;text-align:right">Valor</th></tr></thead><tbody>'+
     lista.map(function(c){
       var dt=c.excluidoEm?dataBR(c.excluidoEm.slice(0,10))+' '+c.excluidoEm.slice(11,16):'—';
       return '<tr style="cursor:pointer" onclick="verSemVinc(\''+c.id+'\')">'+
       '<td>'+dt+'</td><td><b>'+E(c.excluidoPor||'—')+'</b></td>'+
       '<td>'+E(c.notaNumero||'—')+'</td><td>'+E(c.fornecedor||'—')+'</td>'+
       '<td>'+E(c.descricao||'—')+'</td>'+
       '<td>'+(c.vencimento?dataBR(c.vencimento):'—')+'</td>'+
       '<td style="text-align:right"><b>R$ '+money(c.valor)+'</b></td></tr>';
     }).join('')+'</tbody></table></div>'
    :'<div class="mvVazio" style="padding:64px">'+sv('check',26)+
     '<b>Nenhuma compra sem vínculo</b>'+
     '<span>Ótimo sinal: nenhum boleto de nota foi excluído sem excluir a nota.</span></div>')+
   '</div>';
  rodape(lista.length+' registro(s)');
}
function filtraSemVinc(){CSV.de=$('csvDe').value;CSV.ate=$('csvAte').value;telaSemVinculo();}
function verSemVinc(id){
  var c=(DB.comprasSemVinc||[]).find(function(x){return x.id===id});
  if(!c)return;
  var notaExiste=(DB.notas||[]).some(function(n){return n.id===c.notaId});
  var h='<div class="mdB">'+
   '<div class="cfLinhas" style="margin-bottom:10px">'+
    '<div class="cfL"><span>Nota de entrada</span><b>'+E(c.notaNumero||'—')+
     (notaExiste?'':' <span class="vr">(a nota também foi excluída depois)</span>')+'</b></div>'+
    '<div class="cfL"><span>Fornecedor</span><b>'+E(c.fornecedor||'—')+'</b></div>'+
    '<div class="cfL"><span>Boleto</span><b>'+E(c.descricao||'—')+
     (c.documento?' · '+E(c.documento):'')+'</b></div>'+
    '<div class="cfL"><span>Valor</span><b>R$ '+money(c.valor)+'</b></div>'+
    '<div class="cfL"><span>Vencimento</span><b>'+(c.vencimento?dataBR(c.vencimento):'—')+'</b></div>'+
    '<div class="cfL"><span>Excluído por</span><b class="vr">'+E(c.excluidoPor||'—')+' — '+
     (c.excluidoEm?dataBR(c.excluidoEm.slice(0,10))+' às '+c.excluidoEm.slice(11,16):'—')+'</b></div>'+
   '</div>'+
   '<div class="blk" style="margin:0;max-width:none;padding:0;overflow:hidden">'+
    '<div class="acTit">Itens da nota de origem</div>'+
    '<table class="acTab"><thead><tr><th>Mercadoria</th>'+
     '<th style="width:110px;text-align:right">Qtd</th>'+
     '<th style="width:120px;text-align:right">Total</th></tr></thead><tbody>'+
    ((c.itens||[]).length?c.itens.map(function(it){
      return '<tr><td>'+E(it.nome)+'</td>'+
      '<td style="text-align:right">'+fmtQt(it.qtd)+' '+un(it.unidade).ab+'</td>'+
      '<td style="text-align:right">R$ '+money(it.total)+'</td></tr>';
    }).join(''):'<tr><td colspan="3" class="semIns">sem itens registrados</td></tr>')+
    '</tbody></table></div>'+
   '<div class="hint" style="margin-top:10px">Para repor a conta a pagar, clique em '+
    '<b>Relançar no financeiro</b> — o boleto volta como estava.</div>'+
  '</div>';
  var o=document.createElement('div');o.className='mdOv';o.id='mdOv';
  o.innerHTML='<div class="mdBox xl"><div class="mdH"><b>Compra sem vínculo — nota '+E(c.notaNumero||'')+'</b>'+
   '<button class="mdX" onclick="fecharModal()">&times;</button></div>'+h+
   '<div class="mdF"><button class="btnP2" onclick="fecharModal()">Fechar</button>'+
   '<button class="btnP2 ok" onclick="relancarSemVinc(\''+c.id+'\')">Relançar no financeiro</button></div></div>';
  document.body.appendChild(o);
}
async function relancarSemVinc(id){
  var c=(DB.comprasSemVinc||[]).find(function(x){return x.id===id});
  if(!c)return;
  if(!await pergunta('Relançar o boleto de R$ '+money(c.valor)+' no financeiro?\n\n'+
    'Ele volta como conta a pagar e sai desta lista.'))return;
  var lc=c.lanc||{};
  DB.lancFin=DB.lancFin||[];
  DB.lancFin.push({id:uid('lf'),tipo:lc.tipo||'despesa',contaId:lc.contaId||'',
    contaDestinoId:'',metodoId:lc.metodoId||'',categoriaId:lc.categoriaId||'',categoriaTxt:'',
    fornecedorId:'',fornecedor:c.fornecedor||'',descricao:c.descricao||('NF '+c.notaNumero),
    documento:c.documento||'',valor:Number(c.valor)||0,
    emissao:lc.emissao||hojeISO(),vencimento:c.vencimento||hojeISO(),
    pagamento:lc.pagamento||null,pago:!!lc.pago,conciliado:false,dataConc:null,
    origem:'nota-entrada',ref:c.notaId,obs:'relançado de Compras sem Vínculo'});
  DB.comprasSemVinc=DB.comprasSemVinc.filter(function(x){return x.id!==id});
  salvar();fecharModal();telaSemVinculo();
  toast('Boleto relançado no financeiro.');
}



/* ==========================================================
   CMV POR MERCADORIA
   Confronto de inventario, item a item:
   saldo inicial + entradas + producao + ajustes - baixas - saidas = saldo final
   ========================================================== */
var CV={de:'',ate:'',grupo:'',so:''};
function cmvCalcular(de,ate){
  baseMov();baseEstoque();
  var M={};
  function reg(id){
    var i=itemEstoque(id);if(!i)return null;
    if(!M[i.id])M[i.id]={ins:i,qIni:0,vIni:0,qEnt:0,vEnt:0,qPro:0,vPro:0,
      qAju:0,vAju:0,qBai:0,vBai:0,qSai:0,vSai:0};
    return M[i.id];
  }
  (DB.insumos||[]).forEach(function(i){if(i.controlaEstoque!==false)reg(i.id)});
  (DB.fichas||[]).forEach(function(f){if(f.estocavel!==false)reg(f.id)});
  /* varre as movimentacoes uma vez so */
  (DB.movEst||[]).forEach(function(m){
    var tipo=tipoMotivo(m.motivoId),org=String(m.origem||''),nome=nomeMotivo(m.motivoId);
    (m.linhas||[]).forEach(function(l){
      var r=reg(l.insumoId);if(!r)return;
      var q=convUnid(l.qtd,l.unidade,r.ins.unidade); if(q===null)q=Number(l.qtd)||0;
      var v=Math.abs(q*(Number(l.custo)||0));
      var ent=(l.direcao==='entrada');
      if(m.data<de){ r.qIni+=ent?q:-q; r.vIni+=ent?v:-v; return; }
      if(m.data>ate) return;
      if(org==='venda'){ r.qSai+=q; r.vSai+=v; }
      else if(org.indexOf('producao')>=0||tipo==='producao'||String(l.origem||'').indexOf('producao')>=0){
        if(ent){r.qPro+=q;r.vPro+=v;} else {r.qSai+=q;r.vSai+=v;}
      }
      else if(org==='nota'||tipo==='entrada'){ r.qEnt+=q;r.vEnt+=v; }
      else if(/contagem|ajuste|invent/i.test(nome)||org==='contagem'){
        r.qAju+=ent?q:-q; r.vAju+=ent?v:-v;
      }
      else { r.qBai+=q; r.vBai+=v; }
    });
  });
  var L=[];
  Object.keys(M).forEach(function(k){
    var r=M[k];
    r.qFim=r.qIni+r.qEnt+r.qPro+r.qAju-r.qBai-r.qSai;
    r.vFim=r.vIni+r.vEnt+r.vPro+r.vAju-r.vBai-r.vSai;
    r.cmv=r.vSai;
    r.grupo=(grupoIng(r.ins.grupoId)||{}).nome||'—';
    r.movimentou=(r.qEnt||r.qPro||r.qAju||r.qBai||r.qSai||r.qIni);
    L.push(r);
  });
  return L;
}
function telaCMV(){
  if(!CV.de){var d=new Date();CV.de=new Date(d.getFullYear(),d.getMonth(),1).toISOString().slice(0,10);CV.ate=hojeISO();}
  var L=cmvCalcular(CV.de,CV.ate);
  if(CV.grupo)L=L.filter(function(r){return r.ins.grupoId===CV.grupo});
  if(CV.so==='mov')L=L.filter(function(r){return r.movimentou});
  if(CV.so==='perda')L=L.filter(function(r){return r.vBai>0});
  L.sort(function(a,b){return b.cmv-a.cmv});
  var T=function(c){return L.reduce(function(a,r){return a+r[c]},0)};
  var cmv=T('cmv');
  $('content').innerHTML='<div class="ctWrap" style="max-width:none">'+
   '<div class="ctTopo"><h1>CMV por Mercadoria</h1>'+
    '<p>Custo da Mercadoria Vendida por confronto de estoque, item a item: '+
    '<b>saldo inicial + entradas + produção + ajustes − baixas − saídas = saldo final</b>. '+
    'É a conta que mostra para onde o dinheiro do estoque foi.</p></div>'+
   '<div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;margin-bottom:12px">'+
    '<div class="f2" style="max-width:150px"><label>De</label><input type="date" id="cvDe" value="'+CV.de+'"></div>'+
    '<div class="f2" style="max-width:150px"><label>Até</label><input type="date" id="cvAte" value="'+CV.ate+'"></div>'+
    '<div class="f2"><label>Grupo</label><select onchange="CV.grupo=this.value;telaCMV()">'+
     '<option value="">todos</option>'+(DB.gruposIng||[]).map(function(g){
       return '<option value="'+g.id+'"'+(CV.grupo===g.id?' selected':'')+'>'+E(g.nome)+'</option>'}).join('')+
    '</select></div>'+
    '<div class="f2"><label>Mostrar</label><select onchange="CV.so=this.value;telaCMV()">'+
     '<option value="">todos os itens</option>'+
     '<option value="mov"'+(CV.so==='mov'?' selected':'')+'>só quem movimentou</option>'+
     '<option value="perda"'+(CV.so==='perda'?' selected':'')+'>só quem teve perda</option>'+
    '</select></div>'+
    '<button class="btnP2" style="height:30px" onclick="CV.de=$(\'cvDe\').value;CV.ate=$(\'cvAte\').value;telaCMV()">Aplicar</button>'+
    '<button class="btnP2" style="height:30px" onclick="exportarCMV()">'+sv('file2',12)+' Exportar</button>'+
   '</div>'+
   '<div class="hpNums" style="border:1px solid var(--line);border-radius:8px;overflow:hidden;margin-bottom:12px">'+
    '<div class="hpN"><span>Estoque inicial</span><b>R$ '+money(T('vIni'))+'</b></div>'+
    '<div class="hpN"><span>Entradas</span><b class="vg">+ '+money(T('vEnt'))+'</b></div>'+
    '<div class="hpN"><span>Produção</span><b class="vg">+ '+money(T('vPro'))+'</b></div>'+
    '<div class="hpN"><span>Ajustes</span><b>'+(T('vAju')<0?'− ':'+ ')+money(Math.abs(T('vAju')))+'</b></div>'+
    '<div class="hpN"><span>Perdas e baixas</span><b class="vr">− '+money(T('vBai'))+'</b></div>'+
    '<div class="hpN dest4"><span>CMV (saídas por venda)</span><b class="vr">− '+money(cmv)+'</b></div>'+
    '<div class="hpN"><span>Estoque final</span><b>R$ '+money(T('vFim'))+'</b></div>'+
   '</div>'+
   '<div class="blk" style="max-width:none;padding:0;overflow:auto">'+
    '<table class="fmTab"><thead><tr>'+
     '<th style="width:70px">Código</th><th>Mercadoria</th><th style="width:150px">Grupo</th>'+
     '<th style="width:50px">Un.</th>'+
     '<th style="width:88px;text-align:right">Qtd ini.</th><th style="width:96px;text-align:right">R$ ini.</th>'+
     '<th style="width:88px;text-align:right">Entradas</th><th style="width:88px;text-align:right">Produção</th>'+
     '<th style="width:88px;text-align:right">Ajustes</th><th style="width:96px;text-align:right">Perdas</th>'+
     '<th style="width:104px;text-align:right">CMV</th>'+
     '<th style="width:88px;text-align:right">Qtd fim</th><th style="width:96px;text-align:right">R$ fim</th>'+
     '<th style="width:70px;text-align:right">% CMV</th></tr></thead><tbody>'+
    (L.length?L.map(function(r){
      var ab=un(r.ins.unidade).ab;
      return '<tr'+(r.qFim<-0.001?' style="background:#FFF4E0"':'')+'>'+
      '<td>'+E(r.ins.codigo||'—')+'</td><td><b>'+E(r.ins.nome)+'</b></td>'+
      '<td><small>'+E(r.grupo)+'</small></td><td>'+ab+'</td>'+
      '<td style="text-align:right">'+fmtQt(r.qIni)+'</td>'+
      '<td style="text-align:right">'+money(r.vIni)+'</td>'+
      '<td style="text-align:right" class="vg">'+(r.vEnt?money(r.vEnt):'—')+'</td>'+
      '<td style="text-align:right" class="vg">'+(r.vPro?money(r.vPro):'—')+'</td>'+
      '<td style="text-align:right">'+(r.vAju?money(r.vAju):'—')+'</td>'+
      '<td style="text-align:right" class="vr">'+(r.vBai?money(r.vBai):'—')+'</td>'+
      '<td style="text-align:right"><b class="vr">'+(r.cmv?money(r.cmv):'—')+'</b></td>'+
      '<td style="text-align:right">'+fmtQt(r.qFim)+(r.qFim<-0.001?' ⚠':'')+'</td>'+
      '<td style="text-align:right">'+money(r.vFim)+'</td>'+
      '<td style="text-align:right">'+(cmv?((r.cmv/cmv*100).toFixed(1)+'%'):'—')+'</td></tr>';
    }).join('')
    :'<tr><td colspan="14" class="fmVazio">Nenhum item no período.</td></tr>')+
   '</tbody></table></div>'+
   '<div class="ctNota ctAt" style="max-width:900px;margin-top:12px">Linhas destacadas terminaram o '+
   'período com <b>saldo negativo</b> — sinal de baixa sem estoque no passado. A trava de estoque '+
   'da V7.4 impede que isso volte a acontecer.</div>'+
  '</div>';
  rodape(L.length+' mercadorias · CMV R$ '+money(cmv));
}
function exportarCMV(){
  var L=cmvCalcular(CV.de,CV.ate);
  var l=[['Codigo','Mercadoria','Grupo','Un','QtdIni','CustoIni','QtdEnt','CustoEnt','QtdProd','CustoProd',
          'QtdAjuste','CustoAjuste','QtdBaixa','CustoBaixa','QtdSaida','CMV','QtdFim','CustoFim']];
  L.forEach(function(r){l.push([r.ins.codigo||'',r.ins.nome,r.grupo,un(r.ins.unidade).ab,
    r.qIni,r.vIni,r.qEnt,r.vEnt,r.qPro,r.vPro,r.qAju,r.vAju,r.qBai,r.vBai,r.qSai,r.cmv,r.qFim,r.vFim]
    .map(function(c){return typeof c==='number'?String(+c.toFixed(4)).replace('.',','):c}))});
  var csv=l.map(function(r){return r.map(function(c){return '"'+String(c).replace(/"/g,'""')+'"'}).join(';')}).join('\n');
  var b=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'});
  var a=document.createElement('a');a.href=URL.createObjectURL(b);
  a.download='nexor-cmv-'+CV.de+'-a-'+CV.ate+'.csv';document.body.appendChild(a);a.click();
  setTimeout(function(){a.remove()},400);toast('CMV exportado.');
}



/* ==========================================================
   CLIENTES NEXOR
   Carteira de quem paga pelo sistema. Isto e do dono do
   produto — nenhum cliente ve esta tela.
   ========================================================== */
var CN={situacao:'',busca:''};
var PLANOS=['Mensal','Anual','Implantação','Cortesia'];
var SITUACOES=[{id:'ativo',n:'Ativo'},{id:'teste',n:'Em teste'},
  {id:'atraso',n:'Em atraso'},{id:'pausado',n:'Pausado'},{id:'cancelado',n:'Cancelado'}];
function baseCN(){DB.clientesNexor=DB.clientesNexor||[];return DB.clientesNexor}
function cnSit(id){var x=SITUACOES.find(function(s){return s.id===id});return x?x.n:'—'}
function cnPago(c,ano,mes){
  return (c.cobrancas||[]).some(function(b){return b.mes===(ano+'-'+String(mes+1).padStart(2,'0'))&&b.pago});
}
function telaClientesNexor(){
  baseCN();
  var L=DB.clientesNexor.slice();
  if(CN.situacao)L=L.filter(function(c){return c.situacao===CN.situacao});
  if(CN.busca){var q=CN.busca.toLowerCase();
    L=L.filter(function(c){return (c.rede||'').toLowerCase().indexOf(q)>=0||
      (c.responsavel||'').toLowerCase().indexOf(q)>=0});}
  L.sort(function(a,b){return (a.rede||'').localeCompare(b.rede||'')});
  var d=new Date(),ano=d.getFullYear(),mes=d.getMonth();
  var ativos=DB.clientesNexor.filter(function(c){return c.situacao==='ativo'});
  var mrr=ativos.reduce(function(a,c){return a+(Number(c.mensalidade)||0)},0);
  var unid=DB.clientesNexor.reduce(function(a,c){return a+(Number(c.unidades)||0)},0);
  var receb=ativos.filter(function(c){return cnPago(c,ano,mes)});
  var aRec=mrr-receb.reduce(function(a,c){return a+(Number(c.mensalidade)||0)},0);
  $('content').innerHTML='<div class="ctWrap" style="max-width:none">'+
   '<div class="ctTopo"><h1>Clientes Joia</h1>'+
    '<p>As redes que contrataram o sistema, o que cada uma paga e o que já entrou no mês. '+
    'Esta tela é sua — nenhum cliente tem acesso a ela.</p></div>'+
   '<div class="hpNums" style="border:1px solid var(--line);border-radius:8px;overflow:hidden;margin-bottom:12px">'+
    '<div class="hpN"><span>Clientes ativos</span><b>'+ativos.length+'</b></div>'+
    '<div class="hpN"><span>Unidades na base</span><b>'+unid+'</b></div>'+
    '<div class="hpN dest4"><span>Receita recorrente</span><b>R$ '+money(mrr)+'</b></div>'+
    '<div class="hpN"><span>Recebido no mês</span><b class="vg">R$ '+money(mrr-aRec)+'</b></div>'+
    '<div class="hpN"><span>A receber</span><b class="'+(aRec>0?'vr':'')+'">R$ '+money(aRec)+'</b></div>'+
   '</div>'+
   '<div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;margin-bottom:12px">'+
    '<div class="f2" style="max-width:240px"><label>Buscar</label>'+
     '<input id="cnB" value="'+E(CN.busca)+'" placeholder="rede ou responsável" '+
     'oninput="CN.busca=this.value;clearTimeout(window._tcn);window._tcn=setTimeout(telaClientesNexor,300)"></div>'+
    '<div class="f2"><label>Situação</label><select onchange="CN.situacao=this.value;telaClientesNexor()">'+
     '<option value="">todas</option>'+SITUACOES.map(function(x){
       return '<option value="'+x.id+'"'+(CN.situacao===x.id?' selected':'')+'>'+x.n+'</option>'}).join('')+
    '</select></div><div style="flex:1"></div>'+
    '<button class="btnP2 ok" style="height:30px" onclick="modalCN()">'+sv('plus',12)+' Novo cliente</button>'+
   '</div>'+
   '<div class="blk" style="max-width:none;padding:0;overflow:auto">'+
    '<table class="fmTab"><thead><tr><th>Rede</th><th style="width:170px">Responsável</th>'+
     '<th style="width:150px">Contato</th><th style="width:70px;text-align:right">Un.</th>'+
     '<th style="width:110px">Plano</th><th style="width:110px;text-align:right">Mensalidade</th>'+
     '<th style="width:70px;text-align:center">Venc.</th><th style="width:110px">Situação</th>'+
     '<th style="width:110px">Mês atual</th><th style="width:90px"></th></tr></thead><tbody>'+
    (L.length?L.map(function(c){
      var pg=cnPago(c,ano,mes);
      return '<tr><td><b>'+E(c.rede)+'</b>'+(c.cidade?'<small>'+E(c.cidade)+(c.uf?'/'+E(c.uf):'')+'</small>':'')+'</td>'+
      '<td>'+E(c.responsavel||'—')+'</td>'+
      '<td><small>'+E(c.telefone||c.email||'—')+'</small></td>'+
      '<td style="text-align:right">'+(c.unidades||0)+'</td>'+
      '<td>'+E(c.plano||'—')+'<small>'+((c.modulos||[]).length?(c.modulos.length+' módulos'):'tudo liberado')+'</small></td>'+
      '<td style="text-align:right"><b>R$ '+money(c.mensalidade)+'</b></td>'+
      '<td style="text-align:center">dia '+(c.diaVenc||10)+'</td>'+
      '<td><span class="pill '+(c.situacao==='ativo'?'ok':(c.situacao==='atraso'?'rd':''))+'">'+cnSit(c.situacao)+'</span></td>'+
      '<td>'+(c.situacao!=='ativo'?'—':(pg?'<b class="vg">pago</b>':
        '<button class="btnMini" onclick="marcarPago(\''+c.id+'\')">marcar pago</button>'))+'</td>'+
      '<td><button class="rBtn" onclick="modalCN(\''+c.id+'\')">'+sv('edit',12)+'</button>'+
       '<button class="rBtn rd" onclick="excluirCN(\''+c.id+'\')">'+sv('trash',12)+'</button></td></tr>';
    }).join('')
    :'<tr><td colspan="10" class="fmVazio">Nenhum cliente cadastrado. Comece pelo botão Novo cliente.</td></tr>')+
   '</tbody></table></div></div>';
  rodape(L.length+' cliente(s) · recorrente R$ '+money(mrr));
}
function modalCN(id){
  baseCN();
  var c=id?DB.clientesNexor.find(function(x){return x.id===id}):null;
  var h='<div class="mdB">'+
   '<div class="row3"><div class="fld2" style="flex:2"><label>Nome da rede</label>'+
    '<input id="cnRede" value="'+E(c?c.rede:'')+'" placeholder="ex.: Jolô Gelato"></div>'+
    '<div class="fld2"><label>Unidades</label><input id="cnUn" type="number" value="'+(c?c.unidades||1:1)+'"></div></div>'+
   '<div class="row3"><div class="fld2"><label>Responsável</label><input id="cnResp" value="'+E(c?c.responsavel:'')+'"></div>'+
    '<div class="fld2"><label>Telefone</label><input id="cnTel" value="'+E(c?c.telefone:'')+'"></div>'+
    '<div class="fld2"><label>E-mail</label><input id="cnMail" value="'+E(c?c.email:'')+'"></div></div>'+
   '<div class="row3"><div class="fld2"><label>CNPJ / CPF</label><input id="cnDoc" value="'+E(c?c.documento:'')+'"></div>'+
    '<div class="fld2"><label>Cidade</label><input id="cnCid" value="'+E(c?c.cidade:'')+'"></div>'+
    '<div class="fld2"><label>UF</label><input id="cnUf" maxlength="2" value="'+E(c?c.uf:'')+'"></div></div>'+
   '<div class="row3"><div class="fld2"><label>Plano</label><select id="cnPl">'+
     PLANOS.map(function(x){return '<option'+(c&&c.plano===x?' selected':'')+'>'+x+'</option>'}).join('')+'</select></div>'+
    '<div class="fld2"><label>Mensalidade</label><div class="cur"><span>R$</span>'+
     '<input id="cnVal" type="number" step="0.01" value="'+(c?c.mensalidade||0:0)+'"></div></div>'+
    '<div class="fld2"><label>Dia do vencimento</label><input id="cnDia" type="number" min="1" max="28" value="'+(c?c.diaVenc||10:10)+'"></div></div>'+
   '<div class="row3"><div class="fld2"><label>Situação</label><select id="cnSit">'+
     SITUACOES.map(function(x){return '<option value="'+x.id+'"'+(c&&c.situacao===x.id?' selected':'')+'>'+x.n+'</option>'}).join('')+'</select></div>'+
    '<div class="fld2"><label>Cliente desde</label><input id="cnIni" type="date" value="'+(c&&c.inicio?c.inicio:hojeISO())+'"></div></div>'+
   '<div class="fld2"><label>Observações</label><textarea id="cnObs" rows="2">'+E(c?c.obs:'')+'</textarea></div>'+
   '<div class="acTit" style="margin-top:12px">Módulos contratados</div>'+
   '<div class="hint">O que não for marcado <b>não aparece</b> para ninguém da rede — nem para a '+
    'franqueadora dela. Deixar tudo desmarcado libera tudo (cliente sem contrato definido).</div>'+
   '<div class="cnMods">'+MOD.filter(function(m){return MODULOS_BASE.indexOf(m.id)>=0&&m.id!=='tecnico'})
     .map(function(m){
       var on=c&&(c.modulos||[]).indexOf(m.id)>=0;
       return '<label class="chkL"><input type="checkbox" class="cnMod" value="'+E(m.id)+'"'+
        (on?' checked':'')+'><span>'+E(m.n)+'</span></label>';
     }).join('')+'</div>'+
   '<div class="acTit" style="margin-top:14px">Telas liberadas</div>'+
   '<div class="hint">Dentro de um modulo contratado, voce ainda escolhe tela a tela. '+
    'O que estiver desmarcado <b>nao existe</b> para o cliente — nem a franqueadora dele '+
    'consegue liberar para ninguem. Tudo marcado e o normal.</div>'+
   '<div class="cnTelas">'+MOD.filter(function(m){return m.id!=='tecnico'&&m.id!=='teste'})
     .map(function(m){
       return '<div class="cnTelaG"><div class="cnTelaH"><b>'+E(m.n)+'</b>'+
        '<button type="button" class="rBtn" onclick="cnTodasTelas(\''+E(m.id)+'\',true)">tudo</button>'+
        '<button type="button" class="rBtn" onclick="cnTodasTelas(\''+E(m.id)+'\',false)">nada</button>'+
        '</div>'+
        (m.it||[]).map(function(i){
          var ch=m.id+'/'+i.id;
          var bloq=c&&(c.bloqueados||[]).indexOf(ch)>=0;
          return '<label class="chkMini"><input type="checkbox" class="cnTela" data-mod="'+E(m.id)+'"'+
           ' value="'+E(ch)+'"'+(bloq?'':' checked')+'><span>'+E(i.n)+'</span></label>';
        }).join('')+'</div>';
     }).join('')+'</div>'+
   '<div class="fld2" style="margin-top:8px"><label>Identificador da loja no banco (loja_id)</label>'+
    '<input id="cnLoja" value="'+E(c?c.lojaId||'':'')+'" placeholder="cole aqui o id da loja do cliente">'+
    '<div class="hint">É o que liga o contrato à instalação do cliente. Sem ele, o bloqueio não chega lá.</div></div>'+
   (c&&(c.cobrancas||[]).length?'<div class="acTit" style="margin-top:10px">Pagamentos registrados</div>'+
     '<div class="hint">'+c.cobrancas.filter(function(b){return b.pago}).map(function(b){
       return b.mes+' — R$ '+money(b.valor)}).join(' · ')+'</div>':'')+
  '</div>';
  var o=document.createElement('div');o.className='mdOv';o.id='mdOv';
  o.innerHTML='<div class="mdBox xl"><div class="mdH"><b>'+(c?'Cliente':'Novo cliente')+'</b>'+
   '<button class="mdX" onclick="fecharModal()">&times;</button></div>'+h+
   '<div class="mdF"><button class="btnP2" onclick="fecharModal()">Cancelar</button>'+
   '<button class="btnP2 ok" onclick="salvarCN('+(c?"'"+c.id+"'":'null')+')">Salvar</button></div></div>';
  document.body.appendChild(o);
}
function salvarCN(id){
  baseCN();
  var rede=$('cnRede').value.trim();
  if(!rede){toast('Informe o nome da rede.');return;}
  var o={rede:rede,unidades:parseInt($('cnUn').value)||1,responsavel:$('cnResp').value.trim(),
    telefone:$('cnTel').value.trim(),email:$('cnMail').value.trim(),documento:$('cnDoc').value.trim(),
    cidade:$('cnCid').value.trim(),uf:$('cnUf').value.trim().toUpperCase(),plano:$('cnPl').value,
    mensalidade:parseFloat($('cnVal').value)||0,diaVenc:parseInt($('cnDia').value)||10,
    situacao:$('cnSit').value,inicio:$('cnIni').value,obs:$('cnObs').value.trim(),
    lojaId:($('cnLoja')?$('cnLoja').value.trim():''),
    modulos:Array.prototype.slice.call(document.querySelectorAll('.cnMod:checked'))
      .map(function(x){return x.value}),
    /* guarda o que esta FECHADO, nao o que esta aberto: assim uma tela nova
       nasce liberada para quem ja e cliente, em vez de sumir sozinha */
    bloqueados:Array.prototype.slice.call(document.querySelectorAll('.cnTela'))
      .filter(function(x){return !x.checked}).map(function(x){return x.value})};
  var a=id?DB.clientesNexor.find(function(x){return x.id===id}):null;
  if(a)Object.assign(a,o);
  else DB.clientesNexor.push(Object.assign({id:uid('cnx'),cobrancas:[]},o));
  salvar();fecharModal();telaClientesNexor();toast('Cliente salvo.');
}
function cnTodasTelas(mid,marcar){
  var cs=document.querySelectorAll('.cnTela[data-mod="'+mid+'"]');
  for(var i=0;i<cs.length;i++)cs[i].checked=marcar;
}
function marcarPago(id){
  var c=DB.clientesNexor.find(function(x){return x.id===id});if(!c)return;
  var d=new Date(),m=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
  c.cobrancas=c.cobrancas||[];
  if(c.cobrancas.some(function(b){return b.mes===m&&b.pago})){toast('Este mês já está pago.');return;}
  c.cobrancas.push({mes:m,valor:Number(c.mensalidade)||0,pago:true,quando:new Date().toISOString()});
  salvar();telaClientesNexor();toast('Pagamento de '+c.rede+' registrado.');
}
async function excluirCN(id){
  var c=DB.clientesNexor.find(function(x){return x.id===id});if(!c)return;
  if(!await pergunta('Excluir o cliente "'+c.rede+'" da sua carteira?\n\nIsto não apaga o sistema nem os dados dele.'))return;
  DB.clientesNexor=DB.clientesNexor.filter(function(x){return x.id!==id});
  salvar();telaClientesNexor();toast('Cliente removido da carteira.');
}

/* ==========================================================
   ASSISTENTE DE INSTALACAO
   O Nexor nasce vazio. Aqui a rede e criada a partir do que
   o cliente digita — nenhum nome de empresa vive no codigo.
   ========================================================== */
var INS={rede:null,und:null,nova:false,carregando:false,erro:'',nuvem:null};
function baseRedes(){
  DB.redes=DB.redes||[];
  /* redes antigas: adota as sucursais soltas na primeira rede */
  if(!DB.redes.length&&(DB.sucursais||[]).some(function(x){return !x.matriz})){
    /* AUDITORIA: havia senha:'123' escrita aqui. Era resto da estrutura
       DB.redes, aposentada — nunca autenticou nada, porque o login passa pelo
       Supabase Auth. Ainda assim, senha em texto no codigo-fonte nao fica,
       nem inutil: quem le o arquivo nao sabe que e inofensiva. */
    DB.redes.push({id:'rede_1',nome:DB.nomeRede||'Minha rede',dominio:DB.dominioRede||'',
      login:''});
    (DB.sucursais||[]).forEach(function(x){if(!x.redeId&&!x.matriz)x.redeId='rede_1'});
  }
  return DB.redes;
}

/* ==========================================================
   PAINEL DA PLATAFORMA — Administração da Nexor
   Hierarquia: EMPRESA (loja) → UNIDADE (sucursal) → ACESSO (perfil).
   A primeira unidade de uma empresa e SEMPRE a matriz — decidido no banco,
   nao na tela, para nao depender de ninguem marcar a caixinha certa.
   Tudo aqui le e grava por funcoes do servidor: as tabelas de sucursais e
   de contrato sao SINCRONIZADAS, e deixar o navegador escrever nelas para
   outra loja foi o que misturou as empresas na V25.0.0.
   ========================================================== */
async function carregarEmpresas(recarregar){
  if(INS.nuvem&&!recarregar)return INS.nuvem;
  if(!NUVEM.ligada)throw new Error('sem conexão com a nuvem');
  var r=await api('rpc/painel_empresas','POST',{});
  INS.nuvem={lista:Array.isArray(r)?r:[]};
  return INS.nuvem;
}
function empresasDaNuvem(){
  return ((INS.nuvem||{}).lista||[]).map(function(l){
    var un=l.unidades||[];
    return {loja:l, unidades:un, contrato:l.contrato||null, perfis:l.acessos||[],
      teto:l.teto||{}, permUn:l.permissoes_unidades||{},
      total:Number(l.mensalidade_total)||0,
      matriz:un.find(function(s){return s.matriz})||null,
      filiais:un.filter(function(s){return !s.matriz})};
  });
}
function empresaPorId(id){return empresasDaNuvem().find(function(x){return x.loja.id===id})||null;}
function moeda(v){return 'R$ '+(Number(v)||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});}
function selo(txt,cor){
  return '<span style="display:inline-block;margin-left:8px;padding:2px 7px;border-radius:4px;'+
    'font-size:9.5px;font-weight:700;letter-spacing:.05em;background:'+cor+';color:#fff">'+E(txt)+'</span>';
}

/* ---------- 1. LISTA DE EMPRESAS ---------- */
function telaInstalacao(){
  baseSuc();baseUsr();
  if(PRM.alvo)return telaPermUnidade();
  if(INS.nova)return formEmpresaNova();
  if(INS.und)return formUnidade(INS.und.loja,INS.und.suc);
  if(INS.rede)return telaRedeAberta(INS.rede);
  if(!ehPlataforma())return telaRestrita('Empresas Clientes');
  if(!INS.nuvem&&!INS.carregando&&!INS.erro){
    INS.carregando=true;
    carregarEmpresas().then(function(){INS.carregando=false;telaInstalacao();})
      .catch(function(e){INS.carregando=false;INS.erro=(e&&e.message)||'falha ao ler';telaInstalacao();});
  }
  var lista=INS.nuvem?empresasDaNuvem():[];
  $('content').innerHTML='<div class="ctWrap">'+
   '<div class="ctTopo"><h1>'+(ehPlataforma()?'Empresas Clientes':'Minha rede')+'</h1>'+
    '<p>'+(ehPlataforma()
      ?'Cada empresa que usa a Joia é um ambiente separado. Uma nunca enxerga os dados da outra.'
      :'Aqui ficam as unidades da sua rede. Abra a rede para cadastrar uma nova sucursal.')+
    '</p></div>'+
   (INS.erro?'<div class="usrVazio" style="background:#fff;border:1px solid var(--line);border-radius:10px">'+
      '<b>Não consegui ler as empresas</b><span>'+E(INS.erro)+'</span>'+
      '<div style="margin-top:12px"><button class="btnP2" onclick="INS.erro=\'\';INS.nuvem=null;telaInstalacao()">'+
      'Tentar de novo</button></div></div>':'')+
   (INS.carregando?'<div class="usrVazio"><b>Carregando as empresas…</b></div>':'')+
   '<div class="ctGrade">'+
    lista.map(function(x){
      var l=x.loja,ct=x.contrato||{},m=x.matriz||{};
      return '<div class="ctCard rdCard" onclick="INS.rede=\''+l.id+'\';telaInstalacao()">'+
       '<div class="ctCardH"><b>'+E(l.nome)+'</b>'+
        '<span>'+E(m.cnpj||ct.documento||'sem CNPJ informado')+'</span></div>'+
       '<div class="ctCardB">'+
        ctLinha('Unidades',x.unidades.length+(x.filiais.length?' ('+x.filiais.length+' filial(is))':''))+
        ctLinha('Acessos',String(x.perfis.length))+
        (ehPlataforma()?ctLinha('Mensalidade',moeda(x.total)):'')+
        ctLinha('Situação',l.ativa!==false
          ?'<span class="badge2">'+E(ct.situacao||'ativo')+'</span>'
          :'<span class="badge2 rd">bloqueada</span>')+
        '<div class="hint" style="margin-top:8px">clique para abrir</div>'+
       '</div></div>';
    }).join('')+
    ((INS.nuvem&&ehPlataforma())?'<div class="ctCard rdCard rdNova" onclick="novaEmpresa()"><div class="ctCardB" '+
     'style="display:flex;align-items:center;justify-content:center;min-height:120px;gap:8px">'+
     sv('plus',16)+'<b>Cadastrar nova empresa</b></div></div>':'')+
   '</div></div>';
  rodape(INS.nuvem?lista.length+' empresa(s)':'');
}
/* ==========================================================
   EXCLUIR UMA EMPRESA INTEIRA
   Isto apaga a rede toda no banco. Tres barreiras, nesta ordem:
   1. so o dono da plataforma chega aqui;
   2. a tela MOSTRA ANTES o que sera apagado, contado no banco — ninguem
      deveria descobrir que eram 250 insumos e 6 meses de venda depois;
   3. o nome da empresa tem de ser digitado igual; quem esta so clicando
      rapido para de clicar aqui.
   A empresa em que voce esta logado nao pode ser apagada — seria arrancar
   o chao de onde se esta pisando.
   ========================================================== */
async function excluirEmpresa(lojaId){
  if(!ehPlataforma()){ toast('Só o administrador da plataforma faz isso.'); return; }
  if(lojaId===NUVEM.loja){
    await confirmar({titulo:'Esta é a empresa aberta agora',
      texto:'Não dá para apagar a empresa em que você está trabalhando.',
      aviso:'Volte para a conta da plataforma e tente de novo.',
      ok:'Entendi',cancelar:null});
    return;
  }
  var res;
  try{
    res=await api('rpc/empresa_resumo','POST',{p_loja:lojaId});
  }catch(e){ painelErro('Não consegui ler o que existe nesta empresa.',detalheErro(e)); return; }
  var r=Array.isArray(res)?res[0]:res;
  if(!r||r.erro){ toast('Empresa não encontrada.'); return; }

  var tb=r.tabelas||{};
  var nomes={insumos:'ingredientes',fichas_tecnicas:'fichas técnicas',produtos:'produtos',
    pedidos:'vendas',lancamentos_financeiros:'lançamentos financeiros',
    clientes:'clientes',movimentacoes_estoque:'movimentações de estoque',
    sucursais:'unidades',usuarios_sistema:'acessos',caixas:'caixas'};
  var linhas=Object.keys(tb).sort(function(a,b){return tb[b]-tb[a]})
    .slice(0,10).map(function(k){
      return [nomes[k]||k.replace(/_/g,' '), String(tb[k]), ''];
    });
  var total=Object.keys(tb).reduce(function(a,k){return a+Number(tb[k]||0)},0);

  var ok=await confirmar({
    titulo:'Excluir "'+(r.nome||'')+'"?',
    texto:'Isto apaga '+total+' registro(s) desta empresa. Não tem como desfazer.',
    linhas:linhas,
    aviso:'Na próxima tela você digita o nome da empresa para confirmar.',
    ok:'Continuar', tipo:'perigo'
  });
  if(!ok)return;

  var digitado=prompt('Para confirmar, digite exatamente o nome da empresa:\n\n'+
    (r.nome||''));
  if(digitado===null)return;

  var out;
  try{
    out=await api('rpc/empresa_excluir','POST',
      {p_loja:lojaId,p_nome_confirma:digitado});
  }catch(e){ painelErro('Não consegui excluir a empresa.',detalheErro(e)); return; }
  var o=Array.isArray(out)?out[0]:out;
  if(!o||!o.ok){
    await confirmar({titulo:'Não excluí',texto:(o&&o.erro)||'O banco recusou.',
      aviso:'Nada foi apagado.',ok:'Entendi',cancelar:null});
    return;
  }
  /* tira tambem da carteira, senao a empresa some do banco e continua
     aparecendo na lista de clientes */
  baseCN();
  DB.clientesNexor=(DB.clientesNexor||[]).filter(function(x){
    return String(x.rede||'').toLowerCase()!==String(o.nome||'').toLowerCase(); });
  salvar();
  INS.rede=null; INS.nuvem=null;
  toast('Empresa "'+o.nome+'" excluída — '+o.registros+' registro(s).');
  telaInstalacao();
}
function telaRestrita(tit){
  $('content').innerHTML='<div class="ctWrap"><div class="ctTopo"><h1>'+E(tit)+'</h1>'+
   '<p>Esta tela pertence à administração da Joia.</p></div>'+
   '<div class="usrVazio" style="background:#fff;border:1px solid var(--line);border-radius:10px">'+
   '<b>Área restrita</b><span>Só o administrador da plataforma acessa esta parte.</span></div></div>';
  rodape();
}

/* ---------- 2. A EMPRESA POR DENTRO ---------- */
function telaRedeAberta(id){
  var x=empresaPorId(id);
  if(!x)return (INS.rede=null,telaInstalacao());
  var l=x.loja,ct=x.contrato||{},m=x.matriz;
  function linhaUnidade(s){
    var venc=s.dia_vencimento?('dia '+s.dia_vencimento):'—';
    return '<tr'+(s.ativa===false?' style="opacity:.55"':'')+'>'+
     '<td><b>'+E(s.nome)+'</b>'+(s.matriz?selo('MATRIZ','#1F5F8B'):'')+
       (s.apelido&&s.apelido!==s.nome?'<div class="hint">'+E(s.apelido)+'</div>':'')+'</td>'+
     '<td>'+E(s.cnpj||'—')+'</td>'+
     '<td>'+E(s.cidade||'—')+(s.uf?'/'+E(s.uf):'')+'</td>'+
     (ehPlataforma()?'<td style="text-align:right">'+(s.mensalidade?moeda(s.mensalidade):'—')+
       '<div class="hint">'+venc+'</div></td>':'')+
     '<td style="text-align:center">'+(s.ativa!==false?'<span class="badge2">Ativa</span>'
        :'<span class="badge2 rd">Inativa</span>')+'</td>'+
     '<td><div class="rowAct">'+
      '<button class="rBtn" title="Editar" onclick="formUnidade(\''+l.id+'\',\''+s.id+'\')">'+sv('edit',12)+'</button>'+
      '<button class="rBtn'+(s.ativa!==false?' rd':'')+'" title="'+(s.ativa!==false?'Desativar':'Reativar')+'" '+
        'onclick="mudarSituacaoUnidade(\''+s.id+'\','+(s.ativa!==false?'false':'true')+')">'+
        sv(s.ativa!==false?'lock':'check',12)+'</button>'+
     '</div></td></tr>';
  }
  $('content').innerHTML='<div class="ctWrap">'+
   '<div class="ctTopo">'+
    '<button class="btnP2" onclick="INS.rede=null;INS.und=null;ACS.edit=null;telaInstalacao()">‹ '+
      (ehPlataforma()?'todas as empresas':'voltar')+'</button>'+
    '<h1 style="margin-top:10px">'+E(l.nome)+'</h1>'+
    '<p>'+E((m&&(m.cidade||''))||'')+(m&&m.uf?'/'+E(m.uf):'')+
      ' · '+x.unidades.length+' unidade(s)'+
      (ehPlataforma()?' · '+moeda(x.total)+'/mês':'')+'</p></div>'+

   (ehPlataforma()?
   '<div class="blk" style="max-width:900px">'+
    '<div class="acTit">Contrato com a Joia</div>'+
    ctLinha('Responsável',E(ct.responsavel||'—'))+
    ctLinha('E-mail',E(ct.email||'—'))+
    ctLinha('Telefone',E(ct.telefone||'—'))+
    ctLinha('Plano',E(ct.plano||'—'))+
    ctLinha('Mensalidade total','<b>'+moeda(x.total)+'</b> (soma das unidades ativas)')+
    ctLinha('Situação',E(ct.situacao||'ativo'))+
    '<div class="zonaPerigo">'+
     '<div><b>Excluir esta empresa</b>'+
      '<span>Apaga a rede inteira: unidades, cadastros, estoque, vendas e '+
      'financeiro. Não tem como desfazer pela tela.</span></div>'+
     '<button class="btnP2 rdB" onclick="excluirEmpresa(\''+l.id+'\')">'+
      sv('trash',13)+' Excluir empresa</button>'+
    '</div>'+
   '</div>':'')+

   '<div class="blk" style="max-width:900px;margin-top:12px">'+
    '<div class="acTit">Matriz e sucursais ('+x.unidades.length+')</div>'+
    '<div class="etTabW plano2"><table class="etTab semBusca"><thead><tr>'+
     '<th>Unidade</th><th style="width:160px">CNPJ</th><th style="width:170px">Cidade</th>'+
     (ehPlataforma()?'<th style="width:130px;text-align:right">Mensalidade</th>':'')+
     '<th style="width:90px;text-align:center">Situação</th><th style="width:80px"></th>'+
    '</tr></thead><tbody>'+
    (m?linhaUnidade(m):'')+x.filiais.map(linhaUnidade).join('')+
    '</tbody></table></div>'+
    '<div style="margin-top:12px"><button class="btnP2 ok" onclick="formUnidade(\''+l.id+'\')">'+
      sv('plus',13)+' Cadastrar sucursal</button></div>'+
   '</div>'+

   '<div class="blk" style="max-width:900px;margin-top:12px">'+
    '<div class="acTit">Acessos ('+x.perfis.length+')</div>'+
    (x.perfis.length?'<div class="etTabW plano2"><table class="etTab semBusca"><thead><tr>'+
      '<th>Nome</th><th style="width:230px">Login</th><th style="width:150px">Papel</th>'+
      '<th style="width:170px">Unidade</th><th style="width:60px"></th></tr></thead><tbody>'+
      x.perfis.map(function(p){
        return '<tr><td><b>'+E(p.nome||'—')+'</b></td>'+
         '<td>'+E(p.email||'—')+'</td>'+
         '<td>'+E(p.cargo==='admin'?'Administrador':(p.cargo||'—'))+'</td>'+
         '<td>'+E(p.unidade||'empresa inteira')+'</td>'+
         '<td style="white-space:nowrap">'+
          '<button class="rBtn" title="Editar acesso" '+
           'onclick="ACS.edit=\''+p.id+'\';telaInstalacao()">'+sv('edit',12)+'</button> '+
          '<button class="rBtn rdB" title="Excluir acesso" '+
           'onclick="excluirAcessoEmpresa(\''+p.id+'\',\''+E(p.email||'')+'\')">'+
           sv('trash',12)+'</button></td></tr>';
      }).join('')+'</tbody></table></div>'
     :'<div class="hint vr">Nenhum acesso criado. Esta empresa ainda não consegue entrar.</div>')+
    (ACS.edit?formEditarAcesso(x):'')+
    (ACS.edit?'':'<div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--line-2)">'+
     '<b style="font-size:13px">Criar o acesso da franqueadora</b>'+
     '<p class="hint" style="margin:4px 0 10px">Aqui nasce <b>um</b> acesso: o da '+
     'franqueadora, que enxerga a empresa inteira. Os acessos das unidades — gerente, '+
     'caixa, operador — quem cria é a própria franqueadora, em Configuração da Loja › '+
     'Usuários e Permissões. Assim cada rede cuida da própria equipe.</p>'+
     '<div class="grid2">'+
      '<div class="fld2"><label>Nome</label><input id="acNome" placeholder="Ex.: '+E(l.nome)+' — Matriz"></div>'+
      '<div class="fld2"><label>E-mail (login) *</label><input id="acMail" placeholder="nome@empresa.com"></div>'+
      '<div class="fld2"><label>Senha *</label><input id="acSenha" type="text" placeholder="mínimo 6 caracteres"></div>'+
      '<input type="hidden" id="acCargo" value="admin">'+
      '<input type="hidden" id="acSuc" value="">'+
     '</div>'+
     '<div style="margin-top:10px"><button class="btnP2 ok" onclick="criarAcessoEmpresa(\''+l.id+'\')">'+
      'Criar acesso</button></div>'+
    '</div>')+
   '</div>'+
   '<div style="max-width:900px;margin:12px 0 40px">'+
    ((m&&ehPlataforma())?'<button class="btnP2" onclick="PRM.loja=\''+l.id+'\';PRM.alvo=\''+m.id+'\';PRM.pend={};'+
      'telaPermUnidade()">'+sv('lock',13)+' Definir o que esta empresa pode usar</button>':'')+
    '</div>'+
   '</div>';
  rodape(E(l.nome)+' · '+x.unidades.length+' unidade(s)');
}
async function mudarSituacaoUnidade(sucId,ativa){
  var txt=ativa?'Reativar esta unidade?':
    'Desativar esta unidade?\n\nO acesso dela para de entrar. Nenhuma venda, lançamento ou '+
    'histórico é apagado — só o login é bloqueado.';
  if(!await pergunta(txt))return;
  try{
    await api('rpc/painel_situacao_unidade','POST',{p_sucursal_id:sucId,p_ativa:!!ativa});
    INS.nuvem=null;await carregarEmpresas(true);
    toast(ativa?'Unidade reativada.':'Unidade desativada. O histórico foi preservado.');
    telaInstalacao();
  }catch(e){ painelErro('Não consegui mudar a situação da unidade.',detalheErro(e)); }
}

/* ---------- 3. CADASTRO DE EMPRESA ---------- */
function novaEmpresa(){ INS.nova=true;INS.rede=null;INS.und=null;telaInstalacao(); }
function cmp(rot,idc,val,ph,larg){
  return '<div class="fld2"'+(larg?' style="grid-column:1/-1"':'')+'><label>'+rot+'</label>'+
    '<input id="'+idc+'" value="'+E(val==null?'':String(val))+'" placeholder="'+E(ph||'')+'"></div>';
}
function formEmpresaNova(){
  $('content').innerHTML='<div class="ctWrap">'+
   '<div class="ctTopo">'+
    '<button class="btnP2" onclick="INS.nova=false;telaInstalacao()">‹ todas as empresas</button>'+
    '<h1 style="margin-top:10px">Cadastrar nova empresa</h1>'+
    '<p>A primeira unidade criada é sempre a <b>matriz</b>. Se a empresa tiver só uma loja, '+
    'é só ela — filiais você cadastra depois, dentro dela.</p></div>'+
   '<div class="blk" style="max-width:900px"><div class="acTit">Identificação</div>'+
    '<div class="grid2">'+
     cmp('Nome da empresa *','nvNome','','como aparece no sistema',true)+
     cmp('Razão social','nvRazao','')+
     cmp('Nome fantasia','nvFant','')+
     cmp('CNPJ','nvDoc','','00.000.000/0000-00')+
    '</div></div>'+
   '<div class="blk" style="max-width:900px;margin-top:12px"><div class="acTit">Responsável</div>'+
    '<div class="grid2">'+
     cmp('Nome do responsável','nvResp','','quem assina o contrato')+
     cmp('E-mail','nvMail','')+
     cmp('Telefone','nvTel','')+
    '</div></div>'+
   '<div class="blk" style="max-width:900px;margin-top:12px"><div class="acTit">Endereço da matriz</div>'+
    '<div class="grid2">'+
     cmp('Endereço','nvEnd','','rua, avenida',true)+
     cmp('Número','nvNum','')+
     cmp('Complemento','nvComp','')+
     cmp('CEP','nvCep','','00000-000')+
     cmp('Cidade','nvCid','')+
     cmp('Estado','nvUf','','SP')+
    '</div></div>'+
   '<div class="blk" style="max-width:900px;margin-top:12px"><div class="acTit">Assinatura da matriz</div>'+
    '<p class="hint" style="margin:0 0 10px">A cobrança é <b>por unidade</b>. Este é o valor da matriz; '+
    'cada sucursal terá o seu, e o total da empresa é a soma.</p>'+
    '<div class="grid2">'+
     cmp('Plano contratado','nvPlano','','Ex.: Franquia, Loja única')+
     cmp('Valor da mensalidade','nvMens','','0,00')+
     cmp('Dia do vencimento','nvVenc','10','10')+
     '<div class="fld2"><label>Situação</label><select id="nvSit">'+
      '<option value="ativo">Ativo</option><option value="teste">Em teste</option>'+
      '<option value="inadimplente">Inadimplente</option>'+
      '<option value="inativo">Inativo</option></select></div>'+
    '</div></div>'+
   '<div class="blk" style="max-width:900px;margin-top:12px"><div class="acTit">Acesso da matriz</div>'+
    '<p class="hint" style="margin:0 0 10px">O login que a empresa vai usar para entrar. '+
    'Deixando em branco, a empresa é criada sem acesso e você cria depois.</p>'+
    '<div class="grid2">'+
     cmp('E-mail (login)','nvLogin','','matriz@empresa.com')+
     cmp('Senha inicial','nvSenha','','mínimo 6 caracteres')+
    '</div></div>'+
   '<div style="max-width:900px;margin:14px 0 40px;display:flex;gap:8px">'+
    '<button class="btnP2 ok" onclick="salvarEmpresaNova()">Salvar empresa</button>'+
    '<button class="btnP2" onclick="INS.nova=false;telaInstalacao()">Cancelar</button>'+
   '</div></div>';
  rodape('nova empresa cliente');
}
async function salvarEmpresaNova(){
  var nome=vlr('nvNome');
  if(!nome){painelErro('Informe o nome da empresa.');var e0=$('nvNome');if(e0)e0.focus();return;}
  var login=vlr('nvLogin').toLowerCase(), senha=vlr('nvSenha');
  if(login&&senha.length<6){painelErro('A senha inicial precisa ter ao menos 6 caracteres.');return;}
  var emp={nome:nome,razao_social:vlr('nvRazao'),nome_fantasia:vlr('nvFant'),documento:vlr('nvDoc'),
    responsavel:vlr('nvResp'),email:vlr('nvMail'),telefone:vlr('nvTel'),
    cidade:vlr('nvCid'),uf:vlr('nvUf'),plano:vlr('nvPlano'),
    dia_vencimento:vlr('nvVenc'),situacao:vlr('nvSit'),ativa:vlr('nvSit')!=='inativo'};
  var und={nome:nome,endereco:vlr('nvEnd'),numero:vlr('nvNum'),complemento:vlr('nvComp'),
    cep:vlr('nvCep'),mensalidade:vlr('nvMens').replace(/\./g,'').replace(',','.'),
    cobranca_situacao:vlr('nvSit')};
  try{
    toast('Cadastrando '+nome+'…');
    var r=await api('rpc/painel_criar_empresa_completa','POST',{p_emp:emp,p_und:und});
    var ljId=(r&&(r.loja_id||(r[0]||{}).loja_id))||null;
    if(login&&ljId){
      var er=await criarAcesso(ljId,{nome:nome+' — Matriz',email:login,senha:senha,
        cargo:'admin',sucursal_ref:''});
      if(er){painelErro('A empresa foi criada, mas o acesso não.',er);}
    }
    INS.nuvem=null;await carregarEmpresas(true);
    INS.nova=false;INS.rede=ljId;
    toast(nome+' cadastrada.');telaInstalacao();
  }catch(e){ console.error('salvarEmpresaNova',e);
    painelErro('Não consegui cadastrar a empresa.',detalheErro(e)); }
}

/* ---------- 4. CADASTRO DE UNIDADE ---------- */
function formUnidade(lojaId,sucId){
  var x=empresaPorId(lojaId);
  if(!x)return (INS.und=null,INS.rede=null,telaInstalacao());
  var s=(x.unidades||[]).find(function(y){return y.id===sucId})||{};
  var primeira=!x.unidades.length;
  INS.und={loja:lojaId,suc:sucId||null};
  $('content').innerHTML='<div class="ctWrap">'+
   '<div class="ctTopo">'+
    '<button class="btnP2" onclick="INS.und=null;telaInstalacao()">‹ voltar para '+E(x.loja.nome)+'</button>'+
    '<h1 style="margin-top:10px">'+(sucId?'Editar unidade':'Cadastrar sucursal')+
      (s.matriz?selo('MATRIZ','#1F5F8B'):(primeira?selo('SERÁ A MATRIZ','#1F5F8B'):''))+'</h1>'+
    '<p>'+(s.matriz?'Esta é a matriz — ela não pode ser desativada enquanto houver filial ativa.'
      :'A sucursal pertence à mesma empresa da matriz. Não é um cliente novo da Nexor.')+'</p></div>'+
   '<div class="blk" style="max-width:900px"><div class="acTit">Identificação</div>'+
    '<div class="grid2">'+
     cmp('Nome da unidade *','unNome',s.nome,'',true)+
     cmp('Apelido','unApe',s.apelido,'como aparece nos relatórios')+
     cmp('Razão social','unRazao',s.razao_social)+
     cmp('Nome fantasia','unFant',s.nome_fantasia)+
     cmp('CNPJ','unCnpj',s.cnpj,'00.000.000/0000-00')+
    '</div></div>'+
   '<div class="blk" style="max-width:900px;margin-top:12px"><div class="acTit">Contato</div>'+
    '<div class="grid2">'+
     cmp('Responsável','unResp',s.responsavel)+
     cmp('E-mail','unMail',s.email)+
     cmp('Telefone','unTel',s.telefone)+
    '</div></div>'+
   '<div class="blk" style="max-width:900px;margin-top:12px"><div class="acTit">Endereço</div>'+
    '<div class="grid2">'+
     cmp('Endereço','unEnd',s.endereco,'',true)+
     cmp('Número','unNum',s.numero)+
     cmp('Complemento','unComp',s.complemento)+
     cmp('CEP','unCep',s.cep,'00000-000')+
     cmp('Cidade','unCid',s.cidade)+
     cmp('Estado','unUf',s.uf,'SP')+
    '</div></div>'+
   '<div class="blk" style="max-width:900px;margin-top:12px"><div class="acTit">Cobrança desta unidade</div>'+
    '<div class="grid2">'+
     cmp('Plano','unPlano',s.plano)+
     cmp('Valor da mensalidade','unMens',s.mensalidade,'0,00')+
     cmp('Dia do vencimento','unVenc',s.dia_vencimento,'10')+
     '<div class="fld2"><label>Cobrança</label><select id="unCobr">'+
      ['ativo','teste','inadimplente','inativo'].map(function(v){
        return '<option value="'+v+'"'+((s.cobranca_situacao||'ativo')===v?' selected':'')+'>'+v+'</option>';
      }).join('')+'</select></div>'+
     '<div class="fld2"><label>Situação da unidade</label><select id="unAtiva">'+
      '<option value="1"'+(s.ativa!==false?' selected':'')+'>Ativa</option>'+
      '<option value="0"'+(s.ativa===false?' selected':'')+'>Inativa</option></select></div>'+
    '</div></div>'+
   (sucId?'':'<div class="blk" style="max-width:900px;margin-top:12px">'+
    '<div class="acTit">Acesso desta unidade</div>'+
    '<p class="hint" style="margin:0 0 10px">Opcional. Cria um login de gerente já preso a esta unidade.</p>'+
    '<div class="grid2">'+cmp('E-mail (login)','unLogin','','')+cmp('Senha inicial','unSenha','','mínimo 6')+
     '<div class="fld2"><label>Papel</label><select id="unCargo">'+
      '<option value="admin">Administra a própria loja</option>'+
      '<option value="gerente">Só opera — não cadastra usuários</option>'+
     '</select></div>'+
    '</div>'+
    '<p class="hint" style="margin:8px 0 0">Administrando a própria loja, ela cadastra '+
    'caixa, produção e o resto da equipe sem depender da matriz — sempre dentro do que '+
    'a matriz liberou, e sem enxergar outra unidade.</p></div>')+
   '<div style="max-width:900px;margin:14px 0 40px;display:flex;gap:8px">'+
    '<button class="btnP2 ok" onclick="salvarUnidade()">Salvar unidade</button>'+
    '<button class="btnP2" onclick="INS.und=null;telaInstalacao()">Cancelar</button>'+
   '</div></div>';
  rodape();
}
async function salvarUnidade(){
  var c=INS.und||{};
  var d={nome:vlr('unNome'),apelido:vlr('unApe'),razao_social:vlr('unRazao'),
    nome_fantasia:vlr('unFant'),cnpj:vlr('unCnpj'),responsavel:vlr('unResp'),
    email:vlr('unMail'),telefone:vlr('unTel'),endereco:vlr('unEnd'),numero:vlr('unNum'),
    complemento:vlr('unComp'),cep:vlr('unCep'),cidade:vlr('unCid'),uf:vlr('unUf'),
    plano:vlr('unPlano'),mensalidade:vlr('unMens').replace(/\./g,'').replace(',','.'),
    dia_vencimento:vlr('unVenc'),cobranca_situacao:vlr('unCobr'),
    ativa:vlr('unAtiva')==='1'};
  if(!d.nome){painelErro('Informe o nome da unidade.');return;}
  try{
    var r=await api('rpc/painel_salvar_unidade','POST',
      {p_loja_id:c.loja,p_sucursal_id:c.suc||null,p_d:d});
    var ref=(r&&(r.ref_local||(r[0]||{}).ref_local))||'';
    var login=vlr('unLogin').toLowerCase(), senha=vlr('unSenha');
    if(login&&!c.suc){
      if(senha.length<6){painelErro('Unidade salva, mas a senha do acesso precisa de 6 caracteres.');}
      else{
        /* ==========================================================
           A LOJA NASCE ADMINISTRANDO A SI MESMA
           Antes o acesso criado junto com a unidade nascia 'gerente', e
           gerente nao cria usuario (regra de RBAC). Na pratica a loja
           recebia o login e nao conseguia cadastrar o proprio caixa nem o
           pessoal da producao — tinha de pedir para a matriz cada vez.
           Quem opera a loja administra a equipe da loja. Continua limitado
           ao que a matriz liberou para ela, e continua sem enxergar
           qualquer outra unidade.
           ========================================================== */
        var er=await criarAcesso(c.loja,{nome:d.nome,email:login,senha:senha,
          cargo:vlr('unCargo')||'admin',sucursal_ref:ref});
        if(er)painelErro('Unidade salva, mas o acesso não foi criado.',er);
      }
    }
    INS.nuvem=null;await carregarEmpresas(true);
    INS.und=null;toast('Unidade salva.');telaInstalacao();
  }catch(e){ console.error('salvarUnidade',e);
    painelErro('Não consegui salvar a unidade.',detalheErro(e)); }
}

/* ==========================================================
   CENTRAL DE DIAGNOSTICO — so o dono da Joia
   O erro tecnico sai da tela do caixa e vem para ca. Aqui aparece o que o
   operador nunca deveria ler: tabela, codigo do banco, tentativa, empresa,
   unidade e horario.
   ========================================================== */
var DG={filtro:'',area:''};
/* ==========================================================
   AUDITORIA DA FILA DESTE APARELHO
   Classifica cada registro que ainda nao subiu, para saber o que e legitimo
   e o que e lixo de versao antiga. Nao apaga nada sozinho: mostra e deixa a
   decisao com quem esta olhando.
   ========================================================== */
function auditarFila(){
  var r={VALIDA:[],PERMISSAO:[],TENANT_DESCONHECIDO:[],OUTRA_EMPRESA:[],LEGADO:[]};
  try{
    (MAPA||[]).forEach(function(E2){
      var lista=DB[E2.col]; if(!Array.isArray(lista))return;
      var h=(DB._hash&&DB._hash[E2.col])||{};
      lista.forEach(function(x){
        if(!x||typeof x!=='object')return;
        if(h[x.id])return;                       /* ja subiu */
        var item={col:E2.col,tab:E2.tab,id:x.id,
                  nome:x.nome||x.login||x.numero||x.descricao||x.id,
                  criado:x._criadoEm||'—'};
        if(x._tenantDesconhecido)          r.TENANT_DESCONHECIDO.push(item);
        else if(!x._loja)                  r.LEGADO.push(item);
        else if(x._loja!==NUVEM.loja)      r.OUTRA_EMPRESA.push(item);
        else if(RECUSADAS[E2.tab])         r.PERMISSAO.push(item);
        else                               r.VALIDA.push(item);
      });
    });
  }catch(e){ _quieto(e,'auditarFila'); }
  return r;
}
async function limparFilaLegada(){
  var f=auditarFila();
  var alvo=f.LEGADO.concat(f.TENANT_DESCONHECIDO).concat(f.PERMISSAO);
  if(!alvo.length){ toast('Nada a limpar: a fila só tem pendências válidas.'); return; }
  var ok=await confirmar({
    titulo:'Limpar '+alvo.length+' pendência(s) que nunca vão subir',
    texto:'São registros sem empresa de origem, de outra empresa, ou recusados '+
          'por falta de permissão.',
    linhas:[['Sem origem',String(f.LEGADO.length),''],
            ['Empresa desconhecida',String(f.TENANT_DESCONHECIDO.length),''],
            ['Sem permissão',String(f.PERMISSAO.length),'']],
    aviso:'Pendências válidas e registros de outra empresa NÃO são tocados. '+
          'O que for apagado aqui nunca chegou à nuvem.',
    ok:'Limpar',tipo:'perigo'});
  if(!ok)return;
  var n=0;
  alvo.forEach(function(it){
    var lista=DB[it.col]; if(!Array.isArray(lista))return;
    var i=lista.findIndex(function(x){return x&&x.id===it.id});
    if(i>=0){ lista.splice(i,1); n++; }
  });
  gravarLocal();
  registrarFalha('fila','limparFilaLegada',n+' pendência(s) inválida(s) removidas',
    {situacao:'resolvido'});
  toast(n+' pendência(s) removida(s).');
  telaDiagnosticoSistema();
}
/* ==========================================================
   HEALTH CHECK ADMINISTRATIVO (GL-12)

   Regra que manda aqui: NAO FINGIR OK. Cada linha e o resultado de uma
   verificacao de verdade, e o que nao pode ser verificado diz
   "nao verificado" — nunca verde.

   O backup e o exemplo: `wal_level` e `archive_mode` sao lidos do banco
   e provam que a base para PITR existe. Plano, frequencia e retencao
   vivem no painel de billing, fora do alcance do sistema — entao a
   linha diz "não verificado" e aponta onde olhar. Verde ali seria
   mentira confortavel.

   Somente a plataforma ve esta tela. Nenhum secret aparece: chaves,
   tokens e hashes nunca entram no resultado.
   ========================================================== */
var HEALTH={estado:null,rodando:false};
async function rodarHealthCheck(){
  if(HEALTH.rodando)return;
  HEALTH.rodando=true;
  var r={quando:new Date().toLocaleString('pt-BR'),itens:[]};
  var pr=function(nome,situacao,detalhe){r.itens.push({nome:nome,situacao:situacao,detalhe:detalhe||''})};
  var cron=function(t0){return Math.round(performance.now()-t0)+' ms'};

  /* --- versao e build --- */
  pr('Versão instalada','info',VERSAO);
  try{
    var t0=performance.now();
    var res=await fetch('index.html?v='+Date.now(),{cache:'no-store'});
    var txt=await res.text();
    var m=txt.match(/var VERSAO='(V[0-9.]+)'/);
    pr('Versão publicada', m&&m[1]===VERSAO?'ok':'aviso',
       m?(m[1]+(m[1]===VERSAO?' — igual à instalada':' — recarregue a página')):'não consegui ler');
  }catch(e){ pr('Versão publicada','erro','não consegui consultar'); }

  /* --- banco --- */
  if(!NUVEM.ligada){ pr('Banco','erro','sem conexão com a nuvem'); }
  else{
    try{
      var t1=performance.now();
      await api('lojas?select=id&limit=1','GET');
      pr('Banco','ok','respondeu em '+cron(t1));
    }catch(e){ pr('Banco','erro',String((e&&e.message)||e).slice(0,70)); }
  }

  /* --- autenticacao --- */
  try{
    var ses=NUVEM.cli?(await NUVEM.cli.auth.getSession()).data.session:null;
    pr('Autenticação', ses?'ok':'erro',
       ses?('sessão válida até '+new Date(ses.expires_at*1000).toLocaleString('pt-BR'))
          :'sem sessão ativa');
  }catch(e){ pr('Autenticação','erro','não consegui verificar'); }

  /* --- perfil e contexto --- */
  pr('Contexto de unidade', lojaAtualId()?'ok':'erro',
     lojaAtualId()?nomeLojaAtual():'nenhuma unidade ativa');
  pr('Empresa', NUVEM.loja?'ok':'aviso', NUVEM.loja?'vinculada':'não resolvida');

  /* --- sincronizacao --- */
  var pend=(NUVEM.erros||[]).length;
  pr('Sincronização', DB._sujo?'aviso':(pend?'erro':'ok'),
     pend?(pend+' tabela(s) com falha no último envio')
        :(DB._sujo?'há mudanças aguardando envio':'tudo enviado'));

  /* --- WhatsApp (Carla) --- */
  try{
    var t2=performance.now();
    var z=await zapApi('/estado/'+lojaAtualId());
    pr('WhatsApp (Carla)', z&&z.estado==='conectado'?'ok':'aviso',
       (z&&z.estado?z.estado:'sem resposta')+' · '+cron(t2));
  }catch(e){ pr('WhatsApp (Carla)','erro','robô não respondeu'); }

  /* --- backup: so o que da para comprovar --- */
  pr('Backup do provedor','naoverif',
     'plano, frequência e retenção vivem no painel do Supabase — '+
     'Project Settings › Database › Backups');

  HEALTH.estado=r; HEALTH.rodando=false;
  if(S.mod==='sistema')telaDiagnosticoSistema();
  return r;
}
/* ==========================================================
   O QUE ESTA PARADO NA FILA, E POR QUE (V199)

   `auditarFila()` existe desde a V148 e classifica cada registro que
   ainda nao subiu: valido, sem permissao, tenant desconhecido, de
   outra empresa, legado. Mas ela so aparecia num relatorio tecnico que
   ninguem abre.

   Passei tres versoes tentando descobrir por que um produto nao chegava
   ao banco, olhando o codigo de fora. A resposta estava aqui dentro o
   tempo todo — bastava mostrar.

   Junto vai o ultimo erro de cada tabela: quando o banco recusa um
   lote, o motivo fica em `FALHAS` e some da tela em segundos. Aqui ele
   fica.
   ========================================================== */
function pintaFilaPendente(){
  var f,e2;
  try{ f=auditarFila(); }catch(x){ return ''; }
  var total=f.VALIDA.length+f.PERMISSAO.length+f.TENANT_DESCONHECIDO.length+
            f.OUTRA_EMPRESA.length+f.LEGADO.length;
  /* FALHAS e uma lista, com o mais recente na frente */
  var falhas=[];
  try{
    falhas=(FALHAS||[]).slice(0,8).map(function(x){
      return {tab:(x.h||'')+' · '+(x.onde||'?'), msg:String(x.msg||'').slice(0,150)};
    });
  }catch(x){}
  var grupo=function(nome,lista,cor,expl){
    if(!lista.length)return '';
    return '<tr><td style="width:150px"><span class="badge2 '+cor+'">'+nome+'</span>'+
      '<small style="display:block;color:var(--ink-3);margin-top:3px">'+expl+'</small></td>'+
      '<td><b>'+lista.length+' registro(s)</b>'+
      '<small style="display:block;color:var(--ink-3)">'+
      E(lista.slice(0,8).map(function(i){return i.tab+': '+i.nome}).join(' · '))+
      (lista.length>8?' … e mais '+(lista.length-8):'')+'</small></td></tr>';
  };
  if(!total&&!falhas.length)
    return '<div class="blk" style="max-width:none;margin-bottom:12px">'+
      '<h3>Fila de envio</h3><div class="hint">Nada pendente — tudo o que este aparelho '+
      'tem já está na nuvem.</div></div>';
  return '<div class="blk" style="max-width:none;padding:0;margin-bottom:12px">'+
   '<div style="padding:10px 14px;border-bottom:1px solid var(--line);display:flex;'+
   'justify-content:space-between;align-items:center">'+
    '<div><b>Fila de envio</b> <small style="color:var(--ink-3)">'+total+
    ' registro(s) ainda não enviados</small></div>'+
    '<button class="btnP2" onclick="copiarFila()">Copiar para enviar</button></div>'+
   '<table class="fmTab"><tbody>'+
   grupo('AGUARDANDO',f.VALIDA,'am','vai subir na próxima sincronização')+
   grupo('SEM PERMISSÃO',f.PERMISSAO,'rd','o banco recusou — regra de acesso')+
   grupo('SEM EMPRESA',f.TENANT_DESCONHECIDO,'rd','criado antes de a sessão existir')+
   grupo('DE OUTRA EMPRESA',f.OUTRA_EMPRESA,'','fica retido de propósito')+
   grupo('LEGADO',f.LEGADO,'','criado antes do carimbo de origem')+
   (falhas.length?falhas.map(function(x){
     return '<tr><td style="width:150px"><span class="badge2 rd">ERRO NO ENVIO</span>'+
       '<small style="display:block;color:var(--ink-3);margin-top:3px">'+E(x.tab)+'</small></td>'+
       '<td><small>'+E(x.msg)+'</small></td></tr>';
   }).join(''):'')+
   '</tbody></table></div>';
}
function copiarFila(){
  var t2='';
  try{
    t2='JOIA '+VERSAO+' — fila de envio\n'+JSON.stringify(auditarFila(),null,1)+
       '\n\nFALHAS:\n'+JSON.stringify(FALHAS||{},null,1)+
       '\n\nSUMIÇOS:\n'+JSON.stringify((DB._sumicos||[]).slice(0,6),null,1);
  }catch(e){ t2='erro ao montar: '+e.message; }
  try{ navigator.clipboard.writeText(t2); toast('Copiado. Cole na conversa com o suporte.'); }
  catch(e){ try{ prompt('Copie este texto:',t2); }catch(x){ toast('Não consegui copiar.'); } }
}
/* ==========================================================
   O QUE O REGISTRADOR VIU

   Uma tabela do que sumiu, com botao de copiar. E o que a loja manda
   quando o cadastro desaparece — em vez de eu adivinhar de longe.
   ========================================================== */
/* ==========================================================
   CONFERENCIA DO CADASTRO — O QUE VIRA RELATO DE "SUMIU"

   Em 28 e 29/08/2026 o mesmo relato chegou duas vezes: "o produto
   sumiu". Nas duas, nada tinha sumido — havia DUAS categorias com o
   mesmo nome, uma com o produto e outra vazia, e a vazia era a que
   estava sendo aberta.

   Esse tipo de coisa nao aparece em teste nenhum: o codigo esta certo,
   o dado e que esta ambiguo. E so aparece quando ja virou problema na
   loja. Aqui o sistema passa a olhar o proprio cadastro e dizer o que
   esta ambiguo ANTES de alguem tropecar:

   - nome repetido (categoria, produto, insumo, ficha);
   - categoria sem produto nenhum;
   - produto apontando para uma categoria que nao existe;
   - produto que nao esta liberado para unidade nenhuma — ninguem ve.

   Nao conserta nada sozinho, de proposito: dado de cadastro e decisao
   do dono. Ele mostra, com nome e numero, e diz o que fazer.
   ========================================================== */
function conferirCadastro(){
  var achados=[];
  function cmp(x){ return String(x||'').trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,''); }
  function repetidos(col,rotulo){
    var por={},lista=(DB[col]||[]);
    lista.forEach(function(x){
      if(!x||x.ativo===false)return;
      var k=cmp(x.nome); if(!k)return;
      (por[k]=por[k]||[]).push(x);
    });
    Object.keys(por).forEach(function(k){
      if(por[k].length<2)return;
      achados.push({tipo:'nome repetido',grave:true,
        o:rotulo+': '+por[k].length+'x "'+por[k][0].nome+'"',
        faca:'São '+por[k].length+' com o mesmo nome. Abra a Gestão de Cardápio, '+
             'veja qual tem o conteúdo certo e apague ou renomeie as outras.'});
    });
  }
  try{
    repetidos('categorias','Categoria');
    repetidos('produtos','Produto');
    repetidos('insumos','Ingrediente');
    repetidos('fichas','Ficha técnica');
    /* o grupo de ingredientes faltava nesta lista — e foi por isso que
       dez repetidos passaram despercebidos ate alguem abrir o filtro da
       Movimentacao de Estoque e ver a lista dobrada */
    repetidos('gruposIng','Grupo de ingredientes');

    /* grupo sem ingrediente nenhum e o rastro tipico do repetido: os
       itens ficaram todos no outro, e este sobrou vazio no filtro */
    (DB.gruposIng||[]).forEach(function(g){
      if(!g||!g.id)return;
      var n=(DB.insumos||[]).filter(function(i){return i&&i.grupoId===g.id}).length;
      if(!n)achados.push({tipo:'grupo vazio',grave:false,
        o:'Grupo de ingredientes "'+g.nome+'" está sem nenhum item',
        faca:'Ele só ocupa espaço nos filtros de estoque. Mova itens para ele '+
             'ou apague o grupo em Gestão de Estoque › Grupos.'});
    });
    var prods=(DB.produtos||[]).filter(function(p){return p&&p.ativo!==false});
    (DB.categorias||[]).forEach(function(c){
      if(!c||c.ativo===false)return;
      var n=prods.filter(function(p){return p.categoriaId===c.id}).length;
      if(!n)achados.push({tipo:'categoria vazia',grave:false,
        o:'Categoria "'+c.nome+'" está sem nenhum produto',
        faca:'Ela não aparece na frente de caixa enquanto estiver vazia. '+
             'Cadastre um produto nela ou apague a categoria.'});
    });
    prods.forEach(function(p){
      var c=(DB.categorias||[]).find(function(x){return x.id===p.categoriaId});
      if(!c)achados.push({tipo:'sem categoria',grave:true,
        o:'Produto "'+p.nome+'" aponta para uma categoria que não existe',
        faca:'Abra o produto e escolha a categoria dele — assim ele volta a aparecer.'});
      if(p.sucursais&&p.sucursais.length===0)
        achados.push({tipo:'sem unidade',grave:true,
          o:'Produto "'+p.nome+'" não está liberado para nenhuma unidade',
          faca:'Abra o produto e marque as unidades que podem vendê-lo.'});
    });
  }catch(e){ _quieto(e,'conferirCadastro'); }
  return achados;
}
function pintaCadastro(){
  var l=[];
  try{ l=conferirCadastro(); }catch(e){ _quieto(e,'pintaCadastro'); }
  if(!l.length)return '<div class="blk" style="max-width:none;margin-bottom:12px">'+
    '<h3>Conferência do cadastro</h3><div class="hint">Nenhum nome repetido, '+
    'nenhuma categoria vazia, nenhum produto solto. É daqui que costuma sair '+
    'o relato de "o produto sumiu".</div></div>';
  var graves=l.filter(function(x){return x.grave}).length;
  return '<div class="blk" style="max-width:none;padding:0;margin-bottom:12px">'+
   '<div style="padding:10px 14px;border-bottom:1px solid var(--line)">'+
    '<b>Conferência do cadastro</b> '+
    '<small style="color:var(--ink-3)">'+l.length+' ponto(s) para olhar'+
    (graves?' · '+graves+' que confundem quem usa':'')+'</small></div>'+
   '<table class="fmTab"><thead><tr><th style="width:130px">O quê</th>'+
   '<th>Onde</th><th style="width:38%">O que fazer</th></tr></thead><tbody>'+
   l.slice(0,40).map(function(x){
     return '<tr><td><b class="'+(x.grave?'vr':'')+'">'+E(x.tipo)+'</b></td>'+
      '<td>'+E(x.o)+'</td><td><small>'+E(x.faca)+'</small></td></tr>';
   }).join('')+'</tbody></table></div>';
}
function pintaSumicos(){
  var l=(DB._sumicos||[]);
  if(!l.length)return '<div class="blk" style="max-width:none;margin-bottom:12px">'+
    '<h3>Registro de sumiços</h3><div class="hint">Nada sumiu desde que este aparelho '+
    'foi aberto. Se um cadastro desaparecer, ele aparece aqui com a hora e o motivo.</div></div>';
  return '<div class="blk" style="max-width:none;padding:0;margin-bottom:12px">'+
   '<div style="padding:10px 14px;border-bottom:1px solid var(--line);display:flex;'+
   'justify-content:space-between;align-items:center">'+
    '<div><b>Registro de sumiços</b> <small style="color:var(--ink-3)">'+l.length+
    ' ocorrência(s)</small></div>'+
    '<button class="btnP2" onclick="copiarSumicos()">Copiar para enviar</button></div>'+
   '<table class="fmTab"><tbody>'+l.slice(0,12).map(function(s2){
     return '<tr><td style="width:130px"><b>'+E(s2.quando)+'</b>'+
       '<small style="display:block;color:var(--ink-3)">'+E(s2.col)+'</small></td>'+
       '<td style="width:110px">'+s2.de+' → '+s2.para+
       '<small style="display:block;color:var(--red)">'+(s2.de-s2.para)+' sumiram</small></td>'+
       '<td><b>'+E(s2.motivo)+'</b>'+
       '<small style="display:block;color:var(--ink-3)">unidade: '+E(String(s2.unidade))+
       ' · matriz: '+E(String(s2.matriz))+'</small>'+
       '<small style="display:block;color:var(--ink-3)">'+
       E((s2.itens||[]).map(function(i){return i.nome+' ['+i.suc+']'}).join(' · '))+
       '</small></td></tr>';
   }).join('')+'</tbody></table></div>';
}
function copiarSumicos(){
  var t='JOIA '+VERSAO+' — registro de sumiços\n'+
    JSON.stringify(DB._sumicos||[],null,1);
  try{
    navigator.clipboard.writeText(t);
    toast('Copiado. Cole na conversa com o suporte.');
  }catch(e){
    try{ prompt('Copie este texto:',t); }catch(x){ toast('Não consegui copiar.'); }
  }
}
/* ==========================================================
   A LIBERACAO POR UNIDADE ESTA MESMO FUNCIONANDO? (V202)

   `liberacoesQuebradas()` existia desde a V188 e nunca foi chamada por
   ninguem — estava entre as 42 funcoes orfas do MAPA.md. Ela responde
   exatamente a pergunta que mais deu dor de cabeca: "marquei a unidade
   no cadastro, e a loja continua sem ver".

   Quando um cadastro nao sincroniza a coluna `sucursais`, a marcacao e
   feita na tela, guardada no aparelho, e desaparece no primeiro
   download — porque a nuvem nunca soube dela. Da tela, isso parece
   exatamente "o botao nao funciona".

   Agora a resposta aparece, com o nome do cadastro e o motivo, em vez
   de virar meia hora procurando no lugar errado.
   ========================================================== */
function pintaLiberacoes(){
  var fora=[];
  try{ fora=liberacoesQuebradas()||[]; }catch(e){ _quieto(e,'pintaLiberacoes'); return ''; }
  if(!fora.length)
    return '<div class="blk" style="max-width:none;margin-bottom:12px">'+
      '<b>Liberação por unidade</b> '+
      '<small style="color:var(--ink-3)">os cadastros liberáveis sobem e descem '+
      'com a marcação de unidade — nada quebrado</small></div>';
  return '<div class="blk" style="max-width:none;padding:0;margin-bottom:12px;overflow:auto">'+
    '<div style="padding:10px 14px;border-bottom:1px solid var(--line)">'+
     '<b class="vr">Liberação por unidade quebrada em '+fora.length+' cadastro(s)</b> '+
     '<small style="color:var(--ink-3)">marcar a unidade nestes não adianta: '+
     'a marcação não chega à nuvem e some no próximo download</small></div>'+
    '<table class="fmTab"><thead><tr><th>Cadastro</th><th style="width:220px">Motivo</th>'+
    '</tr></thead><tbody>'+
    fora.map(function(x){
      return '<tr><td><b>'+E(x.nome||x.col)+'</b> <small style="color:var(--ink-3)">'+
        E(x.col)+'</small></td><td>'+E(x.motivo||'—')+'</td></tr>';
    }).join('')+'</tbody></table></div>';
}
function pintaHealth(){
  var h=HEALTH.estado;
  if(!h)return '<div class="blk" style="max-width:none;margin-bottom:12px">'+
    '<h3>Health check</h3><div class="hint">Confere banco, autenticação, contexto, '+
    'sincronização e robô — cada linha é uma verificação de verdade.</div>'+
    '<button class="btnP2 ok" style="margin-top:10px" onclick="rodarHealthCheck()">'+
    (HEALTH.rodando?'verificando…':'Rodar verificação')+'</button></div>';
  var cor={ok:'gr',aviso:'am',erro:'rd',info:'',naoverif:''};
  var rot={ok:'OK',aviso:'ATENÇÃO',erro:'ERRO',info:'—',naoverif:'NÃO VERIFICADO'};
  return '<div class="blk" style="max-width:none;padding:0;margin-bottom:12px">'+
   '<div style="padding:10px 14px;border-bottom:1px solid var(--line);display:flex;'+
   'justify-content:space-between;align-items:center">'+
    '<div><b>Health check</b> <small style="color:var(--ink-3)">'+E(h.quando)+'</small></div>'+
    '<button class="btnP2" onclick="rodarHealthCheck()">Verificar de novo</button></div>'+
   '<table class="fmTab"><tbody>'+h.itens.map(function(i){
     return '<tr><td style="width:180px"><b>'+E(i.nome)+'</b></td>'+
       '<td style="width:130px"><span class="badge2 '+(cor[i.situacao]||'')+'">'+
       rot[i.situacao]+'</span></td>'+
       '<td><small>'+E(i.detalhe)+'</small></td></tr>';
   }).join('')+'</tbody></table></div>';
}
function telaDiagnosticoSistema(){
  if(!ehPlataforma())return telaRestrita('Diagnóstico do Sistema');
  var L=DIAGNOSTICO.slice();
  if(DG.area)L=L.filter(function(x){return x.area===DG.area});
  if(DG.filtro){
    var q=DG.filtro.toLowerCase();
    L=L.filter(function(x){return (x.onde+' '+x.msg+' '+x.area).toLowerCase().indexOf(q)>=0});
  }
  var areas={};DIAGNOSTICO.forEach(function(x){areas[x.area]=(areas[x.area]||0)+1});
  var pend=DIAGNOSTICO.filter(function(x){return (x.situacao||'').indexOf('pendente')>=0}).length;
  $('content').innerHTML='<div class="ctWrap" style="max-width:none">'+
   '<div class="ctTopo"><h1>Diagnóstico do Sistema</h1>'+
    '<p>Falhas técnicas registradas neste aparelho. Esta tela é sua — o operador '+
    'nunca vê nada disto.</p></div>'+
   '<div class="hpNums" style="border:1px solid var(--line);border-radius:8px;'+
    'overflow:hidden;margin-bottom:12px">'+
    '<div class="hpN"><span>Registros</span><b>'+DIAGNOSTICO.length+'</b></div>'+
    '<div class="hpN"><span>Pendentes</span><b class="'+(pend?'vr':'')+'">'+pend+'</b></div>'+
    '<div class="hpN"><span>Conexão</span><b>'+E(CONEXAO)+'</b></div>'+
    '<div class="hpN"><span>Versão</span><b>'+E(VERSAO)+'</b></div>'+
   '</div>'+
   pintaHealth()+
   pintaLiberacoes()+
   pintaFilaPendente()+
   pintaSumicos()+
   pintaCadastro()+
   (TRAVAS.length?'<div class="blk" style="max-width:none;padding:0;margin-bottom:12px;overflow:auto">'+
     '<div style="padding:10px 14px;border-bottom:1px solid var(--line)">'+
      '<b>O que segurou a tela</b> '+
      '<small style="color:var(--ink-3)">qualquer bloqueio acima de 120 ms, '+
      'venha de onde vier</small></div>'+
     '<table class="fmTab"><thead><tr><th style="width:80px">Hora</th>'+
     '<th style="width:120px">Tipo</th><th>O que foi</th>'+
     '<th style="width:130px">Tela</th>'+
     '<th style="width:90px;text-align:right">Tempo</th></tr></thead><tbody>'+
     TRAVAS.slice(0,25).map(function(t){
       return '<tr><td>'+E(t.hora)+'</td><td><b>'+E(t.tipo)+'</b></td>'+
        '<td><small>'+E(t.detalhe)+'</small></td><td><small>'+E(t.tela)+'</small></td>'+
        '<td style="text-align:right"><b class="'+(t.ms>800?'vr':'')+'">'+
        t.ms+' ms</b></td></tr>';
     }).join('')+'</tbody></table></div>':'')+
   (CRONO.length?'<div class="blk" style="max-width:none;padding:0;margin-bottom:12px;overflow:auto">'+
     '<div style="padding:10px 14px;border-bottom:1px solid var(--line)">'+
      '<b>Quanto cada tela levou</b> '+
      '<small style="color:var(--ink-3)">se “Total” é pequeno e “Utilizável” é '+
      'grande, a demora está depois do desenho — sincronização, normalmente'+
      '</small></div>'+
     '<table class="fmTab"><thead><tr><th>Hora</th><th>Tela</th>'+
     '<th style="text-align:right">Cálculo</th><th style="text-align:right">Desenho</th>'+
     '<th style="text-align:right">Consultas</th><th style="text-align:right">Rede</th>'+
     '<th style="text-align:right">Total</th>'+
     '<th style="text-align:right">Utilizável</th></tr></thead><tbody>'+
     CRONO.slice(0,15).map(function(c){
       var ut=(c.utilizavel===undefined?c.total:c.utilizavel);
       return '<tr><td>'+E(c.hora)+'</td><td>'+E(c.tela)+
        (c.sincronizando?' <small style="color:var(--acc-d)">(sincronizando)</small>':'')+
        '</td>'+
        '<td style="text-align:right">'+c.js+' ms</td>'+
        '<td style="text-align:right">'+c.desenho+' ms</td>'+
        '<td style="text-align:right">'+(c.consultas||0)+'</td>'+
        '<td style="text-align:right">'+(c.rede||0)+' ms</td>'+
        '<td style="text-align:right"><b class="'+(c.total>400?'vr':'')+'">'+
        c.total+' ms</b></td>'+
        '<td style="text-align:right"><b class="'+(ut>2000?'vr':'')+'">'+
        ut+' ms</b></td></tr>';
     }).join('')+'</tbody></table></div>':'')+
   (function(){
     var f=auditarFila();
     var inval=f.LEGADO.length+f.TENANT_DESCONHECIDO.length+f.PERMISSAO.length;
     return '<div class="hpNums" style="border:1px solid var(--line);'+
      'border-radius:8px;overflow:hidden;margin-bottom:12px">'+
      '<div class="hpN"><span>Fila válida</span><b>'+f.VALIDA.length+'</b></div>'+
      '<div class="hpN"><span>Sem permissão</span><b class="'+(f.PERMISSAO.length?'vr':'')+
        '">'+f.PERMISSAO.length+'</b></div>'+
      '<div class="hpN"><span>Sem origem</span><b class="'+(f.LEGADO.length?'vr':'')+
        '">'+f.LEGADO.length+'</b></div>'+
      '<div class="hpN"><span>De outra empresa</span><b>'+f.OUTRA_EMPRESA.length+'</b></div>'+
      '<div class="hpN"><span>Inválidas ao todo</span><b class="'+(inval?'vr':'')+
        '">'+inval+'</b></div></div>';
   })()+
   '<div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;margin-bottom:12px">'+
    '<div class="f2" style="max-width:260px"><label>Buscar</label>'+
     '<input value="'+E(DG.filtro)+'" placeholder="tabela, função ou mensagem" '+
     'oninput="DG.filtro=this.value;clearTimeout(window._tdg);'+
     'window._tdg=setTimeout(telaDiagnosticoSistema,300)"></div>'+
    '<div class="f2"><label>Área</label>'+
     '<select onchange="DG.area=this.value;telaDiagnosticoSistema()">'+
      '<option value="">todas</option>'+
      Object.keys(areas).map(function(a){
        return '<option value="'+E(a)+'"'+(DG.area===a?' selected':'')+'>'+
               E(a||'—')+' ('+areas[a]+')</option>';
      }).join('')+'</select></div>'+
    '<div style="flex:1"></div>'+
    '<button class="btnP2" onclick="limparFilaLegada()">'+sv('trash',12)+
     ' Limpar pendências inválidas</button>'+
    '<button class="btnP2" onclick="encerrarTodasAsSessoes()">'+sv('lock',12)+
     ' Encerrar minhas sessões</button>'+
    '<button class="btnP2" onclick="copiarDiagnostico()">Copiar tudo</button>'+
    '<button class="btnP2 rdB" onclick="DIAGNOSTICO=[];'+
     'try{localStorage.removeItem(\'nexor_diag\')}catch(e){};telaDiagnosticoSistema()">Limpar</button>'+
   '</div>'+
   '<div class="blk" style="max-width:none;padding:0;overflow:auto">'+
    '<table class="fmTab"><thead><tr>'+
     '<th style="width:80px">Hora</th><th style="width:110px">Área</th>'+
     '<th style="width:170px">Onde</th><th>Mensagem</th>'+
     '<th style="width:150px">Empresa</th><th style="width:120px">Unidade</th>'+
     '<th style="width:130px">Usuário</th><th style="width:60px">Tent.</th>'+
     '<th style="width:150px">Situação</th></tr></thead><tbody>'+
    (L.length?L.map(function(x){
      return '<tr><td>'+E(x.hora||'')+'</td><td>'+E(x.area||'—')+'</td>'+
       '<td>'+E(x.onde||'—')+'</td><td><small>'+E(x.msg||'')+'</small></td>'+
       '<td><small>'+E(String(x.loja||'—').slice(0,8))+'</small></td>'+
       '<td><small>'+E(x.unidade||'—')+'</small></td>'+
       '<td><small>'+E(x.usuario||'—')+'</small></td>'+
       '<td style="text-align:center">'+(x.tentativa||1)+'</td>'+
       '<td><span class="pill '+((x.situacao||'').indexOf('pendente')>=0?'rd':'')+'">'+
        E(x.situacao||'—')+'</span></td></tr>';
    }).join(''):'<tr><td colspan="9" class="fmVazio">Nenhuma falha registrada. '+
      'É o que se espera.</td></tr>')+
   '</tbody></table></div></div>';
  rodape(DIAGNOSTICO.length+' registro(s) de diagnóstico');
}
/* ---------- 5. ACESSOS ---------- */
var ACS={edit:null};
function formEditarAcesso(x){
  var p=(x.perfis||[]).find(function(y){return y.id===ACS.edit});
  if(!p){ACS.edit=null;return '';}
  var ult=p.ultimo_acesso?new Date(p.ultimo_acesso).toLocaleString('pt-BR'):'nunca entrou';
  return '<div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--line-2)">'+
   '<b style="font-size:13px">Editar acesso — '+E(p.nome||'')+'</b>'+
   '<p class="hint" style="margin:4px 0 10px">Último acesso: '+E(ult)+'. '+
   '<b>A senha atual não pode ser mostrada</b> — o sistema guarda só o resumo dela, '+
   'e nem o banco consegue lê-la de volta. Para trocar, digite uma nova; deixando em '+
   'branco, a senha continua a mesma.</p>'+
   '<div class="grid2">'+
    cmp('Nome','edNome',p.nome)+
    cmp('E-mail (login)','edMail',p.email)+
    cmp('Nova senha','edSenha','','deixe em branco para não trocar')+
    '<div class="fld2"><label>Papel</label><select id="edCargo">'+
     ['admin','gerente','operador','caixa'].map(function(c){
       return '<option value="'+c+'"'+(p.cargo===c?' selected':'')+'>'+
        (c==='admin'?'Administrador da empresa':c==='gerente'?'Gerente de unidade':c)+'</option>';
     }).join('')+'</select></div>'+
    '<div class="fld2"><label>Unidade</label><select id="edSuc">'+
     '<option value=""'+(!p.sucursal_ref?' selected':'')+'>A empresa inteira</option>'+
     (x.unidades||[]).map(function(s2){
       return '<option value="'+E(s2.ref_local||'')+'"'+
        (p.sucursal_ref===s2.ref_local?' selected':'')+'>'+E(s2.nome)+'</option>';
     }).join('')+'</select></div>'+
   '</div>'+
   '<div style="margin-top:10px;display:flex;gap:8px">'+
    '<button class="btnP2 ok" onclick="salvarAcesso(\'' + x.loja.id + '\',\'' + p.id + '\')">Salvar acesso</button>'+
    '<button class="btnP2" onclick="ACS.edit=null;telaInstalacao()">Cancelar</button>'+
   '</div></div>';
}
async function salvarAcesso(lojaId,perfilId){
  var email=vlr('edMail').toLowerCase(), senha=vlr('edSenha');
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){painelErro('Informe um e-mail válido.');return;}
  if(senha&&senha.length<6){painelErro('A nova senha precisa ter ao menos 6 caracteres.');return;}
  var er=await criarAcesso(lojaId,{perfil_id:perfilId,nome:vlr('edNome')||email,email:email,
    senha:senha,cargo:vlr('edCargo'),sucursal_ref:vlr('edSuc')});
  if(er){painelErro('Não consegui salvar o acesso.',er);return;}
  ACS.edit=null;INS.nuvem=null;await carregarEmpresas(true);
  toast(senha?'Acesso salvo e senha trocada.':'Acesso salvo.');telaInstalacao();
}

/* O Supabase Auth responde em ingles. Quem le a mensagem e o franqueado,
   entao traduzimos as respostas conhecidas. O que nao estiver na lista passa
   como veio: mensagem estranha em ingles ainda e melhor que erro escondido. */
function traduzAuth(m){
  var txt=String(m||'');
  var mapa=[
    [/password is known to be weak|easy to guess|pwned|leaked/i,
     'Essa senha aparece em listas de senhas vazadas na internet e foi recusada. '+
     'Escolha outra — o melhor caminho e juntar tres palavras e um numero, '+
     'sem usar nome, data de nascimento ou sequencia.'],
    [/password should be at least|password.*too short/i,
     'A senha e curta demais. Use pelo menos 6 caracteres.'],
    [/user already registered|already been registered|email.*already/i,
     'Ja existe um acesso com esse e-mail.'],
    [/unable to validate email|invalid email/i,
     'O e-mail digitado nao e valido.'],
    [/invalid login credentials/i, 'E-mail ou senha nao conferem.'],
    [/email rate limit|over_email_send_rate|too many requests|rate limit/i,
     'Muitas tentativas seguidas. Espere alguns minutos e tente de novo.'],
    [/failed to fetch|network|load failed/i,
     'Nao consegui falar com o servidor. Verifique a internet e tente de novo.'],
    [/jwt|session|token/i, 'Sua sessao venceu. Saia e entre de novo no sistema.']
  ];
  for(var i=0;i<mapa.length;i++) if(mapa[i][0].test(txt)) return mapa[i][1];
  return txt;
}
/* devolve null quando deu certo, ou o texto do erro */
async function criarAcesso(lojaId,dados){
  try{
    var r=await fetch(NUVEM.url+'/functions/v1/criar-usuario',{
      method:'POST',
      headers:{'apikey':NUVEM.chave,'Authorization':'Bearer '+(await tokenValido()),
               'Content-Type':'application/json'},
      body:JSON.stringify({email:dados.email,senha:dados.senha,nome:dados.nome,
        cargo:dados.cargo,loja_id:lojaId,sucursal_ref:dados.sucursal_ref||null,
        perfil_id:dados.perfil_id||null})});
    var d=null; try{ d=await r.json(); }catch(e){_quieto(e,'criarAcesso')}
    if(!r.ok)return traduzAuth((d&&d.erro)||('o servidor respondeu '+r.status));
    return null;
  }catch(e){ return traduzAuth((e&&e.message)||'falha de rede'); }
}
/* ==========================================================
   EXCLUIR UM ACESSO DE VERDADE
   Desligar em Usuarios e Permissoes so marca ativo=false: a conta continua
   valendo no Auth. Era dai que vinha a mesma pessoa aparecendo duas vezes
   na lista da Administracao — a conta velha desligada e a nova.
   Aqui sai dos tres lugares: Auth, perfis e usuarios_sistema. A chave de
   administrador do banco fica na funcao do servidor; o navegador so pede.
   ========================================================== */
async function excluirAcessoEmpresa(perfilId,email){
  var ok=await confirmar({
    titulo:'Excluir este acesso?',
    texto:'A conta deixa de existir e a pessoa não entra mais no sistema.',
    linhas:[['Login',email||'—',''],['Depois disso','não tem como desfazer pela tela','']],
    aviso:'Os lançamentos e vendas que essa pessoa fez <b>continuam no sistema</b>. '+
          'O que some é o acesso.',
    ok:'Excluir acesso', tipo:'perigo'
  });
  if(!ok)return;
  try{
    var r=await fetch(NUVEM.url+'/functions/v1/criar-usuario',{
      method:'POST',
      headers:{'Content-Type':'application/json','apikey':NUVEM.chave,
               'Authorization':'Bearer '+(NUVEM.token||'')},
      body:JSON.stringify({acao:'excluir',perfil_id:perfilId})
    });
    var d=null; try{d=await r.json()}catch(e){}
    if(!r.ok){painelErro('Não consegui excluir o acesso.',
      traduzAuth((d&&d.erro)||('o servidor respondeu '+r.status)));return;}
  }catch(e){
    painelErro('Não consegui excluir o acesso.',traduzAuth((e&&e.message)||'falha de rede'));return;
  }
  ACS.edit=null; INS.nuvem=null; await carregarEmpresas(true);
  toast('Acesso excluído: '+(email||''));
  telaInstalacao();
}
async function criarAcessoEmpresa(lojaId){
  var email=vlr('acMail').toLowerCase(), senha=vlr('acSenha');
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){painelErro('Informe um e-mail válido para o login.');return;}
  if(senha.length<6){painelErro('A senha precisa ter ao menos 6 caracteres.');return;}
  var er=await criarAcesso(lojaId,{nome:vlr('acNome')||email,email:email,senha:senha,
    cargo:vlr('acCargo'),sucursal_ref:vlr('acSuc')});
  if(er){painelErro('Não consegui criar o acesso.',er);return;}
  INS.nuvem=null;await carregarEmpresas(true);
  toast('Acesso criado: '+email);telaInstalacao();
}

/* ---------- 6. PERMISSÕES EM ÁRVORE ---------- */
var PRM={loja:null,alvo:null,abertas:{},pend:{}};
/* ==========================================================
   O QUE PODE SER VENDIDO
   Esta lista alimenta a tela onde o dono marca o que a empresa contratou.
   Ela mostrava TODAS as telas do sistema, inclusive as seis que sao
   exclusivas da Joia (Mapa do Sistema, Empresas Clientes, Diagnostico,
   Backup, Layout do Menu, Dados de Teste). O dono marcava, salvava, e nada
   acontecia — porque a trava de podeVer recusa essas telas para quem nao e
   plataforma, e com razao: sao as telas que administram o proprio produto.
   Oferecer uma chave que nunca abre a porta e pior que nao oferecer.
   Sobram, em Administracao, as duas que fazem sentido para uma rede:
   Mensalidades das Unidades e Sincronizacao.
   ========================================================== */
function chavesDoSistema(){
  var out=[];
  MOD.forEach(function(m){
    (m.it||[]).forEach(function(it){
      if(SO_PLATAFORMA.indexOf(m.id+'/'+it.id)>=0)return;   /* so da Joia: nao se vende */
      out.push({mod:m.id,modn:m.n,item:it.id,n:it.n});
    });
  });
  return out;
}
/* ==========================================================
   PERMISSOES DE UMA UNIDADE
   A MATRIZ E O TETO. O que a empresa contratou e o que a matriz enxerga —
   nao existe um terceiro nivel de "contrato" a parte, porque seria a mesma
   lista escrita duas vezes. Regra em uma frase: se a matriz nao ve, nenhuma
   loja dela ve. Quem define a matriz e so a Nexor; a matriz distribui entre
   as sucursais o que ela mesma tem.
   ========================================================== */
function telaPermUnidade(){
  if(!ehPlataforma())return telaRestrita('Permissões');
  var x=empresaPorId(PRM.loja);
  if(!x||!PRM.alvo){INS.rede=PRM.loja;PRM.alvo=null;return telaInstalacao();}
  var su=(x.unidades||[]).find(function(s){return s.id===PRM.alvo});
  if(!su){PRM.alvo=null;INS.rede=PRM.loja;return telaInstalacao();}
  var mz=x.matriz||{};
  var permMz=(x.permUn||{})[mz.id]||{};
  var atual=Object.assign({},(x.permUn||{})[su.id]||{});
  Object.keys(PRM.pend).forEach(function(k){atual[k]=PRM.pend[k];});

  var porMod={};
  chavesDoSistema().forEach(function(c){
    if(!porMod[c.mod])porMod[c.mod]={n:c.modn,itens:[]};
    porMod[c.mod].itens.push(c);
  });
  var grade=Object.keys(porMod).map(function(mid){
    var g=porMod[mid];
    var libs=g.itens.filter(function(c){return atual[c.mod+'.'+c.item]}).length;
    return '<div class="blk" style="margin-bottom:10px">'+
     '<div class="acTit">'+E(g.n)+
      '<span style="float:right;font-weight:400;font-size:11px;color:var(--ink-3)">'+
        libs+'/'+g.itens.length+'</span>'+
      '<button class="btnP2" style="float:right;padding:3px 9px;font-size:11px;margin:0 8px" '+
        'onclick="marcarModulo(\''+mid+'\',false)">nada</button>'+
      '<button class="btnP2" style="float:right;padding:3px 9px;font-size:11px" '+
        'onclick="marcarModulo(\''+mid+'\',true)">tudo</button>'+
     '</div>'+
     g.itens.map(function(c){
       var k=c.mod+'.'+c.item;
       var lig=!!atual[k];
       var bloq=(!su.matriz&&!permMz[k]);
       return '<div class="linhaPerm'+(bloq?' bloq':'')+'">'+
        '<span>'+E(c.n)+(bloq?'<i> — a matriz não tem</i>':'')+'</span>'+
        '<button class="swPerm'+(lig?' on':'')+'"'+(bloq?' disabled':'')+
          ' data-perm="'+k+'" onclick="togglePerm(\''+k+'\',this)"></button>'+
       '</div>';
     }).join('')+'</div>';
  }).join('');

  var pend=Object.keys(PRM.pend).length;
  $('content').innerHTML='<div class="ctWrap">'+
   '<div class="ctTopo">'+
    '<button class="btnP2" onclick="voltarDaEmpresa()">‹ voltar para '+E(x.loja.nome)+'</button>'+
    '<h1 style="margin-top:10px">'+E(su.nome)+(su.matriz?selo('MATRIZ','#1F5F8B'):'')+'</h1>'+
    '<p>'+(su.matriz
      ?'O que esta empresa contratou. As sucursais só recebem o que estiver marcado aqui — '+
       'desmarcar algo aqui tira das lojas dela junto.'
      :'O que esta sucursal usa. O que a matriz não tem aparece travado.')+'</p></div>'+
   '<div class="permBarra">'+
    (x.unidades||[]).map(function(s2){
      return '<button class="btnP2'+(s2.id===su.id?' ok':'')+'" '+
       'onclick="trocarUnidadePerm(\''+s2.id+'\')">'+E(s2.nome)+
       (s2.matriz?' (matriz)':'')+'</button>';
    }).join('')+
    '<div style="flex:1"></div>'+
    '<span class="hint" id="prmPend" style="margin-right:8px">'+
      (pend?pend+' alteração(ões) por salvar':'')+'</span>'+
    '<button class="btnP2 ok" id="prmSalvar"'+(pend?'':' disabled')+
      ' onclick="salvarPermissoes()">Salvar</button>'+
   '</div>'+
   '<div style="max-width:900px">'+grade+'</div></div>';
  rodape(pend?pend+' alteração(ões) por salvar':E(su.nome));
}
function voltarDaEmpresa(){
  if(Object.keys(PRM.pend).length&&
     !confirm('Há alterações não salvas. Sair mesmo assim?'))return;
  var lj=PRM.loja;PRM.alvo=null;PRM.pend={};INS.rede=lj;telaInstalacao();
}
function trocarUnidadePerm(id){
  if(Object.keys(PRM.pend).length&&
     !confirm('Há alterações não salvas nesta unidade. Trocar mesmo assim?'))return;
  PRM.alvo=id;PRM.pend={};telaPermUnidade();
}
/* mesma razao do togPermUsr: mexer numa chave nao justifica refazer a tela
   inteira com os 81 itens. Aqui tambem so a chave e o contador mudam. */
function togglePerm(k, elBt){
  var lig = elBt && elBt.classList ? !elBt.classList.contains('on') : true;
  PRM.pend[k] = lig;
  if(!elBt || !elBt.classList){ telaPermUnidade(); return; }
  elBt.classList.toggle('on', lig);
  var pend=Object.keys(PRM.pend).length;
  var av=document.getElementById('prmPend');
  if(av)av.textContent = pend ? pend+' alteração(ões) por salvar' : '';
  var bt=document.getElementById('prmSalvar');
  if(bt)bt.disabled = !pend;
}
function marcarModulo(mid,v){
  var x=empresaPorId(PRM.loja); if(!x)return;
  var su=(x.unidades||[]).find(function(s){return s.id===PRM.alvo}); if(!su)return;
  var permMz=(x.permUn||{})[(x.matriz||{}).id]||{};
  chavesDoSistema().forEach(function(c){
    if(c.mod!==mid)return;
    var k=c.mod+'.'+c.item;
    if(!su.matriz&&!permMz[k])return;      /* nao marca o que a matriz nao tem */
    PRM.pend[k]=v;
  });
  telaPermUnidade();
}
async function salvarPermissoes(){
  if(!Object.keys(PRM.pend).length)return;
  try{
    await api('rpc/painel_gravar_perm_unidade','POST',
      {p_sucursal_id:PRM.alvo,p_perm:PRM.pend});
    PRM.pend={};INS.nuvem=null;await carregarEmpresas(true);
    toast('Permissões salvas.');telaPermUnidade();
  }catch(e){ console.error('salvarPermissoes',e);
    painelErro('Não consegui salvar as permissões.',detalheErro(e)); }
}

/* ==========================================================
   FINANCEIRO DA NEXOR
   Substitui a antiga tela "Clientes Nexor", que mostrava a mesma coisa a
   partir de uma lista paralela (DB.clientesNexor) — duas telas com o mesmo
   assunto e numeros que podiam divergir. Agora e uma so, lendo as UNIDADES
   direto da nuvem, que e onde a cobranca mora desde que ela passou a ser
   por unidade.
   ========================================================== */
var FN={busca:'',situacao:'',mes:null};
function fnMesAtual(){
  if(FN.mes)return FN.mes;
  var d=new Date();
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
}
function fnPago(s,mes){
  return (s.cobrancas||[]).some(function(b){return b.mes===mes&&b.pago});
}
function fnLinhas(){
  var out=[];
  empresasDaNuvem().forEach(function(x){
    (x.unidades||[]).forEach(function(s){
      out.push({emp:x.loja.nome,empId:x.loja.id,s:s,
        sit:(s.ativa===false)?'inativo':(s.cobranca_situacao||'ativo')});
    });
  });
  return out;
}
function telaFinanceiroNexor(){
  if(!ehPlataforma()&&!ehFranqueadora())return telaRestrita('Mensalidades das Unidades');
  /* ==========================================================
     ESTA TELA CONGELAVA O NAVEGADOR QUANDO A NUVEM FALHAVA

     A guarda era `!INS.nuvem && !INS.carregando`. O `catch` devolvia
     `carregando` para falso, gravava o erro e chamava a tela de novo —
     e a guarda voltava a ser verdadeira, porque `INS.nuvem` continuava
     vazio. Nova chamada, nova falha, nova chamada: laco infinito, com o
     navegador travado, em qualquer falha de rede.

     O `INS.erro` era gravado e nunca lido. A tela gemea, telaInstalacao,
     ja fazia certo desde sempre: poe o erro na guarda E o mostra na tela,
     com um botao de tentar de novo. Aqui a terceira condicao tinha
     ficado para tras na copia.
     ========================================================== */
  if(!INS.nuvem&&!INS.carregando&&!INS.erro){
    INS.carregando=true;
    carregarEmpresas().then(function(){INS.carregando=false;telaFinanceiroNexor();})
      .catch(function(e){INS.carregando=false;INS.erro=(e&&e.message)||'falha ao ler';
        telaFinanceiroNexor();});
    $('content').innerHTML='<div class="ctWrap"><div class="usrVazio"><b>Carregando…</b></div></div>';
    return;
  }
  if(INS.erro&&!INS.nuvem){
    $('content').innerHTML='<div class="ctWrap"><div class="ctTopo">'+
     '<h1>Mensalidades das Unidades</h1></div>'+
     '<div class="usrVazio" style="background:#fff;border:1px solid var(--line);border-radius:10px">'+
      '<b>Não consegui ler as mensalidades</b><span>'+E(INS.erro)+'</span>'+
      '<div style="margin-top:12px"><button class="btnP2" '+
      'onclick="INS.erro=\'\';INS.nuvem=null;telaFinanceiroNexor()">'+
      'Tentar de novo</button></div></div></div>';
    rodape('não foi possível carregar');
    return;
  }
  var mes=fnMesAtual();
  var todas=fnLinhas();
  var L=todas.slice();
  if(FN.situacao)L=L.filter(function(l){return l.sit===FN.situacao});
  if(FN.busca){
    var q=FN.busca.toLowerCase();
    L=L.filter(function(l){
      return (l.emp||'').toLowerCase().indexOf(q)>=0||
             (l.s.nome||'').toLowerCase().indexOf(q)>=0||
             (l.s.responsavel||'').toLowerCase().indexOf(q)>=0||
             (l.s.cnpj||'').toLowerCase().indexOf(q)>=0;
    });
  }
  L.sort(function(a,b){
    if(a.emp!==b.emp)return a.emp.localeCompare(b.emp);
    return (b.s.matriz?1:0)-(a.s.matriz?1:0);
  });

  var ativas=todas.filter(function(l){return l.sit==='ativo'});
  var mrr=ativas.reduce(function(a,l){return a+(Number(l.s.mensalidade)||0)},0);
  var recebido=ativas.filter(function(l){return fnPago(l.s,mes)})
                     .reduce(function(a,l){return a+(Number(l.s.mensalidade)||0)},0);
  var aRec=mrr-recebido;
  var empresas={};todas.forEach(function(l){empresas[l.empId]=1});

  var mesesOpc=[];
  for(var i=0;i<12;i++){
    var d=new Date();d.setDate(1);d.setMonth(d.getMonth()-i);
    mesesOpc.push(d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'));
  }
  function mesBR(m){
    var p=String(m).split('-');
    return ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'][Number(p[1])-1]+'/'+p[0];
  }

  $('content').innerHTML='<div class="ctWrap" style="max-width:none">'+
   '<div class="ctTopo"><h1>Mensalidades das Unidades</h1>'+
    '<p>O que cada unidade paga pelo uso do sistema e o que já entrou no mês. '+
    'Esta tela é sua — nenhum cliente tem acesso a ela.</p></div>'+

   '<div class="hpNums" style="border:1px solid var(--line);border-radius:8px;overflow:hidden;margin-bottom:12px">'+
    '<div class="hpN"><span>Empresas</span><b>'+Object.keys(empresas).length+'</b></div>'+
    '<div class="hpN"><span>Unidades cobradas</span><b>'+ativas.length+'</b></div>'+
    '<div class="hpN dest4"><span>Receita recorrente</span><b>R$ '+money(mrr)+'</b></div>'+
    '<div class="hpN"><span>Recebido em '+mesBR(mes)+'</span><b class="vg">R$ '+money(recebido)+'</b></div>'+
    '<div class="hpN"><span>A receber</span><b class="'+(aRec>0?'vr':'')+'">R$ '+money(aRec)+'</b></div>'+
   '</div>'+

   '<div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;margin-bottom:12px">'+
    '<div class="f2" style="max-width:260px"><label>Buscar</label>'+
     '<input id="fnB" value="'+E(FN.busca)+'" placeholder="empresa, unidade, CNPJ" '+
     'oninput="FN.busca=this.value;clearTimeout(window._tfn);'+
     'window._tfn=setTimeout(telaFinanceiroNexor,300)"></div>'+
    '<div class="f2"><label>Situação</label>'+
     '<select onchange="FN.situacao=this.value;telaFinanceiroNexor()">'+
      '<option value="">todas</option>'+
      ['ativo','teste','inadimplente','inativo'].map(function(v){
        return '<option value="'+v+'"'+(FN.situacao===v?' selected':'')+'>'+v+'</option>';
      }).join('')+'</select></div>'+
    '<div class="f2"><label>Mês</label>'+
     '<select onchange="FN.mes=this.value;telaFinanceiroNexor()">'+
      mesesOpc.map(function(m){
        return '<option value="'+m+'"'+(m===mes?' selected':'')+'>'+mesBR(m)+'</option>';
      }).join('')+'</select></div>'+
    '<div style="flex:1"></div>'+
    /* O botao "Nova empresa" nao pertence a esta tela: aqui se acompanha a
       cobranca das unidades que ja existem. Cadastrar empresa e outro
       assunto, e tem lugar proprio em Empresas Clientes. O valor e o dia de
       vencimento de cada unidade vem do cadastro da sucursal. */
   '</div>'+

   '<div class="blk" style="max-width:none;padding:0;overflow:auto">'+
    '<table class="fmTab"><thead><tr>'+
     '<th>Empresa</th><th style="width:200px">Unidade</th>'+
     '<th style="width:150px">CNPJ</th><th style="width:150px">Responsável</th>'+
     '<th style="width:110px">Plano</th>'+
     '<th style="width:110px;text-align:right">Mensalidade</th>'+
     '<th style="width:70px;text-align:center">Venc.</th>'+
     '<th style="width:110px">Situação</th><th style="width:120px">'+mesBR(mes)+'</th>'+
     '<th style="width:60px"></th></tr></thead><tbody>'+
    (L.length?L.map(function(l){
      var s=l.s,pg=fnPago(s,mes);
      return '<tr><td><b>'+E(l.emp)+'</b></td>'+
       '<td>'+E(s.nome)+(s.matriz?selo('MATRIZ','#1F5F8B'):'')+
         (s.cidade?'<small>'+E(s.cidade)+(s.uf?'/'+E(s.uf):'')+'</small>':'')+'</td>'+
       '<td>'+E(s.cnpj||'—')+'</td>'+
       '<td>'+E(s.responsavel||'—')+'</td>'+
       '<td>'+E(s.plano||'—')+'</td>'+
       '<td style="text-align:right"><b>R$ '+money(s.mensalidade)+'</b></td>'+
       '<td style="text-align:center">'+(s.dia_vencimento?'dia '+s.dia_vencimento:'—')+'</td>'+
       '<td><span class="pill '+(l.sit==='ativo'?'ok':(l.sit==='inadimplente'||l.sit==='inativo'?'rd':''))+
         '">'+E(l.sit)+'</span></td>'+
       '<td>'+(l.sit!=='ativo'?'—':(pg
         ?'<b class="vg">pago</b> <button class="btnMini" onclick="marcarPagoUnidade(\''+s.id+'\',false)">desfazer</button>'
         :'<button class="btnMini" onclick="marcarPagoUnidade(\''+s.id+'\',true)">marcar pago</button>'))+'</td>'+
       /* ==========================================================
          O LAPIS LEVA CADA UM AO SEU LUGAR
          Ele abria Empresas Clientes, que e exclusiva do dono da Joia — a
          franqueadora clicava e batia em "Sem acesso a esta tela". Para ela
          o valor e o vencimento moram no cadastro da propria sucursal, que
          e onde ela pode e deve editar.
          ========================================================== */
       '<td>'+(ehPlataforma()
         ?'<button class="rBtn" title="Abrir a unidade" onclick="INS.rede=\''+l.empId+'\';'+
           'INS.und={loja:\''+l.empId+'\',suc:\''+s.id+'\'};abrir(\'tecnico\',\'instalacao\')">'+
           sv('edit',12)+'</button>'
         :'<button class="rBtn" title="Editar valor e vencimento" '+
           'onclick="formSucursal(\''+(s.ref_local||s.id)+'\')">'+sv('edit',12)+'</button>')+
       '</td></tr>';
    }).join('')
    :'<tr><td colspan="10" class="fmVazio">Nenhuma unidade cobrada ainda. '+
      'Cadastre uma empresa em Empresas Clientes.</td></tr>')+
   '</tbody></table></div></div>';
  rodape(L.length+' unidade(s) · recorrente R$ '+money(mrr));
}
async function marcarPagoUnidade(sucId,pago){
  try{
    await api('rpc/painel_marcar_pago','POST',
      {p_sucursal_id:sucId,p_mes:fnMesAtual(),p_pago:!!pago});
    INS.nuvem=null;await carregarEmpresas(true);
    toast(pago?'Recebimento registrado.':'Recebimento desfeito.');
    telaFinanceiroNexor();
  }catch(e){ console.error('marcarPagoUnidade',e);
    painelErro('Não consegui registrar o recebimento.',detalheErro(e)); }
}

function vlr(id){var e=$(id);return e?String(e.value||'').trim():'';}
/* O erro precisa aparecer NA TELA. Depois de varios alertas seguidos o
   navegador oferece "impedir que esta pagina crie caixas de dialogo", e a
   partir dai todo alert() e engolido em silencio: a pessoa clica, nada
   acontece, e nem o erro chega. */
function painelErro(msg,detalhe){
  var el=document.getElementById('painelAviso');
  if(!el){
    el=document.createElement('div');
    el.id='painelAviso';
    el.style.cssText='margin:12px 0;padding:12px 14px;border-radius:8px;'+
      'background:#FBEDE8;border:1px solid #E3BBAB;color:#7A3418;font-size:13px;max-width:900px';
    var alvo=document.querySelector('.ctWrap')||document.getElementById('content');
    if(alvo)alvo.insertBefore(el,alvo.firstChild);
  }
  el.innerHTML='<b>'+E(msg)+'</b>'+(detalhe?'<div style="margin-top:6px;font-size:12px;'+
    'opacity:.9;word-break:break-word">'+E(detalhe)+'</div>':'')+
    '<div style="margin-top:8px"><button class="btnP2" onclick="var n=document.getElementById(\'painelAviso\');if(n)n.remove()">Fechar</button></div>';
  try{el.scrollIntoView({block:'center'});}catch(e){_quieto(e,'painelErro')}
}
function detalheErro(e){
  if(!e)return '';
  var p=[];
  if(e.message)p.push(e.message);
  if(e.status)p.push('resposta do servidor: '+e.status);
  if(e.tabela)p.push('em '+e.tabela);
  return p.join(' · ');
}
async function salvarEmpresa(lojaId){
  var d={nome:vlr('emNome'),documento:vlr('emDoc'),responsavel:vlr('emResp'),
    email:vlr('emMail'),telefone:vlr('emTel'),cidade:vlr('emCid'),uf:vlr('emUf'),
    plano:vlr('emPlano'),mensalidade:vlr('emMens').replace(/\./g,'').replace(',','.'),
    dia_vencimento:vlr('emVenc'),situacao:vlr('emSit'),ativa:vlr('emAtiva')==='1'};
  if(!d.nome){painelErro('Informe o nome da empresa.');return;}
  try{
    await api('rpc/painel_salvar_empresa','POST',{p_loja_id:lojaId,p_d:d});
    INS.nuvem=null;await carregarEmpresas(true);
    toast('Dados da empresa salvos.');telaInstalacao();
  }catch(e){ console.error('salvarEmpresa',e);
    painelErro('Não consegui salvar os dados da empresa.',detalheErro(e)); }
}
/* ----------------------------------------------------------
   REMOVIDAS: formUnidade / salvarUnidade da versao anterior do painel.
   Ficaram para tras quando reescrevi o bloco e, por virem DEPOIS no arquivo,
   sobrescreviam as novas — a mesma armadilha que engoliu o clique em
   "Salvar unidade" a tarde inteira. Num arquivo unico, funcao duplicada e
   silenciosa: a ultima definicao vence e nada avisa.
   ---------------------------------------------------------- */

/* ----------------------------------------------------------
   REMOVIDAS: editarUnidade / salvarUnidade(redeId,sucId) / apagarUnidade
   Eram as telas da versao anterior, que trabalhavam sobre DB.redes — a lista
   local que nao existe mais. Nao estavam so obsoletas: a salvarUnidade delas
   tinha o MESMO NOME da nova e, por vir depois no arquivo, sobrescrevia a
   nova. O clique em "Salvar unidade" caia nesta aqui, que abria com
   `DB.redes.find(...); if(!r) return;` e desistia em silencio na primeira
   linha — sem gravar, sem erro, sem mensagem.
   Falha de varredura minha: funcao duplicada e a primeira coisa a conferir
   antes de publicar num arquivo unico.
   ---------------------------------------------------------- */

/* ==========================================================
   CARGA INICIAL — dados vindos das planilhas da Jolo Santa Fe
   Substitui grupos, ingredientes, fichas tecnicas e fornecedores.
   Nao toca no cardapio, nos pedidos nem no financeiro.
   ========================================================== */
var CARGA_SFS=null;   /* os dados vem de arquivo, nunca escritos no codigo */


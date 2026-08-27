/* ==========================================================
   BLOCO 11 — CATEGORIAS FINANCEIRAS E CONTAS BANCÁRIAS
   ========================================================== */
var BANCOS=[
 {id:'nubank',n:'Nubank',c:'#820AD1',s:'NU'},
 {id:'itau',n:'Itaú',c:'#EC7000',s:'IT'},
 {id:'bradesco',n:'Bradesco',c:'#CC092F',s:'BR'},
 {id:'bb',n:'Banco do Brasil',c:'#F8D117',s:'BB',esc:1},
 {id:'santander',n:'Santander',c:'#EC0000',s:'SA'},
 {id:'caixa',n:'Caixa Econômica',c:'#1C5FAF',s:'CX'},
 {id:'inter',n:'Banco Inter',c:'#FF7A00',s:'IN'},
 {id:'sicredi',n:'Sicredi',c:'#3FA110',s:'SI'},
 {id:'sicoob',n:'Sicoob',c:'#00A490',s:'SC'},
 {id:'c6',n:'C6 Bank',c:'#242424',s:'C6'},
 {id:'picpay',n:'PicPay',c:'#21C25E',s:'PP'},
 {id:'mercadopago',n:'Mercado Pago',c:'#00B1EA',s:'MP'},
 {id:'pagbank',n:'PagBank',c:'#0F9D58',s:'PG'},
 {id:'stone',n:'Stone',c:'#12B76A',s:'ST'},
 {id:'safra',n:'Safra',c:'#0B2C5B',s:'SF'},
 {id:'btg',n:'BTG Pactual',c:'#0B2A45',s:'BT'},
 {id:'outro',n:'Outro banco',c:'#5C6B80',s:'$'}
];
function banco(id){return BANCOS.find(function(b){return b.id===id})||BANCOS[BANCOS.length-1]}

function baseCat(){
  DB.catfin=DB.catfin||[];
  baseFin();
  /* garante as contas fixas ligadas à operação */
  var temCaixa=(DB.contas||[]).some(function(c){return c.fixa==='caixa'});
  var temCofre=(DB.contas||[]).some(function(c){return c.fixa==='cofre'});
  DB.contas=(DB.contas||[]).map(function(c){
    if(c.id==='ct_caixa')c.fixa='caixa';
    if(c.id==='ct_cofre')c.fixa='cofre';
    return c;
  });
  if(!temCaixa&&!DB.contas.some(function(c){return c.fixa==='caixa'}))
    DB.contas.unshift({id:'ct_caixa',nome:'Caixa da loja',tipo:'Caixa',fixa:'caixa',saldoInicial:0});
  if(!temCofre&&!DB.contas.some(function(c){return c.fixa==='cofre'}))
    DB.contas.push({id:'ct_cofre',nome:'Cofre',tipo:'Cofre',fixa:'cofre',saldoInicial:0});
}

/* ==========================================================
   CATEGORIAS FINANCEIRAS
   ========================================================== */
var CF={abertas:{}};
/* Categoria de receita e categoria de despesa não se misturam: cada lado tem o
   seu cadastro, e o lançamento só oferece as do tipo que está sendo lançado. */
function tipoCat(p){return (p&&p.tipo==='receita')?'receita':'despesa'}
function telaCatFin(){
  baseCat();
  $('content').innerHTML='<div class="finWrap catFinCheio">'+
  '<div class="finTop"><div><h1>Plano de Contas</h1>'+
  '<p>Receita de um lado, despesa do outro. É esta divisão que faz o lançamento '+
  'mostrar só as categorias certas.</p></div></div>'+
  '<div class="catDuas">'+
   colunaCatFin('receita','Receita','entradas de dinheiro')+
   colunaCatFin('despesa','Despesa','saídas de dinheiro')+
  '</div></div>';
  rodape((DB.catfin||[]).length+' categorias');
}
function colunaCatFin(tipo,titulo,desc){
  titulo=E(titulo);desc=E(desc);   /* P14: nunca entram crus no HTML */
  var pastas=(DB.catfin||[]).filter(function(p){return tipoCat(p)===tipo});
  var n=pastas.reduce(function(a,p){return a+((p.itens||[]).length)},0);
  return '<div class="catCol '+tipo+'">'+
   '<div class="catColH">'+sv(tipo==='receita'?'up2':'dn4',15)+
    '<div><b>'+titulo+'</b><span>'+desc+'</span></div>'+
    '<span class="catQt">'+pastas.length+' · '+n+' itens</span></div>'+
   '<div class="arvore" style="margin:0;border:0;border-radius:0">'+
   '<div class="arvBody">'+
   (pastas.length?pastas.map(function(p){
     var ab=!!CF.abertas[p.id];
     return '<div class="arvGrupo">'+
      '<div class="arvPasta'+(ab?' ab':'')+'" onclick="abrirPasta(\''+p.id+'\')">'+
       '<span class="arvSeta">'+sv('tri',11)+'</span>'+
       '<span class="arvIcP">'+sv(ab?'folderOpen':'folder',15)+'</span>'+
       '<span class="arvNome">'+E(p.nome)+'</span>'+
       '<span class="arvQtd">'+(p.itens||[]).length+'</span>'+
       '<span class="arvAct">'+
        '<button class="arvB" onclick="event.stopPropagation();modalPasta(\''+p.id+'\')" title="Editar">'+sv('edit',12)+'</button>'+
        '<button class="arvB rd" onclick="event.stopPropagation();excluirPasta(\''+p.id+'\')" title="Excluir">'+sv('trash',12)+'</button>'+
       '</span>'+
      '</div>'+
      (ab?'<div class="arvFilhos">'+
        (p.itens||[]).map(function(it,k){
          return '<div class="arvItem">'+
          '<span class="arvIcF">'+sv('file2',13)+'</span>'+
          '<span class="arvNome">'+E(it.nome)+'</span>'+
          '<span class="arvAct">'+
           '<button class="arvB" onclick="renomearSub(\''+p.id+'\','+k+')" title="Renomear">'+sv('edit',12)+'</button>'+
           '<button class="arvB rd" onclick="excluirSub(\''+p.id+'\','+k+')" title="Excluir">'+sv('trash',12)+'</button>'+
          '</span></div>';
        }).join('')+
        '<div class="arvAdd">'+
         '<input id="ns-'+p.id+'" placeholder="nome do item — ex: Água, Energia, Contador" '+
         'onkeydown="if(event.key===\'Enter\')addSub(\''+p.id+'\')">'+
         '<button class="btnP2 ok" onclick="addSub(\''+p.id+'\')">'+sv('check',12)+' Salvar item</button>'+
        '</div>'+
       '</div>':'')+
     '</div>';
   }).join('')
   :'<div class="arvVazio"><b>Nenhuma categoria de '+titulo.toLowerCase()+'</b>'+
    'Use o botão abaixo para criar a primeira.</div>')+
   '</div></div>'+
   '<button class="catAdd" onclick="modalPasta(null,\''+tipo+'\')">'+sv('plus',13)+
    ' Cadastrar '+(tipo==='receita'?'receita':'despesa')+'</button>'+
  '</div>';
}
function abrirPasta(id){
  CF.abertas[id]=!CF.abertas[id];
  telaCatFin();
}
function modalPasta(id,tipoPadrao){
  baseCat();
  var p=id?DB.catfin.find(function(x){return x.id===id}):null;
  var tp=p?tipoCat(p):(tipoPadrao||'despesa');
  var h='<div class="mdB"><div class="blk" style="margin:0;max-width:none">'+
  '<div class="fld2" style="margin:0"><label>Nome da categoria *</label>'+
  '<input id="pfN" value="'+E(p?p.nome:'')+'" placeholder="'+
   (tp==='receita'?'ex: Vendas, Serviços, Outras receitas':'ex: Custos Fixos, Despesas Variáveis')+'">'+
  '<div class="catTipoFixo '+tp+'">'+sv(tp==='receita'?'up2':'dn4',13)+
   ' Categoria de <b>'+(tp==='receita'?'receita':'despesa')+'</b> — o tipo não muda depois</div>'+
  '<div class="hint">Depois de criar, clique na pasta para adicionar as subcategorias dentro dela.</div></div>'+
  '</div></div>';
  modal(p?'Editar categoria':('Cadastrar '+(tp==='receita'?'receita':'despesa')),h,'Salvar',function(){
    var nome=$('pfN').value.trim();
    if(!nome){toast('Informe o nome da categoria.');return false;}
    if(p)p.nome=nome;
    else{
      var novo={id:uid('cf'),nome:nome,tipo:tp,itens:[]};
      DB.catfin.push(novo);
      CF.abertas[novo.id]=true;
    }
    salvar();telaCatFin();toast('Categoria salva.');return true;
  });
  setTimeout(function(){var n=$('pfN');if(n)n.focus();},60);
}
async function excluirPasta(id){
  var p=DB.catfin.find(function(x){return x.id===id});
  var n=(p.itens||[]).length;
  if(!await pergunta('Excluir a categoria "'+p.nome+'"'+(n?' e suas '+n+' subcategorias':'')+'?'))return;
  DB.catfin=DB.catfin.filter(function(x){return x.id!==id});
  salvar();telaCatFin();toast('Categoria excluída.');
}
function addSub(pid){
  var inp=$('ns-'+pid);
  var nome=(inp.value||'').trim();
  if(!nome){inp.focus();return;}
  var p=DB.catfin.find(function(x){return x.id===pid});
  p.itens=p.itens||[];
  p.itens.push({id:uid('sc'),nome:nome});
  CF.abertas[pid]=true;
  salvar();telaCatFin();
  var n=$('ns-'+pid);if(n)n.focus();
}
function renomearSub(pid,k){
  var p=DB.catfin.find(function(x){return x.id===pid});
  var novo=prompt('Renomear subcategoria:',p.itens[k].nome);
  if(novo===null)return;
  novo=novo.trim();if(!novo)return;
  p.itens[k].nome=novo;salvar();telaCatFin();
}
async function excluirSub(pid,k){
  var p=DB.catfin.find(function(x){return x.id===pid});
  if(!await pergunta('Excluir "'+p.itens[k].nome+'"?'))return;
  p.itens.splice(k,1);salvar();telaCatFin();
}
/* lista pronta para os lançamentos financeiros */
function opcoesCategorias(){
  var out=[];
  (DB.catfin||[]).forEach(function(p){
    (p.itens||[]).forEach(function(it){out.push({id:it.id,nome:p.nome+' › '+it.nome,pasta:p.nome,tipo:p.tipo})});
  });
  return out;
}

/* ==========================================================
   CONTAS BANCÁRIAS
   ========================================================== */
function saldoConta(c){
  if(c.fixa==='caixa'){
    var cx=caixaAberto();
    return cx?esperadoCaixa(cx):0;
  }
  var mov=(DB.lancamentos||[]).filter(function(l){return l.contaId===c.id});
  var e=mov.filter(function(l){return l.tipo==='entrada'}).reduce(function(a,l){return a+l.valor},0);
  var s=mov.filter(function(l){return l.tipo==='saida'}).reduce(function(a,l){return a+l.valor},0);
  return (Number(c.saldoInicial)||0)+e-s;
}
function telaContas(){
  baseCat();
  var contas=DB.contas||[];
  var total=contas.reduce(function(a,c){return a+saldoConta(c)},0);
  var cx=caixaAberto();
  $('content').innerHTML='<div class="finWrap">'+
  '<div class="finTop"><div><h1>Contas Bancárias</h1>'+
  '<p>Bancos, caixa e cofre. Os saldos alimentam os lançamentos e os pagamentos.</p></div>'+
  '<div class="finActs" style="align-items:center;gap:14px">'+
   '<div class="ctTotTopo"><span>Saldo total</span><b>R$ '+money(total)+'</b></div>'+
   '<button class="btnP2 ok" onclick="modalConta()">'+sv('plus',14)+' Cadastrar conta</button>'+
  '</div></div>'+

  /* uma lista, não um cartão por conta: as três cabem onde antes cabia uma */
  '<div class="ctLista">'+
  (contas.length?contas.map(function(c){
    var b=c.fixa?null:banco(c.banco);
    var cor=c.fixa==='caixa'?'var(--acc-d)':c.fixa==='cofre'?'#5C6B80':b.c;
    var sig=c.fixa==='caixa'?'CX':c.fixa==='cofre'?'CO':b.s;
    var det=c.fixa==='caixa'
      ?('Caixa do PDV · '+(cx?'caixa aberto, saldo vem do PDV':'caixa fechado'))
      :c.fixa==='cofre'?'Cofre da loja'
      :(b.n+(c.agencia?' · Ag. '+E(c.agencia):'')+(c.numero?' · C/C '+E(c.numero):''));
    return '<div class="ctLin">'+
     '<span class="ctSel" style="background:'+cor+'"'+(b&&b.esc?' data-esc="1"':'')+'>'+E(sig)+'</span>'+
     '<div class="ctNm"><b>'+E(c.nome)+
       (c.fixa?' <span class="badge2 gr">fixa</span>':'')+'</b><span>'+det+'</span></div>'+
     '<div class="ctVal"><b>R$ '+money(saldoConta(c))+'</b><span>saldo atual</span></div>'+
     '<div class="ctAcs">'+
      (c.fixa==='caixa'
        ?'<button class="ctB az" onclick="abrir(\'pdv\',\'pdv\')" title="Ir ao PDV">'+sv('pos',15)+'</button>'
        :'<button class="ctB" onclick="modalConta(\''+c.id+'\')" title="Editar">'+sv('edit',15)+'</button>')+
      (c.fixa?'':'<button class="ctB rd" onclick="excluirConta(\''+c.id+'\')" title="Excluir">'+sv('trash',15)+'</button>')+
     '</div></div>';
  }).join('')
  :'<div class="ctVazio"><b>Nenhuma conta cadastrada</b>'+
   '<span>Clique em <b>Cadastrar conta</b> para incluir o primeiro banco.</span></div>')+
  (contas.length?'<div class="ctRod"><span>'+contas.length+' conta(s)</span>'+
   '<b>R$ '+money(total)+'</b></div>':'')+
  '</div>'+

  '<div class="avisoCfg" style="margin-top:4px">'+sv('help',16)+
  '<div>O <b>Caixa da loja</b> e o <b>Cofre</b> são contas fixas do sistema. '+
  'O saldo do Caixa vem direto da frente de caixa aberta no PDV (fundo de troco + dinheiro '+
  'recebido + suprimentos − sangrias), por isso não é editável aqui.</div></div>'+
  '</div>';
  rodape(contas.length+' contas');
}
function modalConta(id){
  baseCat();
  var c=id?DB.contas.find(function(x){return x.id===id}):null;
  var sel=c?c.banco:'nubank';
  /* a grade de 14 botões grandes ocupava mais que o formulário inteiro:
     virou pastilha, com os cinco mais usados à mostra e o resto sob demanda */
  var _maisB=false;
  function grade(){
    var ord=BANCOS.slice();
    var vis=_maisB?ord:ord.slice(0,5);
    if(!_maisB&&!vis.some(function(b){return b.id===sel})){
      var achou=ord.find(function(b){return b.id===sel});
      if(achou)vis=[achou].concat(ord.slice(0,4));
    }
    return vis.map(function(b){
      return '<button type="button" class="bcoPil'+(sel===b.id?' on':'')+'" data-b="'+b.id+'">'+
      '<span class="bcoIc" style="background:'+b.c+'">'+b.s+'</span>'+E(b.n)+'</button>';}).join('')+
      (_maisB?'':'<button type="button" class="bcoPil mais" id="bcoMais">+ '+
        Math.max(0,BANCOS.length-5)+' bancos</button>');
  }
  var h='<div class="mdB">'+
  '<div class="blk" style="margin:0;max-width:none">'+
  '<div class="fld2" style="margin-bottom:12px"><label>Banco</label>'+
   '<div class="bcoPils" id="bcoGrid">'+grade()+'</div></div>'+
  '<div class="row2">'+
   '<div class="fld2" style="flex:1.4"><label>Nome da conta *</label>'+
   '<input id="cbN" value="'+E(c?c.nome:'')+'" placeholder="ex: Nubank PJ, Itaú principal"></div>'+
   '<div class="fld2"><label>Saldo inicial</label><div class="cur"><span>R$</span>'+
   '<input id="cbS" type="number" step="0.01" value="'+(c?(c.saldoInicial||0):0)+'"></div></div>'+
  '</div>'+
  '<div class="row2">'+
   '<div class="fld2"><label>Agência</label><input id="cbA" value="'+E(c?c.agencia:'')+'" placeholder="opcional"></div>'+
   '<div class="fld2"><label>Conta</label><input id="cbC" value="'+E(c?c.numero:'')+'" placeholder="opcional"></div>'+
  '</div>'+
  '<div class="avisoInfo">'+sv('help',15)+'<div>O <b>saldo inicial</b> é quanto a conta tinha '+
  'quando você começou a usar o sistema. A partir daí os lançamentos somam e subtraem sozinhos.</div></div>'+
  '</div></div>';
  modal(c?'Editar conta':'Cadastrar conta',h,'Salvar',function(){
    var nome=$('cbN').value.trim();
    if(!nome){toast('Informe o nome da conta.');return false;}
    var o={nome:nome,banco:sel,tipo:'Banco',agencia:$('cbA').value.trim(),
           numero:$('cbC').value.trim(),saldoInicial:parseFloat($('cbS').value)||0};
    if(c)Object.assign(c,o);
    else{o.id=uid('ct');DB.contas.push(o);}
    salvar();telaContas();toast('Conta salva.');return true;
  });
  function ligaPils(){
    var cx=document.getElementById('bcoGrid');
    if(!cx)return;
    var bs=cx.querySelectorAll('.bcoPil');
    for(var i=0;i<bs.length;i++)bs[i].onclick=function(){
      if(this.id==='bcoMais'){_maisB=true;cx.innerHTML=grade();ligaPils();return;}
      sel=this.getAttribute('data-b');
      var t=cx.querySelectorAll('.bcoPil');
      for(var j=0;j<t.length;j++)t[j].classList.remove('on');
      this.classList.add('on');
      var n=$('cbN');if(n&&!n.value)n.value=banco(sel).n;
    };
  }
  ligaPils();
}
async function excluirConta(id){
  var c=DB.contas.find(function(x){return x.id===id});
  if(c.fixa){toast('Contas fixas do sistema não podem ser excluídas.');return;}
  var usos=(DB.lancamentos||[]).filter(function(l){return l.contaId===id}).length;
  if(usos){toast('Esta conta tem '+usos+' lançamento(s). Não é possível excluir.');return;}
  if(!await pergunta('Excluir a conta "'+c.nome+'"?'))return;
  DB.contas=DB.contas.filter(function(x){return x.id!==id}); declararExclusao('contas',id); /* exclusao declarada: so isto autoriza apagar da nuvem (V201) */
  salvar();telaContas();toast('Conta excluída.');
}

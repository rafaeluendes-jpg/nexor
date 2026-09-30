/* ==========================================================
   NENHUM LANÇAMENTO AUTOMÁTICO ENTRAVA NO DRE (RDS 18)

   Oito eventos do sistema criam lançamento financeiro sozinhos: o
   fechamento de caixa, a sangria, a transferência entre contas, o acerto
   com entregadores, o recebimento de fiado, as duas pontas do pedido de
   base e a nota lançada pela Assistente do WhatsApp.

   Todos nasciam com a categoria escrita à mão no código, como TEXTO
   solto — "Frente de Caixa", "Transferência", "Acerto com entregadores"
   —, sem id do plano de contas. E o DRE só enxerga quem tem id:

       var cat=l.categoriaId||''; var rub=c.mapa[cat]; if(!rub)return;

   Ou seja: a venda do dia, a sangria, o acerto do entregador e a compra
   lançada pela Assistente entravam no Fluxo de Caixa como grupos soltos
   e SUMIAM do resultado. O DRE mostrava as despesas digitadas à mão e
   quase nada do que o próprio sistema gera.

   ---------- por que uma tabela, e não um id fixo no código ----------
   O plano de contas é da RDS e muda: a conta analítica de "venda de
   balcão" não é a mesma em toda rede, e não é o programador quem decide
   qual é. A regra passa a ser CONFIGURADA, com vigência e responsável, e
   o código só a consulta.

   ---------- e o que acontece sem regra ----------
   A RDS (item 18) é explícita: sem regra válida, não gerar lançamento
   CONFIRMADO, registrar pendência operacional, e **permitir que o PDV
   continue**. É isso: o lançamento nasce do mesmo jeito (o caixa não
   pode parar por causa de cadastro), marcado como pendente de regra — e
   a tela de Categorias Financeiras diz quantos e quais faltam.
   ========================================================== */
var EVENTOS_AUTO=[
 {id:'fechamento-caixa',  n:'Fechamento de caixa',
  d:'a venda do turno, uma linha por forma de pagamento',       lado:'receita'},
 {id:'mov-caixa',         n:'Sangria e suprimento',
  d:'dinheiro que sai ou entra na gaveta',                      lado:'transferencia'},
 {id:'transferencia',     n:'Transferência entre contas',
  d:'de um banco para outro, sem receita nem despesa',          lado:'transferencia'},
 {id:'acerto-entregador', n:'Acerto com entregadores',
  d:'o que a loja paga ao entregador no acerto',                lado:'despesa'},
 {id:'fiado',             n:'Recebimento de fiado',
  d:'o cliente quitando o que devia',                           lado:'receita'},
 {id:'pedbase-receber',   n:'Pedido de base — a receber',
  d:'a matriz cobrando a unidade',                              lado:'receita'},
 {id:'pedbase-pagar',     n:'Pedido de base — a pagar',
  d:'a unidade pagando a matriz',                               lado:'despesa'},
 {id:'assistente-nota',   n:'Nota da Assistente do WhatsApp',
  d:'a compra que a Assistente lança a partir da foto da nota', lado:'despesa'}
];
function regrasAuto(){
  var c=cfgDRE();
  if(!c.regrasAuto)c.regrasAuto={};
  return c.regrasAuto;
}
/* a subcategoria configurada para o evento — '' quando não há regra
   válida (nunca configurada, ou apontando para categoria que sumiu) */
function categoriaDoEvento(ev){
  try{
    var r=regrasAuto()[ev];
    if(r&&categoriaValida(r))return r;
  }catch(e){ _quieto(e,'categoriaDoEvento'); }
  return '';
}
function eventosSemRegra(){
  return EVENTOS_AUTO.filter(function(e){return !categoriaDoEvento(e.id)});
}
function salvarRegraAuto(ev){
  var s=$('ra_'+ev); if(!s)return;
  var r=regrasAuto();
  var quem=null; try{ quem=usuarioLogado(); }catch(e){}
  if(s.value)r[ev]=s.value; else delete r[ev];
  /* vigência e responsável, como a RDS pede: a regra é uma decisão, e
     decisão sem dono nem data não se audita */
  r['_'+ev]={em:new Date().toISOString(),por:(quem&&quem.nome)||''};
  salvar();
  toast(s.value?'Regra gravada.':'Regra removida.');
  telaCatFin();
  if(NUVEM.ligada)sincronizar();
}
function blocoRegrasAuto(){
  var faltam=eventosSemRegra().length;
  var opts=function(sel){
    return '<option value="">— sem regra —</option>'+
      (DB.catfin||[]).map(function(p){
        return '<optgroup label="'+E(p.nome)+'">'+
          (p.itens||[]).map(function(it){
            return '<option value="'+E(it.id)+'"'+(sel===it.id?' selected':'')+'>'+
              E(it.nome)+'</option>';}).join('')+'</optgroup>';}).join('');
  };
  return '<div class="pnl2"><div class="pnl2H">O que o sistema lança sozinho'+
   (faltam?' <span class="grpTag semCat">'+faltam+' sem regra</span>':'')+'</div>'+
   '<div class="pnl2B">'+
   (faltam
    ? '<div class="imAviso">'+sv('help',14)+'<div><b>'+faltam+
      ' evento(s) ainda sem conta do plano de contas.</b> O lançamento continua '+
      'sendo criado — o caixa não para —, mas sem a conta ele <b>não entra no '+
      'DRE</b>. Escolha a conta de cada um abaixo.</div></div>'
    : '<div class="imAviso" style="background:var(--ok-soft);color:var(--ok)">'+
      sv('check',14)+'<div>Todos os oito eventos têm conta definida: tudo o que o '+
      'sistema lança sozinho entra no resultado.</div></div>')+
   '<table class="pTable"><thead><tr><th>Evento</th>'+
   '<th style="width:280px">Conta do plano de contas</th></tr></thead><tbody>'+
   EVENTOS_AUTO.map(function(e){
     var atual=categoriaDoEvento(e.id);
     return '<tr><td><b>'+E(e.n)+'</b>'+
      (atual?'':' <span class="grpTag semCat">sem regra</span>')+
      '<div class="hint" style="margin:2px 0 0">'+E(e.d)+'</div></td>'+
      '<td><select id="ra_'+E(e.id)+'" onchange="salvarRegraAuto(\''+E(e.id)+'\')">'+
      opts(atual)+'</select></td></tr>';
   }).join('')+
   '</tbody></table></div></div>';
}

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
  /* ==========================================================
     A MESMA TRAVA DE `baseFin` — E AGORA E A MESMA FUNCAO

     Aqui se semeava Caixa e Cofre sempre que eles faltassem, sem
     perguntar se o download ja tinha chegado. Num aparelho recem
     atualizado a tela abria com essas duas contas e mais nada: o Itau
     da loja, que esta na nuvem com agencia, numero e as tres formas de
     pagamento apontando para ele, simplesmente nao aparecia — e a lista
     ainda dizia "2 conta(s)", como se fosse a conta completa.

     `podeSemear` e a regra unica: nao nasce semente enquanto o download
     nao chegou, nem quando a nuvem ja conhece as contas desta loja.
     ========================================================== */
  if(!podeSemear('contas'))return;
  if(!temCaixa&&!DB.contas.some(function(c){return c.fixa==='caixa'}))
    DB.contas.unshift({id:'ct_caixa',nome:'Caixa da loja',tipo:'Caixa',fixa:'caixa',saldoInicial:0,_semente:true});
  if(!temCofre&&!DB.contas.some(function(c){return c.fixa==='cofre'}))
    DB.contas.push({id:'ct_cofre',nome:'Cofre',tipo:'Cofre',fixa:'cofre',saldoInicial:0,_semente:true});
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
  '</div>'+
  blocoRegrasAuto()+
  '</div>';
  var faltam=eventosSemRegra().length;
  rodape((DB.catfin||[]).length+' categorias'+
    (faltam?' · '+faltam+' evento(s) do sistema sem conta':''));
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

/* ==========================================================
   CONTAS BANCÁRIAS
   ========================================================== */
/* ==========================================================
   O SALDO DA CONTA LIA A COLECAO ERRADA

   Esta funcao somava `DB.lancamentos` — a colecao LEGADA, que
   `baseFin()` migra para `DB.lancFin` e que nasce vazia em qualquer
   loja de hoje. Pior: ela procurava `tipo` valendo 'entrada'/'saida', e
   o financeiro de verdade grava 'receita'/'despesa'. Dois motivos para
   nunca achar nada.

   O efeito: o saldo de todo banco cadastrado ficava congelado no saldo
   inicial para sempre. Vendia no cartao, o dinheiro caia na conta, o
   lancamento nascia certo — e a tela de Contas Bancarias, a lista de
   contas do lancamento, a caixa de escolha da forma de pagamento e o
   acerto com entregadores continuavam mostrando o valor do primeiro dia.

   Agora le `DB.lancFin`, que e onde o financeiro mora, com a mesma
   regra que a conciliacao bancaria ja usava:
     - so entra o que esta PAGO (previsto nao e saldo em banco);
     - receita soma, despesa desce;
     - transferencia desce da conta de origem e soma na de destino.
   ========================================================== */
function saldoConta(c){
  if(!c)return 0;
  if(c.fixa==='caixa'){
    var cx=caixaAberto();
    /* ==========================================================
       O SALDO DA CAIXA FECHADA NÃO É ZERO

       03/09/2026. No Financeiro, a Caixa da loja mostrava R$ 0,00 mesmo
       com vendas em dinheiro e sangrias lançadas. A causa era este ramo:
       com o caixa ABERTO, o saldo vem do PDV ao vivo (esperadoCaixa) —
       certo, porque os lançamentos da sessão só nascem no fechamento. Mas
       com o caixa FECHADO, ele retornava ZERO — jogava fora toda a
       movimentação já lançada (vendas em dinheiro, sangrias,
       transferências).

       Agora o caixa fechado cai no MESMO cálculo por lançamentos das
       outras contas (logo abaixo): saldo inicial + receitas − despesas −
       o que saiu em transferência + o que entrou. A Caixa passa a bater
       com as entradas e saídas, como o Cofre e o Banco. */
    if(cx)return esperadoCaixa(cx);
    /* fechado: segue para o cálculo por lançamentos */
  }
  var s=Number(c.saldoInicial)||0;
  (DB.lancFin||[]).forEach(function(l){
    if(!l||!l.pago)return;                 /* a receber/a pagar nao e saldo */
    var v=Number(l.valor)||0;
    if(l.tipo==='transferencia'){
      if(l.contaId===c.id)s-=v;
      if(l.contaDestinoId===c.id)s+=v;
      return;
    }
    if(l.contaId!==c.id)return;
    if(l.tipo==='receita')s+=v; else s-=v;
  });
  /* ==========================================================
     CENTAVO NAO TEM CASA DECIMAL SOBRANDO

     Somando liquido de cartao (66.113,69 + 100 + 99,27 + 97,27) o
     JavaScript devolve 66410.23000000001. Na tela nao aparece, porque
     `money()` corta em dois; mas quem COMPARA saldo — a conciliacao
     bancaria, um confronto com o extrato, um teste — pega a diferenca
     de um bilionesimo e conclui que nao bate.
     ========================================================== */
  return +s.toFixed(2);
}
/* quantos lancamentos financeiros dependem desta conta (pagos ou nao) */
function lancamentosDaConta(id){
  return (DB.lancFin||[]).filter(function(l){
    return l&&(l.contaId===id||l.contaDestinoId===id);}).length;
}
/* ==========================================================
   LISTA INCOMPLETA NAO PODE PARECER LISTA COMPLETA

   Enquanto o download nao chega, `DB.contas` pode estar vazia ou ter so
   o que ja estava neste aparelho. A tela mostrava isso com o mesmo
   rosto de sempre — titulo, total, "2 conta(s)" — e quem olhava
   concluia que a conta do banco tinha sumido. Foi essa a leitura que
   levou a cadastrarem o Itau dez vezes.

   O numero nao muda; o que muda e a tela DIZER que ainda esta
   chegando. Quem sabe que esta incompleto nao cadastra de novo.
   ========================================================== */
function avisoContasIncompleto(){
  if(!esperandoDownload())return '';
  return '<div class="imAviso">'+sv('help',14)+'<div>'+
    '<b>Esta lista ainda está chegando da nuvem.</b> O que aparece aqui é o '+
    'que já estava neste aparelho — pode faltar conta. '+
    '<b>Não cadastre de novo</b> antes de ela terminar de carregar: a conta '+
    'do banco e as formas de pagamento ligadas a ela estão guardadas e voltam '+
    'sozinhas.</div></div>';
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
  avisoContasIncompleto()+

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
    /* grava no registro VIVO (um download com a janela aberta troca os
       objetos de DB.contas) e só diz "salva" depois de conferir na nuvem */
    var vivo=c?DB.contas.find(function(x){return x.id===c.id}):null;
    if(c&&!vivo){toast('Esta conta foi excluída em outro aparelho.');telaContas();return true;}
    if(vivo)Object.assign(vivo,o);
    else{o.id=uid('ct');DB.contas.push(o);}
    salvar();telaContas();
    conferirConfigNaNuvem('contas',vivo?vivo.id:o.id,'Conta',telaContas);
    return true;
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
  /* a mesma correcao do saldo: quem conta e o financeiro de verdade.
     Lendo a colecao legada, uma conta com centenas de lancamentos era
     apagada sem aviso e eles ficavam orfaos. */
  var usos=lancamentosDaConta(id);
  if(usos){toast('Esta conta tem '+usos+' lançamento(s). Não é possível excluir.');return;}
  var formas=(DB.formasPag||[]).filter(function(f){return f.contaId===id});
  if(formas.length){
    toast('Esta conta é o destino de '+formas.length+' forma(s) de pagamento ('+
      formas.map(function(f){return f.nome}).join(', ')+'). Troque o destino antes de excluir.');
    return;
  }
  if(!await pergunta('Excluir a conta "'+c.nome+'"?'))return;
  DB.contas=DB.contas.filter(function(x){return x.id!==id}); declararExclusao('contas',id); /* exclusao declarada: so isto autoriza apagar da nuvem (V201) */
  salvar();telaContas();toast('Conta excluída.');
}

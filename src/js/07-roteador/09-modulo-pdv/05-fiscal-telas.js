/* ==========================================================
   FISCAL — IMPOSTOS DOS PRODUTOS (28/09/2026)

   Rafael: "todos esses inputs que você está anotando de cada produto tem
   uma tela que eu consigo ver, editar qualquer um deles, se tiver algum
   errado, e salvar, ou editar, ou apagar".

   Uma linha por produto, com os códigos que vão para o cupom: NCM, CEST,
   CFOP, CSOSN, CST, origem e unidade. Nada muda no produto enquanto não
   se clica em Salvar; "Tudo salvo" só aparece depois que a nuvem devolve
   a linha gravada — o caixa das lojas lê o produto de lá.

   Os perfis (Gelato e sorvete, Bebidas...) preenchem CFOP/CSOSN/CST de
   uma vez; NCM e CEST são de cada produto.
   ========================================================== */
var IMPF={busca:'',cat:'',pend:false,rasc:{},salvando:false,estado:''};
var CSOSN_OK=['101','102','103','201','202','203','300','400','500','900'];
var CST_OK=['00','10','20','30','40','41','50','51','60','70','90'];
/* ORIGENS_FISCAIS (0 a 8) já existe no cadastro do produto — a mesma lista vale aqui */
var CAMPOS_IMP=['ncm','cest','cfop','csosn','cst','origemFiscal','unTrib'];

function impProdutos(){
  return (DB.produtos||[]).filter(function(p){return p&&p.ativo!==false})
    .sort(function(a,b){return String(a.nome||'').localeCompare(String(b.nome||''),'pt-BR')});
}
/* o valor que a tela mostra: o rascunho, se houver, senão o do produto */
function impValor(p,campo){
  var r=IMPF.rasc[p.id];
  if(r&&r[campo]!==undefined)return r[campo];
  if(campo==='origemFiscal')return p.origemFiscal||'0';
  if(campo==='unTrib')return p.unTrib||'UN';
  return p[campo]||'';
}
function impLinha(p){
  var o={};CAMPOS_IMP.forEach(function(k){o[k]=String(impValor(p,k)||'').trim();});
  return o;
}
/* o que falta, em português: vazio quando a linha está pronta para o cupom */
function impProblemas(p){
  if(ehTaxaEntrega(p))return [];
  var l=impLinha(p),x=[];
  var ncm=fsDigitos(l.ncm),cest=fsDigitos(l.cest),cfop=fsDigitos(l.cfop);
  if(ncm.length!==8)x.push('NCM com 8 números');
  if(cfop.length!==4)x.push('CFOP com 4 números');
  if(l.csosn&&CSOSN_OK.indexOf(l.csosn)<0)x.push('CSOSN inválido');
  if(l.cst&&CST_OK.indexOf(l.cst)<0)x.push('CST inválido');
  if(!l.csosn&&!l.cst)x.push('CSOSN');
  var st=['201','202','203','500'].indexOf(l.csosn)>=0||['10','30','60','70'].indexOf(l.cst)>=0;
  if(st&&cest.length!==7)x.push('CEST com 7 números (substituição tributária)');
  if(cest&&cest.length!==7)x.push('CEST com 7 números');
  return x;
}
function impSujos(){
  return Object.keys(IMPF.rasc).filter(function(id){
    var p=(DB.produtos||[]).find(function(x){return x.id===id});
    if(!p)return false;
    var r=IMPF.rasc[id];
    return Object.keys(r).some(function(k){
      var atual=k==='origemFiscal'?(p.origemFiscal||'0'):k==='unTrib'?(p.unTrib||'UN'):(p[k]||'');
      return String(r[k]||'')!==String(atual);
    });
  });
}
function impFiltrados(){
  var q=String(IMPF.busca||'').toLowerCase().trim();
  return impProdutos().filter(function(p){
    if(IMPF.cat&&p.categoriaId!==IMPF.cat)return false;
    if(q&&String(p.nome||'').toLowerCase().indexOf(q)<0&&
       String(impValor(p,'ncm')).indexOf(q)<0)return false;
    if(IMPF.pend&&!impProblemas(p).length)return false;
    return true;
  });
}
function _impCel(p,campo,ph,max,larg){
  var dis=ehTaxaEntrega(p)?' disabled':'';
  return '<input class="impIn" style="width:'+larg+'px" data-p="'+E(p.id)+'" data-c="'+campo+'" '+
    'value="'+E(impValor(p,campo))+'" maxlength="'+max+'" inputmode="numeric" placeholder="'+(dis?'':ph)+'" '+
    'aria-label="'+E(campo.toUpperCase()+' de '+(p.nome||''))+'"'+dis+
    ' oninput="impMudou(\''+E(p.id)+'\',\''+campo+'\',this.value)">';
}
function telaImpostosProdutos(){
  GUARDA.fn=function(){return impSujos().length?'Há '+impSujos().length+
    ' produto(s) com mudança ainda não salva nesta tela.':''};
  var todos=impProdutos();
  var lst=impFiltrados();
  var comPend=todos.filter(function(p){return impProblemas(p).length}).length;
  var sujos=impSujos();
  var perfis=perfisFiscais();
  var cats=(DB.categorias||[]).filter(function(c){
    return todos.some(function(p){return p.categoriaId===c.id});});
  var estado=IMPF.salvando?'Salvando…':sujos.length?'Há mudanças ainda não salvas ('+sujos.length+' produto'+(sujos.length>1?'s':'')+')':
    (IMPF.estado||'Tudo salvo');
  $('content').innerHTML='<div class="etWrap"><div class="etScroll">'+
   '<div class="etTopo">'+
    '<div><h1>Impostos dos Produtos</h1><p>Os códigos que cada produto leva no cupom fiscal. '+
     'Confira com o seu contador.</p></div>'+
    '<div class="etTot">'+
     '<div class="etT"><span>Produtos ativos</span><b>'+todos.length+'</b></div>'+
     '<div class="etT"><span>Com pendência</span><b class="'+(comPend?'vr':'vg')+'">'+comPend+'</b></div>'+
    '</div>'+
    '<button class="infoBt" aria-label="O que é cada código" onclick="explicaImpostos()">'+sv('help',15)+'</button>'+
   '</div>'+
   '<div class="impBarra">'+
    '<div class="permSalvar" style="margin:0">'+
     '<span id="impEstado" class="'+(sujos.length?'sujo':'')+'">'+E(estado)+'</span>'+
     '<div style="display:flex;gap:8px;flex-wrap:wrap">'+
      (sujos.length?'<button class="btnP2" onclick="impDescartar()">Descartar mudanças</button>':'')+
      '<button class="btnP2 ok" id="impSalvar" onclick="impSalvar()"'+(IMPF.salvando?' disabled':'')+'>'+
       sv('check',13)+' Salvar</button>'+
     '</div></div>'+
   '</div>'+
   '<div class="etFiltros">'+
    '<div class="f2 gw2"><label>Buscar</label><input id="impB" value="'+E(IMPF.busca)+'" '+
     'placeholder="nome do produto ou NCM" onkeydown="if(event.key===\'Enter\'){IMPF.busca=this.value;telaImpostosProdutos()}"></div>'+
    '<div class="f2"><label>Categoria</label><select id="impCat" onchange="IMPF.cat=this.value;telaImpostosProdutos()">'+
     '<option value="">Todas</option>'+cats.map(function(c){
       return '<option value="'+E(c.id)+'"'+(IMPF.cat===c.id?' selected':'')+'>'+E(c.nome)+'</option>';}).join('')+
    '</select></div>'+
    '<label class="impPend"><input type="checkbox"'+(IMPF.pend?' checked':'')+
     ' onchange="IMPF.pend=this.checked;telaImpostosProdutos()"> Só com pendência</label>'+
    '<button class="btnP2" onclick="IMPF.busca=($(\'impB\')||{}).value||\'\';telaImpostosProdutos()">'+sv('search',13)+' Buscar</button>'+
   '</div>'+
   /* aplicar um perfil a vários de uma vez: vai para o rascunho, e só
      grava no Salvar — dá para conferir antes */
   '<div class="impLote">'+
    '<span>Aplicar perfil</span>'+
    '<select id="impPerfilLote" aria-label="Perfil">'+perfis.map(function(pf){
      return '<option value="'+E(pf.id)+'">'+E(pf.nome)+' (CFOP '+E(pf.cfop)+' · CSOSN '+E(pf.csosn)+')</option>';}).join('')+
    '</select>'+
    '<span>aos '+lst.length+' produto(s) da lista</span>'+
    '<button class="btnP2" onclick="impAplicarPerfilLista()">Aplicar</button>'+
   '</div>'+
   '<div class="etTabW plano2">'+
   (lst.length?'<table class="etTab semBusca impTab"><thead><tr>'+
    '<th>Produto</th><th style="width:170px">Perfil</th>'+
    '<th style="width:104px">NCM</th><th style="width:92px">CEST</th>'+
    '<th style="width:70px">CFOP</th><th style="width:74px">CSOSN</th><th style="width:60px">CST</th>'+
    '<th style="width:74px">Origem</th><th style="width:70px">Unid.</th>'+
    '<th style="width:150px">Situação</th><th style="width:44px"></th></tr></thead><tbody>'+
    lst.map(function(p){
      var cat=(DB.categorias||[]).find(function(c){return c.id===p.categoriaId})||{};
      var pb=impProblemas(p);
      var taxa=ehTaxaEntrega(p);
      var pfAt=perfilDoProduto(impLinha(p));
      var sujo=sujos.indexOf(p.id)>=0;
      return '<tr id="impL_'+E(p.id)+'" class="'+(sujo?'impSujo':'')+'">'+
       '<td><b>'+E(p.nome)+'</b><small>'+E(cat.nome||'sem categoria')+'</small></td>'+
       '<td>'+(taxa?'<small>vai como taxa de entrega</small>':
        '<select class="impIn" aria-label="Perfil de '+E(p.nome)+'" onchange="impPerfil(\''+E(p.id)+'\',this.value)">'+
         '<option value="">'+(pfAt?'':'Personalizado')+'</option>'+
         perfis.map(function(pf){return '<option value="'+E(pf.id)+'"'+(pfAt===pf?' selected':'')+'>'+E(pf.nome)+'</option>';}).join('')+
        '</select>')+'</td>'+
       '<td>'+_impCel(p,'ncm','8 números',10,96)+'</td>'+
       '<td>'+_impCel(p,'cest','7 números',9,84)+'</td>'+
       '<td>'+_impCel(p,'cfop','5102',4,62)+'</td>'+
       '<td>'+_impCel(p,'csosn','102',3,62)+'</td>'+
       '<td>'+_impCel(p,'cst','00',2,50)+'</td>'+
       '<td><select class="impIn" aria-label="Origem de '+E(p.nome)+'"'+(taxa?' disabled':'')+
         ' onchange="impMudou(\''+E(p.id)+'\',\'origemFiscal\',this.value)">'+
         ORIGENS_FISCAIS.map(function(o){return '<option value="'+o.id+'" title="'+E(o.n)+'"'+
           (String(impValor(p,'origemFiscal'))===o.id?' selected':'')+'>'+o.id+'</option>';}).join('')+'</select></td>'+
       '<td><select class="impIn" aria-label="Unidade de '+E(p.nome)+'"'+(taxa?' disabled':'')+
         ' onchange="impMudou(\''+E(p.id)+'\',\'unTrib\',this.value)">'+
         ['UN','KG','LT','CX','PC'].map(function(u){return '<option'+(impValor(p,'unTrib')===u?' selected':'')+'>'+u+'</option>';}).join('')+
        '</select></td>'+
       '<td class="impSit">'+_impSituacao(p,pb,sujo)+'</td>'+
       '<td>'+(taxa?'':'<button class="rBtn rd" title="Apagar os códigos deste produto" aria-label="Apagar os códigos de '+E(p.nome)+'" '+
         'onclick="impLimpar(\''+E(p.id)+'\')">'+sv('trash',12)+'</button>')+'</td>'+
      '</tr>';
    }).join('')+'</tbody></table>'
   :'<div class="entVazio"><b>Nenhum produto nesta busca</b><span>Mude o filtro ou a categoria.</span></div>')+
   '</div></div></div>';
  rodape(todos.length+' produtos · '+comPend+' com pendência');
}
function _impSituacao(p,pb,sujo){
  if(ehTaxaEntrega(p))return '<span class="impOk">não precisa de código</span>';
  if(pb.length)return '<span class="impFalta">Falta: '+E(pb.join(', '))+'</span>';
  return '<span class="impOk">'+sv('check',12)+(sujo?' pronto (não salvo)':' pronto para o cupom')+'</span>';
}
function impMudou(pid,campo,valor){
  var p=(DB.produtos||[]).find(function(x){return x.id===pid});if(!p)return;
  IMPF.rasc[pid]=IMPF.rasc[pid]||{};
  IMPF.rasc[pid][campo]=String(valor||'').trim();
  IMPF.estado='';
  /* só a linha e a barra mudam — refazer a tela inteira tiraria o cursor do campo */
  var tr=document.getElementById('impL_'+pid);
  var sujo=impSujos().indexOf(pid)>=0;
  if(tr){
    tr.classList.toggle('impSujo',sujo);
    var sit=tr.querySelector('.impSit');if(sit)sit.innerHTML=_impSituacao(p,impProblemas(p),sujo);
  }
  var n=impSujos().length,el=document.getElementById('impEstado');
  if(el){el.textContent=n?'Há mudanças ainda não salvas ('+n+' produto'+(n>1?'s':'')+')':'Tudo salvo';
    el.className=n?'sujo':'';}
}
function impPerfil(pid,perfilId){
  var pf=perfisFiscais().find(function(x){return x.id===perfilId});if(!pf)return;
  ['cfop','csosn','cst'].forEach(function(k){impMudou(pid,k,pf[k]);});
  telaImpostosProdutos();
}
function impAplicarPerfilLista(){
  var pf=perfisFiscais().find(function(x){return x.id===(($('impPerfilLote')||{}).value)});
  if(!pf)return;
  var lst=impFiltrados().filter(function(p){return !ehTaxaEntrega(p)});
  if(!lst.length){toast('Nenhum produto na lista.');return;}
  lst.forEach(function(p){['cfop','csosn','cst'].forEach(function(k){
    IMPF.rasc[p.id]=IMPF.rasc[p.id]||{};IMPF.rasc[p.id][k]=pf[k];});});
  IMPF.estado='';
  telaImpostosProdutos();
  toast('"'+pf.nome+'" aplicado a '+lst.length+' produto(s). Confira e clique em Salvar.');
}
async function impLimpar(pid){
  var p=(DB.produtos||[]).find(function(x){return x.id===pid});if(!p)return;
  var ok=await confirmar({titulo:'Apagar os códigos de '+(p.nome||''),
    texto:'NCM, CEST, CFOP, CSOSN e CST ficam em branco.',
    aviso:'Sem os códigos, o cupom deste produto é recusado até você preencher de novo. '+
      'Só vale depois de clicar em Salvar.',
    ok:'Apagar os códigos',cancelar:'Voltar',tipo:'perigo'});
  if(!ok)return;
  IMPF.rasc[pid]=IMPF.rasc[pid]||{};
  ['ncm','cest','cfop','csosn','cst'].forEach(function(k){IMPF.rasc[pid][k]='';});
  IMPF.estado='';
  telaImpostosProdutos();
}
function impDescartar(){
  IMPF.rasc={};IMPF.estado='';
  telaImpostosProdutos();
}
/* a linha da nuvem que corresponde ao produto deste aparelho */
function _impFiltroNuvem(p){
  var uu=DB._uuid&&DB._uuid.produtos&&DB._uuid.produtos[p.id];
  return uu?'id=eq.'+encodeURIComponent(uu)
           :'ref_local=eq.'+encodeURIComponent(p.id);
}
async function impSalvar(){
  if(IMPF.salvando)return;
  var ids=impSujos();
  if(!ids.length){toast('Nada mudou — tudo já está salvo.');return;}
  var prods=ids.map(function(id){return (DB.produtos||[]).find(function(x){return x.id===id})}).filter(Boolean);
  /* formato errado não sai daqui: NCM 8, CEST 7, CFOP 4 números */
  var ruins=prods.filter(function(p){
    var l=impLinha(p);
    return (l.ncm&&fsDigitos(l.ncm).length!==8)||(l.cest&&fsDigitos(l.cest).length!==7)||
           (l.cfop&&fsDigitos(l.cfop).length!==4)||(l.csosn&&CSOSN_OK.indexOf(l.csosn)<0)||
           (l.cst&&CST_OK.indexOf(l.cst)<0);
  });
  if(ruins.length){
    painelErro('Confira antes de salvar.',ruins.slice(0,5).map(function(p){
      return (p.nome||'')+': '+impProblemas(p).join(', ');}).join(' · '));
    return;
  }
  IMPF.salvando=true;IMPF.estado='';telaImpostosProdutos();
  var falhou=[],gravados=0,soAqui=!(NUVEM.ligada&&NUVEM.token&&NUVEM.loja);
  for(var i=0;i<prods.length;i++){
    var p=prods[i],l=impLinha(p);
    var corpo={ncm:fsDigitos(l.ncm)||null,cest:fsDigitos(l.cest)||null,cfop:fsDigitos(l.cfop)||null,
      csosn:l.csosn||null,cst:l.cst||null,origem_fiscal:l.origemFiscal||'0',unidade_tributavel:l.unTrib||'UN'};
    if(!soAqui){
      try{
        var r=await api('produtos?loja_id=eq.'+(p._loja||NUVEM.loja)+'&'+_impFiltroNuvem(p),'PATCH',corpo,
          {'Prefer':'return=representation'});
        if(!r||!r.length||String(r[0].ncm||'')!==String(corpo.ncm||'')){falhou.push(p.nome);continue;}
      }catch(e){falhou.push(p.nome);continue;}
    }
    p.ncm=corpo.ncm||'';p.cest=corpo.cest||'';p.cfop=corpo.cfop||'';p.csosn=corpo.csosn||'';p.cst=corpo.cst||'';
    p.origemFiscal=corpo.origem_fiscal;p.unTrib=corpo.unidade_tributavel;p.alterado=Date.now();
    delete IMPF.rasc[p.id];gravados++;
  }
  salvar();
  IMPF.salvando=false;
  if(falhou.length){
    IMPF.estado='';
    telaImpostosProdutos();
    painelErro('A nuvem não confirmou '+falhou.length+' produto(s).',
      falhou.slice(0,6).join(', ')+'. Eles continuam marcados como não salvos — tente de novo.');
    return;
  }
  IMPF.estado=soAqui?'Salvo só neste aparelho — sobe quando a internet voltar':'Tudo salvo';
  if(soAqui&&typeof sincronizar==='function'&&NUVEM.ligada){try{sincronizar();}catch(e){_quieto(e,'impSalvar')}}
  telaImpostosProdutos();
  toast(gravados+' produto(s) salvos'+(soAqui?' neste aparelho.':'. As lojas recebem na próxima atualização.'));
}
function explicaImpostos(){
  confirmar({titulo:'O que é cada código',texto:'Impostos dos Produtos',
   linhas:[['NCM','a classificação do produto (8 números). Sorvete: 2105.00.10',''],
           ['CEST','obrigatório quando o imposto já foi pago antes (7 números)',''],
           ['CFOP','o tipo de operação. 5405: revenda com imposto já pago; 5102: revenda comum',''],
           ['CSOSN','a situação do imposto no Simples. 500: já pago antes; 102: sem crédito',''],
           ['CST','o mesmo, para empresa fora do Simples',''],
           ['Origem','0 para produto nacional','']],
   aviso:'Os códigos foram preenchidos pelos padrões de sorveteria. Quem confirma é o seu '+
     'contador — mude aqui o que ele pedir e clique em Salvar.',
   ok:'Entendi',cancelar:null}).then(function(){});
}

/* ==========================================================
   FISCAL — NOTAS FISCAIS (NF-e), SÓ NA MATRIZ (28/09/2026)

   Rafael: "A tela da nota fiscal. Como é que faz para a gente emitir nota
   fiscal, colocar produto, frete, tal?"

   Duas partes: a lista das notas que a matriz emitiu (lida da Spedy, que
   é onde a nota vive — nada a sincronizar, nada a perder) e o formulário
   de uma nota nova: destinatário, operação, produtos, frete e
   transportadora, pagamento. O rascunho fica guardado neste aparelho
   enquanto a nota não é emitida; sair da tela não perde nada.

   A nota sai com o CNPJ da matriz — é o servidor que escolhe a chave,
   nunca esta tela.
   ========================================================== */
var NF={aba:'lista',de:'',ate:'',atalho:'',status:'',lista:null,carregando:false,erro:'',form:null,emitindo:false};
var NATUREZAS_NFE=[
 {id:'venda',n:'Venda de mercadoria',op:'Venda de Mercadoria',cfop:null},
 {id:'producao',n:'Venda de produção própria',op:'Venda de Produção do Estabelecimento',cfop:'5101',csosn:'102'},
 {id:'bonificacao',n:'Bonificação, doação ou brinde',op:'Remessa em Bonificação',cfop:'5910',csosn:'400'},
 {id:'devolucao',n:'Devolução de compra',op:'Devolução de Compra',cfop:'5202',csosn:'900',finalidade:'devolution'},
 {id:'remessa',n:'Outra saída (remessa)',op:'Outras Saídas',cfop:'5949',csosn:'400'}
];
var FRETES_NFE=[['free','Sem frete'],['byIssuer','Por conta de quem vende (CIF)'],
  ['byReceiver','Por conta de quem compra (FOB)'],['byThirdParties','Por conta de terceiros'],
  ['byIssuerOwnTransport','Transporte próprio de quem vende'],['byReceiverOwnTransport','Transporte próprio de quem compra']];
var PAGS_NFE=[['pix','PIX'],['money','Dinheiro'],['billetBanking','Boleto'],['creditCard','Cartão de crédito'],
  ['debitCard','Cartão de débito'],['bankTransfer','Transferência bancária'],['commercialDuplicate','A prazo (duplicata)'],
  ['noPayment','Sem pagamento'],['other','Outro']];
var UFS_BR=['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'];

function nfMatrizRef(){
  var m=(DB.sucursais||[]).find(function(s){return s&&s.matriz&&s.ativa!==false});
  return m?m.id:'';
}
function nfFormNovo(){
  return {id:uid('nfe'),natureza:'venda',naturezaTexto:'',finalidade:'normal',chaveRef:'',
    presenca:'othersNonPresenceOperation',
    dest:{doc:'',nome:'',ie:'',isentoIe:false,email:'',fone:'',cep:'',rua:'',numero:'',compl:'',bairro:'',cidade:'',uf:'SP',ibge:''},
    itens:[],
    frete:{modalidade:'free',valor:'',transpDoc:'',transpNome:'',transpIe:'',transpEnd:'',transpCidade:'',transpUf:'',
      volQtd:'',volEsp:'',pesoL:'',pesoB:'',placa:'',placaUf:''},
    seguro:'',outras:'',desconto:'',pag:'pix',info:''};
}
function nfGuardarRascunho(){
  try{localStorage.setItem('joia_nfe_rascunho',JSON.stringify(NF.form));}catch(e){}
}
function nfLerRascunho(){
  try{var t=localStorage.getItem('joia_nfe_rascunho');if(t)return JSON.parse(t);}catch(e){}
  return null;
}
function _nfNum(v){var n=parseFloat(String(v==null?'':v).replace(/\./g,'').replace(',','.'));return isFinite(n)?n:0;}
function _nfNumPonto(v){var t=String(v==null?'':v).trim();if(/,/.test(t))return _nfNum(t);var n=parseFloat(t);return isFinite(n)?n:0;}
function nfUfEmitente(){
  var u=fiscalUn(nfMatrizRef());
  return String((u.spedy&&u.spedy.uf)||'SP').toUpperCase();
}
/* 5xxx dentro do estado, 6xxx para outro estado */
function nfCfopDestino(cfop,ufDest){
  var c=fsDigitos(cfop);if(c.length!==4)return c;
  var inter=ufDest&&ufDest!==nfUfEmitente();
  if(inter&&c[0]==='5')return '6'+c.slice(1);
  if(!inter&&c[0]==='6')return '5'+c.slice(1);
  return c;
}
function nfTotais(f){
  var prod=0,desc=0;
  (f.itens||[]).forEach(function(it){
    prod+=+(_nfNumPonto(it.qtd)*_nfNumPonto(it.valor)).toFixed(2);
    desc+=_nfNumPonto(it.desconto);
  });
  desc+=_nfNumPonto(f.desconto);
  var frete=f.frete.modalidade==='free'?0:_nfNumPonto(f.frete.valor);
  var seg=_nfNumPonto(f.seguro),out=_nfNumPonto(f.outras);
  prod=+prod.toFixed(2);desc=+desc.toFixed(2);
  return {produtos:prod,desconto:desc,frete:+frete.toFixed(2),seguro:+seg.toFixed(2),outras:+out.toFixed(2),
    total:+(prod-desc+frete+seg+out).toFixed(2)};
}
/* o que falta, em português, antes de mandar para a Receita */
function nfProblemas(f){
  var x=[],d=f.dest,doc=fsDigitos(d.doc);
  /* o emitente também: sem IE ou sem certificado a SEFAZ recusa a nota */
  var em=fiscalUn(nfMatrizRef()).spedy;
  if(em&&!em.ie)x.push('inscrição estadual da matriz (Fiscal › Configuração Fiscal, com a matriz escolhida no alto)');
  if(em&&!em.certificado)x.push('certificado digital da matriz (Fiscal › Configuração Fiscal)');
  if(!(doc.length===11||doc.length===14)||!docFiscalValido(doc))x.push('CPF ou CNPJ do destinatário');
  if(!String(d.nome||'').trim())x.push('nome do destinatário');
  /* empresa com IE na SEFAZ e nota sem ela: "Rejeição 232 — IE do
     destinatário não informada" (visto no teste de 28/09/2026) */
  if(doc.length===14&&!d.isentoIe&&!fsDigitos(d.ie))x.push('inscrição estadual do destinatário (ou marque "Isento de IE")');
  if(!String(d.rua||'').trim()||!String(d.numero||'').trim()||!String(d.bairro||'').trim())x.push('endereço do destinatário (rua, número e bairro)');
  if(fsDigitos(d.cep).length!==8)x.push('CEP do destinatário');
  if(!String(d.cidade||'').trim()||UFS_BR.indexOf(d.uf)<0)x.push('cidade e estado do destinatário');
  if(!(f.itens||[]).length)x.push('pelo menos um produto');
  (f.itens||[]).forEach(function(it,i){
    var n='item '+(i+1)+' ('+(it.descricao||'sem nome')+')';
    if(!String(it.descricao||'').trim())x.push(n+': descrição');
    if(fsDigitos(it.ncm).length!==8)x.push(n+': NCM');
    if(fsDigitos(it.cfop).length!==4)x.push(n+': CFOP');
    if(!(_nfNumPonto(it.qtd)>0))x.push(n+': quantidade');
    if(!(_nfNumPonto(it.valor)>0))x.push(n+': valor');
    var st=['201','202','203','500'].indexOf(String(it.csosn))>=0;
    if(st&&fsDigitos(it.cest).length!==7)x.push(n+': CEST');
  });
  if(f.finalidade==='devolution'&&fsDigitos(f.chaveRef).length!==44)x.push('chave da nota que está sendo devolvida (44 números)');
  if(f.natureza==='outra'&&!String(f.naturezaTexto||'').trim())x.push('natureza da operação');
  var t=nfTotais(f);
  if(!(t.total>0)&&f.pag!=='noPayment')x.push('valor total da nota');
  return x;
}
/* a nota no formato da Spedy (OpenAPI v1, /product-invoices) */
function montarNfe(f){
  var t=nfTotais(f),d=f.dest,doc=fsDigitos(d.doc);
  var nat=NATUREZAS_NFE.find(function(n){return n.id===f.natureza});
  var inter=d.uf!==nfUfEmitente();
  var linhas=(f.itens||[]).map(function(it,i){
    var qtd=_nfNumPonto(it.qtd),vu=_nfNumPonto(it.valor),tot=+(qtd*vu).toFixed(2);
    var csosn=String(it.csosn||'102');
    return {code:String(it.codigo||('ITEM'+(i+1))).slice(0,60),description:String(it.descricao).slice(0,120),
      ncm:fsDigitos(it.ncm),cest:fsDigitos(it.cest)||undefined,cfop:Number(nfCfopDestino(it.cfop,d.uf)),
      unit:it.un||'UN',quantity:qtd,unitAmount:vu,totalAmount:tot,
      unitTax:it.un||'UN',quantityTax:qtd,unitTaxAmount:vu,makeupTotal:true,
      discountAmount:_nfNumPonto(it.desconto)||undefined,
      taxes:{icms:{origin:Number(it.origem||0)||0,csosn:Number(csosn)},pis:{cst:7},cofins:{cst:7}}};
  });
  /* frete, seguro, outras despesas e desconto geral: a soma dos itens tem
     de bater com o total da nota, então cada valor é repartido pelos itens */
  var pesos=linhas.map(function(l){return l.totalAmount});
  [['frete','freightAmount'],['seguro','insuranceAmount'],['outras','othersAmount']].forEach(function(par){
    var dv=_dist(t[par[0]],pesos);
    linhas.forEach(function(l,k){if(dv[k]>0)l[par[1]]=dv[k];});
  });
  var dg=_dist(_nfNumPonto(f.desconto),pesos);
  linhas.forEach(function(l,k){if(dg[k]>0)l.discountAmount=+((l.discountAmount||0)+dg[k]).toFixed(2);});
  var ender={street:String(d.rua).trim(),number:String(d.numero).trim(),district:String(d.bairro).trim(),
    postalCode:fsDigitos(d.cep),additionalInformation:String(d.compl||'').trim()||undefined,
    city:fsDigitos(d.ibge).length===7?{code:fsDigitos(d.ibge),name:d.cidade,state:d.uf}:{name:d.cidade,state:d.uf}};
  var nota={
    integrationId:f.id,
    isFinalCustomer:doc.length===11||!!d.isentoIe||!fsDigitos(d.ie),
    operationType:'outgoing',destination:inter?'interstate':'internal',
    presenceType:f.presenca||'othersNonPresenceOperation',
    purposeType:f.finalidade||'normal',
    operationNature:f.natureza==='outra'?String(f.naturezaTexto).trim().slice(0,60):(nat?nat.op:'Venda de Mercadoria'),
    sendEmailToCustomer:!!String(d.email||'').trim(),
    receiver:{federalTaxNumber:doc,name:String(d.nome).trim().slice(0,60),
      stateTaxNumber:d.isentoIe?'ISENTO':(fsDigitos(d.ie)||undefined),
      email:String(d.email||'').trim()||undefined,phoneNumber:fsDigitos(d.fone)||undefined,address:ender},
    items:linhas,
    payments:[f.pag==='noPayment'?{method:'noPayment',amount:0}:{method:f.pag||'pix',amount:t.total}],
    total:{invoiceAmount:t.total,productAmount:t.produtos,discountAmount:t.desconto||undefined,
      freightAmount:t.frete||undefined,insuranceAmount:t.seguro||undefined,othersAmount:t.outras||undefined},
    additionalInformation:String(f.info||'').trim()||undefined
  };
  var fr=f.frete;
  var tr={freightModality:fr.modalidade||'free'};
  if(fr.modalidade!=='free'){
    if(fsDigitos(fr.transpDoc)||String(fr.transpNome||'').trim())
      tr.carrier={federalTaxNumber:fsDigitos(fr.transpDoc)||undefined,name:String(fr.transpNome||'').trim()||undefined,
        stateTaxNumber:fsDigitos(fr.transpIe)||undefined,
        address:String(fr.transpEnd||'').trim()?{street:String(fr.transpEnd).trim(),
          city:{name:String(fr.transpCidade||'').trim(),state:fr.transpUf||undefined}}:undefined};
    if(_nfNumPonto(fr.volQtd)>0||_nfNumPonto(fr.pesoB)>0)
      tr.volume={quantity:Math.round(_nfNumPonto(fr.volQtd))||0,species:String(fr.volEsp||'').trim()||undefined,
        netWeight:_nfNumPonto(fr.pesoL)||undefined,grossWeight:_nfNumPonto(fr.pesoB)||undefined};
    if(String(fr.placa||'').trim())tr.vehicle={plate:String(fr.placa).trim().toUpperCase(),
      state:fr.placaUf?String(fr.placaUf).toLowerCase():undefined};
  }
  nota.transport=tr;
  if(f.finalidade==='devolution'&&fsDigitos(f.chaveRef).length===44)
    nota.referencedDocuments=[{accessKey:fsDigitos(f.chaveRef)}];
  return nota;
}

/* ---------------- a tela ---------------- */
async function telaNotasFiscais(){
  var mref=nfMatrizRef();
  if(!NF.form)NF.form=nfLerRascunho()||nfFormNovo();
  if(!NF.de){var hj=hojeISO().split('-');NF.de=hj[0]+'-'+hj[1]+'-01';NF.ate=hojeISO();NF.atalho='mes';}
  var u=fiscalUn(mref);
  /* o emitente (a matriz) vem do servidor; sem ele não se sabe a UF nem o CNPJ */
  if(mref&&(!u.spedy||!u.lidoEm||(Date.now()-Date.parse(u.lidoEm))>300000)&&NUVEM.ligada&&NUVEM.token&&!NF._lendoMatriz){
    NF._lendoMatriz=true;
    try{await fiscalCarregar(mref);}finally{NF._lendoMatriz=false;}
    u=fiscalUn(mref);
  }
  if(NF.aba==='lista'&&NF.lista===null&&!NF.carregando)nfBuscar();
  var emit='<div class="fsUnidade"><span>Emitente</span><b>'+E((u.spedy&&u.spedy.nome)||u.razao||sucNome(mref))+'</b>'+
    '<em>'+E(fsCnpjFmt((u.spedy&&u.spedy.cnpj)||u.cnpj))+' · '+
    (u.ambiente==='producao'?'produção — vale para a Receita':'homologação — teste, sem valor fiscal')+'</em></div>';
  var abas='<div class="nfAbas" role="tablist">'+
    '<button role="tab" class="'+(NF.aba==='lista'?'on':'')+'" onclick="NF.aba=\'lista\';telaNotasFiscais()">Notas emitidas</button>'+
    '<button role="tab" class="'+(NF.aba==='nova'?'on':'')+'" onclick="NF.aba=\'nova\';telaNotasFiscais()">'+sv('plus',13)+' Nova nota fiscal</button>'+
   '</div>';
  var corpo=!mref?'<div class="entVazio"><b>Nenhuma unidade marcada como matriz</b>'+
      '<span>Marque a matriz em Configuração da Loja › Sucursais da Franquia.</span></div>'
    :!u.vinculada?'<div class="fscPend">'+sv('help',16)+'<div><b>A matriz ainda não está ligada ao emissor</b>'+
      'Ligue em Fiscal › Configuração Fiscal, com a matriz escolhida no alto.</div></div>'
    :(NF.aba==='lista'?nfHtmlLista():nfHtmlForm());
  $('content').innerHTML='<div class="etWrap"><div class="etScroll">'+
   '<div class="etTopo"><div><h1>Notas Fiscais (NF-e)</h1>'+
    '<p>Nota de produto para empresas e pessoas — emitida só pela matriz.</p></div></div>'+
   '<div class="fsTopo">'+emit+abas+'</div>'+
   '<div class="nfCorpo">'+corpo+'</div>'+
  '</div></div>';
  rodape(NF.aba==='lista'?((NF.lista||[]).length+' nota(s) no período'):'nova nota fiscal');
}

/* ---------- lista ---------- */
async function nfBuscar(){
  var mref=nfMatrizRef();if(!mref)return;
  if(!NUVEM.ligada||!NUVEM.token){NF.erro='Sem conexão com a nuvem — a lista vem do emissor de notas.';NF.lista=[];return;}
  NF.carregando=true;NF.erro='';
  var r=await fiscalChamar('nfe_listar',{sucursal:mref,de:NF.de,ate:NF.ate});
  NF.carregando=false;
  if(!r.ok){NF.erro=(r.d&&r.d.erro)||'O emissor não respondeu agora.';NF.lista=[];}
  else NF.lista=r.d.notas||[];
  if(S.mod==='fiscal'&&S.it==='notas'&&NF.aba==='lista')telaNotasFiscais();
}
function nfPeriodo(qual){
  var h=hojeISO(),p=h.split('-'),d=new Date(+p[0],+p[1]-1,+p[2]);
  if(qual==='hoje'){NF.de=NF.ate=h;}
  else if(qual==='7d'){var s7=new Date(d);s7.setDate(s7.getDate()-6);NF.de=_isoDia(s7);NF.ate=h;}
  else if(qual==='mes'){NF.de=_isoDia(new Date(d.getFullYear(),d.getMonth(),1));NF.ate=h;}
  else if(qual==='mesAnt'){NF.de=_isoDia(new Date(d.getFullYear(),d.getMonth()-1,1));NF.ate=_isoDia(new Date(d.getFullYear(),d.getMonth(),0));}
  else if(qual==='pers'){NF.de=($('nfDe')||{}).value||NF.de;NF.ate=($('nfAte')||{}).value||NF.ate;}
  NF.atalho=qual;NF.lista=null;
  telaNotasFiscais();
}
function nfHtmlLista(){
  var lst=(NF.lista||[]).filter(function(n){return !NF.status||n.status===NF.status})
    .sort(function(a,b){return String(b.emitidaEm||b.autorizadaEm||'').localeCompare(String(a.emitidaEm||a.autorizadaEm||''))});
  var aut=lst.filter(function(n){return n.status==='autorizado'});
  var soma=aut.reduce(function(a,n){return a+(Number(n.valor)||0)},0);
  return '<div class="bfAtalhos cfAtalhos">'+
    [['hoje','Hoje'],['7d','7 dias'],['mes','Este mês'],['mesAnt','Mês anterior']].map(function(a){
      return '<button class="'+(NF.atalho===a[0]?'on':'')+'" onclick="nfPeriodo(\''+a[0]+'\')">'+a[1]+'</button>';}).join('')+
   '</div>'+
   '<div class="filtroCard">'+
    '<div class="fl"><label>Data inicial</label><input type="date" id="nfDe" value="'+E(NF.de)+'"></div>'+
    '<div class="fl"><label>Data final</label><input type="date" id="nfAte" value="'+E(NF.ate)+'"></div>'+
    '<div class="fl"><label>Status</label><select id="nfSt" onchange="NF.status=this.value;telaNotasFiscais()"><option value="">Todos</option>'+
     STATUS_CUPOM.filter(function(s){return ['agrupado','sem_valor','pendente'].indexOf(s.id)<0}).map(function(s){
       return '<option value="'+s.id+'"'+(NF.status===s.id?' selected':'')+'>'+E(s.n)+'</option>';}).join('')+'</select></div>'+
    '<button class="btnP2 ok" onclick="nfPeriodo(\'pers\')">'+sv('search',14)+' Buscar</button>'+
   '</div>'+
   '<div class="cfTotais">'+
    '<div><span>Notas autorizadas</span><b>'+aut.length+'</b></div>'+
    '<div><span>Valor autorizado</span><b>R$ '+money(soma)+'</b></div>'+
    '<div><span>Canceladas</span><b>'+lst.filter(function(n){return n.status==='cancelado'}).length+'</b></div>'+
    '<div><span>Rejeitadas</span><b>'+lst.filter(function(n){return n.status==='rejeitado'}).length+'</b></div>'+
   '</div>'+
   (NF.erro?'<div class="fscPend">'+sv('help',16)+'<div><b>Não consegui buscar as notas</b>'+E(NF.erro)+'</div></div>':'')+
   '<div class="pnl2"><div class="pnl2H">Notas <span class="cnt2">'+lst.length+'</span></div>'+
   '<div class="pnl2B" style="padding:0">'+
   (NF.carregando||NF.lista===null?'<div class="entVazio"><b>Buscando as notas…</b></div>':
    lst.length?'<div class="etTabW"><table class="pTable finTab"><thead><tr>'+
     '<th style="width:124px">Status</th><th style="width:74px">Nº</th><th style="width:118px">Emissão</th>'+
     '<th>Destinatário</th><th style="width:150px">Natureza</th>'+
     '<th style="width:104px;text-align:right">Valor</th><th style="width:150px"></th></tr></thead><tbody>'+
     lst.map(function(n){
       var dt=n.autorizadaEm||n.emitidaEm||'';
       return '<tr><td><span class="cfSt" style="--c:'+corStatusCupom(n.status)+'">'+E(nomeStatusCupom(n.status))+'</span>'+
         (n.ambiente&&n.ambiente!=='production'?'<small>teste</small>':'')+'</td>'+
        '<td><b>'+(n.numero||'—')+'</b>'+(n.serie?'<small>série '+E(n.serie)+'</small>':'')+'</td>'+
        '<td>'+(dt?dataBR(String(dt).slice(0,10))+'<small>'+E(String(dt).slice(11,16))+'</small>':'—')+'</td>'+
        '<td>'+E(n.destinatario||'—')+(n.documento?'<small>'+E(fsCnpjFmt(n.documento))+'</small>':'')+'</td>'+
        '<td>'+E(n.natureza||'—')+'</td>'+
        '<td style="text-align:right"><b>'+(n.valor!=null?'R$ '+money(n.valor):'—')+'</b></td>'+
        '<td><div class="rowAct">'+
         (n.pdf?'<button class="rBtn" title="DANFE" aria-label="Abrir o DANFE" onclick="window.open(\''+E(n.pdf)+'\',\'_blank\')">'+sv('print2',12)+'</button>':'')+
         (n.xml?'<button class="rBtn" title="XML" aria-label="Baixar o XML" onclick="window.open(\''+E(n.xml)+'\',\'_blank\')">'+sv('file',12)+'</button>':'')+
         (n.status==='autorizado'?'<button class="rBtn" title="Carta de correção" aria-label="Carta de correção" onclick="nfCarta(\''+E(n.spedyId)+'\')">'+sv('edit',12)+'</button>'+
           '<button class="rBtn rd" title="Cancelar na SEFAZ" aria-label="Cancelar na SEFAZ" onclick="nfCancelar(\''+E(n.spedyId)+'\')">'+sv('x2',12)+'</button>':'')+
         (n.status==='rejeitado'?'<button class="rBtn" title="Reenviar" aria-label="Reenviar" onclick="nfReemitir(\''+E(n.spedyId)+'\')">'+sv('ref',12)+'</button>':'')+
         '<button class="rBtn" title="Ver" aria-label="Ver a nota" onclick="nfVer(\''+E(n.spedyId)+'\')">'+sv('eye',12)+'</button>'+
        '</div></td></tr>';
     }).join('')+'</tbody></table></div>'
    :'<div class="entVazio"><b>Nenhuma nota no período</b><span>Clique em "Nova nota fiscal" para emitir.</span></div>')+
   '</div></div>';
}
function nfVer(id){
  var n=(NF.lista||[]).find(function(x){return x.spedyId===id});if(!n)return;
  modal('NF-e '+(n.numero||''),'<div class="mdB">'+
   '<div class="linha"><span>Situação</span><b style="color:'+corStatusCupom(n.status)+'">'+E(nomeStatusCupom(n.status))+'</b></div>'+
   '<div class="linha"><span>Destinatário</span><b>'+E(n.destinatario||'—')+(n.documento?' ('+E(fsCnpjFmt(n.documento))+')':'')+'</b></div>'+
   '<div class="linha"><span>Natureza</span><b>'+E(n.natureza||'—')+'</b></div>'+
   '<div class="linha tot"><span>TOTAL</span><b>'+(n.valor!=null?'R$ '+money(n.valor):'—')+'</b></div>'+
   (n.chave?'<div class="cbLinha"><span>'+E(n.chave)+'</span></div><div class="hint">Chave de acesso — 44 dígitos</div>':'')+
   (n.protocolo?'<div class="linha"><span>Protocolo</span><b>'+E(n.protocolo)+'</b></div>':'')+
   (n.motivo?'<div class="fscPend" style="margin-top:10px">'+sv('help',14)+'<div><b>Motivo</b>'+E(n.motivo)+'</div></div>':'')+
  '</div>','Fechar',function(){return true;});
}
async function nfCancelar(id){
  var motivo=window.prompt('Motivo do cancelamento (mínimo 15 letras). O prazo da SEFAZ é de 24 horas após a autorização:','');
  if(motivo===null)return;
  motivo=String(motivo).trim();
  if(motivo.length<15){toast('Escreva o motivo com pelo menos 15 letras.');return;}
  toast('Pedindo o cancelamento à SEFAZ…');
  var r=await fiscalChamar('nfe_cancelar',{sucursal:nfMatrizRef(),id:id,motivo:motivo});
  if(!r.ok){painelErro('A SEFAZ não cancelou a nota.',(r.d&&r.d.erro)||'O servidor recusou.');return;}
  toast('Cancelamento enviado.');NF.lista=null;telaNotasFiscais();
}
async function nfCarta(id){
  var t=window.prompt('Carta de correção (mínimo 15 letras). Não corrige valores, impostos, quantidades nem o destinatário:','');
  if(t===null)return;
  t=String(t).trim();
  if(t.length<15){toast('Escreva a correção com pelo menos 15 letras.');return;}
  var r=await fiscalChamar('nfe_carta',{sucursal:nfMatrizRef(),id:id,texto:t});
  if(!r.ok){painelErro('A carta de correção não foi aceita.',(r.d&&r.d.erro)||'O servidor recusou.');return;}
  toast('Carta de correção enviada.');
}
async function nfReemitir(id){
  var r=await fiscalChamar('nfe_reemitir',{sucursal:nfMatrizRef(),id:id});
  if(!r.ok){painelErro('Não consegui reenviar a nota.',(r.d&&r.d.erro)||'O servidor recusou.');return;}
  toast('Nota reenviada.');NF.lista=null;telaNotasFiscais();
}

/* ---------- formulário ---------- */
function _nfCampo(rot,caminho,valor,extra,larg){
  return '<div class="fld2'+(larg?' '+larg:'')+'"><label>'+rot+'</label><input value="'+E(valor==null?'':valor)+'" '+
    'oninput="nfSet(\''+caminho+'\',this.value)" '+(extra||'')+'></div>';
}
function _nfSel(rot,caminho,valor,opcoes,refaz){
  return '<div class="fld2"><label>'+rot+'</label><select onchange="nfSet(\''+caminho+'\',this.value'+(refaz?',1':'')+')">'+
    opcoes.map(function(o){return '<option value="'+E(o[0])+'"'+(String(valor)===String(o[0])?' selected':'')+'>'+E(o[1])+'</option>';}).join('')+
   '</select></div>';
}
function nfSet(caminho,valor,refaz){
  var partes=caminho.split('.'),o=NF.form;
  for(var i=0;i<partes.length-1;i++){o=o[partes[i]];if(!o)return;}
  o[partes[partes.length-1]]=valor;
  if(caminho==='natureza'){
    var nat=NATUREZAS_NFE.find(function(n){return n.id===valor});
    if(nat&&nat.finalidade)NF.form.finalidade=nat.finalidade;
    else if(NF.form.finalidade==='devolution')NF.form.finalidade='normal';
    if(nat&&nat.cfop)NF.form.itens.forEach(function(it){it.cfop=nat.cfop;it.csosn=nat.csosn||it.csosn;});
  }
  nfGuardarRascunho();
  if(refaz)telaNotasFiscais();else nfAtualizarResumo();
}
function nfAtualizarResumo(){
  var el=document.getElementById('nfResumo');if(el)el.innerHTML=nfHtmlResumo();
}
function nfHtmlResumo(){
  var f=NF.form,t=nfTotais(f),pb=nfProblemas(f);
  return '<div class="nfTot">'+
    '<div><span>Produtos</span><b>R$ '+money(t.produtos)+'</b></div>'+
    '<div><span>Desconto</span><b>R$ '+money(t.desconto)+'</b></div>'+
    '<div><span>Frete</span><b>R$ '+money(t.frete)+'</b></div>'+
    '<div><span>Seguro + outras</span><b>R$ '+money(t.seguro+t.outras)+'</b></div>'+
    '<div class="nfTotG"><span>Total da nota</span><b>R$ '+money(t.total)+'</b></div>'+
   '</div>'+
   (pb.length?'<div class="nfFalta"><b>Falta preencher:</b> '+E(pb.slice(0,6).join(' · '))+(pb.length>6?' · e mais '+(pb.length-6):'')+'</div>'
     :'<div class="nfPronta">'+sv('check',13)+' Pronta para emitir</div>');
}
function nfHtmlForm(){
  var f=NF.form,d=f.dest,fr=f.frete;
  var sucs=(DB.sucursais||[]).filter(function(s){return s&&s.ativa!==false&&!s.matriz});
  var prods=impProdutos().filter(function(p){return !ehTaxaEntrega(p)});
  var itens=(f.itens||[]).map(function(it,i){
    var tot=_nfNumPonto(it.qtd)*_nfNumPonto(it.valor);
    return '<tr>'+
     '<td><input class="impIn" style="width:100%;min-width:150px" value="'+E(it.descricao)+'" aria-label="Descrição do item '+(i+1)+'" oninput="nfItem('+i+',\'descricao\',this.value)"></td>'+
     '<td><input class="impIn" style="width:92px" value="'+E(it.ncm)+'" maxlength="10" inputmode="numeric" aria-label="NCM" oninput="nfItem('+i+',\'ncm\',this.value)"></td>'+
     '<td><input class="impIn" style="width:80px" value="'+E(it.cest)+'" maxlength="9" inputmode="numeric" aria-label="CEST" oninput="nfItem('+i+',\'cest\',this.value)"></td>'+
     '<td><input class="impIn" style="width:60px" value="'+E(nfCfopDestino(it.cfop,d.uf))+'" maxlength="4" inputmode="numeric" aria-label="CFOP" oninput="nfItem('+i+',\'cfop\',this.value)"></td>'+
     '<td><input class="impIn" style="width:56px" value="'+E(it.csosn)+'" maxlength="3" inputmode="numeric" aria-label="CSOSN" oninput="nfItem('+i+',\'csosn\',this.value)"></td>'+
     '<td><select class="impIn" aria-label="Unidade" onchange="nfItem('+i+',\'un\',this.value)">'+['UN','KG','LT','CX','PC'].map(function(u){
        return '<option'+(it.un===u?' selected':'')+'>'+u+'</option>';}).join('')+'</select></td>'+
     '<td><input class="impIn" style="width:70px" value="'+E(it.qtd)+'" inputmode="decimal" aria-label="Quantidade" oninput="nfItem('+i+',\'qtd\',this.value)"></td>'+
     '<td><input class="impIn" style="width:84px" value="'+E(it.valor)+'" inputmode="decimal" aria-label="Valor unitário" oninput="nfItem('+i+',\'valor\',this.value)"></td>'+
     '<td><input class="impIn" style="width:70px" value="'+E(it.desconto)+'" inputmode="decimal" aria-label="Desconto do item" oninput="nfItem('+i+',\'desconto\',this.value)"></td>'+
     '<td style="text-align:right" id="nfTotI'+i+'"><b>R$ '+money(tot)+'</b></td>'+
     '<td><button class="rBtn rd" title="Tirar o item" aria-label="Tirar o item '+(i+1)+'" onclick="nfTirarItem('+i+')">'+sv('trash',12)+'</button></td>'+
    '</tr>';
  }).join('');
  return '<div class="nfForm">'+
   '<div class="cfgCol"><div class="colH">Destinatário</div><div class="fsCorpo">'+
    '<div class="nfAtalhoDest">'+
     (sucs.length?'<select aria-label="Preencher com uma unidade da rede" onchange="nfDestDaUnidade(this.value)"><option value="">Preencher com uma unidade da rede…</option>'+
       sucs.map(function(s){return '<option value="'+E(s.id)+'">'+E(s.nome)+'</option>';}).join('')+'</select>':'')+
    '</div>'+
    '<div class="nfGrid">'+
     _nfCampo('CPF ou CNPJ','dest.doc',d.doc,'inputmode="numeric" maxlength="18"')+
     _nfCampo('Nome ou razão social','dest.nome',d.nome,'maxlength="60"','nfLargo')+
     _nfCampo('Inscrição estadual','dest.ie',d.ie,'inputmode="numeric"'+(d.isentoIe?' disabled':''))+
     '<label class="impPend"><input type="checkbox"'+(d.isentoIe?' checked':'')+' onchange="nfSet(\'dest.isentoIe\',this.checked,1)"> Isento de IE</label>'+
     _nfCampo('CEP','dest.cep',d.cep,'inputmode="numeric" maxlength="9" onblur="nfBuscarCep(this.value)"')+
     _nfCampo('Rua','dest.rua',d.rua,'','nfLargo')+
     _nfCampo('Número','dest.numero',d.numero)+
     _nfCampo('Complemento','dest.compl',d.compl)+
     _nfCampo('Bairro','dest.bairro',d.bairro)+
     _nfCampo('Cidade','dest.cidade',d.cidade)+
     _nfSel('Estado','dest.uf',d.uf,UFS_BR.map(function(u){return [u,u]}),1)+
     _nfCampo('E-mail (recebe a nota)','dest.email',d.email,'type="email"')+
     _nfCampo('Telefone','dest.fone',d.fone,'inputmode="tel"')+
    '</div>'+
   '</div></div>'+
   '<div class="cfgCol"><div class="colH">Operação</div><div class="fsCorpo"><div class="nfGrid">'+
    _nfSel('Natureza da operação','natureza',f.natureza,NATUREZAS_NFE.map(function(n){return [n.id,n.n]}).concat([['outra','Outra (escrever)']]),1)+
    (f.natureza==='outra'?_nfCampo('Qual natureza','naturezaTexto',f.naturezaTexto,'maxlength="60"','nfLargo'):'')+
    _nfSel('Finalidade','finalidade',f.finalidade,[['normal','Normal'],['devolution','Devolução'],['complement','Complementar'],['adjustment','Ajuste']],1)+
    (f.finalidade==='devolution'?_nfCampo('Chave da nota devolvida','chaveRef',f.chaveRef,'inputmode="numeric" maxlength="54"','nfLargo'):'')+
    _nfSel('Como foi a venda','presenca',f.presenca,[['othersNonPresenceOperation','Não presencial (pedido, entrega)'],['presence','Presencial'],
      ['internet','Pela internet'],['telephone','Por telefone'],['none','Não se aplica']])+
    '<div class="hint nfLargo">'+(d.uf&&d.uf!==nfUfEmitente()?'Destinatário de outro estado: o CFOP dos itens passa para 6xxx sozinho.':
      'Destinatário no mesmo estado da matriz: CFOP 5xxx.')+'</div>'+
   '</div></div></div>'+
   '<div class="cfgCol nfItens"><div class="colH">Produtos</div><div class="fsCorpo">'+
    '<div class="nfAdd"><select id="nfProd" aria-label="Produto do cadastro"><option value="">Escolha um produto do cadastro…</option>'+
      prods.map(function(p){return '<option value="'+E(p.id)+'">'+E(p.nome)+' — R$ '+money(p.preco)+'</option>';}).join('')+'</select>'+
     '<button class="btnP2 ok" onclick="nfAddItem()">'+sv('plus',13)+' Adicionar</button>'+
     '<button class="btnP2" onclick="nfAddItem(1)">Item avulso</button></div>'+
    (itens?'<div class="etTabW"><table class="etTab semBusca impTab"><thead><tr><th>Descrição</th><th>NCM</th><th>CEST</th><th>CFOP</th><th>CSOSN</th>'+
      '<th>Un.</th><th>Qtde</th><th>Valor un.</th><th>Desc.</th><th style="text-align:right">Total</th><th></th></tr></thead><tbody>'+itens+'</tbody></table></div>'
     :'<div class="hint">Nenhum produto ainda. Escolha no cadastro ou lance um item avulso.</div>')+
   '</div></div>'+
   '<div class="cfgCol"><div class="colH">Frete e transporte</div><div class="fsCorpo"><div class="nfGrid">'+
    _nfSel('Frete','frete.modalidade',fr.modalidade,FRETES_NFE,1)+
    (fr.modalidade!=='free'?
     _nfCampo('Valor do frete (R$)','frete.valor',fr.valor,'inputmode="decimal"')+
     _nfCampo('Transportadora — CNPJ ou CPF','frete.transpDoc',fr.transpDoc,'inputmode="numeric"')+
     _nfCampo('Transportadora — nome','frete.transpNome',fr.transpNome,'','nfLargo')+
     _nfCampo('Transportadora — IE','frete.transpIe',fr.transpIe,'inputmode="numeric"')+
     _nfCampo('Transportadora — endereço','frete.transpEnd',fr.transpEnd,'','nfLargo')+
     _nfCampo('Transportadora — cidade','frete.transpCidade',fr.transpCidade)+
     _nfSel('Transportadora — estado','frete.transpUf',fr.transpUf,[['','—']].concat(UFS_BR.map(function(u){return [u,u]})))+
     _nfCampo('Volumes (quantidade)','frete.volQtd',fr.volQtd,'inputmode="numeric"')+
     _nfCampo('Espécie (caixa, isopor…)','frete.volEsp',fr.volEsp)+
     _nfCampo('Peso líquido (kg)','frete.pesoL',fr.pesoL,'inputmode="decimal"')+
     _nfCampo('Peso bruto (kg)','frete.pesoB',fr.pesoB,'inputmode="decimal"')+
     _nfCampo('Placa do veículo','frete.placa',fr.placa,'maxlength="8"')+
     _nfSel('Estado da placa','frete.placaUf',fr.placaUf,[['','—']].concat(UFS_BR.map(function(u){return [u,u]})))
     :'<div class="hint nfLargo">Sem frete: a mercadoria é retirada ou não há transporte.</div>')+
   '</div></div></div>'+
   '<div class="cfgCol"><div class="colH">Pagamento e observações</div><div class="fsCorpo"><div class="nfGrid">'+
    _nfSel('Forma de pagamento','pag',f.pag,PAGS_NFE)+
    _nfCampo('Desconto geral (R$)','desconto',f.desconto,'inputmode="decimal"')+
    _nfCampo('Seguro (R$)','seguro',f.seguro,'inputmode="decimal"')+
    _nfCampo('Outras despesas (R$)','outras',f.outras,'inputmode="decimal"')+
    '<div class="fld2 nfLargo"><label>Informações complementares (saem impressas na nota)</label>'+
     '<textarea rows="2" maxlength="2000" oninput="nfSet(\'info\',this.value)">'+E(f.info)+'</textarea></div>'+
   '</div></div></div>'+
   '<div class="cfgCol nfFim"><div class="fsCorpo">'+
    '<div id="nfResumo">'+nfHtmlResumo()+'</div>'+
    '<div class="nfBtns">'+
     '<span class="hint">Rascunho guardado neste aparelho.</span>'+
     '<button class="btnP2" onclick="nfLimpar()">Começar de novo</button>'+
     '<button class="btnP2 ok" id="nfEmitir" onclick="nfEmitir()"'+(NF.emitindo?' disabled':'')+'>'+sv('check',13)+
      (NF.emitindo?' Emitindo…':' Conferir e emitir')+'</button>'+
    '</div>'+
   '</div></div>'+
  '</div>';
}
function nfItem(i,campo,valor){
  var it=NF.form.itens[i];if(!it)return;
  it[campo]=valor;
  nfGuardarRascunho();
  var c=document.getElementById('nfTotI'+i);
  if(c)c.innerHTML='<b>R$ '+money(_nfNumPonto(it.qtd)*_nfNumPonto(it.valor))+'</b>';
  nfAtualizarResumo();
}
function nfAddItem(avulso){
  var f=NF.form,nat=NATUREZAS_NFE.find(function(n){return n.id===f.natureza});
  if(avulso){
    f.itens.push({produtoId:'',codigo:'',descricao:'',ncm:'',cest:'',cfop:(nat&&nat.cfop)||'5102',
      csosn:(nat&&nat.csosn)||'102',origem:'0',un:'UN',qtd:'1',valor:'',desconto:''});
  } else {
    var pid=($('nfProd')||{}).value;
    var p=(DB.produtos||[]).find(function(x){return x.id===pid});
    if(!p){toast('Escolha um produto do cadastro.');return;}
    f.itens.push({produtoId:p.id,codigo:p.codigo||p.id,descricao:p.nome,ncm:p.ncm||'',cest:p.cest||'',
      cfop:(nat&&nat.cfop)||p.cfop||'5102',csosn:(nat&&nat.csosn)||p.csosn||'102',origem:p.origemFiscal||'0',
      un:p.unTrib||'UN',qtd:'1',valor:String(Number(p.preco)||''),desconto:''});
  }
  nfGuardarRascunho();telaNotasFiscais();
}
function nfTirarItem(i){NF.form.itens.splice(i,1);nfGuardarRascunho();telaNotasFiscais();}
async function nfLimpar(){
  var ok=await confirmar({titulo:'Começar uma nota nova?',texto:'O rascunho desta nota é apagado.',
    ok:'Apagar o rascunho',cancelar:'Voltar',tipo:'perigo'});
  if(!ok)return;
  NF.form=nfFormNovo();nfGuardarRascunho();telaNotasFiscais();
}
function nfDestDaUnidade(sid){
  var s=(DB.sucursais||[]).find(function(x){return x.id===sid});if(!s)return;
  var d=NF.form.dest;
  d.doc=s.cnpj||d.doc;d.nome=s.razaoSocial||s.razao||s.nome||d.nome;
  d.cidade=s.cidade||d.cidade;d.uf=(s.uf||d.uf||'SP').toUpperCase();d.fone=s.telefone||d.fone;
  if(s.rua)d.rua=s.rua;if(s.numero)d.numero=s.numero;if(s.bairro)d.bairro=s.bairro;if(s.cep)d.cep=s.cep;
  nfGuardarRascunho();telaNotasFiscais();
  toast('Dados de '+s.nome+' preenchidos. Confira o endereço e a inscrição estadual.');
}
/* o CEP preenche rua, bairro, cidade, estado e o código do município */
async function nfBuscarCep(v){
  var cep=fsDigitos(v);if(cep.length!==8)return;
  try{
    var r=await fetch('https://viacep.com.br/ws/'+cep+'/json/');
    var j=await r.json();
    if(!j||j.erro)return;
    var d=NF.form.dest;
    d.rua=d.rua||j.logradouro||'';d.bairro=d.bairro||j.bairro||'';
    d.cidade=j.localidade||d.cidade;d.uf=j.uf||d.uf;d.ibge=j.ibge||d.ibge;
    nfGuardarRascunho();telaNotasFiscais();
  }catch(e){_quieto(e,'nfBuscarCep');}
}
async function nfEmitir(){
  if(NF.emitindo)return;
  var f=NF.form,pb=nfProblemas(f);
  if(pb.length){painelErro('Falta preencher antes de emitir.',pb.slice(0,8).join(' · '));return;}
  var t=nfTotais(f),u=fiscalUn(nfMatrizRef());
  var ok=await confirmar({titulo:'Emitir a nota fiscal?',
    texto:'Para '+f.dest.nome+' — '+(f.itens.length)+' produto(s)',
    linhas:[['Produtos','R$ '+money(t.produtos),''],['Frete','R$ '+money(t.frete),''],
      ['Desconto','R$ '+money(t.desconto),''],['Total da nota','R$ '+money(t.total),'']],
    aviso:u.ambiente==='producao'?'A nota vai para a SEFAZ e passa a valer para a Receita.':
      'Ambiente de teste: a nota vai para a SEFAZ de homologação e não tem valor fiscal.',
    ok:'Emitir',cancelar:'Voltar',tipo:'check'});
  if(!ok)return;
  NF.emitindo=true;telaNotasFiscais();
  var r=await fiscalChamar('nfe_emitir',{sucursal:nfMatrizRef(),nota:montarNfe(f)});
  if(!r.ok){NF.emitindo=false;telaNotasFiscais();
    painelErro('A nota não foi aceita.',(r.d&&r.d.erro)||'O servidor recusou.');return;}
  var n=r.d.nota;
  /* a SEFAZ responde em segundos: acompanha até sair do "enviando" */
  for(var k=0;k<15&&n&&n.status==='enviando';k++){
    await new Promise(function(ok2){setTimeout(ok2,4000);});
    var g=await fiscalChamar('nfe_consultar',{sucursal:nfMatrizRef(),id:n.spedyId});
    if(g.ok&&g.d.nota)n=g.d.nota;
  }
  NF.emitindo=false;
  if(n&&n.status==='rejeitado'){
    /* rejeitada: o rascunho fica — corrige e emite de novo com a MESMA
       identificação, e a Spedy atualiza a nota em vez de criar outra */
    telaNotasFiscais();
    painelErro('A SEFAZ recusou a nota.',n.motivo||'Confira os dados e emita de novo.');
    return;
  }
  NF.form=nfFormNovo();nfGuardarRascunho();
  NF.aba='lista';NF.lista=null;
  telaNotasFiscais();
  toast(n&&n.status==='autorizado'?'Nota '+(n.numero||'')+' autorizada.':'Nota enviada — a autorização aparece na lista em instantes.');
}

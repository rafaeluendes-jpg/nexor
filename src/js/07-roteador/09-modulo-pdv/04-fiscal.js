/* ==========================================================
   FISCAL — O CUPOM DE CADA LOJA, PELA SPEDY (28/09/2026)

   *"Cupom fiscal e nota fiscal. A nota fiscal vai ser só na matriz. E o
   cupom fiscal tem que ser configurável nas outras lojas."* (Rafael)
   O desenho inteiro está em PRD_FISCAL.md. Aqui mora a parte do
   navegador; a parte que guarda segredo mora na função `joia-fiscal`,
   no servidor.

   TRÊS REGRAS QUE NÃO SE DOBRAM

   1. Cada unidade é um emitente. A configuração fiscal é DA UNIDADE
      (DB.fiscalUn[unidade]) e vem do servidor — nunca de DB.config, que
      é da rede inteira. Foi esse tipo de mistura que fez a Carla de
      Santa Fé se apresentar como a de Alphaville (26/09/2026).

   2. A chave da API, o CSC e o certificado nunca passam por aqui. O
      navegador pede; o servidor confere quem é e usa a chave DAQUELA
      unidade.

   3. A venda nunca espera o fiscal. A venda é gravada primeiro; o cupom
      sai depois, em segundo plano. Se a internet, a Spedy ou a SEFAZ
      falharem, o cupom fica pendente e sai sozinho mais tarde — com o
      mesmo identificador, então a Spedy atualiza a nota em vez de criar
      outra.
   ========================================================== */

var FS={carregando:false,erro:'',empresas:null,sujo:false,salvando:false,
        /* o ambiente escolhido no bloco do CSC e se a tela esta pedindo o
           CNPJ da producao — os dois sobrevivem ao redesenho da tela */
        cscAmb:'',pedindoCnpj:false};
/* o CPF digitado na tela de pagamento, do clique até o cupom nascer */
var FISCAL_VENDA={cpf:''};
var _fsEmitindo={};

function baseFiscalUn(){DB.fiscalUn=DB.fiscalUn||{};return DB.fiscalUn;}
/* a configuração fiscal da unidade, como o servidor devolveu da última vez.
   Sem nada guardado, a unidade está desligada — nunca "herda" de outra. */
function fiscalUn(suc){
  var u=baseFiscalUn()[suc||lojaAtualId()];
  return u||{modo:'desligado',ambiente:'homologacao',vinculada:false,serie:1,
             pedeCpf:'perguntar',imprime:'perguntar'};
}
function fiscalEmite(suc){
  var u=fiscalUn(suc);
  return !!(u.vinculada&&u.modo!=='desligado');
}
function fsDigitos(x){return String(x==null?'':x).replace(/\D/g,'');}

/* a configuração da REDE (impostos padrão e perfis) sobe para a nuvem com
   o resto da configuração. Segredo nenhum vai junto: uma chave antiga que
   tenha ficado neste aparelho, da tela de antes, não sai daqui. */
function fiscalSemSegredo(f){
  var o={};
  Object.keys(f||{}).forEach(function(k){
    if(['token','csc','cscId','url','provedor'].indexOf(k)<0)o[k]=f[k];
  });
  return o;
}

/* ---------- a porta para o servidor ---------- */
async function fiscalChamar(acao,dados){
  if(!NUVEM.ligada||!NUVEM.token||!NUVEM.url)
    return {ok:false,status:0,d:{erro:'Sem conexão com a nuvem.'}};
  var corpo=Object.assign({acao:acao},dados||{});
  try{
    var r=await fetch(NUVEM.url+'/functions/v1/joia-fiscal',{
      method:'POST',
      headers:{'apikey':NUVEM.chave,'Authorization':'Bearer '+NUVEM.token,
               'Content-Type':'application/json'},
      body:JSON.stringify(corpo)});
    var d=null;
    try{ d=await r.json(); }catch(e){_quieto(e,'fiscalChamar')}
    return {ok:r.ok,status:r.status,d:d||{}};
  }catch(e){
    return {ok:false,status:0,d:{erro:'Sem conexão com o servidor fiscal.'}};
  }
}
/* ==========================================================
   CANCELAR A VENDA TEM DE CANCELAR O CUPOM

   Cancelar no PDV mexia no estoque e no faturamento e NAO encostava no
   documento fiscal: a NFC-e ficava autorizada na SEFAZ, valendo, com o
   valor de uma venda que nao existe mais. A unica pista era um rotulo
   "venda cancelada" na tela de Cupons — um aviso, nao uma acao.

   Aqui e a acao. Ela roda depois do cancelamento comercial, nunca antes:
   o que o cliente ve e a venda cancelada na hora; o documento vai atras.

   ---------- por que nao pode estourar ----------
   A SEFAZ tem prazo curto (em geral 30 minutos) e pode estar fora do ar.
   Falhar aqui nao pode desfazer o cancelamento nem travar o caixa. Entao
   toda falha vira PENDENCIA marcada no cupom — que aparece na tela de
   Cupons Fiscais e na lista `fiscal-divergente` da API — em vez de sumir
   num console que ninguem abre.

   ---------- o motivo ----------
   A lei pede no minimo 15 letras. O motivo do cancelamento da loja
   ("Cliente desistiu") costuma ter menos, entao ele e completado com o
   numero do pedido, que e o que um fiscal precisaria para achar a venda.
   ========================================================== */
function motivoFiscalDoCancelamento(ped,motivo){
  var t=String(motivo||'').trim();
  var compl='Cancelamento da venda #'+(ped&&ped.numero!==undefined?ped.numero:'');
  var txt=t?(t+' — '+compl):compl;
  txt=txt.replace(/\s+/g,' ').trim();
  /* 15 e o minimo legal; 255 e o teto do campo */
  while(txt.length<15)txt+=' .';
  return txt.slice(0,255);
}
function cupomFiscalDoPedido(ped){
  if(!ped||!ped.id)return null;
  return baseCuponsFiscais().find(function(c){
    return (c.pedidoId===ped.id)||(c.pedidoRef&&c.pedidoRef===ped.ref_local);})||null;
}
async function cancelarCupomDaVenda(ped,motivo){
  var c=cupomFiscalDoPedido(ped);
  if(!c)return {feito:false,porque:'sem cupom'};
  /* cupom que nunca virou documento nao tem o que cancelar na SEFAZ */
  if(c.status!=='autorizado'&&c.status!=='contingencia'){
    if(c.status==='pendente'||c.status==='enviando'){
      /* estava a caminho: marca para nao ser emitido */
      c.naoEmitir=true;c.motivoPendencia='Venda cancelada antes da autorização.';
      return {feito:true,porque:'cupom nao autorizado'};
    }
    return {feito:false,porque:'cupom '+(c.status||'sem status')};
  }
  var suc=c.sucursalId||ped.sucursalId||lojaAtualId();
  /* a partir daqui existe documento valendo: a pendencia nasce ligada,
     e so morre quando a SEFAZ confirmar */
  c.precisaCancelar=true;
  c.motivoPendencia='Venda cancelada — cupom ainda autorizado na SEFAZ.';
  if(!fiscalEmite(suc)||!c.spedyId){
    c.motivoPendencia='Venda cancelada. Este cupom não foi emitido pela Spedy: '+
      'o cancelamento tem de ser feito com o contador.';
    return {feito:false,porque:'sem spedyId'};
  }
  var r=await fiscalChamar('cancelar',
    {sucursal:suc,id:c.spedyId,motivo:motivoFiscalDoCancelamento(ped,motivo)});
  if(!r.ok){
    /* ==========================================================
       FORA DO PRAZO NAO E ERRO DE SISTEMA (RDS 9.3)

       Passado o prazo da SEFAZ o caminho deixa de ser o cancelamento e
       passa a ser a nota de devolucao, que e assunto do contador. O
       sistema nao pode fingir que cancelou nem apagar o rastro: ele
       deixa a pendencia escrita, com o motivo que a SEFAZ devolveu.
       ========================================================== */
    var msg=String((r.d&&r.d.erro)||'A SEFAZ não aceitou o cancelamento.');
    c.motivoPendencia=/prazo|tempo|expirad|126|501/i.test(msg)
      ? 'Fora do prazo de cancelamento da SEFAZ. O caminho agora é a nota de '+
        'devolução — fale com o contador. ('+msg.slice(0,120)+')'
      : 'A SEFAZ não cancelou: '+msg.slice(0,160);
    return {feito:false,porque:msg};
  }
  c.motivoCancelamento=motivoFiscalDoCancelamento(ped,motivo);
  if(r.d&&r.d.nota)aplicarNotaNoCupom(c,r.d.nota);
  if(c.status==='autorizado'||c.status==='contingencia')c.status='enviando';
  if(c.status==='cancelado'){c.precisaCancelar=false;c.motivoPendencia='';}
  else{
    acompanharCupom(c.id).then(function(){
      var c2=baseCuponsFiscais().find(function(x){return x.id===c.id});
      if(c2&&c2.status==='cancelado'){c2.precisaCancelar=false;c2.motivoPendencia='';salvar();}
    }).catch(function(){});
  }
  return {feito:true,porque:'enviado'};
}
async function fiscalCarregar(suc,leve){
  suc=suc||lojaAtualId();
  var r=await fiscalChamar('estado',{sucursal:suc,leve:!!leve});
  if(!r.ok){FS.erro=(r.d&&r.d.erro)||'O fiscal não respondeu agora.';return null;}
  /* a resposta tem de ser DA unidade pedida — nunca guardar a de outra */
  if(r.d.unidade&&r.d.unidade.ref&&r.d.unidade.ref!==suc){FS.erro='Resposta de outra unidade — recarregue.';return null;}
  FS.erro='';
  var ant=baseFiscalUn()[suc];
  var u=Object.assign({},r.d.unidade||{},{
    /* a leitura leve (a do caixa) não traz o cadastro da Spedy: mantém o
       que a tela de configuração já tinha lido */
    spedy:r.d.spedy||(leve&&ant&&ant.spedy)||null,base:r.d.base||null,conta:r.d.conta||null,
    podeGerir:!!r.d.podeGerir,rede:r.d.rede||null,lidoEm:new Date().toISOString()});
  baseFiscalUn()[suc]=u;
  salvar();
  return u;
}

/* ==========================================================
   O CAIXA SABE SE A LOJA EMITE — SEM ABRIR A TELA FISCAL (28/09/2026)
   Santa Fé ligou "Emitir sempre" e as vendas continuaram saindo sem
   cupom: o aparelho do caixa só aprendia a configuração quando alguém
   abria a Configuração Fiscal NELE. O operador nunca abre. Agora o PDV
   confere no servidor ao abrir e a cada venda (no máximo a cada 3 min),
   e a decisão de emitir é tomada com o que o servidor disse.
   ========================================================== */
var _fsGarantindo={};
async function fiscalGarantir(suc){
  suc=suc||lojaAtualId();
  if(!NUVEM.ligada||!NUVEM.token||!suc)return fiscalUn(suc);
  var u=baseFiscalUn()[suc];
  var fresco=u&&u.lidoEm&&(Date.now()-Date.parse(u.lidoEm))<180000&&(!u.ref||u.ref===suc);
  if(fresco)return u;
  if(!_fsGarantindo[suc])_fsGarantindo[suc]=fiscalCarregar(suc,true)
    .catch(function(e){_quieto(e,'fiscalGarantir');return null;})
    .then(function(x){delete _fsGarantindo[suc];return x;});
  await _fsGarantindo[suc];
  return fiscalUn(suc);
}

/* ==========================================================
   PERFIS FISCAIS — o imposto em português

   Quem cadastra produto não precisa saber o que é CSOSN. Escolhe
   "Gelato e sorvete (ST)" e o sistema preenche os códigos. Os perfis são
   da rede (o produto é da rede); a unidade só diz o próprio regime.

   CSOSN (Simples) e CST (regime normal) andam juntos no perfil: uma
   unidade no Simples e outra no regime normal usam o mesmo produto, e
   cada uma lê o código do seu regime na hora de emitir.

   Quem decide o perfil de cada produto é o contador. Os presets abaixo
   são o ponto de partida mais comum numa gelateria; nada aqui substitui
   a palavra dele (PRD_FISCAL.md, seção 16).
   ========================================================== */
var PERFIS_FISCAIS_PADRAO=[
 {id:'pf_st',   nome:'Gelato e sorvete (ST)',
  d:'revenda de sorvete: o ICMS já foi pago antes, por substituição tributária',
  cfop:'5405',csosn:'500',cst:'60',origem:'0',st:true},
 {id:'pf_prod', nome:'Gelato de produção própria',
  d:'a própria loja fabrica o gelato',
  cfop:'5101',csosn:'102',cst:'00',origem:'0',st:false},
 {id:'pf_beb',  nome:'Bebidas e industrializados (ST)',
  d:'refrigerante, água, chocolate — já vêm com o imposto retido',
  cfop:'5405',csosn:'500',cst:'60',origem:'0',st:true},
 {id:'pf_rev',  nome:'Revenda comum',
  d:'mercadoria comprada pronta, sem substituição tributária',
  cfop:'5102',csosn:'102',cst:'00',origem:'0',st:false},
 {id:'pf_isento',nome:'Isento / não tributado',
  d:'brinde, bonificação e o que o contador indicar',
  cfop:'5102',csosn:'400',cst:'40',origem:'0',st:false}
];
function perfisFiscais(){
  var f=fiscalCfg();
  /* semente só com a lista inexistente: a lista que a rede editou é dado */
  if(!Array.isArray(f.perfis))f.perfis=JSON.parse(JSON.stringify(PERFIS_FISCAIS_PADRAO));
  return f.perfis;
}
function perfilDoProduto(p){
  if(!p)return null;
  return perfisFiscais().find(function(x){
    return String(x.cfop)===String(p.cfop||'')&&String(x.csosn)===String(p.csosn||'')&&
           String(x.cst)===String(p.cst||'');
  })||null;
}
function aplicarPerfilFiscal(perfilId,produtos){
  var pf=perfisFiscais().find(function(x){return x.id===perfilId});
  if(!pf)return 0;
  (produtos||[]).forEach(function(p){
    p.cfop=pf.cfop;p.csosn=pf.csosn;p.cst=pf.cst;
    if(!p.origemFiscal)p.origemFiscal=pf.origem;
    p.alterado=Date.now();
  });
  return (produtos||[]).length;
}

/* ---------- documento do consumidor ---------- */
function cpfValido(c){
  c=fsDigitos(c);
  if(c.length!==11||/^(\d)\1{10}$/.test(c))return false;
  for(var t=9;t<11;t++){
    var s=0;for(var i=0;i<t;i++)s+=Number(c[i])*(t+1-i);
    var dv=(s*10)%11%10;if(dv!==Number(c[t]))return false;
  }
  return true;
}
function docFiscalValido(d){
  d=fsDigitos(d);
  if(d.length===11)return cpfValido(d);
  if(d.length!==14||/^(\d)\1{13}$/.test(d))return false;
  var pesos=[[5,4,3,2,9,8,7,6,5,4,3,2],[6,5,4,3,2,9,8,7,6,5,4,3,2]];
  for(var k=0;k<2;k++){
    var s=0;for(var i=0;i<pesos[k].length;i++)s+=Number(d[i])*pesos[k][i];
    var r=s%11;var dv=r<2?0:11-r;if(dv!==Number(d[12+k]))return false;
  }
  return true;
}

/* ==========================================================
   A VENDA VIRA CUPOM — campo a campo (PRD, seção 9.2)

   Função pura: recebe a venda e devolve o pedido para a Spedy, ou o
   motivo por que não dá para emitir. Nunca "chuta" imposto: produto sem
   NCM, ou de substituição tributária sem CEST, para aqui com o nome do
   produto — a SEFAZ recusaria de qualquer jeito.
   ========================================================== */
/* ==========================================================
   A FORMA DE PAGAMENTO NO CUPOM (Rafael, 29/09/2026)

   O cupom de Santa Fé saiu com "FORMA DE PAGAMENTO: Outros". A venda
   foi em dinheiro, e o caixa sabia disso — o botão que ele apertou tem
   o tipo escrito.

   Esta função procurava só em `DB.formasPag`, a lista que vem da
   nuvem. O caixa, porém, monta os botões de `FORMAS`, que cai na lista
   de fábrica enquanto o download não chegou. Quando isso acontece o
   botão funciona, a venda grava — e só o cupom fiscal sai sem saber o
   que foi. Duas listas para a mesma pergunta, e a de baixo era a que
   ninguém via.

   Agora pergunta às duas, na ordem, e ainda ao id da própria forma:
   `fp_dinheiro` carrega o tipo no nome. "Outros" passa a ser o que
   realmente não se sabe.
   ========================================================== */
function formaSpedy(g){
  var id=(g&&g.forma)||'';
  var f=(typeof formaPag==='function'?formaPag(id):null)
      ||((typeof FORMAS!=='undefined'&&FORMAS||[]).find(function(x){return x.id===id}))
      ||{};
  var t=String(f.tipo||'').toLowerCase();
  if(!t){
    var m=String(id).match(/^fp[_-]?([a-z]+)/i);
    if(m)t=m[1].toLowerCase();
  }
  /* os nomes são os da Spedy (OpenAPI v1): dinheiro é `money` */
  return ({dinheiro:'money',debito:'debitCard',credito:'creditCard',pix:'pix',
           voucher:'mealVoucher',vale:'mealVoucher',fiado:'storeCredit'})[t]||'other';
}
function _dist(total,pesos){
  /* reparte um valor pelos itens, proporcional, e acerta o centavo no maior */
  var soma=pesos.reduce(function(a,x){return a+x},0);
  if(!(total>0.0049)||!(soma>0))return pesos.map(function(){return 0});
  var out=pesos.map(function(x){return Math.floor(total*x/soma*100)/100});
  var resto=+(total-out.reduce(function(a,x){return a+x},0)).toFixed(2);
  var iM=0;pesos.forEach(function(x,i){if(x>pesos[iM])iM=i;});
  out[iM]=+(out[iM]+resto).toFixed(2);
  return out;
}
/* ==========================================================
   A TAXA DE ENTREGA NÃO É MERCADORIA (28/09/2026)
   Em Santa Fé ela é um produto do cardápio ("Taxa de Entrega"), lançado
   como item da venda. No cupom ela não pode ser item — não tem NCM, e a
   Receita recusaria. Vai como "outras despesas", do mesmo jeito que a
   taxa gravada no pedido.
   ========================================================== */
function ehTaxaEntrega(p,it){
  var nome=String((p&&p.nome)||(it&&it.nome)||'');
  if(/taxa\s*de\s*entrega/i.test(nome))return true;
  var cat=p&&(DB.categorias||[]).find(function(c){return c.id===p.categoriaId});
  return !!(cat&&/taxa\s*de\s*entrega/i.test(cat.nome||''));
}
/* ==========================================================
   O QUE O CLIENTE ESCOLHEU VAI NA DESCRIÇÃO (Rafael, 29/09/2026)

   *"tem um item que não apareceu aí, que é a borda. O cascão é R$ 18 e
   a borda é mais R$ 6, dá os R$ 24. Saiu o valor certo, mas não saiu o
   item."*

   O adicional não é um produto da venda: ele é uma opção do item, e o
   preço dele já está no preço do item — por isso o total sempre bateu.
   O que faltava era DIZER. Cupom com o valor certo e sem o que foi
   comprado é o cupom que o cliente não confere.

   Vai na descrição, e não como linha separada: linha separada precisa
   de NCM, CFOP e CSOSN próprios, e um adicional não tem cadastro
   fiscal nenhum — a Receita recusaria a nota inteira.

   O teto de 120 caracteres é da Spedy (xProd, da SEFAZ): o nome do
   produto tem prioridade, e as opções entram no que couber.
   ========================================================== */
function fsDescricaoItem(it,p){
  var nome=String((it&&it.nome)||(p&&p.nome)||'Item').trim();
  var ops=((it&&it.opcoes)||[]).map(function(o){
    return String((o&&o.nome)||o||'').trim();
  }).filter(Boolean);
  if(!ops.length)return nome.slice(0,120);
  var texto=nome+' ('+ops.join(', ')+')';
  if(texto.length<=120)return texto;
  /* não cabe tudo: o nome do produto nunca é cortado */
  var espaco=120-nome.length-4;                 /* ' (' + '…)' */
  if(espaco<3)return nome.slice(0,120);
  return nome+' ('+ops.join(', ').slice(0,espaco)+'…)';
}
function montarNfce(ped,cupom,suc){
  if(!ped)return {erro:'A venda não está neste aparelho.'};
  var u=fiscalUn(suc);
  var rede=fiscalCfg();
  var simples=String(u.regime||'simplesNacional').indexOf('simples')===0;
  var taxaItens=0;
  var itens=(ped.itens||[]).filter(function(it){
    if(!(Number(it.total)>0.0049))return false;
    var pp=(DB.produtos||[]).find(function(x){return x.id===it.produtoId});
    if(ehTaxaEntrega(pp,it)){taxaItens+=Number(it.total)||0;return false;}
    return true;
  });
  /* o brinde do cartão fidelidade sai por R$ 0,00 e não entra no cupom:
     já saiu do estoque no resgate, e item sem valor é recusado */
  if(!itens.length)return {erro:'Venda sem valor — não há cupom a emitir.',semValor:true};
  var linhas=[];
  for(var i=0;i<itens.length;i++){
    var it=itens[i];
    var p=(DB.produtos||[]).find(function(x){return x.id===it.produtoId})||{};
    var ncm=fsDigitos(p.ncm||rede.ncm);
    var cfop=fsDigitos(p.cfop||rede.cfop||'5102');
    var csosn=fsDigitos(p.csosn||rede.csosn||'102');
    var cst=fsDigitos(p.cst||rede.cst||'00');
    var st=simples?(csosn==='500'||csosn==='201'||csosn==='202'||csosn==='203')
                  :(cst==='60'||cst==='10'||cst==='70');
    var cest=fsDigitos(p.cest);
    if(ncm.length!==8)return {erro:'O produto "'+(it.nome||p.nome||'')+'" está sem NCM, e a Receita exige. Corrija no cadastro do produto.',faltaCadastro:true};
    if(st&&cest.length!==7)return {erro:'O produto "'+(it.nome||p.nome||'')+'" está sem CEST, e a Receita exige para produto com substituição tributária. Corrija no cadastro do produto.',faltaCadastro:true};
    if(cfop.length!==4)return {erro:'O produto "'+(it.nome||p.nome||'')+'" está com o CFOP inválido.',faltaCadastro:true};
    var origem=Number(p.origemFiscal||rede.origem||0)||0;
    var icms=simples?{origin:origem,csosn:Number(csosn)}
                    :{origin:origem,cst:Number(cst)};
    if(!simples&&(cst==='00'||cst==='20')){
      icms.baseTaxModality=3;icms.rate=Number(rede.aliqIcms)||18;
    }
    var pisCst=Number(u.pisCst||'07'),cofinsCst=Number(u.cofinsCst||'07');
    var pis={cst:pisCst},cofins={cst:cofinsCst};
    if(pisCst===1||pisCst===2)pis.rate=Number(rede.aliqPis)||0.65;
    if(cofinsCst===1||cofinsCst===2)cofins.rate=Number(rede.aliqCofins)||3;
    var qtd=Number(it.qtd)||1;
    var total=+(Number(it.total)||0).toFixed(2);
    var unTrib=p.unTrib||'UN';
    linhas.push({
      code:String(p.codigo||p.id||it.produtoId||('item'+(i+1))).slice(0,60),
      description:fsDescricaoItem(it,p),
      ncm:ncm,cest:cest||undefined,cfop:Number(cfop),
      unit:unTrib,quantity:qtd,unitAmount:+(total/qtd).toFixed(4),totalAmount:total,
      unitTax:unTrib,quantityTax:qtd,unitTaxAmount:+(total/qtd).toFixed(4),
      makeupTotal:true,
      taxes:{icms:icms,pis:pis,cofins:cofins}
    });
  }
  /* o que o cliente pagou manda: taxa de entrega entra como "outras
     despesas", desconto e cupom de desconto como desconto, e a soma bate
     com o total da venda no centavo */
  var produtos=+linhas.reduce(function(a,l){return a+l.totalAmount},0).toFixed(2);
  var outros=+((Number(ped.taxa)||0)+taxaItens).toFixed(2);
  var totalVenda=+(Number(ped.total)||0).toFixed(2);
  var desconto=+(produtos+outros-totalVenda).toFixed(2);
  if(desconto<0){outros=+(outros-desconto).toFixed(2);desconto=0;}
  var pesos=linhas.map(function(l){return l.totalAmount});
  var dd=_dist(desconto,pesos),oo=_dist(outros,pesos);
  linhas.forEach(function(l,k){
    if(dd[k]>0)l.discountAmount=dd[k];
    if(oo[k]>0)l.othersAmount=oo[k];
  });
  /* pagamentos: o valor APLICADO de cada forma (sem o troco) */
  var pags=(ped.pagamentos||[]).filter(function(g){return Number(g.valor)>0.0049})
    .map(function(g){
      var m=formaSpedy(g);
      var o={method:m,amount:+(Number(g.valor)||0).toFixed(2)};
      if(m==='creditCard'||m==='debitCard')o.card={isIntegratedPayment:false};
      return o;
    });
  if(!pags.length)pags=[{method:'other',amount:totalVenda}];
  var somaPg=+pags.reduce(function(a,g){return a+g.amount},0).toFixed(2);
  if(Math.abs(somaPg-totalVenda)>0.009){
    var ult=pags[pags.length-1];ult.amount=+(ult.amount+totalVenda-somaPg).toFixed(2);
  }
  var nota={
    integrationId:String(ped.id),
    isFinalCustomer:true,operationType:'outgoing',destination:'internal',
    presenceType:(ped.origem==='online'||ped.canal==='cardapio')
      ?(ped.tipo==='entrega'?'delivery':'internet'):'presence',
    operationNature:'Venda de Mercadoria',
    sendEmailToCustomer:false,
    items:linhas,payments:pags,
    total:{invoiceAmount:totalVenda,productAmount:produtos,
           discountAmount:desconto||undefined,othersAmount:outros||undefined},
    additionalInformation:'Pedido '+(ped.numero||'')
  };
  var doc=fsDigitos(cupom&&cupom.doc);
  if(doc&&docFiscalValido(doc)){
    nota.receiver={federalTaxNumber:doc};
    if(cupom.consumidor)nota.receiver.name=String(cupom.consumidor).slice(0,60);
  }
  return {nota:nota};
}

/* ==========================================================
   EMITIR — em segundo plano, sem nunca segurar o caixa
   ========================================================== */
function aplicarNotaNoCupom(c,n){
  if(!c||!n)return;
  c.spedyId=n.spedyId||c.spedyId||'';
  c.status=n.status||c.status;
  if(n.numero)c.numero=Number(n.numero)||c.numero;
  if(n.serie)c.serie=Number(n.serie)||c.serie;
  c.chave=n.chave||c.chave||'';
  c.protocolo=n.protocolo||c.protocolo||'';
  c.motivo=n.motivo||'';
  c.pdf=n.pdf||c.pdf||'';c.xml=n.xml||c.xml||'';
  c.contingencia=n.status==='contingencia';
  c.emitidoEm=n.autorizadaEm||n.emitidaEm||c.emitidoEm||'';
  if(n.ambiente)c.ambiente=n.ambiente==='production'?'producao':'homologacao';
  if(n.status==='cancelado'&&!c.canceladoEm)c.canceladoEm=new Date().toISOString();
}
function _fsGuardar(){
  salvar();
  if(NUVEM.ligada&&typeof sincronizar==='function'){
    try{ sincronizar(); }catch(e){_quieto(e,'fiscal sincronizar')}
  }
}
async function emitirCupom(cupomId){
  var c=baseCuponsFiscais().find(function(x){return x.id===cupomId});
  if(!c||_fsEmitindo[c.id])return c||null;
  if(['autorizado','contingencia','cancelado','inutilizado'].indexOf(c.status)>=0)return c;
  /* a venda foi cancelada antes de a SEFAZ responder: nao emite documento
     para uma venda que nao existe mais */
  if(c.naoEmitir){c.status='sem_cupom';c.motivo=c.motivoPendencia||'Venda cancelada.';return c;}
  var ped=(DB.pedidos||[]).find(function(p){return p.id===c.pedidoId});
  var suc=c.sucursalId||(ped&&ped.sucursalId)||lojaAtualId();
  c.sucursalId=suc;
  if(!NUVEM.ligada||!NUVEM.token){
    c.status='pendente';c.motivo='Sem internet — o cupom sai assim que a conexão voltar.';
    salvar();return c;
  }
  var m=montarNfce(ped,c,suc);
  if(m.erro){
    c.status=m.semValor?'sem_valor':'pendente';c.motivo=m.erro;c.faltaCadastro=!!m.faltaCadastro;
    _fsGuardar();fsChip(c);return c;
  }
  _fsEmitindo[c.id]=true;
  try{
    c.status='enviando';c.motivo='';c.faltaCadastro=false;
    c.tentativas=(c.tentativas||0)+1;
    salvar();fsChip(c);
    var r=await fiscalChamar('emitir',{sucursal:suc,nota:m.nota});
    if(r.ok&&r.d&&r.d.nota)aplicarNotaNoCupom(c,r.d.nota);
    else if(r.status===0||r.status===429||r.status>=500){
      c.status='pendente';c.motivo=(r.d&&r.d.erro)||'O fiscal não respondeu — o cupom será reenviado.';
    }else{
      c.status=(r.d&&r.d.status==='rejeitado')?'rejeitado':'pendente';
      c.motivo=(r.d&&r.d.erro)||'A emissão foi recusada.';
    }
  }finally{ _fsEmitindo[c.id]=false; }
  _fsGuardar();fsChip(c);fsDepoisDeEmitir(c);
  if(c.status==='enviando')acompanharCupom(c.id);
  return c;
}
/* acompanhar pelo GET, nunca pelo check-status (documentação da Spedy) */
async function acompanharCupom(cupomId,esperas){
  esperas=esperas||[2000,3000,5000,8000,13000,20000];
  for(var i=0;i<esperas.length;i++){
    await new Promise(function(ok){setTimeout(ok,esperas[i])});
    var c=baseCuponsFiscais().find(function(x){return x.id===cupomId});
    if(!c||c.status!=='enviando')return c;
    var r=await fiscalChamar('consultar',c.spedyId?{sucursal:c.sucursalId,id:c.spedyId}
                                              :{sucursal:c.sucursalId,integrationId:c.pedidoId});
    if(r.ok&&r.d&&r.d.nota){
      aplicarNotaNoCupom(c,r.d.nota);
      if(c.status!=='enviando'){_fsGuardar();fsChip(c);fsDepoisDeEmitir(c);return c;}
    }
  }
  return baseCuponsFiscais().find(function(x){return x.id===cupomId});
}
/* o que ficou para trás: sai sozinho quando a conexão volta. Só a
   unidade aberta, só o que é desta loja — nunca emite pela vizinha. */
async function fiscalReprocessar(){
  if(!NUVEM.ligada||!NUVEM.token)return 0;
  var suc=lojaAtualId();
  if(!fiscalEmite(suc))return 0;
  var u=fiscalUn(suc),n=0,limite=Date.now()-24*3600*1000;
  var lst=baseCuponsFiscais().filter(function(c){
    if((c.sucursalId||suc)!==suc)return false;
    if(c.faltaCadastro)return false;
    if(c.status!=='pendente'&&c.status!=='enviando')return false;
    var ped=(DB.pedidos||[]).find(function(p){return p.id===c.pedidoId});
    if(!ped)return false;
    if(new Date(ped.data||c.data).getTime()<limite)return false;
    /* só o que já tinha sido mandado emitir: venda feita antes de a loja
       ligar a emissão não vira cupom sozinha, horas depois */
    return c.status==='enviando'||c.querEmitir||(c.tentativas||0)>0||!!c.motivo;
  }).slice(0,10);
  for(var i=0;i<lst.length;i++){
    var c=lst[i];
    if(c.status==='enviando'){
      var r=await fiscalChamar('consultar',c.spedyId?{sucursal:suc,id:c.spedyId}
                                                :{sucursal:suc,integrationId:c.pedidoId});
      if(r.ok&&r.d&&r.d.nota){aplicarNotaNoCupom(c,r.d.nota);n++;}
      else if(r.ok&&r.d&&r.d.nota===null){c.status='pendente';}
    }else{ await emitirCupom(c.id);n++; }
  }
  if(n)_fsGuardar();
  return n;
}

/* ---------- o aviso do caixa: pequeno, no canto, sem pedir clique ---------- */
function fsChip(c){
  if(!c||typeof document==='undefined')return;
  var o=document.getElementById('fsChip');if(o)o.remove();
  var txt='',cls='';
  if(c.status==='enviando'){txt='Emitindo o cupom…';cls='';}
  else if(c.status==='autorizado'){txt='Cupom '+(c.numero||'')+' autorizado.';cls='ok';}
  else if(c.status==='contingencia'){txt='A SEFAZ está fora do ar. O cupom foi emitido em contingência: vale como documento e será transmitido sozinho quando ela voltar.';cls='at';}
  else if(c.status==='rejeitado'){txt='A Receita recusou este cupom: '+(c.motivo||'')+' A venda está salva. Corrija e reenvie em Cupons Gerados.';cls='rd';}
  else if(c.status==='pendente'&&c.motivo){txt=c.motivo+(c.faltaCadastro?' A venda está salva.':'');cls='at';}
  else return;
  var d=document.createElement('div');
  d.id='fsChip';d.className='fsChip '+cls;
  d.innerHTML='<span>'+E(txt)+'</span>'+
    ((c.status==='autorizado'||c.status==='contingencia')?'<button class="btnMini" onclick="imprimirDanfe(\''+E(c.id)+'\')">Imprimir cupom fiscal</button>':'')+
    '<button class="btnMini" aria-label="Fechar aviso" onclick="this.parentNode.remove()">✕</button>';
  document.body.appendChild(d);
  if(c.status!=='enviando')setTimeout(function(){if(d.parentNode)d.remove()},c.status==='autorizado'?15000:30000);
}

/* ==========================================================
   A TELA DE PAGAMENTO DO PDV
   ========================================================== */
function blocoFiscalPagamento(){
  var suc=lojaAtualId(),u=fiscalUn(suc);
  if(!fiscalEmite(suc))return '';
  var cpfCampo=u.pedeCpf==='nunca'?'':
    '<div class="fld2" style="margin-top:8px"><label>CPF ou CNPJ na nota '+
    '<small style="font-weight:400;opacity:.7">(opcional)</small></label>'+
    '<input id="pgCpf" inputmode="numeric" autocomplete="off" maxlength="18" '+
    'placeholder="só números — deixe em branco para sair sem CPF"'+
    (PDV.cliente&&PDV.cliente.cpf?' value="'+E(PDV.cliente.cpf)+'"':'')+'></div>';
  if(u.modo==='sempre')
    return '<div class="fsPg">'+sv('check',14)+'<span><b>Cupom fiscal</b> sai automático nesta loja'+
      (u.ambiente!=='producao'?' <em>(ambiente de teste)</em>':'')+'.</span></div>'+cpfCampo;
  return '<label class="chkL"><input type="checkbox" id="pgFiscal"><span>Gerar cupom fiscal</span></label>'+cpfCampo;
}
function fiscalEscolhido(){
  var suc=lojaAtualId(),u=fiscalUn(suc);
  var chk=document.getElementById('pgFiscal');
  var emitir=fiscalEmite(suc)&&(u.modo==='sempre'||!!(chk&&chk.checked));
  var cpfEl=document.getElementById('pgCpf');
  var cpf=cpfEl?fsDigitos(cpfEl.value):'';
  if(cpf&&!docFiscalValido(cpf))
    return {erro:'O CPF/CNPJ da nota não é válido — corrija ou deixe em branco.'};
  return {emitir:emitir,cpf:cpf};
}

/* ==========================================================
   CONFIGURAÇÃO FISCAL DA UNIDADE — loja/fiscal
   ========================================================== */
/* ==========================================================
   A TELA FISCAL SEGUE A LOJA ESCOLHIDA NO ALTO (28/09/2026)

   A tela tinha um seletor de unidade próprio e guardava a unidade da
   primeira visita. O Rafael trocou a loja no alto para Santa Fé, abriu
   a Configuração Fiscal — e viu a empresa, o CNPJ e o certificado da
   MATRIZ. Duas escolhas de loja na mesma tela, e a de dentro vencia.

   Agora só existe uma: a loja do alto (lojaAtualId), a mesma que o
   sistema inteiro obedece. Trocou lá, a tela recarrega a unidade nova.
   ========================================================== */
function _fsSuc(){ return lojaAtualId(); }
function fsMudou(){
  FS.sujo=true;
  var e=document.getElementById('fsEstadoSalvo');
  if(e){e.textContent='Há mudanças ainda não salvas';e.className='sujo';}
}
function _fsOpc(v,lista){
  return lista.map(function(o){
    return '<option value="'+o[0]+'"'+(String(v)===String(o[0])?' selected':'')+'>'+E(o[1])+'</option>';
  }).join('');
}
function _fsPendencias(u){
  var p=[];
  if(!u.vinculada)p.push('ligar esta unidade à empresa dela na Spedy (o CNPJ tem de ser o desta loja)');
  if(u.spedy){
    if(!u.spedy.ie)p.push('inscrição estadual da empresa (cadastro na Spedy)');
    if(!u.spedy.certificado)p.push('certificado digital A1 da empresa');
    if(!u.spedy.nfceToken)p.push('CSC da SEFAZ para '+(u.ambiente==='producao'?'produção':'homologação'));
  }
  var rede=fiscalCfg();
  var semNcm=(DB.produtos||[]).filter(function(x){
    return x.ativo!==false&&!ehTaxaEntrega(x)&&fsDigitos(x.ncm||rede.ncm).length!==8;}).length;
  if(semNcm)p.push(semNcm+' produto(s) ativos sem NCM — a Receita recusa o cupom. Corrija em Fiscal › Impostos dos Produtos');
  var semCest=(DB.produtos||[]).filter(function(x){
    var pf=perfilDoProduto(x);return x.ativo!==false&&pf&&pf.st&&fsDigitos(x.cest).length!==7;}).length;
  if(semCest)p.push(semCest+' produto(s) de substituição tributária sem CEST. Corrija em Fiscal › Impostos dos Produtos');
  return p;
}
async function telaFiscalCfg(recarregar){
  var suc=_fsSuc();
  var u=baseFiscalUn()[suc];
  /* dado de outra visita não vale: mais de 30 s, ou de outra unidade, busca de novo */
  var velho=!u||!u.lidoEm||(Date.now()-Date.parse(u.lidoEm))>30000||(u.ref&&u.ref!==suc);
  if((recarregar||velho)&&NUVEM.ligada&&NUVEM.token&&!FS.carregando){
    FS.carregando=true;
    $('content').innerHTML='<div class="etWrap"><div class="etScroll"><div class="etTopo"><div>'+
      '<h1>Configuração Fiscal</h1><p>Conferindo '+E(sucNome(suc))+' com o servidor fiscal…</p></div></div></div></div>';
    try{ await fiscalCarregar(suc); }finally{ FS.carregando=false; }
    /* trocaram a loja no alto enquanto a resposta vinha: desenha a nova */
    if(_fsSuc()!==suc)return telaFiscalCfg();
    u=baseFiscalUn()[suc];
  }
  u=u||fiscalUn(suc);
  var gerir=!!u.podeGerir;
  var dis=gerir?'':' disabled';
  var pend=_fsPendencias(u);
  var matriz=typeof ehMatriz==='function'&&ehMatriz();
  var sp=u.spedy||{};
  var teste=!u.conta||u.conta.host!=='producao';

  var faixa;
  if(!NUVEM.ligada)
    faixa='<div class="fscPend">'+sv('help',16)+'<div><b>Sem conexão com a nuvem</b>'+
      'A configuração fiscal fica no servidor. Entre com a internet ligada para ver e alterar.</div></div>';
  else if(FS.erro)
    faixa='<div class="fscPend">'+sv('help',16)+'<div><b>O fiscal não respondeu</b>'+E(FS.erro)+'</div></div>';
  else if(fiscalEmite(suc)&&!pend.length)
    faixa='<div class="fscOk">'+sv('nike',16)+' Emitindo cupom '+
      (u.ambiente==='producao'?'em <b>produção</b> — vale para a Receita.':'em <b>homologação</b> — os cupons ainda não valem como documento fiscal.')+'</div>';
  else
    faixa='<div class="fscPend">'+sv('help',16)+'<div><b>'+(pend.length?'Falta para emitir':'Emissão desligada nesta loja')+'</b>'+
      (pend.length?'<ul>'+pend.map(function(x){return '<li>'+E(x)+'</li>'}).join('')+'</ul>':
        'Tudo pronto. Escolha o modo de emissão abaixo e salve.')+'</div></div>';

  var seletor='<div class="fsUnidade"><span>Unidade</span><b id="fsUnidadeNome">'+E(sucNome(suc))+'</b>'+
    (matriz?'<em>Para configurar outra loja, troque a loja no alto da tela.</em>':'')+'</div>';

  var emissao='<div class="cfgCol"><div class="colH">Como esta loja emite</div><div class="fsCorpo">'+
   '<div class="fld2"><label>Modo</label><select id="fsModo" onchange="fsMudou()"'+dis+'>'+
    _fsOpc(u.modo,[['sempre','Sempre — toda venda sai com cupom fiscal'],
                   ['opcional','Sob demanda — o caixa marca quando emitir'],
                   ['desligado','Desligado — nenhum cupom é emitido']])+'</select></div>'+
   '<div class="fld2"><label>Ambiente</label><select id="fsAmb" onchange="fsMudou()"'+dis+'>'+
    _fsOpc(u.ambiente,[['homologacao','Homologação — teste, sem valor fiscal'],
                       ['producao','Produção — vale para a Receita']])+'</select>'+
    '<div class="hint">'+(teste
      ?'A chave cadastrada é de <b>teste</b>: os cupons nunca valem como documento. Para produção, a conta de produção da Spedy precisa ser ligada.'
      :'Ligar a produção pede o CNPJ da unidade digitado de volta — é a confirmação de que as notas passam a valer.')+'</div></div>'+
   /* onde a confirmação da produção aparece — na tela, nunca numa
      janelinha do navegador (ver fsPedirCnpjProducao) */
   '<div id="fsProdConf"></div>'+
   '<div class="row2">'+
    '<div class="fld2"><label>Série da NFC-e</label><input id="fsSerie" type="number" min="1" max="999" value="'+(u.serie||1)+'" oninput="fsMudou()"'+dis+'></div>'+
    '<div class="fld2"><label>Próximo número</label><input value="'+E(sp.nfceProximo!=null?String(sp.nfceProximo):'—')+'" disabled>'+
     '<div class="hint">Vem da Spedy.</div></div>'+
   '</div>'+
   '<div class="row2">'+
    '<div class="fld2"><label>CPF na nota</label><select id="fsCpf" onchange="fsMudou()"'+dis+'>'+
     _fsOpc(u.pedeCpf,[['perguntar','Mostrar o campo em toda venda'],['nunca','Não mostrar']])+'</select></div>'+
    '<div class="fld2"><label>Contingência</label><select id="fsCont" onchange="fsMudou()"'+dis+'>'+
     _fsOpc(u.contingencia===false?'0':'1',[['1','Emitir mesmo com a SEFAZ fora do ar'],['0','Esperar a SEFAZ voltar']])+'</select>'+
     '<div class="hint">Em contingência o cupom vale na hora e é transmitido sozinho depois.</div></div>'+
   '</div>'+
   /* ---------- imprimir o cupom fiscal ----------
      O campo existia no banco e mandava na impressão automática, mas
      NÃO estava na tela: ficava em "perguntar" para sempre, e
      "perguntar" não perguntava nada — o cupom fiscal simplesmente
      nunca saía na bobina. Santa Fé emitiu em produção e só a ficha
      imprimiu (29/09/2026). */
   '<div class="fld2"><label>Imprimir o cupom fiscal</label><select id="fsImp" onchange="fsMudou()"'+dis+'>'+
    _fsOpc(u.imprime,[['sempre','Sempre — sai na bobina assim que a SEFAZ autoriza'],
                      ['perguntar','Perguntar a cada venda'],
                      ['nunca','Nunca — só quando alguém pedir']])+'</select>'+
    '<div class="hint">A ficha do pedido continua saindo como hoje; isto é o documento fiscal, com QR Code.</div></div>'+
   '<div class="row2">'+
    '<div class="fld2"><label>Regime tributário</label><select id="fsReg" onchange="fsMudou()"'+dis+'>'+
     _fsOpc(u.regime||'simplesNacional',[['simplesNacional','Simples Nacional'],
       ['simplesNacionalExcessoSublimite','Simples — excesso de sublimite'],
       ['simplesNacionalMEI','MEI'],['regimeNormal','Regime normal (presumido ou real)']])+'</select></div>'+
    '<div class="fld2"><label>PIS / COFINS (CST)</label><div class="row2" style="gap:6px">'+
     '<input id="fsPis" maxlength="2" value="'+E(u.pisCst||'07')+'" oninput="fsMudou()"'+dis+'>'+
     '<input id="fsCofins" maxlength="2" value="'+E(u.cofinsCst||'07')+'" oninput="fsMudou()"'+dis+'></div>'+
     '<div class="hint">No Simples costuma ser 07. Confirme com o contador.</div></div>'+
   '</div>'+
   (gerir?'<div class="permSalvar">'+
     '<span id="fsEstadoSalvo" class="'+(FS.sujo?'sujo':'')+'">'+(FS.sujo?'Há mudanças ainda não salvas':'Tudo salvo')+'</span>'+
     '<button class="btnP2 ok" id="fsBtnSalvar" onclick="fsSalvar()">'+sv('check',13)+' Salvar</button></div>'
    :'<div class="hint">Só a matriz ou o responsável pela unidade alteram o fiscal.</div>')+
  '</div></div>';

  var empresa='<div class="cfgCol"><div class="colH">Empresa emissora (Spedy)</div><div class="fsCorpo">'+
   (u.vinculada
    ?'<div class="fsLinha"><span>Razão social</span><b>'+E(sp.nome||u.razao||'—')+'</b></div>'+
     '<div class="fsLinha"><span>CNPJ</span><b>'+E(fsCnpjFmt(sp.cnpj||u.cnpj))+'</b></div>'+
     '<div class="fsLinha"><span>Inscrição estadual</span><b>'+E(sp.ie||'não cadastrada')+'</b></div>'+
     /* sem IE a SEFAZ recusa a nota; quem gere a unidade cadastra aqui (28/09/2026) */
     (gerir?'<div class="fsIe"><input id="fsIe" inputmode="numeric" maxlength="20" aria-label="Inscrição estadual" '+
       'placeholder="'+(sp.ie?'trocar a inscrição estadual':'inscrição estadual (só números)')+'">'+
       '<button class="btnP2'+(sp.ie?'':' ok')+'" onclick="fsSalvarIe()">'+(sp.ie?'Trocar':'Guardar')+'</button></div>':'')+
     '<div class="fsLinha"><span>Certificado A1</span><b>'+E(sp.certificado&&sp.certificado.validade
        ?'válido até '+dataBR(String(sp.certificado.validade).slice(0,10)):'não enviado')+'</b></div>'+
     '<div class="fsLinha"><span>CSC homologação / produção</span><b>'+
       (u.cscHomologacao?'cadastrado':'falta')+' / '+(u.cscProducao?'cadastrado':'falta')+'</b></div>'
    :'<div class="hint" style="margin-bottom:10px">Esta unidade ainda não está ligada a uma empresa na Spedy. '+
     (matriz?'Escolha abaixo a empresa com o CNPJ desta loja.':'Peça à matriz para ligar.')+'</div>'+
     (matriz?'<div id="fsEmpresas"><button class="btnP2" onclick="fsListarEmpresas()">Ver empresas da conta</button>'+
       /* a empresa pode simplesmente nao existir nesta conta — foi o que
          aconteceu ao trocar a conta de teste pela de producao, em
          29/09/2026: a loja ficou sem onde colar o CSC nem o
          certificado, porque os dois pedem uma empresa ligada. O
          caminho de saida mora aqui, ao lado da lista. */
       '<button class="btnP2 ok" style="margin-left:8px" onclick="fsCadastrarEmpresa()">'+
       sv('check',13)+' Cadastrar esta loja na Spedy</button></div>':''))+
  '</div></div>';

  var csc=gerir&&u.vinculada?'<div class="cfgCol"><div class="colH">CSC da SEFAZ</div><div class="fsCorpo">'+
   '<div class="hint" style="margin-bottom:9px">O código que valida o QR Code do cupom. É gerado no portal da '+
   'SEFAZ-SP, um par para homologação e outro para produção. Depois de salvo, não aparece de novo.</div>'+
   '<div class="row2">'+
    /* lembra o que foi escolhido: depois de guardar, a tela se redesenha
       e voltava sozinha para Homologação — parecia que o CSC de produção
       não tinha sido salvo, e o Rafael refez três vezes (29/09/2026) */
    '<div class="fld2"><label>Ambiente</label><select id="fsCscAmb" onchange="fsCscMarcar()">'+
     _fsOpc(FS.cscAmb||u.ambiente,[['homologacao','Homologação'],['producao','Produção']])+'</select></div>'+
    '<div class="fld2"><label>ID do CSC</label><input id="fsCscId" inputmode="numeric" placeholder="ex.: 1"></div>'+
   '</div>'+
   '<div class="fld2"><label>Código CSC</label><input id="fsCscCod" type="password" autocomplete="new-password" placeholder="cole o código da SEFAZ"></div>'+
   '<div id="fsCscSalvo"></div>'+
   '<button class="btnP2 ok" id="fsCscBtn" onclick="fsCsc()">'+sv('check',13)+' Guardar CSC</button>'+
  '</div></div>':'';

  var certOk=!!(sp.certificado&&sp.certificado.validade);
  var cert=gerir&&u.vinculada?'<div class="cfgCol"><div class="colH">Certificado digital A1</div><div class="fsCorpo">'+
   '<div class="hint" style="margin-bottom:9px">O arquivo .pfx do e-CNPJ desta unidade e a senha dele. '+
   'Vão direto para a Spedy — o Joia não guarda o arquivo.</div>'+
   (certOk?'<div class="fsPg" id="fsCertSalvo">'+sv('check',13)+' Certificado guardado <em>válido até '+
     E(dataBR(String(sp.certificado.validade).slice(0,10)))+'</em></div>':'')+
   '<div class="fld2"><label>'+(certOk?'Trocar arquivo (.pfx)':'Arquivo (.pfx)')+'</label><input id="fsCertArq" type="file" accept=".pfx,.p12"></div>'+
   '<div class="fld2"><label>Senha do certificado</label><input id="fsCertSenha" type="password" autocomplete="new-password"'+
     (certOk?' placeholder="••••••••  guardada"':'')+'></div>'+
   '<button class="btnP2 ok" onclick="fsCertificado()">'+sv('check',13)+(certOk?' Trocar certificado':' Enviar certificado')+'</button>'+
  '</div></div>':'';

  /* a conta da Spedy é da REDE: uma só, e é a matriz que a liga. É aqui
     que a chave de produção entra — e a tela diz, sem rodeio, em qual
     das duas contas o sistema está falando agora (29/09/2026) */
  var conta=matriz?'<div class="cfgCol"><div class="colH">Conta da Spedy (rede)</div><div class="fsCorpo">'+
   (u.conta
    ?'<div class="fsLinha"><span>Ambiente em uso</span><b>'+(teste?'TESTE — nenhum cupom vale':'PRODUÇÃO — os cupons valem para a Receita')+'</b></div>'+
     '<div class="fsLinha"><span>Titular</span><b>'+E(u.conta.titularNome||'—')+'</b></div>'+
     '<div class="fsLinha"><span>CNPJ do titular</span><b>'+E(fsCnpjFmt(u.conta.titularCnpj))+'</b></div>'
    :'<div class="hint" style="margin-bottom:10px">Nenhuma conta da Spedy ligada ainda.</div>')+
   '<div class="hint" style="margin:9px 0">A chave da API fica no cofre do servidor e nunca volta para a tela. '+
   'Trocar a conta desliga o vínculo das lojas: as empresas de teste e de produção são diferentes, '+
   'e cada loja precisa ser ligada de novo à empresa dela.</div>'+
   '<div class="row2">'+
    '<div class="fld2"><label>Qual conta</label><select id="fsContaAmb">'+
     _fsOpc(u.conta?u.conta.host:'producao',[['producao','Produção — vale para a Receita'],['sandbox','Teste (sandbox)']])+'</select></div>'+
    '<div class="fld2"><label>Chave da API</label><input id="fsContaChave" type="password" autocomplete="new-password" '+
     'placeholder="'+(u.conta?'cole a chave nova':'cole a chave da conta')+'"></div>'+
   '</div>'+
   '<button class="btnP2 ok" onclick="fsContaChave()">'+sv('check',13)+(u.conta?' Trocar a conta':' Ligar a conta')+'</button>'+
  '</div></div>':'';

  /* o imposto de cada produto tem tela própria agora (Fiscal › Impostos dos
     Produtos), onde se vê, corrige e salva produto por produto (28/09/2026) */
  var perfis=matriz?'<div class="cfgCol"><div class="colH">Impostos dos produtos (rede)</div><div class="fsCorpo">'+
   '<div class="hint" style="margin-bottom:9px">NCM, CEST, CFOP e CSOSN de cada produto ficam em '+
   '<b>Fiscal › Impostos dos Produtos</b>: lá você vê todos, corrige e salva.</div>'+
   '<button class="btnP2 ok" onclick="abrir(\'fiscal\',\'impostos\')">'+sv('edit',13)+' Abrir Impostos dos Produtos</button>'+
  '</div></div>':'';

  $('content').innerHTML='<div class="etWrap"><div class="etScroll">'+
   '<div class="etTopo"><div><h1>Configuração Fiscal</h1>'+
   '<p>Cupom fiscal (NFC-e) de cada loja. Cada unidade emite com o próprio CNPJ.</p></div>'+
   '<button class="infoBt" aria-label="O que a lei exige" onclick="explicaFiscal()">'+sv('help',15)+'</button></div>'+
   '<div class="fsTopo">'+seletor+faixa+'</div>'+
   '<div class="cfgDuas">'+emissao+empresa+'</div>'+
   ((csc||cert)?'<div class="cfgDuas">'+csc+cert+'</div>':'')+
   ((conta||perfis)?'<div class="cfgDuas">'+conta+perfis+'</div>':'')+
   '</div></div>';
  rodape(fiscalEmite(suc)?'fiscal ligado — '+(u.ambiente==='producao'?'PRODUÇÃO':'homologação'):'fiscal desligado');
  fsCscMarcar();
}
/* o que já está guardado aparece marcado: o código em si nunca volta do
   cofre, mas a tela não pode parecer vazia quando não está (Rafael,
   28/09/2026 — colou o CSC, a tela ficou em branco e parecia que nada
   tinha sido salvo) */
function fsCscMarcar(){
  var sel=$('fsCscAmb'),box=$('fsCscSalvo');if(!sel||!box)return;
  FS.cscAmb=sel.value;
  var u=(fiscalUn(_fsSuc())||{});
  var prod=sel.value==='producao';
  var id=prod?u.cscIdProducao:u.cscIdHomologacao;
  var ok=prod?u.cscProducao:u.cscHomologacao;
  var cId=$('fsCscId'),cCod=$('fsCscCod'),bt=$('fsCscBtn');
  if(cId)cId.value=id||'';
  if(cCod){cCod.value='';cCod.placeholder=ok?'••••••••••••••••  guardado':'cole o código da SEFAZ';}
  box.innerHTML=ok?'<div class="fsPg">'+sv('check',13)+' CSC de '+(prod?'produção':'homologação')+
    ' guardado <em>ID '+E(id||'')+'</em></div>':'';
  if(bt)bt.innerHTML=sv('check',13)+(ok?' Trocar CSC':' Guardar CSC');
}
function fsCnpjFmt(c){
  c=fsDigitos(c);
  return c.length===14?c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,'$1.$2.$3/$4-$5'):(c||'—');
}
async function fsSalvar(){
  if(FS.salvando)return;
  var suc=_fsSuc(),u=fiscalUn(suc);
  function v(id){var e=document.getElementById(id);return e?e.value:undefined;}
  var cfgN={modo:v('fsModo'),ambiente:v('fsAmb'),serie:v('fsSerie'),pedeCpf:v('fsCpf'),
            imprime:v('fsImp'),
            contingencia:v('fsCont')==='1',regime:v('fsReg'),pisCst:v('fsPis'),cofinsCst:v('fsCofins')};
  /* ==========================================================
     A CONFIRMAÇÃO DA PRODUÇÃO MORA NA TELA, NÃO NUMA JANELINHA
     (29/09/2026)

     Era `window.prompt`. Quando o navegador bloqueia a janelinha — e o
     Chrome bloqueia, sem pedir licença, depois que a pessoa dispensa
     uma —, `prompt` devolve nulo e a função saía calada: a tela voltava
     para Homologação e nada explicava por quê.

     O Rafael passou meia hora nisso, achando que o sistema desfazia a
     escolha dele. Era a janelinha que nunca aparecia.

     Agora a confirmação é um campo da própria tela: aparece, se vê,
     e o teste consegue clicar nela.
     ========================================================== */
  if(cfgN.ambiente==='producao'&&u.ambiente!=='producao'){
    FS.pedindoCnpj=true;
    fsPedirCnpjProducao(u);
    return;
  }
  FS.pedindoCnpj=false;
  FS.salvando=true;
  var e=document.getElementById('fsEstadoSalvo');if(e){e.textContent='Salvando…';e.className='';}
  var r=await fiscalChamar('salvar',{sucursal:suc,config:cfgN});
  FS.salvando=false;
  if(!r.ok){painelErro('Não salvei a configuração fiscal.',(r.d&&r.d.erro)||'O servidor recusou.');fsMudou();return;}
  FS.sujo=false;
  await telaFiscalCfg(true);
  toast(r.d.aviso?r.d.aviso:'Tudo salvo.');
}
/* ==========================================================
   CADASTRAR A LOJA NA SPEDY — o caminho que faltava (29/09/2026)

   Trocar a conta de teste pela de producao deixou Santa Fe sem empresa
   do lado de la, e a tela sem saida: CSC e certificado so aparecem
   depois que a loja esta ligada a uma empresa, e nao havia como criar
   a empresa por aqui.

   O formulario ja vem PREENCHIDO com o cadastro da outra conta, pelo
   CNPJ da loja (`modelo_empresa`). Digitar de novo razao social,
   endereco e inscricao estadual e onde nasce a diferenca entre o que a
   SEFAZ tem e o que a nota diz — e a SEFAZ recusa por bem menos.
   ========================================================== */
async function fsCadastrarEmpresa(){
  var suc=_fsSuc(), box=document.getElementById('fsEmpresas');
  if(box)box.innerHTML='<div class="hint">Procurando o cadastro desta loja…</div>';
  var r=await fiscalChamar('modelo_empresa',{sucursal:suc});
  var e=(r.ok&&r.d.empresa)||{};
  var s=(baseSuc()||[]).find(function(x){return x.id===suc})||{};
  if(!r.ok&&r.status!==404){
    if(box)box.innerHTML='<div class="hint">'+E((r.d&&r.d.erro)||'Não consegui buscar.')+'</div>';return;
  }
  /* sem modelo na outra conta, o que o Joia ja sabe da loja */
  var v={razao:e.razao||s.razaoSocial||'',fantasia:e.fantasia||s.nome||'',
         ie:e.ie||'',email:e.email||s.email||'',telefone:e.telefone||s.telefone||'',
         rua:e.rua||'',numero:e.numero||'',bairro:e.bairro||'',cep:e.cep||'',
         cidade:e.cidade||s.cidade||'',uf:e.uf||s.uf||'SP',ibge:e.ibge||'',
         regime:e.regime||'simplesNacional'};
  function campo(id,rot,val,dica){
    return '<div class="fld2"><label>'+E(rot)+'</label><input id="fsNe_'+id+'" value="'+E(val||'')+'"'+
      (dica?' placeholder="'+E(dica)+'"':'')+'></div>';
  }
  if(box)box.innerHTML=
   '<div class="hint" style="margin:4px 0 9px">'+
   (r.ok?'Dados trazidos do cadastro desta loja na conta de '+E(r.d.de==='producao'?'produção':'teste')+
         '. Confira e cadastre.'
        :'Esta loja ainda não tem cadastro em nenhuma conta da Spedy. Preencha os dados do cartão CNPJ.')+
   '</div>'+
   '<div class="row2">'+campo('razao','Razão social',v.razao)+campo('fantasia','Nome fantasia',v.fantasia)+'</div>'+
   '<div class="row2">'+campo('ie','Inscrição estadual',v.ie,'só números, ou ISENTO')+
     '<div class="fld2"><label>CNPJ</label><input value="'+E(fsCnpjFmt(s.cnpj))+'" disabled></div></div>'+
   '<div class="row2">'+campo('cep','CEP',v.cep)+campo('rua','Rua',v.rua)+'</div>'+
   '<div class="row2">'+campo('numero','Número',v.numero)+campo('bairro','Bairro',v.bairro)+'</div>'+
   '<div class="row2">'+campo('cidade','Cidade',v.cidade)+campo('uf','UF',v.uf)+'</div>'+
   '<div class="row2">'+campo('email','E-mail',v.email)+campo('telefone','Telefone',v.telefone)+'</div>'+
   '<input type="hidden" id="fsNe_ibge" value="'+E(v.ibge)+'">'+
   '<div class="fld2"><label>Regime tributário</label><select id="fsNe_regime">'+
    _fsOpc(v.regime,[['simplesNacional','Simples Nacional'],
      ['simplesNacionalExcessoSublimite','Simples — excesso de sublimite'],
      ['simplesNacionalMEI','MEI'],['regimeNormal','Regime normal']])+'</select></div>'+
   '<button class="btnP2 ok" style="margin-top:8px" onclick="fsCriarEmpresa()">'+sv('check',13)+
   ' Cadastrar na Spedy</button>';
}
async function fsCriarEmpresa(){
  function v(id){var el=document.getElementById('fsNe_'+id);return el?String(el.value||'').trim():'';}
  var faltam=['razao','rua','numero','bairro','cep','cidade','uf'].filter(function(k){return !v(k)});
  if(faltam.length){toast('Falta preencher: '+faltam.join(', ')+'.');return;}
  var r=await fiscalChamar('criar_empresa',{sucursal:_fsSuc(),empresa:{
    razao:v('razao'),fantasia:v('fantasia'),ie:v('ie'),email:v('email'),telefone:v('telefone'),
    rua:v('rua'),numero:v('numero'),bairro:v('bairro'),cep:v('cep'),
    cidade:v('cidade'),uf:v('uf'),ibge:v('ibge'),regime:v('regime')}});
  if(!r.ok){painelErro('A Spedy não aceitou o cadastro.',(r.d&&r.d.erro)||'O servidor recusou.');return;}
  await telaFiscalCfg(true);
  toast('Loja cadastrada na Spedy. Agora envie o certificado e o CSC.');
}
async function fsListarEmpresas(){
  var box=document.getElementById('fsEmpresas');
  if(box)box.innerHTML='<div class="hint">Consultando a conta…</div>';
  var r=await fiscalChamar('empresas',{});
  if(!r.ok){if(box)box.innerHTML='<div class="hint">'+E((r.d&&r.d.erro)||'Não consegui listar.')+'</div>';return;}
  var suc=_fsSuc(),s=(baseSuc()||[]).find(function(x){return x.id===suc})||{};
  var lst=r.d.empresas||[];
  if(box)box.innerHTML=(lst.length?lst.map(function(e){
    var mesmo=fsDigitos(s.cnpj)&&fsDigitos(s.cnpj)===fsDigitos(e.cnpj);
    return '<div class="fsEmp"><div><b>'+E(e.nome||'')+'</b><span>CNPJ '+E(fsCnpjFmt(e.cnpj))+
      (e.cidade?' · '+E(e.cidade)+(e.uf?'/'+E(String(e.uf).toUpperCase()):''):'')+
      (e.ligadaA?' · já ligada a '+E(sucNome(e.ligadaA)):'')+'</span></div>'+
      (e.ligadaA?'':'<button class="btnP2'+(mesmo?' ok':'')+'" onclick="fsLigarEmpresa(\''+E(e.id)+'\',\''+E(fsDigitos(e.cnpj))+'\')">Ligar a esta unidade</button>')+
      '</div>';
  }).join(''):'<div class="hint">Nenhuma empresa na conta.</div>')+
  '<div class="hint" style="margin-top:8px">A empresa desta loja não está na lista? Ela precisa ser cadastrada na Spedy com o CNPJ da unidade.</div>';
}
async function fsLigarEmpresa(empresaId,cnpjEmp){
  var suc=_fsSuc(),s=(baseSuc()||[]).find(function(x){return x.id===suc})||{};
  var dados={sucursal:suc,empresaId:empresaId};
  /* a mesma janelinha que travou a produção estava aqui (29/09/2026):
     bloqueada pelo navegador, `prompt` devolve nulo e a função saía
     calada. Sem CNPJ no Joia a unidade nem devia chegar a este ponto —
     o CNPJ é o que prende a loja ao CNPJ que assina a nota. Então, em
     vez de perguntar numa janelinha, a tela manda cadastrar onde isso
     mora, e diz qual empresa foi escolhida. */
  if(!fsDigitos(s.cnpj)){
    painelErro('Falta o CNPJ desta loja no Joia.',
      'A unidade '+(s.nome||'')+' não tem CNPJ cadastrado, e é ele que prende a loja ao CNPJ que assina a nota. '+
      'Cadastre em Configuração da Loja › Sucursais da Franquia (a empresa escolhida é do CNPJ '+
      fsCnpjFmt(cnpjEmp)+') e ligue de novo.');
    return;
  }
  if(fsDigitos(s.cnpj)!==fsDigitos(cnpjEmp)){
    painelErro('Esta empresa é de outro CNPJ.','A unidade '+(s.nome||'')+' é do CNPJ '+fsCnpjFmt(s.cnpj)+
      ' e a empresa escolhida é do CNPJ '+fsCnpjFmt(cnpjEmp)+'. Uma unidade só emite com o próprio CNPJ.');
    return;
  }
  var r=await fiscalChamar('vincular',dados);
  if(!r.ok){painelErro('Não liguei a unidade.',(r.d&&r.d.erro)||'O servidor recusou.');return;}
  await telaFiscalCfg(true);
  toast('Unidade ligada à empresa de CNPJ '+fsCnpjFmt(r.d.cnpj)+'.');
}
/* ==========================================================
   A CONTA DA SPEDY — trocar a de teste pela de PRODUÇÃO (29/09/2026)

   Rafael: *"agora eu estou com a API oficial de produção mesmo para
   fazer nota"*. A chave da conta só entrava no cofre por fora, na
   instalação; sem esta porta ele dependeria de mim para ligar a
   produção.

   A chave é conferida na Spedy antes de ser guardada, e nunca volta
   para a tela. Trocar de conta desliga o vínculo das lojas de
   propósito: as empresas de teste e de produção são outras, com outras
   chaves — cada loja é ligada de novo, na conta nova.
   ========================================================== */
async function fsContaChave(){
  var cod=String((($('fsContaChave')||{}).value)||'').trim();
  var host=(($('fsContaAmb')||{}).value)||'producao';
  if(cod.length<20){toast('Cole a chave da API da conta Spedy.');return;}
  if(host==='producao'&&!window.confirm(
      'A chave de PRODUÇÃO passa a valer para toda a rede. Cada loja precisará ser '+
      'ligada de novo à empresa dela na conta de produção. Continuar?'))return;
  var r=await fiscalChamar('conta_chave',{chave:cod,host:host});
  if($('fsContaChave'))$('fsContaChave').value='';
  if(!r.ok){painelErro('A chave da conta não foi aceita.',(r.d&&r.d.erro)||'O servidor recusou.');return;}
  await telaFiscalCfg(true);
  var t=(r.d.titular&&r.d.titular.nome)||'';
  toast('Conta de '+(r.d.host==='producao'?'produção':'teste')+' ligada'+(t?' — '+t:'')+'. '+
    (r.d.desligadas?r.d.desligadas+' loja(s) precisam ser ligadas de novo à empresa delas.':''));
}
/* a caixa de confirmação: nasce embaixo do Ambiente, some quando a
   produção liga, e diz exatamente qual CNPJ se espera */
function fsPedirCnpjProducao(u){
  var box=document.getElementById('fsProdConf');
  if(!box){toast('Recarregue a tela e tente de novo.');return;}
  box.innerHTML='<div class="fscPend" style="margin:10px 0">'+sv('help',16)+
    '<div><b>Confirme para ligar a produção</b>'+
    'A partir daí os cupons desta loja valem para a Receita. '+
    'Digite o CNPJ de '+E(sucNome(_fsSuc()))+' — '+E(fsCnpjFmt(u.cnpj))+'.'+
    '<div class="fsIe" style="margin-top:8px">'+
    '<input id="fsProdCnpj" inputmode="numeric" maxlength="18" aria-label="CNPJ desta unidade" '+
    'placeholder="só os números" onkeydown="if(event.key===\'Enter\')fsLigarProducao()">'+
    '<button class="btnP2 ok" onclick="fsLigarProducao()">Ligar a produção</button>'+
    '<button class="btnP2" onclick="fsCancelarProducao()">Cancelar</button>'+
    '</div></div></div>';
  var c=document.getElementById('fsProdCnpj');if(c)c.focus();
}
function fsCancelarProducao(){
  FS.pedindoCnpj=false;
  var box=document.getElementById('fsProdConf');if(box)box.innerHTML='';
  var sel=document.getElementById('fsAmb');if(sel)sel.value='homologacao';
  toast('A produção não foi ligada. Nada mudou.');
}
async function fsLigarProducao(){
  if(FS.salvando)return;
  var suc=_fsSuc(),u=fiscalUn(suc);
  var cnpj=fsDigitos((document.getElementById('fsProdCnpj')||{}).value);
  if(cnpj.length!==14){toast('Digite os 14 números do CNPJ desta loja.');return;}
  function v(id){var e=document.getElementById(id);return e?e.value:undefined;}
  var cfgN={modo:v('fsModo'),ambiente:'producao',serie:v('fsSerie'),pedeCpf:v('fsCpf'),
            imprime:v('fsImp'),
            contingencia:v('fsCont')==='1',regime:v('fsReg'),pisCst:v('fsPis'),
            cofinsCst:v('fsCofins'),confirmaCnpj:cnpj};
  FS.salvando=true;
  var r=await fiscalChamar('salvar',{sucursal:suc,config:cfgN});
  FS.salvando=false;
  if(!r.ok){painelErro('Não liguei a produção.',(r.d&&r.d.erro)||'O servidor recusou.');return;}
  FS.pedindoCnpj=false;FS.sujo=false;
  await telaFiscalCfg(true);
  toast(r.d.aviso?r.d.aviso:'Produção ligada — os cupons desta loja agora valem para a Receita.');
}
async function fsSalvarIe(){
  var v=String(($('fsIe')||{}).value||'').trim();
  if(!v){toast('Digite a inscrição estadual.');return;}
  var r=await fiscalChamar('empresa_ie',{sucursal:_fsSuc(),ie:v});
  if(!r.ok){painelErro('A inscrição estadual não foi aceita.',(r.d&&r.d.erro)||'O servidor recusou.');return;}
  await telaFiscalCfg(true);
  toast('Inscrição estadual guardada: '+(r.d.ie||v)+'.');
}
async function fsCsc(){
  var suc=_fsSuc();
  var amb=($('fsCscAmb')||{}).value||'homologacao';
  var id=fsDigitos(($('fsCscId')||{}).value);
  var cod=String((($('fsCscCod')||{}).value)||'').trim();
  if(!id||cod.length<16){toast('Informe o ID e o código CSC que a SEFAZ gerou.');return;}
  FS.cscAmb=amb;   /* a tela volta mostrando o ambiente que acabou de ser salvo */
  var r=await fiscalChamar('csc',{sucursal:suc,ambiente:amb,cscId:id,csc:cod});
  if($('fsCscCod'))$('fsCscCod').value='';
  if(!r.ok){painelErro('Não guardei o CSC.',(r.d&&r.d.erro)||'O servidor recusou.');return;}
  await telaFiscalCfg(true);
  toast(r.d.aviso||'CSC guardado. Ele não aparece de novo, por segurança.');
}
async function fsCertificado(){
  var suc=_fsSuc();
  var arq=$('fsCertArq')&&$('fsCertArq').files&&$('fsCertArq').files[0];
  var senha=($('fsCertSenha')||{}).value||'';
  if(!arq){toast('Escolha o arquivo .pfx do certificado.');return;}
  if(!senha){toast('Informe a senha do certificado.');return;}
  var b64=await new Promise(function(ok,erro){
    var fr=new FileReader();
    fr.onload=function(){ok(String(fr.result).split(',')[1]||'');};
    fr.onerror=function(){erro(fr.error);};
    fr.readAsDataURL(arq);
  }).catch(function(){return '';});
  if(!b64){toast('Não consegui ler o arquivo.');return;}
  var r=await fiscalChamar('certificado',{sucursal:suc,arquivo:b64,senha:senha});
  if($('fsCertSenha'))$('fsCertSenha').value='';
  if(!r.ok){painelErro('A Spedy não aceitou o certificado.',(r.d&&r.d.erro)||'Confira o arquivo e a senha.');return;}
  await telaFiscalCfg(true);
  toast('Certificado enviado.');
}
/* ==========================================================
   CUPONS GERADOS — as ações que dependiam do provedor
   ========================================================== */
async function reenviarCupom(id){
  var c=baseCuponsFiscais().find(function(x){return x.id===id});
  if(!c)return;
  if(!fiscalEmite(c.sucursalId||lojaAtualId())){toast('A emissão não está ligada nesta loja.');return;}
  toast('Emitindo o cupom…');
  c.faltaCadastro=false;c.querEmitir=true;
  await emitirCupom(id);
  if(typeof telaCuponsFiscais==='function'&&document.getElementById('content'))telaCuponsFiscais();
}
/* o perfil escolhido no cadastro do produto preenche os códigos na tela;
   só vale quando o produto é salvo, como todo o resto do formulário */
function pdAplicarPerfil(id){
  var pf=perfisFiscais().find(function(x){return x.id===id});
  if(!pf)return;
  if($('pdCfop'))$('pdCfop').value=pf.cfop;
  if($('pdCsosn'))$('pdCsosn').value=pf.csosn;
  if($('pdCst'))$('pdCst').value=pf.cst;
  if($('pdOrig')&&pf.origem)$('pdOrig').value=pf.origem;
  if(pf.st&&$('pdCest')&&!fsDigitos($('pdCest').value))
    toast('Este perfil é de substituição tributária: preencha também o CEST.');
}

/* ==========================================================
   O CUPOM FISCAL IMPRESSO — DANFE NFC-e NA BOBINA (28/09/2026)

   Rafael, com a ficha na mão: "quando o cupom é fiscal, o formato de
   impressão muda, né? Mas está saindo do mesmo jeito". A ficha continua
   (é a senha e o pedido da cozinha); o cupom fiscal é outro papel, no
   leiaute da SEFAZ: emitente, itens, totais, pagamento, consulta pela
   chave, consumidor, número/série/protocolo e o QR Code.

   Tudo vem do XML autorizado, pelo servidor — o QR Code leva o hash do
   CSC, que nunca chega ao navegador. Sai na mesma impressora e no mesmo
   papel da ficha (imprimirPapel).
   ========================================================== */
var PAG_SEFAZ={'01':'Dinheiro','02':'Cheque','03':'Cartão de Crédito','04':'Cartão de Débito',
  '05':'Crédito Loja','10':'Vale Alimentação','11':'Vale Refeição','12':'Vale Presente',
  '13':'Vale Combustível','15':'Boleto','16':'Depósito','17':'PIX','18':'Transferência',
  '19':'Fidelidade','90':'Sem pagamento','99':'Outros'};
function _fsNum(v,casas){return Number(v||0).toFixed(casas==null?2:casas).replace('.',',');}
function _fsLR(a,b,cols){
  a=String(a||'');b=String(b||'');
  var esp=cols-a.length-b.length;
  if(esp<1){a=a.slice(0,Math.max(0,cols-b.length-1));esp=1;}
  return a+new Array(esp+1).join(' ')+b;
}
function _fsQuebra(txt,cols){
  var out=[],linha='';
  String(txt||'').split(/\s+/).forEach(function(p){
    while(p.length>cols){ if(linha){out.push(linha);linha='';} out.push(p.slice(0,cols)); p=p.slice(cols); }
    if(!p)return;
    if(!linha)linha=p;
    else if((linha+' '+p).length<=cols)linha+=' '+p;
    else{out.push(linha);linha=p;}
  });
  if(linha)out.push(linha);
  return out;
}
function _fsDataHora(iso){
  var t=String(iso||'');
  if(t.length<16)return t;
  return t.slice(8,10)+'/'+t.slice(5,7)+'/'+t.slice(0,4)+' '+t.slice(11,19);
}
function _fsDocFmt(d){
  d=fsDigitos(d);
  if(d.length===11)return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/,'$1.$2.$3-$4');
  if(d.length===14)return fsCnpjFmt(d);
  return d;
}
/* as linhas do papel, no leiaute do DANFE NFC-e (NT 2016.002) */
/* ==========================================================
   O CÓDIGO DO PRODUTO NO PAPEL (Rafael, 29/09/2026)

   *"na frente do nome vem um monte de código. Precisa vir só o nome
   do produto normal."*

   O XML precisa de um código de produto (cProd) — é obrigatório e
   identifica a mercadoria no sistema de quem emite. Quando a loja não
   cadastrou um código, o Joia manda o identificador interno dele, que
   é estável e único. Certo no XML, ilegível no papel:
   "1 prod_msudv7ylgk00 Copo P".

   No papel só vale o que uma pessoa lê: o código aparece quando a loja
   digitou um (em Cardápio › Código do produto), e some quando é o
   identificador interno. A descrição, que é o que o cliente confere,
   não muda.
   ========================================================== */
function fsCodigoVisivel(codigo){
  var c=String(codigo||'').trim();
  if(!c)return '';
  /* os identificadores do proprio sistema: prod_..., item1, ped_... */
  if(/^(prod|item|ped)[_-]?[a-z0-9]*$/i.test(c))return '';
  return c+' ';
}
function montarDanfeNfce(d,cols){
  cols=cols||48;
  var L=[],e=d.emitente||{},t=d.totais||{};
  function c(txt,o){_fsQuebra(txt,cols).forEach(function(x){L.push(Object.assign({txt:x,al:'c'},o||{}));});}
  function l(txt,o){_fsQuebra(txt,cols).forEach(function(x){L.push(Object.assign({txt:x},o||{}));});}
  var linha={tipo:'linha'};
  if(d.homologacao)c('EMITIDA EM AMBIENTE DE HOMOLOGAÇÃO - SEM VALOR FISCAL',{n:true});
  c(e.nome,{n:true});
  c('CNPJ: '+fsCnpjFmt(e.cnpj)+'  IE: '+(e.ie||''));
  c([e.rua,e.numero,e.bairro].filter(Boolean).join(', ')+' - '+(e.cidade||'')+'/'+(e.uf||''),{p:true});
  L.push(linha);
  c('Documento Auxiliar da Nota Fiscal de Consumidor Eletrônica',{p:true});
  L.push(linha);
  L.push({txt:_fsLR('# Descrição','Total',cols),n:true});
  (d.itens||[]).forEach(function(it,i){
    l((i+1)+' '+fsCodigoVisivel(it.codigo)+it.nome);
    L.push({txt:_fsLR('   '+_fsNum(it.qtd,it.qtd%1?3:0)+' '+(it.un||'UN')+' x '+_fsNum(it.unit),_fsNum(it.total),cols)});
  });
  L.push(linha);
  L.push({txt:_fsLR('Qtd. total de itens',String((d.itens||[]).length),cols)});
  L.push({txt:_fsLR('Valor total R$',_fsNum(t.produtos),cols)});
  if(t.desconto>0)L.push({txt:_fsLR('Desconto R$',_fsNum(t.desconto),cols)});
  if(t.outros+t.frete>0)L.push({txt:_fsLR('Acréscimos R$',_fsNum(t.outros+t.frete),cols)});
  L.push({txt:_fsLR('Valor a pagar R$',_fsNum(t.total),cols),n:true});
  L.push({txt:_fsLR('FORMA DE PAGAMENTO','VALOR PAGO R$',cols)});
  (d.pagamentos||[]).forEach(function(p){
    L.push({txt:_fsLR(PAG_SEFAZ[p.tipo]||'Outros',_fsNum(p.valor),cols)});
  });
  if(d.troco>0)L.push({txt:_fsLR('Troco R$',_fsNum(d.troco),cols)});
  L.push(linha);
  c('Tributos totais incidentes (Lei Federal 12.741/2012): R$ '+_fsNum(t.tributos),{p:true});
  L.push(linha);
  c('Consulte pela Chave de Acesso em',{p:true});
  c(d.urlChave||'',{p:true});
  c(String(d.chave||'').replace(/(\d{4})(?=\d)/g,'$1 '),{p:true});
  L.push(linha);
  var cons=fsDigitos(d.consumidor&&d.consumidor.doc);
  c(cons?'CONSUMIDOR - '+(cons.length===14?'CNPJ':'CPF')+' '+_fsDocFmt(cons)+
    (d.consumidor.nome?' - '+d.consumidor.nome:''):'CONSUMIDOR NÃO IDENTIFICADO',{n:true});
  L.push(linha);
  c('NFC-e nº '+d.numero+'  Série '+d.serie+'  '+_fsDataHora(d.emissao),{n:true});
  if(d.contingencia)c('EMITIDA EM CONTINGÊNCIA - pendente de autorização',{n:true});
  else{
    c('Protocolo de autorização: '+(d.protocolo||''));
    c('Data de autorização: '+_fsDataHora(d.autorizadaEm));
  }
  if(d.qrCode)L.push({tipo:'qr',txt:d.qrCode});
  if(d.infCpl){L.push(linha);c(d.infCpl,{p:true});}
  if(d.homologacao)c('EMITIDA EM AMBIENTE DE HOMOLOGAÇÃO - SEM VALOR FISCAL',{n:true});
  return L;
}
var _fsImprimindo={};
async function imprimirDanfe(cupomId){
  var c=baseCuponsFiscais().find(function(x){return x.id===cupomId});
  if(!c)return false;
  if(c.status!=='autorizado'&&c.status!=='contingencia'){
    toast('Só cupom autorizado tem cupom fiscal para imprimir. Este está '+nomeStatusCupom(c.status).toLowerCase()+'.');
    return false;
  }
  if(!c.spedyId||!NUVEM.ligada||!NUVEM.token){toast('Sem conexão com o emissor agora — tente de novo em instantes.');return false;}
  if(_fsImprimindo[cupomId])return false;
  _fsImprimindo[cupomId]=true;
  try{
    var r=await fiscalChamar('danfe',{sucursal:c.sucursalId||lojaAtualId(),id:c.spedyId});
    if(!r.ok||!r.d||!r.d.danfe){toast((r.d&&r.d.erro)||'Não consegui buscar o cupom fiscal.');return false;}
    /* a mesma bobina da ficha, na letra normal */
    var m=(typeof modeloImp==='function'&&modeloImp('ficha'))||null;
    var mm=typeof papelDoModelo==='function'?papelDoModelo(m):80;
    var cols=typeof colunasDaLetra==='function'?colunasDaLetra(mm,'normal'):(mm<=58?32:48);
    /* ==========================================================
       DUAS VIAS NUM PAPEL SÓ: a fiscal primeiro, a da cozinha depois
       (Rafael, 29/09/2026: "a primeira via sai assim, fiscal; a segunda
       via é só via de cozinha, conforme já estava saindo")

       As duas saem no MESMO trabalho de impressão, nesta ordem — em
       dois trabalhos a impressora pode inverter, e quem está no balcão
       entrega a via errada ao cliente.
       ========================================================== */
    var linhas=montarDanfeNfce(r.d.danfe,cols);
    var ped=(DB.pedidos||[]).find(function(x){return x.id===c.pedidoId});
    if(ped&&typeof viaDoPedido==='function'){
      var via=viaDoPedido(ped,cols);
      if(via&&via.linhas&&via.linhas.length){ linhas=linhas.concat([{tipo:'corte'}],via.linhas); }
    }
    imprimirPapel(linhas,cols,1,mm);
    /* a via saiu junto: a rede de seguranca do PDV nao precisa disparar */
    if(typeof _fsViaJaSaiu==='function')_fsViaJaSaiu(c.pedidoId);
    c.impressoEm=new Date().toISOString();
    salvar();
    return true;
  }finally{ delete _fsImprimindo[cupomId]; }
}
/* o cupom acabou de sair: imprime conforme a loja escolheu. Só no aparelho
   que fez a venda, e só logo depois dela — um cupom que ficou para trás e
   sai horas depois não imprime sozinho no meio do movimento */
async function fsDepoisDeEmitir(c){
  if(!c||(c.status!=='autorizado'&&c.status!=='contingencia'))return;
  if(!c.querEmitir||c.impressoEm)return;
  var u=fiscalUn(c.sucursalId||lojaAtualId());
  var recente=(Date.now()-new Date(String(c.data||'')+'T'+(c.hora||'00:00')+':00').getTime())<10*60*1000;
  if(!recente)return;
  if(u.imprime==='sempre'){imprimirDanfe(c.id);return;}
  /* "perguntar" não perguntava nada: o cupom fiscal nunca saía e ninguém
     entendia por quê (29/09/2026). Agora ele pergunta mesmo — e só uma
     vez por cupom, para não voltar no meio da próxima venda. */
  if(u.imprime==='perguntar'){
    if(_fsPerguntado[c.id])return;
    _fsPerguntado[c.id]=true;
    /* quem chama não espera esta função: uma falha aqui não pode virar
       erro solto no meio do caixa */
    try{
      var ok=await confirmar({titulo:'Imprimir o cupom fiscal?',
        texto:'A SEFAZ autorizou o cupom da venda '+(c.numero||c.id)+'. Ele sai na bobina, com QR Code.',
        ok:'Imprimir',cancelar:'Agora não',tipo:'pergunta'});
      if(ok)imprimirDanfe(c.id);
    }catch(e){_quieto(e,'fsDepoisDeEmitir')}
  }
}
var _fsPerguntado={};

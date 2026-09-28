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

var FS={carregando:false,erro:'',empresas:null,sujo:false,salvando:false};
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
async function fiscalCarregar(suc){
  suc=suc||lojaAtualId();
  var r=await fiscalChamar('estado',{sucursal:suc});
  if(!r.ok){FS.erro=(r.d&&r.d.erro)||'O fiscal não respondeu agora.';return null;}
  /* a resposta tem de ser DA unidade pedida — nunca guardar a de outra */
  if(r.d.unidade&&r.d.unidade.ref&&r.d.unidade.ref!==suc){FS.erro='Resposta de outra unidade — recarregue.';return null;}
  FS.erro='';
  var u=Object.assign({},r.d.unidade||{},{
    spedy:r.d.spedy||null,base:r.d.base||null,conta:r.d.conta||null,
    podeGerir:!!r.d.podeGerir,rede:r.d.rede||null,lidoEm:new Date().toISOString()});
  baseFiscalUn()[suc]=u;
  salvar();
  return u;
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
function formaSpedy(g){
  var f=(typeof formaPag==='function'?formaPag(g&&g.forma):null)||{};
  var t=String(f.tipo||'').toLowerCase();
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
      description:String(it.nome||p.nome||'Item').slice(0,120),
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
  _fsGuardar();fsChip(c);
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
      if(c.status!=='enviando'){_fsGuardar();fsChip(c);return c;}
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
    return c.status==='enviando'||u.modo==='sempre'||ped.fiscal;
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
    (c.pdf?'<button class="btnMini" onclick="window.open(\''+E(c.pdf)+'\',\'_blank\')">Imprimir</button>':'')+
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
     (matriz?'<div id="fsEmpresas"><button class="btnP2" onclick="fsListarEmpresas()">Ver empresas da conta</button></div>':''))+
  '</div></div>';

  var csc=gerir&&u.vinculada?'<div class="cfgCol"><div class="colH">CSC da SEFAZ</div><div class="fsCorpo">'+
   '<div class="hint" style="margin-bottom:9px">O código que valida o QR Code do cupom. É gerado no portal da '+
   'SEFAZ-SP, um par para homologação e outro para produção. Depois de salvo, não aparece de novo.</div>'+
   '<div class="row2">'+
    '<div class="fld2"><label>Ambiente</label><select id="fsCscAmb" onchange="fsCscMarcar()">'+
     _fsOpc(u.ambiente,[['homologacao','Homologação'],['producao','Produção']])+'</select></div>'+
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
   (perfis?'<div class="cfgDuas">'+perfis+'</div>':'')+
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
            contingencia:v('fsCont')==='1',regime:v('fsReg'),pisCst:v('fsPis'),cofinsCst:v('fsCofins')};
  if(cfgN.ambiente==='producao'&&u.ambiente!=='producao'){
    var cnpj=window.prompt('Para ligar a PRODUÇÃO, digite o CNPJ desta unidade ('+fsCnpjFmt(u.cnpj)+'). '+
      'A partir daí os cupons valem para a Receita.');
    if(cnpj===null)return;
    cfgN.confirmaCnpj=fsDigitos(cnpj);
  }
  FS.salvando=true;
  var e=document.getElementById('fsEstadoSalvo');if(e){e.textContent='Salvando…';e.className='';}
  var r=await fiscalChamar('salvar',{sucursal:suc,config:cfgN});
  FS.salvando=false;
  if(!r.ok){painelErro('Não salvei a configuração fiscal.',(r.d&&r.d.erro)||'O servidor recusou.');fsMudou();return;}
  FS.sujo=false;
  await telaFiscalCfg(true);
  toast(r.d.aviso?r.d.aviso:'Tudo salvo.');
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
  if(!fsDigitos(s.cnpj)){
    var c=window.prompt('A unidade '+(s.nome||'')+' ainda não tem CNPJ no Joia. Para confirmar que esta empresa é dela, '+
      'digite o CNPJ da empresa ('+fsCnpjFmt(cnpjEmp)+'):');
    if(c===null)return;
    dados.confirmaCnpj=fsDigitos(c);
  }else if(fsDigitos(s.cnpj)!==fsDigitos(cnpjEmp)){
    painelErro('Esta empresa é de outro CNPJ.','A unidade '+(s.nome||'')+' é do CNPJ '+fsCnpjFmt(s.cnpj)+
      ' e a empresa escolhida é do CNPJ '+fsCnpjFmt(cnpjEmp)+'. Uma unidade só emite com o próprio CNPJ.');
    return;
  }
  var r=await fiscalChamar('vincular',dados);
  if(!r.ok){painelErro('Não liguei a unidade.',(r.d&&r.d.erro)||'O servidor recusou.');return;}
  await telaFiscalCfg(true);
  toast('Unidade ligada à empresa de CNPJ '+fsCnpjFmt(r.d.cnpj)+'.');
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
  toast('Reenviando o cupom…');
  c.faltaCadastro=false;
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

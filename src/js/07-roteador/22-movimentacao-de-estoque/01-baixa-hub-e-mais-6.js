/* ==========================================================
   BLOCO 22 — MOVIMENTAÇÃO DE ESTOQUE
   ========================================================== */
var TIPOS_MOV=[
 {id:'entrada', n:'Entrada',   d:'soma no estoque'},
 {id:'saida',   n:'Saída',     d:'subtrai do estoque'},
 {id:'producao',n:'Produzir',  d:'baixa os ingredientes da ficha E GERA o produto acabado'}
];
function baseMov(){
  /* Marca valida SO PARA ESTA MONTAGEM DE TELA: some no proximo ciclo do
     navegador. Assim itensEstoque nao repete a preparacao 3x seguidas, mas
     qualquer dado novo (download, edicao, troca de unidade) volta a ser
     preparado normalmente na proxima abertura.
     Marca permanente seria mais rapida e erraria feio: insumo que chegasse
     da nuvem ficaria sem os campos padrao. */
  DB._baseMovOk=true;
  setTimeout(function(){DB._baseMovOk=false},0);
  baseFicha();
  if(typeof baseCat==='function')baseCat();
  arrumarCodigos();
  arrumarEspelhoCardapio();
  DB.motivosMov=DB.motivosMov||[
    {id:'mv_ent',  nome:'Entrada manual',        tipo:'entrada', sistema:false,ativo:true,lojas:[]},
    {id:'mv_sai',  nome:'Saída manual',          tipo:'saida',   sistema:false,ativo:true,lojas:[]},
    {id:'mv_prod', nome:'Produzir',              tipo:'producao',sistema:false,ativo:true,lojas:[]},
    {id:'mv_venda',nome:'Venda PDV',              tipo:'saida',   sistema:true, ativo:true,lojas:[]},
    {id:'mv_perda',nome:'Perda / quebra',        tipo:'saida',   sistema:false,ativo:true,lojas:[]},
    {id:'mv_cont', nome:'Contagem de estoque',   tipo:'entrada', sistema:true, ativo:true,lojas:[]}
  ];
  DB.movEst=DB.movEst||[];
  DB.contagens=DB.contagens||[];
  DB.motivosMov=DB.motivosMov.filter(function(m){return m.id!=='mv_inv'});
  (function(){var v=DB.motivosMov.find(function(m){return m.id==='mv_venda'});
    if(v&&v.nome==='Venda frente de caixa')v.nome='Venda PDV';})();
  /* motivos que o sistema usa sozinho — precisam existir sempre,
     mesmo quando a loja já tem motivos próprios cadastrados */
  [['mv_venda','Venda PDV','saida'],
   /* a base sai do estoque da matriz quando o pedido e entregue a unidade.
      Motivo proprio para o relatorio conseguir separar isso de uma baixa
      manual qualquer. */
   ['mv_pedbase','Venda de base para unidade','saida'],
   ['mv_nota','Entrada por nota fiscal','entrada'],
   ['mv_cont','Contagem de estoque','entrada'],
   ['mv_perdaprod','Perda de produção','saida'],
   ['mv_ganhoprod','Ganho de produção','entrada']].forEach(function(x){
    if(!DB.motivosMov.some(function(m){return m.id===x[0]}))
      DB.motivosMov.push({id:x[0],nome:x[1],tipo:x[2],sistema:true,ativo:true,lojas:[]});
  });
  lojasCad();
  DB.motivosMov.forEach(function(m){if(!m.lojas)m.lojas=[]});
  /* Quem JA tem o item de gelato continua com ele marcado — a Jolô depende
     dele como destino de produção e nada muda para ela. O que saiu foi a
     criação automática: 'Gelato Venda' nascia sozinho em qualquer empresa,
     inclusive nas que não vendem gelato. Quem precisar de um destino de
     produção cadastra o seu. */
  var jaTem=(DB.insumos||[]).find(function(i){
    return i.gelatoVenda||String(i.nome||'').toLowerCase()==='gelato venda';});
  if(jaTem&&!jaTem.gelatoVenda)jaTem.gelatoVenda=true;
  /* grupo Produzido aponta para Gelato Venda por padrão */
  var gvId=((DB.insumos||[]).find(function(i){return i.gelatoVenda;})||{}).id;
  gruposFicha().forEach(function(c){
    if(!c.destinoId&&/produz|gelato/i.test(c.nome)&&gvId)c.destinoId=gvId;
  });
  repararDestinos();
  recalcCustoProducao();
}
function motivoVisivel(m){
  if(!m||m.ativo===false)return false;
  if(!m.lojas||!m.lojas.length)return true;   /* vazio = todas as lojas */
  return m.lojas.indexOf(lojaAtual())>=0;
}
/* custo médio dos itens que recebem produção = total produzido / quantidade produzida */
function recalcCustoProducao(){
  var acc={};
  (DB.movEst||[]).forEach(function(m){
    (m.linhas||[]).forEach(function(l){
      if(l.direcao!=='entrada')return;
      if(String(l.origem||'').indexOf('producao')<0)return;
      var ins=itemEstoque(l.insumoId);
      if(!ins)return;
      var q=convUnid(l.qtd,l.unidade,ins.unidade);
      if(q===null)q=l.qtd;
      var cUn=convUnid(1,ins.unidade,l.unidade);
      cUn=(cUn===null)?Number(l.custo)||0:(Number(l.custo)||0)*cUn;
      acc[ins.id]=acc[ins.id]||{q:0,v:0};
      acc[ins.id].q+=q;acc[ins.id].v+=q*cUn;
    });
  });
  Object.keys(acc).forEach(function(id){
    var ins=itemEstoque(id);
    if(!ins||!acc[id].q)return;
    var medio=+(acc[id].v/acc[id].q).toFixed(6);
    if(ins.itens!==undefined&&ins.rendimento!==undefined){
      ins.custoMedio=medio;                 /* destino é ficha técnica */
    }else{
      ins.custo=medio;ins.custoUltima=medio;
      ins.modoCusto=normModo(ins.modoCusto);
    }
  });
}
function motivo(id){return (DB.motivosMov||[]).find(function(m){return m.id===id})||null}
function nomeMotivo(id){var m=motivo(id);return m?m.nome:'—'}
function tipoMotivo(id){var m=motivo(id);return m?m.tipo:'saida'}
/* um item da composição pode ser um insumo OU outra ficha técnica */
function itemComp(id){
  var i=insumo(id);
  if(i)return {id:i.id,nome:i.nome,codigo:i.codigo,unidade:i.unidade,tipo:'insumo',
    custo:custoAtual(i)};
  var f=(DB.fichas||[]).find(function(x){return x.id===id});
  if(f)return {id:f.id,nome:f.nome,codigo:f.codigo,unidade:f.rendUnidade||f.unidade,
    tipo:'ficha',custo:custoPorUnidade(f)};
  return null;
}
/* custo do insumo já convertido para a unidade usada na linha */
function custoNaUnidade(ins,unidade){
  if(!ins)return 0;
  var c=custoAtual(ins);
  var q=convUnid(1,unidade,ins.unidade);
  if(q===null)return c;
  return +(c*q).toFixed(6);
}
/* item de estoque = insumo OU ficha técnica marcada como estocável */
function itemEstoque(id){
  var i=insumo(id);
  if(i)return i;
  var f=(DB.fichas||[]).find(function(x){return x.id===id});
  if(f&&f.estocavel!==false){
    if(f.estoqueAtual===undefined)f.estoqueAtual=0;
    if(!f.unidade)f.unidade='un';
    return f;
  }
  return null;
}
function custoDoItem(it){
  if(!it)return 0;
  /* Regra do sistema: sem saldo em estoque não há custo médio.
     Custo médio é o preço do que está lá dentro; sem nada dentro, é zero.
     O custo volta a existir na próxima entrada, que é quem forma o preço. */
  if(Number(it.estoqueAtual)<=0&&(it.controlaEstoque!==false))return 0;
  var eFicha=(it.itens!==undefined&&it.rendimento!==undefined);
  if(!eFicha)return custoAtual(it);
  /* ficha que recebe produção usa o custo médio do que entrou;
     ficha comum usa o custo da própria receita */
  if(Number(it.custoMedio)>0)return Number(it.custoMedio);
  return custoPorUnidade(it);
}
/* Se um vínculo aponta para um item que não existe mais, religa pelo nome.
   Sem isso, a produção baixa os ingredientes e não gera nada — em silêncio. */
function repararDestinos(){
  var porNome={};
  (DB.insumos||[]).forEach(function(i){porNome[String(i.nome||'').toLowerCase()]=i.id});
  (DB.fichas||[]).forEach(function(f){porNome[String(f.nome||'').toLowerCase()]=f.id});
  var consertados=0;
  function conserta(o){
    if(!o||!o.destinoId||o.destinoId==='__nenhum')return;
    if(itemEstoque(o.destinoId))return;                 /* está válido */
    var alvo=porNome[String(o.destinoNome||'').toLowerCase()];
    if(!alvo&&/gelato/i.test(o.nome||''))alvo=porNome['gelato venda'];
    if(alvo){o.destinoId=alvo;consertados++;}
  }
  (DB.fichas||[]).forEach(conserta);
  gruposFicha().forEach(function(c){
    if(!c.destinoId)return;
    if(itemEstoque(c.destinoId))return;
    var alvo=porNome['gelato venda'];
    if(alvo){c.destinoId=alvo;consertados++;}
  });
  if(consertados){
    salvar();
    if(typeof logNuvem==='function')logNuvem(consertados+' vínculo(s) de produção religado(s)');
  }
  return consertados;
}
function destinoDaFicha(f){
  if(!f)return null;
  if(f.destinoId==='__nenhum')return null;             /* marcado para não gerar */
  if(f.destinoId){
    var d=itemEstoque(f.destinoId);
    if(d)return d;
    /* vínculo apontando para item que não existe: tenta pelo nome guardado */
    if(f.destinoNome){
      var porNome=(DB.insumos||[]).find(function(i){
          return String(i.nome||'').toLowerCase()===String(f.destinoNome).toLowerCase();})
        ||(DB.fichas||[]).find(function(x){
          return String(x.nome||'').toLowerCase()===String(f.destinoNome).toLowerCase();});
      if(porNome){f.destinoId=porNome.id;return itemEstoque(porNome.id);}
    }
  }
  var c=catFicha(f.categoriaId);                       /* senão, o padrão do grupo */
  if(c&&c.destinoId)return itemEstoque(c.destinoId);
  return null;
}
function fatorDestino(f){return Number(f&&f.destinoFator)||1}
function modoDestino(f){
  if(!f)return 'igual';
  if(f.destinoModo)return f.destinoModo;
  return (Number(f.destinoFator)||1)===1?'igual':'receita';
}
/* quanto entra no destino ao produzir "qtd" desta ficha */
function qtdNoDestino(f,qtd){
  qtd=Number(qtd)||0;
  if(modoDestino(f)==='receita'){
    var rend=Number(f.rendimento)||1;
    return +((qtd/rend)*fatorDestino(f)).toFixed(4);   /* a receita inteira gera N */
  }
  return +(qtd*fatorDestino(f)).toFixed(4);            /* proporcional por unidade */
}

/* ---------- CONFIGURAÇÃO DOS MOTIVOS ---------- */
/* removida: era a versao antiga do motivo de estoque, substituida pela
   de baixo e sem nenhuma chamada apontando para ela */

/* ----------------------------------------------------------
   CONFERENCIA DE SALDO
   Nenhuma baixa pode deixar o estoque negativo: nem producao
   (que consome ingredientes), nem baixa manual.
   ---------------------------------------------------------- */
function faltaEstoque(linhas){
  var prec={};
  (linhas||[]).forEach(function(l){
    if(l.direcao!=='saida')return;
    var ins=itemEstoque(l.insumoId);if(!ins)return;
    var eFicha=(ins.itens!==undefined&&ins.rendimento!==undefined);
    if(!eFicha&&!ins.controlaEstoque)return;      /* item que nao controla estoque nao trava */
    var q=convUnid(l.qtd,l.unidade,ins.unidade);
    if(q===null)q=Number(l.qtd)||0;
    prec[ins.id]=prec[ins.id]||{ins:ins,q:0};
    prec[ins.id].q+=q;
  });
  /* o que o proprio lancamento gera ja conta a favor */
  (linhas||[]).forEach(function(l){
    if(l.direcao!=='entrada')return;
    var ins=itemEstoque(l.insumoId);if(!ins||!prec[ins.id])return;
    var q=convUnid(l.qtd,l.unidade,ins.unidade);
    if(q===null)q=Number(l.qtd)||0;
    prec[ins.id].q-=q;
  });
  var falta=[];
  Object.keys(prec).forEach(function(k){
    var n=prec[k],tem=Number(n.ins.estoqueAtual)||0;
    if(n.q>0.0001&&tem<n.q-0.0001)
      falta.push({nome:n.ins.nome,precisa:n.q,tem:tem<0?0:tem,
        falta:+(n.q-(tem>0?tem:0)).toFixed(4),un:un(n.ins.unidade).ab});
  });
  return falta;
}
function avisoFalta(falta,contexto){
  return 'ESTOQUE INSUFICIENTE — '+contexto+' não pode ser lançada.\n\n'+
    falta.map(function(f){
      return '• '+f.nome+'\n   precisa de '+fmtQt(f.precisa)+' '+f.un+
             '  ·  tem '+fmtQt(f.tem)+' '+f.un+
             '  ·  faltam '+fmtQt(f.falta)+' '+f.un;
    }).join('\n')+
    '\n\nAbasteça o estoque (nota de entrada ou ajuste) e lance de novo.';
}

/* ---------- APLICAR NO ESTOQUE ---------- */
function ajustaEstoque(ins,qtd,unidade,sinal,suc){
  if(!ins)return 0;
  /* insumo respeita a chave; ficha estocável sempre movimenta */
  var eFicha=(ins.itens!==undefined&&ins.rendimento!==undefined);
  if(!eFicha&&!ins.controlaEstoque)return 0;
  var q=convUnid(qtd,unidade,ins.unidade);
  if(q===null)q=qtd;
  /* o saldo verdadeiro e o da unidade; o campo do item e so o espelho */
  suc=suc||lojaAtualId();
  var novo=+((saldoUn(ins.id,suc)+sinal*q).toFixed(4));
  setSaldoUn(ins.id,novo,suc);
  if(eFicha)regEstoque(ins.id,suc,true).tipo='ficha';
  if(suc===lojaAtualId())ins.estoqueAtual=novo;
  /* sem estoque nao ha custo medio: ele renasce na proxima entrada.
     Vale para a unidade — zerar em Jales nao pode zerar o custo de Sorocaba. */
  if(novo<=0.00001){
    setCustoUn(ins.id,0,suc);
    if(suc===lojaAtualId())ins.custo=0;
  }
  return q;
}
/* monta as linhas de um lançamento e aplica no estoque */
function aplicarMovimento(mov,desfazer){
  var mult=desfazer?-1:1;
  /* Porta unica: todo movimento passa por aqui. Carimbar a unidade neste
     ponto pega os nove lugares que criam movimento, em vez de depender de
     cada um lembrar. Movimento antigo, sem unidade, fica com a ativa. */
  var suc=mov.sucursalId||lojaAtualId();
  if(!mov.sucursalId&&!desfazer)mov.sucursalId=suc;
  (mov.linhas||[]).forEach(function(l){
    var ins=itemEstoque(l.insumoId);
    if(!ins)return;
    var antes=saldoUn(ins.id,suc);
    ajustaEstoque(ins,l.qtd,l.unidade,(l.direcao==='entrada'?1:-1)*mult,suc);
    /* entrada atualiza o custo médio ponderado do item */
    if(!desfazer&&l.direcao==='entrada'&&Number(l.custo)>0&&
       !(ins.itens!==undefined&&ins.rendimento!==undefined)){
      var q=convUnid(l.qtd,l.unidade,ins.unidade);
      if(q===null)q=l.qtd;
      var custoUn=convUnid(1,ins.unidade,l.unidade);
      custoUn=(custoUn===null)?Number(l.custo):Number(l.custo)*custoUn;
      /* (estoque anterior x custo medio anterior + qtd comprada x custo da compra)
         dividido por (estoque anterior + qtd comprada) */
      /* O custo medio e da UNIDADE: cada loja compra pelo seu preco.
         Jales pagando mais caro no acucar nao encarece a ficha de Sorocaba. */
      var medioAnt=custoMedioUn(ins.id,suc)||custoMedioPond(ins);
      var base=(antes>0&&medioAnt>0)?antes:0;   /* sem custo anterior, a compra manda */
      var novo=(base+q)>0?((base*medioAnt+q*custoUn)/(base+q)):custoUn;
      setCustoUn(ins.id,novo,suc);
      if(suc===lojaAtualId()){
        ins.custo=+novo.toFixed(6);
        ins.custoUltima=+custoUn.toFixed(6);
      }
      ins.modoCusto=normModo(ins.modoCusto);
    }
  });
  repararDestinos();
  recalcCustoProducao();
}
/* gera as linhas a partir dos itens lançados */
function montarLinhas(itens,tipo){
  var linhas=[];
  itens.forEach(function(it){
    var _obs=String(it.obs||'').trim();
    /* so a producao explode a ficha em ingredientes; baixa manual sai do proprio item */
    if(it.tipo==='ficha'&&tipo==='producao'){
      var f=(DB.fichas||[]).find(function(x){return x.id===it.refId});
      if(!f)return;
      var rend=Number(f.rendimento)||1;
      var fator=(Number(it.qtd)||0)/rend;
      /* consumo dos ingredientes da receita */
      (f.itens||[]).forEach(function(ci){
        var ins=insumo(ci.insumoId);
        if(!ins)return;
        var q=(Number(ci.qtd)||0)*fator;
        var perda=Number(ci.perda)||0;
        if(perda>0&&perda<100)q=q/(1-perda/100);
        linhas.push({insumoId:ins.id,nome:ins.nome,unidade:ci.unidade,qtd:+q.toFixed(4),
          custo:custoNaUnidade(ins,ci.unidade),direcao:'saida',origem:'ficha:'+f.id,
          fichaId:f.id,fichaNome:f.nome,obs:_obs});
      });
      /* entrada do produto acabado no destino */
      if(tipo==='producao'){
        var dest=destinoDaFicha(f);
        if(dest){
          var fat=fatorDestino(f);
          var qDest=qtdNoDestino(f,it.qtd);
          /* o custo total produzido se divide pela quantidade que entra no destino */
          var custoDest=qDest?+(((Number(it.qtd)||0)*custoPorUnidade(f))/qDest).toFixed(6):0;
          linhas.push({insumoId:dest.id,nome:dest.nome,
            unidade:(modoDestino(f)==='igual'&&fat===1?it.unidade:dest.unidade),qtd:qDest,
            custo:custoDest,direcao:'entrada',origem:'producao:'+f.id,fichaNome:f.nome,obs:_obs});
        }
      }
    }else{
      /* baixa direta: o item sai do proprio estoque.
         O custo NUNCA vem digitado — e sempre o custo medio ponderado do item. */
      var i2=itemEstoque(it.refId);
      if(!i2)return;
      var _eF=(i2.itens!==undefined&&i2.rendimento!==undefined);
      var _u=it.unidade||(_eF?(i2.rendUnidade||i2.unidade):i2.unidade);
      linhas.push({insumoId:i2.id,nome:i2.nome,unidade:_u,qtd:Number(it.qtd)||0,
        custo:(_eF?custoDoItem(i2):custoNaUnidade(i2,_u)),
        direcao:(tipo==='entrada'?'entrada':'saida'),obs:_obs});
    }
  });
  return linhas;
}

/* ---------- RELATÓRIO DE MOVIMENTAÇÃO ---------- */
var MV={de:'',ate:'',insumoId:'',grupo:'',motivoId:'',busca:''};
var _mvBuscaT=null;
/* filtro de texto do relatorio: nome, codigo, identificacao ou observacao da linha */
function casaBuscaMov(l,m,ins){
  if(!MV.busca)return true;
  var q=MV.busca.toLowerCase();
  return (l.nome||'').toLowerCase().indexOf(q)>=0
      || (m.identificacao||'').toLowerCase().indexOf(q)>=0
      || (l.obs||m.obs||'').toLowerCase().indexOf(q)>=0
      || String((ins||{}).codigo||'').toLowerCase().indexOf(q)>=0;
}
/* ==========================================================
   BAIXA MANUAL — o caderno da operação
   A pessoa registra a perda na hora que acontece. Nada sai do estoque
   ainda: fica na lista do dia até alguém mandar para a movimentação.
   Por que o nome é digitado e não vem do login: no PDV o login é do caixa,
   compartilhado. Se uma perda precisar ser cobrada de alguém, o nome tem de
   ser da pessoa. O login fica gravado à parte, para auditoria.
   ========================================================== */
/* ==========================================================
   CENTRAL DE BASES E VALORES — só a matriz
   O catálogo do que a franqueadora produz e vende para as unidades. A filial
   enxerga para pedir, mas não altera nome nem preço.
   O campo Ficha técnica fica desde já: enquanto estiver vazio, o pedido e o
   financeiro funcionam normalmente e só a baixa de estoque espera. Assim dá
   para usar o sistema antes de cadastrar as 29 fichas.
   ========================================================== */
/* ==========================================================
   PEDIDO DE BASE — a unidade pede à matriz
   A unidade NÃO é escolhida: vem do login. Se quem entrou é de Jales, o
   pedido é de Jales. Deixar escolher seria abrir a porta para a unidade
   errada receber a mercadoria e a conta.
   O catálogo e os preços vêm da matriz; aqui só se informa quantidade.
   ========================================================== */
/* ==========================================================
   ABAS EM VEZ DE LINHAS DE MENU
   Cada tela nova virava uma linha no menu: eram quatro e ia para cinco. Menu
   comprido é menu que ninguém lê. Agora são DUAS entradas, cada uma com as
   suas abas por dentro — e a aba só aparece para quem tem acesso a ela.
   ========================================================== */
var HUB = { baixa: 'registrar', pedido: '' };

function abasHub(lista, atual, aoTrocar){
  return '<div class="hubAbas">' + lista.map(function (a) {
    return '<button class="hubAba' + (atual === a.id ? ' on' : '') + '" ' +
      'onclick="' + aoTrocar + '(\'' + a.id + '\')">' +
      sv(a.ic, 14) + '<span>' + E(a.n) + '</span>' +
      (a.badge ? '<i class="hubB">' + a.badge + '</i>' : '') + '</button>';
  }).join('') + '</div>';
}

/* ---------------- Baixa Manual ---------------- */
function trocarAbaBaixa(a){ HUB.baixa = a; telaBaixaHub(); }
function telaBaixaHub(){
  var abas = [
    { id: 'registrar', n: 'Registrar baixa', ic: 'dn4' },
    { id: 'relatorio', n: 'Relatório', ic: 'chart' }
  ];
  var topo = abasHub(abas, HUB.baixa, 'trocarAbaBaixa');
  if (HUB.baixa === 'relatorio'){ telaRelatorioBaixas(); } else { telaBaixaManual(); }
  var alvo = document.querySelector('#content .etScroll');
  if (alvo) alvo.insertAdjacentHTML('afterbegin', topo);
}

/* ==========================================================
   DUAS ENTRADAS DE MENU, E NAO UMA COM ABAS
   Eu tinha juntado tudo numa tela so. Errado, e por um motivo que nao e de
   gosto: a Liberacao por Unidade trabalha por ITEM DE MENU. Se "fazer
   pedido" e "pedidos recebidos" moram no mesmo item, liberar um libera o
   outro — e o franqueado passaria a ver os pedidos de todas as unidades,
   os precos e o cadastro de bases.
   Entao:
     Fazer Pedido de Base  -> item proprio, liberado ao franqueado
     Bases e Valores       -> item proprio, so da matriz, com as abas
                              "Pedidos recebidos" e "Cadastro de bases"
   A separacao de acesso passa a ser possivel na tela de liberacao, sem
   depender de o codigo lembrar de esconder.
   ========================================================== */
function trocarAbaBases(a){ HUB.pedido = a; telaBasesHub(); }
function telaBasesHub(){
  if (!ehMatriz() && !ehPlataforma()) return telaRestrita('Bases e Valores');
  basePedidos();
  var aguardando = basePedidos().filter(function (p) {
    return p.situacao === 'enviado';
  }).length;
  var abas = [
    { id: 'recebidos', n: 'Pedidos recebidos', ic: 'list', badge: aguardando || 0 },
    { id: 'cadastro', n: 'Cadastro de bases', ic: 'tag' }
  ];
  if (HUB.pedido !== 'cadastro') HUB.pedido = 'recebidos';
  var topo = abasHub(abas, HUB.pedido, 'trocarAbaBases');
  if (HUB.pedido === 'cadastro'){ telaBasesValores(); }
  else { telaPedidosRecebidos(); }
  var alvo = document.querySelector('#content .etScroll');
  if (alvo) alvo.insertAdjacentHTML('afterbegin', topo);
}

/* ==========================================================
   PEDIDOS RECEBIDOS — a matriz acompanha e move o status
   O caminho é sempre o mesmo: Aguardando, Confirmado, Enviado, Entregue,
   Pago. Só se anda para frente, e cada passo grava a hora. Rejeitar é a
   saída lateral, e exige motivo — pedido recusado sem explicação vira
   telefonema.
   ========================================================== */
/* ==========================================================
   ETAPA 4 — AS AUTOMAÇÕES
   Três ligações, cada uma reaproveitando o caminho que o sistema já usa:

   MATRIZ, ao confirmar   -> ordem de produção (baixa as fichas técnicas)
                          -> conta a RECEBER daquela unidade
   FILIAL, ao receber     -> entrada no estoque dela
                          -> conta a PAGAR para a matriz

   Nada aqui recalcula estoque nem financeiro por conta própria: chama
   aplicarMovimento() e grava em lancamentos_financeiros, iguais aos das
   telas normais. Conta paralela é como saldos começam a divergir.

   Cada automação grava a referência do que gerou (movProducaoRef,
   finReceberRef...). É isso que impede rodar duas vezes — e é isso que
   permite achar depois qual movimentação nasceu de qual pedido.
   ========================================================== */

/* ---------- 1. MATRIZ: produzir as bases ---------- */

/* ---------- 2. MATRIZ: gerar a conta a receber ---------- */
/* ==========================================================
   O VENCIMENTO NAO SE PERGUNTA MAIS

   Era um prompt a cada pedido, e a resposta era sempre a mesma conta: o
   pedido entra ate segunda ao meio-dia e a retirada e na quinta. Tres dias
   depois da data do pedido e o dia em que a unidade busca a mercadoria — e
   e quando ela paga. Entao o sistema faz a conta.
   ========================================================== */
function vencimentoPedidoBase(p){
  var d = new Date(String((p && p.data) || hojeISO()) + 'T12:00:00');
  if (isNaN(d.getTime())) d = new Date();
  d.setDate(d.getDate() + 3);
  return d.toISOString().slice(0, 10);
}

/* ---------- 2. MATRIZ: a conta a receber da unidade ----------
   Sem tela: quem chama e o mesmo clique que marca o pedido como entregue.
   Devolve o lancamento criado, ou null se ja existia — a referencia gravada
   no pedido (finReceberRef) e o que impede a segunda via. */
function gerarReceberPedido(p){
  if (!p || p.finReceberRef) return null;
  /* ATENCAO: DB.lancamentos e a colecao LEGADA — ela nao sobe para a nuvem e
     ainda e migrada para DB.lancFin marcada como PAGA, e com o tipo virado
     para despesa. Escrever ali fazia a cobranca da matriz nascer como
     despesa quitada, presa no aparelho de quem clicou. O financeiro de
     verdade e DB.lancFin / lancamentos_financeiros. */
  baseFin();
  DB.lancFin = DB.lancFin || [];
  var l = {
    id: uid('lf'), tipo: 'receita',
    descricao: 'Pedido de base #' + String(p.numero || 0).padStart(4, '0') +
               ' — ' + (p.sucursalNome || ''),
    contaId: '', metodoId: '', categoriaId: '', categoriaTxt: 'Pedido de base',
    fornecedor: '', documento: 'PB' + String(p.numero || 0).padStart(4, '0'),
    valor: Number(p.total) || 0,
    emissao: hojeISO(), vencimento: vencimentoPedidoBase(p), pagamento: '',
    pago: false, conciliado: false,
    origem: 'pedido_base', origemRef: p.id
  };
  DB.lancFin.push(l);
  p.finReceberRef = l.id;
  return l;
}

/* rede de seguranca: o botao so aparece se, por algum motivo, a cobranca nao
   nasceu junto com a entrega */
async function faturarPedidoBase(id){
  var p = basePedidos().find(function (x) { return x.id === id; });
  if (!p) return;
  if (await travaPedidoSemItens(p)) return;
  if (p.finReceberRef) { toast('Este pedido já foi faturado.'); return; }
  var ok = await confirmar({
    titulo: 'Gerar conta a receber?',
    texto: 'R$ ' + money(p.total) + ' de ' + (p.sucursalNome || '—'),
    linhas: [['Pedido', '#' + String(p.numero || 0).padStart(4, '0'), ''],
             ['Vencimento', dataBR(vencimentoPedidoBase(p)) +
              ' — 3 dias após o pedido', '']],
    ok: 'Gerar cobrança'
  });
  if (!ok) return;
  gerarReceberPedido(p);
  salvar();
  toast('Conta a receber gerada — vence ' + dataBR(vencimentoPedidoBase(p)) + '.');
  telaBasesHub();
}

/* ==========================================================
   MATRIZ: A BASE SAI DO ESTOQUE QUANDO O PEDIDO E ENTREGUE

   Sao dois fatos distintos e por isso dois registros: um dia a fabrica
   produziu e a base entrou no estoque da matriz; outro dia a unidade veio
   buscar e ela saiu. Um lancamento so nao saberia responder quanto cada
   unidade levou, nem em que dia.

   As linhas saem de montarLinhas(...,'producao') e fica so a ENTRADA do
   produto acabado, com a direcao virada. Assim a quantidade que sai e, por
   construcao, exatamente a que entrou — inclusive quando a ficha tem fator
   de rendimento e o destino esta em outra unidade de medida. Recalcular por
   fora daria diferenca no dia em que alguem mexesse no fator.
   ========================================================== */
/* ==========================================================
   CAIXA NAO E UNIDADE

   O pedido de base e feito em CAIXAS ("3 cx"), e a tela de Bases e
   Valores diz quantas unidades tem a caixa ("Qtde/cx") e quanto vale
   cada unidade ("Valor unitario"). A conta do dinheiro sempre usou as
   duas: caixa x unidades x preco = valor da caixa, e o total do pedido
   saia certo.

   A conta da QUANTIDADE, nao. Producao, saida do estoque da matriz e
   entrada no estoque da loja recebiam o numero de caixas como se fosse
   a quantidade na unidade da ficha. Com Qtde/cx = 10, um pedido de 3
   caixas produzia 3 kg em vez de 30, consumia um decimo dos ingredientes
   e chegava na loja como 3 kg a R$ 120/kg em vez de 30 kg a R$ 12/kg. O
   dinheiro batia; o estoque e o custo por quilo, nao.

   Enquanto toda base esteve cadastrada com Qtde/cx = 1 — como estao as
   54 de hoje — caixa e unidade eram a mesma coisa e nada aparecia. O
   defeito acordaria no dia em que a matriz cadastrasse a primeira caixa
   com mais de uma unidade.

   Estas duas funcoes sao a unica porta: qualquer lugar que precise da
   quantidade de verdade pergunta aqui.
   ========================================================== */
function porCaixaDoItem(i){
  var n = Number(i && i.porCaixa);
  if (n > 0) return n;                     /* gravado no envio: manda ele */
  /* pedido antigo, de antes desta versao: tenta o catalogo, senao 1 */
  var b = (DB.basesCat || []).find(function (x) { return x.id === (i || {}).baseRef; });
  return Number(b && b.qtdCaixa) || 1;
}
function unidadesDoItem(i){
  return (Number(i && i.qtd) || 0) * porCaixaDoItem(i);
}
/* preco de UMA unidade (o item guarda o valor da caixa em valorUnit) */
function precoUnitDoItem(i){
  var p = Number(i && i.precoUnit);
  if (p > 0) return p;
  var cx = porCaixaDoItem(i);
  return cx ? +((Number(i && i.valorUnit) || 0) / cx).toFixed(6) : 0;
}
function itensSaidaBases(p){
  return itensComFicha(p).map(function (i) {
    return { tipo: 'ficha', refId: i.fichaRef, unidade: '',
             qtd: unidadesDoItem(i), custo: 0, obs: i.baseNome };
  });
}
function linhasSaidaBases(p){
  return montarLinhas(itensSaidaBases(p), 'producao')
    .filter(function (l) { return l.direcao === 'entrada'; })
    .map(function (l) { l.direcao = 'saida'; return l; });
}
function marcaSaidaBase(p){
  return 'Pedido de base #' + String(p.numero || 0).padStart(4, '0') +
         ' — entregue a ' + (p.sucursalNome || '');
}
/* "ja saiu?" nao pode ser respondido por um campo solto no aparelho: o
   pedido volta da nuvem sem os campos que nao existem na tabela, e a marca
   se perderia. A marca fica no proprio movimento, que sobe e desce inteiro —
   e o mesmo caminho que a ordem de producao usa para se reconhecer. */
function saidaBaseJaFeita(p){
  var marca = marcaSaidaBase(p);
  return (DB.movEst || []).some(function (m) {
    return m.origem === 'pedbase_saida' && String(m.identificacao || '') === marca;
  });
}
function saidaBasesMatriz(p){
  if (!p || saidaBaseJaFeita(p)) return null;
  baseMov();
  var itens = itensSaidaBases(p);
  var linhas = linhasSaidaBases(p);
  if (!linhas.length) return null;
  var mov = {
    id: uid('mv'), data: hojeISO(), hora: agoraHM(),
    motivoId: 'mv_pedbase', identificacao: marcaSaidaBase(p),
    obs: '', itens: itens, linhas: linhas, origem: 'pedbase_saida'
  };
  DB.movEst.push(mov);
  aplicarMovimento(mov);
  return mov;
}

/* ---------- 3. FILIAL: dar entrada no estoque ---------- */
async function receberPedidoBase(id){
  var p = basePedidos().find(function (x) { return x.id === id; });
  if (!p) return;
  if (p.entradaEstoque) { toast('Este pedido já entrou no estoque.'); return; }
  if (p.sucursalRef !== lojaAtualId()) {
    toast('Este pedido é de outra unidade.');
    return;
  }
  baseMov();

  /* a base entra como o ITEM que ela é: a ficha técnica da matriz vira
     produto acabado na filial. Sem ficha ligada, entra pelo próprio nome. */
  var itens = [], semItem = [];
  (p.itens || []).forEach(function (it) {
    var f = (DB.fichas || []).find(function (x) { return x.id === it.fichaRef; });
    if (f) itens.push({ tipo: 'ficha', refId: f.id, unidade: f.unidade || 'un',
                        qtd: unidadesDoItem(it),
                        custo: precoUnitDoItem(it), obs: it.baseNome });
    else semItem.push(it);
  });
  if (!itens.length) {
    await confirmar({
      titulo: 'Sem ficha técnica ligada',
      texto: 'O sistema não sabe em qual item somar a entrada.',
      aviso: 'Peça à matriz para ligar cada base à ficha em <b>Bases e valores</b>.',
      ok: 'Entendi', cancelar: null
    });
    return;
  }

  var ok = await confirmar({
    titulo: 'Dar entrada no estoque?',
    texto: itens.length + ' base(s) entram no estoque de ' + E(sucNome(lojaAtualId())),
    linhas: itens.slice(0, 6).map(function (i) {
      return [i.obs, fmtQt(i.qtd) + ' ' + un(i.unidade).ab, 'R$ ' + money(i.custo)];
    }),
    aviso: (semItem.length
      ? semItem.length + ' item(ns) sem ficha não entram.<br>' : '') +
      'Depois disso será gerada a conta a pagar para a matriz.',
    ok: 'Dar entrada'
  });
  if (!ok) return;

  var linhas = itens.map(function (i) {
    var f = (DB.fichas || []).find(function (x) { return x.id === i.refId; });
    return { insumoId: i.refId, nome: (f || {}).nome || i.obs, unidade: i.unidade,
             qtd: Number(i.qtd) || 0, custo: Number(i.custo) || 0,
             direcao: 'entrada', tipo: 'ficha' };
  });
  var mov = {
    id: uid('mv'), data: hojeISO(), hora: agoraHM(),
    motivoId: 'mv_ent',
    identificacao: 'Recebimento do pedido #' +
                   String(p.numero || 0).padStart(4, '0'),
    obs: 'entrada de bases vindas da matriz',
    itens: JSON.parse(JSON.stringify(itens)),
    linhas: linhas, origem: 'manual'
  };
  DB.movEst.push(mov);
  aplicarMovimento(mov);
  p.entradaEstoque = true;
  p.movEntradaRef = mov.id;

  /* a conta a pagar nasce junto: receber mercadoria e não registrar a dívida
     é como o financeiro da loja fica errado sem ninguém perceber */
  baseFin();
  DB.lancFin = DB.lancFin || [];
  var l = {
    id: uid('lf'), tipo: 'despesa',
    descricao: 'Pedido de base #' + String(p.numero || 0).padStart(4, '0') +
               ' — matriz',
    contaId: '', metodoId: '', categoriaId: '', categoriaTxt: 'Pedido de base',
    fornecedor: 'Matriz', documento: '',
    valor: Number(p.total) || 0,
    emissao: hojeISO(), vencimento: hojeISO(), pagamento: '',
    pago: false, conciliado: false,
    origem: 'pedido_base', origemRef: p.id
  };
  DB.lancFin.push(l);
  p.finPagarRef = l.id;
  salvar();
  toast('Entrada registrada e conta a pagar gerada.');
  try { pintarSino(); } catch (e) { _quieto(e, 'receberPedidoBase'); }
  /* esta acao roda na tela do FRANQUEADO. Mandar para telaBasesHub jogaria
     ele numa tela a que nao tem acesso — a troca em massa de nome pegou
     tambem esta chamada, que nao devia. */
  telaPedidoBase();
}


/* ==========================================================
   ETAPA 4 — AS AUTOMAÇÕES
   Aqui o pedido deixa de ser papel e mexe no estoque e no dinheiro. Cada
   ação tem um botão e nenhuma acontece sozinha: quem clica responde pelo
   lançamento.

     MATRIZ, ao confirmar → Produzir: ordem de produção que baixa as fichas
                            técnicas · Faturar: conta a RECEBER da unidade
     UNIDADE, ao receber  → Dar entrada: entrada no estoque dela
                            Conta a pagar: o que ela deve à matriz

   Nada é reimplementado: a produção e a entrada usam aplicarMovimento(), o
   mesmo caminho da tela de Movimentação. Conta paralela divergiria com o
   tempo, e depois seria impossível saber qual saldo está certo.
   Cada ação grava a referência do que criou e confere antes de rodar —
   clicar duas vezes não duplica nada.
   ========================================================== */

function itensComFicha(p){
  return (p.itens || []).filter(function (i) { return !!i.fichaRef; });
}
function itensSemFicha(p){
  return (p.itens || []).filter(function (i) { return !i.fichaRef; });
}
/* o sistema tem hojeISO e dataBR; estas duas faltavam */

/* ---------- MATRIZ: produzir ---------- */
async function produzirPedido(id){
  var p = basePedidos().find(function (x) { return x.id === id; });
  if (!p) return;
  if (await travaPedidoSemItens(p)) return;
  if (p.produzido) { toast('Este pedido já foi produzido.'); return; }
  baseMov();
  var comFicha = itensComFicha(p), semFicha = itensSemFicha(p);
  if (!comFicha.length) {
    await confirmar({
      titulo: 'Nenhuma base com ficha técnica',
      texto: 'Sem ficha, o sistema não sabe o que consumir para produzir.',
      aviso: 'Ligue as fichas em <b>Bases e valores</b>. O faturamento ' +
             'funciona mesmo sem ficha.',
      ok: 'Entendi', cancelar: null
    });
    return;
  }
  var motivoProd = (DB.motivosMov || []).find(function (m) {
    return tipoMotivo(m.id) === 'producao' && m.ativo !== false;
  });
  if (!motivoProd) { toast('Nenhum motivo de produção cadastrado.'); return; }

  var itensProd = comFicha.map(function (i) {
    return { tipo: 'ficha', refId: i.fichaRef, unidade: '',
             qtd: unidadesDoItem(i), custo: 0, obs: i.baseNome };
  });
  var linhas = montarLinhas(itensProd, 'producao');
  if (!linhas.length) { toast('As fichas ligadas não consomem insumo nenhum.'); return; }
  var falta = faltaEstoque(linhas);
  if (falta.length) { alert(avisoFalta(falta, 'esta produção')); return; }

  var ok = await confirmar({
    titulo: 'Produzir o pedido #' + String(p.numero || 0).padStart(4, '0') + '?',
    texto: comFicha.length + ' base(s) para ' + E(p.sucursalNome) + '.',
    linhas: comFicha.slice(0, 8).map(function (i) {
      return [i.baseNome, fmtQt(i.qtd) + ' cx', ''];
    }),
    aviso: 'Os insumos das fichas saem do estoque da matriz agora.' +
           (semFicha.length
             ? '<br><b>' + semFicha.length + ' base(s) sem ficha</b> ficam de fora.'
             : ''),
    ok: 'Produzir', tipo: 'perigo'
  });
  if (!ok) return;

  var mov = { id: uid('mv'), data: hojeISO(), hora: agoraHM(),
    motivoId: motivoProd.id,
    identificacao: 'Pedido de base #' + String(p.numero || 0).padStart(4, '0') +
                   ' — ' + (p.sucursalNome || ''),
    obs: '', itens: itensProd, linhas: linhas, origem: 'manual' };
  DB.movEst.push(mov);
  aplicarMovimento(mov);
  p.produzido = true; p.movProducaoRef = mov.id;
  salvar();
  toast('Produção lançada — ' + linhas.length + ' insumo(s) baixados.');
  telaBasesHub();
}

/* ---------- MATRIZ: conta a receber ---------- */

/* ---------- UNIDADE: entrada no estoque ---------- */

/* ---------- UNIDADE: conta a pagar ---------- */

var PR = { filtro: 'todos', busca: '', de: '', ate: '', aberto: null };

var FASES_PED = ['enviado', 'confirmado', 'enviado_matriz', 'entregue', 'pago'];
var ROTULO_FASE = {
  enviado: 'Aguardando', confirmado: 'Confirmado',
  enviado_matriz: 'Enviado pela matriz', entregue: 'Entregue', pago: 'Pago'
};

function telaPedidosRecebidos(){
  if (!ehMatriz() && !ehPlataforma()) return telaRestrita('Pedidos recebidos');
  basePedidos();
  var l = basePedidos().slice();
  if (PR.filtro !== 'todos') l = l.filter(function (p) { return p.situacao === PR.filtro; });
  if (PR.de) l = l.filter(function (p) { return p.data >= PR.de; });
  if (PR.ate) l = l.filter(function (p) { return p.data <= PR.ate; });
  var q = (PR.busca || '').toLowerCase().replace('#', '');
  if (q) l = l.filter(function (p) {
    return String(p.numero || '').indexOf(q) >= 0 ||
           String(p.sucursalNome || '').toLowerCase().indexOf(q) >= 0;
  });
  l.sort(function (a, b) { return (Number(b.numero) || 0) - (Number(a.numero) || 0); });

  var cont = {};
  basePedidos().forEach(function (p) { cont[p.situacao] = (cont[p.situacao] || 0) + 1; });
  var totalAberto = basePedidos().filter(function (p) {
    return ['enviado', 'confirmado', 'enviado_matriz', 'entregue'].indexOf(p.situacao) >= 0;
  }).reduce(function (a, p) { return a + (Number(p.total) || 0); }, 0);

  $('content').innerHTML = '<div class="etWrap"><div class="etScroll">' +
   '<div class="etTopo"><div><h1>Pedidos de Base</h1>' +
   '<p>Pedidos recebidos das unidades.</p></div></div>' +

   '<div class="hpNums" style="border:1px solid var(--line);border-radius:8px;' +
    'overflow:hidden;margin-bottom:12px">' +
    '<div class="hpN"><span>Aguardando</span><b class="' +
      ((cont.enviado || 0) ? 'am' : '') + '">' + (cont.enviado || 0) + '</b></div>' +
    '<div class="hpN"><span>Em andamento</span><b>' +
      ((cont.confirmado || 0) + (cont.enviado_matriz || 0) + (cont.entregue || 0)) +
      '</b></div>' +
    '<div class="hpN"><span>Pagos</span><b>' + (cont.pago || 0) + '</b></div>' +
    '<div class="hpN"><span>A receber</span><b class="vr">R$ ' +
      money(totalAberto) + '</b></div>' +
   '</div>' +

   '<div class="lbBarra">' +
    '<div class="lbBusca" style="max-width:230px">' + sv('search', 14) +
     '<input value="' + E(PR.busca) + '" placeholder="Nº do pedido ou unidade" ' +
     'oninput="PR.busca=this.value;clearTimeout(window._prT);' +
     'window._prT=setTimeout(telaPedidoHub,250)"></div>' +
    '<div class="f2" style="max-width:140px"><label>De</label>' +
     '<input type="date" value="' + E(PR.de) + '" ' +
     'onchange="PR.de=this.value;telaBasesHub()"></div>' +
    '<div class="f2" style="max-width:140px"><label>Até</label>' +
     '<input type="date" value="' + E(PR.ate) + '" ' +
     'onchange="PR.ate=this.value;telaBasesHub()"></div>' +
   '</div>' +
   '<div class="lbSegm" style="margin-bottom:12px;flex-wrap:wrap">' +
    [['todos', 'Todos'], ['enviado', 'Aguardando'], ['confirmado', 'Confirmados'],
     ['enviado_matriz', 'Enviados'], ['entregue', 'Entregues'], ['pago', 'Pagos'],
     ['rejeitado', 'Rejeitados']].map(function (f) {
      var n = f[0] === 'todos' ? basePedidos().length : (cont[f[0]] || 0);
      return '<button class="' + (PR.filtro === f[0] ? 'on' : '') + '" ' +
        'onclick="PR.filtro=\'' + f[0] + '\';telaBasesHub()">' + f[1] +
        ' <b>' + n + '</b></button>';
    }).join('') + '</div>' +

   (l.length
    ? l.map(function (p) { return cartaoPedido(p); }).join('')
    : '<div class="entVazio"><b>Nenhum pedido</b>' +
      '<span>Os pedidos das unidades aparecem aqui.</span></div>') +
  '</div></div>';
  rodape(l.length + ' pedido(s) · R$ ' + money(totalAberto) + ' em aberto');
}

function cartaoPedido(p){
  var aberto = (PR.aberto === p.id);
  var i = FASES_PED.indexOf(p.situacao);
  var rejeitado = (p.situacao === 'rejeitado');
  return '<div class="prCard' + (aberto ? ' on' : '') + '">' +
   '<div class="prH" onclick="PR.aberto=' +
     (aberto ? 'null' : '\'' + p.id + '\'') + ';telaBasesHub()">' +
    '<b class="prNum">#' + String(p.numero || 0).padStart(4, '0') + '</b>' +
    '<div class="prLoja"><b>' + E(p.sucursalNome || '—') +
     (cidadeDaUnidade(p) ? ' <span class="prCid">· ' + E(cidadeDaUnidade(p)) + '</span>' : '') +
     '</b><span>' + (p.itens || []).length + ' itens · ' + E(dataBR(p.data)) +
     (p.responsavel ? ' · ' + E(p.responsavel) : '') + '</span></div>' +
    '<div style="flex:1"></div>' +
    '<b class="prTot">R$ ' + money(p.total) + '</b>' +
    seloPedBase(p.situacao) +
    '<span class="prSeta">' + sv(aberto ? 'up' : 'dn', 13) + '</span>' +
   '</div>' +
   (aberto
    ? '<div class="prCorpo">' +
      (pedidoSemItens(p)
       ? '<div class="avisoIn" style="margin:0 0 12px"><b>Os itens deste ' +
         'pedido ainda não chegaram.</b> Ele vale R$ ' + money(p.total) +
         ', mas a lista de bases não chegou aqui — sobe sozinha quando ' +
         E(p.sucursalNome || 'a unidade') + ' abrir o sistema atualizado. ' +
         'Enquanto isso, o pedido não pode ser confirmado nem cobrado.</div>'
       : '') +
      (rejeitado
       ? '<div class="avisoIn" style="margin:0 0 12px">Rejeitado: ' +
         E(p.motivoRejeicao || 'sem motivo informado') + '</div>'
       : '<div class="prPassos">' + FASES_PED.map(function (f, k) {
           var feito = (i >= k);
           return '<div class="prPasso' + (feito ? ' ok' : '') +
             (i === k ? ' atual' : '') + '">' +
             '<i>' + (feito ? sv('check', 11) : (k + 1)) + '</i>' +
             '<span>' + ROTULO_FASE[f] + '</span></div>';
         }).join('') + '</div>') +
      '<div class="lbTabW"><table class="pTable"><thead><tr>' +
       '<th>Item</th><th style="width:80px;text-align:right">Qtde</th>' +
       '<th style="width:110px;text-align:right">Preço</th>' +
       '<th style="width:120px;text-align:right">Total</th>' +
       '<th style="width:120px">Ficha</th></tr></thead><tbody>' +
       (p.itens || []).map(function (it) {
         return '<tr><td><b>' + E(it.baseNome) + '</b></td>' +
          '<td style="text-align:right">' + fmtQt(it.qtd) + '</td>' +
          '<td style="text-align:right">R$ ' + money(it.valorUnit) + '</td>' +
          '<td style="text-align:right"><b>R$ ' + money(it.total) + '</b></td>' +
          '<td>' + (it.fichaRef
            ? '<span class="pill vd">ligada</span>'
            : '<span class="pill am">sem ficha</span>') + '</td></tr>';
       }).join('') + '</tbody></table></div>' +
      (p.obs ? '<div class="prObs"><b>Observação:</b> ' + E(p.obs) + '</div>' : '') +
      '<div class="prAcoes"><button class="btnP2" onclick="event.stopPropagation();' +
       'imprimirPedidoBase(\'' + p.id + '\')">' + sv('print', 12) +
       ' Imprimir / PDF</button>' + acoesPedido(p) + '</div>' +
     '</div>'
    : '') +
  '</div>';
}

function acoesPedido(p){
  if (p.situacao === 'rejeitado') return '';
  var matriz = (ehMatriz() || ehPlataforma());
  var h = '';
  /* As automacoes aparecem conforme a fase e somem depois de feitas — o
     estado GRAVADO no pedido e que decide, nao o clique. Assim recarregar a
     tela ou clicar duas vezes nao duplica producao nem cobranca. */
  var feitos = [];
  if (p.produzido)      feitos.push('produzido');
  if (p.finReceberRef)  feitos.push('faturado');
  if (saidaBaseJaFeita(p)) feitos.push('saiu do estoque da matriz');
  if (p.entradaEstoque) feitos.push('em estoque na unidade');
  if (p.finPagarRef)    feitos.push('a pagar gerado');
  if (feitos.length)
    h += '<div class="prFeitos">' + feitos.map(function(f){
      return '<span>' + sv('check',10) + ' ' + f + '</span>'; }).join('') + '</div>';

  var confirmado = (['confirmado','enviado_matriz','entregue','pago'].indexOf(p.situacao) >= 0);
  var entregue   = (['entregue','pago'].indexOf(p.situacao) >= 0);
  if (matriz && confirmado && !p.produzido)
    h += '<button class="btnP2 acB" onclick="produzirPedido(\'' + p.id + '\')">' +
         sv('box',12) + ' Lançar produção</button>';
  /* A cobranca nasce sozinha no clique de "Entregue". Este botao e so a rede
     de seguranca para o pedido que passou por ali sem gerar — pedido antigo,
     ou entrega marcada antes desta versao. */
  if (matriz && entregue && !p.finReceberRef)
    h += '<button class="btnP2 acB" onclick="faturarPedidoBase(\'' + p.id + '\')">' +
         sv('money',12) + ' Gerar cobrança</button>';
  /* Dar entrada e gerar a conta a pagar sao da UNIDADE, e ficam na tela dela,
     no botao "Recebi as bases". Tinha botao para isso aqui tambem: quem
     abrisse por engano poria a mercadoria no estoque de quem nao a recebeu, e
     o pedido apareceria conferido sem ninguem ter conferido nada. */

  h += '<div style="flex:1"></div>';
  var prox = {
    enviado: ['confirmado', 'Confirmar'],
    confirmado: ['enviado_matriz', 'Marcar enviado'],
    enviado_matriz: ['entregue', 'Marcar entregue'],
    entregue: ['pago', 'Marcar pago']
  }[p.situacao];
  if (matriz && p.situacao === 'enviado')
    h += '<button class="btnP2 rdB" onclick="rejeitarPedido(\'' + p.id + '\')">' +
         'Rejeitar</button>';
  if (matriz && prox && !pedidoSemItens(p)){
    h += '<button class="btnVerde" onclick="avancarPedido(\'' + p.id + '\',\'' +
         prox[0] + '\')">' + prox[1] + '</button>';
  }else if (p.situacao === 'pago'){
    h += '<span class="bsOk">' + sv('check',12) + ' concluído</span>';
  }
  return h;
}

/* ==========================================================
   "ENTREGUE" E O PASSO QUE MEXE NO ESTOQUE E NO DINHEIRO

   Ate aqui o pedido e papel: pedido, confirmado, produzido. A base
   produzida esta guardada no estoque da matriz. No momento em que a unidade
   vem buscar, duas coisas acontecem juntas e nao podem se separar — a base
   sai do estoque da matriz e a cobranca daquela unidade nasce. Se so uma das
   duas acontecesse, o estoque ou o financeiro ficaria mentindo, e ninguem
   descobriria isso olhando a tela do pedido.

   Por isso e um clique so, e a caixa de confirmacao diz exatamente o que vai
   acontecer antes de acontecer.
   ========================================================== */
/* ==========================================================
   PEDIDO SEM ITENS NAO ANDA — A TRAVA

   O Rafael, 02/09/2026: o pedido #0002, de R$ 2.557,00, chegou na matriz
   SEM os itens (a lista nunca subiu da loja) e mesmo assim foi confirmado
   e seguia para virar cobranca. Uma cobranca de dois mil e quinhentos
   reais sem saber quais bases — e sem baixar nada do estoque da matriz,
   porque nao ha o que baixar.

   `pedidoSemItens` reconhece esse estado: tem valor, mas a lista nao
   chegou a este aparelho. A partir daqui, um pedido assim NAO confirma,
   NAO produz e NAO fatura. Ele espera os itens — que sobem sozinhos
   quando a loja que o fez abrir o sistema atualizado, ou entao o pedido e
   refeito. Assim a matriz nunca mais processa um pedido fantasma.
   ========================================================== */
function pedidoSemItens(p){
  return !!p && (Number(p.total)||0) > 0 && (!(p.itens||[]).length);
}
async function travaPedidoSemItens(p){
  if(!pedidoSemItens(p))return false;
  await confirmar({
    titulo:'Os itens deste pedido ainda não chegaram',
    texto:'O pedido #'+String(p.numero||0).padStart(4,'0')+' de '+
      E(p.sucursalNome||'uma unidade')+' vale R$ '+money(p.total)+
      ', mas a lista de bases não chegou a este aparelho.',
    aviso:'Enquanto a lista não aparecer, o pedido não pode ser confirmado, '+
      'produzido nem cobrado — seria uma cobrança sem saber o que foi pedido. '+
      'Peça para <b>'+E(p.sucursalNome||'a unidade')+'</b> abrir o sistema '+
      'atualizado: a lista sobe sozinha. Se não aparecer, o pedido precisa ser refeito.',
    ok:'Entendi', cancelar:null, tipo:'info'
  });
  return true;
}
async function avancarPedido(id, para){
  var p = basePedidos().find(function (x) { return x.id === id; });
  if (!p) return;
  if (await travaPedidoSemItens(p)) return;
  var entrega = (para === 'entregue');
  var jaSaiu  = entrega && saidaBaseJaFeita(p);
  var linhasSai = (entrega && !jaSaiu) ? linhasSaidaBases(p) : [];
  var falta = linhasSai.length ? faltaEstoque(linhasSai) : [];
  var extras = [];
  if (linhasSai.length)
    extras.push(['Estoque da matriz', linhasSai.length + ' item(ns) saem', '']);
  if (entrega && !p.finReceberRef)
    extras.push(['Conta a receber', 'R$ ' + money(p.total) +
                 ' · vence ' + dataBR(vencimentoPedidoBase(p)), '']);
  var ok = await confirmar({
    titulo: ROTULO_FASE[para] + '?',
    texto: 'Pedido #' + String(p.numero || 0).padStart(4, '0') + ' — ' +
           E(p.sucursalNome) + ' — R$ ' + money(p.total),
    linhas: extras,
    aviso: (falta.length
      ? '<b>' + falta.length + ' item(ns) ficam com saldo negativo</b> — a ' +
        'produção deste pedido não foi lançada. Dá para seguir, mas o estoque ' +
        'da matriz vai ficar devendo.'
      : (entrega && !linhasSai.length && !jaSaiu
          ? 'Nenhuma base deste pedido tem ficha ligada, então <b>nada sai do ' +
            'estoque</b>. A cobrança é gerada do mesmo jeito.'
          : '')),
    ok: ROTULO_FASE[para]
  });
  if (!ok) return;
  p.situacao = para;
  var agora = new Date().toISOString();
  if (para === 'confirmado') p.confirmadoEm = agora;
  if (para === 'entregue') p.entregueEm = agora;
  if (para === 'pago') p.pagoEm = agora;
  var msg = ROTULO_FASE[para].toLowerCase();
  if (entrega) {
    var mv = saidaBasesMatriz(p);
    var lr = gerarReceberPedido(p);
    if (mv) msg += ' · ' + mv.linhas.length + ' item(ns) baixados do estoque';
    if (lr) msg += ' · cobrança de R$ ' + money(lr.valor);
  }
  salvar();
  toast('Pedido ' + msg + '.');
  try { pintarSino(); } catch (e) { _quieto(e, 'avancarPedido'); }
  telaBasesHub();
}

async function rejeitarPedido(id){
  var p = basePedidos().find(function (x) { return x.id === id; });
  if (!p) return;
  var motivo = prompt('Por que este pedido está sendo rejeitado?\n\n' +
    'A unidade vai ver esta mensagem.');
  if (motivo === null) return;
  if (!String(motivo).trim()) { toast('Informe o motivo.'); return; }
  p.situacao = 'rejeitado';
  p.motivoRejeicao = String(motivo).trim();
  salvar();
  toast('Pedido rejeitado.');
  try { pintarSino(); } catch (e) { _quieto(e, 'rejeitarPedido'); }
  telaBasesHub();
}

var PB = { itens: {}, obs: '', responsavel: '', data: '', busca: '', erro: '' };

function basePedidos(){ DB.pedidosBase = DB.pedidosBase || []; return DB.pedidosBase; }

/* ==========================================================
   O SINO — o que aconteceu com os pedidos, para quem interessa

   Ate a V207 o sino era enfeite: respondia sempre a mesma frase, dizendo
   que nao havia aviso nenhum, com um zero fixo escrito no HTML ao lado. O
   franqueado so descobria que o pedido dele tinha ficado pronto se abrisse
   a tela e olhasse o selo.

   (A frase antiga nao aparece escrita aqui de proposito: o teste procura o
   texto dela no arquivo inteiro para garantir que ela sumiu, e um comentario
   citando-a reprovaria a suite — ja aconteceu uma vez, com href.)

   NAO existe tabela de notificacoes, e isso e proposital. O aviso e
   DERIVADO do proprio pedido, que ja sobe e desce inteiro: cada mudanca de
   fase ja grava a hora (enviadoEm, confirmadoEm, entregueEm, pagoEm), e
   essa hora e o aviso. Uma tabela a parte seria um segundo lugar onde a
   verdade mora — e no dia em que os dois discordassem, ninguem saberia qual
   acreditar. Tambem nao precisa de migration nenhuma.

   Quem ve o que:
     matriz  -> chegou pedido novo · a unidade conferiu o recebimento
     unidade -> confirmado · pronto para retirar · pago · recusado

   O "ja li" fica no APARELHO, nao na nuvem: e a lista de avisos que ESTA
   pessoa ja viu nesta maquina. Guardar isso no banco faria abrir o sino no
   caixa apagar o aviso do celular do dono.
   ========================================================== */
function ehDaMatriz(){
  return (typeof ehMatriz === 'function' && ehMatriz()) ||
         (typeof ehPlataforma === 'function' && ehPlataforma());
}
function avisosPedidoBase(){
  var matriz = ehDaMatriz();
  var minha = (typeof lojaAtualId === 'function') ? lojaAtualId() : '';
  var out = [];
  (DB.pedidosBase || []).forEach(function (p) {
    var num = '#' + String(p.numero || 0).padStart(4, '0');
    function por(tipo, quando, titulo, texto, cor) {
      if (!quando) return;
      out.push({ id: p.id + ':' + tipo, pedido: p.id, tipo: tipo, quando: quando,
                 titulo: titulo, texto: texto, cor: cor || '' });
    }
    if (matriz) {
      por('novo', p.enviadoEm, 'Pedido ' + num + ' recebido',
          (p.sucursalNome || 'uma unidade') + ' — R$ ' + money(p.total), 'am');
      if (p.entradaEstoque)
        por('conferido', p.entregueEm || p.enviadoEm, 'Pedido ' + num + ' conferido',
            (p.sucursalNome || 'a unidade') + ' confirmou o recebimento', 'vd');
    } else if (p.sucursalRef === minha) {
      por('confirmado', p.confirmadoEm, 'Pedido ' + num + ' confirmado',
          'A matriz aceitou — R$ ' + money(p.total), 'az');
      por('pronto', (['entregue', 'pago'].indexOf(p.situacao) >= 0) ? p.entregueEm : '',
          'Pedido ' + num + ' pronto',
          'Pode retirar na matriz. Ao conferir, toque em "Recebi as bases".', 'vd');
      por('pago', p.pagoEm, 'Pedido ' + num + ' quitado',
          'A matriz marcou este pedido como pago.', 'vd');
      /* recusa nao tem hora propria gravada: usa a do envio, que e a unica
         que existe. Ordena um pouco atras, mas aparece — e aparecer e o que
         importa em pedido recusado. */
      if (p.situacao === 'rejeitado')
        por('rejeitado', p.enviadoEm || p.data, 'Pedido ' + num + ' recusado',
            p.motivoRejeicao || 'sem motivo informado', 'rd');
    }
  });
  out.sort(function (a, b) { return String(b.quando).localeCompare(String(a.quando)); });
  return out.slice(0, 40);
}

function chaveSino(){
  var u = (typeof usuarioLogado === 'function' && usuarioLogado()) || {};
  return 'nexor_sino_' + (u.id || u.login || 'anon');
}
function sinoVistos(){
  try {
    var v = JSON.parse(localStorage.getItem(chaveSino()) || '[]');
    return Array.isArray(v) ? v : [];
  } catch (e) { return []; }
}
function marcarSinoVisto(lista){
  try {
    var v = sinoVistos();
    (lista || []).forEach(function (a) { if (v.indexOf(a.id) < 0) v.push(a.id); });
    /* a lista nao cresce para sempre: guarda os 300 avisos mais recentes */
    localStorage.setItem(chaveSino(), JSON.stringify(v.slice(-300)));
  } catch (e) { _quieto(e, 'marcarSinoVisto'); }
}
/* primeira vez neste aparelho: o historico inteiro nao e novidade. O sino
   comeca quieto e passa a avisar do que acontecer daqui para frente — senao
   quem abrisse hoje veria quarenta avisos de pedidos de meses atras. */
function sinoEstreia(){
  try {
    if (localStorage.getItem(chaveSino()) !== null) return;
    marcarSinoVisto(avisosPedidoBase());
  } catch (e) { _quieto(e, 'sinoEstreia'); }
}
function avisosNovos(){
  var v = sinoVistos();
  return avisosPedidoBase().filter(function (a) { return v.indexOf(a.id) < 0; });
}
function quandoSino(q){
  var d = new Date(q);
  if (isNaN(d.getTime())) return '';
  var min = Math.floor((Date.now() - d.getTime()) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return 'há ' + min + ' min';
  if (min < 1440) return 'há ' + Math.floor(min / 60) + ' h';
  var dias = Math.floor(min / 1440);
  if (dias === 1) return 'ontem';
  if (dias < 30) return 'há ' + dias + ' dias';
  return dataBR(String(q).slice(0, 10));
}
function pintarSino(){
  var el = document.getElementById('sinoBadge');
  if (!el) return;
  sinoEstreia();
  var n = avisosNovos().length;
  el.textContent = n > 99 ? '99+' : String(n);
  el.style.display = n ? '' : 'none';
}
function abrirSino(ev){
  /* o sino mora no cabecalho, fora da faixa — sem isto o clique sobe para o
     ouvinte do documento, que fecha os menus, e o painel abriria e fecharia
     no mesmo clique */
  if (ev && ev.stopPropagation) ev.stopPropagation();
  var cx = document.getElementById('sucBox');
  if (!cx) return;
  if (document.getElementById('sinoMenu')) { fecharSuc(); return; }
  fecharDrop();
  var lista = avisosPedidoBase();
  var novos = {};
  avisosNovos().forEach(function (a) { novos[a.id] = 1; });
  var bt = document.getElementById('btnSino');
  var dir = 150;
  try {
    if (bt) dir = Math.max(8, window.innerWidth - bt.getBoundingClientRect().right - 4);
  } catch (e) { _quieto(e, 'abrirSino'); }
  cx.innerHTML = '<div class="sinoMenu" id="sinoMenu" style="right:' + dir + 'px">' +
   '<div class="h">Avisos</div>' +
   (lista.length
    ? lista.map(function (a) {
        return '<button class="' + (novos[a.id] ? 'novo' : '') + '" ' +
          'onclick="irDoSino(\'' + a.pedido + '\')">' +
          '<i class="sinoPt ' + E(a.cor) + '"></i>' +
          '<span><b>' + E(a.titulo) + '</b><em>' + E(a.texto) + '</em>' +
          '<small>' + E(quandoSino(a.quando)) + '</small></span></button>';
      }).join('')
    : '<div class="sinoVazio">Nada por aqui.<br>Os pedidos de base avisam ' +
      'quando mudam de fase.</div>') +
  '</div>';
  /* abriu, leu: o que esta na lista deixa de ser novidade */
  marcarSinoVisto(lista);
  pintarSino();
}
function irDoSino(id){
  fecharSuc();
  var p = (DB.pedidosBase || []).find(function (x) { return x.id === id; });
  if (!p) return;
  if (ehDaMatriz()) {
    PR.aberto = p.id; PR.filtro = 'todos'; HUB.pedido = 'recebidos';
    abrir('controle', 'bases-valores');
  } else {
    abrir('controle', 'pedido-base');
  }
}

function basesAtivas(){
  return baseCatalogo().filter(function (b) { return b.ativo !== false; })
    .sort(function (a, b) { return String(a.nome || '').localeCompare(String(b.nome || '')); });
}
function proxNumPedBase(){
  var mx = 0;
  basePedidos().forEach(function (p) { var n = Number(p.numero) || 0; if (n > mx) mx = n; });
  return mx + 1;
}
function totalPedidoAtual(){
  var t = 0;
  basesAtivas().forEach(function (b) {
    var q = Number(PB.itens[b.id]) || 0;
    if (q > 0) t += q * (Number(b.qtdCaixa) || 1) * (Number(b.valorUnit) || 0);
  });
  return t;
}

function telaPedidoBase(){
  baseCatalogo(); basePedidos();
  if (!PB.data) PB.data = hojeISO();
  if (!PB.responsavel) PB.responsavel = (usuarioLogado() || {}).nome || '';
  var bases = basesAtivas();
  var q = (PB.busca || '').toLowerCase();
  var vis = q ? bases.filter(function (b) {
    return String(b.nome || '').toLowerCase().indexOf(q) >= 0;
  }) : bases;
  var total = totalPedidoAtual();
  var nItens = Object.keys(PB.itens).filter(function (k) {
    return (Number(PB.itens[k]) || 0) > 0;
  }).length;
  var meus = basePedidos().filter(function (p) {
    return p.sucursalRef === lojaAtualId();
  }).sort(function (a, b) {
    return String(b.data + (b.numero || '')).localeCompare(String(a.data + (a.numero || '')));
  }).slice(0, 8);

  $('content').innerHTML = '<div class="etWrap"><div class="etScroll">' +
   '<div class="etTopo"><div><h1>Pedido de Base</h1>' +
   '<p>Informe a quantidade de cada base. O pedido vai para a matriz.</p></div></div>' +

   '<div class="pbPrazo">' + sv('clock', 16) +
    '<div><b>Pedidos até as 12h00 de toda segunda-feira</b>' +
    '<span>Retirada na matriz: toda quinta-feira à tarde</span></div></div>' +

   '<div class="pbCab">' +
    '<div class="f2"><label>Unidade</label>' +
     '<div class="pbFixo">' + sv('store', 13) + ' ' + E(sucNome(lojaAtualId())) + '</div>' +
     '<div class="hint">vem do seu acesso — não é possível pedir por outra</div></div>' +
    '<div class="f2"><label>Data</label>' +
     '<input type="date" value="' + E(PB.data) + '" onchange="PB.data=this.value"></div>' +
    '<div class="f2"><label>Responsável</label>' +
     '<input value="' + E(PB.responsavel) + '" placeholder="quem está pedindo" ' +
     'oninput="PB.responsavel=this.value"></div>' +
    '<div class="f2"><label>Observações — opcional</label>' +
     '<input value="' + E(PB.obs) + '" placeholder="algo que a matriz precise saber" ' +
     'oninput="PB.obs=this.value"></div>' +
   '</div>' +

   (PB.erro ? '<div class="avisoIn" style="margin:0 0 12px">' + E(PB.erro) + '</div>' : '') +

   (!bases.length
    ? '<div class="entVazio"><b>Nenhuma base disponível</b>' +
      '<span>A matriz ainda não liberou a tabela de bases.</span></div>'
    :
   '<div class="blk" style="max-width:none">' +
    '<div class="blkH"><b>Itens do catálogo</b>' +
     '<span>' + bases.length + ' base(s) disponível(is)</span>' +
     '<div style="flex:1"></div>' +
     '<div class="lbBusca" style="max-width:220px">' + sv('search', 13) +
      '<input value="' + E(PB.busca) + '" placeholder="Buscar base" ' +
      'oninput="PB.busca=this.value;clearTimeout(window._pbT);' +
      'window._pbT=setTimeout(telaPedidoBase,250)"></div>' +
    '</div>' +
    '<div class="lbTabW"><table class="pTable"><thead><tr>' +
     '<th>Item</th><th style="width:82px;text-align:right">Qtde/cx</th>' +
     '<th style="width:110px;text-align:right">Preço</th>' +
     '<th style="width:104px">Quantidade</th>' +
     '<th style="width:120px;text-align:right">Total</th></tr></thead><tbody>' +
     vis.map(function (b) {
       var qt = Number(PB.itens[b.id]) || 0;
       var vCx = (Number(b.qtdCaixa) || 1) * (Number(b.valorUnit) || 0);
       return '<tr class="' + (qt > 0 ? 'pbSel' : '') + '">' +
        '<td><b>' + E(b.nome) + '</b></td>' +
        '<td style="text-align:right">' + fmtQt(b.qtdCaixa) + '</td>' +
        '<td style="text-align:right">R$ ' + money(vCx) + '</td>' +
        '<td><input class="bsIn nu" type="number" min="0" step="1" value="' +
          (qt || '') + '" placeholder="0" ' +
          'oninput="mudarQtdPedido(\'' + b.id + '\',this.value)"></td>' +
        '<td style="text-align:right">' +
          (qt > 0 ? '<b class="bsVlr">R$ ' + money(qt * vCx) + '</b>' :
           '<span style="color:var(--ink-3)">—</span>') + '</td>' +
       '</tr>';
     }).join('') + '</tbody></table></div>' +
    '<div class="pbRod">' +
     '<button class="btnP2" onclick="limparPedidoBase()">' + sv('trash', 12) +
      ' Limpar pedido</button>' +
     '<div style="flex:1"></div>' +
     '<div class="pbTot"><span>' + nItens + ' item(ns)</span>' +
      '<b>Total: R$ ' + money(total) + '</b></div>' +
    '</div>' +
   '</div>' +
   '<div class="pbAcoes">' +
    '<button class="btnP2" onclick="abrir(\'controle\',\'baixa-manual\')">Cancelar</button>' +
    '<button class="btnVerde" onclick="enviarPedidoBase()">' +
     sv('cr', 13) + ' Enviar pedido à matriz</button>' +
   '</div>') +

   /* ---------- histórico da própria unidade ---------- */
   (meus.length
    ? '<div class="blk" style="max-width:none;margin-top:16px">' +
      '<div class="blkH"><b>Meus pedidos</b>' +
       '<span>os últimos desta unidade</span></div>' +
      '<div class="lbTabW"><table class="pTable"><thead><tr>' +
       '<th style="width:80px">Nº</th><th style="width:100px">Data</th>' +
       '<th style="width:80px;text-align:right">Itens</th>' +
       '<th style="width:120px;text-align:right">Total</th>' +
       '<th>Situação</th><th style="width:52px"></th></tr></thead><tbody>' +
       meus.map(function (p) {
         return '<tr><td><b>#' + String(p.numero || 0).padStart(4, '0') + '</b></td>' +
          '<td>' + E(dataBR(p.data)) + '</td>' +
          '<td style="text-align:right">' + (p.itens || []).length + '</td>' +
          '<td style="text-align:right"><b>R$ ' + money(p.total) + '</b></td>' +
          '<td>' + seloPedBase(p.situacao) +
           (['entregue','pago'].indexOf(p.situacao) >= 0 && !p.entradaEstoque
             ? ' <button class="btnMini" onclick="receberPedidoBase(\'' + p.id +
               '\')">Recebi as bases</button>'
             : (p.entradaEstoque
                ? ' <span class="prFeito">' + sv('check', 11) + ' no estoque</span>'
                : '')) + '</td>' +
          '<td style="text-align:right">' +
           '<button class="rBtn" title="Ver o pedido" onclick="verPedidoBase(\'' + p.id +
            '\')">' + sv('eye', 12) + '</button></td></tr>';
       }).join('') + '</tbody></table></div></div>'
    : '') +
  '</div></div>';
  rodape(nItens ? ('pedido em aberto — R$ ' + money(total)) : 'nenhum item selecionado');
}

/* ==========================================================
   O PEDIDO ENVIADO PRECISA PODER SER ABERTO

   O Rafael, em 01/09/2026: "a loja de Santa Fe fez um pedido de base,
   esta la nos meus pedidos, o numero 0002. Porem nao tem nenhuma opcao
   de visualizar."

   A lista mostrava numero, data, quantos itens e o total — e nada mais.
   Quem manda um pedido de R$ 2.557,00 na segunda e quer conferir na
   quarta o que pediu nao tinha por onde. O olhinho abre o pedido inteiro,
   base por base, com quantidade, valor da unidade e total de cada linha.
   ========================================================== */
/* ==========================================================
   O PEDIDO DE BASE PRECISA SER VISTO INTEIRO — E IMPRESSO

   O Rafael, 02/09/2026: "o pedido chegou na matriz e nao tenho como ver;
   quando clico, quero que expanda com a identificacao de quem pediu, a
   cidade, todos os itens com quantidade e valor, e a opcao de imprimir ou
   exportar em PDF — tanto na franqueadora quanto na loja".

   Um comprovante so, usado nos dois lugares. Imprimir e exportar PDF sao a
   MESMA acao: o botao abre a janela de impressao do navegador, e ali a
   propria loja escolhe "Imprimir" numa impressora ou "Salvar como PDF" —
   e como o sistema inteiro ja imprime (fechamento, cupom, relatorio).
   ========================================================== */
function cidadeDaUnidade(p){
  if(!p)return '';
  var s=(typeof baseSuc==='function'?baseSuc():(DB.sucursais||[]))
    .find(function(x){return x.id===p.sucursalRef||x.nome===p.sucursalNome;});
  return (s&&s.cidade)||'';
}
function imprimirPedidoBase(id){
  var p=basePedidos().find(function(x){return x.id===id;});
  if(!p){toast('Pedido nao encontrado neste aparelho.');return;}
  var itens=p.itens||[];
  var cidade=cidadeDaUnidade(p);
  var linhas=itens.map(function(it){
    var q=unidadesDoItem(it), vu=precoUnitDoItem(it);
    return '<tr><td>'+E(it.baseNome||it.nome||'-')+'</td>'+
     '<td style="text-align:right">'+fmtQt(q)+'</td>'+
     '<td style="text-align:right">R$ '+money(vu)+'</td>'+
     '<td style="text-align:right">R$ '+money(Number(it.total)||q*vu)+'</td></tr>';
  }).join('');
  var el=document.getElementById('viaImp')||document.createElement('div');
  el.id='viaImp';
  el.innerHTML=
   '<style>#viaImp{font-family:Arial,Helvetica,sans-serif;color:#000;padding:6px}'+
   '#viaImp h2{font-size:16px;margin:0}#viaImp .cab{border-bottom:2px solid #000;'+
   'padding-bottom:8px;margin-bottom:10px}#viaImp .lin{font-size:12px;margin:2px 0}'+
   '#viaImp table{width:100%;border-collapse:collapse;font-size:11px;margin-top:6px}'+
   '#viaImp th{background:#eee;text-align:left;padding:5px;border-bottom:1px solid #000}'+
   '#viaImp td{padding:4px 5px;border-bottom:1px solid #ddd}'+
   '#viaImp th:nth-child(n+2),#viaImp td:nth-child(n+2){text-align:right}'+
   '#viaImp tfoot td{font-weight:700;border-top:2px solid #000;font-size:13px}</style>'+
   '<div class="cab"><h2>Pedido de Base #'+String(p.numero||0).padStart(4,'0')+'</h2>'+
    '<div class="lin"><b>Cliente:</b> '+E(p.sucursalNome||'-')+
      (cidade?' &nbsp; <b>Cidade:</b> '+E(cidade):'')+'</div>'+
    '<div class="lin"><b>Data:</b> '+E(dataBR(p.data))+
      ' &nbsp; <b>Situacao:</b> '+E((ROTULO_FASE[p.situacao]||p.situacao||'-'))+
      (p.responsavel&&String(p.responsavel).trim()!==String(p.sucursalNome||'').trim()
        ?' &nbsp; <b>Responsavel:</b> '+E(p.responsavel):'')+'</div>'+
    (p.obs?'<div class="lin"><b>Observacao:</b> '+E(p.obs)+'</div>':'')+
    '<div class="lin" style="color:#555">Emitido em '+
      new Date().toLocaleString('pt-BR')+'</div></div>'+
   (linhas
    ? '<table><thead><tr><th>Base</th><th>Qtd.</th><th>Valor unit.</th>'+
      '<th>Total</th></tr></thead><tbody>'+linhas+'</tbody>'+
      '<tfoot><tr><td colspan="3">Total do pedido</td>'+
      '<td>R$ '+money(p.total)+'</td></tr></tfoot></table>'
    : '<div class="lin">A lista de itens nao esta neste aparelho — total do '+
      'pedido: <b>R$ '+money(p.total)+'</b>.</div>');
  document.body.appendChild(el);
  setTimeout(function(){window.print();},250);
}
function verPedidoBase(id){
  var p = basePedidos().find(function (x) { return x.id === id; });
  if (!p) { toast('Pedido não encontrado neste aparelho.'); return; }
  var itens = p.itens || [];
  var h = '<div class="mdB">' +
   '<div class="acHead"><div class="av3" style="width:40px;height:40px">' +
    sv('box', 18) + '</div><div><b>Pedido #' + String(p.numero || 0).padStart(4, '0') + '</b>' +
    /* o responsavel costuma vir gravado com o nome da propria unidade —
       escrever "Santa Fe do Sul · Santa Fe do Sul" so parece defeito */
    '<span>' + E(dataBR(p.data)) + ' · ' + E(p.sucursalNome || '—') +
    (p.responsavel && String(p.responsavel).trim() !== String(p.sucursalNome || '').trim()
      ? ' · ' + E(p.responsavel) : '') + ' · R$ ' + money(p.total) +
    '</span><span class="pbSit">' + seloPedBase(p.situacao) + '</span></div></div>' +
   (p.obs ? '<div class="pbObs"><b>Observação da unidade</b><span>' +
     E(p.obs) + '</span></div>' : '') +
   (itens.length
    ? '<div class="blk" style="margin:0;max-width:none;padding:0;overflow:hidden">' +
      '<div class="acTabW" style="max-height:360px"><table class="acTab pbTabPed"><thead><tr>' +
       '<th>Base</th><th style="width:110px;text-align:right">Quantidade</th>' +
       '<th style="width:120px;text-align:right">Valor da unidade</th>' +
       '<th style="width:120px;text-align:right">Total</th></tr></thead><tbody>' +
       itens.map(function (it) {
         var q = unidadesDoItem(it);
         var vu = precoUnitDoItem(it);
         return '<tr><td><b>' + E(it.baseNome || it.nome || '—') + '</b>' +
          '<span class="pbUn">R$ ' + money(vu) + ' a unidade</span></td>' +
          '<td style="text-align:right">' + fmtQt(q) + '</td>' +
          '<td style="text-align:right">R$ ' + money(vu) + '</td>' +
          '<td style="text-align:right"><b>R$ ' + money(Number(it.total) || q * vu) +
          '</b></td></tr>';
       }).join('') + '</tbody></table></div>' +
      /* o total fora da tabela: dentro dele era uma celula com `colspan`,
         e no celular, com uma coluna escondida, a conta do colspan
         deixava a tabela mais estreita que a caixa */
      '<div class="pbTotPed"><span>Total do pedido</span>' +
      '<b>R$ ' + money(p.total) + '</b></div></div>'
    /* ==========================================================
       LISTA QUE NAO CHEGOU: TRES LINHAS, EM PORTUGUES DE GENTE

       A primeira versao desta tela explicava o defeito: citava a versao,
       a chave do upsert e o Ctrl+Shift+R. O Rafael abriu e respondeu
       "E SERIO ISSO?". Estava certo: tela de loja nao e relatorio
       tecnico, e a regra da casa e zero texto tecnico na tela.

       O que a matriz precisa saber cabe em tres linhas: de quem e o
       pedido, quanto vale, e que a lista chega sozinha. Nada do que ela
       tem de fazer — porque nao ha nada que ela possa fazer daqui.
       ========================================================== */
    : '<div class="pbVazio">' +
      '<b>A lista de bases ainda não chegou aqui.</b>' +
      '<span>Ela está no computador que fez o pedido e sobe sozinha ' +
      'quando aquela loja abrir o sistema.</span></div>') +
   '</div>';
  var o = document.createElement('div');
  o.className = 'mdOv'; o.id = 'mdOv';
  o.innerHTML = '<div class="mdBox lg"><div class="mdH"><b>Pedido de base</b>' +
   '<button onclick="fecharModal()">&times;</button></div>' + h +
   '<div class="mdF"><button class="btnP2" onclick="fecharModal()">Fechar</button>'+
   '<button class="btnVerde" onclick="imprimirPedidoBase(\''+p.id+'\')">'+
    sv('print',13)+' Imprimir / PDF</button></div></div>';
  document.body.appendChild(o);
  fecharSoForaDeVerdade(o);
}
function mudarQtdPedido(id, v){
  var q = Math.max(0, Math.floor(Number(v) || 0));
  if (q > 0) PB.itens[id] = q; else delete PB.itens[id];
  PB.erro = '';
  /* redesenha só os totais: refazer a tela a cada dígito faria o campo
     perder o foco no meio da digitação */
  var tot = totalPedidoAtual();
  var n = Object.keys(PB.itens).length;
  var el = document.querySelector('.pbTot');
  if (el) el.innerHTML = '<span>' + n + ' item(ns)</span>' +
    '<b>Total: R$ ' + money(tot) + '</b>';
  var b = baseCatalogo().find(function (x) { return x.id === id; });
  if (b) {
    var linha = document.querySelector('input[oninput*="' + id + '"]');
    if (linha) {
      var tr = linha.closest('tr');
      if (tr) {
        tr.className = q > 0 ? 'pbSel' : '';
        var td = tr.lastElementChild;
        var vCx = (Number(b.qtdCaixa) || 1) * (Number(b.valorUnit) || 0);
        if (td) td.innerHTML = q > 0
          ? '<b class="bsVlr">R$ ' + money(q * vCx) + '</b>'
          : '<span style="color:var(--ink-3)">—</span>';
      }
    }
  }
  rodape(n ? ('pedido em aberto — R$ ' + money(tot)) : 'nenhum item selecionado');
}
function limparPedidoBase(){
  PB.itens = {}; PB.erro = '';
  telaPedidoBase();
}

async function enviarPedidoBase(){
  PB.erro = '';
  var esc = [];
  basesAtivas().forEach(function (b) {
    var q = Number(PB.itens[b.id]) || 0;
    if (q <= 0) return;
    var vCx = (Number(b.qtdCaixa) || 1) * (Number(b.valorUnit) || 0);
    esc.push({ id: uid('pbi'), baseRef: b.id, baseNome: b.nome,
               fichaRef: b.fichaRef || '', qtd: q, valorUnit: vCx, total: q * vCx,
               /* ==========================================================
                  A CAIXA VIAJA JUNTO COM O PEDIDO

                  O pedido e feito em CAIXAS. Producao, saida do estoque da
                  matriz e entrada no estoque da loja trabalham na unidade da
                  ficha. Sem o tamanho da caixa gravado aqui, a conversao
                  teria de ir buscar no catalogo — e o catalogo muda: bastava
                  a matriz corrigir o "Qtde/cx" de uma base para um pedido
                  antigo passar a valer outra quantidade.

                  Fica gravado no item, no momento do envio, junto com o preco
                  por unidade. O que foi pedido nao muda depois.
                  ========================================================== */
               porCaixa: Number(b.qtdCaixa) || 1, precoUnit: Number(b.valorUnit) || 0 });
  });
  if (!esc.length) { PB.erro = 'Informe a quantidade de ao menos um item.'; return telaPedidoBase(); }
  if (!String(PB.responsavel || '').trim()) {
    PB.erro = 'Informe o responsável pelo pedido.'; return telaPedidoBase();
  }
  var total = esc.reduce(function (a, i) { return a + i.total; }, 0);
  var ok = await confirmar({
    titulo: 'Enviar o pedido à matriz?',
    texto: esc.length + ' item(ns) — R$ ' + money(total),
    linhas: esc.slice(0, 8).map(function (i) {
      return [i.baseNome, fmtQt(i.qtd) + ' cx', 'R$ ' + money(i.total)];
    }),
    aviso: 'Depois de enviado, alterações passam pela matriz.',
    ok: 'Enviar pedido'
  });
  if (!ok) return;
  basePedidos();
  DB.pedidosBase.push({
    id: uid('pb'), numero: proxNumPedBase(),
    sucursalRef: lojaAtualId(), sucursalNome: sucNome(lojaAtualId()),
    data: PB.data || hojeISO(),
    responsavel: String(PB.responsavel).trim(),
    obs: PB.obs || '', total: total, itens: esc,
    situacao: 'enviado', enviadoEm: new Date().toISOString(),
    produzido: false, entradaEstoque: false
  });
  PB.itens = {}; PB.obs = ''; PB.busca = '';
  salvar();
  toast('Pedido enviado à matriz.');
  try { pintarSino(); } catch (e) { _quieto(e, 'enviarPedidoBase'); }
  telaPedidoBase();
}

/* selo de situação do pedido de base — usado aqui e na tela da matriz.
   NAO se chama selo(): ja existe uma funcao com esse nome no sistema, e a
   minha, por vir depois no arquivo, teria sobrescrito a original e quebrado
   as telas que a usam. A verificacao antes de publicar pegou isso. */
function seloPedBase(sit){
  var m = {
    rascunho:       ['Rascunho', ''],
    enviado:        ['Aguardando', 'am'],
    confirmado:     ['Confirmado', 'az'],
    enviado_matriz: ['Enviado pela matriz', 'az'],
    entregue:       ['Entregue', 'vd'],
    pago:           ['Pago', 'vd'],
    rejeitado:      ['Rejeitado', 'vr']
  }[sit] || [sit || '—', ''];
  return '<span class="pill ' + m[1] + '">' + E(m[0]) + '</span>';
}

var BS = { busca: '', sohAtivos: false, sujo: false };

function baseCatalogo(){ DB.basesCat = DB.basesCat || []; return DB.basesCat; }

/* ==========================================================
   FICHA NOVA CHAMADA "BASE <SABOR>" JA NASCE NO CATALOGO DE PEDIDO

   O combinado da casa e esse: a ficha de uma base se chama BASE e o sabor,
   tudo em maiuscula. Entao o proprio nome serve de gatilho — nao precisa de
   campo novo na tela nem de a pessoa lembrar de cadastrar a mesma coisa duas
   vezes, em duas telas diferentes. Cadastrar duas vezes e como o vinculo
   entre a base e a ficha deixava de existir, e sem vinculo nao ha baixa de
   estoque nenhuma.

   Nasce INATIVA de proposito. Sem preco, a unidade pediria a R$ 0,00 e a
   cobranca nasceria zerada — erro silencioso, do tipo que so aparece no
   fechamento do mes. A matriz poe o valor e muda para Ativa; a tela de Bases
   e Valores avisa em cima quantas estao esperando isso.
   ========================================================== */
function ehNomeDeBase(nome){
  var n = String(nome || '').trim();
  return /^BASE\s+\S/.test(n) && n === n.toUpperCase();
}
function baseDeFichaNova(f){
  if (!f || !ehNomeDeBase(f.nome)) return null;
  baseCatalogo();
  var nome = String(f.nome).trim();
  var ja = DB.basesCat.find(function (b) {
    return b.fichaRef === f.id ||
           String(b.nome || '').trim().toUpperCase() === nome.toUpperCase();
  });
  /* ja existia pelo nome mas solta: aproveita e amarra na ficha */
  if (ja) { if (!ja.fichaRef) ja.fichaRef = f.id; return null; }
  var b = { id: uid('bc'), nome: nome, qtdCaixa: 1, valorUnit: 0,
            fichaRef: f.id, ativo: false, ordem: 0 };
  DB.basesCat.push(b);
  return b;
}
/* "esperando preco" nao e um campo: e o estado de quem nasceu assim. Campo
   novo nao sobreviveria a sincronizacao — a tabela da nuvem nao tem coluna
   para ele, e a base voltaria de la sem a marca. */
function basesEsperandoPreco(){
  return baseCatalogo().filter(function (b) {
    return b.ativo === false && b.fichaRef && !(Number(b.valorUnit) > 0);
  });
}

function telaBasesValores(){
  if (!ehMatriz() && !ehPlataforma()) return telaRestrita('Central de Bases e Valores');
  baseFicha(); baseCatalogo();
  var lista = baseCatalogo().slice();
  if (BS.sohAtivos) lista = lista.filter(function (b) { return b.ativo !== false; });
  var q = (BS.busca || '').toLowerCase();
  if (q) lista = lista.filter(function (b) {
    return String(b.nome || '').toLowerCase().indexOf(q) >= 0;
  });
  lista.sort(function (a, b) {
    return String(a.nome || '').localeCompare(String(b.nome || ''));
  });
  var ativos = baseCatalogo().filter(function (b) { return b.ativo !== false; }).length;
  var semFicha = baseCatalogo().filter(function (b) {
    return b.ativo !== false && !b.fichaRef;
  }).length;
  var fichas = (DB.fichas || []).slice().sort(function (a, b) {
    return String(a.nome || '').localeCompare(String(b.nome || ''));
  });

  $('content').innerHTML = '<div class="etWrap"><div class="etScroll">' +
   '<div class="etTopo"><div><h1>Central de Bases e Valores</h1>' +
   '<p>A matriz define nome, valor e disponibilidade. As unidades enxergam ' +
   'esta tabela ao fazer o pedido.</p></div>' +
   '<span id="bsSalvar">' + htmlBotaoSalvarBases() + '</span>' +
   '</div>' +

   '<div class="hpNums" style="border:1px solid var(--line);border-radius:8px;' +
    'overflow:hidden;margin-bottom:12px">' +
    '<div class="hpN"><span>Bases ativas</span><b>' + ativos + '</b></div>' +
    '<div class="hpN"><span>Inativas</span><b>' +
      (baseCatalogo().length - ativos) + '</b></div>' +
    '<div class="hpN"><span>Sem ficha técnica</span><b class="' +
      (semFicha ? 'am' : '') + '">' + semFicha + '</b></div>' +
   '</div>' +

   (function(){
     var esp = basesEsperandoPreco();
     if (!esp.length) return '';
     return '<div class="bsAviso">' + sv('help', 14) +
      '<div><b>' + esp.length + ' base(s) vieram de fichas técnicas novas e ' +
      'estão esperando o preço.</b> Enquanto o valor for zero elas ficam ' +
      'inativas e as unidades não as veem: ' +
      esp.slice(0, 8).map(function (b) { return E(b.nome); }).join(' · ') +
      (esp.length > 8 ? ' …' : '') + '</div></div>';
   })() +

   (semFicha
     ? '<div class="bsAviso">' + sv('help', 14) +
       '<div><b>' + semFicha + ' base(s) ativa(s) sem ficha técnica.</b> ' +
       'O pedido e o financeiro funcionam. A baixa de estoque na produção só ' +
       'acontece depois que a ficha for cadastrada e ligada aqui.</div></div>'
     : '') +

   '<div class="lbBarra">' +
    '<div class="lbBusca">' + sv('search', 14) +
     '<input value="' + E(BS.busca) + '" placeholder="Buscar base" ' +
     'oninput="BS.busca=this.value;clearTimeout(window._bsT);' +
     'window._bsT=setTimeout(telaBasesValores,250)"></div>' +
    '<label class="flagBox" style="white-space:nowrap"><input type="checkbox"' +
     (BS.sohAtivos ? ' checked' : '') +
     ' onchange="BS.sohAtivos=this.checked;telaBasesValores()"> só ativas</label>' +
    '<div style="flex:1"></div>' +
    '<button class="btnP2" onclick="novaBase()">' + sv('plus', 12) +
     ' Adicionar base</button>' +
   '</div>' +

   (lista.length
    ? '<div class="lbTabW bvTabW"><table class="pTable bvTab"><thead><tr>' +
      '<th>Nome da base</th>' +
      '<th style="width:200px">Ficha técnica</th>' +
      '<th style="width:92px;text-align:right">Qtde/cx</th>' +
      '<th style="width:110px;text-align:right">Valor unitário</th>' +
      '<th style="width:120px;text-align:right">Valor da caixa</th>' +
      '<th style="width:104px">Situação</th><th style="width:46px"></th>' +
      '</tr></thead><tbody>' +
      lista.map(function (b) {
        var vlrCx = (Number(b.qtdCaixa) || 1) * (Number(b.valorUnit) || 0);
        return '<tr data-bid="' + b.id + '">' +
         '<td><input class="bsIn" value="' + E(b.nome) + '" ' +
           'onchange="mudarBase(\'' + b.id + '\',\'nome\',this.value)"></td>' +
         '<td><select class="bsIn" onchange="mudarBase(\'' + b.id +
           '\',\'fichaRef\',this.value)">' +
           '<option value="">— sem ficha —</option>' +
           fichas.map(function (f) {
             return '<option value="' + f.id + '"' +
               (b.fichaRef === f.id ? ' selected' : '') + '>' + E(f.nome) + '</option>';
           }).join('') + '</select>' +
           '<div class="bsDica" data-bid="' + b.id + '">' +
           (!b.fichaRef && b.ativo !== false
             ? '<span class="hint" style="color:var(--amber)">sem baixa de estoque</span>'
             : '') + '</div></td>' +
         '<td><input class="bsIn nu" type="number" step="0.001" value="' +
           E(b.qtdCaixa) + '" onchange="mudarBase(\'' + b.id +
           '\',\'qtdCaixa\',this.value)"></td>' +
         '<td><input class="bsIn nu" type="number" step="0.01" value="' +
           E(b.valorUnit) + '" onchange="mudarBase(\'' + b.id +
           '\',\'valorUnit\',this.value)"></td>' +
         '<td style="text-align:right"><b class="bsVlr">R$ ' + money(vlrCx) + '</b></td>' +
         '<td><select class="bsIn" onchange="mudarBase(\'' + b.id +
           '\',\'ativo\',this.value)">' +
           '<option value="1"' + (b.ativo !== false ? ' selected' : '') + '>Ativa</option>' +
           '<option value="0"' + (b.ativo === false ? ' selected' : '') + '>Inativa</option>' +
           '</select></td>' +
         '<td><button class="rBtn" title="Excluir" onclick="excluirBase(\'' + b.id +
           '\')">' + sv('trash', 12) + '</button></td>' +
        '</tr>';
      }).join('') + '</tbody></table></div>'
    : '<div class="entVazio"><b>' +
      (q ? 'Nada encontrado' : 'Nenhuma base cadastrada') + '</b><span>' +
      (q ? 'Tente outro nome.' : 'Comece adicionando a primeira base.') +
      '</span></div>') +
  '</div></div>';
  rodape(baseCatalogo().length + ' base(s) no catálogo');
}

function novaBase(){
  baseCatalogo();
  DB.basesCat.push({ id: uid('bc'), nome: 'Nova base', qtdCaixa: 1,
                     valorUnit: 0, fichaRef: '', ativo: true, ordem: 0 });
  BS.sujo = true;
  telaBasesValores();
}
/* o botao "Salvar alteracoes" (ou "tudo salvo"), montado a parte para poder
   ser trocado sem redesenhar a tela */
function htmlBotaoSalvarBases(){
  return BS.sujo
    ? '<button class="btnVerde" onclick="salvarBases()">' + sv('save', 13) +
      ' Salvar alterações</button>'
    : '<span class="bsOk">' + sv('check', 13) + ' tudo salvo</span>';
}
/* ==========================================================
   A TELA NAO PODE TREMER A CADA CLIQUE

   O Rafael, 02/09/2026, ligando a ficha tecnica a cada base: "a hora que
   clico a tela fica tremendo, e a selecao some sozinha".

   `mudarBase` redesenhava a TELA INTEIRA (`telaBasesValores`) a cada
   digito e a cada escolha de ficha. Redesenhar destroi o proprio <select>
   que estava sendo usado — dai o tremor, e a escolha parecia "voltar"
   porque o elemento era recriado no meio do clique. Sao 50 bases: montar
   a tabela toda de novo a cada tecla trava.

   Agora nada de redesenho. O dado e atualizado, e so o que muda na tela e
   tocado: o valor da caixa daquela linha, a dica de "sem baixa" daquela
   base, e o botao de salvar la em cima. O <select> que a pessoa esta
   usando nao e tocado.
   ========================================================== */
function mudarBase(id, campo, valor){
  var b = baseCatalogo().find(function (x) { return x.id === id; });
  if (!b) return;
  if (campo === 'ativo') b.ativo = (valor === '1');
  else if (campo === 'qtdCaixa' || campo === 'valorUnit')
    b[campo] = Number(String(valor).replace(',', '.')) || 0;
  else b[campo] = valor;
  var eraSujo = BS.sujo;
  BS.sujo = true;

  /* o valor da caixa daquela linha */
  if (campo === 'qtdCaixa' || campo === 'valorUnit') {
    var vlr = (Number(b.qtdCaixa) || 1) * (Number(b.valorUnit) || 0);
    var cel = document.querySelector('tr[data-bid="' + id + '"] .bsVlr');
    if (cel) cel.textContent = 'R$ ' + money(vlr);
  }
  /* a dica de "sem baixa de estoque" daquela base (some quando liga a ficha) */
  if (campo === 'fichaRef' || campo === 'ativo') {
    var dica = document.querySelector('.bsDica[data-bid="' + id + '"]');
    if (dica) dica.innerHTML = (!b.fichaRef && b.ativo !== false)
      ? '<span class="hint" style="color:var(--amber)">sem baixa de estoque</span>' : '';
  }
  /* o botao de salvar, so quando o estado muda de "salvo" para "sujo" */
  if (!eraSujo) {
    var bt = document.getElementById('bsSalvar');
    if (bt) bt.innerHTML = htmlBotaoSalvarBases();
  }
}
async function excluirBase(id){
  var b = baseCatalogo().find(function (x) { return x.id === id; });
  if (!b) return;
  /* base já usada em pedido não se apaga: o histórico ficaria sem o nome */
  var usada = (DB.pedidosBase || []).some(function (p) {
    return (p.itens || []).some(function (i) { return i.baseRef === id; });
  });
  if (usada) {
    await confirmar({
      titulo: 'Esta base já foi pedida',
      texto: 'Apagar deixaria os pedidos antigos sem o nome dela.',
      aviso: 'Marque como <b>Inativa</b>: ela some da tela de pedido e o ' +
             'histórico continua correto.',
      ok: 'Entendi', cancelar: null
    });
    return;
  }
  var ok = await confirmar({
    titulo: 'Excluir "' + b.nome + '"?',
    texto: 'Ela sai do catálogo e as unidades deixam de vê-la.',
    ok: 'Excluir', tipo: 'perigo'
  });
  if (!ok) return;
  DB.basesCat = DB.basesCat.filter(function (x) { return x.id !== id; });
  BS.sujo = true;
  salvarBases();
}
function salvarBases(){
  var vazias = baseCatalogo().filter(function (b) {
    return !String(b.nome || '').trim();
  });
  if (vazias.length) { toast('Há base sem nome. Preencha antes de salvar.'); return; }
  /* nome repetido quebra o índice único do banco e a sincronização para */
  var vis = {}, dup = [];
  baseCatalogo().forEach(function (b) {
    var k = String(b.nome || '').trim().toLowerCase();
    if (vis[k]) dup.push(b.nome); else vis[k] = 1;
  });
  if (dup.length) { toast('Nome repetido: ' + dup[0] + '. Cada base precisa de um nome próprio.'); return; }
  BS.sujo = false;
  salvar();
  toast('Catálogo salvo — as unidades já veem a tabela nova.');
  telaBasesValores();
}

var BX={busca:'', item:null, qtd:'', unidade:'', motivo:'', quem:'',
        obs:'', data:'', erro:'', filtro:'pendente', editando:null};

function baseBaixas(){ DB.baixasPend = DB.baixasPend || []; return DB.baixasPend; }

/* tudo que pode sofrer baixa: insumos, fichas técnicas e produtos do PDV */
function itensParaBaixa(){
  var out = [];
  (DB.insumos || []).forEach(function (i) {
    out.push({ id: i.id, nome: i.nome, tipo: 'insumo',
               unidade: i.unidade || 'un', custo: custoDoItem(i) });
  });
  (DB.fichas || []).forEach(function (f) {
    out.push({ id: f.id, nome: f.nome, tipo: 'ficha',
               unidade: f.unidade || 'un', custo: custoDoItem(f) });
  });
  return out;
}
/* ==========================================================
   PROCURAR ITEM: SEM ACENTO, EM QUALQUER ORDEM, DUAS LETRAS

   O Rafael, em 01/09/2026: "quando eu digito gelato venda, que e o que
   esta vinculado a ficha tecnica dos produtos, nao aparece".

   Eram tres travas somadas. Exigia TRES letras antes de procurar; casava
   so o pedaco exato, entao "venda gelato" nao achava "GELATO VENDA"; e
   parava nos 8 primeiros — a loja tem 61 itens com "gelato" no nome, e
   "GELATO VENDA" e o ultimo deles em ordem de cadastro.

   Agora: duas letras bastam, acento nao atrapalha ("tentacao" acha
   "TENTAÇÃO"), cada palavra digitada e procurada por conta propria em
   qualquer ordem, e quem COMECA com o que foi digitado sobe para o topo
   da lista. Doze resultados.
   ========================================================== */
function _semAcento(t){
  t = String(t == null ? '' : t).toLowerCase();
  try { return t.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
  catch (e) { return t; }
}
function buscarItensBaixa(txt){
  var alvo = _semAcento(txt).trim();
  if (alvo.length < 2) return [];
  var palavras = alvo.split(/\s+/).filter(Boolean);
  var achados = [];
  itensParaBaixa().forEach(function (i) {
    var nome = _semAcento(i.nome);
    for (var p = 0; p < palavras.length; p++)
      if (nome.indexOf(palavras[p]) < 0) return;
    /* peso 0 = comeca com o que foi digitado; 1 = so contem */
    achados.push({ it: i, peso: nome.indexOf(alvo) === 0 ? 0 : (nome.indexOf(alvo) > 0 ? 1 : 2) });
  });
  achados.sort(function (a, b) {
    return a.peso - b.peso || String(a.it.nome).localeCompare(String(b.it.nome));
  });
  return achados.slice(0, 12).map(function (a) { return a.it; });
}
/* o HTML da listinha, para desenhar sem refazer a tela */
function sugestoesBaixaHTML(){
  var sug = BX.item ? [] : buscarItensBaixa(BX.busca);
  if (!sug.length) return '';
  return sug.map(function (i) {
    return '<div onclick="escolherItemBaixa(\'' + i.id + '\',\'' + i.tipo + '\')">' +
      E(i.nome) + '<span class="bxTg ' + (i.tipo === 'ficha' ? 'f' : '') + '">' +
      (i.tipo === 'ficha' ? 'ficha' : 'insumo') + '</span></div>';
  }).join('');
}
/* ==========================================================
   DIGITAR SEM PERDER O CURSOR

   O Rafael: "aonde eu digito produto ou insumo, eu digito uma letra e
   tenho que ficar clicando em cima".

   O campo chamava `telaBaixaManual` a cada tecla. Essa funcao reescreve
   o `content` inteiro — o `<input>` que estava sendo digitado deixa de
   existir e o foco volta para o corpo da pagina. Uma letra por clique.

   Aqui so a listinha e redesenhada. O campo continua sendo o mesmo
   elemento, com o cursor onde estava.
   ========================================================== */
function sugerirItemBaixa(el){
  BX.item = null;
  BX.busca = el.value;
  var cx = document.getElementById('bxSug');
  if (cx) cx.innerHTML = sugestoesBaixaHTML();
}
/* os últimos nomes digitados, para não redigitar toda vez */
function quemJaRegistrou(){
  var vis = {}, out = [];
  baseBaixas().forEach(function (b) {
    var q = String(b.quem || '').trim();
    if (q && !vis[q.toLowerCase()]) { vis[q.toLowerCase()] = 1; out.push(q); }
  });
  return out.slice(0, 8);
}

function baixasDoFiltro(){
  var l = baseBaixas().slice();
  if (BX.filtro === 'pendente') l = l.filter(function (b) { return b.situacao !== 'lancada'; });
  else if (BX.filtro === 'lancada') l = l.filter(function (b) { return b.situacao === 'lancada'; });
  l.sort(function (a, b) {
    return String(b.data + (b.hora || '')).localeCompare(String(a.data + (a.hora || '')));
  });
  return l;
}

function telaBaixaManual(){
  baseMov(); baseBaixas();
  if (!BX.data) BX.data = hojeISO();
  if (!BX.quem) BX.quem = (usuarioLogado() || {}).nome || '';
  var motivos = motivosBaixa();
  var lista = baixasDoFiltro();
  var pend = baseBaixas().filter(function (b) { return b.situacao !== 'lancada'; });
  var totPend = pend.reduce(function (a, b) {
    return a + (Number(b.qtd) || 0) * (Number(b.custo) || 0);
  }, 0);

  $('content').innerHTML = '<div class="etWrap"><div class="etScroll">' +
   '<div class="etTopo"><div><h1>Baixa Manual</h1>' +
   '<p>Registre a perda na hora que acontece. Nada sai do estoque até você ' +
   'lançar — sozinho ou tudo de uma vez no fim do dia.</p></div>' +
   '<button class="infoBt" onclick="explicaBaixaManual()">' + sv('help', 15) + '</button></div>' +

   (!motivos.length
     ? '<div class="entVazio"><b>Nenhum motivo cadastrado</b>' +
       '<span>O motivo diz por que a mercadoria saiu — perda, quebra, ' +
       'vencimento, consumo interno. Cadastre o primeiro para começar.</span>' +
       '<button class="btnVerde" style="margin-top:12px" ' +
        'onclick="novoMotivoDaBaixa()">' + sv('plus', 13) +
        ' Cadastrar motivo</button></div>'
     :
    /* ---------- formulário ---------- */
    '<div class="blk" style="max-width:none">' +
     '<div class="blkH"><b>' + (BX.editando ? 'Editar registro' : 'Registrar baixa') + '</b>' +
      '<span>' + (BX.editando ? 'alterando um registro já anotado'
                              : 'ainda não sai do estoque') + '</span></div>' +
     (BX.erro ? '<div class="avisoIn">' + E(BX.erro) + '</div>' : '') +
     '<div class="bxLin4">' +
      '<div class="f2" style="position:relative"><label>Produto ou insumo</label>' +
       '<input id="bxItem" value="' + E(BX.item ? BX.item.nome : BX.busca) + '" ' +
       'placeholder="digite 2 letras do nome" autocomplete="off" ' +
       'oninput="sugerirItemBaixa(this)">' +
       /* o quadro existe sempre, mesmo vazio: e nele que a busca escreve
          sem refazer a tela */
       '<div class="bxSug" id="bxSug">' + sugestoesBaixaHTML() + '</div>' +
      '</div>' +
      '<div class="f2"><label>Quantidade</label>' +
       '<input id="bxQtd" type="number" step="0.001" value="' + E(BX.qtd) + '" ' +
       'oninput="BX.qtd=this.value"></div>' +
      '<div class="f2"><label>Unidade</label>' +
       '<select id="bxUn" onchange="BX.unidade=this.value">' +
        unidades().map(function (u) {
          return '<option value="' + u.id + '"' + (BX.unidade === u.id ? ' selected' : '') +
                 '>' + E(u.ab) + '</option>';
        }).join('') + '</select></div>' +
      '<div class="f2"><label>Motivo</label>' +
       '<div class="bxMotLin">' +
        '<select id="bxMot" onchange="BX.motivo=this.value">' +
         '<option value="">escolha</option>' +
         motivos.map(function (m) {
           return '<option value="' + m.id + '"' + (BX.motivo === m.id ? ' selected' : '') +
                  '>' + E(m.nome) + '</option>';
         }).join('') + '</select>' +
        '<button type="button" class="bxMotNovo" title="Cadastrar um motivo novo" ' +
         'onclick="novoMotivoDaBaixa()">' + sv('plus', 13) + '</button>' +
       '</div></div>' +
     '</div>' +
     '<div class="bxLin3">' +
      '<div class="f2"><label>Data</label>' +
       '<input id="bxData" type="date" value="' + E(BX.data) + '" ' +
       'onchange="BX.data=this.value"></div>' +
      '<div class="f2"><label>Quem registrou</label>' +
       '<input id="bxQuem" value="' + E(BX.quem) + '" list="bxQuemLista" ' +
       'placeholder="nome de quem viu a perda" oninput="BX.quem=this.value">' +
       '<datalist id="bxQuemLista">' +
        quemJaRegistrou().map(function (q) {
          return '<option value="' + E(q) + '">';
        }).join('') + '</datalist>' +
       '<div class="hint">O login do caixa é compartilhado — aqui vai o nome da pessoa.</div>' +
      '</div>' +
      '<div class="f2"><label>Observação — opcional</label>' +
       '<input id="bxObs" value="' + E(BX.obs) + '" ' +
       'placeholder="o que aconteceu" oninput="BX.obs=this.value"></div>' +
     '</div>' +
     '<div class="bxAcoes">' +
      (BX.editando
        ? '<button class="btnP2" onclick="cancelarEdicaoBaixa()">Cancelar</button>' +
          '<button class="btnVerde" onclick="salvarBaixa()">Salvar alteração</button>'
        : '<button class="btnVerde" onclick="salvarBaixa()">' + sv('plus', 13) +
          ' Salvar registro</button>') +
     '</div>' +
    '</div>') +

   /* ---------- lista ---------- */
   '<div class="blk" style="max-width:none;margin-top:14px">' +
    '<div class="blkH"><b>Registros</b>' +
     '<span>' + pend.length + ' aguardando lançamento</span>' +
     '<div style="flex:1"></div>' +
     '<div class="lbSegm">' +
      ['pendente', 'lancada', 'todos'].map(function (f) {
        var rot = f === 'pendente' ? 'A lançar' : (f === 'lancada' ? 'Lançadas' : 'Todas');
        return '<button class="' + (BX.filtro === f ? 'on' : '') + '" ' +
          'onclick="BX.filtro=\'' + f + '\';telaBaixaManual()">' + rot + '</button>';
      }).join('') +
     '</div></div>' +
    (lista.length
      ? '<div class="lbTabW"><table class="pTable"><thead><tr>' +
        '<th style="width:78px">Data</th><th>Item</th>' +
        '<th style="width:96px;text-align:right">Qtd</th>' +
        '<th style="width:150px">Motivo</th><th style="width:130px">Quem</th>' +
        '<th style="width:96px;text-align:right">Custo</th>' +
        '<th style="width:96px">Situação</th><th style="width:86px"></th>' +
        '</tr></thead><tbody>' +
        lista.map(function (b) {
          var lancada = (b.situacao === 'lancada');
          return '<tr>' +
           '<td>' + E(dataBR(b.data)) + '<small style="display:block;color:var(--ink-3)">' +
             E(b.hora || '') + '</small></td>' +
           '<td><b>' + E(b.itemNome) + '</b>' +
             '<span class="bxTg ' + (b.itemTipo === 'ficha' ? 'f' : '') + '">' +
             (b.itemTipo === 'ficha' ? 'ficha' : 'insumo') + '</span></td>' +
           '<td style="text-align:right">' + fmtQt(b.qtd) + ' ' + E(un(b.unidade).ab) + '</td>' +
           '<td>' + E(b.motivoNome || '—') + '</td>' +
           '<td>' + E(b.quem || '—') + '</td>' +
           '<td style="text-align:right">R$ ' +
             money((Number(b.qtd) || 0) * (Number(b.custo) || 0)) + '</td>' +
           '<td><span class="pill ' + (lancada ? 'vd' : 'am') + '">' +
             (lancada ? 'lançada' : 'a lançar') + '</span></td>' +
           '<td>' + (lancada ? '' :
             '<button class="rBtn" title="Editar" onclick="editarBaixa(\'' + b.id + '\')">' +
               sv('edit', 12) + '</button>' +
             '<button class="rBtn" title="Lançar só este" ' +
               'onclick="lancarBaixasNoEstoque(\'' + b.id + '\')">' +
               sv('cr', 12) + '</button>' +
             '<button class="rBtn" title="Excluir" onclick="excluirBaixa(\'' + b.id + '\')">' +
               sv('trash', 12) + '</button>') + '</td>' +
          '</tr>';
        }).join('') + '</tbody></table></div>'
      : '<div class="entVazio"><b>' +
        (BX.filtro === 'lancada' ? 'Nada lançado ainda' : 'Nenhum registro') + '</b>' +
        '<span>' + (BX.filtro === 'lancada'
          ? 'O que for lançado no estoque aparece aqui.'
          : 'Os registros do dia aparecem nesta lista.') + '</span></div>') +
    (pend.length
      ? '<div class="bxRod">' +
        '<div><b>Total a lançar: R$ ' + money(totPend) + '</b>' +
        '<span style="color:var(--ink-3);margin-left:8px">' + pend.length +
        ' registro(s)</span></div><div style="flex:1"></div>' +
        '<button class="btnVerde" onclick="lancarBaixasNoEstoque()">' +
        'Lançar no estoque ' + sv('cr', 12) + '</button></div>'
      : '') +
   '</div>' +
  '</div></div>';
  rodape(pend.length + ' baixa(s) aguardando lançamento');
}

/* ==========================================================
   CADASTRAR O MOTIVO SEM SAIR DA BAIXA

   O Rafael: "coloca um assim, pra mim cadastrar esses motivos; ao
   cadastrar, ja vai aparecer na parte de baixo de todos os motivos".

   O cadastro ja existia, em Configuracao da Loja. O que faltava era o
   caminho: quem estava no meio de um registro tinha de sair da tela,
   procurar a configuracao e voltar — perdendo o que ja tinha digitado.
   Agora e o mesmo formulario, aberto por cima; ao salvar, a tela volta
   com o motivo novo JA ESCOLHIDO, e ele passa a aparecer tambem no
   filtro do relatorio de Movimentacao de Estoque, que le a mesma lista.
   ========================================================== */
function novoMotivoDaBaixa(){
  formMotivo('', 'saida', function (m) {
    if (m && m.id) BX.motivo = m.id;
    telaBaixaManual();
  });
}
function escolherItemBaixa(id, tipo){
  var i = itensParaBaixa().find(function (x) { return x.id === id && x.tipo === tipo; });
  if (!i) return;
  BX.item = i;
  BX.busca = i.nome;
  if (!BX.unidade) BX.unidade = i.unidade;
  BX.erro = '';
  telaBaixaManual();
}

function salvarBaixa(){
  BX.erro = '';
  if (!BX.item) { BX.erro = 'Escolha o produto ou insumo na lista.'; return telaBaixaManual(); }
  var q = Number(String(BX.qtd).replace(',', '.'));
  if (!q || q <= 0) { BX.erro = 'Informe a quantidade.'; return telaBaixaManual(); }
  if (!BX.motivo) { BX.erro = 'Escolha o motivo.'; return telaBaixaManual(); }
  if (!String(BX.quem || '').trim()) {
    BX.erro = 'Informe quem registrou — é esse nome que responde pela perda.';
    return telaBaixaManual();
  }
  var mot = (DB.motivosMov || []).find(function (m) { return m.id === BX.motivo; });
  baseBaixas();
  if (BX.editando) {
    var b = DB.baixasPend.find(function (x) { return x.id === BX.editando; });
    if (b) {
      b.itemRef = BX.item.id; b.itemNome = BX.item.nome; b.itemTipo = BX.item.tipo;
      b.qtd = q; b.unidade = BX.unidade || BX.item.unidade;
      b.custo = BX.item.custo || 0;
      b.motivoRef = BX.motivo; b.motivoNome = (mot || {}).nome || '';
      b.quem = String(BX.quem).trim(); b.data = BX.data; b.obs = BX.obs;
    }
    BX.editando = null;
  } else {
    DB.baixasPend.push({
      id: uid('bx'), sucursalRef: lojaAtualId(),
      itemRef: BX.item.id, itemNome: BX.item.nome, itemTipo: BX.item.tipo,
      qtd: q, unidade: BX.unidade || BX.item.unidade, custo: BX.item.custo || 0,
      motivoRef: BX.motivo, motivoNome: (mot || {}).nome || '',
      quem: String(BX.quem).trim(),
      registradoPor: (usuarioLogado() || {}).login || '',
      data: BX.data || hojeISO(), hora: agoraHM(),
      obs: BX.obs || '', situacao: 'pendente'
    });
  }
  /* o nome de quem registrou FICA para o próximo — quem está no caixa é o
     mesmo o dia inteiro, e redigitar a cada perda é o tipo de atrito que faz
     a pessoa voltar para o caderno */
  BX.item = null; BX.busca = ''; BX.qtd = ''; BX.obs = ''; BX.erro = '';
  salvar();
  toast('Registrado.');
  telaBaixaManual();
  setTimeout(function () { var e = $('bxItem'); if (e) e.focus(); }, 60);
}

function editarBaixa(id){
  var b = baseBaixas().find(function (x) { return x.id === id; });
  if (!b || b.situacao === 'lancada') return;
  BX.editando = id;
  BX.item = { id: b.itemRef, nome: b.itemNome, tipo: b.itemTipo,
              unidade: b.unidade, custo: b.custo };
  BX.busca = b.itemNome; BX.qtd = b.qtd; BX.unidade = b.unidade;
  BX.motivo = b.motivoRef; BX.quem = b.quem; BX.data = b.data; BX.obs = b.obs || '';
  BX.erro = '';
  telaBaixaManual();
}
function cancelarEdicaoBaixa(){
  BX.editando = null; BX.item = null; BX.busca = ''; BX.qtd = ''; BX.obs = ''; BX.erro = '';
  telaBaixaManual();
}
async function excluirBaixa(id){
  var b = baseBaixas().find(function (x) { return x.id === id; });
  if (!b) return;
  var ok = await confirmar({
    titulo: 'Excluir este registro?',
    texto: b.itemNome + ' — ' + fmtQt(b.qtd) + ' ' + un(b.unidade).ab,
    aviso: 'Ele ainda não foi para o estoque, então nada será desfeito lá.',
    ok: 'Excluir', tipo: 'perigo'
  });
  if (!ok) return;
  DB.baixasPend = DB.baixasPend.filter(function (x) { return x.id !== id; });
  salvar();
  telaBaixaManual();
}

/* ==========================================================
   LANÇAR AS BAIXAS NO ESTOQUE
   Esta é a ponte entre o caderno e o estoque de verdade. Ela NÃO reimplementa
   a baixa: monta as mesmas linhas e chama aplicarMovimento(), o mesmo caminho
   que a tela de Movimentação usa. Se fosse escrita uma conta paralela aqui, o
   saldo do Controle Diário e o da Movimentação divergiriam com o tempo — e
   descobrir qual dos dois está certo, depois, é impossível.

   Agrupa por motivo: cinco perdas com três motivos viram três movimentações,
   e não uma só com tudo misturado. É o que faz o relatório por motivo ter
   sentido depois.
   ========================================================== */
async function lancarBaixasNoEstoque(sohEsta){
  baseMov(); baseBaixas();
  var pend = baseBaixas().filter(function (b) {
    if (b.situacao === 'lancada') return false;
    return sohEsta ? (b.id === sohEsta) : true;
  });
  if (!pend.length) { toast('Nada a lançar.'); return; }

  /* separa por motivo: cada motivo vira uma movimentação própria */
  var porMotivo = {};
  pend.forEach(function (b) {
    (porMotivo[b.motivoRef] = porMotivo[b.motivoRef] || []).push(b);
  });

  /* monta as linhas antes de perguntar, para poder mostrar o que vai sair */
  var grupos = [], semItem = [];
  Object.keys(porMotivo).forEach(function (mot) {
    var itens = [];
    porMotivo[mot].forEach(function (b) {
      var existe = (b.itemTipo === 'ficha')
        ? (DB.fichas || []).some(function (f) { return f.id === b.itemRef; })
        : (DB.insumos || []).some(function (i) { return i.id === b.itemRef; });
      if (!existe) { semItem.push(b); return; }
      itens.push({ tipo: b.itemTipo, refId: b.itemRef, unidade: b.unidade,
                   qtd: Number(b.qtd) || 0, custo: Number(b.custo) || 0,
                   obs: b.obs || '' });
    });
    if (itens.length) grupos.push({ motivo: mot, itens: itens, baixas: porMotivo[mot] });
  });

  if (semItem.length) {
    await confirmar({
      titulo: 'Item não encontrado no cadastro',
      texto: semItem.length + ' registro(s) apontam para item que não existe mais.',
      linhas: semItem.slice(0, 6).map(function (b) {
        return [b.itemNome, fmtQt(b.qtd) + ' ' + un(b.unidade).ab, ''];
      }),
      aviso: 'Eles ficam pendentes. Corrija o registro ou recadastre o item.',
      ok: 'Entendi', cancelar: null
    });
  }
  if (!grupos.length) return;

  /* nenhuma baixa é aplicada se faltar saldo: metade lançada é pior que nada */
  var todasLinhas = [], porGrupo = [];
  for (var g = 0; g < grupos.length; g++) {
    var ln = montarLinhas(grupos[g].itens, 'saida');
    if (!ln.length) continue;
    porGrupo.push({ g: grupos[g], linhas: ln });
    todasLinhas = todasLinhas.concat(ln);
  }
  if (!todasLinhas.length) {
    toast('Nada a baixar — verifique se os itens controlam estoque.');
    return;
  }
  var falta = faltaEstoque(todasLinhas);
  if (falta.length) { alert(avisoFalta(falta, 'este lançamento')); return; }

  var total = pend.reduce(function (a, b) {
    return a + (Number(b.qtd) || 0) * (Number(b.custo) || 0);
  }, 0);
  var ok = await confirmar({
    titulo: 'Lançar ' + todasLinhas.length + ' item(ns) no estoque?',
    texto: 'O saldo será baixado agora. Depois disso não dá para editar aqui.',
    linhas: porGrupo.map(function (p) {
      return [nomeMotivo(p.g.motivo), p.linhas.length + ' item(ns)', ''];
    }),
    aviso: 'Custo total: <b>R$ ' + money(total) + '</b>',
    ok: 'Lançar no estoque', tipo: 'perigo'
  });
  if (!ok) return;

  var criadas = 0, itensLancados = 0;
  porGrupo.forEach(function (p) {
    var quem = p.g.baixas.map(function (b) { return b.quem; })
      .filter(function (q, i, a) { return q && a.indexOf(q) === i; }).join(', ');
    var mov = {
      id: uid('mv'),
      data: p.g.baixas[0].data || hojeISO(),
      hora: agoraHM(),
      motivoId: p.g.motivo,
      identificacao: 'Controle Diário' + (quem ? ' — ' + quem : ''),
      obs: p.g.baixas.map(function (b) { return b.obs; })
        .filter(Boolean).join(' · '),
      itens: JSON.parse(JSON.stringify(p.g.itens)),
      linhas: p.linhas,
      origem: 'manual'
    };
    DB.movEst.push(mov);
    aplicarMovimento(mov);          /* o MESMO caminho da tela de Movimentação */
    criadas++;
    itensLancados += p.linhas.length;
    p.g.baixas.forEach(function (b) {
      b.situacao = 'lancada';
      b.movRef = mov.id;
      b.lancadaEm = new Date().toISOString();
    });
  });

  salvar();
  toast(itensLancados + ' item(ns) lançados em ' +
        criadas + ' movimentação(ões).');
  telaBaixaManual();
}

/* ==========================================================
   RELATORIO DE BAIXAS
   A pergunta que o franqueado faz e "quanto eu perdi e por que". Entao o
   relatorio soma por MOTIVO e por ITEM — nao lista registro por registro,
   que e o que a propria tela de Baixa Manual ja faz.
   ========================================================== */
var BXR={de:'',ate:'',quem:''};
/* ==========================================================
   RELATORIO DE BAIXAS
   A primeira versao eram tres tabelas cinzas identicas. Numero em tabela
   responde "quanto", mas nao responde "onde esta o problema" — e essa e a
   pergunta do franqueado.
   Agora: barra proporcional em cada linha, para o maior ofensor saltar sem
   precisar comparar numero; o item campeao em destaque; e a leitura em
   frases, nao so em colunas.
   ========================================================== */
function telaRelatorioBaixas(){
  baseBaixas();
  if(!BXR.de){BXR.de=diasAtrasISO(30);BXR.ate=hojeISO();}
  var l=baseBaixas().filter(function(b){
    if(BXR.de&&b.data<BXR.de)return false;
    if(BXR.ate&&b.data>BXR.ate)return false;
    if(BXR.quem&&String(b.quem||'')!==BXR.quem)return false;
    return true;
  });
  var vlr=function(b){return (Number(b.qtd)||0)*(Number(b.custo)||0)};
  var total=l.reduce(function(a,b){return a+vlr(b)},0);
  var lanc=l.filter(function(b){return b.situacao==='lancada'});
  var pend=l.filter(function(b){return b.situacao!=='lancada'});
  var dias=Math.max(1,Math.round((new Date(BXR.ate)-new Date(BXR.de))/86400000)+1);

  function somar(chave){
    var m={};
    l.forEach(function(b){
      var k=String(b[chave]||'—');
      m[k]=m[k]||{n:0,q:0,v:0}; m[k].n++; m[k].q+=Number(b.qtd)||0; m[k].v+=vlr(b);
    });
    return Object.keys(m).map(function(k){return {k:k,d:m[k]}})
      .sort(function(a,b){return b.d.v-a.d.v});
  }
  var porMotivo=somar('motivoNome'), porItem=somar('itemNome'), porQuem=somar('quem');

  /* barra proporcional: o maior ofensor aparece sem precisar ler numero */
  function bloco(titulo,sub,dados,rotulo,cor){
    var maior=dados.length?dados[0].d.v:0;
    return '<div class="bxCard">'+
     '<div class="bxCardH"><b>'+E(titulo)+'</b><span>'+E(sub)+'</span></div>'+
     (dados.length
      ? '<div class="bxLista">'+dados.slice(0,12).map(function(x,i){
          var pc=total?(x.d.v/total*100):0;
          var larg=maior?(x.d.v/maior*100):0;
          return '<div class="bxItem'+(i===0?' top':'')+'">'+
           '<div class="bxItemN"><b>'+E(x.k)+'</b>'+
            '<span>'+x.d.n+' registro'+(x.d.n>1?'s':'')+' · '+
            fmtQt(x.d.q)+' un</span></div>'+
           '<div class="bxBarraW"><div class="bxBarra" style="width:'+larg.toFixed(1)+'%;'+
            'background:'+cor+'"></div></div>'+
           '<div class="bxItemV"><b>R$ '+money(x.d.v)+'</b>'+
            '<span>'+pc.toFixed(0)+'%</span></div>'+
          '</div>';
        }).join('')+
        (dados.length>12?'<div class="bxMais">e mais '+(dados.length-12)+'</div>':'')+
        '</div>'
      : '<div class="entVazio"><b>Sem dados</b><span>Nenhuma baixa neste período.</span></div>')+
    '</div>';
  }

  var campeao=porItem[0], motivoTopo=porMotivo[0];

  $('content').innerHTML='<div class="etWrap"><div class="etScroll">'+
   '<div class="etTopo"><div><h1>Relatório de Baixas</h1>'+
   '<p>Quanto a loja perdeu, por motivo, por item e por pessoa.</p></div></div>'+

   '<div class="lbBarra">'+
    '<div class="f2"><label>De</label><input type="date" value="'+E(BXR.de)+'" '+
     'onchange="BXR.de=this.value;telaRelatorioBaixas()"></div>'+
    '<div class="f2"><label>Até</label><input type="date" value="'+E(BXR.ate)+'" '+
     'onchange="BXR.ate=this.value;telaRelatorioBaixas()"></div>'+
    '<div class="f2"><label>Quem registrou</label>'+
     '<select onchange="BXR.quem=this.value;telaRelatorioBaixas()">'+
      '<option value="">todos</option>'+
      quemJaRegistrou().map(function(q){
        return '<option value="'+E(q)+'"'+(BXR.quem===q?' selected':'')+'>'+E(q)+'</option>';
      }).join('')+'</select></div>'+
    '<div style="flex:1"></div>'+
    (l.length?'<button class="btnP2" onclick="exportarBaixas()">'+sv('down2',12)+
      ' Exportar</button>':'')+
   '</div>'+

   /* ---- o número que importa, grande ---- */
   '<div class="bxTopo">'+
    '<div class="bxTotal">'+
     '<span>PERDIDO NO PERÍODO</span>'+
     '<b>R$ '+money(total)+'</b>'+
     '<i>'+l.length+' registro'+(l.length===1?'':'s')+' em '+dias+' dia'+
      (dias===1?'':'s')+' · média de R$ '+money(total/dias)+' por dia</i>'+
    '</div>'+
    '<div class="bxMini">'+
     '<div class="bxM"><span>Já lançadas</span><b>'+lanc.length+'</b></div>'+
     '<div class="bxM"><span>A lançar</span><b class="'+(pend.length?'am':'')+'">'+
       pend.length+'</b></div>'+
     '<div class="bxM"><span>Pessoas</span><b>'+porQuem.length+'</b></div>'+
    '</div>'+
   '</div>'+

   /* ---- a leitura em frase, não em coluna ---- */
   (l.length?'<div class="bxDestaques">'+
     (campeao?'<div class="bxD"><span>Item que mais pesou</span>'+
       '<b>'+E(campeao.k)+'</b>'+
       '<i>R$ '+money(campeao.d.v)+' · '+
       (total?(campeao.d.v/total*100).toFixed(0):0)+'% de tudo</i></div>':'')+
     (motivoTopo?'<div class="bxD"><span>Principal motivo</span>'+
       '<b>'+E(motivoTopo.k)+'</b>'+
       '<i>R$ '+money(motivoTopo.d.v)+' · '+motivoTopo.d.n+' registro'+
       (motivoTopo.d.n>1?'s':'')+'</i></div>':'')+
    '</div>':'')+

   '<div class="bxGrade">'+
    bloco('Por motivo','onde a perda acontece',porMotivo,'Motivo','var(--red)')+
    bloco('Por item','o que mais se perde',porItem,'Item','var(--acc)')+
    bloco('Por pessoa','quem registrou',porQuem,'Pessoa','var(--blue)')+
   '</div>'+
  '</div></div>';
  rodape('R$ '+money(total)+' em baixas no período');
}

function exportarBaixas(){
  var l=baseBaixas().filter(function(b){
    if(BXR.de&&b.data<BXR.de)return false;
    if(BXR.ate&&b.data>BXR.ate)return false;
    if(BXR.quem&&String(b.quem||'')!==BXR.quem)return false;
    return true;
  });
  var lin=[['Data','Hora','Item','Tipo','Quantidade','Unidade','Motivo',
            'Quem registrou','Custo unitário','Custo total','Situação','Observação']];
  l.forEach(function(b){
    lin.push([dataBR(b.data),b.hora||'',b.itemNome,b.itemTipo,
      fmtQt(b.qtd),un(b.unidade).ab,b.motivoNome||'',b.quem||'',
      money(b.custo),money((Number(b.qtd)||0)*(Number(b.custo)||0)),
      b.situacao==='lancada'?'lançada':'a lançar',b.obs||'']);
  });
  var csv=lin.map(function(r){
    return r.map(function(c){return '"'+String(c).replace(/"/g,'""')+'"'}).join(';');
  }).join('\r\n');
  try{
    var a=document.createElement('a');
    a.href=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}));
    a.download='baixas_'+BXR.de+'_a_'+BXR.ate+'.csv';
    a.click();
    toast('Arquivo gerado.');
  }catch(e){ _quieto(e,'exportarBaixas'); toast('Não consegui gerar o arquivo.'); }
}
function explicaBaixaManual(){
  confirmar({
    titulo: 'Como funciona a baixa manual',
    texto: 'Esta tela substitui o caderno.',
    linhas: [
      ['1. Registre na hora', 'a perda fica anotada, sem sair do estoque', ''],
      ['2. Confira a lista', 'dá para corrigir ou excluir enquanto não lançou', ''],
      ['3. Lance quando quiser', 'um por um, ou tudo de uma vez no fim do dia', '']
    ],
    aviso: 'O nome de quem registrou é digitado de propósito: o login do caixa é ' +
           'compartilhado, e a perda precisa ter um responsável com nome.',
    ok: 'Entendi', tipo: 'info'
  });
}

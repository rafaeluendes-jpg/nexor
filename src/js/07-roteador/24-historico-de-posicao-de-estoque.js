/* ==========================================================
   BLOCO 24 — HISTÓRICO DE POSIÇÃO DE ESTOQUE
   ========================================================== */
var HP={aba:'rastreio',item:'',de:'',ate:'',grupo:'',motivoId:''};
var _focoBusca='';

/* dados de demonstração: bases e sabores */
var _semeando=false;
/* DESATIVADA. Criava 11 insumos e 10 fichas de gelato (Base Iogurte, Base Belga,
   Morango Gelato, Coco Zero Acucar...) em qualquer loja com o cadastro vazio.
   Foi o que encheu a Rafaelos de dados que nao eram dela — nao vieram da Jolo,
   nasceram aqui. Mantida vazia porque varias telas ainda a chamam. */
function semearDemo(){ return; }

/* todas as linhas de movimento, achatadas */
function linhasHist(filtro){
  var out=[];
  (DB.movEst||[]).forEach(function(m){
    if(HP.de&&m.data<HP.de)return;
    if(HP.ate&&m.data>HP.ate)return;
    if(HP.motivoId&&m.motivoId!==HP.motivoId)return;
    (m.linhas||[]).forEach(function(l){
      var ins=itemEstoque(l.insumoId);
      if(HP.grupo&&(!ins||(ins.grupoId!==HP.grupo&&ins.categoriaId!==HP.grupo)))return;
      if(filtro&&l.insumoId!==filtro)return;
      out.push({m:m,l:l,ins:ins});
    });
  });
  return out.sort(function(a,b){return (a.m.data+a.m.hora).localeCompare(b.m.data+b.m.hora)});
}
function destinoLinha(x){
  var l=x.l,m=x.m;
  if(l.fichaNome)return (l.direcao==='entrada'?'produzido a partir de ':'usado em ')+l.fichaNome;
  if(m.origem==='venda')return 'venda no PDV · '+(m.identificacao||'');
  if(m.origem==='contagem')return 'ajuste de contagem';
  return nomeMotivo(m.motivoId);
}

function telaHistPosicao(){
  if(!HP.de){HP.de=diasAtrasISO(60);HP.ate=hojeISO();}
  $('content').innerHTML='<div class="etWrap"><div class="etScroll">'+
   '<div class="etTopo">'+
    '<div><h1>Histórico de Posição de Estoque</h1>'+
    '<p>Rastreio de cada item e ranking do que mais gira.</p></div>'+
    '<div style="flex:1"></div>'+
    '<button class="btnP2" onclick="exportarHist()">'+sv('down2',13)+' Exportar</button>'+
   '</div>'+
   '<div class="hpAbas">'+
    '<button class="hpAba'+(HP.aba==='rastreio'?' on':'')+'" onclick="mudaAbaHP(\'rastreio\')">'+
     '<span class="hpAbaIc">'+sv('search',15)+'</span>'+
     '<span class="hpAbaTx"><b>Rastreio do item</b><small>de onde veio e para onde foi</small></span></button>'+
    '<button class="hpAba'+(HP.aba==='ranking'?' on':'')+'" onclick="mudaAbaHP(\'ranking\')">'+
     '<span class="hpAbaIc">'+sv('chart',15)+'</span>'+
     '<span class="hpAbaTx"><b>Rankings</b><small>o que mais produz, consome e vende</small></span></button>'+
    '<button class="hpAba'+(HP.aba==='geral'?' on':'')+'" onclick="mudaAbaHP(\'geral\')">'+
     '<span class="hpAbaIc">'+sv('list',15)+'</span>'+
     '<span class="hpAbaTx"><b>Linha do tempo</b><small>todos os movimentos do período</small></span></button>'+
   '</div>'+
   '<div class="etFiltros">'+
    '<div class="f2" style="max-width:140px"><label>De</label><input type="date" id="hpDe" value="'+HP.de+'"></div>'+
    '<div class="f2" style="max-width:140px"><label>Até</label><input type="date" id="hpAte" value="'+HP.ate+'"></div>'+
    (HP.aba==='rastreio'
     ?'<div class="f2" style="min-width:230px"><label>Item rastreado</label>'+
      '<input id="hpBusca" list="hpLista" placeholder="digite 3 letras do nome ou o código" '+
      'value="'+E(HP.item?((itemEstoque(HP.item)||{}).nome||''):'')+'" autocomplete="off">'+
      '<datalist id="hpLista">'+
      itensEstoque().slice().sort(function(a,b){return (a.nome||'').localeCompare(b.nome||'')})
        .map(function(i){
          return '<option value="'+E(i.nome)+'">'+E(i.codigo||'')+' · '+
            (ehFicha(i)?'ficha técnica':'insumo')+'</option>';}).join('')+
      '</datalist>'+
      (HP.item?'<button class="limpaBusca" onclick="limparItemHP()">'+sv('x2',11)+' ver todos</button>':'')+
      '</div>'
     :'<div class="f2"><label>Grupo</label><select onchange="HP.grupo=this.value;telaHistPosicao()">'+
      '<option value="">Todos</option>'+
      (DB.gruposIng||[]).map(function(g){return '<option value="'+g.id+'"'+(HP.grupo===g.id?' selected':'')+'>'+E(g.nome)+'</option>'}).join('')+
     '</select></div>')+
    '<div class="f2"><label>Motivo</label><select onchange="HP.motivoId=this.value;telaHistPosicao()">'+
     '<option value="">Todos</option>'+
     (DB.motivosMov||[]).map(function(m){return '<option value="'+m.id+'"'+(HP.motivoId===m.id?' selected':'')+'>'+E(m.nome)+'</option>'}).join('')+
    '</select></div>'+
    '<button class="btnP2 ok" onclick="buscarHist()">'+sv('search',13)+' Buscar</button>'+
   '</div>'+
   (HP.aba==='rastreio'?blocoRastreio():HP.aba==='ranking'?blocoRanking():blocoLinhaTempo())+
   '</div></div>';
  var hb=document.getElementById('hpBusca');
  if(hb){
    hb.oninput=function(){_focoBusca='hpBusca';escolheItemHP(this.value)};
    hb.onchange=function(){escolheItemHP(this.value)};
    if(_focoBusca==='hpBusca'){hb.focus();
      try{hb.setSelectionRange(hb.value.length,hb.value.length)}catch(e){_quieto(e,'telaHistPosicao')}}
  }
  rodape();
}
/* Só filtra quando o item for escolhido de verdade — nome completo ou código.
   Enquanto você digita, a lista continua aberta mostrando tudo que combina. */
function escolheItemHP(txt){
  var t=String(txt||'').trim().toLowerCase();
  if(!t){ if(HP.item){HP.item='';telaHistPosicao();} return; }
  var lista=itensEstoque();
  var achou=lista.find(function(i){return (i.nome||'').toLowerCase()===t})
        || lista.find(function(i){return String(i.codigo||'').toLowerCase()===t});
  if(achou){ if(achou.id!==HP.item){HP.item=achou.id;telaHistPosicao();} return; }
  /* digitou algo que ainda não é um item: mantém a busca aberta */
  if(HP.item){HP.item='';telaHistPosicao();}
}
function limparItemHP(){HP.item='';_focoBusca='';telaHistPosicao();}
function mudaAbaHP(a){HP.aba=a;telaHistPosicao();}
function buscarHist(){HP.de=$('hpDe').value;HP.ate=$('hpAte').value;telaHistPosicao();}

/* ---------- RASTREIO ---------- */
function blocoRastreio(){
  if(!HP.item)return '<div class="mvVazio" style="padding:64px">'+sv('search',26)+
   '<b>Escolha um item para rastrear</b>'+
   '<span>Você verá cada entrada e saída, de onde veio, para onde foi e o saldo após cada movimento.</span></div>';
  var i=itemEstoque(HP.item);
  if(!i)return '';
  var lin=linhasHist(HP.item);
  var ent=lin.filter(function(x){return x.l.direcao==='entrada'});
  var sai=lin.filter(function(x){return x.l.direcao==='saida'});
  function soma(arr){return arr.reduce(function(a,x){
    var q=convUnid(x.l.qtd,x.l.unidade,i.unidade);return a+(q===null?x.l.qtd:q)},0)}
  var qEnt=soma(ent),qSai=soma(sai);
  var vEnt=ent.reduce(function(a,x){return a+x.l.qtd*x.l.custo},0);
  var vSai=sai.reduce(function(a,x){return a+x.l.qtd*x.l.custo},0);
  var ab=un(i.unidade).ab;
  /* saldo retroativo: parte do estoque atual e volta */
  var saldoFinal=Number(i.estoqueAtual)||0;
  var saldos=[],acc=saldoFinal;
  for(var k=lin.length-1;k>=0;k--){
    saldos[k]=acc;
    var q=convUnid(lin[k].l.qtd,lin[k].l.unidade,i.unidade);
    if(q===null)q=lin[k].l.qtd;
    acc=acc-(lin[k].l.direcao==='entrada'?q:-q);
  }
  var saldoInicial=acc;

  /* agrupamento: de onde veio / para onde foi */
  function agrupar(arr,rotulo){
    var m={};
    arr.forEach(function(x){
      var d=rotulo(x);
      var q=convUnid(x.l.qtd,x.l.unidade,i.unidade);
      if(q===null)q=x.l.qtd;
      m[d]=m[d]||{q:0,v:0,n:0};
      m[d].q+=q;m[d].v+=x.l.qtd*x.l.custo;m[d].n++;
    });
    return Object.keys(m).map(function(k2){return {nome:k2,d:m[k2]}})
      .sort(function(a,b){return b.d.q-a.d.q});
  }
  var origens=agrupar(ent,function(x){
    if(x.m.origem==='nota')return 'Nota de entrada'+(x.m.obs?' — '+x.m.obs:'');
    if(String(x.l.origem||'').indexOf('producao')>=0)return 'Produção'+(x.l.fichaNome?' — '+x.l.fichaNome:'');
    return nomeMotivo(x.m.motivoId);
  });
  var dest=agrupar(sai,function(x){
    return x.l.fichaNome||(x.m.origem==='venda'?'Venda no PDV':nomeMotivo(x.m.motivoId));
  });

  function tabelaFluxo(lista,tot,vazio){
    if(!lista.length)return '<div class="hint" style="padding:16px">'+vazio+'</div>';
    return '<table class="hpTab hpFx"><tbody>'+lista.map(function(d){
      var pc=tot?(d.d.q/tot*100):0;
      return '<tr><td><b>'+E(d.nome)+'</b>'+
       '<span class="hpBar"><i style="width:'+Math.min(100,pc)+'%"></i></span></td>'+
       '<td class="hpFxQ"><b>'+fmtQt(d.d.q)+' '+ab+'</b>'+
        '<small>'+pc.toFixed(0)+'% · '+d.d.n+' mov.</small></td>'+
       '<td class="hpFxV">R$ '+money(d.d.v)+'</td></tr>';
    }).join('')+'</tbody></table>';
  }

  return '<div class="hp2Topo">'+
    '<div class="hp2Nome">'+sv('box',17)+'<div><b>'+E(i.nome)+'</b>'+
     '<span>'+un(i.unidade).n+(i.codigo?' · cód. '+E(i.codigo):'')+'</span></div></div>'+
    '<div class="hp2Fluxo">'+
     '<div class="hp2K"><span>Saldo no início</span><b>'+fmtQt(saldoInicial)+' '+ab+'</b></div>'+
     '<div class="hp2Seta">'+sv('cr',13)+'</div>'+
     '<div class="hp2K vg2"><span>Entrou</span><b>+'+fmtQt(qEnt)+' '+ab+'</b><small>R$ '+money(vEnt)+'</small></div>'+
     '<div class="hp2Seta">'+sv('cr',13)+'</div>'+
     '<div class="hp2K vr2"><span>Saiu</span><b>&minus;'+fmtQt(qSai)+' '+ab+'</b><small>R$ '+money(vSai)+'</small></div>'+
     '<div class="hp2Seta">'+sv('cr',13)+'</div>'+
     '<div class="hp2K hp2Atual"><span>Saldo atual</span><b>'+fmtQt(saldoFinal)+' '+ab+'</b>'+
      '<small>R$ '+money(saldoFinal*custoDoItem(i))+' em estoque · custo médio R$ '+money(custoDoItem(i))+'</small></div>'+
    '</div></div>'+
   '<div class="hpGrade" style="padding-top:0">'+
   '<div class="hpCol">'+
    '<div class="hpCard">'+
     '<div class="hpH">'+sv('down2',14)+' De onde veio</div>'+
     tabelaFluxo(origens,qEnt,'Este item ainda não teve entrada no período.')+
    '</div>'+
    '<div class="hpCard">'+
     '<div class="hpH">'+sv('out',14)+' Para onde foi</div>'+
     tabelaFluxo(dest,qSai,'Este item ainda não teve saída no período.')+
    '</div></div>'+
   '<div class="hpCol">'+
    '<div class="hpCard">'+
     '<div class="hpH">'+sv('list',14)+' Linha do tempo <span class="hpUn">'+lin.length+' movimentos · mais recente primeiro</span></div>'+
     (lin.length?'<div class="hpTimeW"><table class="hpTab"><thead><tr>'+
      '<th style="width:88px">Data</th><th>Movimento</th>'+
      '<th style="width:104px;text-align:right">Qtd</th>'+
      '<th style="width:110px;text-align:right">Saldo após</th></tr></thead><tbody>'+
      lin.slice().reverse().map(function(x,idx){
        var k3=lin.length-1-idx;
        var q=convUnid(x.l.qtd,x.l.unidade,i.unidade);
        if(q===null)q=x.l.qtd;
        return '<tr class="'+(x.l.direcao==='entrada'?'ent':'sai')+'">'+
        '<td>'+dataBR(x.m.data)+'<small>'+E(x.m.hora||'')+'</small></td>'+
        '<td><b>'+E(nomeMotivo(x.m.motivoId))+'</b><small>'+E(destinoLinha(x))+
         (x.l.custo?' · R$ '+money(x.l.qtd*x.l.custo):'')+'</small></td>'+
        '<td style="text-align:right"><b class="'+(x.l.direcao==='entrada'?'vg':'vr')+'">'+
         (x.l.direcao==='entrada'?'+':'&minus;')+fmtQt(x.l.qtd)+' '+un(x.l.unidade).ab+'</b></td>'+
        '<td style="text-align:right"><b>'+fmtQt(saldos[k3])+' '+ab+'</b></td></tr>';
      }).join('')+'</tbody></table></div>'
     :'<div class="hint" style="padding:20px">Nenhum movimento no período.</div>')+
    '</div></div></div>';
}

/* ---------- RANKINGS ---------- */
function blocoRanking(){
  var lin=linhasHist();
  function agrupa(fn,filtro){
    var m={};
    lin.forEach(function(x){
      if(filtro&&!filtro(x))return;
      var k=fn(x);
      if(!k)return;
      var ins=x.ins;
      var q=ins?convUnid(x.l.qtd,x.l.unidade,ins.unidade):x.l.qtd;
      if(q===null)q=x.l.qtd;
      m[k]=m[k]||{q:0,v:0,n:0,un:ins?un(ins.unidade).ab:''};
      m[k].q+=q;m[k].v+=x.l.qtd*x.l.custo;m[k].n++;
    });
    return Object.keys(m).map(function(k){return {nome:k,d:m[k]}})
      .sort(function(a,b){return b.d.q-a.d.q});
  }
  var produzidos=agrupa(function(x){return x.l.direcao==='entrada'?x.l.fichaNome:null},
    function(x){return String(x.l.origem||'').indexOf('producao')>=0});
  var consumidos=agrupa(function(x){return x.l.nome},
    function(x){return x.l.direcao==='saida'});
  var vendidos=agrupa(function(x){return x.l.fichaNome||x.l.nome},
    function(x){return x.m.origem==='venda'});

  function painel(titulo,icone,lista,rot){
  titulo=E(titulo);                /* P14 */
    var tot=lista.reduce(function(a,x){return a+x.d.q},0);
    return '<div class="hpCard">'+
     '<div class="hpH">'+sv(icone,14)+' '+titulo+'</div>'+
     (lista.length?'<table class="hpTab"><tbody>'+lista.slice(0,12).map(function(x,k){
       var pc=tot?(x.d.q/tot*100):0;
       return '<tr><td style="width:26px"><span class="posN">'+(k+1)+'</span></td>'+
       '<td><b>'+E(x.nome)+'</b><small>'+x.d.n+' '+rot+'</small></td>'+
       '<td style="width:110px;text-align:right"><b>'+fmtQt(x.d.q)+' '+x.d.un+'</b></td>'+
       '<td style="width:100px;text-align:right">R$ '+money(x.d.v)+'</td>'+
       '<td style="width:86px"><span class="hpBar"><i style="width:'+Math.min(100,pc)+'%"></i></span>'+
       '<small>'+pc.toFixed(0)+'%</small></td></tr>';
     }).join('')+'</tbody></table>'
     :'<div class="hint" style="padding:16px">Nada no período.</div>')+
    '</div>';
  }
  return '<div class="hpGrade um">'+
   painel('Sabores mais produzidos','box',produzidos,'produção(ões)')+
   painel('Itens mais consumidos','dn4',consumidos,'saída(s)')+
   painel('Mais vendidos (baixa por venda)','cart',vendidos,'venda(s)')+
  '</div>';
}

/* ---------- LINHA DO TEMPO GERAL ---------- */
function blocoLinhaTempo(){
  var lin=linhasHist().reverse();
  var tot=lin.reduce(function(a,x){return a+x.l.qtd*x.l.custo},0);
  return '<div class="etTabW plano2">'+
   (lin.length?'<table class="etTab semBusca"><thead><tr>'+
    '<th style="width:96px">Data</th><th style="width:150px">Motivo</th>'+
    '<th>Item</th><th style="width:130px">Grupo</th>'+
    '<th>Origem / destino</th>'+
    '<th style="width:120px;text-align:right">Quantidade</th>'+
    '<th style="width:118px;text-align:right">Custo médio</th>'+
    '<th style="width:110px;text-align:right">Valor</th></tr></thead><tbody>'+
    lin.map(function(x){
      var g=x.ins?grupoIng(x.ins.grupoId):null;
      return '<tr class="'+(x.l.direcao==='entrada'?'ent':'sai')+'">'+
      '<td>'+dataBR(x.m.data)+'<small>'+E(x.m.hora||'')+'</small></td>'+
      '<td>'+E(nomeMotivo(x.m.motivoId))+'</td>'+
      '<td><b>'+E(x.l.nome)+'</b></td>'+
      '<td>'+E(g?g.nome:'—')+'</td>'+
      '<td>'+E(destinoLinha(x))+
       (x.l.obs?'<small style="display:block;color:var(--ink-3)">'+E(x.l.obs)+'</small>':'')+'</td>'+
      '<td style="text-align:right"><b class="'+(x.l.direcao==='entrada'?'vg':'vr')+'">'+
       (x.l.direcao==='entrada'?'+':'-')+fmtQt(x.l.qtd)+' '+un(x.l.unidade).ab+'</b></td>'+
      '<td style="text-align:right">R$ '+money(x.l.custo)+
       '<small style="color:var(--ink-3)"> /'+un(x.l.unidade).ab+'</small></td>'+
      '<td style="text-align:right">R$ '+money(x.l.qtd*x.l.custo)+'</td></tr>';
    }).join('')+'</tbody>'+
    '<tfoot><tr><td colspan="7"><b>'+lin.length+' movimentos</b></td>'+
    '<td style="text-align:right"><b>R$ '+money(tot)+'</b></td></tr></tfoot></table>'
   :'<div class="mvVazio">'+sv('box',26)+'<b>Nenhum movimento no período</b></div>')+
   '</div>';
}
function exportarHist(){
  var lin=linhasHist(HP.aba==='rastreio'?HP.item:'');
  var l=[['Data','Hora','Motivo','Item','Grupo','Origem/destino','Observacao','Direcao','Quantidade','Unidade','Custo medio','Valor']];
  lin.forEach(function(x){
    var g=x.ins?grupoIng(x.ins.grupoId):null;
    l.push([dataBR(x.m.data),x.m.hora||'',nomeMotivo(x.m.motivoId),x.l.nome,g?g.nome:'',
      destinoLinha(x),x.l.obs||x.m.obs||'',x.l.direcao,String(x.l.qtd).replace('.',','),un(x.l.unidade).ab,
      String(x.l.custo).replace('.',','),String(arred(x.l.qtd*x.l.custo).toFixed(2)).replace('.',',')]);
  });
  var csv=l.map(function(r){return r.map(function(c){return '"'+String(c).replace(/"/g,'""')+'"'}).join(';')}).join('\n');
  var b=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'});
  var a=document.createElement('a');a.href=URL.createObjectURL(b);
  a.download='nexor-historico-estoque.csv';document.body.appendChild(a);a.click();
  setTimeout(function(){a.remove()},400);
  toast('Histórico exportado.');
}

/* ==========================================================
   DADOS DE TESTE E REINÍCIO
   ========================================================== */
function telaReset(){
  baseMov();
  var grupos=[
    {t:'Cadastros',its:[['Ingredientes',(DB.insumos||[]).length],
      ['Fichas técnicas',(DB.fichas||[]).length],
      ['Grupos de ingredientes',(DB.gruposIng||[]).length],
      ['Fornecedores',(DB.fornec||[]).length]]},
    {t:'Cardápio',its:[['Categorias',(DB.categorias||[]).length],
      ['Produtos',(DB.produtos||[]).length]]},
    {t:'Movimento',its:[['Movimentações de estoque',(DB.movEst||[]).length],
      ['Contagens',(DB.contagens||[]).length],
      ['Notas de entrada',(DB.notas||[]).length],
      ['Ordens de produção',(DB.ordensProd||[]).length]]},
    {t:'Venda e financeiro',its:[['Pedidos',(DB.pedidos||[]).length],
      ['Caixas',(DB.caixas||[]).length],
      ['Lançamentos financeiros',(DB.lancFin||[]).length],
      ['Clientes',(DB.clientes||[]).length]]}
  ];
  function opcao(cor,ic,titulo,sub,corpo,botao,acao,perigo){
  titulo=E(titulo);sub=E(sub);     /* P14 */
    return '<div class="rsCard'+(perigo?' rsPerigo':'')+'">'+
     '<div class="rsH"><div class="rsIc" style="background:'+cor[0]+';color:'+cor[1]+'">'+sv(ic,16)+'</div>'+
      '<div><b>'+titulo+'</b><span>'+sub+'</span></div></div>'+
     '<div class="rsB">'+corpo+
      '<button class="btnP2'+(perigo?' rdB':'')+'" style="margin-top:10px" onclick="'+acao+'">'+botao+'</button>'+
     '</div></div>';
  }
  $('content').innerHTML='<div class="ctWrap" style="max-width:1080px">'+
   '<div class="ctTopo"><h1>Dados de Teste e Reinício</h1>'+
    '<p>O que existe hoje neste aparelho, e três formas de limpar — da mais leve para a mais radical. '+
    'Cada uma diz exatamente o que apaga e o que preserva.</p></div>'+
   '<div class="rsGrade">'+grupos.map(function(g){
     var tot=g.its.reduce(function(a,x){return a+x[1]},0);
     return '<div class="rsBloco"><div class="rsBlocoH">'+g.t+
      '<em>'+tot+'</em></div>'+g.its.map(function(x){
        return '<div class="rsL'+(x[1]?'':' rsZero')+'"><span>'+x[0]+'</span><b>'+x[1]+'</b></div>';
      }).join('')+'</div>';
   }).join('')+'</div>'+
   '<div class="rsOpcoes">'+
    opcao(['var(--alt,#f2f3f7)','var(--ink-2,#4a4a55)'],'trash',
      'Apagar a demonstração','só os itens de exemplo que o sistema criou',
      '<div class="rsNota">Preserva tudo que você cadastrou. É o passo natural depois de testar o sistema.</div>',
      'Apagar demonstração','limparDemo()')+
    opcao(['var(--acc-soft,#E0F5F1)','var(--acc,#00806F)'],'box',
      'Zerar o estoque inteiro','apaga tudo de estoque e mantém só o cardápio',
      '<div class="rsNota"><b class="vr">Apaga:</b> ingredientes, grupos, fichas técnicas, '+
      'fornecedores, movimentações, contagens, notas de entrada e ordens de produção.<br>'+
      '<b class="vg">Mantém:</b> cardápio, produtos do PDV, pedidos, financeiro, clientes, '+
      'sucursais e usuários.</div>'+
      '<div class="rsNota" style="margin-top:6px;font-size:11.5px;color:var(--ink-3)">'+
      'É o passo certo antes de importar os dados de um sistema anterior.</div>',
      'Zerar estoque e fichas','zerarEstoqueTudo()')+
    opcao(['#FFF4E0','#7A4C05'],'ref',
      'Zerar o movimento','apaga o que aconteceu, mantém o que é cadastro',
      '<div class="rsNota"><b class="vr">Apaga:</b> pedidos, caixas, movimentações, contagens, '+
      'notas de entrada e lançamentos financeiros.<br>'+
      '<b class="vg">Mantém:</b> cardápio, fichas, ingredientes, clientes e configurações.</div>',
      'Zerar movimento','zerarMovimento()')+
    opcao(['var(--red-soft,#FBE9E9)','var(--red,#C94141)'],'x2',
      'Reiniciar o sistema','volta ao estado de fábrica',
      '<div class="rsNota"><b class="vr">Apaga absolutamente tudo</b> — cadastros, cardápio, '+
      'movimento, financeiro e configurações.<br>Não dá para desfazer.</div>'+
      '<div class="rsAviso">'+sv('help',14)+'<div>Faça um backup antes, em '+
      '<b>Administração › Backup e Restauração</b>.</div></div>',
      'Reiniciar tudo','resetTotal()',true)+
   '</div></div>';
  rodape('reinício do sistema');
}
async function zerarEstoqueTudo(){
  var ok=await confirmar({titulo:'Zerar todo o estoque',
    texto:'Ingredientes, fichas técnicas, grupos, fornecedores e todo o movimento de estoque serão apagados.',
    linhas:[['Ingredientes',String((DB.insumos||[]).length),''],
            ['Fichas técnicas',String((DB.fichas||[]).length),''],
            ['Grupos',String((DB.gruposIng||[]).length),''],
            ['Fornecedores',String((DB.fornec||[]).length),''],
            ['Movimentações',String((DB.movEst||[]).length),'']],
    aviso:'O <b>cardápio</b>, os pedidos, o financeiro, os clientes, as sucursais e os usuários '+
      '<b>não são tocados</b>.<br>Esta ação não pode ser desfeita.',
    ok:'Zerar estoque',tipo:'perigo'});
  if(!ok)return;
  DB.insumos=[];DB.fichas=[];DB.gruposIng=[];DB.fichaCats=[];DB.fornec=[];
  DB.movEst=[];DB.contagens=[];DB.notas=[];DB.ordensProd=[];DB.comprasSemVinc=[];
  DB._demo=false;DB._cargaFeita='';
  autorizarEsvaziar();
  salvar();telaReset();
  toast('Estoque zerado. O cardápio continua intacto.');
}
async function limparDemo(){
  if(!await pergunta('Apagar os ingredientes e sabores de demonstração?'))return;
  var idsF=(DB.fichas||[]).filter(function(f){return f.demo}).map(function(f){return f.id});
  var idsI=(DB.insumos||[]).filter(function(i){return i.demo}).map(function(i){return i.id});
  DB.fichas=(DB.fichas||[]).filter(function(f){return !f.demo});
  DB.insumos=(DB.insumos||[]).filter(function(i){return !i.demo});
  DB.movEst=(DB.movEst||[]).filter(function(m){
    return !(m.linhas||[]).some(function(l){return idsI.indexOf(l.insumoId)>=0||idsF.indexOf(l.fichaId)>=0});
  });
  DB._demo=false;
  autorizarEsvaziar();
  salvar();telaReset();toast('Dados de demonstração apagados.');
}
async function zerarMovimento(){
  if(!await pergunta('Apagar todo o movimento?\n\nPedidos, caixas, movimentações de estoque, contagens e lançamentos financeiros serão removidos.\nOs cadastros continuam.'))return;
  DB.pedidos=[];DB.caixas=[];DB.movEst=[];DB.contagens=[];DB.lancFin=[];
  DB.fiadoMov=[];DB.cupomUsos=[];DB.acertos=[];
  autorizarEsvaziar();
  (DB.insumos||[]).forEach(function(i){i.estoqueAtual=0});
  (DB.clientes||[]).forEach(function(c){c.compras=0;c.gasto=0;c.saldoFiado=0;c.ultima='';});
  salvar();telaReset();toast('Movimento zerado.');
}
async function resetTotal(){
  if(!await pergunta('REINICIAR O SISTEMA?\n\nTudo será apagado: cardápio, fichas, estoque, financeiro, clientes e configurações.'))return;
  if(!await pergunta('Tem certeza absoluta?\n\nEsta ação não pode ser desfeita.'))return;
  try{localStorage.removeItem('nexor_dados');}catch(e){_quieto(e,'resetTotal')}
  location.reload();
}

/* ==========================================================
   BLOCO — CAIXA DE ENTRADA DA ASSISTENTE

   O robô entende, confere com o gestor e grava o lançamento já
   confirmado em whatsapp_pendentes. Quem APLICA é aqui.

   Por que não deixar o robô aplicar direto: no Nexor o estoque é
   um número guardado no insumo, somado por aplicarMovimento().
   Não existe reconstrução a partir dos movimentos. Se o robô
   também somasse, seriam duas contas em lugares diferentes — e
   é assim que nasce divergência de estoque. Aqui a nota nasce
   pelo mesmo caminho de uma pessoa digitando: mesma função de
   movimento, mesmo formato de lançamento, mesmo custo médio.
   ========================================================== */

var CX_ASSIST = { itens: [], buscando: false, ultimaBusca: 0 };

/* ---------- buscar a fila ---------- */
async function buscarPendentesAssistente(){
  if(!NUVEM.ligada||!NUVEM.loja)return [];
  var r=await api('whatsapp_pendentes?loja_id=eq.'+NUVEM.loja+
    '&situacao=eq.confirmado&order=criado_em.asc&limit=50');
  return r||[];
}

/* ---------- aplicar um pendente ---------- */
async function aplicarPendenteAssistente(p){
  var d=p.dados||{};
  if(d.tipo!=='nota_entrada')throw new Error('Tipo de lançamento desconhecido: '+d.tipo);
  baseNotas();baseForn();

  var itens=(d.itens||[]).map(function(x){
    /* o robô mandou o identificador da nuvem; aqui vale o do aparelho */
    var i2=(DB.insumos||[]).find(function(i){
      return i.id===x.insumoRef||i.id===x.insumoId||
             (i.nome||'').toLowerCase()===(x.nome||'').toLowerCase();});
    if(!i2)throw new Error('Item não encontrado no cadastro: '+(x.nome||'?'));
    var qtd=Number(x.quantidade)||0;
    var tot=Number(x.valorTotal)||0;
    if(qtd<=0)throw new Error('Quantidade inválida em '+i2.nome);
    return {insumoId:i2.id,nome:i2.nome,unidade:x.unidade||i2.unidade||'un',
      qtd:qtd,valor:+(tot/qtd).toFixed(6),desconto:0,total:tot};
  });
  if(!itens.length)throw new Error('Nenhum item para lançar.');

  /* fornecedor: acha pelo nome ou cria, para a nota não nascer solta */
  var fnome=(d.fornecedor||'').trim();
  var forn=null;
  if(fnome){
    var chv=fnome.toLowerCase();
    DB.fornec=DB.fornec||[];
    forn=(DB.fornec||[]).find(function(f){
      return String(f.empresa||'').toLowerCase()===chv;});
    if(!forn){
      /* campos no formato que a tela e o envio esperam: nome/tel/whats,
         nao contato/telefone/whatsapp */
      forn={id:uid('fn'),empresa:fnome,nome:'',cnpj:'',email:'',tel:'',
        whats:'',criadoEm:new Date().toISOString()};
      DB.fornec.push(forn);
    }
  }

  var total=+(itens.reduce(function(a,i){return a+i.total},0)).toFixed(2);
  var dt=d.data||hojeISO();
  var doc=d.documento||('ASSIST-'+String(p.id||'').slice(0,8));

  var n={id:uid('nf'),numero:doc,data:dt,hora:agoraHM(),
    fornecedorId:forn?forn.id:'',fornecedorNome:forn?forn.empresa:'(sem fornecedor)',
    itens:itens,valorMercadorias:total,valorTotal:total,receber:true,
    origem:'assistente',assistenteRef:p.id};

  /* financeiro: uma conta a pagar, em aberto. Banco e forma pertencem ao
     pagamento — quem paga escolhe depois, na confirmação, como no resto
     do sistema. A assistente não decide de onde o dinheiro sai. */
  /* o gestor disse na conversa se pagou ou não; sem isso todo lançamento
     entraria em aberto e o fluxo de caixa mentiria */
  var jaPago=!!d.pago;
  var lanc={id:uid('lf'),tipo:'despesa',contaId:'',metodoId:'',
    descricao:'NF '+doc+' — '+(forn?forn.empresa:'sem fornecedor'),
    fornecedor:forn?forn.empresa:'',fornecedorId:forn?forn.id:'',
    documento:'NF '+doc,categoriaTxt:'',
    valor:total,emissao:dt,vencimento:dt,
    pagamento:jaPago?dt:'',pago:jaPago,
    origem:'nota-entrada',ref:n.id,
    obs:'Lançado pela Assistente Joia, confirmado por '+(p.telefone||'—')+
      (d.formaPagamento?' · '+d.formaPagamento:'')};
  DB.lancFin.push(lanc);
  n.lancIds=[lanc.id];
  n.pagamento={tipo:'A prazo',parcelas:1,contaId:'',metodoId:'',categoriaId:''};

  /* estoque: MESMA função da tela. É o ponto todo deste bloco. */
  var linhas=itens.filter(function(it){
    var i2=insumo(it.insumoId);
    return i2&&i2.controlaEstoque!==false;
  }).map(function(it){
    return {insumoId:it.insumoId,nome:it.nome,unidade:it.unidade,qtd:it.qtd,
      custo:+(it.total/it.qtd).toFixed(6),direcao:'entrada',origem:'nota'};
  });
  if(linhas.length){
    var mov={id:uid('mv'),data:n.data,hora:n.hora,motivoId:'mv_nota',
      identificacao:'NF '+n.numero,obs:n.fornecedorNome+' · assistente',
      linhas:linhas,origem:'nota',notaId:n.id};
    DB.movEst.push(mov);
    aplicarMovimento(mov);
    n.movId=mov.id;
  }
  /* histórico de compra do item, que alimenta o preço da última compra */
  itens.forEach(function(it){
    var i2=insumo(it.insumoId);if(!i2)return;
    i2.compras=i2.compras||[];
    i2.compras.push({data:n.data,qtd:it.qtd,valor:+(it.total/it.qtd).toFixed(6),notaId:n.id});
    i2.custoUltima=+(it.total/it.qtd).toFixed(6);
  });

  DB.notas.push(n);
  salvar();
  return n;
}

/* ---------- marcar na nuvem ---------- */
async function marcarPendente(p,situacao,erro,notaId){
  var corpo={situacao:situacao,
    aplicado_em:new Date().toISOString(),
    aplicado_por:(usuarioLogado()||{}).login||''};
  if(erro)corpo.erro=String(erro).slice(0,400);
  if(notaId)corpo.dados=Object.assign({},p.dados||{},{notaId:notaId});
  await api('whatsapp_pendentes?id=eq.'+p.id,'PATCH',corpo);
}

/* ---------- o laço, que roda sozinho ---------- */
async function rodarCaixaAssistente(silencioso){
  if(CX_ASSIST.buscando)return;
  if(!NUVEM.ligada)return;
  CX_ASSIST.buscando=true;
  var feitos=0,falhos=0;
  try{
    var fila=await buscarPendentesAssistente();
    for(var k=0;k<fila.length;k++){
      var p=fila[k];
      try{
        var n=await aplicarPendenteAssistente(p);
        await marcarPendente(p,'aplicado',null,n.id);
        feitos++;
      }catch(e){
        /* erro de dado não melhora tentando de novo: marca e segue,
           senão a fila trava no primeiro item defeituoso */
        try{ await marcarPendente(p,'erro',(e&&e.message)||'falha'); }catch(e2){_quieto(e2,'rodarCaixaAssistente')}
        falhos++;
      }
    }
    if(feitos)NUVEM.sujo=true,DB._sujo=true,agendarSync();
  }catch(e){
    if(!silencioso)toast('Não consegui buscar os lançamentos da assistente.');
  }
  CX_ASSIST.buscando=false;
  CX_ASSIST.ultimaBusca=Date.now();
  if(feitos&&!silencioso===false){
    toast(feitos+' lançamento(s) da assistente aplicado(s)'+
      (falhos?' · '+falhos+' com erro':'')+'.');
  }
  if(falhos&&!feitos&&!silencioso)toast(falhos+' lançamento(s) da assistente com erro.');
  return {feitos:feitos,falhos:falhos};
}

/* de 60 em 60 segundos, e nunca com janela aberta ou aba em segundo plano —
   aplicar uma nota no meio de um lançamento que a pessoa está digitando
   redesenharia a tela debaixo da mão dela */
var _tCxAssist=null;
function ligarCaixaAssistente(){
  if(_tCxAssist)clearInterval(_tCxAssist);
  _tCxAssist=setInterval(function(){
    if(document.visibilityState!=='visible')return;
    if(document.getElementById('mdOv'))return;
    if(!NUVEM.ligada)return;
    rodarCaixaAssistente(true);
  },60000);
}
